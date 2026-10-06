import { CalibrationMonitor, CalibrationStatus } from './calibration-monitor';
import { normalize360 } from './compass-math';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Simulates turning in place. `compassScale` is how much the compass moves
// per degree the gyroscope moves; 1 is a healthy compass.
function turn(
    monitor: CalibrationMonitor,
    options: {
        degrees: number;
        compassScale?: number;
        compassStart?: number;
        relativeStart?: number;
        startTime?: number;
        steps?: number;
        durationMs?: number;
    }
) {
    const steps = options.steps ?? 30;
    const duration = options.durationMs ?? 2000;
    const scale = options.compassScale ?? 1;
    const compassStart = options.compassStart ?? 0;
    const relativeStart = options.relativeStart ?? 100;
    const startTime = options.startTime ?? 0;

    for (let i = 0; i <= steps; i += 1) {
        const turned = (options.degrees * i) / steps;
        monitor.addRelative(normalize360(relativeStart + turned));
        monitor.addAbsolute(
            startTime + (duration * i) / steps,
            normalize360(compassStart + turned * scale)
        );
    }
}

test('starts unknown', () => {
    assert.equal(new CalibrationMonitor().status(), CalibrationStatus.UNKNOWN);
});

test('stays unknown without gyroscope data', () => {
    const monitor = new CalibrationMonitor();

    for (let i = 0; i < 50; i += 1) {
        monitor.addAbsolute(i * 50, i * 5);
    }

    assert.equal(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('stays unknown while holding still', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 5 });
    assert.equal(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('good when the compass follows the gyroscope', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120 });
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
});

test('handles wrapping past north', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120, compassStart: 300, relativeStart: 330 });
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
});

test('handles turning counterclockwise', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: -150, compassStart: 20 });
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
});

test('poor when the compass barely moves', () => {
    // The "jiggles but doesn't really turn" failure.
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 180, compassScale: 0.2 });
    assert.equal(monitor.status(), CalibrationStatus.POOR);
});

test('poor when the compass overshoots', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 90, compassScale: 2 });
    assert.equal(monitor.status(), CalibrationStatus.POOR);
});

test('poor when the compass turns the wrong way', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 90, compassScale: -1 });
    assert.equal(monitor.status(), CalibrationStatus.POOR);
});

test('slow turns outside the window are ignored', () => {
    const monitor = new CalibrationMonitor({ windowMs: 1000 });
    turn(monitor, { degrees: 90, compassScale: 0.1, durationMs: 60000 });
    assert.equal(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('recovers after calibration', () => {
    const monitor = new CalibrationMonitor({ goodChecksToClear: 2 });
    turn(monitor, { degrees: 90, compassScale: 0.2 });
    assert.equal(monitor.status(), CalibrationStatus.POOR);

    // One good turn is not enough to trust it again.
    turn(monitor, { degrees: 90, startTime: 10000 });
    assert.equal(monitor.status(), CalibrationStatus.POOR);

    turn(monitor, { degrees: 90, startTime: 20000 });
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
});

test('iOS accuracy', () => {
    const monitor = new CalibrationMonitor();
    monitor.addAccuracy(10);
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
    monitor.addAccuracy(45);
    assert.equal(monitor.status(), CalibrationStatus.POOR);
    monitor.addAccuracy(-1);
    assert.equal(monitor.status(), CalibrationStatus.POOR);
    monitor.addAccuracy(5);
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
});

test('magnetic field strength', () => {
    const monitor = new CalibrationMonitor();
    monitor.addField(20, 30, -25);
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
    monitor.addField(200, 0, 0);
    assert.equal(monitor.status(), CalibrationStatus.POOR);
    monitor.addField(1, 1, 1);
    assert.equal(monitor.status(), CalibrationStatus.POOR);
});

test('any poor signal wins', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120 });
    monitor.addAccuracy(90);
    assert.equal(monitor.status(), CalibrationStatus.POOR);
});

test('reset', () => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120, compassScale: 0 });
    monitor.reset();
    assert.equal(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('ignores NaN readings', () => {
    const monitor = new CalibrationMonitor();
    monitor.addRelative(NaN);
    monitor.addAbsolute(0, NaN);
    turn(monitor, { degrees: 120 });
    assert.equal(monitor.status(), CalibrationStatus.GOOD);
});
