import { angleDifference } from './compass-math';

export const enum CalibrationStatus {
    UNKNOWN = 'UNKNOWN',
    GOOD = 'GOOD',
    POOR = 'POOR',
}

export interface CalibrationMonitorOptions {
    // How much the device must rotate (degrees, according to the gyroscope)
    // before the compass is checked against it.
    minRotation: number;

    // Allowed relative error between the gyroscope's rotation and the
    // compass's rotation. 0.35 means the compass may report 65 to 135 degrees
    // of movement for a 100 degree turn.
    tolerance: number;

    // Rotations that take longer than this are ignored; slow drift in the
    // gyroscope would otherwise produce false alarms.
    windowMs: number;

    // Consecutive good checks needed to clear a POOR status.
    goodChecksToClear: number;

    // iOS reports the compass accuracy in degrees. Above this is POOR.
    maxAccuracyDegrees: number;

    // Earth's magnetic field is roughly 25 to 65 microtesla. Readings well
    // outside of that indicate interference or an uncalibrated sensor.
    minFieldStrength: number;
    maxFieldStrength: number;
}

interface Sample {
    time: number;
    absolute: number;
    relative: number;
}

const DEFAULT_OPTIONS: CalibrationMonitorOptions = {
    minRotation: 60,
    tolerance: 0.35,
    windowMs: 5000,
    goodChecksToClear: 2,
    maxAccuracyDegrees: 30,
    minFieldStrength: 15,
    maxFieldStrength: 80,
};

// Detects when the compass would benefit from calibration.
//
// Browsers do not expose a "needs calibration" flag, except iOS's
// webkitCompassAccuracy. Instead, this compares how far the compass says the
// device turned against how far the gyroscope (which does not depend on the
// magnetometer) says it turned. An uncalibrated magnetometer tends to report
// a 90 degree turn as 20 degrees, or 200 degrees, or wobble back and forth.
export class CalibrationMonitor {
    private _absoluteTotal = 0;
    private _accuracyStatus = CalibrationStatus.UNKNOWN;
    private _fieldStatus = CalibrationStatus.UNKNOWN;
    private _goodChecks = 0;
    private _history: Sample[] = [];
    private _lastAbsolute: number | null = null;
    private _lastRelative: number | null = null;
    private _options: CalibrationMonitorOptions;
    private _relativeTotal = 0;
    private _rotationStatus = CalibrationStatus.UNKNOWN;

    constructor(options: Partial<CalibrationMonitorOptions> = {}) {
        this._options = { ...DEFAULT_OPTIONS, ...options };
    }

    // Compass bearing from a magnetometer-based source.
    addAbsolute(time: number, bearing: number) {
        if (!isFinite(bearing)) {
            return;
        }

        if (this._lastAbsolute !== null) {
            this._absoluteTotal += angleDifference(this._lastAbsolute, bearing);
        }

        this._lastAbsolute = bearing;

        if (this._lastRelative !== null) {
            this._record(time);
        }
    }

    // iOS's webkitCompassAccuracy, in degrees. Negative means invalid.
    addAccuracy(degrees: number) {
        if (degrees < 0 || degrees > this._options.maxAccuracyDegrees) {
            this._accuracyStatus = CalibrationStatus.POOR;
        } else {
            this._accuracyStatus = CalibrationStatus.GOOD;
        }
    }

    // Magnetometer readings in microtesla.
    addField(x: number, y: number, z: number) {
        const strength = Math.hypot(x, y, z);

        if (
            strength < this._options.minFieldStrength ||
            strength > this._options.maxFieldStrength
        ) {
            this._fieldStatus = CalibrationStatus.POOR;
        } else {
            this._fieldStatus = CalibrationStatus.GOOD;
        }
    }

    // Bearing from a gyroscope-based source with an arbitrary zero.
    addRelative(bearing: number) {
        if (!isFinite(bearing)) {
            return;
        }

        if (this._lastRelative !== null) {
            this._relativeTotal += angleDifference(this._lastRelative, bearing);
        }

        this._lastRelative = bearing;
    }

    reset() {
        this._absoluteTotal = 0;
        this._accuracyStatus = CalibrationStatus.UNKNOWN;
        this._fieldStatus = CalibrationStatus.UNKNOWN;
        this._goodChecks = 0;
        this._history = [];
        this._lastAbsolute = null;
        this._lastRelative = null;
        this._relativeTotal = 0;
        this._rotationStatus = CalibrationStatus.UNKNOWN;
    }

    status(): CalibrationStatus {
        const statuses = [
            this._accuracyStatus,
            this._fieldStatus,
            this._rotationStatus,
        ];

        if (statuses.includes(CalibrationStatus.POOR)) {
            return CalibrationStatus.POOR;
        }

        if (statuses.includes(CalibrationStatus.GOOD)) {
            return CalibrationStatus.GOOD;
        }

        return CalibrationStatus.UNKNOWN;
    }

    private _check(start: Sample, end: Sample) {
        const relative = end.relative - start.relative;
        const absolute = end.absolute - start.absolute;
        const error = Math.abs(absolute - relative) / Math.abs(relative);

        if (error > this._options.tolerance) {
            this._goodChecks = 0;
            this._rotationStatus = CalibrationStatus.POOR;
        } else {
            this._goodChecks += 1;

            if (
                this._rotationStatus !== CalibrationStatus.POOR ||
                this._goodChecks >= this._options.goodChecksToClear
            ) {
                this._rotationStatus = CalibrationStatus.GOOD;
            }
        }
    }

    private _record(time: number) {
        const sample: Sample = {
            time,
            absolute: this._absoluteTotal,
            relative: this._relativeTotal,
        };
        const cutoff = time - this._options.windowMs;
        this._history = this._history.filter((item) => item.time >= cutoff);

        for (const previous of this._history) {
            if (
                Math.abs(sample.relative - previous.relative) >=
                this._options.minRotation
            ) {
                this._check(previous, sample);

                // Start fresh so the next check needs another full turn.
                this._history = [sample];

                return;
            }
        }

        this._history.push(sample);
    }
}
