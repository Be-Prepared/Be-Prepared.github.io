// Candidate estimators. Each takes fixes [{ t, east, north, accuracy }] (t in
// seconds, positions in meters) and returns { e, n, r95, used, rejected }:
// the estimated position and the radius claimed to hold the truth 95% of the
// time.

const ACC68 = Math.sqrt(-2 * Math.log(1 - 0.68));
const R95 = Math.sqrt(-2 * Math.log(0.05));
const R = 6378137;

const median = (values) => {
    const a = [...values].sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// 95% radius for a circular error whose per-axis variance is estimated with
// `dof` degrees of freedom: |d|² / (2 s²) follows F(2, dof), whose quantile
// has a closed form. dof = Infinity gives the familiar 2.45 s.
export function radius95(perAxisVariance, dof = Infinity) {
    const s = Math.sqrt(Math.max(0, perAxisVariance));
    if (!isFinite(dof)) {
        return s * R95;
    }
    const f = (dof / 2) * (Math.pow(0.05, -2 / dof) - 1);
    return s * Math.sqrt(2 * f);
}

// ---- The code shipped today, ported verbatim (ECEF at lat 0, lon 0) ----
export function current(fixes) {
    const CORRELATION_MS = 10 * 60 * 1000;
    const samples = fixes.map((f) => ({
        x: R,
        y: f.east,
        z: f.north,
        accuracy: f.accuracy,
        timestamp: f.t * 1000,
    }));
    const origin = samples[0];
    let totalWeight = 0, sumX = 0, sumY = 0, sumZ = 0;
    let minTime = Infinity, maxTime = -Infinity;
    const weights = [];
    for (const s of samples) {
        const accuracy = s.accuracy > 0 && isFinite(s.accuracy) ? s.accuracy : 20;
        const sigma = accuracy / ACC68;
        const w = 1 / (sigma * sigma);
        weights.push(w);
        totalWeight += w;
        sumX += w * (s.x - origin.x);
        sumY += w * (s.y - origin.y);
        sumZ += w * (s.z - origin.z);
        minTime = Math.min(minTime, s.timestamp);
        maxTime = Math.max(maxTime, s.timestamp);
    }
    const dx = sumX / totalWeight, dy = sumY / totalWeight, dz = sumZ / totalWeight;
    const n = samples.length;
    const span = maxTime - minTime;
    const effectiveCount = Math.min(n, 1 + span / CORRELATION_MS);
    let ws = 0;
    samples.forEach((s, i) => {
        const ex = s.x - origin.x - dx, ey = s.y - origin.y - dy, ez = s.z - origin.z - dz;
        ws += weights[i] * (ex * ex + ey * ey + ez * ez);
    });
    const scatterVariance = n > 1 ? ((ws / totalWeight / 2) * n) / (n - 1) : 0;
    const modelSigma = Math.sqrt(n / effectiveCount / totalWeight);
    const empiricalSigma = Math.sqrt(scatterVariance / effectiveCount);
    const sigma = Math.max(modelSigma, empiricalSigma);
    return { e: origin.y + dy, n: origin.z + dz, r95: sigma * R95, used: n, rejected: 0 };
}

// ---- Building blocks ----

function weightedMean(fixes, w) {
    let W = 0, e = 0, n = 0;
    fixes.forEach((f, i) => {
        W += w[i];
        e += w[i] * f.east;
        n += w[i] * f.north;
    });
    return { e: e / W, n: n / W, W };
}

// Weighted per-axis scatter (average of east and north variances).
function scatterVariance(fixes, w, est) {
    let W = 0, s = 0;
    fixes.forEach((f, i) => {
        W += w[i];
        s += w[i] * ((f.east - est.e) ** 2 + (f.north - est.n) ** 2);
    });
    return s / W / 2;
}

// Variance of a weighted mean by non-overlapping batch means over equal
// time slices. Returns { variance, dof } (per axis, dof for both axes).
export function batchMeansVariance(fixes, w, est, batches) {
    const t0 = fixes[0].t;
    const span = fixes[fixes.length - 1].t - t0 + 1;
    const W = new Array(batches).fill(0);
    const E = new Array(batches).fill(0);
    const N = new Array(batches).fill(0);
    fixes.forEach((f, i) => {
        const b = Math.min(batches - 1, Math.floor(((f.t - t0) / span) * batches));
        W[b] += w[i];
        E[b] += w[i] * (f.east - est.e);
        N[b] += w[i] * (f.north - est.n);
    });
    let total = 0, sum = 0, k = 0;
    for (let b = 0; b < batches; b += 1) {
        if (W[b] > 0) {
            total += W[b];
            k += 1;
        }
    }
    for (let b = 0; b < batches; b += 1) {
        if (W[b] > 0) {
            const me = E[b] / W[b], mn = N[b] / W[b];
            sum += (W[b] / total) ** 2 * (me * me + mn * mn);
        }
    }
    if (k < 2) {
        return { variance: Infinity, dof: 1 };
    }
    return { variance: ((sum / 2) * k) / (k - 1), dof: 2 * (k - 1) };
}

// Integrated autocorrelation time with Sokal's automatic window (c = 5), on
// 10 s bins so it stays fast. Returns the variance of the mean per axis.
export function sokalVariance(fixes, est) {
    const binSec = 10;
    const bins = new Map();
    for (const f of fixes) {
        const k = Math.floor(f.t / binSec);
        const b = bins.get(k) || { e: 0, n: 0, c: 0 };
        b.e += f.east - est.e;
        b.n += f.north - est.n;
        b.c += 1;
        bins.set(k, b);
    }
    const series = [...bins.values()].map((b) => [b.e / b.c, b.n / b.c]);
    const m = series.length;
    if (m < 4) {
        return { variance: Infinity, dof: 1 };
    }
    let varTotal = 0;
    for (const axis of [0, 1]) {
        const x = series.map((p) => p[axis]);
        const mean = x.reduce((a, b) => a + b, 0) / m;
        const c0 = x.reduce((a, b) => a + (b - mean) ** 2, 0) / m;
        let tau = 1;
        for (let lag = 1; lag < m; lag += 1) {
            let c = 0;
            for (let i = 0; i + lag < m; i += 1) {
                c += (x[i] - mean) * (x[i + lag] - mean);
            }
            tau += (2 * c) / m / c0;
            if (lag >= 5 * tau) {
                break;
            }
        }
        tau = Math.max(1, tau);
        varTotal += (c0 * tau) / m;
    }
    return { variance: varTotal / 2, dof: Infinity };
}

// 2D M-estimate of location by iteratively reweighted least squares.
// kind: 'huber' (k = 2 sigma) or 'tukey' (c = 4.685 sigma). The scale is
// fixed from the median distance to the coordinate-wise median (for a 2D
// Gaussian the median distance is 1.1774 sigma).
export function robustLocation(fixes, baseW, kind) {
    let est = { e: median(fixes.map((f) => f.east)), n: median(fixes.map((f) => f.north)) };
    const dist = (f) => Math.hypot(f.east - est.e, f.north - est.n);
    const sigma = Math.max(0.1, median(fixes.map(dist)) / 1.1774);
    let w = baseW;
    for (let iter = 0; iter < 30; iter += 1) {
        w = fixes.map((f, i) => {
            const u = dist(f) / sigma;
            let r;
            if (kind === 'huber') {
                r = u <= 2 ? 1 : 2 / u;
            } else {
                r = u < 4.685 ? (1 - (u / 4.685) ** 2) ** 2 : 0;
            }
            return baseW[i] * r;
        });
        const next = weightedMean(fixes, w);
        const moved = Math.hypot(next.e - est.e, next.n - est.n);
        est = { e: next.e, n: next.n };
        if (moved < 1e-4) {
            break;
        }
    }
    return { est, w };
}

const ones = (fixes) => fixes.map(() => 1);
const invVar = (fixes) => fixes.map((f) => (ACC68 / f.accuracy) ** 2);

// ---- Simple baselines (independent-error assumptions) ----

export function plainMean(fixes) {
    const w = ones(fixes);
    const est = weightedMean(fixes, w);
    const v = scatterVariance(fixes, w, est) / fixes.length;
    return { ...est, r95: radius95(v), used: fixes.length, rejected: 0 };
}

export function medianIid(fixes) {
    const est = { e: median(fixes.map((f) => f.east)), n: median(fixes.map((f) => f.north)) };
    // Asymptotic variance of a median is (pi / 2) sigma² / n.
    const v = ((Math.PI / 2) * scatterVariance(fixes, ones(fixes), est)) / fixes.length;
    return { ...est, r95: radius95(v), used: fixes.length, rejected: 0 };
}

export function weightedIid(fixes) {
    const w = invVar(fixes);
    const est = weightedMean(fixes, w);
    return { e: est.e, n: est.n, r95: radius95(1 / est.W), used: fixes.length, rejected: 0 };
}

// ---- Time-correlation aware, data-driven error estimates ----

export function meanBatch(fixes) {
    const w = ones(fixes);
    const est = weightedMean(fixes, w);
    const bm = batchMeansVariance(fixes, w, est, 10);
    return { e: est.e, n: est.n, r95: radius95(bm.variance, bm.dof), used: fixes.length, rejected: 0 };
}

export function meanSokal(fixes) {
    const est = weightedMean(fixes, ones(fixes));
    const s = sokalVariance(fixes, est);
    return { e: est.e, n: est.n, r95: radius95(s.variance, s.dof), used: fixes.length, rejected: 0 };
}

// ---- Cleaning: warm-up and accuracy gate ----

export function clean(fixes, { warmupSec = 60, gate = 3 } = {}) {
    let kept = fixes;
    const span = fixes[fixes.length - 1].t - fixes[0].t;
    // Only drop the warm-up when plenty of data remains after it.
    if (warmupSec && span > 5 * warmupSec) {
        kept = kept.filter((f) => f.t - fixes[0].t >= warmupSec);
    }
    if (gate) {
        const limit = gate * median(kept.map((f) => f.accuracy));
        kept = kept.filter((f) => f.accuracy <= limit);
    }
    return kept;
}

export function robustBatch(fixes, { kind = 'huber', weights = 'unit', batches = 10 } = {}) {
    const kept = clean(fixes);
    const base = weights === 'unit' ? ones(kept) : weights === 'inv' ? kept.map((f) => 1 / f.accuracy) : invVar(kept);
    const { est, w } = robustLocation(kept, base, kind);
    const bm = batchMeansVariance(kept, w, est, batches);
    return { ...est, r95: radius95(bm.variance, bm.dof), used: kept.length, rejected: fixes.length - kept.length };
}

// ---- Hybrid: robust location, error from a prior model floored by data ----
//
// opts.tauMin: assumed decorrelation time in minutes (n_eff = 1 + T / tau).
// opts.beta: share of the per-fix variance assumed to be a bias that does not
//   average away within a session.
// opts.sigma: 'max' (larger of scatter and reported accuracy), 'acc', 'obs',
//   or 'geo' (geometric mean).
// opts.batchSec: target batch length for the batch-means lower bound.
export function hybrid(fixes, opts = {}) {
    const { tauMin = 10, beta = 0.05, sigma = 'max', batchSec = 300, warmupSec = 60, gate = 3, kind = 'huber' } = opts;
    const kept = clean(fixes, { warmupSec, gate });
    const { est, w } = robustLocation(kept, ones(kept), kind);
    const obs =
        sigma === 'maxRobust'
            ? (median(kept.map((f) => Math.hypot(f.east - est.e, f.north - est.n))) / 1.1774) ** 2
            : scatterVariance(kept, w, est);
    const acc = (median(kept.map((f) => f.accuracy)) / ACC68) ** 2;
    const span = kept[kept.length - 1].t - kept[0].t;
    const nEff = 1 + span / (tauMin * 60);
    // Share of a fix's variance that is common to the whole session.
    const g = beta + (1 - beta) / nEff;
    // Scatter around the session's own mean misses that shared part.
    const obsTotal = opts.unbias ? obs / Math.max(0.1, 1 - g) : obs;
    const fix =
        sigma === 'acc' ? acc : sigma === 'obs' ? obsTotal : sigma === 'geo' ? Math.sqrt(acc * obsTotal) : Math.max(acc, obsTotal);
    let v = fix * g;
    let dof = Infinity;
    const batches = Math.min(20, Math.floor(span / batchSec));
    if (batches >= 3) {
        const bm = batchMeansVariance(kept, w, est, batches);
        // Batch means only ever raises the estimate: with fewer than about
        // 50 correlation times of data it is biased low.
        if (bm.variance > v) {
            v = bm.variance;
            dof = bm.dof;
        }
    }
    return { ...est, r95: radius95(v, dof), used: kept.length, rejected: fixes.length - kept.length };
}
