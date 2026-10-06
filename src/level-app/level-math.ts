// Pure math for the bubble level. No DOM access, so it can be unit tested.
import { surfaceTilt, Vector3 } from '../services/motion/motion-math';

// surface: a round bullseye for a phone lying on its back.
// bars: a construction level, with one vial along the screen's width and
// another along its height.
export type LevelMode = 'surface' | 'bars';

export const LEVEL_MODES: LevelMode[] = ['surface', 'bars'];

// Considered level below this many degrees.
export const LEVEL_THRESHOLD = 0.5;

// Once level, stay level until the reading passes this. Keeps the highlight
// and vibration from flickering when hovering right at the threshold.
export const LEVEL_RELEASE = 0.7;

// Tilt that pushes the bubble all the way to the edge of the target.
export const SURFACE_RANGE = 10;

// Tilt that pushes a vial's bubble all the way to one end.
export const BAR_RANGE = 5;

// A vial raised more than this is standing on end, so zeroing it would be
// meaningless.
const CALIBRATE_LIMIT = 45;

export interface SurfaceOffset {
    x: number;
    y: number;
}

export interface BarOffsets {
    // Vial along the screen's width.
    x: number;
    // Vial along the screen's height.
    y: number;
}

export interface LevelOffsets {
    surface: SurfaceOffset;
    bars: BarOffsets;
}

export interface BarReading {
    // How far the right end of the horizontal vial is raised, in degrees.
    x: number;
    // How far the top end of the vertical vial is raised, in degrees.
    y: number;
}

export interface SurfaceReading {
    x: number;
    y: number;
    total: number;
}

// Gravity mostly through the back of the phone means it's lying flat. This
// is the cosine of about 30 degrees from flat.
const FLAT_Z = 0.85;

const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

export function defaultOffsets(): LevelOffsets {
    return { surface: { x: 0, y: 0 }, bars: { x: 0, y: 0 } };
}

export function isValidOffsets(value: any): value is LevelOffsets {
    const finite = (n: any) => typeof n === 'number' && isFinite(n);
    const pair = (v: any) => !!v && finite(v.x) && finite(v.y);

    return !!value && pair(value.surface) && pair(value.bars);
}

// Total tilt from the two axis tilts. Exact when the axes come from
// surfaceTilt, and still sensible after offsets are removed.
export function combineTilt(x: number, y: number) {
    return (
        Math.atan(
            Math.hypot(
                Math.tan(x * DEGREES_TO_RADIANS),
                Math.tan(y * DEGREES_TO_RADIANS)
            )
        ) * RADIANS_TO_DEGREES
    );
}

// Tilt of the surface under a phone lying on its back, minus calibration.
// x is positive when the right edge is low, y when the top edge is low.
export function surfaceReading(
    gravity: Vector3,
    offset: SurfaceOffset
): SurfaceReading {
    const tilt = surfaceTilt(gravity);
    const x = tilt.x - offset.x;
    const y = tilt.y - offset.y;

    return { x, y, total: combineTilt(x, y) };
}

// How far the positive end of a screen axis is raised above horizontal, in
// degrees (-90 to 90). This is exactly what a real vial lying along that
// axis responds to.
export function axisElevation(gravity: Vector3, axis: 'x' | 'y') {
    // Gravity points down, so a raised end has a negative component.
    const component = clamp(-gravity[axis], -1, 1);

    return clean(Math.asin(component) * RADIANS_TO_DEGREES);
}

// Both vials, minus calibration.
export function barReading(gravity: Vector3, offsets: BarOffsets): BarReading {
    return {
        x: clean(axisElevation(gravity, 'x') - offsets.x),
        y: clean(axisElevation(gravity, 'y') - offsets.y),
    };
}

// The current readings become the zero points. A vial standing on end keeps
// its old zero, so zeroing while upright only affects the horizontal vial.
export function calibrate(
    mode: LevelMode,
    gravity: Vector3,
    offsets: LevelOffsets
): LevelOffsets {
    if (mode === 'surface') {
        const tilt = surfaceTilt(gravity);

        return { ...offsets, surface: { x: tilt.x, y: tilt.y } };
    }

    const x = axisElevation(gravity, 'x');
    const y = axisElevation(gravity, 'y');

    return {
        ...offsets,
        bars: {
            x: Math.abs(x) <= CALIBRATE_LIMIT ? x : offsets.bars.x,
            y: Math.abs(y) <= CALIBRATE_LIMIT ? y : offsets.bars.y,
        },
    };
}

// Whether calibrate() would change anything in this position.
export function canCalibrate(mode: LevelMode, gravity: Vector3) {
    if (mode === 'surface') {
        return isTooFlat(gravity);
    }

    return (
        Math.abs(axisElevation(gravity, 'x')) <= CALIBRATE_LIMIT ||
        Math.abs(axisElevation(gravity, 'y')) <= CALIBRATE_LIMIT
    );
}

export function resetOffset(
    mode: LevelMode,
    offsets: LevelOffsets
): LevelOffsets {
    return { ...offsets, [mode]: { x: 0, y: 0 } };
}

export function hasOffset(mode: LevelMode, offsets: LevelOffsets) {
    return offsets[mode].x !== 0 || offsets[mode].y !== 0;
}

// True when the phone is lying flat enough for the surface target.
export function isTooFlat(gravity: Vector3) {
    return Math.abs(gravity.z) > FLAT_Z;
}

// Where the bubble sits in the round target, as fractions of the radius it
// can travel (-1 to 1, CSS directions: +x right, +y down). A bubble floats
// to the high side, the opposite of where gravity pulls.
export function surfaceBubble(reading: SurfaceReading, range = SURFACE_RANGE) {
    let x = -reading.x / range;
    // Top edge low (positive y) means the bottom is high: bubble goes down.
    let y = reading.y / range;
    const distance = Math.hypot(x, y);

    if (distance > 1) {
        x /= distance;
        y /= distance;
    }

    return { x: clean(x), y: clean(y) };
}

// Bubble position in a vial, -1 to 1, toward the raised end. For the
// horizontal vial +1 is the right end; for the vertical vial +1 is the top.
// Standing on end pins the bubble at the top, like a real vial.
export function vialBubble(elevation: number, range = BAR_RANGE) {
    return clean(clamp(elevation / range, -1, 1));
}

// Level detection with a little stickiness.
export function nextIsLevel(wasLevel: boolean, degreesOff: number) {
    const off = Math.abs(degreesOff);

    return wasLevel ? off < LEVEL_RELEASE : off < LEVEL_THRESHOLD;
}

// "1.2°", never "-0.0°".
export function formatDegrees(value: number) {
    return `${Math.abs(roundTenth(value)).toFixed(1)}°`;
}

// "+1.2°", "−1.2°" or "0.0°".
export function formatSignedDegrees(value: number) {
    const rounded = roundTenth(value);
    const text = formatDegrees(rounded);

    if (rounded > 0) {
        return `+${text}`;
    }

    if (rounded < 0) {
        return `−${text}`;
    }

    return text;
}

// Which end of the horizontal vial is high, or null when it reads 0.0.
export function barDirection(elevation: number) {
    const rounded = roundTenth(elevation);

    if (rounded === 0) {
        return null;
    }

    return rounded > 0 ? 'rightHigh' : 'leftHigh';
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

// Avoid -0, which shows up as "-0" in CSS and tests.
function clean(value: number) {
    return value === 0 ? 0 : value;
}

function roundTenth(value: number) {
    return clean(Math.round(value * 10) / 10);
}
