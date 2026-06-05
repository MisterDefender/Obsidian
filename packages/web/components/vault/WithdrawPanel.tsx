'use client';

import { useEffect, useState } from 'react';
import { formatUnits, isAddress, getAddress, parseAbiItem, zeroAddress } from 'viem';
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi';
import { motion } from 'motion/react';
import { loadSdk, ARTIFACTS } from '@/lib/sdk';
import { vaultAbi } from '@/lib/abis';
import { useNotesStore } from '@/lib/notesStore';
import {
    relayerConfigured,
    relayerHealthy,
    getRelayerInfo,
    submitRelay,
    type RelayerInfo,
} from '@/lib/relayer';
import type { ObsidianDeployment } from '@/lib/contracts';

type Step = 'idle' | 'working' | 'done' | 'error';
type RelayerState = 'probing' | 'online' | 'offline';

const DEPOSIT_EVENT = parseAbiItem(
    'event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp)'
);

export function WithdrawPanel({ deployment }: { deployment: ObsidianDeployment }) {
    const { address } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const prefill = useNotesStore((s) => s.prefill);
    const setPrefill = useNotesStore((s) => s.setPrefill);

    const [noteString, setNoteString] = useState('');
    const [recipient, setRecipient] = useState('');
    const [step, setStep] = useState<Step>('idle');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [paidFee, setPaidFee] = useState<bigint>(0n);

    // relayer availability + chosen mode
    const [relayerState, setRelayerState] = useState<RelayerState>(
        relayerConfigured ? 'probing' : 'offline'
    );
    const [relayerInfo, setRelayerInfo] = useState<RelayerInfo | null>(null);
    const [useRelayer, setUseRelayer] = useState(false);

    // probe the relayer once on mount; degrade silently if it's down
    useEffect(() => {
        if (!relayerConfigured) return;
        let cancelled = false;
        (async () => {
            const ok = await relayerHealthy();
            if (cancelled) return;
            if (!ok) {
                setRelayerState('offline');
                return;
            }
            try {
                const info = await getRelayerInfo();
                if (cancelled) return;
                setRelayerInfo(info);
                setRelayerState('online');
                setUseRelayer(true); // prefer gasless when available
            } catch {
                if (!cancelled) setRelayerState('offline');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // a note picked from the note manager prefills the form
    useEffect(() => {
        if (prefill) {
            setNoteString(prefill);
            setStep('idle');
            setError('');
            setPrefill(null);
        }
    }, [prefill, setPrefill]);

    const denom = deployment.denomination;
    const denomLabel = `${formatUnits(denom, 6)} USDC`;
    const recipientValid = isAddress(recipient);
    const canSubmit = noteString.trim().length > 0 && recipientValid && step !== 'working';

    // estimated relayer fee for the current chain (display only)
    const estFee = (() => {
        const ci = relayerInfo?.chains.find((c) => c.chain_id === chainId);
        return ci?.fee ? BigInt(ci.fee) : null;
    })();
    const gasless = relayerState === 'online' && useRelayer;

    async function handleWithdraw() {
        if (!publicClient) return;
        setError('');
        setStep('working');
        try {
            const sdk = await loadSdk();

            setStatus('Reading note…');
            const { note } = await sdk.parseNote(noteString.trim());

            const spent = await publicClient.readContract({
                address: deployment.vault,
                abi: vaultAbi,
                functionName: 'isSpent',
                args: [note.nullifierHash],
            });
            if (spent) throw new Error('This note has already been withdrawn.');

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

            // Decide relayer vs self. For the relayer we fetch a FRESH quote so the
            // fee we bind into the proof matches what the relayer will require now.
            let relayerAddr = zeroAddress as string;
            let fee = 0n;
            if (gasless) {
                setStatus('Quoting relayer fee…');
                const info = await getRelayerInfo();
                const ci = info.chains.find((c) => c.chain_id === chainId);
                if (!ci?.fee) throw new Error('Relayer is unavailable on this network.');
                relayerAddr = getAddress(info.relayer);
                fee = BigInt(ci.fee);
            }

            setStatus('Generating zero-knowledge proof…');
            const { solidity } = await sdk.generateWithdrawProof(
                {
                    note,
                    merkleProof,
                    recipient: getAddress(recipient),
                    relayer: relayerAddr,
                    fee,
                },
                ARTIFACTS
            );

            if (gasless) {
                // hand the proof to the relayer; it pays gas and submits
                setStatus('Submitting via relayer…');
                const { tx_hash } = await submitRelay({
                    chainId,
                    proof: { a: solidity.a, b: solidity.b, c: solidity.c },
                    root: merkleProof.root.toString(),
                    nullifierHash: note.nullifierHash.toString(),
                    recipient: getAddress(recipient),
                    fee: fee.toString(),
                });
                setStatus('Confirming…');
                await publicClient.waitForTransactionReceipt({ hash: tx_hash as `0x${string}` });
            } else {
                // self-submit from the connected wallet
                const a = solidity.a.map(BigInt) as [bigint, bigint];
                const b = solidity.b.map((row) => row.map(BigInt)) as [
                    [bigint, bigint],
                    [bigint, bigint],
                ];
                const c = solidity.c.map(BigInt) as [bigint, bigint];

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
            }

            setPaidFee(fee);
            setStep('done');
        } catch (e) {
            setError(e instanceof Error ? e.message.split('\n')[0] : 'Withdrawal failed');
            setStep('error');
        }
    }

    if (step === 'done') {
        const received = denom - paidFee;
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
                        {`${formatUnits(received, 6)} USDC`} sent to{' '}
                        <span className="font-mono text-ember-glow">
                            {recipient.slice(0, 6)}…{recipient.slice(-4)}
                        </span>
                        {paidFee > 0n
                            ? ` — gaslessly, ${formatUnits(paidFee, 6)} USDC relayer fee.`
                            : '. No on-chain link ties it to the deposit.'}
                    </p>
                    <button
                        onClick={() => {
                            setNoteString('');
                            setRecipient('');
                            setPaidFee(0n);
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

            {/* Relayer / gasless option, with graceful states */}
            {relayerState === 'probing' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-ash/40 px-3 py-2.5 text-xs text-smoke/80">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-smoke/60" />
                    Checking the relayer…
                </div>
            )}

            {relayerState === 'online' && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ember/30 bg-ember/[0.03] px-3 py-3">
                    <input
                        type="checkbox"
                        checked={useRelayer}
                        onChange={(e) => setUseRelayer(e.target.checked)}
                        className="mt-0.5 accent-ember"
                    />
                    <span className="text-xs leading-relaxed text-bone">
                        <span className="font-semibold">Gasless withdrawal</span> — a relayer submits
                        the transaction so the recipient needs no ETH.
                        {estFee !== null && (
                            <span className="mt-0.5 block text-smoke">
                                Relayer fee ≈ {formatUnits(estFee, 6)} USDC · recipient gets{' '}
                                {formatUnits(denom - estFee, 6)} USDC.
                            </span>
                        )}
                    </span>
                </label>
            )}

            {relayerState === 'offline' && relayerConfigured && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-ash/40 px-3 py-2.5 text-xs text-smoke/80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-smoke/50" />
                    Relayer offline — your connected wallet will submit the transaction.
                </div>
            )}

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
                {step === 'working'
                    ? 'Working…'
                    : gasless
                      ? 'Generate proof & withdraw (gasless)'
                      : 'Generate proof & withdraw'}
            </button>
        </div>
    );
}
