// Degree distributions: how many source blocks get XORed into one frame.
// Each returns a cumulative table [[probability, degree], ...] for a given k.

function cumulative(weights) {
    const total = weights.reduce((sum, [w]) => sum + w, 0);
    let running = 0;

    return weights
        .filter(([w]) => w > 0)
        .map(([w, degree]) => {
            running += w / total;

            return [running, degree];
        });
}

// What the app ships today (src/file-transfer-app/file-transfer-send-app),
// found by the generative search in experiments/soliton.
export function app() {
    return [
        [0.09447, 1],
        [0.387097, 2],
        [0.592166, 3],
        [0.735023, 4],
        [0.741935, 6],
        [0.746543, 10],
        [0.762672, 14],
        [0.967741, 15],
        [1.0, 16],
    ];
}

// Ideal soliton, with everything above `cap` folded into `cap`.
export function idealCapped(k, cap = 16) {
    const max = Math.min(cap, k);
    const weights = [];
    let folded = 0;

    for (let d = 1; d <= k; d += 1) {
        const w = d === 1 ? 1 / k : 1 / (d * (d - 1));

        if (d < max) {
            weights.push([w, d]);
        } else {
            folded += w;
        }
    }

    weights.push([folded, max]);

    return cumulative(weights);
}

// Robust soliton (Luby 2002). With `cap`, degrees above it are folded into
// the cap, which is what the 16-index frame format forces.
export function robustSoliton(k, c = 0.03, delta = 0.5, cap = Infinity) {
    const R = c * Math.log(k / delta) * Math.sqrt(k);
    const spike = Math.max(1, Math.min(k, Math.floor(k / R)));
    const max = Math.min(cap, k);
    const weights = [];
    let folded = 0;

    for (let d = 1; d <= k; d += 1) {
        let w = d === 1 ? 1 / k : 1 / (d * (d - 1));

        if (d < spike) {
            w += R / (d * k);
        } else if (d === spike) {
            w += (R * Math.log(R / delta)) / k;
        }

        if (d < max) {
            weights.push([w, d]);
        } else {
            folded += w;
        }
    }

    weights.push([folded, max]);

    return cumulative(weights);
}

export function meanDegree(table) {
    let previous = 0;
    let mean = 0;

    for (const [p, d] of table) {
        mean += (p - previous) * d;
        previous = p;
    }

    return mean;
}

export function sampleDegree(table, rng) {
    const r = rng();

    for (const [p, d] of table) {
        if (r < p) {
            return d;
        }
    }

    return table[table.length - 1][1];
}
