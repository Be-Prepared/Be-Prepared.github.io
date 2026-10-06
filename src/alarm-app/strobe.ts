// Timing for flashing lights. No DOM here so it can be tested.

// The flashlight blinks three times a second. Phones take a moment to switch
// the light, so much faster than this just looks dim.
export const TORCH_HALF_PERIOD_MS = 1000 / 3 / 2;

// The screen changes color twice a second: two flashes per second, under
// the limit of three per second that guidelines (WCAG 2.3.1) give for
// avoiding seizures.
export const SCREEN_HALF_PERIOD_MS = 250;

// Whether the light is on at this point. On first, then off, alternating.
export function strobeOn(elapsedMs: number, halfPeriodMs: number) {
    if (!(elapsedMs > 0)) {
        return true;
    }

    return Math.floor(elapsedMs / halfPeriodMs) % 2 === 0;
}

// Time until the light should change again, so the strobe stays in step
// even when timers fire late.
export function msUntilToggle(elapsedMs: number, halfPeriodMs: number) {
    const into = Math.max(0, elapsedMs) % halfPeriodMs;

    return halfPeriodMs - into;
}

// Flashes per second for a given half period.
export function flashesPerSecond(halfPeriodMs: number) {
    return 1000 / (halfPeriodMs * 2);
}
