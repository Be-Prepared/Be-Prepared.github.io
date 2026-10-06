import {
    angleDifference,
    bearingFromEuler,
    bearingFromMatrix,
    bearingFromQuaternion,
    bearingFromWebkitHeading,
    matrixFromEuler,
    matrixFromQuaternion,
    normalize360,
} from './compass-math';
import test from 'ava';

const close = (actual: number, expected: number, epsilon = 1e-6) =>
    Math.abs(angleDifference(actual, expected)) < epsilon;

// Quaternion [x, y, z, w] for a rotation of `degrees` around a unit axis.
function quaternion(axis: [number, number, number], degrees: number) {
    const half = (degrees * Math.PI) / 360;
    const s = Math.sin(half);

    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

// Hamilton product a * b, both [x, y, z, w]. Applies b first, then a.
function multiply(a: number[], b: number[]) {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;

    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ];
}

test('normalize360', (t) => {
    t.is(normalize360(0), 0);
    t.is(normalize360(360), 0);
    t.is(normalize360(-90), 270);
    t.is(normalize360(725), 5);
});

test('angleDifference takes the short way around', (t) => {
    t.is(angleDifference(350, 10), 20);
    t.is(angleDifference(10, 350), -20);
    t.is(angleDifference(0, 180), 180);
    t.is(angleDifference(90, 90), 0);
});

test('matrixFromEuler and matrixFromQuaternion agree', (t) => {
    // alpha=40 around Z, then beta=30 around X, then gamma=-20 around Y.
    const q = multiply(
        multiply(quaternion([0, 0, 1], 40), quaternion([1, 0, 0], 30)),
        quaternion([0, 1, 0], -20)
    );
    const a = matrixFromEuler(40, 30, -20);
    const b = matrixFromQuaternion(q);

    for (let i = 0; i < 9; i += 1) {
        t.true(Math.abs(a[i] - b[i]) < 1e-9, `element ${i}`);
    }
});

for (const alpha of [0, 45, 90, 135, 180, 270, 359]) {
    test(`flat device: alpha ${alpha} is bearing ${normalize360(-alpha)}`, (t) => {
        // alpha increases counterclockwise, compass bearings clockwise.
        t.true(close(bearingFromEuler(alpha, 0, 0), normalize360(-alpha)));
    });
}

test('flat device does not jitter with tiny tilts', (t) => {
    // The old formula only looked at the back of the device. When flat, the
    // result was decided by sensor noise. These readings are all "facing
    // east" with a tiny bit of noise.
    const readings = [
        bearingFromEuler(270, 0.4, -0.3),
        bearingFromEuler(270, -0.5, 0.2),
        bearingFromEuler(270, 0.1, 0.6),
        bearingFromEuler(270, -0.2, -0.6),
    ];

    for (const bearing of readings) {
        t.true(close(bearing, 90, 1), `${bearing}`);
    }
});

for (const beta of [0, 20, 45, 70, 89, 90]) {
    test(`tilting up toward upright (beta ${beta}) keeps the bearing`, (t) => {
        // Facing east, tilting the top of the phone up. The back of the
        // phone keeps looking east.
        t.true(close(bearingFromEuler(270, beta, 0), 90, 1e-6));
    });
}

test('upright device uses the direction of the back camera', (t) => {
    // Held upright, screen facing the person, who is facing south.
    t.true(close(bearingFromEuler(180, 90, 0), 180));
});

test('straight up or down has no direction', (t) => {
    // Upright and rolled 90 degrees: top points up, back points sideways.
    // Construct a matrix where both candidates are vertical.
    const m = [1, 0, 0, 0, 0, 1, 0, 1, 0] as any;
    // Top = (0, 0, 1) [vertical], back = -Z = (0, -1, 0) [horizontal south]
    t.true(close(bearingFromMatrix(m), 180));
    const vertical = [1, 0, 0, 0, 0, 0, 0, 1, 1] as any;
    // Top = column 1 = (0, 0, 1), back = -column 2 = (0, 0, -1)
    t.true(isNaN(bearingFromMatrix(vertical)));
});

test('screen rotated to landscape', (t) => {
    // Device flat, top of the device pointing north, but the screen is
    // rotated 90 degrees counterclockwise so the top of the screen is the
    // device's right edge, which points east.
    t.true(close(bearingFromEuler(0, 0, 0, 90), 90));
    t.true(close(bearingFromEuler(0, 0, 0, 270), 270));
    t.true(close(bearingFromEuler(0, 0, 0, 180), 180));
});

test('bearingFromQuaternion matches Euler for a plain rotation', (t) => {
    for (const degrees of [0, 30, 90, 200, 300]) {
        t.true(
            close(
                bearingFromQuaternion(quaternion([0, 0, 1], degrees)),
                bearingFromEuler(degrees, 0, 0)
            ),
            `${degrees}`
        );
    }
});

test('bearingFromQuaternion upright facing west', (t) => {
    // Rotate 90 around Z (facing west), then 90 around the device's X
    // (tilted upright).
    const q = multiply(quaternion([0, 0, 1], 90), quaternion([1, 0, 0], 90));
    t.true(close(bearingFromQuaternion(q), 270));
});

test('bearingFromWebkitHeading adds the screen angle', (t) => {
    t.is(bearingFromWebkitHeading(10), 10);
    t.is(bearingFromWebkitHeading(300, 90), 30);
});
