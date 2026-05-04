# @obsidian/contracts

Solidity smart contracts for Obsidian, built with Hardhat + `hardhat-deploy`.

## Contracts
- `ObsidianVault.sol` — the shielded vault: deposits insert a Merkle leaf; withdrawals prove
  inclusion under a known recent root (relayer + fee supported), block double-spends, and never
  reveal which deposit is being spent.
- `MerkleTreeWithHistory.sol` — append-only incremental Poseidon Merkle tree (depth 20) with a
  rolling root history.
- `Verifier.sol` — Groth16 verifier (generated from the circuit; `Groth16Verifier`).
- `USDC.sol` — mock ERC-20 used for local testing.

The on-chain **Poseidon hasher** has no `.sol` source — it's deployed from circomlib-generated
bytecode (`deploy/01_Poseidon.deploy.ts`) so it matches the circuit's Poseidon bit-for-bit.

## Commands
```bash
npm run compile        # hardhat compile
npm run test           # hardhat test (requires circuit artifacts: build @obsidian/circuits first)
npm run deploy         # hardhat deploy  (Poseidon -> Verifier -> ObsidianVault)
```

> Tests build real zk proofs via `test/helpers/zk.cjs`, so they need
> `@obsidian/circuits` built first (`npm run build` there).

See [`ROADMAP.md`](../../ROADMAP.md) and [`docs/PHASE1-DESIGN.md`](../../docs/PHASE1-DESIGN.md).
