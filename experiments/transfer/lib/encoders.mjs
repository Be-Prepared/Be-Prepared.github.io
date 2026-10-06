import { sampleDegree } from './distributions.mjs';

// An encoder turns a frame number into the list of source block indices
// XORed into that frame.

function randomIndices(k, degree, rng) {
    const indices = new Set();

    while (indices.size < degree) {
        indices.add(Math.floor(rng() * k));
    }

    return [...indices];
}

// Every frame is a random combination. This is what the app does today.
export function random(k, table, rng) {
    return () => randomIndices(k, Math.min(k, sampleDegree(table, rng)), rng);
}

// The first k frames carry each source block once, in order (degree 1).
// After that, random combinations fill in whatever was lost. With little
// loss, the receiver is nearly done after k frames.
export function systematic(k, table, rng) {
    let frame = 0;

    return () => {
        frame += 1;

        if (frame <= k) {
            return [frame - 1];
        }

        return randomIndices(k, Math.min(k, sampleDegree(table, rng)), rng);
    };
}

// Systematic, then repeat the systematic pass interleaved with random
// frames (every other frame), so a receiver who joins late still gets
// cheap degree-1 frames.
export function systematicInterleaved(k, table, rng) {
    let frame = 0;
    let next = 0;

    return () => {
        frame += 1;

        if (frame <= k || frame % 2 === 0) {
            const index = next;
            next = (next + 1) % k;

            return [index];
        }

        return randomIndices(k, Math.min(k, sampleDegree(table, rng)), rng);
    };
}

// A random half of all source blocks. Only practical with seeded frames
// (the indices come from a seed, not a list in the header). Any k + a few
// of these are almost certainly enough with Gaussian elimination, no matter
// which ones were lost.
function denseIndices(k, rng) {
    const indices = [];

    for (let i = 0; i < k; i += 1) {
        if (rng() < 0.5) {
            indices.push(i);
        }
    }

    return indices.length ? indices : [Math.floor(rng() * k)];
}

// Every frame dense. Optimal in frame count, but the receiver has to run
// elimination over all k blocks.
export function dense(k, _table, rng) {
    return () => denseIndices(k, rng);
}

// One systematic pass, then dense repair frames. The receiver only runs
// elimination over the blocks it missed.
export function systematicDense(k, _table, rng) {
    let frame = 0;

    return () => {
        frame += 1;

        return frame <= k ? [frame - 1] : denseIndices(k, rng);
    };
}

// Keeps cycling the systematic pass forever, with a dense repair frame
// every `every` frames, so someone who starts receiving late still gets
// cheap degree-1 frames.
export function carouselDense(k, _table, rng, every = 4) {
    let frame = 0;
    let next = 0;

    return () => {
        frame += 1;

        if (frame > k && frame % every === 0) {
            return denseIndices(k, rng);
        }

        const index = next;
        next = (next + 1) % k;

        return [index];
    };
}

// Random LT frames, but a small share (`denseShare`) are dense instead.
// Every frame is still independent and identically distributed, so loss
// and late starts don't matter. The dense frames close the rare gap where
// some block never landed in any LT frame, which is what causes the LT
// worst case. They join the small elimination system at the end.
export function mixed(k, table, rng, denseShare = 0.02) {
    return () =>
        rng() < denseShare
            ? denseIndices(k, rng)
            : randomIndices(k, Math.min(k, sampleDegree(table, rng)), rng);
}
