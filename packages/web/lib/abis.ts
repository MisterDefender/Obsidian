import { parseAbi } from 'viem';
import { OBSIDIAN_VAULT_ABI } from '@obsidian/sdk';

/** Parsed (JSON) ABI for ObsidianVault, derived from the SDK's human-readable ABI. */
export const vaultAbi = parseAbi([...OBSIDIAN_VAULT_ABI]);

// ERC-20 reads/writes use viem's built-in `erc20Abi`.
