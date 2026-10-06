// Averages many GPS fixes of a stationary spot and estimates how far the
// average could be from the truth.
//
// The method and its constants come from the Monte Carlo experiment in
// experiments/averaging/ (README.md there has the numbers and sources). In
// short: the earlier inverse-variance weighted mean was fine in open sky but
// was dragged by multipath jumps, and its 95% radius held the truth only
// about 75% of the time in open sky because it assumed GPS errors decorrelate
// faster than they do and it couldn't see errors the whole session shares.
//
// Error model
// -----------
// A browser hands out a position that is the truth plus errors that change
// on very different time scales: receiver noise (seconds), multipath and
// satellite geometry (several minutes up to most of an hour for an antenna
// that isn't moving), and ionosphere, troposphere, orbit, and clock residuals
// (hours). Averaging removes the fast part quickly, the multipath part
// slowly, and the slowest part hardly at all within one session, which is
// why averaging levels off. On top of that come multipath / non-line-of-sight
// jumps of tens of meters lasting seconds to a minute, and the occasional
// Wi-Fi or cell tower fix.
//
// Reported accuracy is taken as the 68% horizontal radius, which is how
// Android defines it (Chrome passes Android's value through; the W3C spec
// doesn't pin a confidence level down). For a circular Gaussian with per-axis
// standard deviation s, the fraction inside radius r is 1 - exp(-r² / 2s²),
// so a 68% radius is about 1.51 s. It is only loosely related to the actual
// error, so it isn't used to weight fixes (in the experiment, weighting by it
// made no difference). It is used to drop fixes that are far worse than
// usual and as one estimate of the size of a fix's error.
//
// Steps
// -----
// 1. Drop fixes whose reported accuracy is more than ACCURACY_GATE times the
//    median. These are usually network fixes or the receiver admitting it is
//    lost. A median-based gate always keeps at least half of the fixes.
// 2. Project onto a local east/north plane and take a Huber M-estimate of the
//    2D center by iteratively reweighted least squares: fixes within HUBER_K
//    standard deviations count fully, farther ones count less the farther
//    they are. A 40 m multipath jump can't drag the average, and on
//    well-behaved data it is the same as a plain mean. The scale comes from
//    the median distance to the center (1.1774 s for a 2D Gaussian), which
//    outliers can't inflate. The receiver's first minute is worse, but this
//    handles it; dropping it made no difference in the experiment.
// 3. Estimate the per-axis standard error of the center. Of a fix's error
//    variance s², the share the whole session has in common is
//        g = BIAS_SHARE + (1 - BIAS_SHARE) / n_eff
//        n_eff = 1 + time span / CORRELATION_MS
//    BIAS_SHARE is the slow part that doesn't average away within a
//    session; the rest averages down as errors decorrelate. The standard
//    error is then s * sqrt(g). For s², take the larger of the median
//    reported accuracy and the observed scatter divided by (1 - g). Scatter
//    around the session's own average can't show the part of the error every
//    fix shares, so by itself it understates s², badly for short sessions.
// 4. Report a 95% radius: for a circular Gaussian, s * sqrt(-2 ln 0.05),
//    about 2.45 s.
//
// Estimating n_eff from the data itself (batch means, integrated
// autocorrelation time) was tried and was too optimistic: it needs a session
// dozens of correlation times long, hours here, and it can never see the
// slowest errors. Its 95% radius held the truth only 23% to 68% of the time.
//
// Points are on the ellipsoid surface (altitude 0), so the local plane
// through the first fix holds them to well under a millimeter over the
// spreads involved.

export const ACCURACY_68_TO_SIGMA = Math.sqrt(-2 * Math.log(1 - 0.68));
export const SIGMA_TO_RADIUS_95 = Math.sqrt(-2 * Math.log(0.05));
// For a 2D Gaussian, the median distance from the center over s.
export const MEDIAN_DISTANCE_TO_SIGMA = Math.sqrt(2 * Math.log(2));
// Errors are assumed to become independent after this long. A still
// antenna's multipath can take 10 minutes or more to change. With 10 minutes
// here, the 95% radius held the truth only 86% to 89% of the time in the
// experiment for sessions of an hour or more.
export const CORRELATION_MS = 20 * 60 * 1000;
// Share of a fix's error variance assumed to stay put for the whole session.
export const BIAS_SHARE = 0.05;
export const ACCURACY_GATE = 3;
export const HUBER_K = 2;
// Used when a fix has no usable accuracy.
export const DEFAULT_ACCURACY = 20;

export interface AverageSample {
    x: number;
    y: number;
    z: number;
    accuracy: number;
    timestamp: number;
}

export interface AverageResult {
    x: number;
    y: number;
    z: number;
    // Radius in meters expected to contain the true position 95% of the time.
    radius95: number;
    // Fixes that went into the average, and fixes left out because they were
    // unusable or reported an accuracy far worse than usual.
    usedCount: number;
    rejectedCount: number;
    // Roughly how many independent fixes the session is worth.
    effectiveCount: number;
    // Per-axis standard deviation of a single fix and of the average, meters.
    fixSigma: number;
    sigma: number;
}

