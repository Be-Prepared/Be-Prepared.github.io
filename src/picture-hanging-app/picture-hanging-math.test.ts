import {
    combinedAccess,
    formatDegrees,
    hangingReading,
    nextIsLevel,
    pitchDirection,
    rollDirection,
} from './picture-hanging-math';
import { AccessState } from '../services/access/access-controller';
import test from 'ava';

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// Phone upright facing a wall, turned clockwise by `roll` and with the top
// leaning away by `pitch`.
const held = (roll: number, pitch: number) => {
    const r = (roll * Math.PI) / 180;
    const p = (pitch * Math.PI) / 180;

    return {
        x: Math.sin(r) * Math.cos(p),
        y: -Math.cos(r) * Math.cos(p),
        z: -Math.sin(p),
    };
};

test('hangingReading upright and level', (t) => {
    const r = hangingReading(held(0, 0));
    t.true(near(r.roll, 0) && near(r.pitch, 0) && near(r.rotation, 0));
    t.true(r.upright);
});

test('hangingReading turned and leaning', (t) => {
    const r = hangingReading(held(2, -3));
    t.true(near(r.roll, 2), `${r.roll}`);
    t.true(near(r.rotation, -2));
    t.true(near(r.pitch, -3), `${r.pitch}`);
});

test('hangingReading in landscape folds to the nearest axis', (t) => {
    const r = hangingReading(held(91, 0));
    t.true(near(r.roll, 1));
    t.true(near(r.rotation, -1));
});

test('hangingReading not upright when flat', (t) => {
    t.false(hangingReading({ x: 0, y: -0.1, z: -0.99 }).upright);
});

test('nextIsLevel needs both axes and has hysteresis', (t) => {
    t.true(nextIsLevel(false, hangingReading(held(0.3, 0.2))));
    t.false(nextIsLevel(false, hangingReading(held(0.3, 0.6))));
    t.false(nextIsLevel(false, hangingReading(held(0.6, 0))));
    t.true(nextIsLevel(true, hangingReading(held(0.6, -0.6))));
    t.false(nextIsLevel(true, hangingReading(held(0.8, 0))));
    t.false(
        nextIsLevel(true, { roll: 0, pitch: 0, rotation: 0, upright: false })
    );
});

test('combinedAccess asks for the camera first', (t) => {
    t.deepEqual(combinedAccess(AccessState.PROMPT, AccessState.PROMPT), {
        state: AccessState.PROMPT,
        source: 'camera',
    });
    t.deepEqual(combinedAccess(AccessState.READY, AccessState.PROMPT), {
        state: AccessState.PROMPT,
        source: 'motion',
    });
    t.deepEqual(combinedAccess(AccessState.READY, AccessState.READY), {
        state: AccessState.READY,
        source: 'motion',
    });
    t.deepEqual(combinedAccess(AccessState.DENIED, AccessState.READY), {
        state: AccessState.DENIED,
        source: 'camera',
    });
});

test('directions', (t) => {
    t.is(rollDirection(0.02), null);
    t.is(rollDirection(1), 'leftHigh');
    t.is(rollDirection(-1), 'rightHigh');
    t.is(pitchDirection(-0.04), null);
    t.is(pitchDirection(2), 'topAway');
    t.is(pitchDirection(-2), 'topToward');
});

test('formatDegrees', (t) => {
    t.is(formatDegrees(-0.04), '0.0°');
    t.is(formatDegrees(-2.26), '2.3°');
});
