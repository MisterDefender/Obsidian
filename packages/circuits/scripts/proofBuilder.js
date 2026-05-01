import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    createNote,
    getNullifierHash,
    generateProof,
    exportCallData
} from './proofGenerator.js';
import {
    startTimer,
    endTimer,
    getDuration,
    getAllTimings,
    printTimingSummary,
    saveTimingLog
} from './throughput.checker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_FILE = path.join(__dirname, '../Proofs/proofs.json');
const TIMING_FILE = path.join(__dirname, '../Proofs/timing-logs.json');
const RECIPIENT = '0x9DD815288163ac2A89af1EB68aec13387FE4f210';

// Load existing data from JSON file
function loadData() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading data:', error.message);
    }
    return { notes: [] };
}

// Save data to JSON file
function saveData(data) {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log(`✓ Data saved to ${STORAGE_FILE}`);
    } catch (error) {
        console.error('Error saving data:', error.message);
    }
}

// Check if note already exists
function noteExists(notes, commitment) {
    return notes.some(note => note.commitment === commitment);
}

// Generate a unique ID
function generateId() {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate recipient address BigInt
function generateRecipient() {
    return BigInt(RECIPIENT);
}

// generate and store note proof
async function generateAndStoreNoteProof() {
    const startTime = new Date();
    
    console.log('🚀 Starting note proof generation...\n');
    console.log(`Start Time: ${startTime.toISOString()}\n`);

    startTimer('total_operation');
    
    // Load data
    startTimer('1_load_data');
    const data = loadData();
    endTimer('1_load_data');
    console.log(`✓ Data loaded (${getDuration('1_load_data').toFixed(2)}ms)`);
    
    // Create new note
    startTimer('2_create_note');
    console.log('\n📝 Creating new note...');
    const note = await createNote();
    endTimer('2_create_note');
    console.log('✓ Note created:');
    console.log(`  Commitment: ${note.commitment}`);
    console.log(`  Time taken: ${getDuration('2_create_note').toFixed(2)}ms`);
    
    // Check if note already exists
    startTimer('3_check_duplicate');
    if (noteExists(data.notes, note.commitment)) {
        console.log('\n⚠️  Note with this commitment already exists. Skipping...');
        return;
    }
    endTimer('3_check_duplicate');
    
    // Calculate nullifier hash
    startTimer('4_nullifier_hash');
    console.log('\n🔐 Calculating nullifier hash...');
    const nullifierHash = await getNullifierHash(note.nullifier);
    endTimer('4_nullifier_hash');
    console.log(`✓ Nullifier Hash: ${nullifierHash}`);
    console.log(`  Time taken: ${getDuration('4_nullifier_hash').toFixed(2)}ms`);
    
    // Generate recipient
    startTimer('5_generate_recipient');
    const recipient = generateRecipient();
    endTimer('5_generate_recipient');
    console.log(`\n👤 Recipient: ${recipient}`);
    console.log(`  Time taken: ${getDuration('5_generate_recipient').toFixed(2)}ms`);
    
    // Generate proof
    startTimer('6_generate_proof');
    console.log('\n🔒 Generating zero-knowledge proof...');
    try {
        const { proof, publicSignals } = await generateProof(note, recipient, note.commitment);
        endTimer('6_generate_proof');
        console.log('✓ Proof generated successfully!');
        console.log(`  Time taken: ${getDuration('6_generate_proof').toFixed(2)}ms`);
        
        // Export proof to Solidity format
        startTimer('7_export_calldata');
        console.log('\n📤 Exporting proof to Solidity format...');
        const callData = await exportCallData(proof, publicSignals);
        endTimer('7_export_calldata');
        console.log(`✓ CallData exported`);
        console.log(`  Time taken: ${getDuration('7_export_calldata').toFixed(2)}ms`);
        
        // Create note object
        startTimer('8_create_note_object');
        const noteData = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            note: {
                secret: note.secret,
                nullifier: note.nullifier,
                commitment: note.commitment
            },
            nullifierHash,
            recipient: recipient.toString(),
            proof: {
                raw: proof,
                publicSignals,
                solidityCallData: callData
            },
            timing: {
                created_at: startTime.toISOString(),
                proof_generation_ms: getDuration('6_generate_proof')
            }
        };
        endTimer('8_create_note_object');
        
        // Add to data array and save
        startTimer('9_save_to_storage');
        data.notes.push(noteData);
        saveData(data);
        endTimer('9_save_to_storage');
        console.log(`  Time taken: ${getDuration('9_save_to_storage').toFixed(2)}ms`);
        
        endTimer('total_operation');
        
        console.log('\n✅ Note proof generated and stored successfully!');
        console.log(`   ID: ${noteData.id}`);
        console.log(`   Total notes: ${data.notes.length}`);
        
        // Print timing summary
        const totalTime = printTimingSummary('PROOF GENERATION TIMING');
        
        // Save timing log
        const timingLog = {
            note_id: noteData.id,
            timestamp: startTime.toISOString(),
            operations: getAllTimings(),
            total_time_ms: totalTime,
            total_time_seconds: parseFloat((totalTime / 1000).toFixed(3))
        };
        saveTimingLog(TIMING_FILE, timingLog, 'runs');
        
    } catch (error) {
        endTimer('6_generate_proof');
        console.error('\n❌ Error generating proof:', error.message);
        throw error;
    }
}

// Main execution
(async () => {
    try {
        await generateAndStoreNoteProof();
        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
})();

// Export functions for use in other scripts
export {
    loadData,
    saveData,
    generateAndStoreNoteProof
};