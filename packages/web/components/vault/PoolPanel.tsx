'use client';

import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { usePoolStats } from '@/hooks/usePoolStats';
import type { ObsidianDeployment } from '@/lib/contracts';

const CrystalScene = dynamic(() => import('../three/CrystalScene'), {
    ssr: false,
    loading: () => <div className="absolute inset-0" aria-hidden />,
});

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className="flex flex-col">
            <motion.span
                key={value}
                initial={{ opacity: 0.4, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`font-display text-3xl font-bold ${accent ? 'text-ember-glow' : 'text-bone'}`}
            >
                {value}
            </motion.span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-smoke">
                {label}
            </span>
        </div>
    );
}

export function PoolPanel({ deployment }: { deployment: ObsidianDeployment }) {
    const stats = usePoolStats(deployment);

    return (
        <div className="glass relative overflow-hidden rounded-2xl">
            {/* live crystal reacting to the anonymity set */}
            <div className="relative h-56 w-full">
                <div className="absolute inset-0">
                    <CrystalScene shards={stats.anonymitySet} cameraZ={5.4} />
                </div>
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(70% 60% at 50% 50%, transparent 40%, rgba(10,10,11,0.65))',
                    }}
                />
                <div className="absolute left-5 top-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
                        the pool
                    </p>
                    <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-smoke">
                        Every glowing shard is an unspent deposit — the crowd your withdrawal hides
                        in.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-ash/40 px-5 py-4">
                <Stat label="anonymity set" value={stats.anonymitySet} accent />
                <Stat label="deposits" value={stats.deposits} />
                <Stat label="withdrawals" value={stats.withdrawals} />
            </div>
        </div>
    );
}
