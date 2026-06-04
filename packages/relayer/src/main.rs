//! Obsidian relayer — entry point.
//!
//! Step 3: build live chain connections at boot and report real on-chain data.
//! `/info` now derives the relayer address from the key and reads `denomination()`
//! from each configured vault.

mod chain;
mod config;
mod contract;
mod error;
mod fee;
mod state;

use std::sync::Arc;

use alloy::primitives::{Address, U256};
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tracing_subscriber::EnvFilter;

use crate::chain::{build_chains, ChainContext};
use crate::config::Config;
use crate::contract::ObsidianVault;
use crate::error::RelayError;
use crate::state::{AppState, SharedState};

// ── Response types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Serialize)]
struct ChainInfo {
    chain_id: u64,
    vault: String,
    /// All `None` if the chain's RPC is unreachable right now.
    denomination: Option<String>,
    /// The fee (6-decimal USDC units) a client should bake into its proof.
    fee: Option<String>,
    gas_price: Option<String>,
}

#[derive(Serialize)]
struct InfoResponse {
    service: &'static str,
    relayer: String,
    chains: Vec<ChainInfo>,
}

// ── /relay request + response ────────────────────────────────────────────────
// The wire sends every big number as a decimal string; we parse them into strong
// types at the boundary ("parse, don't validate"). Note there is NO `relayer`
// field — we always supply our own address, so a proof bound to a different
// relayer simply fails simulation.

