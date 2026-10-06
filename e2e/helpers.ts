import { expect, Page } from '@playwright/test';

// Fake hardware, installed before the app loads. Browsers in CI have no
// camera or sensors, and their permission prompts differ, so the tests
// control both directly.
//
// The fakes patch prototypes, not instances: WebKit doesn't always return
// the same navigator.mediaDevices object, so a patch on one instance can be
// lost and the real (blocked) camera used instead.

function installCameraFake(mode: 'working' | 'blocked') {
    const fakeDevices = async () =>
        [{ kind: 'videoinput', deviceId: 'fake', label: '', groupId: '' }] as any;

    if (typeof MediaDevices !== 'undefined') {
        MediaDevices.prototype.enumerateDevices = fakeDevices;
    }

    if (typeof Permissions !== 'undefined') {
        const query = Permissions.prototype.query;
        Permissions.prototype.query = function (descriptor: any) {
            if (descriptor.name === 'camera') {
                return Promise.resolve({
                    state: mode === 'working' ? 'granted' : 'denied',
                    onchange: null,
                } as any);
            }

            return query.call(this, descriptor);
        };
    }

    (window as any).__streams = [];

    if (mode === 'blocked') {
        if (typeof MediaDevices !== 'undefined') {
            MediaDevices.prototype.getUserMedia = async () => {
                const error = new Error('Permission denied');
                error.name = 'NotAllowedError';
                throw error;
            };
        }

        return;
    }

    // A camera that works: a moving canvas pattern. Streams are recorded on
    // window.__streams so tests can check they were stopped.
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d')!;
    let frame = 0;
    const draw = () => {
        frame += 1;
        context.fillStyle = '#456';
        context.fillRect(0, 0, 640, 480);
        context.fillStyle = '#fff';
        context.fillRect((frame * 7) % 640, 200, 60, 60);
    };
    draw();
    setInterval(draw, 50);

    if (typeof MediaDevices !== 'undefined') {
        MediaDevices.prototype.getUserMedia = async () => {
            const stream = (canvas as any).captureStream(15) as MediaStream;
            (window as any).__streams.push(stream);

            return stream;
        };
    }
}

// A camera that works.
export async function fakeCamera(page: Page) {
    await page.addInitScript(installCameraFake, 'working' as const);
}

// A camera the person has blocked.
export async function blockedCamera(page: Page) {
    await page.addInitScript(installCameraFake, 'blocked' as const);
}

// Collects uncaught errors so each test can assert there were none.
export function watchErrors(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    return {
        expectNone: () => expect(errors, errors.join('\n')).toEqual([]),
    };
}

// True when nothing makes the page wider than the screen.
export async function expectNoHorizontalScroll(page: Page) {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
}
