import { Contract, type ContractRunner } from 'ethers';
import { DEFAULT_LEVELS } from './constants.js';
import { createMerkleTree, MerkleTree } from './merkleTree.js';
import type { Note } from './note.js';
import {
    generateWithdrawProof,
    type ProofArtifacts,
    type SolidityWithdrawProof,
} from './prover.js';

/** Minimal ABI the SDK needs from ObsidianVault. */
export const OBSIDIAN_VAULT_ABI = [
    'event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp)',
    'function deposit(uint256 commitment)',
    'function withdraw(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 nullifierHash, address recipient, address relayer, uint256 fee)',
    'function isKnownRoot(uint256 root) view returns (bool)',
    'function getLastRoot() view returns (uint256)',
    'function nextIndex() view returns (uint32)',
    'function isSpent(uint256 nullifierHash) view returns (bool)',
    'function denomination() view returns (uint256)',
] as const;

export interface PrepareWithdrawOptions {
    recipient: string;
    artifacts: ProofArtifacts;
    relayer?: string;
    fee?: bigint;
    fromBlock?: number;
}

/** A withdraw call ready to submit (or hand to a relayer). */
export interface PreparedWithdraw extends SolidityWithdrawProof {
    root: string;
    nullifierHash: string;
    recipient: string;
    relayer: string;
    fee: string;
}

/**
 * High-level client for an ObsidianVault: scans deposit events to rebuild the
 * Merkle tree client-side, then assembles withdraw proofs.
 */
export class ObsidianPool {
    readonly vault: Contract;
    readonly levels: number;

    constructor(vault: Contract, levels: number = DEFAULT_LEVELS) {
        this.vault = vault;
        this.levels = levels;
    }

    static connect(
        address: string,
        runner: ContractRunner,
        levels: number = DEFAULT_LEVELS
    ): ObsidianPool {
        return new ObsidianPool(new Contract(address, OBSIDIAN_VAULT_ABI, runner), levels);
    }

    /** All commitments in deposit order (ascending leaf index). */
    async fetchCommitments(fromBlock = 0): Promise<bigint[]> {
        const events = await this.vault.queryFilter(this.vault.filters.Deposit(), fromBlock);
        return events
            .map((e) => {
                const args = (e as unknown as { args: { commitment: bigint; leafIndex: bigint } })
                    .args;
                return { index: Number(args.leafIndex), commitment: BigInt(args.commitment) };
            })
            .sort((a, b) => a.index - b.index)
            .map((x) => x.commitment);
    }

    /** Rebuild the Merkle tree from on-chain deposit events. */
    async buildTree(fromBlock = 0): Promise<MerkleTree> {
        const tree = await createMerkleTree(this.levels);
        for (const commitment of await this.fetchCommitments(fromBlock)) {
            tree.insert(commitment);
        }
        return tree;
    }

    /**
     * Assemble a withdraw for `note`. Rebuilds the tree, finds the note's leaf,
     * and produces a proof + the parameters `withdraw()` expects.
     */
    async prepareWithdraw(note: Note, options: PrepareWithdrawOptions): Promise<PreparedWithdraw> {
        const tree = await this.buildTree(options.fromBlock ?? 0);
        const index = tree.indexOf(note.commitment);
        if (index < 0) {
            throw new Error('commitment not found in pool (deposit not yet indexed?)');
        }

        const merkleProof = tree.proof(index);
        const relayer = options.relayer ?? '0x0000000000000000000000000000000000000000';
        const fee = options.fee ?? 0n;

        const { solidity } = await generateWithdrawProof(
            { note, merkleProof, recipient: options.recipient, relayer, fee },
            options.artifacts
        );

        return {
            ...solidity,
            root: merkleProof.root.toString(),
            nullifierHash: note.nullifierHash.toString(),
            recipient: options.recipient,
            relayer,
            fee: fee.toString(),
        };
    }
}
