#!/usr/bin/env node
// Runs the app's real fountain code (src/file-transfer-app/fountain.ts) on
// real data: random files, frames lost at random, and checks every byte.
// Reports frames received ÷ k, the receiver's CPU time while frames arrive
// (peeling and rank checks), and the time to finish once it has enough
// (the block work of the final elimination).
//
//   node --import tsx app-decoder.mjs --k=1000,5000,10000 --runs=10 --block=450

import { FountainDecoder, FountainEncoder, mulberry32 } from '../../src/file-transfer-app/fountain.ts';

const options = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((a) => a.startsWith('--'))
        .map((a) => a.slice(2).split('='))
);
const ks = (options.k || '1000,5000,10000').split(',').map(Number);
const runs = +(options.runs || 10);
const blockSize = +(options.block || 450);
const loss = +(options.loss || 0.5);

console.log(`block ${blockSize} bytes, ${Math.round(loss * 100)}% of frames lost, ${runs} runs\n`);
console.log('| k | file size | received ÷ k mean / worst | CPU ms while receiving, mean / worst | slowest frame ms | finishing ms mean / worst |');
console.log('|---:|---:|---:|---:|---:|---:|');

for (const k of ks) {
    const received = [];
    const times = [];
    const finishes = [];
    let slowest = 0;

    for (let run = 0; run < runs; run += 1) {
        const rng = mulberry32(k * 1000 + run);
        const blocks = Array.from({ length: k }, () => {
            const block = new Uint8Array(blockSize);

            for (let i = 0; i < blockSize; i += 1) {
                block[i] = rng() * 256;
            }

            return block;
        });
        const encoder = new FountainEncoder(blocks);
        const decoder = new FountainDecoder(k);
        let total = 0;

        for (;;) {
            const seed = Math.floor(rng() * 4294967296);
            const frame = encoder.frame(seed);

            if (rng() < loss) {
                continue;
            }

            const start = process.hrtime.bigint();
            const done = decoder.add(seed, frame);
            const ms = Number(process.hrtime.bigint() - start) / 1e6;
            total += ms;
            slowest = Math.max(slowest, ms);

            if (done) {
                break;
            }
        }

        const finishStart = process.hrtime.bigint();
        const out = decoder.blocks();
        finishes.push(Number(process.hrtime.bigint() - finishStart) / 1e6);

        for (let b = 0; b < k; b += 1) {
            if (out[b].some((byte, i) => byte !== blocks[b][i])) {
                throw new Error(`Block ${b} decoded wrong (k=${k}, run ${run})`);
            }
        }

        received.push(decoder.receivedCount / k);
        times.push(total);
        process.stderr.write('.');
    }

    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(
        `| ${k} | ${((k * blockSize) / 1048576).toFixed(1)} MB | ${mean(received).toFixed(4)} / ${Math.max(...received).toFixed(4)} | ${Math.round(mean(times))} / ${Math.round(Math.max(...times))} | ${Math.round(slowest)} | ${Math.round(mean(finishes))} / ${Math.round(Math.max(...finishes))} |`
    );
}
