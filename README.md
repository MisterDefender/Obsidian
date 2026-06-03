# Obsidian

> A zero-knowledge **shielded vault**: deposit a fixed amount of an ERC-20, then withdraw later to a
> fresh address with **no on-chain link** between the deposit and the withdrawal — proven with a zk-SNARK.

> ⚠️ **Research & educational project. Testnet only.** Obsidian is a study of zero-knowledge privacy
> engineering, not a service. Do not deploy to mainnet or use with real funds.

## How it works

```
ALICE (Deposit):
1. Generate a random secret + nullifier
2. commitment = Poseidon(nullifier, secret)
3. Send tokens + commitment to the vault
4. Vault inserts the commitment as the next Merkle-tree leaf
5. Alice saves her secret note

           [ time passes — the privacy gap ]

BOB (Withdraw):
1. Bob holds the note (received off-chain)
2. Rebuild the tree from events and prove, in zero knowledge:
   "my commitment is SOME leaf under this Merkle root" (never which one)
3. Submit proof + root + nullifierHash + recipient to the vault
4. Vault checks the root is recent, verifies the proof
5. Vault pays the recipient (optionally a relayer fee)
6. nullifierHash is marked used (prevents double-spend)
```

Only the **root** and the **nullifier hash** are public — the proof never reveals the commitment,
the secret, or which leaf is being spent. That's what gives a large anonymity set.

## Monorepo layout

```
obsidian/
├─ packages/
│  ├─ contracts/   # Solidity + Hardhat (vault, verifier, mock token, deploy)
│  ├─ circuits/    # circom circuits, trusted-setup ceremony, proof tooling
│  ├─ sdk/         # TS client: notes, proofs, Merkle sync        (Phase 5)
│  ├─ relayer/     # gasless withdrawal service                   (Phase 2)
│  └─ web/         # Next.js frontend                             (Phase 6)
├─ ROADMAP.md      # the path to production-grade
├─ .env.example    # environment template (copy to .env)
└─ package.json    # npm workspaces root
```

## Getting started

All commands run from the repo root (npm workspaces). See the root
[`package.json`](./package.json) `scripts` for the full list.

### 1. Install + build everything

```bash
npm run setup        # install deps, build the circuit (dev ceremony), build the SDK, compile contracts
# or build literally everything (incl. the web app):
npm run build
```

`npm run setup` runs, in order:
`npm install` → `build:circuits` (compile + dev Powers-of-Tau, emits `Verifier.sol` + proving key)
→ `build:sdk` (tsc) → `compile` (Hardhat).

### 2. Test

```bash
npm test             # Hardhat contract suite (needs the circuit built first)
npm run test:sdk     # SDK unit tests (note round-trip, tree, real proof vs vkey)
npm run slither      # static analysis (requires slither-analyzer)
```

### 3. Run the full stack locally (two terminals)

```bash
# terminal 1 — local chain; hardhat-deploy auto-deploys Poseidon → Verifier → ObsidianVault
npm run chain

# terminal 2 — the web app (http://localhost:3000)
npm run dev
```

Then point the web app at the local deployment by creating `packages/web/.env.local`
(addresses are hardhat's deterministic defaults):

```bash
NEXT_PUBLIC_DEV_MOCK=true          # connect/sign via a local hardhat account (no MetaMask)
NEXT_PUBLIC_VAULT_31337=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
NEXT_PUBLIC_USDC_31337=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_BLOCK_31337=0
```

### Root scripts reference

| Script | What it does |
|---|---|
| `npm run setup` | install + build circuit + build SDK + compile contracts |
| `npm run build` | the above **plus** build the web app |
| `npm run build:circuits` / `:sdk` / `:web` | build a single package |
| `npm run compile` / `npm test` | Hardhat compile / test |
| `npm run test:sdk` | SDK tests |
| `npm run slither` | Slither static analysis |
| `npm run chain` | local Hardhat node (auto-deploys) |
| `npm run deploy` / `npm run deploy:local` | deploy (default network / `localhost`) |
| `npm run dev` / `npm start` | web app in dev / production mode |

For testnet deploys, copy `.env.example` to `.env` and fill in RPC + explorer keys.

## Status

Active development — upgrading from a learning prototype to a production-grade, multi-chain testnet
deployment (**Sepolia + Arbitrum Sepolia + Base Sepolia**) with a live frontend. See
[`ROADMAP.md`](./ROADMAP.md).

- ✅ **Phase 0** — monorepo foundation, rename, git.
- ✅ **Phase 1** — on-chain Poseidon Merkle tree + ZK Merkle-inclusion withdraw (the core privacy
  fix). `ObsidianVault` + `MerkleTreeWithHistory` + rewritten circuit; full test suite green.
- ✅ **Phase 4** — security hardening: custom errors, reentrancy/edge tests, Slither (clean), CI,
  threat model ([`SECURITY.md`](./SECURITY.md)).
- ✅ **Phase 5** — TypeScript SDK ([`@obsidian/sdk`](./packages/sdk)): notes, Poseidon Merkle tree,
  proof generation, and a pool client. The contracts tests run against it.
- ⏭️ **Next** — frontend (Phase 6) + relayer (Phase 2), then testnet deploy (Phase 7).
