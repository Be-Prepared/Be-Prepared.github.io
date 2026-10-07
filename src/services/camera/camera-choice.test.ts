import { camerasFacing, facingOf, nextCamera } from './camera-choice';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const cam = (deviceId: string, label: string, facingMode?: string[]) => ({
    deviceId,
    kind: 'videoinput',
    label,
    ...(facingMode ? { getCapabilities: () => ({ facingMode }) } : {}),
});
const android = [
    cam('a', 'camera2 1, facing front'),
    cam('b', 'camera2 0, facing back'),
    cam('c', 'camera2 2, facing back'),
    cam('d', 'camera2 3, facing front'),
    { deviceId: 'mic', kind: 'audioinput', label: 'Microphone' },
];

test('facing comes from capabilities or the name', () => {
    assert.equal(facingOf(cam('x', '', ['environment'])), 'environment');
    assert.equal(facingOf(cam('x', '', ['user'])), 'user');
    assert.equal(facingOf(cam('x', 'Back Ultra Wide Camera')), 'environment');
    assert.equal(facingOf(cam('x', 'Front Camera')), 'user');
    assert.equal(facingOf(cam('x', 'FaceTime HD Camera')), 'user');
    assert.equal(facingOf(cam('x', 'USB Webcam')), null);
    assert.equal(facingOf(cam('x', 'Feedback Capture')), null);
});

test('only cameras facing the right way are offered', () => {
    assert.deepEqual(camerasFacing(android, 'environment'), ['b', 'c']);
    assert.deepEqual(camerasFacing(android, 'user'), ['a', 'd']);
});

test('the camera in use is always offered', () => {
    const devices = [...android, cam('e', 'Rückkamera')];
    assert.deepEqual(camerasFacing(devices, 'environment', 'e'), ['b', 'c', 'e']);
    assert.deepEqual(camerasFacing(devices, 'environment'), ['b', 'c']);
});

test('every camera is offered when the browser says nothing about facing', () => {
    const webcams = [cam('a', 'USB Webcam'), cam('b', 'Integrated Webcam')];
    assert.deepEqual(camerasFacing(webcams, 'environment'), ['a', 'b']);
    assert.deepEqual(camerasFacing(webcams, 'user'), ['a', 'b']);
});

test('cameras without an id (before permission) are not offered', () => {
    assert.deepEqual(camerasFacing([cam('', ''), cam('', '')], 'user'), []);
});

test('one camera, or one per side, leaves nothing to switch to', () => {
    const phone = [cam('a', 'Front Camera'), cam('b', 'Back Camera')];
    assert.equal(camerasFacing(phone, 'environment').length, 1);
    assert.equal(camerasFacing(phone, 'user').length, 1);
});

test('nextCamera cycles and wraps', () => {
    assert.equal(nextCamera(['a', 'b', 'c'], 'a'), 'b');
    assert.equal(nextCamera(['a', 'b', 'c'], 'c'), 'a');
    assert.equal(nextCamera(['a', 'b', 'c'], 'gone'), 'a');
    assert.equal(nextCamera([], 'a'), '');
});
