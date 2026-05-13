import type { Metadata, Viewport } from 'next';
import { displayFont, monoFont } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
    title: 'Obsidian — a zero-knowledge shielded vault',
    description:
        'Deposit, then withdraw to a fresh address with no on-chain link between the two — proven with a zk-SNARK. Research project, testnet only.',
};

export const viewport: Viewport = {
    themeColor: '#0a0a0b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${displayFont.variable} ${monoFont.variable}`}>
            <body className="bg-void-radial min-h-dvh antialiased">{children}</body>
        </html>
    );
}
