import { randomBytes, hexlify, toBeHex } from 'ethers';
import { poseidonHash } from './poseidon.js';

/**
 * A deposit note. `nullifier` and `secret` are the only secrets; `commitment`
 * (the tree leaf) and `nullifierHash` (the double-spend tag) are derived.
 */
export interface Note {
    nullifier: bigint;
    secret: bigint;
    commitment: bigint;
    nullifierHash: bigint;
}

const NOTE_REGEX = /^obsidian-v1-(\d+)-0x([0-9a-fA-F]{64})([0-9a-fA-F]{64})$/;

/** A 31-byte random value is always < FIELD_SIZE, so it's a valid field element. */
function randomFieldElement(): bigint {
    return BigInt(hexlify(randomBytes(31)));
}

/** Derive a full note from its two secrets. */
export async function noteFromSecrets(nullifier: bigint, secret: bigint): Promise<Note> {
    const commitment = await poseidonHash([nullifier, secret]);
    const nullifierHash = await poseidonHash([nullifier]);
    return { nullifier, secret, commitment, nullifierHash };
}

/** Generate a fresh random note. */
export async function createNote(): Promise<Note> {
    return noteFromSecrets(randomFieldElement(), randomFieldElement());
}

/**
 * Encode a note as a portable string the user must back up:
 *   obsidian-v1-<chainId>-0x<nullifier:32B><secret:32B>
 */
export function encodeNote(note: Note, chainId: number | bigint): string {
    const nullifier = toBeHex(note.nullifier, 32).slice(2);
    const secret = toBeHex(note.secret, 32).slice(2);
    return `obsidian-v1-${chainId}-0x${nullifier}${secret}`;
}

/** Parse a note string back into a full note (recomputes commitment/nullifierHash). */
export async function parseNote(noteString: string): Promise<{ note: Note; chainId: number }> {
    const match = noteString.trim().match(NOTE_REGEX);
    if (!match) {
        throw new Error('invalid Obsidian note string');
    }
    const chainId = Number(match[1]);
    const nullifier = BigInt('0x' + match[2]);
    const secret = BigInt('0x' + match[3]);
    return { note: await noteFromSecrets(nullifier, secret), chainId };
}
