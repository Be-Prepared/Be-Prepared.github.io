// Averages many GPS fixes of a stationary spot and estimates how far the
// average could be from the truth.
//
// Error model
// -----------
// Each fix is treated as the true position plus a circular 2D Gaussian error.
// The reported accuracy is taken as the radius containing 68% of fixes (that
// is how Android defines it, and Chrome passes Android's value through; the
// W3C spec doesn't pin a confidence level down, so this is an assumption).
// For a circular Gaussian with per-axis standard deviation s, the fraction
// inside radius r is 1 - exp(-r² / 2s²), so a 68% radius is about 1.51 s.
//
// Mean
// ----
// Inverse-variance weighting (weight = 1 / s²) is the minimum-variance way to
// combine measurements of differing quality: a 5 m fix counts four times as
// much as a 10 m fix. Averaging happens on Earth-centered (ECEF) coordinates
// so it works anywhere, including across the antimeridian and near the poles.
//
// Uncertainty of the mean
// -----------------------
// With independent errors the per-axis standard error of the weighted mean is
// 1 / sqrt(sum of weights), which shrinks with the square root of the count.
// GPS errors are not independent: satellite orbit and clock errors, the
// atmosphere, and multipath change over minutes, so a thousand fixes taken one
// second apart are worth far fewer than a thousand independent ones. The
// model assumes errors decorrelate over CORRELATION_MS (an assumption, not a
// measurement) and uses an effective sample count
//
//     n_eff = min(n, 1 + time span / CORRELATION_MS)
//
// inflating the variance by n / n_eff. This is the usual effective sample
// size correction for autocorrelated data.
//
// The reported accuracy can still be too optimistic (bad multipath under
// trees, a phone that understates its error), so the observed scatter is used
// as a floor: the weighted per-axis spread of the fixes around the mean,
// divided by sqrt(n_eff), is the empirical standard error. The larger of the
// two is used.
//
// The result is reported as a 95% radius: the radius of a circle around the
// average that contains the true position 95% of the time. For a circular
// Gaussian that's s * sqrt(-2 ln 0.05), about 2.45 s.
//
// Points are on the ellipsoid surface (altitude 0), so straight-line ECEF
// distances between them are horizontal distances to well under a millimeter
// over the spreads involved.

export const ACCURACY_68_TO_SIGMA = Math.sqrt(-2 * Math.log(1 - 0.68));
export const SIGMA_TO_RADIUS_95 = Math.sqrt(-2 * Math.log(0.05));
export const CORRELATION_MS = 10 * 60 * 1000;
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
    effectiveCount: number;
    modelSigma: number;
    empiricalSigma: number;
}

export function averageSamples(samples: AverageSample[]): AverageResult | null {
    if (!samples.length) {
        return null;
    }

    // Work relative to the first point. ECEF values are millions of meters,
    // and squaring offsets is far more precise than squaring raw coordinates.
    const origin = samples[0];
    let totalWeight = 0;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let minTime = Infinity;
    let maxTime = -Infinity;
    const weights: number[] = [];

    for (const sample of samples) {
        const accuracy =
            sample.accuracy > 0 && isFinite(sample.accuracy)
                ? sample.accuracy
                : DEFAULT_ACCURACY;
        const sigma = accuracy / ACCURACY_68_TO_SIGMA;
        const weight = 1 / (sigma * sigma);
        weights.push(weight);
        totalWeight += weight;
        sumX += weight * (sample.x - origin.x);
        sumY += weight * (sample.y - origin.y);
        sumZ += weight * (sample.z - origin.z);
        minTime = Math.min(minTime, sample.timestamp);
        maxTime = Math.max(maxTime, sample.timestamp);
    }

    const dx = sumX / totalWeight;
    const dy = sumY / totalWeight;
    const dz = sumZ / totalWeight;
    const n = samples.length;
    const span = isFinite(maxTime - minTime) ? maxTime - minTime : 0;
    const effectiveCount = Math.min(n, 1 + span / CORRELATION_MS);

    let weightedSquares = 0;

    samples.forEach((sample, index) => {
        const ex = sample.x - origin.x - dx;
        const ey = sample.y - origin.y - dy;
        const ez = sample.z - origin.z - dz;
        weightedSquares += weights[index] * (ex * ex + ey * ey + ez * ez);
    });

    // Divide by 2 for a per-axis variance from 2D squared distances. The
    // n / (n - 1) factor removes the bias of measuring scatter around an
    // estimated mean instead of the true one.
    const scatterVariance =
        n > 1 ? ((weightedSquares / totalWeight / 2) * n) / (n - 1) : 0;
    const modelSigma = Math.sqrt(n / effectiveCount / totalWeight);
    const empiricalSigma = Math.sqrt(scatterVariance / effectiveCount);
    const sigma = Math.max(modelSigma, empiricalSigma);

    return {
        x: origin.x + dx,
        y: origin.y + dy,
        z: origin.z + dz,
        radius95: sigma * SIGMA_TO_RADIUS_95,
        effectiveCount,
        modelSigma,
        empiricalSigma,
    };
}
