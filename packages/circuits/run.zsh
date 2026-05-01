# Compile the circuit
circom circuits/withdraw.circom  --r1cs --wasm --sym --c -o outputs

# Phase-I
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

#Phase-II
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
# we generate a .zkey file that will contain the proving and verification keys together with all phase 2 contributions.
snarkjs groth16 setup outputs/withdraw.r1cs  pot12_final.ptau withdraw_0000.zkey

# Contribute to the phase 2 of the ceremony:
snarkjs zkey contribute withdraw_0000.zkey withdraw-final_0001.zkey --name="1st Contributor withdraw" -v

# Export the verification key:
snarkjs zkey export verificationkey withdraw-final_0001.zkey verification_key.json

# Generate Solidity verifier
snarkjs zkey export solidityverifier withdraw-final_0001.zkey contracts/Verifier.sol