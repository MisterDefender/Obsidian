const { ethers, deployments } = require("hardhat");
const fs = require('fs');
const path = require('path');
const {
    startTimer,
    endTimer,
    getDuration,
    getFormattedDuration,
    getAllTimings,
    printTimingSummary,
    saveTimingLog
} = require('../../circuits/scripts/throughput.checker.js');

const STORAGE_FILE = path.join(__dirname, '../../circuits/Proofs/proofs.json');
const TEST_TIMING_FILE = path.join(__dirname, '../../circuits/Proofs/test-timing-logs.json');

// Load proof data from JSON file
function loadProofData() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            return JSON.parse(data);
        } else {
            throw new Error(`Proofs file not found at ${STORAGE_FILE}. Please run the proof generation script first.`);
        }
    } catch (error) {
        console.error('Error loading proof data:', error.message);
        throw error;
    }
}

// Get a specific note by ID or get the latest note
function getNote(proofData, noteId = null) {
    if (!proofData.notes || proofData.notes.length === 0) {
        throw new Error('No notes found in the proofs file.');
    }

    if (noteId) {
        const note = proofData.notes.find(n => n.id === noteId);
        if (!note) {
            throw new Error(`Note with ID ${noteId} not found.`);
        }
        return note;
    }

    return proofData.notes[proofData.notes.length - 1];
}

