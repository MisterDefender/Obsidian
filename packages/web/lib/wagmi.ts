import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, arbitrumSepolia, baseSepolia, hardhat } from 'wagmi/chains';

/**
 * wagmi + RainbowKit config. WalletConnect needs a project id
 * (https://cloud.reown.com); injected wallets work without one. Set
 * NEXT_PUBLIC_WC_PROJECT_ID in .env.local for full WalletConnect support.
 */
export const wagmiConfig = getDefaultConfig({
    appName: 'Obsidian',
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'obsidian-dev-placeholder',
    chains: [sepolia, arbitrumSepolia, baseSepolia, hardhat],
    ssr: true,
});
