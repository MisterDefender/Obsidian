import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    createNote,
    encodeNote,
    parseNote,
    createMerkleTree,
    generateWithdrawProof,
    verifyWithdrawProof,
} from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = join(__dirname, '../../circuits/build');
const WASM = join(BUILD, 'withdraw_js/withdraw.wasm');
const ZKEY = join(BUILD, 'withdraw_final.zkey');
const VKEY = join(BUILD, 'verification_key.json');

const RECIPIENT = '0x9DD815288163ac2A89af1EB68aec13387FE4f210';
const RELAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

test('note encode/parse round-trips', async () => {
    const note = await createNote();
    const str = encodeNote(note, 11155111);
    assert.match(str, /^obsidian-v1-11155111-0x[0-9a-f]{128}$/);

    const { note: parsed, chainId } = await parseNote(str);
    assert.equal(chainId, 11155111);
    assert.equal(parsed.nullifier, note.nullifier);
    assert.equal(parsed.secret, note.secret);
    assert.equal(parsed.commitment, note.commitment);
    assert.equal(parsed.nullifierHash, note.nullifierHash);
});

test('parseNote rejects malformed strings', async () => {
    await assert.rejects(() => parseNote('not-a-note'));
});

test('merkle tree is deterministic across instances', async () => {
    const note = await createNote();
    const t1 = await createMerkleTree(20);
    const t2 = await createMerkleTree(20);
    t1.insert(note.commitment);
    t2.insert(note.commitment);
    assert.equal(t1.root(), t2.root());
    assert.equal(t1.indexOf(note.commitment), 0);
});

// The artifact-dependent test only runs once the circuit is built.
const haveArtifacts = existsSync(WASM) && existsSync(ZKEY) && existsSync(VKEY);

test(
    'generates a withdraw proof that verifies against the circuit vkey',
    { skip: haveArtifacts ? false : 'circuit not built (run npm run build in packages/circuits)' },
    async () => {
        const note = await createNote();
        const tree = await createMerkleTree(20);
        tree.insert(note.commitment);
        const merkleProof = tree.proof(0);

        const { proof, publicSignals, solidity } = await generateWithdrawProof(
            { note, merkleProof, recipient: RECIPIENT, relayer: RELAYER, fee: 1000000n },
            { wasm: WASM, zkey: ZKEY }
        );

        // public signal order: [root, nullifierHash, recipient, relayer, fee]
        assert.equal(solidity.publicSignals.length, 5);
        assert.equal(solidity.publicSignals[0], merkleProof.root.toString());
        assert.equal(solidity.publicSignals[1], note.nullifierHash.toString());
        assert.equal(solidity.publicSignals[4], '1000000');

        const vkey = JSON.parse(readFileSync(VKEY, 'utf8'));
        assert.equal(await verifyWithdrawProof(vkey, publicSignals, proof), true);

        // tampering with a public signal invalidates the proof
        const tampered = [...publicSignals];
        tampered[2] = (BigInt(tampered[2]) + 1n).toString(); // recipient
        assert.equal(await verifyWithdrawProof(vkey, tampered, proof), false);
    }
);