async function main() {
    const startTime = new Date();
    
    console.log(' Starting Private Vault Test with Timing\n');
    console.log(`Start Time: ${startTime.toISOString()}\n`);

    startTimer('total_test_execution');

    // Deploy contracts and get instances
    startTimer('01_contract_setup');
    const usdcAddress = (await deployments.get("USDC")).address;
    const zkVerifierAddress = (await deployments.get("Groth-16-ZK-Verifier")).address;
    const privateVaultAddress = (await deployments.get("Private-USDC-Vault")).address;

    const usdc = await ethers.getContractAt("USDC", usdcAddress);
    const privateVault = await ethers.getContractAt("PrivateVault", privateVaultAddress);
    const zkVerifier = await ethers.getContractAt("Verifier", zkVerifierAddress);
    endTimer('01_contract_setup');

    console.log("=== Deployed Contracts Addresses ===");
    console.log(`USDC: ${usdcAddress}`);
    console.log(`ZK-Verifier: ${zkVerifierAddress}`);
    console.log(`Private-USDC-Vault: ${privateVaultAddress}`);
    console.log(`Setup Time: ${getFormattedDuration('01_contract_setup')}\n`);

    const USDC_DECIMALS = 6;
    const DEPOSIT_AMOUNT = ethers.parseUnits("100", USDC_DECIMALS);

    const [admin, alice, bob] = await ethers.getSigners();

    // Load proof data from JSON
    startTimer('02_load_proof_data');
    console.log("=== Loading Proof Data from JSON ===");
    const proofData = loadProofData();
    const noteData = getNote(proofData);
    endTimer('02_load_proof_data');
    
    console.log(`Total notes in storage: ${proofData.notes.length}`);
    console.log(`Using Note ID: ${noteData.id}`);
    console.log(`Timestamp: ${noteData.timestamp}`);
    console.log(`Load Time: ${getFormattedDuration('02_load_proof_data')}\n`);

    // Transfer tokens to Alice
    console.log("=== Setting up Alice's Balance ===");
    const aliceBalanceBefore = await usdc.balanceOf(alice.address);
    console.log("Alice USDC balance before: ", ethers.formatUnits(aliceBalanceBefore, USDC_DECIMALS));

    startTimer('03_transfer_tokens_to_alice');
    const tx0 = await usdc.connect(admin).transfer(alice.address, DEPOSIT_AMOUNT * BigInt(100));
    const receipt0 = await tx0.wait();
    endTimer('03_transfer_tokens_to_alice');
    
    console.log("Token transferred - Status: ", receipt0?.status === 1 ? "✓ Success" : "✗ Failed");
    console.log(`Transfer Time: ${getFormattedDuration('03_transfer_tokens_to_alice')}`);
    console.log(`Gas Used: ${receipt0.gasUsed.toString()}\n`);

    const aliceBalanceAfter = await usdc.balanceOf(alice.address);
    console.log("Alice USDC balance after: ", ethers.formatUnits(aliceBalanceAfter, USDC_DECIMALS));

    // Alice approves vault
    console.log("\n=== Alice Approving Vault ===");
    startTimer('04_alice_approve_vault');
    const tx1 = await usdc.connect(alice).approve(privateVaultAddress, DEPOSIT_AMOUNT);
    const receipt1 = await tx1.wait();
    endTimer('04_alice_approve_vault');
    
    console.log("Approval - Status: ", receipt1?.status === 1 ? "✓ Success" : "✗ Failed");
    console.log(`Approval Time: ${getFormattedDuration('04_alice_approve_vault')}`);
    console.log(`Gas Used: ${receipt1.gasUsed.toString()}\n`);

    // Deposit with commitment
    console.log("=== Alice Depositing with Commitment ===");
    console.log("Commitment:", noteData.note.commitment.substring(0, 20) + "...");
    
    startTimer('05_alice_deposit');
    const tx2 = await privateVault.connect(alice).deposit(noteData.note.commitment);
    const receipt2 = await tx2.wait();
    endTimer('05_alice_deposit');
    
    console.log("Deposit - Status: ", receipt2.status === 1 ? "✓ Success" : "✗ Failed");
    console.log(`Deposit Time: ${getFormattedDuration('05_alice_deposit')}`);
    console.log(`Transaction Hash: ${receipt2.hash}`);
    console.log(`Gas Used: ${receipt2.gasUsed.toString()}\n`);

    const aliceBalanceAfterDeposit = await usdc.balanceOf(alice.address);
    console.log("Alice USDC balance after deposit: ", ethers.formatUnits(aliceBalanceAfterDeposit, USDC_DECIMALS));

    // Prepare withdrawal
    console.log("\n=== Preparing Withdrawal ===");
    startTimer('06_prepare_withdrawal');
    const callData = noteData.proof.solidityCallData;
    const recipientAddress = "0x" + BigInt(noteData.recipient).toString(16).padStart(40, '0');
    endTimer('06_prepare_withdrawal');
    
    console.log("Nullifier Hash:", noteData.nullifierHash.substring(0, 20) + "...");
    console.log(`Proof recipient: ${recipientAddress}`);
    console.log(`Bob's address: ${bob.address}`);
    console.log(`Preparation Time: ${getFormattedDuration('06_prepare_withdrawal')}\n`);

    // Bob withdraws
    console.log("=== Bob Withdrawing with ZK Proof ===");
    const bobBalanceBefore = await usdc.balanceOf(bob.address);
    console.log("Bob USDC balance before: ", ethers.formatUnits(bobBalanceBefore, USDC_DECIMALS));

    startTimer('07_bob_withdraw');
    const tx3 = await privateVault.connect(bob).withdraw(
        callData.a, 
        callData.b, 
        callData.c, 
        noteData.nullifierHash, 
        recipientAddress,
        noteData.note.commitment
    );
    const receipt3 = await tx3.wait();
    endTimer('07_bob_withdraw');
    
    console.log("\nWithdrawal - Status: ", receipt3.status === 1 ? "✓ Success" : "✗ Failed");
    console.log(`Withdrawal Time: ${getFormattedDuration('07_bob_withdraw')}`);
    console.log(`Transaction Hash: ${receipt3.hash}`);
    console.log(`Gas Used: ${receipt3.gasUsed.toString()}\n`);

    const bobBalanceAfter = await usdc.balanceOf(bob.address);
    console.log("Bob USDC balance after: ", ethers.formatUnits(bobBalanceAfter, USDC_DECIMALS));

    if (recipientAddress.toLowerCase() !== bob.address.toLowerCase()) {
        const recipientBalance = await usdc.balanceOf(recipientAddress);
        console.log(`Actual recipient (${recipientAddress}) balance: `, ethers.formatUnits(recipientBalance, USDC_DECIMALS));
    }

    endTimer('total_test_execution');
    
    console.log("\n✅ Test Completed Successfully!");
    
    // Print comprehensive timing summary
    const totalTime = printTimingSummary('TRANSACTION TIMING SUMMARY');
    
    // Prepare detailed timing log
    const timingLog = {
        test_id: `test_${Date.now()}`,
        timestamp: startTime.toISOString(),
        note_id: noteData.id,
        operations: getAllTimings(),
        gas_usage: {
            transfer_to_alice: receipt0.gasUsed.toString(),
            alice_approval: receipt1.gasUsed.toString(),
            alice_deposit: receipt2.gasUsed.toString(),
            bob_withdrawal: receipt3.gasUsed.toString(),
            total_gas: (receipt0.gasUsed + receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed).toString()
        },
        total_time_ms: totalTime,
        total_time_seconds: parseFloat((totalTime / 1000).toFixed(3)),
        transactions: {
            transfer: receipt0.hash,
            approval: receipt1.hash,
            deposit: receipt2.hash,
            withdrawal: receipt3.hash
        }
    };
    
    // Save timing log
    saveTimingLog(TEST_TIMING_FILE, timingLog, 'test_runs');
    
    // Print gas summary
    console.log('💰 GAS USAGE SUMMARY');
    console.log('='.repeat(70));
    console.log(`${'Transfer to Alice'.padEnd(45)}: ${receipt0.gasUsed.toString().padStart(10)} gas`);
    console.log(`${'Alice Approval'.padEnd(45)}: ${receipt1.gasUsed.toString().padStart(10)} gas`);
    console.log(`${'Alice Deposit'.padEnd(45)}: ${receipt2.gasUsed.toString().padStart(10)} gas`);
    console.log(`${'Bob Withdrawal (with ZK proof)'.padEnd(45)}: ${receipt3.gasUsed.toString().padStart(10)} gas`);
    console.log('-'.repeat(70));
    const totalGas = receipt0.gasUsed + receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed;
    console.log(`${'TOTAL GAS USED'.padEnd(45)}: ${totalGas.toString().padStart(10)} gas`);
    console.log('='.repeat(70) + '\n');
    
    process.exit(0);
}

if (require.main === module) {
    main().catch(error => {
        console.error("\n❌ Error:", error.message);
        console.error(error);
        process.exit(1);
    });
}

module.exports = { main, loadProofData, getNote };