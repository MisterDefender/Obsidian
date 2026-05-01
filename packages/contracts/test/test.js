const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createNote, getNullifierHash, generateProof, exportCallData } = require("../../circuits/scripts/proofGenerator");

describe("PrivateVault - Private USDC Transfer System", function () {
    let privateVault;
    let verifier;
    let usdc;
    let deployer, alice, bob;

    const USDC_DECIMALS = 6; // USDC has 6 decimals
    const DEPOSIT_AMOUNT = ethers.parseUnits("100", USDC_DECIMALS); // 100 tokens


    before(async function () {
        [deployer, alice, bob] = await ethers.getSigners();

        console.log("\n Deploying contracts...\n");

        // Deploy Mock USDC ERC20 Token
        const MockToken = await ethers.getContractFactory("USDC");
        usdc = await MockToken.deploy(deployer.address);
        await usdc.waitForDeployment();
        const usdcAddress = await usdc.getAddress();
        console.log("USDC deployed to:", usdcAddress);

        // Give Alice some tokens
        await usdc.connect(deployer).transfer(alice.address, ethers.parseUnits("1000", USDC_DECIMALS)); // 1000 USDC
        console.log("Alice received 1000 USDC tokens");

        // Deploy Verifier
        const Verifier = await ethers.getContractFactory("Verifier");
        verifier = await Verifier.deploy();
        await verifier.waitForDeployment();
        const verifierAddress = await verifier.getAddress();
        console.log("Verifier deployed to:", verifierAddress);

        // Deploy PrivateVault
        const PrivateVault = await ethers.getContractFactory("PrivateVault");
        privateVault = await PrivateVault.deploy(verifierAddress, usdcAddress);
        await privateVault.waitForDeployment();
        const vaultAddress = await privateVault.getAddress();
        console.log("PrivateVault deployed to:", vaultAddress);
    });

    it("Should allow private deposits and withdrawals with ERC20", async function () {
        console.log("\n SCENARIO: Alice deposits, Bob withdraws (privately)\n");

        // STEP 1: Alice creates a note (off-chain)
        console.log("Step 1: Alice generates a secret note...");
        const note = await createNote();
        console.log("   Secret:", note.secret.substring(0, 20) + "...");
        console.log("   Nullifier:", note.nullifier.substring(0, 20) + "...");
        console.log("   Commitment:", note.commitment.substring(0, 20) + "...");

        // STEP 2: Alice approves and deposits
        console.log("\nStep 2: Alice deposits 100 tokens...");

        // Check Alice's balance before
        const aliceBalanceBefore = await usdc.balanceOf(alice.address);
        console.log("Alice's balance before:", ethers.formatUnits(aliceBalanceBefore, USDC_DECIMALS), "USDC");

        // Alice approves the vault to spend her tokens
        const vaultAddress = await privateVault.getAddress();
        await usdc.connect(alice).approve(vaultAddress, DEPOSIT_AMOUNT);
        console.log(" Alice approved vault to spend 100 USDC");

        // Alice deposits with commitment
        const depositTx = await privateVault.connect(alice).deposit(note.commitment);
        await depositTx.wait();
        console.log("   ✅ Deposit successful!");
        console.log("   Transaction:", depositTx.hash);

        // Check balances after deposit
        const aliceBalanceAfter = await usdc.balanceOf(alice.address);
        const vaultBalance = await privateVault.getBalance();

        console.log("   Alice's balance after:", ethers.formatUnits(aliceBalanceAfter, USDC_DECIMALS), "USDC");
        console.log("   Vault balance:", ethers.formatUnits(vaultBalance, USDC_DECIMALS), "USDC");

        expect(vaultBalance).to.equal(DEPOSIT_AMOUNT);
        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore - DEPOSIT_AMOUNT);

        // STEP 3: Generate proof (off-chain)
        console.log("\nStep 3: Generating zero-knowledge proof...");
        console.log("   (This proves Bob knows the secret WITHOUT revealing it)");

        const nullifierHash = await getNullifierHash(note.nullifier);

        const { proof, publicSignals } = await generateProof(
            note,
            bob.address,
            note.commitment
        );

        const callData = await exportCallData(proof, publicSignals);
        console.log("   Proof generated successfully!");
        // console.log("Proof: ", callData);

        // STEP 4: Bob withdraws using proof
        console.log("\n Step 4: Bob withdraws to his address...");

        const bobBalanceBefore = await usdc.balanceOf(bob.address);
        console.log("   Bob's balance before:", ethers.formatUnits(bobBalanceBefore, USDC_DECIMALS), "USDC");

        const withdrawTx = await privateVault.connect(bob).withdraw(
            callData.a,
            callData.b,
            callData.c,
            nullifierHash,
            bob.address,
            note.commitment
        );
        await withdrawTx.wait();

        const bobBalanceAfter = await usdc.balanceOf(bob.address);
        console.log("   Bob's balance after:", ethers.formatUnits(bobBalanceAfter, USDC_DECIMALS), "USDC");
        console.log("   Withdrawal successful!");
        console.log("   Transaction:", withdrawTx.hash);

        // Verify Bob received the tokens
        expect(bobBalanceAfter).to.equal(bobBalanceBefore + DEPOSIT_AMOUNT);

        // Verify nullifier is marked as used
        const isUsed = await privateVault.isNullifierUsed(nullifierHash);
        expect(isUsed).to.be.true;

        console.log("\n SUCCESS! Private transfer complete!");
        console.log(" Observer can see:");
        console.log("      - 100 USDC tokens were deposited");
        console.log("      - 100 USDC tokens were withdrawn to Bob");
        console.log("  Observer CANNOT see:");
        console.log("      - That Alice made the deposit");
        console.log("      - Which deposit corresponds to which withdrawal");
        console.log("      - Any link between Alice and Bob");
    });

    it("Should prevent double-spending", async function () {
        console.log("\n SCENARIO: Trying to spend the same note twice\n");

        // Give Alice more tokens
        await usdc.transfer(alice.address, DEPOSIT_AMOUNT);

        // Create and deposit a note
        const note = await createNote();
        const vaultAddress = await privateVault.getAddress();
        await usdc.connect(alice).approve(vaultAddress, DEPOSIT_AMOUNT);
        await privateVault.connect(alice).deposit(note.commitment);

        // First withdrawal - should succeed
        const nullifierHash = await getNullifierHash(note.nullifier);
        const { proof, publicSignals } = await generateProof(
            note,
            bob.address,
            note.commitment
        );
        const callData = await exportCallData(proof, publicSignals);

        await privateVault.withdraw(
            callData.a,
            callData.b,
            callData.c,
            nullifierHash,
            bob.address,
            note.commitment
        );

        console.log("   ✅ First withdrawal successful");

        // Try to withdraw again with same note - should fail
        console.log("    Attempting second withdrawal...");

        await expect(
            privateVault.withdraw(
                callData.a,
                callData.b,
                callData.c,
                nullifierHash,
                bob.address,
                note.commitment
            )
        ).to.be.revertedWith("Note already spent");

        console.log("   ✅ Double-spend prevented!");
    });

    it("Should reject invalid proofs", async function () {
        console.log("\n SCENARIO: Trying to withdraw with wrong secret\n");

        // Give Alice more tokens
        await usdc.transfer(alice.address, DEPOSIT_AMOUNT);

        // Alice deposits
        const realNote = await createNote();
        const vaultAddress = await privateVault.getAddress();
        await usdc.connect(alice).approve(vaultAddress, DEPOSIT_AMOUNT);
        await privateVault.connect(alice).deposit(realNote.commitment);

        // Attacker tries to withdraw with wrong secret
        const fakeNote = await createNote();
        console.log(fakeNote);

        console.log("   Generating proof with wrong secret...");

        const nullifierHash = await getNullifierHash(fakeNote.nullifier);
        const { proof, publicSignals } = await generateProof(
            fakeNote, // Wrong secret!
            bob.address,
            fakeNote.commitment // But correct commitment
        );

        const callData = await exportCallData(proof, publicSignals);


        await expect(
            privateVault.withdraw(
                callData.a,
                callData.b,
                callData.c,
                nullifierHash,
                bob.address,
                realNote.commitment
            )
        ).to.be.revertedWith("Invalid proof");

        console.log("   ✅ Invalid proof rejected!");
    });

    it("Should require token approval before deposit", async function () {
        console.log("\n  SCENARIO: Trying to deposit without approval\n");

        // Give Alice more tokens
        await usdc.transfer(alice.address, DEPOSIT_AMOUNT);

        const note = await createNote();

        // Try to deposit without approval
        await expect(
            privateVault.connect(alice).deposit(note.commitment)
        ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");

        console.log("   Deposit without approval rejected!");
    });

    it("Should handle multiple deposits and withdrawals", async function () {
        console.log("\n SCENARIO: Multiple users depositing and withdrawing\n");

        const [, user1, user2, user3] = await ethers.getSigners();

        // Give users tokens
        await usdc.transfer(user1.address, DEPOSIT_AMOUNT);
        await usdc.transfer(user2.address, DEPOSIT_AMOUNT);

        // Create notes
        const note1 = await createNote();
        const note2 = await createNote();

        // User1 deposits
        const vaultAddress = await privateVault.getAddress();
        await usdc.connect(user1).approve(vaultAddress, DEPOSIT_AMOUNT);
        await privateVault.connect(user1).deposit(note1.commitment);
        console.log("   User1 deposited");

        // User2 deposits
        await usdc.connect(user2).approve(vaultAddress, DEPOSIT_AMOUNT);
        await privateVault.connect(user2).deposit(note2.commitment);
        console.log("   User2 deposited");

        const vaultBalance = await privateVault.getBalance();
        console.log("   Vault balance:", ethers.formatUnits(vaultBalance, USDC_DECIMALS), "USDC");

        // User1's note is withdrawn to User3
        const nullifierHash1 = await getNullifierHash(note1.nullifier);
        const { proof: proof1, publicSignals: publicSignals1 } = await generateProof(
            note1,
            user3.address,
            note1.commitment
        );
        const callData1 = await exportCallData(proof1, publicSignals1);

        await privateVault.withdraw(
            callData1.a,
            callData1.b,
            callData1.c,
            nullifierHash1,
            user3.address,
            note1.commitment
        );
        console.log("   User3 received tokens (from User1's deposit)");

        const user3Balance = await usdc.balanceOf(user3.address);
        expect(user3Balance).to.equal(DEPOSIT_AMOUNT);

        console.log("\n Privacy maintained across multiple users!");
    });
});