# @obsidian/circuits

zk-SNARK circuits and trusted-setup ceremony for Obsidian.

## Contents
- `circuits/withdraw.circom` — the withdraw circuit: proves Merkle inclusion of a
  commitment under a public root, derives the nullifier hash, and binds
  `recipient`/`relayer`/`fee` (anti-tamper).
- `run.zsh` — compile + (dev) Powers-of-Tau ceremony. Produces `build/` artifacts and
  writes `Verifier.sol` into `@obsidian/contracts`.
- `build/` — generated artifacts (wasm, zkey, vkey); gitignored.
- `pot14_*.ptau` — dev Powers-of-Tau (gitignored, regenerable).

## Build

```bash
npm run build          # from packages/circuits  (compile + dev ceremony + export verifier)
```

The depth-20 Merkle circuit is ~11k constraints, so the ceremony uses a `2^14` ptau.

> **Dev ceremony only.** `run.zsh` is a single scripted contribution. The real multi-party
> ceremony is Phase 3. After it, regenerate `Verifier.sol` and the proving key.

## Proof generation

Proof building currently lives in the contracts test helper
(`packages/contracts/test/helpers/zk.cjs`) — a Poseidon Merkle tree mirror plus a
`groth16.fullProve` wrapper. This will be promoted into `@obsidian/sdk` in Phase 5.

See [`ROADMAP.md`](../../ROADMAP.md) and [`docs/PHASE1-DESIGN.md`](../../docs/PHASE1-DESIGN.md).
