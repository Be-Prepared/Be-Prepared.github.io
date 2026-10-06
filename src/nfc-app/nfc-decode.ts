// Turns Web NFC records into plain objects the screen can show. No DOM or
// Fudgel here so it can be tested with fake records.
//
// Smart posters (and some external records) hold a whole NDEF message as
// their payload. Web NFC exposes the inner records through toRecords(), and
// inside a smart poster the local types ":act", ":s" and ":t" describe the
// action, size, and type of the linked content.

// The subset of NDEFRecord that is used, so tests can pass plain objects.
export interface NfcRecordLike {
    recordType: string;
    mediaType?: string | null;
    id?: string | null;
    data?: DataView | null;
    encoding?: string | null;
    lang?: string | null;
    toRecords?: (() => NfcRecordLike[] | null) | null;
}

export enum NfcKind {
    ACTION = 'ACTION',
    BINARY = 'BINARY',
    EMPTY = 'EMPTY',
    IMAGE = 'IMAGE',
    MIME = 'MIME',
    NESTED = 'NESTED',
    SIZE = 'SIZE',
    TEXT = 'TEXT',
    TYPE = 'TYPE',
    URL = 'URL',
}

// Values of a smart poster's ":act" record (NFC Forum Smart Poster RTD).
export enum NfcAction {
    DO = 'DO',
    SAVE = 'SAVE',
    EDIT = 'EDIT',
    UNKNOWN = 'UNKNOWN',
}

export interface NfcDecodedRecord {
    action?: NfcAction;
    byteLength: number;
    children: NfcDecodedRecord[];
    encoding?: string;
    hex?: string;
    id?: string;
    // data: URL for image/* records, so the screen can show the picture.
    imageSrc?: string;
    kind: NfcKind;
    lang?: string;
    mediaType?: string;
    recordType: string;
    size?: number;
    text?: string;
    url?: string;
}

// Deeper nesting than this is almost certainly a malformed or hostile tag.
export const MAX_DEPTH = 4;

// Raw bytes are shown as hex; long payloads are cut off.
export const MAX_HEX_BYTES = 64;

// Images bigger than this aren't turned into a data: URL.
export const MAX_IMAGE_BYTES = 256 * 1024;

export function bytesOf(data?: DataView | null): Uint8Array {
    if (!data) {
        return new Uint8Array(0);
    }

    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export function decodeText(data?: DataView | null, encoding?: string | null) {
    const bytes = bytesOf(data);

    try {
        return new TextDecoder(encoding || 'utf-8').decode(bytes);
    } catch (_ignore) {
        // Unknown encoding label. UTF-8 is the most likely.
        return new TextDecoder('utf-8').decode(bytes);
    }
}

export function toHex(data?: DataView | null, max = MAX_HEX_BYTES) {
    const bytes = bytesOf(data);
    const shown = Array.from(bytes.subarray(0, max), (byte) =>
        byte.toString(16).padStart(2, '0')
    ).join(' ');

    return bytes.length > max ? `${shown} …` : shown;
}

export function decodeAction(data?: DataView | null): NfcAction {
    const bytes = bytesOf(data);

    switch (bytes.length ? bytes[0] : -1) {
        case 0:
            return NfcAction.DO;

        case 1:
            return NfcAction.SAVE;

        case 2:
            return NfcAction.EDIT;

        default:
            return NfcAction.UNKNOWN;
    }
}

// The spec says a 4 byte big-endian number. Be lenient with shorter values.
export function decodeSize(data?: DataView | null): number | undefined {
    const bytes = bytesOf(data);

    if (!bytes.length || bytes.length > 4) {
        return undefined;
    }

    return bytes.reduce((total, byte) => total * 256 + byte, 0);
}

export function isSafeUrl(url: string) {
    return /^(https?|mailto|tel|sms|geo):/i.test(url.trim());
}

export function imageDataUrl(mediaType: string, data?: DataView | null) {
    const bytes = bytesOf(data);

    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
        return undefined;
    }

    let binary = '';

    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }

    // Only the media type itself, without parameters that could break out
    // of the URL.
    const type = mediaType.split(';')[0].trim().toLowerCase();

    if (!/^image\/[a-z0-9.+-]+$/.test(type)) {
        return undefined;
    }

    return `data:${type};base64,${btoa(binary)}`;
}

