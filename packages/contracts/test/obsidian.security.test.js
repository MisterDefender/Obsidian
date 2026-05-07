const { expect } = require('chai');
const { ethers, deployments } = require('hardhat');
const {
    FIELD_SIZE,
    getPoseidon,
    MerkleTree,
    generateNote,
    generateWithdrawProof,
} = require('./helpers/zk.cjs');

const LEVELS = 20;
const DENOMINATION = 100n * 10n ** 6n;

describe('Obsidian — security & edge cases', function () {
    this.timeout(600000);

    let usdc, vault, poseidon, verifierAddr, poseidonAddr;
    let deployer, alice, bob, relayer;

    beforeEach(async function () {
        await deployments.fixture(['main']);
        [deployer, alice, bob, relayer] = await ethers.getSigners();

        usdc = await ethers.getContractAt('USDC', (await deployments.get('USDC')).address);
        vault = await ethers.getContractAt(
            'ObsidianVault',
            (await deployments.get('ObsidianVault')).address
        );
        verifierAddr = (await deployments.get('Verifier')).address;
        poseidonAddr = (await deployments.get('Poseidon')).address;
        poseidon = await getPoseidon();

        await usdc.connect(deployer).transfer(alice.address, DENOMINATION * 50n);
    });

    async function depositTo(v, token, note, who = alice) {
        await token.connect(who).approve(await v.getAddress(), DENOMINATION);
        return v.connect(who).deposit(note.commitment);
    }

    it('withdraws an interior (non-last) leaf', async function () {
        const notes = [await generateNote(), await generateNote(), await generateNote()];
        const tree = new MerkleTree(LEVELS, poseidon);
        for (const n of notes) {
            await depositTo(vault, usdc, n);
            tree.insert(n.commitment);
        }

        const idx = 1; // middle leaf
        const mp = tree.proof(idx);
        expect(mp.root).to.equal(await vault.getLastRoot());

        const { solidity } = await generateWithdrawProof({
            note: notes[idx],
            merkleProof: mp,
            recipient: bob.address,
            relayer: ethers.ZeroAddress,
            fee: 0n,
        });

        await vault
            .connect(bob)
            .withdraw(
                solidity.a,
                solidity.b,
                solidity.c,
                mp.root,
                notes[idx].nullifierHash,
                bob.address,
                ethers.ZeroAddress,
                0n
            );
        expect(await usdc.balanceOf(bob.address)).to.equal(DENOMINATION);
    });

    it('accepts a previous root that is still within history', async function () {
        const noteA = await generateNote();
        const treeA = new MerkleTree(LEVELS, poseidon);
        await depositTo(vault, usdc, noteA);
        treeA.insert(noteA.commitment);
        const rootA = treeA.proof(0).root;

        // a second deposit advances the current root
        const noteB = await generateNote();
        await depositTo(vault, usdc, noteB);

        expect(await vault.getLastRoot()).to.not.equal(rootA);
        expect(await vault.isKnownRoot(rootA)).to.equal(true);

        const mpA = treeA.proof(0);
        const { solidity } = await generateWithdrawProof({
            note: noteA,
            merkleProof: mpA,
            recipient: bob.address,
            relayer: ethers.ZeroAddress,
            fee: 0n,
        });

        await vault
            .connect(bob)
            .withdraw(
                solidity.a,
                solidity.b,
                solidity.c,
                rootA,
                noteA.nullifierHash,
                bob.address,
                ethers.ZeroAddress,
                0n
            );
        expect(await usdc.balanceOf(bob.address)).to.equal(DENOMINATION);
    });

    it('rejects a root evicted from history', async function () {
        const noteA = await generateNote();
        const treeA = new MerkleTree(LEVELS, poseidon);
        await depositTo(vault, usdc, noteA);
        treeA.insert(noteA.commitment);
        const rootA = treeA.proof(0).root;

        // 30 more deposits (ROOT_HISTORY_SIZE) evict rootA from the ring buffer
        for (let i = 0; i < 30; i++) {
            const n = await generateNote();
            await depositTo(vault, usdc, n);
        }
        expect(await vault.isKnownRoot(rootA)).to.equal(false);

        const mpA = treeA.proof(0);
        const { solidity } = await generateWithdrawProof({
            note: noteA,
            merkleProof: mpA,
            recipient: bob.address,
            relayer: ethers.ZeroAddress,
            fee: 0n,
        });

        await expect(
            vault
                .connect(bob)
                .withdraw(
                    solidity.a,
                    solidity.b,
                    solidity.c,
                    rootA,
                    noteA.nullifierHash,
                    bob.address,
                    ethers.ZeroAddress,
                    0n
                )
        ).to.be.revertedWithCustomError(vault, 'UnknownRoot');
    });

    it('allows fee == denomination (recipient gets zero, relayer gets all)', async function () {
        const note = await generateNote();
        const tree = new MerkleTree(LEVELS, poseidon);
        await depositTo(vault, usdc, note);
        tree.insert(note.commitment);
        const mp = tree.proof(0);

        const { solidity } = await generateWithdrawProof({
            note,
            merkleProof: mp,
            recipient: bob.address,
            relayer: relayer.address,
            fee: DENOMINATION,
        });

        const relayerBefore = await usdc.balanceOf(relayer.address);
        await vault
            .connect(relayer)
            .withdraw(
                solidity.a,
                solidity.b,
                solidity.c,
                mp.root,
                note.nullifierHash,
                bob.address,
                relayer.address,
                DENOMINATION
            );

        expect(await usdc.balanceOf(bob.address)).to.equal(0n);
        expect(await usdc.balanceOf(relayer.address)).to.equal(relayerBefore + DENOMINATION);
    });

    it('treats root 0 as unknown', async function () {
        expect(await vault.isKnownRoot(0)).to.equal(false);
    });

    it('rejects a deposit commitment outside the field', async function () {
        await usdc.connect(alice).approve(await vault.getAddress(), DENOMINATION);
        await expect(
            vault.connect(alice).deposit(FIELD_SIZE)
        ).to.be.revertedWithCustomError(vault, 'CommitmentOutOfField');
    });

    it('blocks reentrancy via a malicious token (ReentrancyGuard)', async function () {
        // a vault backed by a token that re-enters deposit() on the payout transfer
        const Evil = await ethers.getContractFactory('ReentrantToken');
        const evil = await Evil.deploy();
        await evil.waitForDeployment();

        const Vault = await ethers.getContractFactory('ObsidianVault');
        const evilVault = await Vault.deploy(
            verifierAddr,
            poseidonAddr,
            await evil.getAddress(),
            DENOMINATION,
            LEVELS
        );
        await evilVault.waitForDeployment();

        const note = await generateNote();
        const tree = new MerkleTree(LEVELS, poseidon);
        await evil.connect(deployer).approve(await evilVault.getAddress(), DENOMINATION);
        await evilVault.connect(deployer).deposit(note.commitment);
        tree.insert(note.commitment);
        const mp = tree.proof(0);

        const { solidity } = await generateWithdrawProof({
            note,
            merkleProof: mp,
            recipient: bob.address,
            relayer: ethers.ZeroAddress,
            fee: 0n,
        });

        await evil.setTarget(await evilVault.getAddress());
        await evil.setAttack(true);

        await expect(
            evilVault
                .connect(bob)
                .withdraw(
                    solidity.a,
                    solidity.b,
                    solidity.c,
                    mp.root,
                    note.nullifierHash,
                    bob.address,
                    ethers.ZeroAddress,
                    0n
                )
        ).to.be.reverted; // ReentrancyGuardReentrantCall bubbles up through the transfer
    });
});
