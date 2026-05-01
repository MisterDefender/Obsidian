import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { randomBytes } from "crypto";

let poseidon;

// Initialize Poseidon hash function
async function initPoseidon() {
    if (!poseidon) {
        poseidon = await buildPoseidon();
    }
    return poseidon;
}

// Generate random value
function randomBigInt() {
    return BigInt("0x" + randomBytes(31).toString("hex"));
}

// Hash using Poseidon
async function poseidonHash(inputs) {
    const p = await initPoseidon();
    const hash = p(inputs);
    return p.F.toString(hash);
}

// Create a note (secret + nullifier)
async function createNote() {
    const secret = randomBigInt();
    const nullifier = randomBigInt();
    
    // Calculate commitment
    const commitment = await poseidonHash([secret, nullifier]);
    
    return {
        secret: secret.toString(),
        nullifier: nullifier.toString(),
        commitment
    };
}

// Calculate nullifier hash
async function getNullifierHash(nullifier) {
    return await poseidonHash([BigInt(nullifier)]);
}

// Generate withdrawal proof
async function generateProof(note, recipient, commitment) {
    const input = {
        secret: note.secret,
        nullifier: note.nullifier,
        recipient: BigInt(recipient),
        commitmentHash: commitment
    };
    
    console.log("Generating proof with inputs:", input);
    
    const { proof, publicSignals } = await groth16.fullProve(
        input,
        "outputs/withdraw_js/withdraw.wasm",
        "withdraw-final_0001.zkey"
    );
    
    return { proof, publicSignals };
}

// Convert proof to Solidity format
async function exportCallData(proof, publicSignals) {
    const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
    
    return {
        a: [argv[0], argv[1]],
        b: [[argv[2], argv[3]], [argv[4], argv[5]]],
        c: [argv[6], argv[7]],
        input: [argv[8], argv[9]]
    };
}

export {
    createNote,
    getNullifierHash,
    generateProof,
    exportCallData,
    poseidonHash
};