# @obsidian/circuits

zk-SNARK circuits, trusted-setup ceremony, and proof tooling for Obsidian.

## Contents
- `circuits/` — circom source (`withdraw.circom`)
- `run.zsh` — circuit compile + Powers-of-Tau ceremony (dev)
- `scripts/` — proof generation tooling (`proofGenerator.js`, `proofBuilder.js`, `throughput.checker.js`)
- `Proofs/` — generated proof samples + timing logs (gitignored)
- `*.ptau`, `*.zkey`, `outputs/`, `verification_key.json` — build artifacts

> **Phase 1 note:** the current `withdraw.circom` proves only `commitment = Poseidon(secret, nullifier)`.
> Phase 1 rewrites it to prove **Merkle inclusion** under a public root (the fix that makes privacy real).
> The proof tooling here and the legacy tests in `@obsidian/contracts` will be re-wired then.
> Relative paths inside the circuit `include` and `run.zsh` also need updating for the monorepo layout.

See [`ROADMAP.md`](../../ROADMAP.md) (Phases 1 & 3).
