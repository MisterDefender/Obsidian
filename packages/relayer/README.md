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

## Deploy to Fly.io

The relayer is a long-running process, so it lives on its own host (not Vercel).
[`Dockerfile`](./Dockerfile) + [`fly.toml`](./fly.toml) are ready to go.

```bash
# one-time
fly auth login
fly launch --no-deploy            # pick a unique app name; keep the provided fly.toml

# secrets (never commit these)
fly secrets set \
  RELAYER_PRIVATE_KEY=0x<your funded relayer key> \
  CHAINS=11155111,421614,84532 \
  RPC_11155111=https://eth-sepolia.g.alchemy.com/v2/<key> \
  VAULT_11155111=0x<sepolia vault> \
  RPC_421614=https://arb-sepolia.g.alchemy.com/v2/<key> \
  VAULT_421614=0x<arb vault> \
  RPC_84532=https://base-sepolia.g.alchemy.com/v2/<key> \
  VAULT_84532=0x<base vault> \
  ALLOWED_ORIGINS=https://obsidian-web-topaz.vercel.app,http://localhost:3000

fly deploy
```

Then **fund the relayer address** (shown in `GET /info`) with a little testnet ETH on
each chain so it can pay gas.

## Wire it to the frontend (Vercel)

Set one env var in your Vercel project and redeploy:

```
NEXT_PUBLIC_RELAYER_URL=https://<your-app>.fly.dev
```

The web app's withdraw flow will use it when "gasless" is selected (Step 7).

> Optional: front the Fly app with Cloudflare (free) for a custom domain + edge TLS
> and rate-limiting. Per-IP rate limiting is best done there rather than in-process.
