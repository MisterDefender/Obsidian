'use client';

import { useState } from 'react';
import { erc20Abi, formatUnits } from 'viem';
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { motion } from 'motion/react';
import { createNote, encodeNote } from '@obsidian/sdk';
import { vaultAbi } from '@/lib/abis';
import type { ObsidianDeployment } from '@/lib/contracts';

type Step = 'idle' | 'working' | 'save' | 'error';

export function DepositPanel({ deployment }: { deployment: ObsidianDeployment }) {
    const { address } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const [step, setStep] = useState<Step>('idle');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [noteString, setNoteString] = useState('');
    const [savedConfirmed, setSavedConfirmed] = useState(false);

    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: deployment.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: deployment.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: address ? [address, deployment.vault] : undefined,
        query: { enabled: !!address },
    });

    const denom = deployment.denomination;
    const enoughBalance = balance !== undefined && balance >= denom;

    async function handleDeposit() {
        if (!address || !publicClient) return;
        setError('');
        setStep('working');
        try {
            // 1. fresh note — generated and kept entirely client-side
            setStatus('Generating your note…');
            const note = await createNote();
            const encoded = encodeNote(note, chainId);

            // 2. approve if needed
            if (allowance === undefined || allowance < denom) {
                setStatus('Approve USDC…');
                const approveHash = await writeContractAsync({
                    address: deployment.usdc,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [deployment.vault, denom],
                });
                setStatus('Confirming approval…');
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
            }

            // 3. deposit the commitment
            setStatus('Depositing…');
            const depositHash = await writeContractAsync({
                address: deployment.vault,
                abi: vaultAbi,
                functionName: 'deposit',
                args: [note.commitment],
            });
            setStatus('Confirming deposit…');
            await publicClient.waitForTransactionReceipt({ hash: depositHash });

            setNoteString(encoded);
            setSavedConfirmed(false);
            setStep('save');
            void refetchBalance();
            void refetchAllowance();
        } catch (e) {
            setError(e instanceof Error ? e.message.split('\n')[0] : 'Transaction failed');
            setStep('error');
        }
    }

    function downloadNote() {
        const blob = new Blob([noteString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `obsidian-note-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const denomLabel = `${formatUnits(denom, 6)} USDC`;

    return (
        <div className="glass flex flex-col rounded-2xl p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-bone">Deposit</h2>
                <span className="font-mono text-[11px] uppercase tracking-widest text-smoke">
                    fixed · {denomLabel}
                </span>
            </div>

            {step === 'save' ? (
                <SaveNote
                    noteString={noteString}
                    saved={savedConfirmed}
                    onToggleSaved={setSavedConfirmed}
                    onCopy={() => navigator.clipboard.writeText(noteString)}
                    onDownload={downloadNote}
                    onDone={() => {
                        setNoteString('');
                        setStep('idle');
                    }}
                />
            ) : (
                <>
                    <p className="mt-3 text-sm leading-relaxed text-smoke">
                        Lock {denomLabel} under a fresh commitment. You&apos;ll get a secret note —
                        the only key to withdraw, later, to any address.
                    </p>

                    <div className="mt-5 flex items-center justify-between rounded-xl border border-ash/60 px-4 py-3 font-mono text-xs">
                        <span className="text-smoke">Your balance</span>
                        <span className="text-bone">
                            {balance !== undefined ? `${formatUnits(balance, 6)} USDC` : '…'}
                        </span>
                    </div>

                    {step === 'working' && (
                        <p className="mt-4 flex items-center gap-2 font-mono text-xs text-ember-glow">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
                            {status}
                        </p>
                    )}
                    {step === 'error' && (
                        <p className="mt-4 break-words font-mono text-xs text-red-400">{error}</p>
                    )}

                    <button
                        onClick={handleDeposit}
                        disabled={step === 'working' || !enoughBalance}
                        className="mt-6 rounded-xl bg-gradient-to-r from-ember to-ember-glow px-5 py-3 font-display text-sm font-semibold text-void shadow-[0_0_30px_-10px_var(--color-ember)] transition-transform enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {step === 'working'
                            ? 'Working…'
                            : !enoughBalance
                              ? 'Insufficient USDC'
                              : `Deposit ${denomLabel}`}
                    </button>
                </>
            )}
        </div>
    );
}

function SaveNote({
    noteString,
    saved,
    onToggleSaved,
    onCopy,
    onDownload,
    onDone,
}: {
    noteString: string;
    saved: boolean;
    onToggleSaved: (v: boolean) => void;
    onCopy: () => void;
    onDownload: () => void;
    onDone: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
        >
            <div className="mb-4 flex items-center gap-2">
                <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                    className="inline-block h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_20px_2px_var(--color-ember)]"
                />
                <span className="font-display text-sm font-semibold text-ember-glow">
                    Deposited — save your note
                </span>
            </div>

            <p className="text-sm leading-relaxed text-smoke">
                This is the <span className="text-bone">only</span> way to withdraw. Anyone with it
                can spend the deposit. Store it somewhere safe — we can&apos;t recover it.
            </p>

            <div className="mt-4 break-all rounded-xl border border-ember/30 bg-void/60 p-3 font-mono text-[11px] leading-relaxed text-bone/90">
                {noteString}
            </div>

            <div className="mt-3 flex gap-2">
                <button
                    onClick={onCopy}
                    className="flex-1 rounded-lg border border-ash px-3 py-2 font-display text-xs font-medium text-bone hover:border-ember/50"
                >
                    Copy
                </button>
                <button
                    onClick={onDownload}
                    className="flex-1 rounded-lg border border-ash px-3 py-2 font-display text-xs font-medium text-bone hover:border-ember/50"
                >
                    Download
                </button>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-smoke">
                <input
                    type="checkbox"
                    checked={saved}
                    onChange={(e) => onToggleSaved(e.target.checked)}
                    className="accent-ember"
                />
                I&apos;ve backed up my note safely
            </label>

            <button
                onClick={onDone}
                disabled={!saved}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-ember to-ember-glow px-5 py-3 font-display text-sm font-semibold text-void transition-transform enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
                Done
            </button>
        </motion.div>
    );
}
