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

// A camera that shows whatever SVG the test hands to window.__show, on a
// white background. For pointing the app's scanner at real QR codes.
function installPictureCamera() {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 720, 720);
    // Browsers only send a new frame when the canvas changes.
    setInterval(() => {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 4, 4);
    }, 50);
    (window as any).__show = (svg: string) =>
        new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                context.fillStyle = '#fff';
                context.fillRect(0, 0, 720, 720);
                context.drawImage(image, 40, 40, 640, 640);
                resolve();
            };
            image.onerror = () => reject(new Error('Bad SVG'));
            image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        });

    if (typeof MediaDevices !== 'undefined') {
        MediaDevices.prototype.enumerateDevices = async () =>
            [{ kind: 'videoinput', deviceId: 'fake', label: '', groupId: '' }] as any;
        MediaDevices.prototype.getUserMedia = async () =>
            (canvas as any).captureStream(30) as MediaStream;
    }

    if (typeof Permissions !== 'undefined') {
        const query = Permissions.prototype.query;
        Permissions.prototype.query = function (descriptor: any) {
            return descriptor.name === 'camera'
                ? Promise.resolve({ state: 'granted', onchange: null } as any)
                : query.call(this, descriptor);
        };
    }
}

export async function pictureCamera(page: Page) {
    await page.addInitScript(installPictureCamera);
}

// A phone with several cameras: two on the back and two on the front. Each
// request is recorded on window.__opened, and each stream reports the
// camera it came from, like a real one.
function installManyCameras() {
    const cameras = [
        { deviceId: 'front-0', label: 'camera2 1, facing front' },
        { deviceId: 'back-0', label: 'camera2 0, facing back' },
        { deviceId: 'back-1', label: 'camera2 2, facing back' },
        { deviceId: 'front-1', label: 'camera2 3, facing front' },
    ];
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d')!;
    setInterval(() => {
        context.fillStyle = `hsl(${Date.now() % 360} 40% 40%)`;
        context.fillRect(0, 0, 640, 480);
    }, 50);
    (window as any).__opened = [];
    (window as any).__streams = [];

    if (typeof MediaDevices !== 'undefined') {
        MediaDevices.prototype.enumerateDevices = async () =>
            cameras.map((camera) => ({ ...camera, kind: 'videoinput', groupId: '' })) as any;
        MediaDevices.prototype.getUserMedia = async (constraints: any) => {
            const video = constraints.video || {};
            const wanted = video.deviceId?.exact;
            const deviceId =
                wanted || (video.facingMode === 'user' ? 'front-0' : 'back-0');

            if (!cameras.some((camera) => camera.deviceId === deviceId)) {
                const error = new Error('No such camera');
                error.name = 'OverconstrainedError';
                throw error;
            }

            const stream = (canvas as any).captureStream(15) as MediaStream;
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings.bind(track);
            track.getSettings = () => ({ ...settings(), deviceId });
            // WebKit forgets the patch above when nothing keeps the track
            // object alive, so keep it.
            ((window as any).__tracks ??= []).push(track);
            (window as any).__opened.push(deviceId);
            (window as any).__streams.push(stream);

            return stream;
        };
    }

    if (typeof Permissions !== 'undefined') {
        const query = Permissions.prototype.query;
        Permissions.prototype.query = function (descriptor: any) {
            return descriptor.name === 'camera'
                ? Promise.resolve({ state: 'granted', onchange: null } as any)
                : query.call(this, descriptor);
        };
    }
}

export async function manyCameras(page: Page) {
    await page.addInitScript(installManyCameras);
}
