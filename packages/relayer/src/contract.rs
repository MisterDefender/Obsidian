//! Type-safe bindings to ObsidianVault.
//!
//! The `sol!` macro parses this Solidity interface AT COMPILE TIME and generates
//! Rust types + methods for it. `#[sol(rpc)]` additionally generates a contract
//! instance (`ObsidianVault::new(address, provider)`) whose methods build and send
//! real RPC calls. If the ABI here and the on-chain contract disagree, you get a
//! decode error — the types keep us honest.

use alloy::sol;

sol! {
    #[sol(rpc)]
    contract ObsidianVault {
        function denomination() external view returns (uint256);
        function isKnownRoot(uint256 root) external view returns (bool);
        function isSpent(uint256 nullifierHash) external view returns (bool);
        function commitments(uint256 commitment) external view returns (bool);
        function getLastRoot() external view returns (uint256);

        function withdraw(
            uint256[2] a,
            uint256[2][2] b,
            uint256[2] c,
            uint256 root,
            uint256 nullifierHash,
            address recipient,
            address relayer,
            uint256 fee
        ) external;
    }
}
