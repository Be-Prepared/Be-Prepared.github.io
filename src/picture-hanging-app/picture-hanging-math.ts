// Pure math for the picture hanging tool. No DOM access, so it can be unit
// tested.
import { AccessState } from '../services/access/access-controller';
import {
    offLevel,
    screenPitch,
    screenRoll,
    Vector3,
} from '../services/motion/motion-math';

// Considered level below this many degrees.
export const LEVEL_THRESHOLD = 0.5;

// Once level, stay level until the reading passes this, so the color
// doesn't flicker right at the threshold.
export const LEVEL_RELEASE = 0.7;

// Past this much lean the phone is closer to flat than upright and the
// horizon line means nothing.
const MAX_LEAN = 45;

export interface HangingReading {
    // Degrees the screen is turned from level, positive clockwise.
    roll: number;
    // Degrees the top of the phone leans away from the viewer.
    pitch: number;
    // CSS rotation that lines a drawn cross up with the real horizon.
    rotation: number;
    // False when the phone is lying too flat to be useful.
    upright: boolean;
}

export function hangingReading(gravity: Vector3): HangingReading {
    const roll = offLevel(screenRoll(gravity));
    const pitch = screenPitch(gravity);

    return {
        roll: clean(roll),
        pitch: clean(pitch),
        // Turning the phone clockwise makes the world appear to turn
        // counterclockwise on screen.
        rotation: clean(-roll),
        upright: Math.abs(pitch) < MAX_LEAN,
    };
}

// Level detection with a little stickiness. Both the rotation and the lean
// have to be good.
export function nextIsLevel(wasLevel: boolean, reading: HangingReading) {
    const limit = wasLevel ? LEVEL_RELEASE : LEVEL_THRESHOLD;

    return (
        reading.upright &&
        Math.abs(reading.roll) < limit &&
        Math.abs(reading.pitch) < limit
    );
}

// Which permission screen to show. The camera is asked for first; motion
// only matters once there is a picture to draw on.
export function combinedAccess(
    camera: AccessState,
    motion: AccessState
): { state: AccessState; source: 'camera' | 'motion' } {
    if (camera !== AccessState.READY) {
        return { state: camera, source: 'camera' };
    }

    return { state: motion, source: 'motion' };
}

// Direction keys for the readout, or null when it reads 0.0.
export function rollDirection(roll: number) {
    const rounded = roundTenth(roll);

    if (rounded === 0) {
        return null;
    }

    return rounded > 0 ? 'leftHigh' : 'rightHigh';
}

export function pitchDirection(pitch: number) {
    const rounded = roundTenth(pitch);

    if (rounded === 0) {
        return null;
    }

    return rounded > 0 ? 'topAway' : 'topToward';
}

// "1.2°", never "-0.0°".
export function formatDegrees(value: number) {
    return `${Math.abs(roundTenth(value)).toFixed(1)}°`;
}

// Avoid -0, which shows up as "-0" in CSS and tests.
function clean(value: number) {
    return value === 0 ? 0 : value;
}

function roundTenth(value: number) {
    return clean(Math.round(value * 10) / 10);
}
