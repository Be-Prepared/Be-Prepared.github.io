// Geometry for the on-screen protractor. Screen coordinates (y grows down).
// Ray angles are in degrees, counterclockwise from the right half of the
// base bar, so 0 points right, 90 straight up and 180 left. Rays stay in
// the upper half-plane: 0 to 180.

export interface Point {
    x: number;
    y: number;
}

export interface Layout {
    // Bottom edge of the scale; the base bar runs across the screen here.
    baseY: number;
    // Radius of the degree scale.
    radius: number;
    vertex: Point;
}

export interface Tick {
    degrees: number;
    from: Point;
    to: Point;
}

export const INITIAL_RAYS: [number, number] = [135, 45];

export function clampAngle(degrees: number) {
    if (!isFinite(degrees)) {
        return 0;
    }

    return Math.min(180, Math.max(0, degrees));
}

// Angle of the line from the vertex to a point. Points below the base snap
// to whichever end of the base bar is on their side.
export function pointerAngle(vertex: Point, point: Point) {
    const dx = point.x - vertex.x;
    const dy = vertex.y - point.y;

    if (dy < 0) {
        return dx < 0 ? 180 : 0;
    }

    if (dx === 0 && dy === 0) {
        return 90;
    }

    return clampAngle((Math.atan2(dy, dx) * 180) / Math.PI);
}

// Which ray a touch grabs: the one pointing closest to it. This makes the
// whole screen a touch target instead of a thin line.
export function nearestRay(rays: number[], angle: number) {
    let best = 0;

    for (let i = 1; i < rays.length; i += 1) {
        if (Math.abs(rays[i] - angle) < Math.abs(rays[best] - angle)) {
            best = i;
        }
    }

    return best;
}

// Moves a ray by how far the pointer turned since the grab, so grabbing a
// ray beside its line doesn't make it jump to the finger.
export function dragAngle(
    rayAtStart: number,
    pointerAtStart: number,
    pointerNow: number
) {
    return clampAngle(rayAtStart + pointerNow - pointerAtStart);
}

export function angleBetween(a: number, b: number) {
    return Math.abs(clampAngle(a) - clampAngle(b));
}

// Angle between a ray and the base bar on the side it leans toward.
export function angleFromBase(degrees: number) {
    const clamped = clampAngle(degrees);

    return Math.min(clamped, 180 - clamped);
}

export function formatDegrees(degrees: number) {
    // Avoid "-0.0°".
    return `${(Math.round(degrees * 10) / 10 + 0).toFixed(1)}°`;
}

export function pointAt(vertex: Point, degrees: number, distance: number) {
    const radians = (degrees * Math.PI) / 180;

    return {
        x: round(vertex.x + Math.cos(radians) * distance),
        y: round(vertex.y - Math.sin(radians) * distance),
    };
}

// Fits the protractor into the available space: centered at the bottom,
// using as much width as possible while leaving room above for the reading.
export function layout(
    width: number,
    height: number,
    options: { bottom?: number; side?: number; top?: number } = {}
): Layout {
    const bottom = options.bottom ?? 24;
    const side = options.side ?? 16;
    const top = options.top ?? 96;
    const baseY = Math.max(0, height - bottom);
    const radius = Math.max(20, Math.min(width / 2 - side, baseY - top));

    return {
        baseY,
        radius,
        vertex: { x: width / 2, y: baseY },
    };
}

// How long a ray can be before its end leaves the box (inset by margins).
// Rays reach far past the scale so they can be lined up with real edges.
export function rayLength(
    vertex: Point,
    degrees: number,
    width: number,
    margins: { side: number; top: number },
    minimum = 0
) {
    const radians = (clampAngle(degrees) * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    let length = Infinity;

    if (dx > 1e-9) {
        length = (width - margins.side - vertex.x) / dx;
    } else if (dx < -1e-9) {
        length = (margins.side - vertex.x) / dx;
    }

    if (dy > 1e-9) {
        length = Math.min(length, (vertex.y - margins.top) / dy);
    }

    return Math.max(minimum, length);
}

// SVG path for the pie slice between two rays.
export function wedgePath(vertex: Point, radius: number, a: number, b: number) {
    const start = Math.min(clampAngle(a), clampAngle(b));
    const end = Math.max(clampAngle(a), clampAngle(b));

    if (end - start < 1e-6) {
        return '';
    }

    const p1 = pointAt(vertex, start, radius);
    const p2 = pointAt(vertex, end, radius);

    // Counterclockwise on screen is SVG sweep flag 0. Never over 180, so
    // the small arc flag always fits.
    return `M${round(vertex.x)} ${round(vertex.y)}L${p1.x} ${p1.y}A${round(
        radius
    )} ${round(radius)} 0 0 0 ${p2.x} ${p2.y}Z`;
}

// Open arc between two angles, for the outline of the measured angle.
export function arcPath(vertex: Point, radius: number, a: number, b: number) {
    const start = Math.min(clampAngle(a), clampAngle(b));
    const end = Math.max(clampAngle(a), clampAngle(b));

    if (end - start < 1e-6) {
        return '';
    }

    const p1 = pointAt(vertex, start, radius);
    const p2 = pointAt(vertex, end, radius);

    return `M${p1.x} ${p1.y}A${round(radius)} ${round(radius)} 0 0 0 ${
        p2.x
    } ${p2.y}`;
}

// Degree marks along the inside of the scale, like a real protractor:
// longest every 10°, medium every 5°, short every 1°. On small screens the
// 1° marks would blur together, so they are left out.
export function ticks(vertex: Point, radius: number): Tick[] {
    const result: Tick[] = [];
    const everyDegree = radius >= 140;

    for (let degrees = 0; degrees <= 180; degrees += 1) {
        let length = 0;

        if (degrees % 10 === 0) {
            length = 0.09;
        } else if (degrees % 5 === 0) {
            length = 0.06;
        } else if (everyDegree) {
            length = 0.03;
        }

        if (length) {
            result.push({
                degrees,
                from: pointAt(vertex, degrees, radius),
                to: pointAt(vertex, degrees, radius * (1 - length)),
            });
        }
    }

    return result;
}

// Number labels along the scale. Fewer on small screens so they don't
// overlap.
export function labelAngles(radius: number) {
    const step = radius >= 140 ? 10 : 30;
    const result: number[] = [];

    for (let degrees = 0; degrees <= 180; degrees += step) {
        result.push(degrees);
    }

    return result;
}

function round(value: number) {
    return Math.round(value * 100) / 100;
}
