const { expect } = require('chai');
const { ethers, deployments } = require('hardhat');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');
const {
    getPoseidon,
    MerkleTree,
    generateNote,
    generateWithdrawProof,
} = require('./helpers/zk.cjs');

const LEVELS = 20;
const DENOMINATION = 100n * 10n ** 6n; // 100 USDC

describe('Obsidian shielded vault', function () {
    this.timeout(300000); // zk proof generation is slow

    let usdc, vault, poseidon;
    let deployer, alice, bob, relayer;

    beforeEach(async function () {
        await deployments.fixture(['main']);
        [deployer, alice, bob, relayer] = await ethers.getSigners();

        usdc = await ethers.getContractAt('USDC', (await deployments.get('USDC')).address);
        vault = await ethers.getContractAt(
            'ObsidianVault',
            (await deployments.get('ObsidianVault')).address
        );
        poseidon = await getPoseidon();

        // fund alice so she can deposit
        await usdc.connect(deployer).transfer(alice.address, DENOMINATION * 10n);
    });

    async function deposit(note, depositor = alice) {
        await usdc.connect(depositor).approve(await vault.getAddress(), DENOMINATION);
        return vault.connect(depositor).deposit(note.commitment);
    }

    describe('Poseidon equivalence (critical gate)', function () {
        it('on-chain hashLeftRight matches the circuit Poseidon', async function () {
            const a = 12345n;
            const b = 67890n;
            const onChain = await vault.hashLeftRight(a, b);
            const offChain = poseidon.F.toObject(poseidon([a, b]));
            expect(onChain).to.equal(offChain);
        });

        it('empty-tree root matches the JS tree', async function () {
            const tree = new MerkleTree(LEVELS, poseidon);
            expect(await vault.getLastRoot()).to.equal(tree.root());
        });
    });

    describe('deposit', function () {
        it('inserts a leaf, advances the tree, and pulls tokens', async function () {
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);
            tree.insert(note.commitment);

            await expect(deposit(note))
                .to.emit(vault, 'Deposit')
                .withArgs(note.commitment, 0, anyValue);

            expect(await vault.nextIndex()).to.equal(1);
            expect(await vault.getLastRoot()).to.equal(tree.root());
            expect(await vault.getBalance()).to.equal(DENOMINATION);
        });

        it('rejects a duplicate commitment', async function () {
            const note = await generateNote();
            await deposit(note);
            await usdc.connect(alice).approve(await vault.getAddress(), DENOMINATION);
            await expect(
                vault.connect(alice).deposit(note.commitment)
            ).to.be.revertedWithCustomError(vault, 'CommitmentAlreadyUsed');
        });
    });

    describe('withdraw', function () {
        it('pays the recipient and the relayer fee with a valid proof', async function () {
            const fee = 2n * 10n ** 6n; // 2 USDC
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);

            await deposit(note);
            tree.insert(note.commitment);
            const merkleProof = tree.proof(0);
            expect(merkleProof.root).to.equal(await vault.getLastRoot());

            const { solidity } = await generateWithdrawProof({
                note,
                merkleProof,
                recipient: bob.address,
                relayer: relayer.address,
                fee,
            });

            const bobBefore = await usdc.balanceOf(bob.address);
            const relayerBefore = await usdc.balanceOf(relayer.address);

            await expect(
                vault
                    .connect(relayer)
                    .withdraw(
                        solidity.a,
                        solidity.b,
                        solidity.c,
                        merkleProof.root,
                        note.nullifierHash,
                        bob.address,
                        relayer.address,
                        fee
                    )
            )
                .to.emit(vault, 'Withdrawal')
                .withArgs(bob.address, note.nullifierHash, relayer.address, fee);

            expect(await usdc.balanceOf(bob.address)).to.equal(bobBefore + (DENOMINATION - fee));
            expect(await usdc.balanceOf(relayer.address)).to.equal(relayerBefore + fee);
            expect(await vault.isSpent(note.nullifierHash)).to.equal(true);
        });

        it('supports a self-withdraw (no relayer, zero fee)', async function () {
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);
            await deposit(note);
            tree.insert(note.commitment);
            const merkleProof = tree.proof(0);

            const { solidity } = await generateWithdrawProof({
                note,
                merkleProof,
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
                    merkleProof.root,
                    note.nullifierHash,
                    bob.address,
                    ethers.ZeroAddress,
                    0n
                );

            expect(await usdc.balanceOf(bob.address)).to.equal(DENOMINATION);
        });

        it('prevents double-spend (reused nullifier)', async function () {
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);
            await deposit(note);
            tree.insert(note.commitment);
            const merkleProof = tree.proof(0);

            const { solidity } = await generateWithdrawProof({
                note,
                merkleProof,
                recipient: bob.address,
                relayer: ethers.ZeroAddress,
                fee: 0n,
            });

            const args = [
                solidity.a,
                solidity.b,
                solidity.c,
                merkleProof.root,
                note.nullifierHash,
                bob.address,
                ethers.ZeroAddress,
                0n,
            ];
            await vault.connect(bob).withdraw(...args);
            await expect(vault.connect(bob).withdraw(...args)).to.be.revertedWithCustomError(
                vault,
                'NoteAlreadySpent'
            );
        });

        it('rejects an unknown root', async function () {
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);
            await deposit(note);
            tree.insert(note.commitment);
            const merkleProof = tree.proof(0);
            const { solidity } = await generateWithdrawProof({
                note,
                merkleProof,
                recipient: bob.address,
                relayer: ethers.ZeroAddress,
                fee: 0n,
            });

            const bogusRoot = 123456789n;
            await expect(
                vault
                    .connect(bob)
                    .withdraw(
                        solidity.a,
                        solidity.b,
                        solidity.c,
                        bogusRoot,
                        note.nullifierHash,
                        bob.address,
                        ethers.ZeroAddress,
                        0n
                    )
            ).to.be.revertedWithCustomError(vault, 'UnknownRoot');
        });

        it('rejects a tampered recipient (proof no longer valid)', async function () {
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);
            await deposit(note);
            tree.insert(note.commitment);
            const merkleProof = tree.proof(0);
            // proof commits to recipient = bob
            const { solidity } = await generateWithdrawProof({
                note,
                merkleProof,
                recipient: bob.address,
                relayer: ethers.ZeroAddress,
                fee: 0n,
            });

            // but we submit recipient = relayer
            await expect(
                vault
                    .connect(bob)
                    .withdraw(
                        solidity.a,
                        solidity.b,
                        solidity.c,
                        merkleProof.root,
                        note.nullifierHash,
                        relayer.address,
                        ethers.ZeroAddress,
                        0n
                    )
            ).to.be.revertedWithCustomError(vault, 'InvalidProof');
        });

        it('rejects a fee greater than the denomination', async function () {
            const note = await generateNote();
            const tree = new MerkleTree(LEVELS, poseidon);
            await deposit(note);
            tree.insert(note.commitment);
            const merkleProof = tree.proof(0);
            const { solidity } = await generateWithdrawProof({
                note,
                merkleProof,
                recipient: bob.address,
                relayer: relayer.address,
                fee: 0n,
            });

            await expect(
                vault
                    .connect(relayer)
                    .withdraw(
                        solidity.a,
                        solidity.b,
                        solidity.c,
                        merkleProof.root,
                        note.nullifierHash,
                        bob.address,
                        relayer.address,
                        DENOMINATION + 1n
                    )
            ).to.be.revertedWithCustomError(vault, 'FeeExceedsDenomination');
        });
    });
});
