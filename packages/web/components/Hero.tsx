'use client';

import dynamic from 'next/dynamic';
import { motion } from 'motion/react';

// three.js can't render on the server — load the scene client-only.
const CrystalScene = dynamic(() => import('./three/CrystalScene'), {
    ssr: false,
    loading: () => <div className="absolute inset-0" aria-hidden />,
});

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: 0.15 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
    }),
};

export function Hero() {
    return (
        <section className="relative flex min-h-dvh w-full flex-col overflow-hidden">
            {/* 3D centerpiece */}
            <div className="pointer-events-none absolute inset-0 z-0">
                <CrystalScene />
            </div>

            {/* top bar */}
            <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
                <span className="font-display text-sm font-bold tracking-[0.35em] text-bone">
                    OBSIDIAN
                </span>
                <span className="glass rounded-full px-3 py-1 font-mono text-[11px] tracking-wide text-smoke">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ember align-middle" />
                    testnet · research preview
                </span>
            </header>

            {/* hero copy */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
                <motion.p
                    custom={0}
                    initial="hidden"
                    animate="show"
                    variants={fadeUp}
                    className="mb-5 font-mono text-xs uppercase tracking-[0.4em] text-ember"
                >
                    zero-knowledge shielded vault
                </motion.p>

                <motion.h1
                    custom={1}
                    initial="hidden"
                    animate="show"
                    variants={fadeUp}
                    className="max-w-4xl font-display text-5xl font-bold leading-[0.98] tracking-tight text-bone md:text-7xl"
                >
                    Move value
                    <br />
                    <span className="bg-gradient-to-r from-ember to-ember-glow bg-clip-text text-transparent">
                        without a trace
                    </span>
                </motion.h1>

                <motion.p
                    custom={2}
                    initial="hidden"
                    animate="show"
                    variants={fadeUp}
                    className="mt-6 max-w-xl text-balance text-base leading-relaxed text-smoke md:text-lg"
                >
                    Deposit into the pool, then withdraw to a fresh address with no on-chain link
                    between the two — proven with a zk-SNARK.
                </motion.p>

                <motion.div
                    custom={3}
                    initial="hidden"
                    animate="show"
                    variants={fadeUp}
                    className="mt-10 flex items-center gap-4"
                >
                    <button className="pointer-events-auto rounded-full bg-gradient-to-r from-ember to-ember-glow px-7 py-3 font-display text-sm font-semibold text-void shadow-[0_0_40px_-8px_var(--color-ember)] transition-transform hover:scale-[1.03] active:scale-95">
                        Enter the vault
                    </button>
                    <a
                        href="#how"
                        className="pointer-events-auto rounded-full border border-ash px-7 py-3 font-display text-sm font-medium text-bone/90 transition-colors hover:border-ember/50 hover:text-bone"
                    >
                        How it works
                    </a>
                </motion.div>
            </div>

            {/* scroll hint */}
            <div className="relative z-10 pb-8 text-center font-mono text-[11px] tracking-widest text-smoke/60">
                SCROLL TO EXPLORE
            </div>
        </section>
    );
}
