//! Shared application state — the "dependency injection" container, built once at
//! startup and shared (via `Arc`) by every request handler.

use std::collections::HashMap;
use std::sync::Arc;

use alloy::primitives::Address;

use crate::chain::ChainContext;
use crate::config::Config;

pub struct AppState {
    pub config: Config,
    /// The relayer's own address (derived from the private key).
    pub relayer_address: Address,
    /// Live per-chain connections, keyed by chain id.
    pub chains: HashMap<u64, ChainContext>,
}

/// `Arc` lets many concurrent async tasks share ONE `AppState` safely.
pub type SharedState = Arc<AppState>;
