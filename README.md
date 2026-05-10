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

```bash
npm install                 # installs all workspaces
npm run compile             # compile the contracts
npm run test                # run the contract test suite
cp .env.example .env        # then fill in your keys
```

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
