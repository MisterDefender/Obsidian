import { parseAbi } from 'viem';

/**
 * ObsidianVault ABI (kept in sync with @obsidian/sdk's OBSIDIAN_VAULT_ABI).
 * Inlined here rather than imported from the SDK so the heavy SDK barrel
 * (snarkjs / circomlibjs) stays out of the static bundle — it's only ever
 * pulled in lazily via `loadSdk()`.
 */
export const vaultAbi = parseAbi([
    'event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp)',
    'function deposit(uint256 commitment)',
    'function withdraw(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 nullifierHash, address recipient, address relayer, uint256 fee)',
    'function isKnownRoot(uint256 root) view returns (bool)',
    'function getLastRoot() view returns (uint256)',
    'function nextIndex() view returns (uint32)',
    'function isSpent(uint256 nullifierHash) view returns (bool)',
    'function denomination() view returns (uint256)',
]);

// ERC-20 reads/writes use viem's built-in `erc20Abi`.
