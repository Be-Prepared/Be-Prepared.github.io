// Pure helper for the time remaining and time of arrival location fields.

import { LatLon } from '../datatypes/lat-lon';

export interface TimedLatLon extends LatLon {
    timestamp: number;
}

// Milliseconds left to reach the destination at the average rate of progress
// toward it since the start position, or null when there's no progress yet.
export function estimateTimeRemaining(
    start: TimedLatLon,
    current: TimedLatLon,
    destination: LatLon,
    distance: (a: LatLon, b: LatLon) => number
): number | null {
    const elapsed = current.timestamp - start.timestamp;
    const remaining = distance(current, destination);
    const progress = distance(start, destination) - remaining;

    if (!(elapsed > 0) || !(progress > 0)) {
        return null;
    }

    return remaining / (progress / elapsed);
}
