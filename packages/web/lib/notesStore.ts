import { create } from 'zustand';

export type NoteStatus = 'unknown' | 'unspent' | 'spent' | 'notfound';

export interface StoredNote {
    id: string;
    noteString: string;
    commitment: string;
    nullifierHash: string;
    createdAt: number;
    status: NoteStatus;
}

interface NotesState {
    /** Session-only — intentionally NOT persisted to disk. Cleared on refresh. */
    notes: StoredNote[];
    /** A note string queued to prefill the withdraw form. */
    prefill: string | null;

    addNote: (note: {
        noteString: string;
        commitment: string;
        nullifierHash: string;
        status?: NoteStatus;
    }) => void;
    removeNote: (id: string) => void;
    setStatus: (id: string, status: NoteStatus) => void;
    setPrefill: (noteString: string | null) => void;
}

export const useNotesStore = create<NotesState>((set) => ({
    notes: [],
    prefill: null,

    addNote: (note) =>
        set((state) => {
            if (state.notes.some((n) => n.commitment === note.commitment)) return state;
            const entry: StoredNote = {
                id:
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : String(Math.random()),
                noteString: note.noteString,
                commitment: note.commitment,
                nullifierHash: note.nullifierHash,
                createdAt: Date.now(),
                status: note.status ?? 'unknown',
            };
            return { notes: [entry, ...state.notes] };
        }),

    removeNote: (id) => set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

    setStatus: (id, status) =>
        set((state) => ({
            notes: state.notes.map((n) => (n.id === id ? { ...n, status } : n)),
        })),

    setPrefill: (noteString) => set({ prefill: noteString }),
}));
