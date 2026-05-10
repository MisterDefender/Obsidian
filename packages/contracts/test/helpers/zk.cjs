/**
 * Test helper: a thin CommonJS bridge to @obsidian/sdk (which is ESM), plus the
 * local circuit artifact paths. The SDK is the single source of truth for notes,
 * the Poseidon Merkle tree, and proof generation — these tests exercise it against
 * the live contracts.
 */
const path = require('path');

const FIELD_SIZE =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const WASM_PATH = path.join(__dirname, '../../../circuits/build/withdraw_js/withdraw.wasm');
const ZKEY_PATH = path.join(__dirname, '../../../circuits/build/withdraw_final.zkey');

let _sdk = null;
async function sdk() {
    if (!_sdk) _sdk = await import('@obsidian/sdk');
    return _sdk;
}

async function getPoseidon() {
    return (await sdk()).getPoseidon();
}

async function createMerkleTree(levels) {
    return (await sdk()).createMerkleTree(levels);
}

async function generateNote() {
    return (await sdk()).createNote();
}

async function generateWithdrawProof({ note, merkleProof, recipient, relayer, fee }) {
    return (await sdk()).generateWithdrawProof(
        { note, merkleProof, recipient, relayer, fee },
        { wasm: WASM_PATH, zkey: ZKEY_PATH }
    );
}

module.exports = {
    FIELD_SIZE,
    getPoseidon,
    createMerkleTree,
    generateNote,
    generateWithdrawProof,
};
