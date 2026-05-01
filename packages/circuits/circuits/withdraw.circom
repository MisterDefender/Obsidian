pragma circom 2.0.0;

// Poseidon is like SHA256 but MUCH more efficient in zero-knowledge proofs
include "../node_modules/circomlib/circuits/poseidon.circom";


/*
This circuit proves:
"I know a SECRET and NULLIFIER that when hashed together 
produce COMMITMENT X, which exists in the smart contract without revealing secret and nullifier is"

Inputs:
- secret (private): Your secret number (like a password)
- nullifier (private): Prevents double-spending (a one time random code)
- recipient (public): Who receives the withdrawal
- commitmentHash (public): The hash that was stored during deposit
*/

template Withdraw() {
    // PRIVATE inputs (only you know these)
    signal input secret;
    signal input nullifier;
    
    // PUBLIC inputs (everyone can see)
    signal input recipient; // Ethereum address of the recipient
    signal input commitmentHash; // identify the deposit being withdrawn in smart contract
    
    // Create the commitment (computation process)
    // Hash the secret and nullifier together
    component commitment = Poseidon(2); // a hash function that takes 2 inputs (BLENDER)
    commitment.inputs[0] <== secret;
    commitment.inputs[1] <== nullifier;

     // secret + nullifier = ingredients

    
    // Now commitment.out contains: hash(secret, nullifier)
    // Check that our hash matches the public commitment
    commitment.out === commitmentHash;
    
    // Create a nullifier hash to prevent double-spending
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    signal output nullifierHash; // This will be public output from the circuit signal
    nullifierHash <== nullifierHasher.out;

    /*
    WHY DO WE NEED NULLIFIER HASH?
    
    Problem: Someone could withdraw the same deposit multiple times!
    
    Solution: The nullifierHash is made public and stored in the contract
    When you try to withdraw:
    1. Contract checks: "Has this nullifierHash been used before?"
    2. If yes: REJECT (already spent)
    3. If no: ACCEPT and mark nullifierHash as used
    
    The nullifier itself stays private, but its hash becomes public
    This way each deposit can only be withdrawn ONCE
    */
}


/*
This line says:
- Create an instance of Withdraw template
- Mark "recipient" and "commitmentHash" as public inputs
- Everything else (secret, nullifier) stays private
- The circuit will output "nullifierHash" publicly
*/
component main {public [recipient, commitmentHash]} = Withdraw();