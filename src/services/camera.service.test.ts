import { CameraService } from './camera.service';
import test from 'ava';

function fakeTrack(options: { torch?: boolean; applyHangs?: boolean }) {
    const log: string[] = [];
    const track = {
        log,
        getCapabilities: () => (options.torch ? { torch: true } : {}),
        getSettings: () => ({ torch: options.torch }),
        applyConstraints: (constraints: any) => {
            log.push(`apply ${JSON.stringify(constraints.advanced[0])}`);

            return options.applyHangs
                ? new Promise(() => {})
                : Promise.resolve();
        },
        stop: () => log.push('stop'),
    };

    return track;
}

function fakeStream(track: any) {
    return { getTracks: () => [track] } as any as MediaStream;
}

test('close stops a track without a torch right away', async (t) => {
    const track = fakeTrack({});
    await new CameraService().close(fakeStream(track));
    t.deepEqual(track.log, ['stop']);
});

test('close turns the torch off before stopping', async (t) => {
    // Leaving the magnifier with the light on must turn the light off.
    const track = fakeTrack({ torch: true });
    await new CameraService().close(fakeStream(track));
    t.deepEqual(track.log, ['apply {"torch":false}', 'stop']);
});

test('close still stops when the torch never answers', async (t) => {
    const track = fakeTrack({ torch: true, applyHangs: true });
    await new CameraService().close(fakeStream(track));
    t.deepEqual(track.log, ['apply {"torch":false}', 'stop']);
});
