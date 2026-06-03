/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // @obsidian/sdk is shipped as TS/ESM and consumed directly in the monorepo.
    transpilePackages: ['@obsidian/sdk'],
    webpack: (config) => {
        // Suppress harmless build warnings from optional dependencies in Wagmi / MetaMask SDK
        config.resolve.fallback = {
            ...config.resolve.fallback,
            '@react-native-async-storage/async-storage': false,
            'pino-pretty': false,
            'lokijs': false,
        };
        return config;
    },
};

export default nextConfig;
