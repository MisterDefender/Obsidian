// The vault ABI now lives in lib/contracts.ts (single source of truth for both
// addresses and ABI). This re-export keeps older imports working.
export { vaultAbi } from './contracts';
