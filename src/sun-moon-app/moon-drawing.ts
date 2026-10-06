// Geometry for drawing the moon's lit part as an SVG path. Pure, so it can
// be tested in Node.

// The side the lit part is on as seen from the ground. Waxing moons are lit
// on the right in the northern hemisphere and on the left in the southern.
export function litOnRight(waxing: boolean, latitude: number) {
    return latitude >= 0 ? waxing : !waxing;
}

function n(value: number) {
    return `${Math.round(value * 1000) / 1000}`;
}

// Path for the lit part of a moon disk of radius r centered at (r, r).
// One edge is the half circle on the lit side; the other is the terminator,
// a half ellipse whose width shrinks to nothing at the quarters. Empty when
// nothing is lit.
export function moonLitPath(fraction: number, onRight: boolean, r: number) {
    const f = Math.min(1, Math.max(0, fraction));

    if (f < 0.005) {
        return '';
    }

    const top = `${n(r)} 0`;
    const bottom = `${n(r)} ${n(2 * r)}`;

    if (f > 0.995) {
        return `M${top}A${n(r)} ${n(r)} 0 1 1 ${bottom}A${n(r)} ${n(
            r
        )} 0 1 1 ${top}Z`;
    }

    // Terminator half-width: r at new and full, 0 at the quarters.
    const rx = Math.abs(1 - 2 * f) * r;
    const gibbous = f > 0.5;
    // With y pointing down, top to bottom through the right side is a
    // clockwise sweep (1). Coming back up, a crescent's terminator bulges
    // toward the lit side and a gibbous one away from it.
    const limbSweep = onRight ? 1 : 0;
    const terminatorSweep = gibbous === onRight ? 1 : 0;

    return `M${top}A${n(r)} ${n(r)} 0 0 ${limbSweep} ${bottom}A${n(rx)} ${n(
        r
    )} 0 0 ${terminatorSweep} ${top}Z`;
}
