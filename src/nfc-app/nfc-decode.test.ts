import {
    decodeAction,
    decodeRecord,
    decodeSize,
    decodeText,
    MAX_DEPTH,
    NfcAction,
    NfcKind,
    NfcRecordLike,
    pickTitle,
    toHex,
} from './nfc-decode';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function view(bytes: number[] | Uint8Array) {
    const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    return new DataView(array.buffer, array.byteOffset, array.byteLength);
}

function utf8(text: string) {
    return view(new TextEncoder().encode(text));
}

function text(value: string, lang = 'en', encoding = 'utf-8'): NfcRecordLike {
    return { recordType: 'text', data: utf8(value), lang, encoding };
}

function smartPoster(records: NfcRecordLike[]): NfcRecordLike {
    return {
        recordType: 'smart-poster',
        data: view([0xd1, 0x01, 0x00]),
        toRecords: () => records,
    };
}

test('decodeText honors the encoding and falls back to UTF-8', () => {
    assert.equal(decodeText(utf8('héllo')), 'héllo');
    // "Hi" in UTF-16LE
    assert.equal(decodeText(view([0x48, 0, 0x69, 0]), 'utf-16le'), 'Hi');
    assert.equal(decodeText(utf8('plain'), 'not-a-real-encoding'), 'plain');
    assert.equal(decodeText(null), '');
});

test('decodeText respects the DataView offset', () => {
    const buffer = new TextEncoder().encode('xxHELLOxx');
    const dataView = new DataView(buffer.buffer, 2, 5);
    assert.equal(decodeText(dataView), 'HELLO');
});

test('toHex shows bytes and truncates', () => {
    assert.equal(toHex(view([0, 15, 255])), '00 0f ff');
    assert.equal(toHex(view([1, 2, 3]), 2), '01 02 …');
    assert.equal(toHex(undefined), '');
});

test('decodeAction maps the spec values', () => {
    assert.equal(decodeAction(view([0])), NfcAction.DO);
    assert.equal(decodeAction(view([1])), NfcAction.SAVE);
    assert.equal(decodeAction(view([2])), NfcAction.EDIT);
    assert.equal(decodeAction(view([9])), NfcAction.UNKNOWN);
    assert.equal(decodeAction(view([])), NfcAction.UNKNOWN);
});

test('decodeSize reads big-endian numbers up to 4 bytes', () => {
    assert.equal(decodeSize(view([0, 0, 0x10, 0])), 4096);
    assert.equal(decodeSize(view([0xff, 0xff, 0xff, 0xff])), 4294967295);
    assert.equal(decodeSize(view([5])), 5);
    assert.equal(decodeSize(view([])), undefined);
    assert.equal(decodeSize(view([1, 2, 3, 4, 5])), undefined);
});

test('text records keep language and encoding', () => {
    const decoded = decodeRecord(text('Bonjour', 'fr'));
    assert.equal(decoded.kind, NfcKind.TEXT);
    assert.equal(decoded.text, 'Bonjour');
    assert.equal(decoded.lang, 'fr');
    assert.equal(decoded.encoding, 'utf-8');
    assert.equal(decoded.byteLength, 7);
});

test('url and absolute-url records become links', () => {
    for (const recordType of ['url', 'absolute-url']) {
        const decoded = decodeRecord({
            recordType,
            data: utf8('https://example.com/a'),
        });
        assert.equal(decoded.kind, NfcKind.URL);
        assert.equal(decoded.url, 'https://example.com/a');
    }
});

test('unsafe URLs are shown as text, not links', () => {
    const decoded = decodeRecord({
        recordType: 'url',
        data: utf8('javascript:alert(1)'),
    });
    assert.equal(decoded.kind, NfcKind.TEXT);
    assert.equal(decoded.url, undefined);
    assert.equal(decoded.text, 'javascript:alert(1)');
});

test('image mime records get a data URL', () => {
    const decoded = decodeRecord({
        recordType: 'mime',
        mediaType: 'image/png',
        data: view([0x89, 0x50, 0x4e, 0x47]),
    });
    assert.equal(decoded.kind, NfcKind.IMAGE);
    assert.equal(decoded.mediaType, 'image/png');
    assert.equal(decoded.byteLength, 4);
    assert.equal(decoded.imageSrc, 'data:image/png;base64,iVBORw==');
});

test('image media type parameters do not leak into the URL', () => {
    const decoded = decodeRecord({
        recordType: 'mime',
        mediaType: 'image/svg+xml; charset=utf-8',
        data: utf8('<svg/>'),
    });
    assert.ok(decoded.imageSrc?.startsWith('data:image/svg+xml;base64,'));
});

