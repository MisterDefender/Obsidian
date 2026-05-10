import { DEFAULT_LEVELS, ZERO_VALUE } from './constants.js';
import { getPoseidon, type Poseidon } from './poseidon.js';

export interface MerkleProof {
    root: bigint;
    pathElements: bigint[];
    pathIndices: number[];
}

/**
 * Fixed-depth Poseidon Merkle tree, identical in behaviour to
 * MerkleTreeWithHistory.sol (same ZERO_VALUE and hashing), so roots and paths
 * computed here verify on-chain.
 */
export class MerkleTree {
    readonly levels: number;
    readonly zeros: bigint[] = [];
    private readonly poseidon: Poseidon;
    private readonly leaves: bigint[] = [];

    constructor(levels: number, poseidon: Poseidon) {
        this.levels = levels;
        this.poseidon = poseidon;
        let current = ZERO_VALUE;
        for (let i = 0; i <= levels; i++) {
            this.zeros.push(current);
            current = this.hash(current, current);
        }
    }

    private hash(left: bigint, right: bigint): bigint {
        return this.poseidon.F.toObject(this.poseidon([left, right]));
    }

    get size(): number {
        return this.leaves.length;
    }

    insert(leaf: bigint): number {
        this.leaves.push(leaf);
        return this.leaves.length - 1;
    }

    indexOf(leaf: bigint): number {
        return this.leaves.findIndex((l) => l === leaf);
    }

    private buildLayers(): bigint[][] {
        const layers: bigint[][] = [this.leaves.slice()];
        for (let level = 0; level < this.levels; level++) {
            const current = layers[level];
            const next: bigint[] = [];
            for (let i = 0; i < current.length; i += 2) {
                const left = current[i];
                const right = i + 1 < current.length ? current[i + 1] : this.zeros[level];
                next.push(this.hash(left, right));
            }
            layers.push(next);
        }
        return layers;
    }

    root(): bigint {
        const layers = this.buildLayers();
        const top = layers[this.levels];
        return top.length > 0 ? top[0] : this.zeros[this.levels];
    }

    proof(index: number): MerkleProof {
        if (index < 0 || index >= this.leaves.length) {
            throw new Error(`leaf index ${index} out of range`);
        }
        const layers = this.buildLayers();
        const pathElements: bigint[] = [];
        const pathIndices: number[] = [];
        let idx = index;
        for (let level = 0; level < this.levels; level++) {
            const position = idx % 2; // 0 = left child, 1 = right child
            const siblingIndex = position === 0 ? idx + 1 : idx - 1;
            const layer = layers[level];
            const sibling =
                siblingIndex < layer.length ? layer[siblingIndex] : this.zeros[level];
            pathIndices.push(position);
            pathElements.push(sibling);
            idx = Math.floor(idx / 2);
        }
        return { root: this.root(), pathElements, pathIndices };
    }
}

/** Build an empty tree with a ready Poseidon instance. */
export async function createMerkleTree(levels: number = DEFAULT_LEVELS): Promise<MerkleTree> {
    return new MerkleTree(levels, await getPoseidon());
}
