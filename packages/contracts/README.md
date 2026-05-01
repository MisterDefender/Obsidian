# @obsidian/contracts

Solidity smart contracts for Obsidian, built with Hardhat + `hardhat-deploy`.

## Contracts
- `PrivateVault.sol` — the shielded vault (deposit commitments, verify proofs, pay out, block double-spends)
- `Verifier.sol` — Groth16 verifier (generated from the circuit)
- `USDC.sol` — mock ERC-20 used for local testing

## Commands
```bash
npm run compile        # hardhat compile
npm run test           # hardhat test
npm run deploy         # hardhat deploy
```

> **Phase 1 note:** `PrivateVault.withdraw()` currently takes the specific commitment as a public
> input, so the anonymity set is 1. Phase 1 adds an on-chain Merkle tree and reworks the vault +
> verifier accordingly. The legacy tests under `test/` depend on built circuit artifacts from
> `@obsidian/circuits` and will be re-wired once the new circuit lands.

See [`ROADMAP.md`](../../ROADMAP.md).
