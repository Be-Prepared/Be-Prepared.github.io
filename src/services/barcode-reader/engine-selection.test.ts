import {
    BarcodeEngine,
    chooseEngine,
    nativeUsable,
    normalizeEngine,
} from './engine-selection';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const working = { available: true, formats: ['qr_code', 'ean_13'] };
const empty = { available: true, formats: [] };
const failed = { available: true, formats: null };
const missing = { available: false, formats: null };

test('native is usable only when present and reporting formats', () => {
    assert.equal(nativeUsable(working), true);
    assert.equal(nativeUsable(empty), false);
    assert.equal(nativeUsable(failed), false);
    assert.equal(nativeUsable(missing), false);
    assert.equal(nativeUsable({ available: false, formats: ['qr_code'] }), false);
});

test('automatic prefers native when it works', () => {
    assert.deepEqual(chooseEngine(BarcodeEngine.AUTOMATIC, working), {
        engine: BarcodeEngine.NATIVE,
        fellBack: false,
    });
});

test('automatic uses ZBar when native is missing or empty', () => {
    for (const probe of [empty, failed, missing]) {
        assert.deepEqual(chooseEngine(BarcodeEngine.AUTOMATIC, probe), {
            engine: BarcodeEngine.Z_BAR,
            fellBack: false,
        });
    }
});

test('no saved preference behaves like automatic', () => {
    assert.equal(chooseEngine(null, working).engine, BarcodeEngine.NATIVE);
    assert.equal(chooseEngine(undefined, missing).engine, BarcodeEngine.Z_BAR);
});

test('ZBar is used when asked for, even if native works', () => {
    assert.deepEqual(chooseEngine(BarcodeEngine.Z_BAR, working), {
        engine: BarcodeEngine.Z_BAR,
        fellBack: false,
    });
});

test('native is used when asked for and it works', () => {
    assert.deepEqual(chooseEngine(BarcodeEngine.NATIVE, working), {
        engine: BarcodeEngine.NATIVE,
        fellBack: false,
    });
});

test('asking for native when it cannot work falls back and says so', () => {
    for (const probe of [empty, failed, missing]) {
        assert.deepEqual(chooseEngine(BarcodeEngine.NATIVE, probe), {
            engine: BarcodeEngine.Z_BAR,
            fellBack: true,
        });
    }
});

test('normalizeEngine rejects unknown values', () => {
    assert.equal(normalizeEngine('NATIVE'), BarcodeEngine.NATIVE);
    assert.equal(normalizeEngine('Z_BAR'), BarcodeEngine.Z_BAR);
    assert.equal(normalizeEngine('zbar'), BarcodeEngine.AUTOMATIC);
    assert.equal(normalizeEngine(null), BarcodeEngine.AUTOMATIC);
    assert.equal(normalizeEngine(7), BarcodeEngine.AUTOMATIC);
});
