import { buildPoseidon } from 'circomlibjs';

/**
 * circomlibjs Poseidon instance. Callable as `poseidon(inputs)` and exposes the
 * field helper `poseidon.F`. Lazily built (it loads a wasm module) and cached.
 */
export interface Poseidon {
    (inputs: (bigint | number | string)[]): unknown;
    F: { toObject(value: unknown): bigint };
}

let cached: Poseidon | null = null;

export async function getPoseidon(): Promise<Poseidon> {
    if (!cached) {
        cached = (await buildPoseidon()) as Poseidon;
    }
    return cached;
}

/** Poseidon hash of field elements, returned as a bigint. */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
    const poseidon = await getPoseidon();
    return poseidon.F.toObject(poseidon(inputs));
}
