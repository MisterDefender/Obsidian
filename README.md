# Obsidian

> A zero-knowledge **shielded vault**: deposit a fixed amount of an ERC-20, then withdraw later to a
> fresh address with **no on-chain link** between the deposit and the withdrawal — proven with a zk-SNARK.

> ⚠️ **Research & educational project. Testnet only.** Obsidian is a study of zero-knowledge privacy
> engineering, not a service. Do not deploy to mainnet or use with real funds.

## How it works

```
ALICE (Deposit):
1. Generate a random secret + nullifier
2. commitment = Poseidon(secret, nullifier)
3. Send tokens + commitment to the vault
4. Vault stores the commitment
5. Alice saves her secret note

           [ time passes — the privacy gap ]

BOB (Withdraw):
1. Bob holds the note (received off-chain)
2. Generate a proof: "I know a secret+nullifier behind a commitment in the vault"
3. Submit proof + recipient to the vault
4. Vault verifies the proof
5. Vault pays the recipient
6. Nullifier is marked used (prevents double-spend)
```

The proof reveals nothing about the secret; only the commitment and nullifier hash are public.

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
[`ROADMAP.md`](./ROADMAP.md); Phase 1 (on-chain Merkle tree) is the core privacy fix in progress.
