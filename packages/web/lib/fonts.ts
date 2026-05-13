import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';

export const displayFont = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-display',
    display: 'swap',
});

export const monoFont = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
    display: 'swap',
});
