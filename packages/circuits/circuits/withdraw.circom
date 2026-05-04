pragma circom 2.0.0;

// Poseidon is ZK-friendly and matches the on-chain hasher generated from circomlib.
// Resolved via the `-l <repo>/node_modules` include path passed by the build script.
include "circomlib/circuits/poseidon.circom";

/*
 * Obsidian withdraw circuit.
 *
 * Proves, in zero knowledge:
 *   "I know a (nullifier, secret) whose commitment = Poseidon(nullifier, secret)
 *    is a leaf in the Merkle tree with the given public `root` — without revealing
 *    the commitment, the secret, or which leaf it is."
 *
 * Public inputs : root, nullifierHash, recipient, relayer, fee
 * Private inputs: nullifier, secret, pathElements[levels], pathIndices[levels]
 */

// Hash a pair of nodes: Poseidon(left, right). Must match the on-chain hasher.
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// Given two inputs and a selector bit `s`, output them in order:
//   s = 0 -> [in[0], in[1]]   (our node is the left child)
//   s = 1 -> [in[1], in[0]]   (our node is the right child)
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;                        // constrain s to a bit
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Verify a Merkle proof: folding `leaf` up `levels` using path elements/indices
// must reproduce `root`.
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    root === hashers[levels - 1].hash;
}

template Withdraw(levels) {
    // public
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;

    // private
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // commitment = Poseidon(nullifier, secret)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;

    // nullifierHash = Poseidon(nullifier), constrained to the public input
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.out === nullifierHash;

    // Merkle inclusion of the commitment under the public root
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitmentHasher.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    /*
     * Bind recipient, relayer, and fee into the proof.
     *
     * Groth16 does not constrain public inputs that don't appear in any constraint,
     * which would let a relayer rewrite them after the fact. Squaring each forces
     * them into the constraint system so the proof is invalid if any is changed.
     */
    signal recipientSquare;
    signal relayerSquare;
    signal feeSquare;
    recipientSquare <== recipient * recipient;
    relayerSquare <== relayer * relayer;
    feeSquare <== fee * fee;
}

component main {public [root, nullifierHash, recipient, relayer, fee]} = Withdraw(20);
