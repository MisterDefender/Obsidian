import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { mock } from 'wagmi/connectors';
import { sepolia, arbitrumSepolia, baseSepolia, hardhat } from 'wagmi/chains';

/**
 * In dev-mock mode the app connects to a local hardhat node using one of its
 * unlocked accounts — no browser wallet needed (the node signs). Enable with
 * NEXT_PUBLIC_DEV_MOCK=true. Otherwise we use the normal RainbowKit config.
 */
export const isDevMock = process.env.NEXT_PUBLIC_DEV_MOCK === 'true';

// hardhat account #0 (deployer / USDC holder)
const MOCK_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;

export const wagmiConfig = isDevMock
    ? createConfig({
          chains: [hardhat],
          connectors: [mock({ accounts: [MOCK_ACCOUNT] })],
          transports: { [hardhat.id]: http('http://127.0.0.1:8545') },
          ssr: true,
      })
    : getDefaultConfig({
          appName: 'Obsidian',
          projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'obsidian-dev-placeholder',
          chains: [sepolia, arbitrumSepolia, baseSepolia, hardhat],
          ssr: true,
      });
