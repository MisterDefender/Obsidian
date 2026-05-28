'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { useNotesStore, type NoteStatus, type StoredNote } from '@/lib/notesStore';
import { loadSdk } from '@/lib/sdk';
import { vaultAbi } from '@/lib/abis';
import type { ObsidianDeployment } from '@/lib/contracts';

const STATUS_LABEL: Record<NoteStatus, string> = {
    unknown: 'checking…',
    unspent: 'unspent',
    spent: 'spent',
    notfound: 'not in pool',
};

const STATUS_STYLE: Record<NoteStatus, string> = {
    unknown: 'text-smoke border-ash/60',
    unspent: 'text-ember-glow border-ember/40',
    spent: 'text-smoke/70 border-ash/60',
    notfound: 'text-amber-400 border-amber-500/30',
};

export function NoteManager({ deployment }: { deployment: ObsidianDeployment }) {
    const publicClient = usePublicClient();
    const notes = useNotesStore((s) => s.notes);
    const addNote = useNotesStore((s) => s.addNote);
    const removeNote = useNotesStore((s) => s.removeNote);
    const setStatus = useNotesStore((s) => s.setStatus);
    const setPrefill = useNotesStore((s) => s.setPrefill);

    const [importValue, setImportValue] = useState('');
    const [importError, setImportError] = useState('');

    const checkStatus = useCallback(
        async (note: StoredNote) => {
            if (!publicClient) return;
            try {
                const [exists, spent] = await Promise.all([
                    publicClient.readContract({
                        address: deployment.vault,
                        abi: vaultAbi,
                        functionName: 'commitments',
                        args: [BigInt(note.commitment)],
                    }),
                    publicClient.readContract({
                        address: deployment.vault,
                        abi: vaultAbi,
                        functionName: 'isSpent',
                        args: [BigInt(note.nullifierHash)],
                    }),
                ]);
                setStatus(note.id, !exists ? 'notfound' : spent ? 'spent' : 'unspent');
            } catch {
                /* leave as-is */
            }
        },
        [publicClient, deployment.vault, setStatus]
    );

    // resolve + keep statuses fresh (so a note flips to "spent" after withdrawal).
    // Re-checks every non-terminal note immediately and then on an interval.
    useEffect(() => {
        const recheck = () => {
            for (const note of useNotesStore.getState().notes) {
                if (note.status !== 'spent') void checkStatus(note);
            }
        };
        recheck();
        const id = setInterval(recheck, 6000);
        return () => clearInterval(id);
    }, [checkStatus, notes.length]);

    async function handleImport() {
        setImportError('');
        const value = importValue.trim();
        if (!value) return;
        try {
            const sdk = await loadSdk();
            const { note } = await sdk.parseNote(value);
            addNote({
                noteString: value,
                commitment: note.commitment.toString(),
                nullifierHash: note.nullifierHash.toString(),
            });
            setImportValue('');
        } catch {
            setImportError('Not a valid Obsidian note.');
        }
    }

    function withdrawNote(noteString: string) {
        setPrefill(noteString);
        document.getElementById('withdraw')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return (
        <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-bone">Your notes</h2>
                <span className="font-mono text-[10px] uppercase tracking-widest text-smoke">
                    {notes.length} this session
                </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-smoke">
                Session only — notes are <span className="text-bone">never saved to disk</span> and
                vanish on refresh. Download any note you want to keep.
            </p>

            {/* import */}
            <div className="mt-4 flex gap-2">
                <input
                    value={importValue}
                    onChange={(e) => setImportValue(e.target.value)}
                    placeholder="Paste a note to track…"
                    className="w-full rounded-xl border border-ash/60 bg-void/60 px-3 py-2 font-mono text-[11px] text-bone placeholder:text-smoke/50 focus:border-ember/50 focus:outline-none"
                />
                <button
                    onClick={handleImport}
                    className="whitespace-nowrap rounded-xl border border-ash px-3 py-2 font-display text-xs text-bone hover:border-ember/50"
                >
                    Track
                </button>
            </div>
            {importError && <p className="mt-2 font-mono text-[11px] text-red-400">{importError}</p>}

            {/* list */}
            <div className="mt-4 flex flex-col gap-2">
                {notes.length === 0 && (
                    <p className="rounded-xl border border-dashed border-ash/50 px-4 py-6 text-center text-xs text-smoke/70">
                        No notes yet. Make a deposit, or paste a note above to track it.
                    </p>
                )}

                {notes.map((note) => (
                    <div
                        key={note.id}
                        className="flex items-center gap-3 rounded-xl border border-ash/50 px-3 py-2.5"
                    >
                        <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_STYLE[note.status]}`}
                        >
                            {STATUS_LABEL[note.status]}
                        </span>
                        <span className="flex-1 truncate font-mono text-[11px] text-bone/80">
                            {note.noteString.slice(0, 26)}…{note.noteString.slice(-6)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                            {note.status === 'unspent' && (
                                <button
                                    onClick={() => withdrawNote(note.noteString)}
                                    className="rounded-lg bg-gradient-to-r from-ember to-ember-glow px-2.5 py-1 font-display text-[11px] font-semibold text-void"
                                >
                                    Withdraw
                                </button>
                            )}
                            <button
                                onClick={() => navigator.clipboard.writeText(note.noteString)}
                                className="rounded-lg border border-ash px-2.5 py-1 font-display text-[11px] text-smoke hover:text-bone"
                            >
                                Copy
                            </button>
                            <button
                                onClick={() => removeNote(note.id)}
                                className="rounded-lg border border-ash px-2 py-1 font-display text-[11px] text-smoke hover:text-red-400"
                                aria-label="Remove from list"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
