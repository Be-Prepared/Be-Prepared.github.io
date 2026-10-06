#!/usr/bin/env node
// Measures how many frames a sender must show before the receiver can
// rebuild the file, for combinations of encoder, degree distribution,
// decoder, and channel. See README.md.
//
//   node sim.mjs --k=1000 --runs=50
//   node sim.mjs --k=5000 --runs=20 --only=app

import * as distributions from './lib/distributions.mjs';
import * as encoders from './lib/encoders.mjs';
import { decodable } from './lib/decoder.mjs';
import { mulberry32 } from './lib/prng.mjs';
import { parseChannel } from './lib/channels.mjs';

const options = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((a) => a.startsWith('--'))
        .map((a) => {
            const [key, value] = a.slice(2).split('=');

            return [key, value ?? 'true'];
        })
);
const k = +(options.k || 1000);
const runs = +(options.runs || 50);
const seed = +(options.seed || 1337);
const channels = (options.channels || 'perfect,iid:0.1,iid:0.3,burst:0.2:8').split(',');

// Strategies to compare. Each is a name, how frames are built, and how the
// receiver decodes.
const strategies = [
    { name: 'app: random, cap 16, peel', encoder: 'random', dist: 'app', decoder: 'peel' },
    { name: 'app: random, cap 16, peel+GE', encoder: 'random', dist: 'app', decoder: 'peel+ge' },
    { name: 'robust cap 16, peel', encoder: 'random', dist: 'robust16', decoder: 'peel' },
    { name: 'robust cap 16, peel+GE', encoder: 'random', dist: 'robust16', decoder: 'peel+ge' },
    { name: 'systematic + app, peel', encoder: 'systematic', dist: 'app', decoder: 'peel' },
    { name: 'systematic + app, peel+GE', encoder: 'systematic', dist: 'app', decoder: 'peel+ge' },
    { name: 'seeded robust (no cap), peel', encoder: 'random', dist: 'robust', decoder: 'peel' },
    { name: 'seeded robust (no cap), peel+GE', encoder: 'random', dist: 'robust', decoder: 'peel+ge' },
    { name: 'systematic + robust (no cap), peel+GE', encoder: 'systematic', dist: 'robust', decoder: 'peel+ge' },
    { name: 'systematic + dense repair, peel+GE', encoder: 'systematicDense', dist: 'none', decoder: 'peel+ge' },
    { name: 'carousel + dense every 4th, peel+GE', encoder: 'carouselDense', dist: 'none', decoder: 'peel+ge' },
    // Dense everywhere makes the receiver eliminate over all k blocks, which
    // is too slow to simulate (and decode on a phone) for large files.
    ...(k <= 2000
        ? [{ name: 'dense (random linear), GE', encoder: 'dense', dist: 'none', decoder: 'peel+ge' }]
        : []),
].filter((s) => !options.only || s.name.includes(options.only));

function table(dist) {
    switch (dist) {
        case 'app':
            return distributions.app();

        case 'robust16':
            return distributions.robustSoliton(k, 0.04, 0.01, 16);

        case 'robust':
            return distributions.robustSoliton(k, 0.03, 0.5);

        case 'none':
            return null;

        default:
            throw new Error(dist);
    }
}

// Plays frames through the channel until `n` have been received.
function stream(strategy, channelSpec, runSeed) {
    const rng = mulberry32(runSeed);
    const nextFrame = encoders[strategy.encoder](k, table(strategy.dist), rng);
    const channel = parseChannel(channelSpec, mulberry32(runSeed ^ 0x5bd1e995));
    const received = [];
    const shownAt = [];
    let shown = 0;

    return (n) => {
        while (received.length < n) {
            const indices = nextFrame();
            shown += 1;

            if (channel()) {
                received.push(indices);
                shownAt.push(shown);
            }
        }

        return { received, shownAt };
    };
}

// Smallest number of received frames that decodes. Decodability only gets
// better with more frames, so search: double until it works, then bisect.
function framesNeeded(strategy, channelSpec, runSeed) {
    const take = stream(strategy, channelSpec, runSeed);
    let low = k - 1;
    let high = k;
    let result;

    for (;;) {
        const { received } = take(high);
        result = decodable(received, high, k, strategy.decoder);

        if (result.ok) {
            break;
        }

        low = high;
        high = Math.ceil(high * 1.25);

        if (high > k * 50) {
            throw new Error('Did not decode within 50k frames');
        }
    }

    while (high - low > 1) {
        const mid = (low + high) >>> 1;
        const { received } = take(mid);

        if (decodable(received, mid, k, strategy.decoder).ok) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const { received, shownAt } = take(high);
    // How much elimination the receiver needed at the finish: a rough
    // measure of decode work on a phone.
    const peelOnly = decodable(received, high, k, 'peel');

    return { shown: shownAt[high - 1], residual: peelOnly.residual };
}

function summarize(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

    return {
        mean,
        p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
        std: Math.sqrt(variance),
    };
}

const fmt = (x) => x.toFixed(3);

console.log(`k=${k} runs=${runs} seed=${seed}`);
console.log(
    `Mean degree: app ${fmt(distributions.meanDegree(table('app')))}, ` +
        `robust16 ${fmt(distributions.meanDegree(table('robust16')))}, ` +
        `robust ${fmt(distributions.meanDegree(table('robust')))}`
);
console.log('');
console.log('Frames shown ÷ k (lower is better; the ideal is 1 ÷ (1 − loss)).');
console.log('');
console.log(
    `| Strategy | ${channels.map((c) => `${c} mean / p95`).join(' | ')} | GE size (${channels[Math.min(1, channels.length - 1)]}) |`
);
console.log(`|---|${channels.map(() => '---:').join('|')}|---:|`);

for (const strategy of strategies) {
    const cells = [];
    let residualNote = '';

    for (const channel of channels) {
        const shown = [];
        const residuals = [];

        for (let run = 0; run < runs; run += 1) {
            const result = framesNeeded(strategy, channel, seed + run * 7919);
            shown.push(result.shown / k);
            residuals.push(result.residual);
        }

        const s = summarize(shown);
        cells.push(`${fmt(s.mean)} / ${fmt(s.p95)}`);

        if (channel === channels[Math.min(1, channels.length - 1)]) {
            residualNote = strategy.decoder === 'peel' ? '—' : `${Math.round(summarize(residuals).mean)}`;
        }

        process.stderr.write('.');
    }

    console.log(`| ${strategy.name} | ${cells.join(' | ')} | ${residualNote} |`);
}

process.stderr.write('\n');