interface Point {
    east: number;
    north: number;
}

export function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;

    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function usableAccuracy(sample: AverageSample) {
    return sample.accuracy > 0 && isFinite(sample.accuracy)
        ? sample.accuracy
        : DEFAULT_ACCURACY;
}

export function averageSamples(samples: AverageSample[]): AverageResult | null {
    const valid = samples.filter(
        (sample) =>
            isFinite(sample.x) &&
            isFinite(sample.y) &&
            isFinite(sample.z) &&
            isFinite(sample.timestamp)
    );

    if (!valid.length) {
        return null;
    }

    // 1. Accuracy gate.
    const accuracyLimit = ACCURACY_GATE * median(valid.map(usableAccuracy));
    const kept = valid.filter(
        (sample) => usableAccuracy(sample) <= accuracyLimit
    );

    // 2. Local east/north plane through the first kept fix. Working with
    // offsets also avoids squaring ECEF values in the millions of meters.
    const origin = kept[0];
    const radius = Math.hypot(origin.x, origin.y, origin.z) || 1;
    const up = [origin.x / radius, origin.y / radius, origin.z / radius];
    const horizontal = Math.hypot(up[0], up[1]);
    // At a pole any direction is east.
    const east =
        horizontal > 1e-12
            ? [-up[1] / horizontal, up[0] / horizontal, 0]
            : [0, 1, 0];
    const north = [
        up[1] * east[2] - up[2] * east[1],
        up[2] * east[0] - up[0] * east[2],
        up[0] * east[1] - up[1] * east[0],
    ];
    const points: Point[] = kept.map((sample) => {
        const dx = sample.x - origin.x;
        const dy = sample.y - origin.y;
        const dz = sample.z - origin.z;

        return {
            east: dx * east[0] + dy * east[1] + dz * east[2],
            north: dx * north[0] + dy * north[1] + dz * north[2],
        };
    });
    const center = huberCenter(points);

    // 3. Standard error. Math.min(...array) can overflow the stack on a long
    // session, so loop.
    let firstTime = Infinity;
    let lastTime = -Infinity;

    for (const sample of kept) {
        firstTime = Math.min(firstTime, sample.timestamp);
        lastTime = Math.max(lastTime, sample.timestamp);
    }

    const effectiveCount = Math.min(
        kept.length,
        1 + (lastTime - firstTime) / CORRELATION_MS
    );
    const shared = BIAS_SHARE + (1 - BIAS_SHARE) / effectiveCount;
    const scatterSigma =
        median(
            points.map((point) =>
                Math.hypot(point.east - center.east, point.north - center.north)
            )
        ) / MEDIAN_DISTANCE_TO_SIGMA;
    const accuracySigma =
        median(kept.map(usableAccuracy)) / ACCURACY_68_TO_SIGMA;
    // With no time span every fix shares all of its error (g = 1); the cap
    // avoids dividing by zero.
    const fixVariance = Math.max(
        accuracySigma * accuracySigma,
        (scatterSigma * scatterSigma) / Math.max(0.1, 1 - shared)
    );
    const sigma = Math.sqrt(fixVariance * shared);

    return {
        x: origin.x + center.east * east[0] + center.north * north[0],
        y: origin.y + center.east * east[1] + center.north * north[1],
        z: origin.z + center.east * east[2] + center.north * north[2],
        // 4. 95% radius.
        radius95: sigma * SIGMA_TO_RADIUS_95,
        usedCount: kept.length,
        rejectedCount: samples.length - kept.length,
        effectiveCount,
        fixSigma: Math.sqrt(fixVariance),
        sigma,
    };
}

// Huber M-estimate of a 2D center by iteratively reweighted least squares,
// started from the coordinate-wise median.
export function huberCenter(points: Point[]): Point {
    let center = {
        east: median(points.map((point) => point.east)),
        north: median(points.map((point) => point.north)),
    };
    const distance = (point: Point) =>
        Math.hypot(point.east - center.east, point.north - center.north);
    // A floor keeps identical fixes from dividing by zero.
    const scale = Math.max(
        0.01,
        median(points.map(distance)) / MEDIAN_DISTANCE_TO_SIGMA
    );

    for (let iteration = 0; iteration < 50; iteration += 1) {
        let total = 0;
        let sumEast = 0;
        let sumNorth = 0;

        for (const point of points) {
            const u = distance(point) / scale;
            const weight = u <= HUBER_K ? 1 : HUBER_K / u;
            total += weight;
            sumEast += weight * point.east;
            sumNorth += weight * point.north;
        }

        const next = { east: sumEast / total, north: sumNorth / total };
        const moved = Math.hypot(
            next.east - center.east,
            next.north - center.north
        );
        center = next;

        if (moved < 1e-4) {
            break;
        }
    }

    return center;
}
