import { ZeroAddress } from 'ethers';
import { groth16 } from 'snarkjs';
import type { Note } from './note.js';
import type { MerkleProof } from './merkleTree.js';

/** A circuit artifact: a filesystem path (Node) or raw bytes / URL (browser). */
export type Artifact = string | Uint8Array;

export interface ProofArtifacts {
    wasm: Artifact;
    zkey: Artifact;
}

export interface WithdrawInputs {
    note: Note;
    merkleProof: MerkleProof;
    recipient: string;
    relayer?: string;
    fee?: bigint;
}

/** Proof formatted for `ObsidianVault.withdraw`. */
export interface SolidityWithdrawProof {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    // public signals, ordered as the circuit declares: [root, nullifierHash, recipient, relayer, fee]
    publicSignals: [string, string, string, string, string];
}

export interface WithdrawProof {
    proof: unknown;
    publicSignals: string[];
    solidity: SolidityWithdrawProof;
}

/**
 * Generate a withdraw proof. Public inputs are ordered to match both the circuit
 * and `ObsidianVault.withdraw`: [root, nullifierHash, recipient, relayer, fee].
 */
export async function generateWithdrawProof(
    inputs: WithdrawInputs,
    artifacts: ProofArtifacts
): Promise<WithdrawProof> {
    const relayer = inputs.relayer ?? ZeroAddress;
    const fee = inputs.fee ?? 0n;

    const circuitInput = {
        root: inputs.merkleProof.root.toString(),
        nullifierHash: inputs.note.nullifierHash.toString(),
        recipient: BigInt(inputs.recipient).toString(),
        relayer: BigInt(relayer).toString(),
        fee: fee.toString(),
        nullifier: inputs.note.nullifier.toString(),
        secret: inputs.note.secret.toString(),
        pathElements: inputs.merkleProof.pathElements.map((e) => e.toString()),
        pathIndices: inputs.merkleProof.pathIndices.map((i) => i.toString()),
    };

    const { proof, publicSignals } = await groth16.fullProve(
        circuitInput,
        artifacts.wasm,
        artifacts.zkey
    );

    const calldata: string = await groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata
        .replace(/["[\]\s]/g, '')
        .split(',')
        .map((x: string) => BigInt(x).toString());

    return {
        proof,
        publicSignals,
        solidity: {
            a: [argv[0], argv[1]],
            b: [
                [argv[2], argv[3]],
                [argv[4], argv[5]],
            ],
            c: [argv[6], argv[7]],
            publicSignals: [argv[8], argv[9], argv[10], argv[11], argv[12]],
        },
    };
}

/** Verify a proof off-chain against a verification key (e.g. for tests / sanity checks). */
export async function verifyWithdrawProof(
    verificationKey: unknown,
    publicSignals: string[],
    proof: unknown
): Promise<boolean> {
    return groth16.verify(verificationKey, publicSignals, proof);
}
