//! Obsidian relayer — entry point.
//!
//! Step 3: build live chain connections at boot and report real on-chain data.
//! `/info` now derives the relayer address from the key and reads `denomination()`
//! from each configured vault.

mod chain;
mod config;
mod contract;
mod state;

use std::sync::Arc;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tracing_subscriber::EnvFilter;

use crate::chain::build_chains;
use crate::config::Config;
use crate::contract::ObsidianVault;
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
    /// `None` if the chain's RPC is unreachable right now.
    denomination: Option<String>,
}

#[derive(Serialize)]
struct InfoResponse {
    service: &'static str,
    relayer: String,
    chains: Vec<ChainInfo>,
}

#[derive(Serialize)]
struct Stub {
    endpoint: &'static str,
    status: &'static str,
}

// ── Handlers ────────────────────────────────────────────────────────────────

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

async fn info(State(state): State<SharedState>) -> Json<InfoResponse> {
    let mut chains = Vec::new();

    for ctx in state.chains.values() {
        // Build a contract handle bound to this chain's provider + vault address,
        // then actually call denomination() over RPC. The read may fail (RPC down),
        // so we degrade gracefully to `None` rather than erroring the whole endpoint.
        let vault = ObsidianVault::new(ctx.vault_address, &ctx.provider);
        let denomination = match vault.denomination().call().await {
            Ok(value) => Some(value.to_string()),
            Err(err) => {
                tracing::warn!(chain_id = ctx.chain_id, "denomination read failed: {err}");
                None
            }
        };

        chains.push(ChainInfo {
            chain_id: ctx.chain_id,
            vault: ctx.vault_address.to_string(),
            denomination,
        });
    }

    Json(InfoResponse {
        service: "obsidian-relayer",
        relayer: state.relayer_address.to_string(),
        chains,
    })
}

async fn relay() -> Json<Stub> {
    Json(Stub {
        endpoint: "relay",
        status: "not implemented yet",
    })
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
