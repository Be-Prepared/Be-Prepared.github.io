import {
    PermissionStatus,
    toPermissionStatus,
    watchPermission,
} from './permission-status';
import test from 'ava';

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

test('toPermissionStatus', (t) => {
    t.is(toPermissionStatus('granted'), PermissionStatus.GRANTED);
    t.is(toPermissionStatus('denied'), PermissionStatus.DENIED);
    t.is(toPermissionStatus('prompt'), PermissionStatus.PROMPT);
    t.is(toPermissionStatus('weird'), PermissionStatus.UNKNOWN);
    t.is(toPermissionStatus(undefined), PermissionStatus.UNKNOWN);
});

test('reports the current state and changes', async (t) => {
    const fake = fakePermissions('prompt');
    const seen: PermissionStatus[] = [];
    const sub = watchPermission('camera', fake.permissions).subscribe((s) =>
        seen.push(s)
    );
    await tick();
    fake.change('granted');
    fake.change('granted');
    fake.change('denied');
    t.deepEqual(seen, [
        PermissionStatus.PROMPT,
        PermissionStatus.GRANTED,
        PermissionStatus.DENIED,
    ]);
    sub.unsubscribe();
    t.is(fake.status.onchange, null);
});

test('unknown when the permission name is not supported', async (t) => {
    const fake = fakePermissions(new TypeError('bad name'));
    const seen: PermissionStatus[] = [];
    watchPermission('nfc', fake.permissions).subscribe((s) => seen.push(s));
    await tick();
    t.deepEqual(seen, [PermissionStatus.UNKNOWN]);
});

test('unknown without the Permissions API', (t) => {
    const seen: PermissionStatus[] = [];
    watchPermission('camera', undefined).subscribe((s) => seen.push(s));
    t.deepEqual(seen, [PermissionStatus.UNKNOWN]);
});

test('nothing is cached between subscriptions', async (t) => {
    const fake = fakePermissions('denied');
    watchPermission('camera', fake.permissions).subscribe().unsubscribe();
    watchPermission('camera', fake.permissions).subscribe();
    await tick();
    t.is(fake.queries, 2);
});
