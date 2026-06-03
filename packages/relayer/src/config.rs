//! Configuration, loaded from environment variables (the "12-factor" principle:
//! the same binary runs against local hardhat or a testnet purely by changing env).
//!
//! Everything the service needs to *start* is read here, once, at boot. If a
//! required value is missing or malformed we fail immediately with a clear message
//! — that's "fail fast at startup" (much better than a confusing error mid-request).

use std::env;

/// Per-chain settings. Addresses/URLs are kept as `String` here; in the next step
/// we'll parse them into real Alloy types when we build the live chain connections.
#[derive(Clone, Debug)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub rpc_url: String,
    pub vault_address: String,
}

/// The whole service configuration.
///
/// NOTE: we deliberately do NOT `derive(Debug)` here — it holds the relayer's
/// private key, and a stray `{:?}` log of a Debug-printable secret is a classic
/// way to leak it. Secrets should be hard to print by accident.
#[derive(Clone)]
pub struct Config {
    pub bind_addr: String,
    pub port: u16,
    pub relayer_private_key: String,

    // Fee knobs (global). Testnet ETH has no real price, so we assume one.
    pub eth_price_usd: f64,
    pub fee_margin_bps: u64, // basis points added on top, e.g. 2000 = +20%
    pub min_fee_usdc: u128,  // floor, in 6-decimal USDC units

    pub chains: Vec<ChainConfig>,
}

impl Config {
    /// Build the config from the process environment.
    ///
    /// Returns `Result<Self, String>`: either a valid Config, or an error message.
    /// The `?` operator below means "if this step returns an Err, stop and return
    /// that Err from `from_env` too" — error handling with no hidden control flow.
    pub fn from_env() -> Result<Self, String> {
        let bind_addr = optional("BIND_ADDR", "0.0.0.0");

        let port = optional("PORT", "8080")
            .parse::<u16>()
            .map_err(|e| format!("PORT is not a valid port number: {e}"))?;

        let relayer_private_key = required("RELAYER_PRIVATE_KEY")?;

        let eth_price_usd = optional("ETH_PRICE_USD", "3000")
            .parse::<f64>()
            .map_err(|e| format!("ETH_PRICE_USD is not a number: {e}"))?;

        let fee_margin_bps = optional("FEE_MARGIN_BPS", "2000")
            .parse::<u64>()
            .map_err(|e| format!("FEE_MARGIN_BPS is not an integer: {e}"))?;

        let min_fee_usdc = optional("MIN_FEE_USDC", "1000000")
            .parse::<u128>()
            .map_err(|e| format!("MIN_FEE_USDC is not an integer: {e}"))?;

        // CHAINS is a comma-separated list of chain ids, e.g. "11155111,421614,84532".
        // For each id we then look up RPC_<id> and VAULT_<id>.
        let chains_raw = required("CHAINS")?;
        let mut chains = Vec::new();
        for id_str in chains_raw.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            let chain_id = id_str
                .parse::<u64>()
                .map_err(|e| format!("CHAINS contains a bad chain id '{id_str}': {e}"))?;
            let rpc_url = required(&format!("RPC_{chain_id}"))?;
            let vault_address = required(&format!("VAULT_{chain_id}"))?;
            chains.push(ChainConfig {
                chain_id,
                rpc_url,
                vault_address,
            });
        }
        if chains.is_empty() {
            return Err("CHAINS must list at least one chain id".to_string());
        }

        Ok(Config {
            bind_addr,
            port,
            relayer_private_key,
            eth_price_usd,
            fee_margin_bps,
            min_fee_usdc,
            chains,
        })
    }

    /// Convenience: the `host:port` string to bind the server to.
    pub fn bind(&self) -> String {
        format!("{}:{}", self.bind_addr, self.port)
    }
}

/// Read a required env var, or return a descriptive error.
fn required(key: &str) -> Result<String, String> {
    env::var(key).map_err(|_| format!("missing required env var: {key}"))
}

/// Read an env var, falling back to a default if it's not set.
fn optional(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}
