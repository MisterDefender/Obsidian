// @obsidian/sdk — client library for the Obsidian shielded vault.
//
// Notes, a Poseidon Merkle tree that mirrors the on-chain tree, withdraw-proof
// generation (snarkjs), and a high-level pool client that rebuilds the tree from
// events. Works in Node and the browser; circuit artifacts (wasm/zkey) are passed
// in by the caller.

export { FIELD_SIZE, DEFAULT_LEVELS, ZERO_VALUE } from './constants.js';
export { getPoseidon, poseidonHash, type Poseidon } from './poseidon.js';
export { createNote, noteFromSecrets, encodeNote, parseNote, type Note } from './note.js';
export { MerkleTree, createMerkleTree, type MerkleProof } from './merkleTree.js';
export {
    generateWithdrawProof,
    verifyWithdrawProof,
    type Artifact,
    type ProofArtifacts,
    type WithdrawInputs,
    type WithdrawProof,
    type SolidityWithdrawProof,
} from './prover.js';
export {
    ObsidianPool,
    OBSIDIAN_VAULT_ABI,
    type PrepareWithdrawOptions,
    type PreparedWithdraw,
} from './pool.js';
