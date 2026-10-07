// Which cameras a "switch camera" button should cycle through.
//
// Phones with several lenses list each as its own camera. Browsers say
// which way a camera faces either directly (Chrome) or only in its name
// ("camera2 0, facing back", "Back Ultra Wide Camera"). Names are empty
// until the person has allowed the camera, so ask after a stream is open.

export type Facing = 'environment' | 'user';

export interface CameraInfo {
    deviceId: string;
    kind: string;
    label: string;
    // Chrome's InputDeviceInfo; missing elsewhere.
    getCapabilities?: () => { facingMode?: string[] };
}

const BACK = /\b(back|rear|environment)\b/i;
const FRONT = /\b(front|user|facetime|selfie)\b/i;

// Which way a camera faces, or null when the browser doesn't say.
export function facingOf(camera: CameraInfo): Facing | null {
    let reported: string[] = [];

    try {
        reported = camera.getCapabilities?.().facingMode || [];
    } catch (_ignore) {}

    if (reported.includes('environment') || BACK.test(camera.label)) {
        return 'environment';
    }

    if (reported.includes('user') || FRONT.test(camera.label)) {
        return 'user';
    }

    return null;
}

// The cameras to offer for one side, in the browser's order.
//
// * When the browser tells us which way cameras face, only those facing
//   the right way, plus the one in use (it was opened for this side, so it
//   belongs even if its name says nothing).
// * When it tells us nothing at all (a laptop with two webcams, or names in
//   a language we can't read), every camera, so there's still a way to
//   switch.
export function camerasFacing(
    devices: CameraInfo[],
    facing: Facing,
    currentId = ''
): string[] {
    const cameras = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
    const known = cameras.some((camera) => facingOf(camera));
    const chosen = known
        ? cameras.filter(
              (camera) => facingOf(camera) === facing || camera.deviceId === currentId
          )
        : cameras;

    return Array.from(new Set(chosen.map((camera) => camera.deviceId)));
}

// The camera after the current one, wrapping around. With an unknown
// current camera, the first.
export function nextCamera(ids: string[], currentId: string): string {
    return ids[(ids.indexOf(currentId) + 1) % ids.length] || '';
}
