//! Obsidian relayer — entry point.
//!
//! Step 1 (skeleton): stand up the HTTP server and three routes so we can see
//! "the loop" working. The handlers are stubs for now; we fill them in next.

use axum::{
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tracing_subscriber::EnvFilter;

// ── Response types ───────────────────────────────────────────────────────────
// We describe responses as plain structs and `derive(Serialize)` so serde can
// turn them into JSON automatically. This is "parse, don't validate" in reverse:
// our types are the source of truth, and the JSON is generated from them.

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Serialize)]
struct Stub {
    endpoint: &'static str,
    status: &'static str,
}

// ── Handlers ────────────────────────────────────────────────────────────────
// A "handler" is just an async function Axum calls for a matching request.
// Returning `Json<T>` makes Axum serialize T and set `Content-Type: application/json`.
// `async` means the function can pause (`.await`) on slow work (like a chain call)
// and let other requests run meanwhile — that's how one process serves many clients.

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

async fn info() -> Json<Stub> {
    Json(Stub {
        endpoint: "info",
        status: "not implemented yet",
    })
}

async fn relay() -> Json<Stub> {
    Json(Stub {
        endpoint: "relay",
        status: "not implemented yet",
    })
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
// `#[tokio::main]` turns this async `main` into a normal program entry point by
// starting the Tokio async runtime (the executor that drives all our `.await`s).

#[tokio::main]
async fn main() {
    // Observability: structured logs. RUST_LOG=debug to see more; defaults to info.
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // The router maps URL + method -> handler. This is the whole API surface.
    let app = Router::new()
        .route("/health", get(health))
        .route("/info", get(info))
        .route("/relay", post(relay));

    // Bind a TCP socket and hand it to Axum's serve loop (principle #1, literally).
    let addr = "0.0.0.0:8080";
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind address");

    tracing::info!("relayer listening on http://{addr}");
    axum::serve(listener, app)
        .await
        .expect("server error");
}
