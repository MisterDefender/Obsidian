/**
 * Test helpers for Obsidian: Poseidon hashing, a fixed-depth Merkle tree that
 * mirrors MerkleTreeWithHistory.sol, note generation, and withdraw-proof building.
 *
 * This is an interim, test-only mirror of what the Phase 5 SDK will provide.
 */
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { buildPoseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');

const FIELD_SIZE =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Must match MerkleTreeWithHistory.sol: keccak256(abi.encodePacked("obsidian")) % FIELD
const ZERO_VALUE =
    BigInt(ethers.keccak256(ethers.toUtf8Bytes('obsidian'))) % FIELD_SIZE;

const WASM_PATH = path.join(__dirname, '../../../circuits/build/withdraw_js/withdraw.wasm');
const ZKEY_PATH = path.join(__dirname, '../../../circuits/build/withdraw_final.zkey');

let _poseidon = null;
async function getPoseidon() {
    if (!_poseidon) _poseidon = await buildPoseidon();
    return _poseidon;
}

function randomFieldElement() {
    // 31 bytes < 2^248 < FIELD_SIZE, so always a valid field element
    return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
}

/** A fixed-depth Merkle tree using Poseidon, matching the on-chain tree. */
class MerkleTree {
    constructor(levels, poseidon) {
        this.levels = levels;
        this.poseidon = poseidon;
        this.F = poseidon.F;
        this.zeros = [];
        let current = ZERO_VALUE;
        for (let i = 0; i <= levels; i++) {
            this.zeros.push(current);
            current = this._hash(current, current);
        }
        this.leaves = [];
    }

    _hash(left, right) {
        return this.F.toObject(this.poseidon([left, right]));
    }

    insert(leaf) {
        this.leaves.push(BigInt(leaf));
        return this.leaves.length - 1;
    }

    _buildLayers() {
        const layers = [this.leaves.slice()];
        for (let level = 0; level < this.levels; level++) {
            const current = layers[level];
            const next = [];
            for (let i = 0; i < current.length; i += 2) {
                const left = current[i];
                const right = i + 1 < current.length ? current[i + 1] : this.zeros[level];
                next.push(this._hash(left, right));
            }
            layers.push(next);
        }
        return layers;
    }

    root() {
        const layers = this._buildLayers();
        const top = layers[this.levels];
        return top.length > 0 ? top[0] : this.zeros[this.levels];
    }

    /** Merkle path for the leaf at `index`: { root, pathElements, pathIndices }. */
    proof(index) {
        const layers = this._buildLayers();
        const pathElements = [];
        const pathIndices = [];
        let idx = index;
        for (let level = 0; level < this.levels; level++) {
            const position = idx % 2; // 0 = we are the left child, 1 = right
            const siblingIndex = position === 0 ? idx + 1 : idx - 1;
            const layer = layers[level];
            const sibling =
                siblingIndex < layer.length ? layer[siblingIndex] : this.zeros[level];
            pathIndices.push(position);
            pathElements.push(sibling);
            idx = Math.floor(idx / 2);
        }
        return {
            root: layers[this.levels][0],
            pathElements,
            pathIndices,
        };
    }
}

/** Generate a note: random nullifier+secret with commitment and nullifierHash. */
async function generateNote() {
    const poseidon = await getPoseidon();
    const F = poseidon.F;
    const nullifier = randomFieldElement();
    const secret = randomFieldElement();
    const commitment = F.toObject(poseidon([nullifier, secret]));
    const nullifierHash = F.toObject(poseidon([nullifier]));
    return { nullifier, secret, commitment, nullifierHash };
}

/** Build a withdraw proof + Solidity calldata. */
async function generateWithdrawProof({ note, merkleProof, recipient, relayer, fee }) {
    const input = {
        root: merkleProof.root.toString(),
        nullifierHash: note.nullifierHash.toString(),
        recipient: BigInt(recipient).toString(),
        relayer: BigInt(relayer).toString(),
        fee: BigInt(fee).toString(),
        nullifier: note.nullifier.toString(),
        secret: note.secret.toString(),
        pathElements: merkleProof.pathElements.map((e) => e.toString()),
        pathIndices: merkleProof.pathIndices.map((i) => i.toString()),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        WASM_PATH,
        ZKEY_PATH
    );

    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata
        .replace(/["[\]\s]/g, '')
        .split(',')
        .map((x) => BigInt(x).toString());

    const solidity = {
        a: [argv[0], argv[1]],
        b: [
            [argv[2], argv[3]],
            [argv[4], argv[5]],
        ],
        c: [argv[6], argv[7]],
        input: argv.slice(8, 13), // [root, nullifierHash, recipient, relayer, fee]
    };

    return { proof, publicSignals, solidity };
}

module.exports = {
    FIELD_SIZE,
    ZERO_VALUE,
    getPoseidon,
    randomFieldElement,
    MerkleTree,
    generateNote,
    generateWithdrawProof,
};
