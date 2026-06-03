//! Shared application state — the "dependency injection" container.
//!
//! We build this ONCE at startup and give every request handler a reference to
//! the same instance, instead of reaching for global variables. Today it only
//! holds the config; in the next step it'll also hold the live per-chain
//! connections (providers + wallet).

use std::sync::Arc;

use crate::config::Config;

pub struct AppState {
    pub config: Config,
    // (next step) pub chains: HashMap<u64, ChainContext>,
}

/// `Arc` = Atomically Reference-Counted pointer. It lets many concurrent tasks
/// share ONE `AppState` safely: each clone bumps a counter rather than copying
/// the data, and the value is freed when the last reference is dropped. This is
/// the standard way to share read-only state across async handlers.
pub type SharedState = Arc<AppState>;
