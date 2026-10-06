#!/usr/bin/env node
// How each frame strategy holds up when most frames are lost or the
// receiver starts late. Reports, per channel:
//
// * received ÷ k: frames the receiver actually decoded before the file
//   could be rebuilt. For strategies whose frames are independent and
//   identically distributed, this doesn't depend on the channel at all.
// * shown ÷ k: frames the sender had to display (time).
// * worst case: the largest value over all runs, since a transfer is only
//   as good as its bad days.
// * inactivated: how many blocks an inactivation decoder must solve by
//   elimination at the end. Decode work grows with the cube of this.
//
//   node robust.mjs --k=1000 --runs=200
//   node robust.mjs --k=5000 --runs=40 --strategies=seeded,app

import { decodable, decodableByInactivation } from './lib/decoder.mjs';
import * as distributions from './lib/distributions.mjs';
import * as baseEncoders from './lib/encoders.mjs';
import { mulberry32 } from './lib/prng.mjs';
import { parseChannel } from './lib/channels.mjs';

const encoders = {
    ...baseEncoders,
    mixed5: (k, table, rng) => baseEncoders.mixed(k, table, rng, 0.05),
};
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
const runs = +(options.runs || 100);
const seed = +(options.seed || 2026);
const channels = (
    options.channels ||
    'perfect,iid:0.25,iid:0.5,iid:0.75,iid:0.9,late:3:0.25,burst:0.5:30'
).split(',');

const ALL = {
    app: { name: 'Today: cap 16, peel', encoder: 'random', table: () => distributions.app(), decoder: 'peel' },
    seeded: {
        name: 'Seeded robust soliton, peel+GE',
        encoder: 'random',
        table: () => distributions.robustSoliton(k, 0.03, 0.5),
        decoder: 'peel+ge',
    },
    'seeded-peel': {
        name: 'Seeded robust soliton, peel only',
        encoder: 'random',
        table: () => distributions.robustSoliton(k, 0.03, 0.5),
        decoder: 'peel',
    },
    'seeded-wide': {
        name: 'Seeded robust soliton (c=0.1), peel+GE',
        encoder: 'random',
        table: () => distributions.robustSoliton(k, 0.1, 0.5),
        decoder: 'peel+ge',
    },
    'systematic-dense': {
        name: 'Systematic + dense repair, peel+GE',
        encoder: 'systematicDense',
        table: () => null,
        decoder: 'peel+ge',
    },
    mixed: {
        name: 'Seeded robust soliton + 2% dense frames, peel+GE',
        encoder: 'mixed',
        table: () => distributions.robustSoliton(k, 0.03, 0.5),
        decoder: 'peel+ge',
    },
    'mixed-5': {
        name: 'Seeded robust soliton + 5% dense frames, peel+GE',
        encoder: 'mixed5',
        table: () => distributions.robustSoliton(k, 0.03, 0.5),
        decoder: 'peel+ge',
    },
    dense: { name: 'Dense (random linear), GE', encoder: 'dense', table: () => null, decoder: 'peel+ge' },
};
// --densities=0.2,0.25 compares dense frames holding 20%, 25%, ... of all
// blocks (2% of frames dense, as in the app).
const densityStrategies = options.densities
    ? options.densities.split(',').map((d) => ({
          name: `Seeded + 2% dense frames, each holding ${Math.round(+d * 100)}% of blocks`,
          encoder: (k, table, rng) => baseEncoders.mixed(k, table, rng, 0.02, +d),
          table: () => distributions.robustSoliton(k, 0.03, 0.5),
          decoder: 'peel+ge',
      }))
    : null;
const strategies = densityStrategies || (
    options.strategies || (k <= 2000 ? Object.keys(ALL).join(',') : 'app,seeded,seeded-wide,mixed,mixed-5,systematic-dense')
)
    .split(',')
    .map((id) => ALL[id]);

function run(strategy, channelSpec, runSeed) {
    const rng = mulberry32(runSeed);
    const encoder = typeof strategy.encoder === 'function' ? strategy.encoder : encoders[strategy.encoder];
    const nextFrame = encoder(k, strategy.table(), rng);
    const channel = parseChannel(channelSpec, mulberry32(runSeed ^ 0x5bd1e995), k);
    const received = [];
    const shownAt = [];
    let shown = 0;
    const take = (n) => {
        while (received.length < n) {
            const indices = nextFrame();
            shown += 1;

            if (channel()) {
                received.push(indices);
                shownAt.push(shown);
            }
        }
    };
    // Peel-only is what the app does today. Everything else uses exact
    // (maximum likelihood) decoding via inactivation.
    const check = (n) =>
        strategy.decoder === 'peel'
            ? decodable(received, n, k, 'peel')
            : decodableByInactivation(received, n, k);
    let low = k - 1;
    let high = k;

    for (;;) {
        take(high);

        if (check(high).ok) {
            break;
        }

        low = high;
        high = Math.ceil(high * 1.2);

        if (high > k * 100) {
            throw new Error('Did not decode within 100k received frames');
        }
    }

    while (high - low > 1) {
        const mid = (low + high) >>> 1;

        if (check(mid).ok) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const result = check(high);

    return {
        inactive: result.inactive || 0,
        received: high,
        shown: shownAt[high - 1],
    };
}

const stats = (values) => {
    const sorted = [...values].sort((a, b) => a - b);

    return {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p99: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))],
        max: sorted[sorted.length - 1],
    };
};
const f = (x) => x.toFixed(3);

console.log(`k=${k} runs=${runs} seed=${seed}\n`);

for (const strategy of strategies) {
    console.log(`### ${strategy.name}\n`);
    console.log('| Channel | received ÷ k mean / worst | extra frames mean / p99 / worst | shown ÷ k mean / p99 / worst | ideal shown ÷ k | inactivated mean / worst |');
    console.log('|---|---:|---:|---:|---:|---:|');

    for (const channel of channels) {
        const results = [];

        for (let r = 0; r < runs; r += 1) {
            results.push(run(strategy, channel, seed + r * 7919));
            process.stderr.write('.');
        }

        const received = stats(results.map((r) => r.received / k));
        const shown = stats(results.map((r) => r.shown / k));
        const inactive = stats(results.map((r) => r.inactive));
        const extra = stats(results.map((r) => r.received - k));
        const [name, a, b] = channel.split(':');
        const loss = name === 'perfect' ? 0 : name === 'late' ? +b : +a;
        const ideal = (name === 'late' ? +a : 0) + 1 / (1 - loss);

        console.log(
            `| ${channel} | ${f(received.mean)} / ${f(received.max)} | ${extra.mean.toFixed(1)} / ${extra.p99} / ${extra.max} | ${f(shown.mean)} / ${f(shown.p99)} / ${f(shown.max)} | ${f(ideal)} | ${Math.round(inactive.mean)} / ${inactive.max} |`
        );
    }

    console.log('');
    process.stderr.write('\n');
}