test('empty image mime records are not shown as images', () => {
    const decoded = decodeRecord({ recordType: 'mime', mediaType: 'image/png' });
    assert.equal(decoded.kind, NfcKind.MIME);
    assert.equal(decoded.imageSrc, undefined);
});

test('text-like mime records are decoded, others shown as hex', () => {
    const json = decodeRecord({
        recordType: 'mime',
        mediaType: 'application/json',
        data: utf8('{"a":1}'),
    });
    assert.equal(json.kind, NfcKind.MIME);
    assert.equal(json.text, '{"a":1}');

    const binary = decodeRecord({
        recordType: 'mime',
        mediaType: 'application/octet-stream',
        data: view([1, 2]),
    });
    assert.equal(binary.kind, NfcKind.MIME);
    assert.equal(binary.hex, '01 02');
    assert.equal(binary.text, undefined);
});

test('empty and unknown records are handled', () => {
    assert.equal(decodeRecord({ recordType: 'empty' }).kind, NfcKind.EMPTY);

    const unknown = decodeRecord({ recordType: 'unknown', data: view([0xab]) });
    assert.equal(unknown.kind, NfcKind.BINARY);
    assert.equal(unknown.hex, 'ab');

    const blank = decodeRecord({ recordType: 'unknown', data: view([]) });
    assert.equal(blank.kind, NfcKind.EMPTY);

    assert.equal(decodeRecord({ recordType: '' }).recordType, 'unknown');
});

test('smart poster decodes nested records', () => {
    const decoded = decodeRecord(
        smartPoster([
            { recordType: 'url', data: utf8('https://example.com') },
            text('Hello', 'en'),
            text('Hola', 'es'),
            { recordType: ':act', data: view([0]) },
            { recordType: ':s', data: view([0, 0, 0x10, 0]) },
            { recordType: ':t', data: utf8('image/png') },
            {
                recordType: 'mime',
                mediaType: 'image/png',
                data: view([1, 2, 3]),
            },
        ])
    );
    assert.equal(decoded.kind, NfcKind.NESTED);
    assert.equal(decoded.recordType, 'smart-poster');
    assert.deepEqual(
        decoded.children.map((child) => child.kind),
        [
            NfcKind.URL,
            NfcKind.TEXT,
            NfcKind.TEXT,
            NfcKind.ACTION,
            NfcKind.SIZE,
            NfcKind.TYPE,
            NfcKind.IMAGE,
        ]
    );
    assert.equal(decoded.children[3].action, NfcAction.DO);
    assert.equal(decoded.children[4].size, 4096);
    assert.equal(decoded.children[5].text, 'image/png');
});

test('a malformed size record is shown as bytes', () => {
    const decoded = decodeRecord({ recordType: ':s', data: view([]) });
    assert.equal(decoded.kind, NfcKind.BINARY);
});

test('external records with a nested message are expanded', () => {
    const decoded = decodeRecord({
        recordType: 'example.com:thing',
        data: view([1]),
        toRecords: () => [text('inside')],
    });
    assert.equal(decoded.kind, NfcKind.NESTED);
    assert.equal(decoded.children[0].text, 'inside');
});

test('toRecords that throws or returns null leaves raw bytes', () => {
    const throwing = decodeRecord({
        recordType: 'example.com:thing',
        data: view([7]),
        toRecords: () => {
            throw new Error('NotSupportedError');
        },
    });
    assert.equal(throwing.kind, NfcKind.BINARY);
    assert.equal(throwing.hex, '07');

    const nothing = decodeRecord({
        recordType: 'smart-poster',
        data: view([7]),
        toRecords: () => null,
    });
    assert.equal(nothing.kind, NfcKind.BINARY);
});

test('nesting stops at the maximum depth', () => {
    // A record that contains itself forever.
    const loop: NfcRecordLike = {
        recordType: 'smart-poster',
        data: view([1]),
        toRecords: () => [loop],
    };
    let decoded = decodeRecord(loop);
    let depth = 0;

    while (decoded.children.length) {
        decoded = decoded.children[0];
        depth += 1;
    }

    assert.equal(depth, MAX_DEPTH);
    assert.equal(decoded.kind, NfcKind.BINARY);
});

test('pickTitle prefers the reader language', () => {
    const decoded = decodeRecord(
        smartPoster([
            { recordType: 'url', data: utf8('https://example.com') },
            text('Hello', 'en-US'),
            text('Hola', 'es'),
        ])
    );
    assert.equal(pickTitle(decoded, ['es-MX', 'en']), 'Hola');
    assert.equal(pickTitle(decoded, ['en-US']), 'Hello');
    assert.equal(pickTitle(decoded, ['en']), 'Hello');
    assert.equal(pickTitle(decoded, ['de']), 'Hello');
    assert.equal(pickTitle(decodeRecord(smartPoster([])), ['en']), undefined);
});
