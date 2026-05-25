// Lazily load @obsidian/sdk so snarkjs + circomlibjs are split into an on-demand
// chunk instead of bloating the initial vault bundle.
export const loadSdk = () => import('@obsidian/sdk');

// Public URLs for the circuit artifacts (copied into public/ by copy-artifacts).
export const ARTIFACTS = {
    wasm: '/circuits/withdraw.wasm',
    zkey: '/circuits/withdraw_final.zkey',
} as const;
