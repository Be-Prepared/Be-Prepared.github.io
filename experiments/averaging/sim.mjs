// Synthetic stream of browser geolocation fixes for a phone that is not
// moving. Everything is in a local east/north frame in meters with the true
// position at (0, 0); time is in seconds, one fix per second.
//
// The position the browser hands out is the sum of:
//
// * a slow error (orbit, clock, ionosphere, troposphere residuals and
//   quasi-static multipath): first-order Gauss-Markov, time constant of tens
//   of minutes to hours, so an hour of data barely sees it change;
// * a medium error (multipath and satellite geometry changes): Gauss-Markov,
//   minutes to tens of minutes;
// * a fast error (the receiver's own navigation filter): Gauss-Markov,
//   seconds;
// * white noise;
// * a convergence error at the start that decays over tens of seconds;
// * multipath / NLOS episodes: the fix jumps tens of meters away for
//   seconds to a minute, with a short ramp because the receiver filters;
// * dropouts, where no fix arrives at all.
//
// The reported accuracy (a 68% radius) is only loosely related to the truth:
// each device has its own calibration factor, it wobbles slowly, it is
// rounded to whole meters, it rises during convergence, and during jumps it
// rises only sometimes.

export function makeRng(seed) {
    let a = seed >>> 0;
    let spare = null;
    const u = () => {
        // mulberry32
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normal = () => {
        if (spare !== null) {
            const s = spare;
            spare = null;
            return s;
        }
        let x, y, r;
        do {
            x = 2 * u() - 1;
            y = 2 * u() - 1;
            r = x * x + y * y;
        } while (r >= 1 || r === 0);
        const f = Math.sqrt((-2 * Math.log(r)) / r);
        spare = y * f;
        return x * f;
    };
    return {
        u,
        normal,
        uniform: (lo, hi) => lo + (hi - lo) * u(),
        logUniform: (lo, hi) => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * u()),
    };
}

// Gauss-Markov / Ornstein-Uhlenbeck process sampled every dt seconds,
// started in its stationary distribution.
function gaussMarkov(rng, sigma, tau) {
    let x = sigma * rng.normal();
    return (dt) => {
        const phi = Math.exp(-dt / tau);
        x = phi * x + sigma * Math.sqrt(1 - phi * phi) * rng.normal();
        return x;
    };
}

const ACC68 = Math.sqrt(-2 * Math.log(1 - 0.68)); // 68% radius / sigma

export const SCENARIOS = {
    open: {
        label: 'Open sky',
        slowSigma: [0.3, 1.2],
        slowTauMin: [20, 180],
        medSigma: [1, 2.5],
        medTauMin: [2, 15],
        fastSigma: [0.3, 1],
        fastTauSec: [3, 20],
        white: 0.2,
        jumpEverySec: 3600,
        jumpSize: [8, 25],
        jumpSec: [3, 30],
        gapEverySec: 900,
        gapSec: [5, 60],
        convSize: [3, 20],
        convTauSec: [5, 30],
        calibLogSigma: 0.4,
    },
    urban: {
        label: 'Urban canyon / trees',
        slowSigma: [1, 3],
        slowTauMin: [20, 180],
        medSigma: [2, 5],
        medTauMin: [2, 15],
        fastSigma: [0.5, 2],
        fastTauSec: [3, 20],
        white: 0.4,
        jumpEverySec: 240,
        jumpSize: [10, 60],
        jumpSec: [5, 90],
        gapEverySec: 300,
        gapSec: [5, 120],
        convSize: [10, 50],
        convTauSec: [10, 60],
        calibLogSigma: 0.5,
    },
};

// Sensitivity variants: errors that decorrelate faster than the current
// code assumes, and errors that persist longer.
SCENARIOS.openFast = {
    ...SCENARIOS.open,
    label: 'Open sky, fast-changing errors',
    slowSigma: [0, 0.3],
    medTauMin: [0.5, 3],
};
SCENARIOS.openSlow = {
    ...SCENARIOS.open,
    label: 'Open sky, slow multipath',
    medTauMin: [10, 45],
};

export function simulate(rng, scenario, durationSec) {
    const s = scenario;
    const pick = (range) => rng.uniform(range[0], range[1]);
    const slowSigma = pick(s.slowSigma);
    const slowTau = pick(s.slowTauMin) * 60;
    const medSigma = pick(s.medSigma);
    const medTau = pick(s.medTauMin) * 60;
    const fastSigma = pick(s.fastSigma);
    const fastTau = pick(s.fastTauSec);
    const comps = [
        [gaussMarkov(rng, slowSigma, slowTau), gaussMarkov(rng, slowSigma, slowTau)],
        [gaussMarkov(rng, medSigma, medTau), gaussMarkov(rng, medSigma, medTau)],
        [gaussMarkov(rng, fastSigma, fastTau), gaussMarkov(rng, fastSigma, fastTau)],
    ];
    // What the device believes its per-axis error is, before miscalibration.
    const claimedSigma = Math.sqrt(
        slowSigma ** 2 + medSigma ** 2 + fastSigma ** 2 + s.white ** 2
    );
    const calib = Math.exp(s.calibLogSigma * rng.normal());
    const accWobble = gaussMarkov(rng, 0.2, 60);
    const convSize = pick(s.convSize);
    const convTau = pick(s.convTauSec);
    const convAngle = rng.uniform(0, 2 * Math.PI);
    const convAccFactor = rng.uniform(0.3, 1.5);
    const rampSec = 3;
    let jump = null;
    let gapUntil = -1;
    const fixes = [];

    for (let t = 0; t < durationSec; t += 1) {
        let east = s.white * rng.normal();
        let north = s.white * rng.normal();

        for (const [ge, gn] of comps) {
            east += ge(1);
            north += gn(1);
        }

        const conv = convSize * Math.exp(-t / convTau);
        east += conv * Math.cos(convAngle);
        north += conv * Math.sin(convAngle);

        if (!jump && rng.u() < 1 / s.jumpEverySec) {
            const angle = rng.uniform(0, 2 * Math.PI);
            const size = pick(s.jumpSize);
            jump = {
                start: t,
                end: t + pick(s.jumpSec),
                e: size * Math.cos(angle),
                n: size * Math.sin(angle),
                // Sometimes the device notices, sometimes it doesn't.
                accFactor: rng.u() < 0.5 ? 1 : rng.uniform(1.5, 4),
            };
        }

        let accFactor = 1;

        if (jump) {
            const level = Math.min(
                1,
                (t - jump.start) / rampSec,
                Math.max(0, (jump.end - t) / rampSec)
            );
            east += level * jump.e;
            north += level * jump.n;
            accFactor = 1 + level * (jump.accFactor - 1);

            if (t >= jump.end + rampSec) {
                jump = null;
            }
        }

        const accBase = calib * ACC68 * claimedSigma * Math.exp(accWobble(1));
        const accConv = convAccFactor * ACC68 * conv;
        const accuracy = Math.max(
            1,
            Math.round(Math.sqrt(accBase ** 2 + accConv ** 2) * accFactor)
        );

        if (t > gapUntil && rng.u() < 1 / s.gapEverySec) {
            gapUntil = t + pick(s.gapSec);
        }

        if (t <= gapUntil) {
            continue;
        }

        fixes.push({ t, east, north, accuracy });
    }

    return fixes;
}
