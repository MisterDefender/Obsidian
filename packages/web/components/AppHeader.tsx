'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function AppHeader() {
    return (
        <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10">
            <Link
                href="/"
                className="font-display text-sm font-bold tracking-[0.35em] text-bone transition-opacity hover:opacity-80"
            >
                OBSIDIAN
            </Link>
            <ConnectButton
                accountStatus="address"
                chainStatus="icon"
                showBalance={false}
            />
        </header>
    );
}
