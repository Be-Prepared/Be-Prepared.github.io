import {
    AccessController,
    AccessState,
    classifyMediaError,
} from './access-controller';
import { BehaviorSubject } from 'rxjs';
import { PermissionStatus } from './permission-status';
import assert from 'node:assert/strict';
import { test } from 'node:test';

class FakeDocument {
    visibilityState: 'visible' | 'hidden' = 'visible';
    private _listeners = new Map<string, Set<() => void>>();

    addEventListener(name: string, fn: () => void) {
        if (!this._listeners.has(name)) {
            this._listeners.set(name, new Set());
        }

        this._listeners.get(name)!.add(fn);
    }

    dispatch(name: string) {
        for (const fn of this._listeners.get(name) || []) {
            fn();
        }
    }

    listenerCount() {
        let count = 0;

        for (const set of this._listeners.values()) {
            count += set.size;
        }

        return count;
    }

    removeEventListener(name: string, fn: () => void) {
        this._listeners.get(name)?.delete(fn);
    }
}

interface FakeResource {
    id: number;
    released: boolean;
}

function error(name: string) {
    const e = new Error(name);
    e.name = name;

    return e;
}

function setup(
    initial: PermissionStatus,
    acquireImpl?: () => Promise<FakeResource>,
    options: { releaseWhenHidden?: boolean } = {}
) {
    const permission = new BehaviorSubject(initial);
    const doc = new FakeDocument();
    const win = new FakeDocument();
    const resources: FakeResource[] = [];
    let nextId = 1;
    const acquire =
        acquireImpl ||
        (() => {
            const resource = { id: nextId++, released: false };
            resources.push(resource);

            return Promise.resolve(resource);
        });
    const controller = new AccessController<FakeResource>({
        permission,
        acquire: () => {
            acquireCalls.count += 1;

            return acquire();
        },
        release: (resource) => {
            resource.released = true;
        },
        document: doc as any,
        window: win as any,
        releaseWhenHidden: options.releaseWhenHidden,
    });
    const acquireCalls = { count: 0 };
    const states: AccessState[] = [];
    controller.state.subscribe((state) => states.push(state));

    return {
        acquireCalls,
        controller,
        doc,
        permission,
        resources,
        states,
        win,
    };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('classifyMediaError', () => {
    assert.equal(classifyMediaError(error('NotAllowedError')), AccessState.DENIED);
    assert.equal(classifyMediaError(error('SecurityError')), AccessState.DENIED);
    assert.equal(classifyMediaError(error('NotFoundError')), AccessState.UNAVAILABLE);
    assert.equal(
        classifyMediaError(error('OverconstrainedError')),
        AccessState.UNAVAILABLE
    );
    assert.equal(classifyMediaError(error('NotReadableError')), AccessState.ERROR);
    assert.equal(classifyMediaError(null), AccessState.ERROR);
});

test('granted permission acquires right away', async () => {
    const { controller, resources } = setup(PermissionStatus.GRANTED);
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.READY);
    assert.equal(controller.resource, resources[0]);
});

test('prompt permission waits for a request and acquires nothing', async () => {
    const { acquireCalls, controller } = setup(PermissionStatus.PROMPT);
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.PROMPT);
    assert.equal(acquireCalls.count, 0);
    await controller.request();
    assert.equal(controller.currentState, AccessState.READY);
});

test('unknown permission tries right away', async () => {
    const { controller } = setup(PermissionStatus.UNKNOWN);
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.READY);
});

test('denied permission can be tried again', async () => {
    let allow = false;
    const { controller } = setup(PermissionStatus.DENIED, () =>
        allow
            ? Promise.resolve({ id: 1, released: false })
            : Promise.reject(error('NotAllowedError'))
    );
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.DENIED);

    await controller.request();
    assert.equal(controller.currentState, AccessState.DENIED);

    // The person fixes it in settings and tries again.
    allow = true;
    await controller.request();
    assert.equal(controller.currentState, AccessState.READY);
});

test('permission re-enabled in settings is picked up', async () => {
    const { controller, permission } = setup(PermissionStatus.DENIED);
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.DENIED);
    permission.next(PermissionStatus.GRANTED);
    await tick();
    assert.equal(controller.currentState, AccessState.READY);
});

test('permission revoked while in use releases the resource', async () => {
    const { controller, permission, resources } = setup(
        PermissionStatus.GRANTED
    );
    controller.init();
    await tick();
    permission.next(PermissionStatus.DENIED);
    assert.equal(controller.currentState, AccessState.DENIED);
    assert.ok(resources[0].released);
    assert.equal(controller.resource, null);
});

test('declining the browser prompt shows denied', async () => {
    const { controller } = setup(PermissionStatus.PROMPT, () =>
        Promise.reject(error('NotAllowedError'))
    );
    controller.init();
    await controller.request();
    assert.equal(controller.currentState, AccessState.DENIED);
});

