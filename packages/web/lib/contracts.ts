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
    [sepolia.id]: {
        vault: '0xA8033Dfd4e028E4D0b1130e4feFcC2C03702160f',
        usdc: '0xe5fe0864e2150D77CC4848fAeE79B05d1974a9B1',
        denomination: DENOMINATION,
        levels: 20,
        deploymentBlock: 10979502n,
    },
    [arbitrumSepolia.id]: {
        vault: '0x1d86Bda759Af4470FAAe1e5a8E4678f30a7BfdB8',
        usdc: '0xcd657a30D302065Ea539E55103Ce94f11b32c175',
        denomination: DENOMINATION,
        levels: 20,
        deploymentBlock: 273353241n,
    },
    [baseSepolia.id]: {
        vault: '0x5b2E3aC7CFAAc2ffa89598Cb6a37d40184fc0BE0',
        usdc: '0x789258402CCDa7fC97B7d24A9615041049C52Cf5',
        denomination: DENOMINATION,
        levels: 20,
        deploymentBlock: 42348924n,
    },
};

// Next inlines only STATIC process.env.NEXT_PUBLIC_* references, so we map them
// explicitly per chain id rather than building the key dynamically.
const ENV_ADDRESSES: Record<number, { vault?: string; usdc?: string; block?: string }> = {
    [sepolia.id]: {
        vault: process.env.NEXT_PUBLIC_VAULT_11155111,
        usdc: process.env.NEXT_PUBLIC_USDC_11155111,
        block: process.env.NEXT_PUBLIC_BLOCK_11155111,
    },
    [arbitrumSepolia.id]: {
        vault: process.env.NEXT_PUBLIC_VAULT_421614,
        usdc: process.env.NEXT_PUBLIC_USDC_421614,
        block: process.env.NEXT_PUBLIC_BLOCK_421614,
    },
    [baseSepolia.id]: {
        vault: process.env.NEXT_PUBLIC_VAULT_84532,
        usdc: process.env.NEXT_PUBLIC_USDC_84532,
        block: process.env.NEXT_PUBLIC_BLOCK_84532,
    },
    [hardhat.id]: {
        vault: process.env.NEXT_PUBLIC_VAULT_31337,
        usdc: process.env.NEXT_PUBLIC_USDC_31337,
        block: process.env.NEXT_PUBLIC_BLOCK_31337,
    },
};

function fromEnv(chainId: number): ObsidianDeployment | undefined {
    const entry = ENV_ADDRESSES[chainId];
    if (!entry?.vault || !entry?.usdc) return undefined;
    return {
        vault: entry.vault as `0x${string}`,
        usdc: entry.usdc as `0x${string}`,
        denomination: DENOMINATION,
        levels: 20,
        deploymentBlock: BigInt(entry.block ?? '0'),
    };
}

export function getDeployment(chainId?: number): ObsidianDeployment | undefined {
    if (!chainId) return undefined;
    return fromEnv(chainId) ?? DEPLOYMENTS[chainId];
}

export function chainName(chainId?: number): string {
    return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name ?? 'Unsupported network';
}
