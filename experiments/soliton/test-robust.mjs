#!/usr/bin/env node

import { showProbabilities, runTests } from './test-lib.mjs';

function helpAndExit() {
    console.error('Usage: test-robust.mjs <type> <blocks> <spike> <failure>');
    console.error(
        "  <type> can be 'collected' or 'truncated'"
    );
    console.error('  <spike> makes another spike at <blocks>/<spike>');
    console.error('  <failure> is a probability of failure between 0 and 1');

    process.exit(1);
}

function idealSoliton(i, K) {
    if (i === 1) {
        return 1 / K;
    }

    return 1 / (i * (i - 1));
}

function robustSoliton(i, K, R, d) {
    const threshold = Math.floor(K / R);

    if (i < threshold) {
        return idealSoliton(i, K) + (R / (K * i));
    }

    if (i === threshold) {
        return idealSoliton(i, K) + (R * Math.log(R / d)) / K;
    }

    return idealSoliton(i, K);
}

function getProbabilitiesTruncated(K, c, d) {
    const R = c * Math.sqrt(K) * Math.log(K / d);
    const probabilities = [];

    while (probabilities.length < 16) {
        probabilities.push(robustSoliton(probabilities.length + 1, K, R, d));
    }

    // Normalize probabilities
    const sum = probabilities.reduce((a, b) => a + b, 0);

    for (let j = 0; j < probabilities.length; j++) {
        probabilities[j] /= sum;
    }

    // Convert to cumulative probabilities
    for (let j = 1; j < probabilities.length; j++) {
        probabilities[j] += probabilities[j - 1];
    }

    return probabilities;
}

function getProbabilitiesCollected(K, c, d) {
    const r = c * Math.sqrt(K) * Math.log(K / d);

    let probabilityRemainder = 1 - 1 / K;
    const probabilities = [1 / K];

    while (probabilities.length < 15) {
        let i = probabilities.length + 1;
        const nextProbability = 1 / (i * (i - 1));
        probabilities.push(nextProbability);
        probabilityRemainder -= nextProbability;
    }

    probabilities.push(probabilityRemainder);

    return probabilities;
}

function getProbabilities(type, blocks, spike, failure) {
    switch (process.argv[2]) {
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
    const spike = parseFloat(process.argv[4]);
    const failure = parseFloat(process.argv[5]);

    if (isNaN(blocks) || blocks <= 0) {
        console.error('Error: <blocks> must be a positive integer.');
        helpAndExit();
    }

    if (isNaN(spike) || spike < 0) {
        console.error('Error: <spike> must be a non-negative number.');
        helpAndExit();
    }

    if (isNaN(failure) || failure < 0 || failure > 1) {
        console.error('Error: <failure> must be a number between 0 and 1.');
        helpAndExit();
    }

    const probabilities = getProbabilities(process.argv[2], blocks, spike, failure);

    console.log('Block size:', blocks);
    console.log('Spike:', spike);
    console.log('Failure probability:', failure);
    console.log('');
    console.log('Robust Distribution Probabilities:');
    showProbabilities(probabilities);
    runTests(probabilities, blocks);
}

main();

