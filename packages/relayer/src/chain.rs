//! Per-chain runtime context: the live RPC connection (with our wallet attached)
//! plus a lock that serializes transaction sends so concurrent requests can't
//! collide on the wallet's nonce.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex as StdMutex;

use alloy::network::EthereumWallet;
use alloy::primitives::{Address, U256};
use alloy::providers::{DynProvider, Provider, ProviderBuilder};
use alloy::signers::local::PrivateKeySigner;
use tokio::sync::Mutex;

use crate::config::Config;

pub struct ChainContext {
    pub chain_id: u64,
    /// RPC provider with the relayer wallet attached (so it can sign + send).
    /// `DynProvider` is a type-erased provider — it hides Alloy's complex generic
    /// "filler" stack behind one concrete type we can store in a struct.
    pub provider: DynProvider,
    pub vault_address: Address,
    /// Held (async) while submitting a transaction, so two requests can't grab the
    /// same nonce at once.
    pub send_lock: Mutex<()>,
    /// Nullifier hashes currently being submitted, to reject duplicate in-flight
    /// requests. A std Mutex is fine: we only ever lock it briefly (never across an
    /// `.await`).
    pub pending: StdMutex<HashSet<U256>>,
}

/// Build a `ChainContext` for every chain in the config, and return the relayer's
/// own address (derived from the private key).
///
/// Anything malformed (bad key, bad address, bad URL) fails here at boot.
pub async fn build_chains(
    config: &Config,
) -> Result<(Address, HashMap<u64, ChainContext>), String> {
    // The private key -> a signer. `.address()` is the relayer's public address.
    let signer: PrivateKeySigner = config
        .relayer_private_key
        .parse()
        .map_err(|e| format!("invalid RELAYER_PRIVATE_KEY: {e}"))?;
    let relayer_address = signer.address();
    let wallet = EthereumWallet::from(signer);

    let mut chains = HashMap::new();
    for c in &config.chains {
        let vault_address: Address = c
            .vault_address
            .parse()
            .map_err(|e| format!("VAULT_{} is not a valid address: {e}", c.chain_id))?;

        let url = c
            .rpc_url
            .parse()
            .map_err(|e| format!("RPC_{} is not a valid URL: {e}", c.chain_id))?;

        // ProviderBuilder::new() comes with the recommended fillers (gas, nonce,
        // chain-id). `.wallet(...)` lets it sign; `.on_http(url)` sets the transport;
        // `.erased()` collapses the generic type into a storable DynProvider.
        let provider = ProviderBuilder::new()
            .wallet(wallet.clone())
            .connect_http(url)
            .erased();

        chains.insert(
            c.chain_id,
            ChainContext {
                chain_id: c.chain_id,
                provider,
                vault_address,
                send_lock: Mutex::new(()),
                pending: StdMutex::new(HashSet::new()),
            },
        );
    }

    Ok((relayer_address, chains))
}
