import { parseAbi } from 'viem';
import { sepolia, arbitrumSepolia, baseSepolia, hardhat } from 'wagmi/chains';

/** The testnets Obsidian targets, plus local hardhat for development. */
export const SUPPORTED_CHAINS = [sepolia, arbitrumSepolia, baseSepolia, hardhat] as const;

/**
 * ObsidianVault ABI — the single source of truth for the whole web app.
 * Kept in sync with the SDK's OBSIDIAN_VAULT_ABI and the relayer's sol! bindings.
 * Inlined here (not imported from @obsidian/sdk) so the heavy SDK barrel
 * (snarkjs/circomlibjs) stays out of the static bundle.
 */
export const vaultAbi = parseAbi([
    'event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp)',
    'event Withdrawal(address indexed recipient, uint256 nullifierHash, address indexed relayer, uint256 fee)',
    'function deposit(uint256 commitment)',
    'function withdraw(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256 root, uint256 nullifierHash, address recipient, address relayer, uint256 fee)',
    'function isKnownRoot(uint256 root) view returns (bool)',
    'function getLastRoot() view returns (uint256)',
    'function nextIndex() view returns (uint32)',
    'function isSpent(uint256 nullifierHash) view returns (bool)',
    'function commitments(uint256 commitment) view returns (bool)',
    'function denomination() view returns (uint256)',
]);

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
const LEVELS = 20;

/**
 * Deployed addresses per chain — the single source of truth. To point the app at
 * a new deployment, edit this map and commit; no env vars required anywhere.
 *
 * The hardhat entry uses hardhat-deploy's deterministic local addresses (USDC →
 * Poseidon → Verifier → ObsidianVault deploy order on a fresh node).
 */
export const DEPLOYMENTS: Partial<Record<number, ObsidianDeployment>> = {
    [sepolia.id]: {
        vault: '0xA8033Dfd4e028E4D0b1130e4feFcC2C03702160f',
        usdc: '0xe5fe0864e2150D77CC4848fAeE79B05d1974a9B1',
        denomination: DENOMINATION,
        levels: LEVELS,
        deploymentBlock: 10979502n,
    },
    [arbitrumSepolia.id]: {
        vault: '0x1d86Bda759Af4470FAAe1e5a8E4678f30a7BfdB8',
        usdc: '0xcd657a30D302065Ea539E55103Ce94f11b32c175',
        denomination: DENOMINATION,
        levels: LEVELS,
        deploymentBlock: 273353241n,
    },
    [baseSepolia.id]: {
        vault: '0x5b2E3aC7CFAAc2ffa89598Cb6a37d40184fc0BE0',
        usdc: '0x789258402CCDa7fC97B7d24A9615041049C52Cf5',
        denomination: DENOMINATION,
        levels: LEVELS,
        deploymentBlock: 42348924n,
    },
    [hardhat.id]: {
        vault: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        usdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        denomination: DENOMINATION,
        levels: LEVELS,
        deploymentBlock: 0n,
    },
};

export function getDeployment(chainId?: number): ObsidianDeployment | undefined {
    if (!chainId) return undefined;
    return DEPLOYMENTS[chainId];
}

export function chainName(chainId?: number): string {
    return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name ?? 'Unsupported network';
}
