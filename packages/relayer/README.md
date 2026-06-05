# @obsidian/relayer

A **gasless-withdrawal relayer** for the Obsidian shielded vault, written in Rust
(Axum + Tokio + Alloy). It submits a user's withdrawal transaction on their behalf,
pays the gas, and takes a fee out of the withdrawn amount — so the recipient needs
zero ETH and there's no self-funded sender to link them to the deposit.

It is **trust-minimised**: `recipient` and `fee` are bound inside the zk proof, so
the relayer can only submit the exact withdrawal or refuse — it can never steal or
redirect funds.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/info` | Relayer address + per-chain fee, denomination, gas price, and funding status. Call this first to learn the fee to bake into the proof. |
| `POST` | `/relay` | `{ chainId, proof{a,b,c}, root, nullifierHash, recipient, fee }` → `{ txHash }` |

`/relay` runs a cheapest-first pipeline: parse → fee/funding checks → root + nullifier
reads → **simulate** (free; rejects bad/spent proofs before spending gas) → submit.

## Configuration (env)

See [`.env.example`](./.env.example). Key vars: `RELAYER_PRIVATE_KEY`, `CHAINS` (csv of
chain ids) plus `RPC_<id>` / `VAULT_<id>` per chain, the fee knobs
(`ETH_PRICE_USD`, `FEE_MARGIN_BPS`, `MIN_FEE_USDC`), and `ALLOWED_ORIGINS` (CORS).

## Run locally

```bash
cp .env.example .env     # fill in (local dev uses hardhat key #0)
cargo run                # http://localhost:8080
```

## Deploy to Render (free, no credit card)

The relayer is a long-running process, so it lives on its own host (not Vercel).
Render runs our [`Dockerfile`](./Dockerfile) unchanged and gives an HTTPS URL.
A [`render.yaml`](../../render.yaml) Blueprint is included.

**Dashboard flow (simplest):**
1. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → connect this GitHub repo.
2. Set **Root Directory** = `packages/relayer`, **Runtime** = `Docker`, **Instance Type** = `Free`.
3. Add environment variables (the secrets never leave the dashboard):
   - `RELAYER_PRIVATE_KEY` = your funded relayer key
   - `CHAINS` = `11155111,421614,84532`
   - `RPC_<id>` / `VAULT_<id>` for each chain
   - `ALLOWED_ORIGINS` = `https://obsidian-web-topaz.vercel.app,http://localhost:3000`
   - (optional) `ETH_PRICE_USD`, `FEE_MARGIN_BPS`, `MIN_FEE_USDC`
4. **Create Web Service.** Render builds the image and serves it at
   `https://<name>.onrender.com`.

> Or use the included `render.yaml`: **New → Blueprint → connect repo**, then fill the
> `sync: false` secrets when prompted.

Then **fund the relayer address** (shown in `GET /info`) with a little testnet ETH on
each chain so it can pay gas.

> **Free-tier note:** the service sleeps after ~15 min idle and cold-starts (~30–60s)
> on the next request. The frontend handles this — it probes the relayer and falls back
> to a self-submitted withdrawal when it's asleep/offline.

## Wire it to the frontend (Vercel)

Set one env var in your Vercel project and redeploy:

```
NEXT_PUBLIC_RELAYER_URL=https://<your-app>.fly.dev
```

The web app's withdraw flow will use it when "gasless" is selected (Step 7).

> Optional: front the Fly app with Cloudflare (free) for a custom domain + edge TLS
> and rate-limiting. Per-IP rate limiting is best done there rather than in-process.
