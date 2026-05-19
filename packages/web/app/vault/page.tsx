'use client';

import { useAccount, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AppHeader } from '@/components/AppHeader';
import { getDeployment, chainName, SUPPORTED_CHAINS } from '@/lib/contracts';

function truncate(addr?: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

export default function VaultPage() {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const deployment = getDeployment(chainId);

    return (
        <main className="relative min-h-dvh">
            <AppHeader />

            <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
                {!isConnected ? (
                    <ConnectPrompt />
                ) : (
                    <div className="grid gap-6">
                        <NetworkCard chainId={chainId} hasDeployment={!!deployment} vault={deployment?.vault} />
                        <div className="grid gap-6 md:grid-cols-2">
                            <ActionPanel
                                title="Deposit"
                                blurb="Lock a fixed amount under a fresh commitment. Your note is the only key to withdraw."
                                disabled={!deployment}
                            />
                            <ActionPanel
                                title="Withdraw"
                                blurb="Prove you own a note in the pool and send it anywhere — no on-chain link to the deposit."
                                disabled={!deployment}
                            />
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

function ConnectPrompt() {
    return (
        <div className="glass mx-auto mt-16 flex max-w-lg flex-col items-center rounded-3xl px-8 py-14 text-center">
            <div className="mb-6 h-12 w-12 rounded-2xl bg-gradient-to-br from-ember to-ember-glow shadow-[0_0_50px_-6px_var(--color-ember)]" />
            <h1 className="font-display text-2xl font-bold text-bone">Enter the vault</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-smoke">
                Connect a wallet on Sepolia, Arbitrum Sepolia, or Base Sepolia to deposit and
                withdraw privately.
            </p>
            <div className="mt-8">
                <ConnectButton />
            </div>
        </div>
    );
}

function NetworkCard({
    chainId,
    hasDeployment,
    vault,
}: {
    chainId: number;
    hasDeployment: boolean;
    vault?: string;
}) {
    const supported = SUPPORTED_CHAINS.some((c) => c.id === chainId);
    return (
        <div className="glass flex flex-col gap-3 rounded-2xl px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-smoke">Network</p>
                <p className="font-display text-lg font-semibold text-bone">{chainName(chainId)}</p>
            </div>
            <div className="text-left sm:text-right">
                {hasDeployment ? (
                    <>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-smoke">
                            Vault
                        </p>
                        <p className="font-mono text-sm text-ember-glow">{truncate(vault)}</p>
                    </>
                ) : (
                    <p className="max-w-xs text-sm text-smoke">
                        {supported
                            ? 'Obsidian is not deployed on this network yet.'
                            : 'Unsupported network — switch to a supported testnet.'}
                    </p>
                )}
            </div>
        </div>
    );
}

function ActionPanel({
    title,
    blurb,
    disabled,
}: {
    title: string;
    blurb: string;
    disabled?: boolean;
}) {
    return (
        <div className="glass flex flex-col rounded-2xl p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-bone">{title}</h2>
                <span className="rounded-full border border-ash px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-smoke">
                    soon
                </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-smoke">{blurb}</p>
            <button
                disabled
                className="mt-6 cursor-not-allowed rounded-xl border border-ash/70 px-5 py-3 font-display text-sm font-medium text-smoke/70"
            >
                {disabled ? 'Unavailable on this network' : 'Coming next'}
            </button>
        </div>
    );
}