#[derive(Deserialize)]
struct ProofJson {
    a: [String; 2],
    b: [[String; 2]; 2],
    c: [String; 2],
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelayRequest {
    chain_id: u64,
    proof: ProofJson,
    root: String,
    nullifier_hash: String,
    recipient: String,
    fee: String,
}

#[derive(Serialize)]
struct RelayResponse {
    tx_hash: String,
    chain_id: u64,
    fee: String,
}

fn parse_u256(label: &str, s: &str) -> Result<U256, RelayError> {
    s.parse::<U256>()
        .map_err(|_| RelayError::BadRequest(format!("invalid {label}: {s}")))
}

// ── Handlers ────────────────────────────────────────────────────────────────

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

async fn info(State(state): State<SharedState>) -> Json<InfoResponse> {
    let mut chains = Vec::new();

    for ctx in state.chains.values() {
        // A fee quote reads gas price + denomination and computes the fee. If the
        // chain's RPC is unreachable we degrade to `None` instead of failing the
        // whole endpoint.
        let info = match fee::quote(ctx, &state.config).await {
            Ok(q) => ChainInfo {
                chain_id: ctx.chain_id,
                vault: ctx.vault_address.to_string(),
                denomination: Some(q.denomination.to_string()),
                fee: Some(q.fee.to_string()),
                gas_price: Some(q.gas_price.to_string()),
            },
            Err(err) => {
                tracing::warn!(chain_id = ctx.chain_id, "fee quote failed: {err}");
                ChainInfo {
                    chain_id: ctx.chain_id,
                    vault: ctx.vault_address.to_string(),
                    denomination: None,
                    fee: None,
                    gas_price: None,
                }
            }
        };
        chains.push(info);
    }

    Json(InfoResponse {
        service: "obsidian-relayer",
        relayer: state.relayer_address.to_string(),
        chains,
    })
}

/// The gasless withdrawal endpoint. Runs a cheapest-first validation pipeline and
/// only spends gas once everything checks out.
async fn relay(
    State(state): State<SharedState>,
    Json(req): Json<RelayRequest>,
) -> Result<Json<RelayResponse>, RelayError> {
    // 1. Parse the wire strings into strong types (free, rejects malformed input).
    let a = [parse_u256("a[0]", &req.proof.a[0])?, parse_u256("a[1]", &req.proof.a[1])?];
    let b = [
        [parse_u256("b[0][0]", &req.proof.b[0][0])?, parse_u256("b[0][1]", &req.proof.b[0][1])?],
        [parse_u256("b[1][0]", &req.proof.b[1][0])?, parse_u256("b[1][1]", &req.proof.b[1][1])?],
    ];
    let c = [parse_u256("c[0]", &req.proof.c[0])?, parse_u256("c[1]", &req.proof.c[1])?];
    let root = parse_u256("root", &req.root)?;
    let nullifier = parse_u256("nullifierHash", &req.nullifier_hash)?;
    let provided_fee = parse_u256("fee", &req.fee)?;
    let recipient: Address = req
        .recipient
        .parse()
        .map_err(|_| RelayError::BadRequest(format!("invalid recipient: {}", req.recipient)))?;

    // 2. Find the chain (free).
    let ctx: &ChainContext = state
        .chains
        .get(&req.chain_id)
        .ok_or(RelayError::UnknownChain(req.chain_id))?;

    let vault = ObsidianVault::new(ctx.vault_address, &ctx.provider);

    // 3. Fee must cover the current quote and not exceed the denomination (cheap reads).
    let quote = fee::quote(ctx, &state.config).await.map_err(RelayError::Chain)?;
    if provided_fee < quote.fee {
        return Err(RelayError::FeeTooLow {
            required: quote.fee.to_string(),
            provided: provided_fee.to_string(),
        });
    }
    if provided_fee > quote.denomination {
        return Err(RelayError::BadRequest("fee exceeds denomination".to_string()));
    }

    // 4. Root must be known, note must be unspent (cheap reads).
    let known_root = vault
        .isKnownRoot(root)
        .call()
        .await
        .map_err(|e| RelayError::Chain(e.to_string()))?;
    if !known_root {
        return Err(RelayError::UnknownRoot);
    }
    let already_spent = vault
        .isSpent(nullifier)
        .call()
        .await
        .map_err(|e| RelayError::Chain(e.to_string()))?;
    if already_spent {
        return Err(RelayError::AlreadySpent);
    }

    // 5. Claim the nullifier so a duplicate request in the same window is rejected.
    {
        let mut pending = ctx.pending.lock().expect("pending lock poisoned");
        if pending.contains(&nullifier) {
            return Err(RelayError::InFlight);
        }
        pending.insert(nullifier);
    }

    // From here on we must release the claim on every exit path.
    let result = submit_withdraw(
        ctx, a, b, c, root, nullifier, recipient, state.relayer_address, provided_fee,
    )
    .await;

    ctx.pending.lock().expect("pending lock poisoned").remove(&nullifier);

    let tx_hash = result?;

    tracing::info!(chain_id = req.chain_id, %tx_hash, "withdrawal relayed");
    Ok(Json(RelayResponse {
        tx_hash: tx_hash.to_string(),
        chain_id: req.chain_id,
        fee: provided_fee.to_string(),
    }))
}

/// Simulate then submit. Kept separate so the caller can always clean up the
/// pending claim regardless of how this returns. Builds its own vault handle so
/// we never have to name Alloy's generic contract-instance type.
#[allow(clippy::too_many_arguments)]
async fn submit_withdraw(
    ctx: &ChainContext,
    a: [U256; 2],
    b: [[U256; 2]; 2],
    c: [U256; 2],
    root: U256,
    nullifier: U256,
    recipient: Address,
    relayer: Address,
    fee: U256,
) -> Result<alloy::primitives::TxHash, RelayError> {
    let vault = ObsidianVault::new(ctx.vault_address, &ctx.provider);
    let call = vault
        .withdraw(a, b, c, root, nullifier, recipient, relayer, fee)
        .gas(fee::WITHDRAW_GAS_LIMIT);

    // Simulate first (free, on-chain proof verification). A revert here = bad/spent
    // proof; reject without spending gas. This is the anti-griefing gate.
    call.call()
        .await
        .map_err(|e| RelayError::SimulationFailed(e.to_string()))?;

    // Submit, serialized per chain so concurrent sends can't reuse a nonce.
    let pending_tx = {
        let _guard = ctx.send_lock.lock().await;
        call.send()
            .await
            .map_err(|e| RelayError::Chain(e.to_string()))?
    };

    Ok(*pending_tx.tx_hash())
}

// ── Bootstrap ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = match Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("configuration error: {e}");
            std::process::exit(1);
        }
    };

    // Build the live chain connections (and derive the relayer address). Bad key,
    // address, or URL fails here at boot.
    let (relayer_address, chains) = match build_chains(&config).await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("chain setup error: {e}");
            std::process::exit(1);
        }
    };

    let bind = config.bind();
    tracing::info!(
        relayer = %relayer_address,
        chains = chains.len(),
        "relayer ready"
    );

    let state: SharedState = Arc::new(AppState {
        config,
        relayer_address,
        chains,
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/info", get(info))
        .route("/relay", post(relay))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .expect("failed to bind address");

    tracing::info!("relayer listening on http://{bind}");
    axum::serve(listener, app).await.expect("server error");
}
