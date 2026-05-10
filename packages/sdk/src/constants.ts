import { keccak256, toUtf8Bytes } from 'ethers';

/** BN254 scalar field. Every signal / tree node must be a valid field element. */
export const FIELD_SIZE =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Default Merkle tree depth — must match the deployed circuit (`Withdraw(20)`). */
export const DEFAULT_LEVELS = 20;

/**
 * Empty-leaf value, identical to MerkleTreeWithHistory.sol:
 *   keccak256(abi.encodePacked("obsidian")) % FIELD_SIZE
 */
export const ZERO_VALUE = BigInt(keccak256(toUtf8Bytes('obsidian'))) % FIELD_SIZE;
