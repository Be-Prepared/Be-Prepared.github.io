// Pure math for levels and tilt. No DOM access, so it can be unit tested.
//
// Device coordinates follow the W3C DeviceOrientation spec: x to the right
// edge of the screen, y to the top edge, z out of the screen toward the
// viewer.

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

// Unit vector pointing down (toward the ground), in device coordinates, from
// DeviceOrientationEvent's beta and gamma. alpha (heading) doesn't matter.
// A phone lying face up on a table gives (0, 0, -1).
export function gravityFromEuler(beta: number, gamma: number): Vector3 {
    const b = beta * DEGREES_TO_RADIANS;
    const g = gamma * DEGREES_TO_RADIANS;

    // The bottom row of the Z-X'-Y'' rotation matrix is the world's up axis
    // in device coordinates. Down is the negative of that.
    return {
        x: Math.cos(b) * Math.sin(g),
        y: -Math.sin(b),
        z: -Math.cos(b) * Math.cos(g),
    };
}

// Rotate device coordinates into screen coordinates. `screenAngle` is
// screen.orientation.angle (90 when the device is turned counterclockwise
// into landscape).
export function toScreenFrame(v: Vector3, screenAngle: number): Vector3 {
    const a = screenAngle * DEGREES_TO_RADIANS;
    const c = Math.cos(a);
    const s = Math.sin(a);

    return {
        x: v.x * c - v.y * s,
        y: v.x * s + v.y * c,
        z: v.z,
    };
}

// For a phone lying on its back: how far the surface tilts toward the
// screen's right (x) and top (y) edges, in degrees, plus the total tilt.
// A perfectly level surface is { x: 0, y: 0, total: 0 }.
export function surfaceTilt(gravity: Vector3) {
    const down = Math.max(1e-9, -gravity.z);

    return {
        x: Math.atan2(gravity.x, down) * RADIANS_TO_DEGREES,
        y: Math.atan2(gravity.y, down) * RADIANS_TO_DEGREES,
        total:
            Math.acos(
                Math.max(-1, Math.min(1, -gravity.z / length(gravity)))
            ) * RADIANS_TO_DEGREES,
    };
}

// Angle of the screen's "down" relative to gravity, measured in the plane of
// the screen, in degrees (-180, 180]. 0 means the bottom edge of the screen
// is level (upright portrait). Positive when the device is rotated clockwise.
export function screenRoll(gravity: Vector3) {
    return Math.atan2(gravity.x, -gravity.y) * RADIANS_TO_DEGREES;
}

// How far an edge is from level or plumb, folded into (-45, 45]. Works no
// matter which edge is down, so a bar level reads the same either way up.
export function offLevel(rollDegrees: number) {
    let value = ((((rollDegrees + 45) % 90) + 90) % 90) - 45;

    if (value === -45) {
        value = 45;
    }

    return value;
}

// For a phone held upright facing a wall: how far the top leans away from
// (positive) or toward (negative) the viewer, in degrees. 0 when the screen
// is exactly vertical.
export function screenPitch(gravity: Vector3) {
    const inPlane = Math.hypot(gravity.x, gravity.y);

    return Math.atan2(-gravity.z, Math.max(1e-9, inPlane)) * RADIANS_TO_DEGREES;
}

export function length(v: Vector3) {
    return Math.hypot(v.x, v.y, v.z) || 1;
}

// Light low-pass filter for a vector. `amount` 0 = no change, 1 = no
// smoothing.
export function smoothVector(
    previous: Vector3 | null,
    next: Vector3,
    amount: number
): Vector3 {
    if (!previous) {
        return next;
    }

    return {
        x: previous.x + (next.x - previous.x) * amount,
        y: previous.y + (next.y - previous.y) * amount,
        z: previous.z + (next.z - previous.z) * amount,
    };
}
