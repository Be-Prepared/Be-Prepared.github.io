#!/usr/bin/env node

import { showProbabilities, runTests } from './test-lib.mjs';
import { promises as fsPromises } from 'fs';

function helpAndExit() {
    console.error(
        'Usage: test-generative.mjs <blocks> <iterations> <filename>'
    );
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
    console.log('Generative Probabilities, block count:', blocks);
    showProbabilities(probabilities);
    return runTests(probabilities, blocks, iterations);
}

async function readJson(filename) {
    const data = await fsPromises.readFile(filename, 'utf8');
    return JSON.parse(data);
}

function makeChanges(numbers) {
    const min = 0;
    const max = 128;
    const minStep = 1;
    const maxStep = 5;
    const numberMin = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const numberMax = [
        128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128,
        128, 128,
    ];
    let changeCount = Math.floor(Math.random() * 3) + 1;

    while (changeCount-- > 0) {
        const index = Math.floor(Math.random() * numbers.length);
        const step =
            Math.floor(Math.random() * (maxStep - minStep + 1)) + minStep;

        // Increase or decrease the selected number
        if (Math.random() < 0.5) {
            numbers[index] = Math.max(numberMin[index], numbers[index] - step);
        } else {
            numbers[index] = Math.min(numberMax[index], numbers[index] + step);
        }
    }
}

async function main() {
    if (process.argv.length < 5) {
        helpAndExit();
    }

    const blocks = parseInt(process.argv[2], 10);
    const iterations = parseInt(process.argv[3], 10);
    const filename = process.argv[4];
    let bestNumbers;

    try {
        bestNumbers = await readJson(filename);
    } catch (_ignore) {
        bestNumbers = [];

        while (bestNumbers.length < 16) {
            bestNumbers.push(Math.floor(Math.random() * 128) + 1);
        }
    }

    let generation = 0;
    console.log('Baseline (generation 0)');
    let bestScore = evaluate(bestNumbers, blocks, iterations);

    while (true) {
        const numbers = [...bestNumbers];
        makeChanges(numbers);
        generation += 1;
        console.log('Generation:', generation);
        const score = evaluate(numbers, blocks, iterations);
        console.log('Best Score:', bestScore);

        if (score < bestScore) {
            console.log('New Best Score:', score);
            bestScore = score;
            bestNumbers = numbers;
            await fsPromises.writeFile(
                filename,
                JSON.stringify(bestNumbers, null, 2)
            );
        } else {
            console.log('No Improvement:', score);
        }
    }
}

main();
