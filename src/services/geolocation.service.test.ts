import { CitiesService } from './cities.service';
import { diOverride } from 'fudgel/dist/di';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from './geolocation.service';
import assert from 'node:assert/strict';
import { test } from 'node:test';

diOverride(CitiesService, {} as unknown as CitiesService);

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;

interface Callbacks {
    success: PositionCallback;
    error: PositionErrorCallback;
}

class FakeGeolocation {
    watches = new Map<number, Callbacks>();
    pending: Callbacks[] = [];
    nextId = 1;
    watchCount = 0;

    getCurrentPosition(success: PositionCallback, error: PositionErrorCallback) {
        this.pending.push({ success, error });
    }

    watchPosition(success: PositionCallback, error: PositionErrorCallback) {
        const id = this.nextId++;
        this.watches.set(id, { success, error });
        this.watchCount += 1;

        return id;
    }

    clearWatch(id: number) {
        this.watches.delete(id);
    }

    private _all() {
        const all = [...this.pending, ...this.watches.values()];
        this.pending = [];

        return all;
    }

    // Delivers to one listener, like a real watch.
    fix(lat: number, lon: number, timestamp: number, speed: number | null) {
        const target = [...this.watches.values()][0];
        target.success({
            timestamp,
            coords: {
                latitude: lat,
                longitude: lon,
                accuracy: 5,
                altitude: null,
                altitudeAccuracy: null,
                speed,
                heading: null,
            },
        } as unknown as GeolocationPosition);
    }

    fail(code: number) {
        for (const callbacks of this._all()) {
            callbacks.error({
                code,
                message: '',
                PERMISSION_DENIED,
                POSITION_UNAVAILABLE,
                TIMEOUT: 3,
            } as GeolocationPositionError);
        }
    }
}

function install() {
    const fake = new FakeGeolocation();
    Object.defineProperty(globalThis.navigator, 'geolocation', {
        value: fake,
        configurable: true,
    });

    return fake;
}

function track(service: GeolocationService) {
    const results: GeolocationCoordinateResult[] = [];
    const subscription = service
        .getPosition()
        .subscribe((result) => results.push(result));

    return { results, subscription };
}

function last(results: GeolocationCoordinateResult[]) {
    const result = results[results.length - 1];
    assert.ok(result.success);

    return result as GeolocationCoordinateResultSuccess;
}

// About 11.1 m per 0.0001 degrees of latitude.
const STEP = 0.0001;

test('max speed uses the calculated speed when the device has none', () => {
    const fake = install();
    const service = new GeolocationService();
    const { results, subscription } = track(service);
    fake.fix(0, 0, 0, null);
    fake.fix(STEP, 0, 1000, null);
    fake.fix(STEP * 2, 0, 2000, null);
    const current = last(results);
    assert.ok(current.speed > 10 && current.speed < 12.5, `${current.speed}`);
    assert.equal(current.speedMax, current.speed);
    subscription.unsubscribe();
});

test('a transient error keeps the totals and does not count the gap', () => {
    const fake = install();
    const service = new GeolocationService();
    const { results, subscription } = track(service);
    fake.fix(0, 0, 0, 5);
    fake.fix(STEP, 0, 1000, 5);
    fake.fix(STEP * 2, 0, 2000, 5);
    const before = last(results);
    assert.ok(before.distanceTraveled > 20);
    assert.equal(before.timeMoving, 2000);
    fake.fail(POSITION_UNAVAILABLE);
    assert.equal(results[results.length - 1].success, false);

    // Far away after the tunnel.
    fake.fix(0.1, 0, 60000, 5);
    const after = last(results);
    assert.equal(after.distanceTraveled, before.distanceTraveled);
    assert.equal(after.timeMoving, before.timeMoving);
    assert.equal(after.timeTotal, before.timeTotal);
    assert.equal(after.speedMax, before.speedMax);
    assert.equal(after.firstPosition, before.firstPosition);

    // Measuring continues from the new baseline.
    fake.fix(0.1 + STEP, 0, 61000, 5);
    const next = last(results);
    assert.ok(next.distanceTraveled > before.distanceTraveled + 10);
    assert.ok(next.distanceTraveled < before.distanceTraveled + 12.5);
    assert.equal(next.timeMoving, before.timeMoving + 1000);
    subscription.unsubscribe();
});

test('the watch restarts after permission is denied and later granted', () => {
    const fake = install();
    const service = new GeolocationService();
    const { results, subscription } = track(service);
    assert.equal(fake.watches.size, 1);
    fake.fail(PERMISSION_DENIED);
    assert.equal(fake.watches.size, 0, 'dead watch is cleared');

    // "Try Again": request() succeeds.
    service.request();
    fake.pending.shift()!.success({} as GeolocationPosition);
    assert.equal(fake.watches.size, 1, 'watch started again');
    fake.fix(1, 2, 1000, 0);
    assert.equal(last(results).lat, 1);
    subscription.unsubscribe();
});

test('a new subscriber after a denial restarts the watch', () => {
    const fake = install();
    const service = new GeolocationService();
    const first = track(service);
    fake.fail(PERMISSION_DENIED);
    assert.equal(fake.watches.size, 0);
    const second = track(service);
    assert.equal(fake.watches.size, 1);
    assert.equal(fake.watchCount, 2);

    // Not restarted again while the watch is healthy.
    track(service).subscription.unsubscribe();
    assert.equal(fake.watchCount, 2);
    first.subscription.unsubscribe();
    second.subscription.unsubscribe();
});
