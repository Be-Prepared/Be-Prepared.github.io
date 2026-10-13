import {
    PermissionStatus,
    toPermissionStatus,
    watchPermission,
} from './permission-status';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakePermissions(state: string | Error) {
    const status = { state: '', onchange: null as null | (() => void) };
    let queries = 0;
    const permissions = {
        query: () => {
            queries += 1;

            if (state instanceof Error) {
                return Promise.reject(state);
            }

            status.state = state;

            return Promise.resolve(status);
        },
    } as any as Permissions;

    return {
        change(newState: string) {
            status.state = newState;
            status.onchange?.();
        },
        // Changed where the browser doesn't tell the page, like the iOS
        // Settings app.
        changeQuietly(newState: string) {
            state = newState;
        },
        permissions,
        get queries() {
            return queries;
        },
        status,
    };
}

function fakeDocument() {
    const listeners = new Set<() => void>();

    return {
        visibilityState: 'visible' as DocumentVisibilityState,
        addEventListener: (_name: string, fn: any) => listeners.add(fn),
        removeEventListener: (_name: string, fn: any) => listeners.delete(fn),
        get listeners() {
            return listeners.size;
        },
        show() {
            this.visibilityState = 'visible';
            listeners.forEach((fn) => fn());
        },
        hide() {
            this.visibilityState = 'hidden';
            listeners.forEach((fn) => fn());
        },
    };
}

test('toPermissionStatus', () => {
    assert.equal(toPermissionStatus('granted'), PermissionStatus.GRANTED);
    assert.equal(toPermissionStatus('denied'), PermissionStatus.DENIED);
    assert.equal(toPermissionStatus('prompt'), PermissionStatus.PROMPT);
    assert.equal(toPermissionStatus('weird'), PermissionStatus.UNKNOWN);
    assert.equal(toPermissionStatus(undefined), PermissionStatus.UNKNOWN);
});

test('reports the current state and changes', async () => {
    const fake = fakePermissions('prompt');
    const seen: PermissionStatus[] = [];
    const sub = watchPermission('camera', fake.permissions).subscribe((s) =>
        seen.push(s)
    );
    await tick();
    fake.change('granted');
    fake.change('granted');
    fake.change('denied');
    assert.deepEqual(seen, [
        PermissionStatus.PROMPT,
        PermissionStatus.GRANTED,
        PermissionStatus.DENIED,
    ]);
    sub.unsubscribe();
    assert.equal(fake.status.onchange, null);
});

test('unknown when the permission name is not supported', async () => {
    const fake = fakePermissions(new TypeError('bad name'));
    const seen: PermissionStatus[] = [];
    watchPermission('nfc', fake.permissions).subscribe((s) => seen.push(s));
    await tick();
    assert.deepEqual(seen, [PermissionStatus.UNKNOWN]);
});

test('unknown without the Permissions API', () => {
    const seen: PermissionStatus[] = [];
    watchPermission('camera', undefined).subscribe((s) => seen.push(s));
    assert.deepEqual(seen, [PermissionStatus.UNKNOWN]);
});

test('nothing is cached between subscriptions', async () => {
    const fake = fakePermissions('denied');
    watchPermission('camera', fake.permissions).subscribe().unsubscribe();
    watchPermission('camera', fake.permissions).subscribe();
    await tick();
    assert.equal(fake.queries, 2);
});

// iOS doesn't report changes made in the Settings app, so the permission is
// looked at again when the person comes back.
test('looks again when the page becomes visible', async () => {
    const fake = fakePermissions('denied');
    const doc = fakeDocument();
    const seen: PermissionStatus[] = [];
    const sub = watchPermission('geolocation', fake.permissions, doc).subscribe(
        (s) => seen.push(s)
    );
    await tick();
    assert.deepEqual(seen, [PermissionStatus.DENIED]);

    doc.hide();
    await tick();
    assert.equal(fake.queries, 1);

    fake.changeQuietly('prompt');
    doc.show();
    await tick();
    assert.equal(fake.queries, 2);
    assert.deepEqual(seen, [PermissionStatus.DENIED, PermissionStatus.PROMPT]);

    // Nothing new, nothing reported.
    doc.hide();
    doc.show();
    await tick();
    assert.equal(seen.length, 2);

    sub.unsubscribe();
    assert.equal(doc.listeners, 0);
    doc.show();
    await tick();
    assert.equal(fake.queries, 3);
});
