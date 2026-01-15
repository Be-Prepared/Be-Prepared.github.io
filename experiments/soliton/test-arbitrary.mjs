#!/usr/bin/env node

import { showProbabilities, runTests } from './test-lib.mjs';

function helpAndExit() {
    console.error('Usage: test-arbitrary.mjs <blocks> <chance1> ... <chance16>');
    console.error(
        "  <chance1> through <chance16> are normalized into probabilities"
    );
    process.exit(1);
}

function main() {
    if (process.argv.length < 19) {
        helpAndExit();
    }

    const blocks = parseInt(process.argv[2], 10);
    const probabilities = [];

    for (let i = 3; i < 19; i++) {
        probabilities.push(parseFloat(process.argv[i]));
    }

    // Normalize probabilities
    const total = probabilities.reduce((a, b) => a + b, 0);
    for (let i = 0; i < probabilities.length; i++) {
        probabilities[i] /= total;
    }

    // Convert to cumulative probabilities
    for (let i = 1; i < probabilities.length; i++) {
        probabilities[i] += probabilities[i - 1];
    }

    console.log('Block size:', blocks);
    console.log('');
    console.log('Arbitrary Probabilities:');
    showProbabilities(probabilities);
    runTests(probabilities, blocks);
}

main();
