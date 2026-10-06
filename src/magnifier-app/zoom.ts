// Zoom math for the magnifier. The camera's own (hardware) zoom is used
// first, then the video element is scaled up with CSS for additional digital
// zoom. iOS reports no hardware zoom at all, so there everything is digital.

export interface HardwareZoom {
    max: number;
    min: number;
    step: number;
}

export interface ZoomPlan {
    // Scale applied to the video element. Always >= 1.
    digital: number;

    // Value for the camera's zoom constraint, or null when not supported.
    hardware: number | null;

    // What the person sees: hardware * digital.
    total: number;
}

export const DIGITAL_ZOOM_MAX = 8;

// Each button press zooms by this factor.
export const ZOOM_BUTTON_FACTOR = 1.5;

export function hardwareZoomFromCapabilities(
    capabilities: any
): HardwareZoom | null {
    const zoom = capabilities && capabilities.zoom;

    if (
        !zoom ||
        typeof zoom.min !== 'number' ||
        typeof zoom.max !== 'number' ||
        !(zoom.max > zoom.min)
    ) {
        return null;
    }

    return {
        min: zoom.min,
        max: zoom.max,
        step: zoom.step > 0 ? zoom.step : 0.1,
    };
}

export function zoomLimits(
    hardware: HardwareZoom | null,
    digitalMax = DIGITAL_ZOOM_MAX
) {
    // Wide angle lenses report a minimum below 1. Don't go wider than normal
    // for a magnifier.
    const min = hardware ? Math.max(1, hardware.min) : 1;
    const max = (hardware ? hardware.max : 1) * digitalMax;

    return { min, max: Math.max(min, max) };
}

export function planZoom(
    requested: number,
    hardware: HardwareZoom | null,
    digitalMax = DIGITAL_ZOOM_MAX
): ZoomPlan {
    const limits = zoomLimits(hardware, digitalMax);
    const total = clamp(
        isFinite(requested) ? requested : limits.min,
        limits.min,
        limits.max
    );

    if (!hardware) {
        return { digital: total, hardware: null, total };
    }

    // Snap to the camera's step size, but never above what was asked for, so
    // digital zoom only ever enlarges.
    const steps = Math.floor((total - hardware.min) / hardware.step + 1e-9);
    const snapped = clamp(
        round(hardware.min + steps * hardware.step),
        hardware.min,
        hardware.max
    );

    return {
        digital: Math.max(1, total / snapped),
        hardware: snapped,
        total,
    };
}

// Starting zoom when the magnifier opens.
export function initialZoom(hardware: HardwareZoom | null) {
    if (hardware) {
        return hardware.max;
    }

    return 2;
}

export function pinchZoom(
    startZoom: number,
    startDistance: number,
    currentDistance: number
) {
    if (!(startDistance > 0) || !(currentDistance > 0)) {
        return startZoom;
    }

    return startZoom * (currentDistance / startDistance);
}

export function stepZoom(current: number, direction: 1 | -1) {
    return direction > 0
        ? current * ZOOM_BUTTON_FACTOR
        : current / ZOOM_BUTTON_FACTOR;
}

export function formatZoom(total: number) {
    return `${total < 10 ? total.toFixed(1) : Math.round(total)}×`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

// Avoid floating point dust like 2.3000000000000003.
function round(value: number) {
    return Math.round(value * 1e6) / 1e6;
}
