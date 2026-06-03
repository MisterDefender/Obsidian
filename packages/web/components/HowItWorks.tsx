'use client';

import { motion } from 'motion/react';

const STEPS = [
    {
        n: '01',
        title: 'Deposit',
        body: 'Your browser generates a secret note and locks a fixed 100 USDC under its commitment. The note never touches the chain — only its Poseidon hash does.',
    },
    {
        n: '02',
        title: 'Blend',
        body: 'Your commitment becomes one leaf in a Merkle tree alongside everyone else’s. The more deposits in the pool, the larger the crowd you disappear into.',
    },
    {
        n: '03',
        title: 'Withdraw',
        body: 'Later, prove in zero knowledge that you own some note in the tree — without revealing which — and release the funds to any fresh address.',
    },
];

const SEES = ['A deposit happened', 'A withdrawal happened', 'The fixed amount (100 USDC)', 'The recipient address'];
const HIDDEN = [
    'Which deposit funded which withdrawal',
    'Your secret note',
    'Any link between sender and recipient',
];

const TECH = ['Poseidon hash', 'Merkle tree · depth 20', 'Groth16 zk-SNARK', 'On-chain verifier'];

const reveal = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
    }),
};

export function HowItWorks() {
    return (
        <section id="how" className="relative scroll-mt-16 px-6 py-28 md:px-10">
            <div className="mx-auto w-full max-w-5xl">
                {/* header */}
                <motion.p
                    variants={reveal}
                    custom={0}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-80px' }}
                    className="font-mono text-xs uppercase tracking-[0.4em] text-ember"
                >
                    how it works
                </motion.p>
                <motion.h2
                    variants={reveal}
                    custom={1}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-80px' }}
                    className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight text-bone md:text-5xl"
                >
                    Privacy by{' '}
                    <span className="bg-gradient-to-r from-ember to-ember-glow bg-clip-text text-transparent">
                        construction
                    </span>
                </motion.h2>
                <motion.p
                    variants={reveal}
                    custom={2}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-80px' }}
                    className="mt-5 max-w-xl text-base leading-relaxed text-smoke"
                >
                    No mixer trust, no custodian. The link between your deposit and your withdrawal is
                    severed by mathematics — a zero-knowledge proof.
                </motion.p>

                {/* steps */}
                <div className="mt-16 grid gap-5 md:grid-cols-3">
                    {STEPS.map((step, i) => (
                        <motion.div
                            key={step.n}
                            variants={reveal}
                            custom={i}
                            initial="hidden"
                            whileInView="show"
                            viewport={{ once: true, margin: '-60px' }}
                            className="glass relative flex flex-col rounded-2xl p-6"
                        >
                            <span className="font-mono text-sm font-semibold text-ember">
                                {step.n}
                            </span>
                            <h3 className="mt-4 font-display text-xl font-semibold text-bone">
                                {step.title}
                            </h3>
                            <p className="mt-3 text-sm leading-relaxed text-smoke">{step.body}</p>
                            {i < STEPS.length - 1 && (
                                <span className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-ember/40 md:block">
                                    →
                                </span>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* what's visible vs hidden */}
                <motion.div
                    variants={reveal}
                    custom={0}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    className="mt-6 grid gap-5 md:grid-cols-2"
                >
                    <div className="rounded-2xl border border-ash/50 p-6">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-smoke">
                            What the chain sees
                        </p>
                        <ul className="mt-4 space-y-2.5">
                            {SEES.map((item) => (
                                <li key={item} className="flex items-center gap-3 text-sm text-bone/80">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-smoke" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-ember/30 bg-ember/[0.03] p-6">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-ember">
                            What it never learns
                        </p>
                        <ul className="mt-4 space-y-2.5">
                            {HIDDEN.map((item) => (
                                <li key={item} className="flex items-center gap-3 text-sm text-bone">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember shadow-[0_0_10px_1px_var(--color-ember)]" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </motion.div>

                {/* tech credibility */}
                <motion.div
                    variants={reveal}
                    custom={1}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    className="mt-10 flex flex-wrap items-center gap-2.5"
                >
                    {TECH.map((t) => (
                        <span
                            key={t}
                            className="rounded-full border border-ash/60 px-3.5 py-1.5 font-mono text-[11px] text-smoke"
                        >
                            {t}
                        </span>
                    ))}
                </motion.div>

                {/* CTA */}
                <motion.div
                    variants={reveal}
                    custom={2}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-60px' }}
                    className="mt-16 flex flex-col items-start gap-4 rounded-3xl border border-ember/20 bg-gradient-to-br from-ember/[0.06] to-transparent p-8 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div>
                        <h3 className="font-display text-2xl font-bold text-bone">
                            Try it on testnet
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-smoke">
                            Grab some test USDC, make a private deposit, and withdraw it anywhere. No
                            real funds, no risk.
                        </p>
                    </div>
                    <a
                        href="/vault"
                        className="shrink-0 rounded-full bg-gradient-to-r from-ember to-ember-glow px-7 py-3 font-display text-sm font-semibold text-void shadow-[0_0_40px_-8px_var(--color-ember)] transition-transform hover:scale-[1.03] active:scale-95"
                    >
                        Enter the vault
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
