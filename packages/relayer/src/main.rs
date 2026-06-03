//! Obsidian relayer — entry point.
//!
//! Step 2: load config from the environment, build the shared `AppState`, and
//! inject it into the handlers. `/info` now reports the chains we're configured for.

mod config;
mod state;

use std::sync::Arc;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
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
}

#[derive(Serialize)]
struct InfoResponse {
    service: &'static str,
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

/// `State(state)` is an Axum "extractor": it pulls our shared `AppState` out of
/// the request context, so the handler receives the dependencies it needs rather
/// than reaching for a global. We only read from it, so concurrent calls are safe.
async fn info(State(state): State<SharedState>) -> Json<InfoResponse> {
    let chains = state
        .config
        .chains
        .iter()
        .map(|c| ChainInfo {
            chain_id: c.chain_id,
            vault: c.vault_address.clone(),
        })
        .collect();

    Json(InfoResponse {
        service: "obsidian-relayer",
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
    // Load a local .env file if present (no-op in production where env is set directly).
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // Fail fast: if config is invalid, log a clear error and exit at boot — never
    // limp along and surprise a user mid-request.
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("configuration error: {e}");
            std::process::exit(1);
        }
    };

    let bind = config.bind();
    tracing::info!(
        chains = config.chains.len(),
        "loaded config for {} chain(s)",
        config.chains.len()
    );

    // Build the shared state ONCE, wrap it in an Arc, and hand it to the router.
    // Every handler now shares this single instance.
    let state: SharedState = Arc::new(AppState { config });

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
