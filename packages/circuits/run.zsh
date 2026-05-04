#!/usr/bin/env zsh
# Obsidian circuit build + (dev) trusted setup.
# Run from packages/circuits:  npm run build  (or: zsh run.zsh)
#
# Produces:
#   build/withdraw_js/withdraw.wasm        - witness generator (used by the SDK/tests)
#   build/withdraw_final.zkey              - proving key
#   build/verification_key.json            - verification key
#   ../contracts/contracts/Verifier.sol    - on-chain Groth16 verifier
#
# NOTE: this is a DEV ceremony (single contribution, scripted entropy). The real
# multi-party ceremony is Phase 3. The depth-20 Merkle circuit is ~5k constraints,
# so we need a >=2^13 ptau; we use 2^14 for headroom.
set -e

PTAU_POWER=14
PTAU_FINAL="pot${PTAU_POWER}_final.ptau"
LIB="../../node_modules"     # circomlib lives in the hoisted root node_modules
BUILD="build"

mkdir -p "$BUILD"

echo "==> [1/6] Compiling circuit"
circom circuits/withdraw.circom --r1cs --wasm --sym -l "$LIB" -o "$BUILD"

if [[ ! -f "$PTAU_FINAL" ]]; then
  echo "==> [2/6] Powers of Tau (phase 1) — generating $PTAU_FINAL (2^${PTAU_POWER})"
  snarkjs powersoftau new bn128 "$PTAU_POWER" "pot${PTAU_POWER}_0000.ptau" -v
  snarkjs powersoftau contribute "pot${PTAU_POWER}_0000.ptau" "pot${PTAU_POWER}_0001.ptau" \
    --name="obsidian dev contribution 1" -v -e="$(head -c 64 /dev/urandom | base64)"
  echo "==> [3/6] Preparing phase 2"
  snarkjs powersoftau prepare phase2 "pot${PTAU_POWER}_0001.ptau" "$PTAU_FINAL" -v
else
  echo "==> [2-3/6] Reusing existing $PTAU_FINAL"
fi

echo "==> [4/6] Groth16 setup"
snarkjs groth16 setup "$BUILD/withdraw.r1cs" "$PTAU_FINAL" "$BUILD/withdraw_0000.zkey"

echo "==> [5/6] zkey contribution"
snarkjs zkey contribute "$BUILD/withdraw_0000.zkey" "$BUILD/withdraw_final.zkey" \
  --name="obsidian dev contribution 2" -v -e="$(head -c 64 /dev/urandom | base64)"

echo "==> [6/6] Exporting verification key + Solidity verifier"
snarkjs zkey export verificationkey "$BUILD/withdraw_final.zkey" "$BUILD/verification_key.json"
snarkjs zkey export solidityverifier "$BUILD/withdraw_final.zkey" ../contracts/contracts/Verifier.sol

echo "==> Done. Artifacts in $BUILD/ ; Verifier.sol written to packages/contracts/contracts/"
