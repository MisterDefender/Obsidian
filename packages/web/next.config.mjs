/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // @obsidian/sdk is shipped as TS/ESM and consumed directly in the monorepo.
    transpilePackages: ['@obsidian/sdk'],
};

export default nextConfig;
