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
        permissions,
        get queries() {
            return queries;
        },
        status,
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
