import { CalibrationMonitor, CalibrationStatus } from './calibration-monitor';
import { normalize360 } from './compass-math';
import test from 'ava';

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

test('starts unknown', (t) => {
    t.is(new CalibrationMonitor().status(), CalibrationStatus.UNKNOWN);
});

test('stays unknown without gyroscope data', (t) => {
    const monitor = new CalibrationMonitor();

    for (let i = 0; i < 50; i += 1) {
        monitor.addAbsolute(i * 50, i * 5);
    }

    t.is(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('stays unknown while holding still', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 5 });
    t.is(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('good when the compass follows the gyroscope', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120 });
    t.is(monitor.status(), CalibrationStatus.GOOD);
});

test('handles wrapping past north', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120, compassStart: 300, relativeStart: 330 });
    t.is(monitor.status(), CalibrationStatus.GOOD);
});

test('handles turning counterclockwise', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: -150, compassStart: 20 });
    t.is(monitor.status(), CalibrationStatus.GOOD);
});

test('poor when the compass barely moves', (t) => {
    // The "jiggles but doesn't really turn" failure.
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 180, compassScale: 0.2 });
    t.is(monitor.status(), CalibrationStatus.POOR);
});

test('poor when the compass overshoots', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 90, compassScale: 2 });
    t.is(monitor.status(), CalibrationStatus.POOR);
});

test('poor when the compass turns the wrong way', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 90, compassScale: -1 });
    t.is(monitor.status(), CalibrationStatus.POOR);
});

test('slow turns outside the window are ignored', (t) => {
    const monitor = new CalibrationMonitor({ windowMs: 1000 });
    turn(monitor, { degrees: 90, compassScale: 0.1, durationMs: 60000 });
    t.is(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('recovers after calibration', (t) => {
    const monitor = new CalibrationMonitor({ goodChecksToClear: 2 });
    turn(monitor, { degrees: 90, compassScale: 0.2 });
    t.is(monitor.status(), CalibrationStatus.POOR);

    // One good turn is not enough to trust it again.
    turn(monitor, { degrees: 90, startTime: 10000 });
    t.is(monitor.status(), CalibrationStatus.POOR);

    turn(monitor, { degrees: 90, startTime: 20000 });
    t.is(monitor.status(), CalibrationStatus.GOOD);
});

test('iOS accuracy', (t) => {
    const monitor = new CalibrationMonitor();
    monitor.addAccuracy(10);
    t.is(monitor.status(), CalibrationStatus.GOOD);
    monitor.addAccuracy(45);
    t.is(monitor.status(), CalibrationStatus.POOR);
    monitor.addAccuracy(-1);
    t.is(monitor.status(), CalibrationStatus.POOR);
    monitor.addAccuracy(5);
    t.is(monitor.status(), CalibrationStatus.GOOD);
});

test('magnetic field strength', (t) => {
    const monitor = new CalibrationMonitor();
    monitor.addField(20, 30, -25);
    t.is(monitor.status(), CalibrationStatus.GOOD);
    monitor.addField(200, 0, 0);
    t.is(monitor.status(), CalibrationStatus.POOR);
    monitor.addField(1, 1, 1);
    t.is(monitor.status(), CalibrationStatus.POOR);
});

test('any poor signal wins', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120 });
    monitor.addAccuracy(90);
    t.is(monitor.status(), CalibrationStatus.POOR);
});

test('reset', (t) => {
    const monitor = new CalibrationMonitor();
    turn(monitor, { degrees: 120, compassScale: 0 });
    monitor.reset();
    t.is(monitor.status(), CalibrationStatus.UNKNOWN);
});

test('ignores NaN readings', (t) => {
    const monitor = new CalibrationMonitor();
    monitor.addRelative(NaN);
    monitor.addAbsolute(0, NaN);
    turn(monitor, { degrees: 120 });
    t.is(monitor.status(), CalibrationStatus.GOOD);
});
