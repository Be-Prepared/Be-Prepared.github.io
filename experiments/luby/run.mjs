#!/usr/bin/env node

import { RobustSoliton16 } from './encoder/robust-soliton-16.mjs';
import { Sequential16 } from './encoder/sequential-16.mjs';
import { Soliton } from './encoder/soliton.mjs';
import { Soliton16 } from './encoder/soliton-16.mjs';
import { Soliton16PlusSingles } from './encoder/soliton-16-plus-singles.mjs';

import { NoDupes } from './decoder/no-dupes.mjs';
import { Standard } from './decoder/standard.mjs';
import { StandardKeyed } from './decoder/standard-keyed.mjs';

const encoders = {
    "robust-soliton-16": RobustSoliton16,
    soliton: Soliton,
    "soliton-16": Soliton16,
    "soliton-16-plus-singles": Soliton16PlusSingles,
    "sequential-16": Sequential16,
};
const decoders = {
    standard: Standard,
    "standard-keyed": StandardKeyed,
    "no-dupes": NoDupes,
};

function showHelpList(items) {
    let text = '';

    for (const [short, item] of Object.entries(items)) {
        text += `\n\n * ${short} = ${item.name}`;

        for (const [key, value] of Object.entries(item.options)) {
            text += `\n    --${key}=...\t${value}`;
        }
    }

    return text;
}

function showHelp() {
    console.log(`Test Luby Transform Codes

Specify both an encoder and a decoder and the number of runs. If the encoder or
decoder takes options, make sure to pass them as --option=value.

Sample: Use Soliton with 50,000 blocks, standard decoder, 1000 runs
    node run.mjs soliton --k=50000 standard 1000

Global Options:

    --k=...\tNumber of blocks to transfer
    --debug\tShows some additional debug information
    --loss=...\tNumber from 0 (default) to 1 indicating chance of transfer failure.

Encoders:${showHelpList(encoders)}

Decoders:${showHelpList(decoders)}`);
}

function makeInstance(JsClass, options) {
    const args = [];

    for (const key of Object.keys(JsClass.options)) {
        if (!options[key]) {
            console.error(`Option --${key} invalid or not specified`);
            process.exit(1);
        }

        args.push(options[key]);
    }

    return new JsClass(...args);
}

function round(n) {
    return n.toFixed(6).replace(/\.?0+$/, '');
}

function showStats(name, numbers, vsLabel, vsSize) {
    let total = 0;

    for (const n of numbers) {
        total += n;
    }

    const avg = total / numbers.length;
    let diffSquared = 0;

    for (const n of numbers) {
        const diff = Math.abs(avg - n);
        diffSquared = diff * diff;
    }

    const stdDev = Math.sqrt(diffSquared / numbers.length);
    const bits = [
        name,
        `Min: ${round(Math.min(...numbers))}`,
        `Avg: ${round(avg)}`,
        `Max: ${round(Math.max(...numbers))}`,
        `StdDev: ${round(stdDev)}`
    ];

    if (vsSize) {
        bits.push(`${vsLabel}: ${round(avg / vsSize - 1)}`);
    }

    console.log(bits.join(' \t'));
}

const args = [];
const options = {};

for (const k of [...process.argv].slice(2)) {
    if (k.startsWith('--')) {
        const [key, value] = k.substr(2).split('=');
        options[key] = value ?? true;
    } else {
        args.push(k);
    }
}

if (options.debug) {
    console.log(args);
    console.log(options);
}

if (options['help']) {
    showHelp();
    process.exit(0);
}

if (args.length < 3) {
    console.error('Need to specify both the encoder and decoder and the number of runs');
    console.error('Use --help for information');
    process.exit();
}

const EncoderClass = encoders[args[0]];
const DecoderClass = decoders[args[1]];
const maxRuns = Math.floor(+args[2]);
const loss = Math.max(0, Math.min(1, +(options.loss || 0)));

if (!EncoderClass) {
    console.error('Invalid encoder');
}

if (!DecoderClass) {
    console.error('Invalid decoder');
}

if (maxRuns < 1) {
    console.error('Invalid number of runs');
}

if (!EncoderClass || !DecoderClass || maxRuns < 1) {
    process.exit(1);
}

// Done making sure things look good. Let's get to work!
console.log('Process start:', new Date().toISOString());
console.log(`Total runs: ${maxRuns}`);
console.log(`Encoder: ${args[0]}`);
console.log(`Decoder: ${args[1]}`);
console.log(`options: ${JSON.stringify(options)}`);
console.log(`loss: ${loss}`);

const encoderInstance = makeInstance(EncoderClass, options);
let totalBlocks = 0;
let blockCounts = [];
let totalMaxQueueSizes = 0;
let maxQueueSizes = [];
let totalTimes = 0;
let times = [];

for (let run = 1; run <= maxRuns; run += 1) {
    const decoderInstance = makeInstance(DecoderClass, options);
    let blockCount = 0;
    let maxQueueSize = 0;
    let lastResult = false;
    const startTime = process.hrtime();

    while (!decoderInstance.isDecoded()) {
        // lost blocks don't count
        while (Math.random() < loss) {
            encoderInstance.indices();
        }

        blockCount += 1;
        const indices = encoderInstance.indices();
        decoderInstance.addIndices(indices);
        maxQueueSize = Math.max(maxQueueSize, decoderInstance.queueSize());
    }

    const endTime = process.hrtime();
    const elapsed = endTime[0] + (endTime[1] / 1000000000) - startTime[0] - startTime[1] / 1000000000;
    totalBlocks += blockCount;
    blockCounts.push(blockCount);
    totalMaxQueueSizes += maxQueueSize;
    maxQueueSizes.push(maxQueueSize);
    totalTimes += elapsed;
    times.push(elapsed);
    const avgBlockCount = totalBlocks / run;
    const avgMaxQueueSize = totalMaxQueueSizes / run;
    const avgTime = totalTimes / run;

    if (options.debug) {
        console.log({
            run,
            maxRuns,
            encoder: args[0],
            decoder: args[1],
            blockCount: blockCount,
            avgBlockCount,
            avgMaxQueueSize,
            avgTime,
        });
    } else {
        process.stderr.write(`\rRun ${run}/${maxRuns}`);
    }
}

console.log('');
showStats('Block count', blockCounts, 'AvgOverhead', +options.k);
showStats('Max queue size', maxQueueSizes);
showStats('Time', times);
