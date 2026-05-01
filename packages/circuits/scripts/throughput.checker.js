const fs = require('fs');

// Store timings
const timings = {};

/**
 * Start timing an operation
 */
function startTimer(label) {
    timings[label] = {
        start: performance.now(),
        end: null,
        duration: null
    };
}

/**
 * End timing an operation
 */
function endTimer(label) {
    if (timings[label]) {
        timings[label].end = performance.now();
        timings[label].duration = timings[label].end - timings[label].start;
        return timings[label].duration;
    }
    return null;
}

/**
 * Get duration of a specific operation
 */
function getDuration(label) {
    return timings[label]?.duration || 0;
}

/**
 * Get formatted duration for a specific operation
 */
function getFormattedDuration(label) {
    const duration = getDuration(label);
    return `${(duration / 1000).toFixed(3)}s`;
}

/**
 * Get all timings
 */
function getAllTimings() {
    const result = {};
    for (const [label, timing] of Object.entries(timings)) {
        result[label] = {
            duration_ms: parseFloat(timing.duration.toFixed(2)),
            duration_seconds: parseFloat((timing.duration / 1000).toFixed(3))
        };
    }
    return result;
}

/**
 * Print timing summary
 */
function printTimingSummary(title = 'TIMING SUMMARY') {
    console.log('\n' + '='.repeat(70));
    console.log(`⏱️  ${title}`);
    console.log('='.repeat(70));
    
    const allTimings = getAllTimings();
    let totalTime = 0;
    
    for (const [label, timing] of Object.entries(allTimings)) {
        const labelFormatted = label
            .replace(/_/g, ' ')
            .replace(/^\d+_/, '')
            .replace(/\b\w/g, l => l.toUpperCase());
        console.log(`${labelFormatted.padEnd(45)}: ${String(timing.duration_seconds).padStart(8)}s (${Math.round(timing.duration_ms)}ms)`);
        totalTime += timing.duration_ms;
    }
    
    console.log('-'.repeat(70));
    console.log(`${'TOTAL TIME'.padEnd(45)}: ${(totalTime / 1000).toFixed(3).padStart(8)}s (${Math.round(totalTime)}ms)`);
    console.log('='.repeat(70) + '\n');
    
    return totalTime;
}

/**
 * Reset all timings
 */
function resetTimings() {
    Object.keys(timings).forEach(key => delete timings[key]);
}

/**
 * Calculate statistics from multiple runs
 */
function calculateStatistics(runs) {
    if (!runs || runs.length === 0) return {};

    const stats = {};
    const operations = Object.keys(runs[0].operations);
    
    for (const op of operations) {
        const durations = runs.map(run => run.operations[op].duration_ms);
        stats[op] = {
            average_ms: parseFloat((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)),
            min_ms: parseFloat(Math.min(...durations).toFixed(2)),
            max_ms: parseFloat(Math.max(...durations).toFixed(2)),
            runs: durations.length
        };
    }
    
    const totalDurations = runs.map(run => run.total_time_ms);
    stats.total = {
        average_ms: parseFloat((totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length).toFixed(2)),
        min_ms: parseFloat(Math.min(...totalDurations).toFixed(2)),
        max_ms: parseFloat(Math.max(...totalDurations).toFixed(2)),
        runs: totalDurations.length
    };
    
    return stats;
}

/**
 * Print statistics summary
 */
function printStatistics(statistics) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 PERFORMANCE STATISTICS (Multiple Runs)');
    console.log('='.repeat(70));
    
    const operationKeys = Object.keys(statistics).filter(key => key !== 'total');
    
    for (const op of operationKeys) {
        const stat = statistics[op];
        const labelFormatted = op
            .replace(/_/g, ' ')
            .replace(/^\d+_/, '')
            .replace(/\b\w/g, l => l.toUpperCase());
        
        console.log(`${labelFormatted}:`);
        console.log(`  Average: ${(stat.average_ms / 1000).toFixed(3)}s | Min: ${(stat.min_ms / 1000).toFixed(3)}s | Max: ${(stat.max_ms / 1000).toFixed(3)}s`);
    }
    
    if (statistics.total) {
        console.log('-'.repeat(70));
        console.log(`Total Execution Time:`);
        console.log(`  Average: ${(statistics.total.average_ms / 1000).toFixed(3)}s | Min: ${(statistics.total.min_ms / 1000).toFixed(3)}s | Max: ${(statistics.total.max_ms / 1000).toFixed(3)}s`);
        console.log(`  Based on ${statistics.total.runs} runs`);
    }
    
    console.log('='.repeat(70) + '\n');
}

/**
 * Save timing log to a JSON file
 */
function saveTimingLog(filepath, timingData, runsKey = 'runs') {
    try {
        let logs = { [runsKey]: [] };
        
        if (fs.existsSync(filepath)) {
            const existingData = fs.readFileSync(filepath, 'utf8');
            logs = JSON.parse(existingData);
        }
        
        logs[runsKey].push(timingData);
        
        if (logs[runsKey].length > 1) {
            logs.statistics = calculateStatistics(logs[runsKey]);
        }
        
        fs.writeFileSync(filepath, JSON.stringify(logs, null, 2), 'utf8');
        console.log(`✓ Timing log saved to ${filepath}`);
        
        if (logs.statistics) {
            printStatistics(logs.statistics);
        }
    } catch (error) {
        console.error('Error saving timing log:', error.message);
    }
}

// CommonJS exports
module.exports = {
    startTimer,
    endTimer,
    getDuration,
    getFormattedDuration,
    getAllTimings,
    printTimingSummary,
    resetTimings,
    saveTimingLog,
    calculateStatistics,
    printStatistics
};