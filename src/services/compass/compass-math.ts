// Pure math for turning orientation readings into a compass bearing. Kept
// free of DOM access so it can be unit tested.
//
// World frame is East-North-Up (x = east, y = north, z = up), which is what
// both DeviceOrientationEvent and AbsoluteOrientationSensor report. Matrices
// are row-major 3x3 arrays that rotate device coordinates into world
// coordinates, so column N is device axis N expressed in the world frame.

// prettier-ignore
export type Matrix3 = [
    number, number, number,
    number, number, number,
    number, number, number,
];

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

// A horizontal component shorter than this is considered pointing straight up
// or down, which means it has no usable direction.
const MIN_HORIZONTAL = 1e-6;

export function normalize360(degrees: number) {
    return ((degrees % 360) + 360) % 360;
}

// Signed shortest difference from `from` to `to`, in the range (-180, 180].
export function angleDifference(from: number, to: number) {
    const diff = normalize360(to - from);

    return diff > 180 ? diff - 360 : diff;
}

// Rotation matrix for DeviceOrientationEvent's alpha, beta, gamma (degrees),
// which are intrinsic Z-X'-Y'' Tait-Bryan angles per the W3C spec.
export function matrixFromEuler(
    alpha: number,
    beta: number,
    gamma: number
): Matrix3 {
    const a = alpha * DEGREES_TO_RADIANS;
    const b = beta * DEGREES_TO_RADIANS;
    const g = gamma * DEGREES_TO_RADIANS;
    const cA = Math.cos(a);
    const sA = Math.sin(a);
    const cB = Math.cos(b);
    const sB = Math.sin(b);
    const cG = Math.cos(g);
    const sG = Math.sin(g);

    // prettier-ignore
    return [
        cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG,
        cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB,
        -cB * sG, sB, cB * cG,
    ];
}

// Rotation matrix for a unit quaternion in [x, y, z, w] order, which is the
// order used by the Generic Sensor API's OrientationSensor.quaternion.
export function matrixFromQuaternion(q: ArrayLike<number>): Matrix3 {
    const [x, y, z, w] = [q[0], q[1], q[2], q[3]];

    // prettier-ignore
    return [
        1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    ];
}

// Compass bearing (0 = north, 90 = east) of the direction the user is facing.
//
// Two candidate "forward" vectors are used:
//   * The top edge of the screen. Correct when the device lies flat.
//   * The back of the device (where the rear camera looks). Correct when the
//     device is held upright.
// Whichever one is closer to horizontal wins. Between flat and upright they
// point the same way, so the switch is seamless. Using only the back of the
// device (as the W3C spec's example does) falls apart when the device is
// flat: both horizontal components approach zero and sensor noise makes the
// result jitter around randomly.
//
// `screenAngle` is screen.orientation.angle, used when the matrix describes
// the physical device instead of the screen (DeviceOrientationEvent). Pass 0
// when the sensor already reports in the screen's frame.
//
// Returns NaN when no direction can be determined.
export function bearingFromMatrix(m: Matrix3, screenAngle = 0) {
    const s = Math.sin(screenAngle * DEGREES_TO_RADIANS);
    const c = Math.cos(screenAngle * DEGREES_TO_RADIANS);

    // Top of the screen, in device coordinates, is (sin θ, cos θ, 0).
    const topEast = m[0] * s + m[1] * c;
    const topNorth = m[3] * s + m[4] * c;

    // Back of the device is -Z.
    const backEast = -m[2];
    const backNorth = -m[5];

    const topLength = Math.hypot(topEast, topNorth);
    const backLength = Math.hypot(backEast, backNorth);
    let east = topEast;
    let north = topNorth;

    if (backLength > topLength) {
        east = backEast;
        north = backNorth;
    }

    if (Math.hypot(east, north) < MIN_HORIZONTAL) {
        return NaN;
    }

    return normalize360(Math.atan2(east, north) * RADIANS_TO_DEGREES);
}

export function bearingFromEuler(
    alpha: number,
    beta: number,
    gamma: number,
    screenAngle = 0
) {
    return bearingFromMatrix(matrixFromEuler(alpha, beta, gamma), screenAngle);
}

export function bearingFromQuaternion(
    q: ArrayLike<number>,
    screenAngle = 0
) {
    return bearingFromMatrix(matrixFromQuaternion(q), screenAngle);
}

// iOS reports webkitCompassHeading relative to the top of the device in
// portrait orientation, regardless of how the screen is rotated.
export function bearingFromWebkitHeading(heading: number, screenAngle = 0) {
    return normalize360(heading + screenAngle);
}
