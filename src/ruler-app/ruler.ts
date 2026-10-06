// Scale math for the on-screen ruler. No DOM access so it can be tested.

export const MM_PER_INCH = 25.4;

// ISO/IEC 7810 ID-1: credit cards, most ID cards and driver's licenses.
export const CARD_LONG_MM = 85.6;
export const CARD_SHORT_MM = 53.98;

// Anything outside this range is a mistake, not a real screen.
export const PX_PER_MM_MIN = 2;
export const PX_PER_MM_MAX = 12;

export interface Tick {
    // CSS pixels from the start of the ruler.
    offset: number;
    // 0 is the longest tick (each cm or inch), larger numbers are shorter.
    level: number;
    // Number to print next to the tick, for level 0 only.
    label: number | null;
}

export interface Scale {
    // Millimeters in one labeled unit.
    unitMm: number;
    // How each level splits the one above it. Metric: cm -> half cm -> mm.
    // Imperial: inch -> 1/2 -> 1/4 -> 1/8 -> 1/16.
    divisions: number[];
}

export const METRIC: Scale = { unitMm: 10, divisions: [2, 5] };
export const IMPERIAL: Scale = { unitMm: MM_PER_INCH, divisions: [2, 2, 2, 2] };

export function clampPxPerMm(value: number) {
    if (!isFinite(value)) {
        return PX_PER_MM_MIN;
    }

    return Math.min(PX_PER_MM_MAX, Math.max(PX_PER_MM_MIN, value));
}

// Best guess before calibration. Browsers say 96 CSS px per inch, which is
// close on desktop monitors, but phones and tablets use much denser CSS
// pixels: about 160 per inch on phones (Android's baseline density, and
// roughly what iPhones use) and about 132 on tablets.
export function defaultPxPerMm(env: { coarse: boolean; shortSide: number }) {
    let dpi = 96;

    if (env.coarse) {
        dpi = env.shortSide < 600 ? 160 : 132;
    }

    return dpi / MM_PER_INCH;
}

// The size of a physical (device) pixel never changes, but browser zoom and
// display size settings change devicePixelRatio, which changes how big a CSS
// pixel is. Keep the calibration correct when that happens.
export function adjustForPixelRatio(
    pxPerMm: number,
    savedRatio: number,
    currentRatio: number
) {
    if (!(savedRatio > 0) || !(currentRatio > 0)) {
        return pxPerMm;
    }

    return (pxPerMm * savedRatio) / currentRatio;
}

export function cardLengthToPxPerMm(cardPx: number) {
    return clampPxPerMm(cardPx / CARD_LONG_MM);
}

// Nudge calibration by a fraction, for the fine-adjust buttons.
export function nudge(pxPerMm: number, steps: number, fraction = 0.002) {
    return clampPxPerMm(pxPerMm * (1 + steps * fraction));
}

// Ticks from 0 up to lengthPx. Levels whose ticks would be closer together
// than minSpacingPx are left out so the ruler never turns into a gray smear.
export function generateTicks(
    lengthPx: number,
    pxPerMm: number,
    scale: Scale,
    minSpacingPx = 3
): Tick[] {
    const ticks: Tick[] = [];
    const unitPx = scale.unitMm * pxPerMm;

    if (!(unitPx > 0) || !(lengthPx >= 0)) {
        return ticks;
    }

    // Find the deepest level that still has room.
    let subdivisions = 1;
    let levels = 1;

    for (const division of scale.divisions) {
        if (unitPx / (subdivisions * division) < minSpacingPx) {
            break;
        }

        subdivisions *= division;
        levels += 1;
    }

    // Size of the step at each level, in subdivisions.
    const stepAtLevel: number[] = [subdivisions];

    for (let i = 0; i < levels - 1; i += 1) {
        stepAtLevel.push(stepAtLevel[i] / scale.divisions[i]);
    }

    const stepPx = unitPx / subdivisions;
    const count = Math.floor(lengthPx / stepPx + 1e-9);

    for (let i = 0; i <= count; i += 1) {
        let level = 0;

        while (level < levels - 1 && i % stepAtLevel[level] !== 0) {
            level += 1;
        }

        ticks.push({
            offset: i * stepPx,
            level,
            label: level === 0 ? i / subdivisions : null,
        });
    }

    return ticks;
}

// Text for a measurement, such as "12.3 cm" or "4 13/16 in".
export function formatCm(mm: number) {
    return `${(Math.max(0, mm) / 10).toFixed(1)} cm`;
}

export function formatInches(mm: number) {
    const sixteenths = Math.round((Math.max(0, mm) / MM_PER_INCH) * 16);
    const whole = Math.floor(sixteenths / 16);
    let numerator = sixteenths % 16;
    let denominator = 16;

    if (!numerator) {
        return `${whole} in`;
    }

    while (numerator % 2 === 0) {
        numerator /= 2;
        denominator /= 2;
    }

    const fraction = `${numerator}/${denominator}`;

    return whole ? `${whole} ${fraction} in` : `${fraction} in`;
}

// Round to the nearest device pixel so 1px lines land on a single row of
// pixels instead of being blurred across two.
export function snapToDevice(cssPx: number, ratio: number) {
    return Math.round(cssPx * ratio);
}
