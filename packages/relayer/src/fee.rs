//! Dynamic fee quoting.
//!
//! The relayer pays gas in ETH but is paid its fee in USDC, so the fee must cover
//! the gas cost (+ a margin) and never exceed the withdrawal amount. We quote:
//!
//!   gas_cost(wei) = gas_price * gas_limit
//!   fee(usdc)     = gas_cost(eth) * ETH_PRICE_USD * (1 + margin)
//!   fee           = clamp(fee, MIN_FEE, denomination)
//!
//! Reads (gas price, denomination) are async; the arithmetic is pure.

use alloy::primitives::U256;
use alloy::providers::Provider;

use crate::chain::ChainContext;
use crate::config::Config;
use crate::contract::ObsidianVault;

/// A withdrawal's gas is dominated by the Groth16 verification + up to two ERC-20
/// transfers, and is fairly stable. We can't `estimateGas` a real withdraw without
/// a valid proof, so we use a conservative constant.
pub const WITHDRAW_GAS_LIMIT: u64 = 450_000;

pub struct FeeQuote {
    /// Fee the client must bake into the proof, in 6-decimal USDC units.
    pub fee: U256,
    pub gas_price: u128,
    pub gas_limit: u64,
    pub denomination: U256,
}

/// Quote the current fee for a withdrawal on this chain.
pub async fn quote(ctx: &ChainContext, config: &Config) -> Result<FeeQuote, String> {
    // 1. current gas price (wei)
    let gas_price = ctx
        .provider
        .get_gas_price()
        .await
        .map_err(|e| format!("gas price read failed: {e}"))?;

    // 2. the denomination caps the fee
    let vault = ObsidianVault::new(ctx.vault_address, &ctx.provider);
    let denomination = vault
        .denomination()
        .call()
        .await
        .map_err(|e| format!("denomination read failed: {e}"))?;
    let denomination_u128 =
        u128::try_from(denomination).map_err(|_| "denomination too large".to_string())?;

    // 3. gas cost in wei (u128 is plenty: ~1e15 for typical gas)
    let gas_cost_wei = gas_price.saturating_mul(WITHDRAW_GAS_LIMIT as u128);

    // 4. wei(ETH, 1e18) -> USDC(1e6) at the configured price, plus margin.
    //    f64 is fine here: these values are well under 2^53, so no precision loss.
    let gas_cost_eth = gas_cost_wei as f64 / 1e18;
    let margin = 1.0 + (config.fee_margin_bps as f64) / 10_000.0;
    let fee_units_f64 = gas_cost_eth * config.eth_price_usd * 1e6 * margin;
    let mut fee_units = fee_units_f64 as u128;

    // 5. clamp: never below the floor, never above the denomination.
    fee_units = fee_units.max(config.min_fee_usdc);
    fee_units = fee_units.min(denomination_u128);

    Ok(FeeQuote {
        fee: U256::from(fee_units),
        gas_price,
        gas_limit: WITHDRAW_GAS_LIMIT,
        denomination,
    })
}
