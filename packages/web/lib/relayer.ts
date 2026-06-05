// Tiny client for the Obsidian relayer. Fetch-only (no SDK import) so it stays
// out of the heavy lazy-loaded chunk. The relayer is optional: if it's not
// configured or not reachable, the UI falls back to a self-submitted withdrawal.

export interface RelayerChainInfo {
    chain_id: number;
    vault: string;
    denomination: string | null;
    fee: string | null;
    gas_price: string | null;
    relayer_balance: string | null;
    funded: boolean;
}

export interface RelayerInfo {
    service: string;
    relayer: string;
    chains: RelayerChainInfo[];
}

export interface RelaySubmitPayload {
    chainId: number;
    proof: {
        a: [string, string];
        b: [[string, string], [string, string]];
        c: [string, string];
    };
    root: string;
    nullifierHash: string;
    recipient: string;
    fee: string;
}

export interface RelaySubmitResult {
    tx_hash: string;
    chain_id: number;
    fee: string;
}

// Static reference so Next inlines it at build time.
export const RELAYER_URL = (process.env.NEXT_PUBLIC_RELAYER_URL ?? '').replace(/\/+$/, '');
export const relayerConfigured = RELAYER_URL.length > 0;

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/** Is the relayer up? Short timeout so a sleeping/offline relayer doesn't stall the UI. */
export async function relayerHealthy(timeoutMs = 4000): Promise<boolean> {
    if (!relayerConfigured) return false;
    try {
        const res = await fetchWithTimeout(`${RELAYER_URL}/health`, timeoutMs);
        return res.ok;
    } catch {
        return false;
    }
}

export async function getRelayerInfo(timeoutMs = 12000): Promise<RelayerInfo> {
    const res = await fetchWithTimeout(`${RELAYER_URL}/info`, timeoutMs);
    if (!res.ok) throw new Error(`relayer /info returned ${res.status}`);
    return res.json();
}

export async function submitRelay(
    payload: RelaySubmitPayload,
    timeoutMs = 90000
): Promise<RelaySubmitResult> {
    const res = await fetchWithTimeout(`${RELAYER_URL}/relay`, timeoutMs, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.detail || data?.error || `relayer error ${res.status}`);
    }
    return data as RelaySubmitResult;
}
