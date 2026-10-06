// Grid search for the hybrid estimator's prior on a training seed. The
// results quoted in README.md come from run.mjs with a different seed.
//
//   node experiments/averaging/tune.mjs --runs=200 --seed=2
import { hybrid } from './estimators.mjs';
import { makeRng, SCENARIOS, simulate } from './sim.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const runs = +(args.runs || 200);
const seed = +(args.seed || 2);
const cases = [['open', 10], ['open', 60], ['open', 120], ['urban', 10], ['urban', 60], ['urban', 120]];
const data = cases.map(([s, m], ci) =>
    Array.from({ length: runs }, (_, run) => simulate(makeRng(seed * 1000003 + run * 7919 + ci + 17), SCENARIOS[s], m * 60))
);
const grid = [];
for (const sigma of (args.sigma || 'max,maxRobust').split(','))
    for (const tauMin of (args.tau || '20,30,40').split(',').map(Number))
        for (const beta of (args.beta || '0,0.05,0.1').split(',').map(Number))
            grid.push({ sigma, tauMin, beta, unbias: args.unbias === '1' });
const rows = [];
for (const opts of grid) {
    const cov = [], rad = [];
    data.forEach((list) => {
        let hit = 0;
        const r = [];
        for (const fixes of list) {
            const res = hybrid(fixes, opts);
            const err = Math.hypot(res.e, res.n);
            hit += err <= res.r95;
            r.push(res.r95);
        }
        r.sort((a, b) => a - b);
        cov.push((100 * hit) / list.length);
        rad.push(r[r.length >> 1]);
    });
    const worst = Math.max(...cov.map((c) => Math.abs(c - 95)));
    rows.push({ ...opts, worst, cov, rad });
}
rows.sort((a, b) => a.worst - b.worst);
for (const r of rows.slice(0, 25)) {
    console.log(`${r.sigma}\ttau=${r.tauMin}\tbeta=${r.beta}\tworst=${r.worst.toFixed(1)}\tcov=${r.cov.map((c) => c.toFixed(0)).join('/')}\trad=${r.rad.map((c) => c.toFixed(1)).join('/')}`);
}
