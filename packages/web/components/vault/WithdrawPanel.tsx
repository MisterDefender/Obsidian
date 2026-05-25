'use client';

import { useState } from 'react';
import { formatUnits, isAddress, getAddress, parseAbiItem, zeroAddress } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { motion } from 'motion/react';
import { loadSdk, ARTIFACTS } from '@/lib/sdk';
import { vaultAbi } from '@/lib/abis';
import type { ObsidianDeployment } from '@/lib/contracts';

type Step = 'idle' | 'working' | 'done' | 'error';

const DEPOSIT_EVENT = parseAbiItem(
    'event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp)'
);

export function WithdrawPanel({ deployment }: { deployment: ObsidianDeployment }) {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const [noteString, setNoteString] = useState('');
    const [recipient, setRecipient] = useState('');
    const [step, setStep] = useState<Step>('idle');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    const denomLabel = `${formatUnits(deployment.denomination, 6)} USDC`;
    const recipientValid = isAddress(recipient);
    const canSubmit = noteString.trim().length > 0 && recipientValid && step !== 'working';

    async function handleWithdraw() {
        if (!publicClient) return;
        setError('');
        setStep('working');
        try {
            const sdk = await loadSdk();

            // 1. parse the note + derive commitment / nullifier hash
            setStatus('Reading note…');
            const { note } = await sdk.parseNote(noteString.trim());

            // 2. reject already-spent notes early
            const spent = await publicClient.readContract({
                address: deployment.vault,
                abi: vaultAbi,
                functionName: 'isSpent',
                args: [note.nullifierHash],
            });
            if (spent) throw new Error('This note has already been withdrawn.');

            // 3. rebuild the tree from deposit events and locate our leaf
            setStatus('Scanning the pool…');
            const logs = await publicClient.getLogs({
                address: deployment.vault,
                event: DEPOSIT_EVENT,
                fromBlock: deployment.deploymentBlock,
                toBlock: 'latest',
            });
            const leaves = logs
                .map((l) => ({
                    index: Number(l.args.leafIndex ?? 0),
                    commitment: BigInt(l.args.commitment ?? 0n),
                }))
                .sort((a, b) => a.index - b.index);

            const tree = await sdk.createMerkleTree(deployment.levels);
            for (const leaf of leaves) tree.insert(leaf.commitment);
            const index = tree.indexOf(note.commitment);
            if (index < 0) throw new Error('Note not found in this pool.');
            const merkleProof = tree.proof(index);

            // 4. generate the zk proof (snarkjs, lazy-loaded)
            setStatus('Generating zero-knowledge proof…');
            const { solidity } = await sdk.generateWithdrawProof(
                {
                    note,
                    merkleProof,
                    recipient: getAddress(recipient),
                    relayer: zeroAddress,
                    fee: 0n,
                },
                ARTIFACTS
            );

            const a = solidity.a.map(BigInt) as [bigint, bigint];
            const b = solidity.b.map((row) => row.map(BigInt)) as [
                [bigint, bigint],
                [bigint, bigint],
            ];
            const c = solidity.c.map(BigInt) as [bigint, bigint];

            // 5. submit the withdrawal
            setStatus('Submitting withdrawal…');
            const hash = await writeContractAsync({
                address: deployment.vault,
                abi: vaultAbi,
                functionName: 'withdraw',
                args: [
                    a,
                    b,
                    c,
                    merkleProof.root,
                    note.nullifierHash,
                    getAddress(recipient),
                    zeroAddress,
                    0n,
                ],
            });
            setStatus('Confirming…');
            await publicClient.waitForTransactionReceipt({ hash });

            setStep('done');
        } catch (e) {
            setError(e instanceof Error ? e.message.split('\n')[0] : 'Withdrawal failed');
            setStep('error');
        }
    }

    if (step === 'done') {
        return (
            <div className="glass flex flex-col rounded-2xl p-6">
                <h2 className="font-display text-xl font-semibold text-bone">Withdraw</h2>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex flex-col items-center text-center"
                >
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                        className="mb-4 h-10 w-10 rounded-full bg-gradient-to-br from-ember to-ember-glow shadow-[0_0_40px_-4px_var(--color-ember)]"
                    />
                    <p className="font-display text-lg font-semibold text-bone">Withdrawn privately</p>
                    <p className="mt-2 max-w-xs text-sm text-smoke">
                        {denomLabel} sent to{' '}
                        <span className="font-mono text-ember-glow">
                            {recipient.slice(0, 6)}…{recipient.slice(-4)}
                        </span>
                        . No on-chain link ties it to the deposit.
                    </p>
                    <button
                        onClick={() => {
                            setNoteString('');
                            setRecipient('');
                            setStep('idle');
                        }}
                        className="mt-6 rounded-xl border border-ash px-5 py-2.5 font-display text-sm font-medium text-bone hover:border-ember/50"
                    >
                        Done
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="glass flex flex-col rounded-2xl p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-bone">Withdraw</h2>
                <span className="font-mono text-[11px] uppercase tracking-widest text-smoke">
                    {denomLabel}
                </span>
            </div>

            <label className="mt-4 block font-mono text-[11px] uppercase tracking-widest text-smoke">
                Your note
            </label>
            <textarea
                value={noteString}
                onChange={(e) => setNoteString(e.target.value)}
                placeholder="obsidian-v1-…"
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-ash/60 bg-void/60 p-3 font-mono text-[11px] text-bone placeholder:text-smoke/50 focus:border-ember/50 focus:outline-none"
            />

            <label className="mt-4 block font-mono text-[11px] uppercase tracking-widest text-smoke">
                Recipient
            </label>
            <div className="mt-2 flex gap-2">
                <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x…"
                    className="w-full rounded-xl border border-ash/60 bg-void/60 px-3 py-2.5 font-mono text-xs text-bone placeholder:text-smoke/50 focus:border-ember/50 focus:outline-none"
                />
                {address && (
                    <button
                        onClick={() => setRecipient(address)}
                        className="whitespace-nowrap rounded-xl border border-ash px-3 py-2 font-display text-xs text-smoke hover:border-ember/50 hover:text-bone"
                    >
                        Me
                    </button>
                )}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-ash/40 px-3 py-2.5 text-xs text-smoke/80">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-smoke/50" />
                Gasless relayer withdrawals arrive in a later phase. For now the connected wallet
                submits the transaction.
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
                onClick={handleWithdraw}
                disabled={!canSubmit}
                className="mt-6 rounded-xl bg-gradient-to-r from-ember to-ember-glow px-5 py-3 font-display text-sm font-semibold text-void shadow-[0_0_30px_-10px_var(--color-ember)] transition-transform enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {step === 'working' ? 'Working…' : 'Generate proof & withdraw'}
            </button>
        </div>
    );
}
