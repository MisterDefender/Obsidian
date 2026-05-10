# @obsidian/sdk

Client library for the Obsidian shielded vault. Works in Node and the browser.
Circuit artifacts (`wasm` / `zkey`) are passed in by the caller, so the SDK stays
environment-agnostic.

## What's inside
- **Notes** — `createNote`, `encodeNote` / `parseNote` (portable `obsidian-v1-<chainId>-0x…` strings),
  commitment + nullifier-hash derivation.
- **Merkle tree** — `MerkleTree` / `createMerkleTree`: a Poseidon tree that mirrors
  `MerkleTreeWithHistory.sol` exactly, so roots and paths verify on-chain.
- **Prover** — `generateWithdrawProof` (groth16, returns Solidity calldata) and
  `verifyWithdrawProof`.
- **Pool client** — `ObsidianPool`: rebuilds the tree from `Deposit` events and
  assembles a withdrawal (`prepareWithdraw`).

## Example

```ts
import { ObsidianPool, createNote, encodeNote, parseNote } from '@obsidian/sdk';

// 1. deposit
const note = await createNote();
const pool = ObsidianPool.connect(vaultAddress, signer);
await pool.vault.deposit(note.commitment);
const backup = encodeNote(note, chainId); // save this string

// 2. withdraw later (optionally via a relayer)
const { note: restored } = await parseNote(backup);
const w = await pool.prepareWithdraw(restored, {
  recipient,
  relayer,
  fee,
  artifacts: { wasm, zkey }, // path (Node) or bytes/URL (browser)
});
await pool.vault.withdraw(w.a, w.b, w.c, w.root, w.nullifierHash, w.recipient, w.relayer, w.fee);
```

## Build & test
```bash
npm run build      # tsc -> dist/
npm test           # build, then node:test (the proof test needs @obsidian/circuits built first)
```

See [`ROADMAP.md`](../../ROADMAP.md) (Phase 5).