function nestedRecords(record: NfcRecordLike): NfcRecordLike[] | null {
    if (typeof record.toRecords !== 'function') {
        return null;
    }

    try {
        const records = record.toRecords();

        return Array.isArray(records) ? records : null;
    } catch (_ignore) {
        // The payload isn't an NDEF message.
        return null;
    }
}

export function decodeRecord(
    record: NfcRecordLike,
    depth = 0
): NfcDecodedRecord {
    const bytes = bytesOf(record.data);
    const result: NfcDecodedRecord = {
        byteLength: bytes.length,
        children: [],
        kind: NfcKind.BINARY,
        recordType: record.recordType || 'unknown',
    };

    if (record.id) {
        result.id = record.id;
    }

    if (record.mediaType) {
        result.mediaType = record.mediaType;
    }

    if (record.encoding) {
        result.encoding = record.encoding;
    }

    if (record.lang) {
        result.lang = record.lang;
    }

    switch (record.recordType) {
        case 'empty':
            result.kind = NfcKind.EMPTY;

            return result;

        case 'text':
            result.kind = NfcKind.TEXT;
            result.text = decodeText(record.data, record.encoding);

            return result;

        case 'url':
        case 'absolute-url': {
            const text = decodeText(record.data);
            result.text = text;

            if (isSafeUrl(text)) {
                result.kind = NfcKind.URL;
                result.url = text;
            } else {
                result.kind = NfcKind.TEXT;
            }

            return result;
        }

        case 'mime': {
            const mediaType = record.mediaType || '';

            if (/^image\//i.test(mediaType)) {
                result.imageSrc = imageDataUrl(mediaType, record.data);
                result.kind = result.imageSrc ? NfcKind.IMAGE : NfcKind.MIME;
            } else if (
                /^text\/|[/+]json$|[/+]xml$/i.test(mediaType) &&
                bytes.length
            ) {
                result.kind = NfcKind.MIME;
                result.text = decodeText(record.data);
            } else {
                result.kind = NfcKind.MIME;
                result.hex = toHex(record.data);
            }

            return result;
        }

        case ':act':
            result.kind = NfcKind.ACTION;
            result.action = decodeAction(record.data);

            return result;

        case ':s':
            result.kind = NfcKind.SIZE;
            result.size = decodeSize(record.data);

            if (result.size === undefined) {
                result.kind = NfcKind.BINARY;
                result.hex = toHex(record.data);
            }

            return result;

        case ':t':
            result.kind = NfcKind.TYPE;
            result.text = decodeText(record.data);

            return result;
    }

    // smart-poster, external types (domain:type), and local types can hold
    // a nested message.
    const children = depth < MAX_DEPTH ? nestedRecords(record) : null;

    if (children) {
        result.kind = NfcKind.NESTED;
        result.children = children.map((child) =>
            decodeRecord(child, depth + 1)
        );

        return result;
    }

    if (!bytes.length) {
        result.kind = NfcKind.EMPTY;
    } else {
        result.hex = toHex(record.data);
    }

    return result;
}

// A smart poster's title in the reader's language, for a heading. Falls
// back to the first title.
export function pickTitle(
    record: NfcDecodedRecord,
    languages: readonly string[]
): string | undefined {
    const titles = record.children.filter(
        (child) => child.kind === NfcKind.TEXT && child.recordType === 'text'
    );

    for (const language of languages) {
        const wanted = language.toLowerCase();
        const exact = titles.find(
            (title) => (title.lang || '').toLowerCase() === wanted
        );

        if (exact) {
            return exact.text;
        }

        const base = wanted.split('-')[0];
        const partial = titles.find(
            (title) => (title.lang || '').toLowerCase().split('-')[0] === base
        );

        if (partial) {
            return partial.text;
        }
    }

    return titles[0] && titles[0].text;
}
