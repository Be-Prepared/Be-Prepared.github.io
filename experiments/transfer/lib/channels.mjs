// Channels decide which displayed frames the receiver actually decodes.
// Returns a function: () => true when the frame got through.

export function perfect() {
    return () => true;
}

// Each frame is lost independently with probability p (blur, glare, a
// missed camera frame).
export function iid(p, rng) {
    return () => rng() >= p;
}

// Gilbert-Elliott burst loss: long average loss `p`, losses come in runs
// averaging `burst` frames (hand shake, someone walking by, autofocus).
export function burst(p, burstLength, rng) {
    const toGood = 1 / burstLength;
    const toBad = p >= 1 ? 1 : (p * toGood) / (1 - p);
    let bad = rng() < p;

    return () => {
        bad = bad ? rng() >= toGood : rng() < toBad;

        return !bad;
    };
}

// The receiver starts late: everything shown before `skip` frames is
// missed, then each frame is lost with probability p. Models aiming the
// camera minutes after the sender started.
export function late(skip, p, rng) {
    let shown = 0;

    return () => {
        shown += 1;

        return shown > skip && rng() >= p;
    };
}

// `k` is needed for late:<multiple of k>:<loss>.
export function parseChannel(spec, rng, k = 0) {
    const [name, a, b] = spec.split(':');

    switch (name) {
        case 'perfect':
            return perfect();

        case 'iid':
            return iid(+a, rng);

        case 'burst':
            return burst(+a, +b, rng);

        case 'late':
            return late(Math.round(+a * k), +b, rng);

        default:
            throw new Error(`Unknown channel: ${spec}`);
    }
}
