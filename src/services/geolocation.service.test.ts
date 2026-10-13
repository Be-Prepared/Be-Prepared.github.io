import { CitiesService } from './cities.service';
import { diOverride } from '../di';
import {
    GeolocationCoordinateResult,
    GeolocationCoordinateResultSuccess,
    GeolocationService,
} from './geolocation.service';
import { AccessState } from './access/access-controller';
import { PermissionStatus } from './access/permission-status';
import { Subject } from 'rxjs';
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

// A service with a clock, timers, permission reports, and page reloads that
// the test controls.
function access(initial: PermissionStatus | null = PermissionStatus.PROMPT) {
    const fake = install();
    const permission = new Subject<PermissionStatus>();
    const timers: { at: number; fn: () => void }[] = [];
    const clock = { now: 0, reloads: 0, canReload: true };
    const service = new GeolocationService({
        clearTimeout: (handle) => {
            const index = timers.indexOf(handle);

            if (index >= 0) {
                timers.splice(index, 1);
            }
        },
        now: () => clock.now,
        permission: () => permission,
        reload: () => {
            if (clock.canReload) {
                clock.reloads += 1;
            }

            return clock.canReload;
        },
        setTimeout: (fn, ms) => {
            const timer = { at: clock.now + ms, fn };
            timers.push(timer);

            return timer;
        },
    });
    const states: AccessState[] = [];
    const subscription = service
        .availabilityState()
        .subscribe((state) => states.push(state));

    if (initial) {
        permission.next(initial);
    }

    return {
        advance(ms: number) {
            clock.now += ms;

            for (const timer of [...timers]) {
                if (timer.at <= clock.now) {
                    timers.splice(timers.indexOf(timer), 1);
                    timer.fn();
                }
            }
        },
        allow: () => fake.pending.shift()!.success({} as GeolocationPosition),
        clock,
        fake,
        permission,
        refuse: () => {
            const callbacks = fake.pending.shift()!;
            callbacks.error({
                code: PERMISSION_DENIED,
                message: '',
                PERMISSION_DENIED,
                POSITION_UNAVAILABLE,
                TIMEOUT: 3,
            } as GeolocationPositionError);
        },
        service,
        states,
        subscription,
        timers,
    };
}

test('nothing is reported until the permission has been looked at', () => {
    const { permission, states, subscription } = access(null);
    assert.equal(states.length, 0);
    permission.next(PermissionStatus.GRANTED);
    assert.deepEqual(states, [AccessState.READY]);
    subscription.unsubscribe();
});

test('a request shows checking until the browser answers', () => {
    const { allow, service, states, subscription, timers } = access();
    assert.deepEqual(states, [AccessState.PROMPT]);
    service.request();
    assert.deepEqual(states, [AccessState.PROMPT, AccessState.CHECKING]);
    allow();
    assert.deepEqual(states.slice(2), [AccessState.READY]);
    assert.equal(timers.length, 0);
    subscription.unsubscribe();
});

test('a prompt that is never answered brings the button back', () => {
    const { advance, allow, service, states, subscription } = access();
    service.request();
    advance(7000);
    assert.equal(states[states.length - 1], AccessState.CHECKING);
    advance(2000);
    assert.equal(states[states.length - 1], AccessState.PROMPT);
    // Answered at last.
    allow();
    assert.equal(states[states.length - 1], AccessState.READY);
    subscription.unsubscribe();
});

// Regression test: Safari on iOS refuses every request from a page once it
// has refused one, so "Try Again" did nothing even after Location Services
// was switched on. Only a new page load asks again.
test('a retry that is refused without asking reloads the page', () => {
    const { advance, clock, refuse, service, states, subscription } = access();
    service.request();
    advance(50);
    refuse();
    assert.equal(states[states.length - 1], AccessState.DENIED);
    assert.equal(clock.reloads, 0, 'the first refusal just shows the screen');

    service.request();
    advance(50);
    refuse();
    assert.equal(clock.reloads, 1);
    // Still working, as far as the screen shows, until the page is replaced.
    assert.equal(states[states.length - 1], AccessState.CHECKING);
    subscription.unsubscribe();
});

test('a retry the person answered themselves does not reload', () => {
    const { advance, clock, refuse, service, states, subscription } = access();
    service.request();
    advance(50);
    refuse();
    service.request();
    // Long enough to have read a prompt and tapped "Don't Allow".
    advance(4000);
    refuse();
    assert.equal(clock.reloads, 0);
    assert.deepEqual(states.slice(-2), [AccessState.CHECKING, AccessState.DENIED]);
    subscription.unsubscribe();
});

test('a block the browser remembers is not worth a reload', () => {
    const { advance, clock, permission, refuse, service, states, subscription } =
        access(PermissionStatus.DENIED);
    assert.deepEqual(states, [AccessState.DENIED]);

    for (let i = 0; i < 3; i += 1) {
        service.request();
        advance(10);
        refuse();
    }

    assert.equal(clock.reloads, 0);
    assert.deepEqual(states.slice(-2), [AccessState.CHECKING, AccessState.DENIED]);

    // Fixed in the site settings; the browser says so.
    permission.next(PermissionStatus.GRANTED);
    assert.equal(states[states.length - 1], AccessState.READY);
    subscription.unsubscribe();
});

test('a refused retry shows denied when the page cannot reload', () => {
    const { advance, clock, refuse, service, states, subscription } = access();
    clock.canReload = false;
    service.request();
    advance(10);
    refuse();
    service.request();
    advance(10);
    refuse();
    assert.deepEqual(states.slice(-2), [AccessState.CHECKING, AccessState.DENIED]);
    subscription.unsubscribe();
});

// Safari doesn't report changes made in the Settings app, so its "denied"
// can be out of date.
test('a request that works beats a permission reported as denied', () => {
    const { allow, permission, service, states, subscription } = access(
        PermissionStatus.DENIED
    );
    service.request();
    allow();
    assert.equal(states[states.length - 1], AccessState.READY);

    // Later the browser reports it was taken away again.
    permission.next(PermissionStatus.PROMPT);
    permission.next(PermissionStatus.DENIED);
    assert.equal(states[states.length - 1], AccessState.DENIED);
    subscription.unsubscribe();
});

test('a refusal on the position watch shows the blocked screen', () => {
    const { fake, service, states, subscription } = access(
        PermissionStatus.GRANTED
    );
    const { subscription: watching } = track(service);
    assert.deepEqual(states, [AccessState.READY]);
    // Allowed for the site, blocked by the phone's own settings.
    fake.fail(PERMISSION_DENIED);
    assert.equal(states[states.length - 1], AccessState.DENIED);
    watching.unsubscribe();
    subscription.unsubscribe();
});

test('a position that is slow to arrive still counts as allowed', () => {
    const { fake, service, states, subscription } = access();
    service.request();
    fake.fail(POSITION_UNAVAILABLE);
    assert.equal(states[states.length - 1], AccessState.READY);
    subscription.unsubscribe();
});
