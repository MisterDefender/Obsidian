import { sepolia, arbitrumSepolia, baseSepolia, hardhat } from 'wagmi/chains';

/** The testnets Obsidian targets, plus local hardhat for development. */
export const SUPPORTED_CHAINS = [sepolia, arbitrumSepolia, baseSepolia, hardhat] as const;

export interface ObsidianDeployment {
    vault: `0x${string}`;
    usdc: `0x${string}`;
    /** Fixed deposit/withdraw amount (token base units). */
    denomination: bigint;
    /** Merkle tree depth — must match the circuit. */
    levels: number;
    /** Block the vault was deployed at (event-scan start). */
    deploymentBlock: bigint;
}

const DENOMINATION = 100n * 10n ** 6n; // 100 USDC (6 decimals)

/**
 * Deployed addresses per chain. Populated after Phase 7 (testnet deploy) and by
 * the local hardhat-deploy run. A missing entry => "not available on this chain"
 * in the UI. Override via NEXT_PUBLIC_VAULT_<chainId> / NEXT_PUBLIC_USDC_<chainId>.
 */
export const DEPLOYMENTS: Partial<Record<number, ObsidianDeployment>> = {
    // [sepolia.id]:        { vault: '0x…', usdc: '0x…', denomination: DENOMINATION, levels: 20, deploymentBlock: 0n },
    // [arbitrumSepolia.id]:{ vault: '0x…', usdc: '0x…', denomination: DENOMINATION, levels: 20, deploymentBlock: 0n },
    // [baseSepolia.id]:    { vault: '0x…', usdc: '0x…', denomination: DENOMINATION, levels: 20, deploymentBlock: 0n },
};

function fromEnv(chainId: number): ObsidianDeployment | undefined {
    const vault = process.env[`NEXT_PUBLIC_VAULT_${chainId}`];
    const usdc = process.env[`NEXT_PUBLIC_USDC_${chainId}`];
    if (!vault || !usdc) return undefined;
    return {
        vault: vault as `0x${string}`,
        usdc: usdc as `0x${string}`,
        denomination: DENOMINATION,
        levels: 20,
        deploymentBlock: BigInt(process.env[`NEXT_PUBLIC_BLOCK_${chainId}`] ?? '0'),
    };
}

export function getDeployment(chainId?: number): ObsidianDeployment | undefined {
    if (!chainId) return undefined;
    return fromEnv(chainId) ?? DEPLOYMENTS[chainId];
}

export function chainName(chainId?: number): string {
    return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name ?? 'Unsupported network';
}
