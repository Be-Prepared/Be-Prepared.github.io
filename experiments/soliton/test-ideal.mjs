#!/usr/bin/env node

import { showProbabilities, runTests } from './test-lib.mjs';

function helpAndExit() {
    console.error('Usage: test-ideal.mjs <type> <blocks>');
    console.error(
        "  <type> can be 'collected' or 'truncated'"
    );
    process.exit(1);
}

function getProbabilitiesTruncated(K) {
    let probabilitySum = 0; // Exclude first probability
    const probabilities = [1 / K];

    while (probabilities.length < 16) {
        let i = probabilities.length + 1;
        const nextProbability = 1 / (i * (i - 1));
        probabilities.push(probabilities[probabilities.length - 1] + nextProbability);
        probabilitySum += nextProbability;
    }

    // Scale all probabilities except the first one
    const scale = 1 / probabilitySum;

    for (let j = 1; j < probabilities.length; j++) {
        probabilities[j] *= scale;
    }

    return probabilities;
}

function getProbabilitiesCollected(K) {
    const probabilities = [1 / K];

    while (probabilities.length < 15) {
        let i = probabilities.length + 1;
        const nextProbability = 1 / (i * (i - 1));
        probabilities.push(probabilities[probabilities.length - 1] + nextProbability);
    }

    probabilities.push(1);

    return probabilities;
}

function getProbabilities(type, blocks) {
    switch (type) {
        case 'collected':
            return getProbabilitiesCollected(blocks);
        case 'truncated':
            return getProbabilitiesTruncated(blocks);
        default:
            console.error('Error: <type> is invalid');
            helpAndExit();
    }
}

function main() {
    if (process.argv.length < 3) {
        helpAndExit();
    }

    const blocks = parseInt(process.argv[3], 10);

    if (isNaN(blocks) || blocks <= 0) {
        console.error('Error: <blocks> must be a positive integer.');
        helpAndExit();
    }

    const probabilities = getProbabilities(process.argv[2], blocks);

    console.log('Block size:', blocks);
    console.log('');
    console.log('Ideal Distribution Probabilities:');
    showProbabilities(probabilities);
    runTests(probabilities, blocks);
}

main();