test('missing hardware shows unavailable', async () => {
    const { controller } = setup(PermissionStatus.GRANTED, () =>
        Promise.reject(error('NotFoundError'))
    );
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.UNAVAILABLE);
});

test('hardware in use shows error and can be retried', async () => {
    let busy = true;
    const { controller } = setup(PermissionStatus.GRANTED, () =>
        busy
            ? Promise.reject(error('NotReadableError'))
            : Promise.resolve({ id: 1, released: false })
    );
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.ERROR);
    busy = false;
    await controller.request();
    assert.equal(controller.currentState, AccessState.READY);
});

test('destroy releases the resource and listeners', async () => {
    const { controller, doc, resources, win } = setup(
        PermissionStatus.GRANTED
    );
    controller.init();
    await tick();
    controller.destroy();
    assert.ok(resources[0].released);
    assert.equal(doc.listenerCount(), 0);
    assert.equal(win.listenerCount(), 0);
});

test('destroy while acquiring releases the late resource', async () => {
    let finish: (r: FakeResource) => void = () => {};
    const late = { id: 99, released: false };
    const { controller } = setup(
        PermissionStatus.GRANTED,
        () => new Promise((resolve) => (finish = resolve))
    );
    controller.init();
    controller.destroy();
    finish(late);
    await tick();
    assert.ok(late.released);
});

test('hidden page releases the camera and gets it back when visible', async () => {
    const { controller, doc, resources } = setup(PermissionStatus.GRANTED);
    const seen: (FakeResource | null)[] = [];
    controller.resourceChanges.subscribe((r) => seen.push(r));
    controller.init();
    await tick();
    assert.equal(resources.length, 1);

    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    assert.ok(resources[0].released);
    assert.equal(controller.resource, null);

    doc.visibilityState = 'visible';
    doc.dispatch('visibilitychange');
    await tick();
    assert.equal(resources.length, 2);
    assert.equal(controller.resource, resources[1]);
    assert.deepEqual(
        seen.map((r) => r && r.id),
        [null, 1, null, 2]
    );
});

test('releaseWhenHidden false keeps the resource', async () => {
    const { controller, doc, resources } = setup(
        PermissionStatus.GRANTED,
        undefined,
        { releaseWhenHidden: false }
    );
    controller.init();
    await tick();
    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    assert.equal(resources[0].released, false);
});

test('pagehide always releases and pageshow gets it back', async () => {
    const { controller, resources, win } = setup(
        PermissionStatus.GRANTED,
        undefined,
        { releaseWhenHidden: false }
    );
    controller.init();
    await tick();
    win.dispatch('pagehide');
    assert.ok(resources[0].released);
    assert.equal(controller.resource, null);
    win.dispatch('pageshow');
    await tick();
    assert.equal(controller.resource, resources[1]);
    assert.equal(resources[1].released, false);
});

test('acquire finishing while hidden releases and resumes later', async () => {
    let finish: (r: FakeResource) => void = () => {};
    const { controller, doc } = setup(
        PermissionStatus.GRANTED,
        () => new Promise((resolve) => (finish = resolve))
    );
    controller.init();
    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    const first = { id: 1, released: false };
    finish(first);
    await tick();
    assert.ok(first.released);
    assert.equal(controller.resource, null);
    doc.visibilityState = 'visible';
    doc.dispatch('visibilitychange');
    const second = { id: 2, released: false };
    finish(second);
    await tick();
    assert.equal(controller.resource, second);
});

test('opened while hidden waits until visible', async () => {
    const { acquireCalls, controller, doc } = setup(PermissionStatus.GRANTED);
    doc.visibilityState = 'hidden';
    controller.init();
    await tick();
    assert.equal(acquireCalls.count, 0);
    doc.visibilityState = 'visible';
    doc.dispatch('visibilitychange');
    await tick();
    assert.equal(controller.currentState, AccessState.READY);
});

test('release during acquire then request again gets a fresh resource', async () => {
    const pending: ((r: FakeResource) => void)[] = [];
    const { controller } = setup(
        PermissionStatus.PROMPT,
        () => new Promise((resolve) => pending.push(resolve))
    );
    controller.init();
    controller.request();
    controller.release();
    controller.request();
    assert.equal(pending.length, 2);
    const stale = { id: 1, released: false };
    const fresh = { id: 2, released: false };
    pending[0](stale);
    pending[1](fresh);
    await tick();
    assert.ok(stale.released);
    assert.equal(controller.resource, fresh);
});

test('duplicate requests do not acquire twice', async () => {
    const { acquireCalls, controller } = setup(PermissionStatus.PROMPT);
    controller.init();
    controller.request();
    controller.request();
    await tick();
    controller.request();
    assert.equal(acquireCalls.count, 1);
});

test('an acquire that throws right away shows the error state', async () => {
    const { controller } = setup(PermissionStatus.UNKNOWN, () => {
        throw error('NotSupportedError');
    });
    controller.init();
    await tick();
    assert.equal(controller.currentState, AccessState.UNAVAILABLE);
});
