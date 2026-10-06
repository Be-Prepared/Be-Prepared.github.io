// Monte Carlo comparison of location averaging estimators.
//
//   node --import tsx experiments/averaging/run.mjs --runs=500
//
// Options: --runs=N, --seed=N, --cases=open60,urban60 (see CASES),
// --estimators=current,proposed (see ESTIMATORS).

import * as est from './estimators.mjs';
import { makeRng, SCENARIOS, simulate } from './sim.mjs';

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, '').split('=');
        return [k, v ?? 'true'];
    })
);
const runs = +(args.runs || 500);
const seed = +(args.seed || 1);

const CASES = {
    open10: ['open', 10],
    open60: ['open', 60],
    open120: ['open', 120],
    urban10: ['urban', 10],
    urban60: ['urban', 60],
    urban120: ['urban', 120],
    openFast60: ['openFast', 60],
    openSlow60: ['openSlow', 60],
};

let shipped = null;

try {
    // The implementation in the app, loaded through tsx.
    const mod = await import('../../src/location-app/location-average-math.ts');
    const R = 6378137;
    shipped = (fixes) => {
        const r = mod.averageSamples(
            fixes.map((f) => ({
                x: R,
                y: f.east,
                z: f.north,
                accuracy: f.accuracy,
                timestamp: f.t * 1000,
            }))
        );
        return {
            e: r.y,
            n: r.z,
            r95: r.radius95,
            used: r.usedCount ?? fixes.length,
            rejected: r.rejectedCount ?? 0,
        };
    };
} catch (e) {
    console.error('Could not load the app module (run with --import tsx):', e.message);
}

// Picked by tune.mjs on a different seed. The app implements this.
const HYBRID = { sigma: 'maxRobust', tauMin: 20, beta: 0.05, unbias: true, warmupSec: 0, batchSec: Infinity };

const ESTIMATORS = {
    current: est.current,
    mean: est.plainMean,
    median: est.medianIid,
    weighted: est.weightedIid,
    meanBatch: est.meanBatch,
    meanSokal: est.meanSokal,
    huberBatch: (f) => est.robustBatch(f, { kind: 'huber' }),
    tukeyBatch: (f) => est.robustBatch(f, { kind: 'tukey' }),
    huberAccBatch: (f) => est.robustBatch(f, { kind: 'huber', weights: 'invvar' }),
    hybrid: (f) => est.hybrid(f, HYBRID),
    // What each part contributes.
    '+ drop first minute': (f) => est.hybrid(f, { ...HYBRID, warmupSec: 60 }),
    '+ batch means floor': (f) => est.hybrid(f, { ...HYBRID, batchSec: 300 }),
    '- accuracy gate': (f) => est.hybrid(f, { ...HYBRID, gate: 0 }),
    'Tukey not Huber': (f) => est.hybrid(f, { ...HYBRID, kind: 'tukey' }),
    '- scatter correction': (f) => est.hybrid(f, { ...HYBRID, unbias: false }),
    '- bias share': (f) => est.hybrid(f, { ...HYBRID, beta: 0 }),
    '10 min correlation': (f) => est.hybrid(f, { ...HYBRID, tauMin: 10 }),
    '30 min correlation': (f) => est.hybrid(f, { ...HYBRID, tauMin: 30 }),
    ...(shipped ? { app: shipped } : {}),
};

const caseNames = args.cases ? args.cases.split(',') : Object.keys(CASES);
const estNames = args.estimators ? args.estimators.split(',') : Object.keys(ESTIMATORS);

const quantile = (a, q) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const fmt = (x, d = 2) => (isFinite(x) ? x.toFixed(d) : '∞');

for (const caseName of caseNames) {
    const [scenarioName, minutes] = CASES[caseName];
    const scenario = SCENARIOS[scenarioName];
    const stats = Object.fromEntries(estNames.map((n) => [n, { err: [], r: [], hit: 0, rej: 0, used: 0 }]));

    for (let run = 0; run < runs; run += 1) {
        const rng = makeRng(seed * 1000003 + run * 7919 + caseNames.indexOf(caseName));
        const fixes = simulate(rng, scenario, minutes * 60);

        for (const name of estNames) {
            const r = ESTIMATORS[name](fixes);
            const err = Math.hypot(r.e, r.n);
            const s = stats[name];
            s.err.push(err);
            s.r.push(r.r95);
            s.hit += err <= r.r95 ? 1 : 0;
            s.rej += r.rejected / (r.used + r.rejected);
            s.used += r.used;
        }
    }

    console.log(`\n### ${scenario.label}, ${minutes} min (${caseName}, ${runs} runs)\n`);
    console.log('| Estimator | Median error (m) | 95th pct error (m) | Coverage of 95% radius | Median radius (m) | Fixes rejected |');
    console.log('|---|---:|---:|---:|---:|---:|');
    for (const name of estNames) {
        const s = stats[name];
        console.log(
            `| ${name} | ${fmt(quantile(s.err, 0.5))} | ${fmt(quantile(s.err, 0.95))} | ${fmt((100 * s.hit) / runs, 1)}% | ${fmt(quantile(s.r, 0.5))} | ${fmt((100 * s.rej) / runs, 1)}% |`
        );
    }
}
