'use client';

import Link from 'next/link';
import { CustomConnectButton } from './CustomConnectButton';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { isDevMock } from '@/lib/wagmi';

function truncate(addr?: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

function DevConnect() {
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();

    if (isConnected) {
        return (
            <button
                onClick={() => disconnect()}
                className="glass rounded-full px-4 py-2 font-mono text-xs text-bone"
            >
                {truncate(address)} · dev
            </button>
        );
    }
    return (
        <button
            onClick={() => connect({ connector: connectors[0] })}
            className="rounded-full bg-gradient-to-r from-ember to-ember-glow px-4 py-2 font-display text-xs font-semibold text-void"
        >
            Connect (dev)
        </button>
    );
}

export function AppHeader() {
    return (
        <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10">
            <Link
                href="/"
                className="font-display text-sm font-bold tracking-[0.35em] text-bone transition-opacity hover:opacity-80"
            >
                OBSIDIAN
            </Link>
            {isDevMock ? (
                <DevConnect />
            ) : (
                <CustomConnectButton />
            )}
        </header>
    );
}
