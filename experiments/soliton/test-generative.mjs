#!/usr/bin/env node

import { showProbabilities, runTests } from './test-lib.mjs';
import { promises as fsPromises } from 'fs';

function helpAndExit() {
    console.error('Usage: test-generative.mjs <blocks> <iterations>');
    process.exit(1);
}

function evaluate(numbers, blocks, iterations) {
    // Convert numbers to cumulative probabilities
    const probabilities = [];
    let total = 0;
    for (let i = 0; i < numbers.length; i++) {
        total += numbers[i];
        probabilities.push(total);
    }

    // Normalize probabilities
    for (let i = 0; i < probabilities.length; i++) {
        probabilities[i] /= total;
    }

    console.log('');
    console.log('Generative Probabilities, block size :', blocks);
    showProbabilities(probabilities);
    return runTests(probabilities, blocks, iterations);
}

async function readJson(filename) {
    const data = await fsPromises.readFile(filename, 'utf8');
    return JSON.parse(data);
}

async function main() {
    if (process.argv.length < 3) {
        helpAndExit();
    }

    const blocks = parseInt(process.argv[2], 10);
    const iterations = parseInt(process.argv[3], 10);
    let bestNumbers;

    try {
        bestNumbers = await readJson('generative.json');
    } catch (_ignore) {
        bestNumbers = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    }

    const numberMin = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const numberMax = [
        10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000,
        10000, 10000, 10000, 10000, 10000, 10000,
    ];
    let generation = 0;
    const min = 0;
    const max = 100;
    const minStep = 1;
    const maxStep = 10;
    console.log('Baseline (generation 0)');
    let bestScore = evaluate(bestNumbers, blocks, iterations);

    while (true) {
        const numbers = [...bestNumbers];
        const index = Math.floor(Math.random() * numbers.length);
        const step =
            Math.floor(Math.random() * (maxStep - minStep + 1)) + minStep;

        // Increase or decrease the selected number
        if (Math.random() < 0.5) {
            numbers[index] = Math.max(numberMin[index], numbers[index] - step);
        } else {
            numbers[index] = Math.min(numberMax[index], numbers[index] + step);
        }

        generation += 1;
        console.log('Generation:', generation);
        const score = evaluate(numbers, blocks, iterations);
        console.log('Best Score:', bestScore);

        if (score < bestScore) {
            console.log('New Best Score:', score);
            bestScore = score;
            bestNumbers = numbers;
            await fsPromises.writeFile(
                'generative.json',
                JSON.stringify(bestNumbers, null, 2)
            );
        } else {
            console.log('No Improvement:', score);
        }
    }
}

main();
