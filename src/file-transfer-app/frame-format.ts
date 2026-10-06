// How a file travels as QR codes (protocol version 2).
//
// QR text: "https://be-prepared.github.io/r#" + payload
//
// The URL lets a phone's own camera app open the receiver. It goes in a
// byte segment, and the payload in an alphanumeric segment, which QR packs
// at 5.5 bits per character instead of 8. The payload alphabet is the part
// of QR's alphanumeric set that is safe in a URL (no space, "%" or "+").
// Every 2 bytes become 3 characters (42³ > 65536), the same density as
// Base45 (RFC 9285): about 30% more data per QR code than base64 in bytes.
//
// Payload bytes, big-endian:
//
//   0      version (2)
//   1-4    CRC-32 of the whole container; also identifies the transfer
//   5-8    container length in bytes
//   9-12   seed: which blocks this frame combines (see fountain.ts)
//   13-    one block; every frame's block is the same length
//
// Container: one flags byte (bit 0: the rest is zlib "deflate"
// compressed, which every browser with CompressionStream supports),
// then the name and type as length-prefixed UTF-8, then the file.

export const FRAME_VERSION = 2;
export const HEADER_BYTES = 13;
export const URL_PREFIX = 'https://be-prepared.github.io/r#';
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*-./:';
const BASE = ALPHABET.length;
const FLAG_DEFLATE = 1;

export interface FileMeta {
    contentType: string;
    filename: string;
}

export interface Frame {
    checksum: number;
    length: number;
    seed: number;
    block: Uint8Array;
}

export function toAlphanumeric(bytes: Uint8Array) {
    let result = '';

    for (let i = 0; i + 1 < bytes.length; i += 2) {
        let n = bytes[i] * 256 + bytes[i + 1];
        const c = n % BASE;
        n = (n - c) / BASE;
        const b = n % BASE;
        result += ALPHABET[c] + ALPHABET[b] + ALPHABET[(n - b) / BASE];
    }

    if (bytes.length % 2) {
        const n = bytes[bytes.length - 1];
        result += ALPHABET[n % BASE] + ALPHABET[Math.floor(n / BASE)];
    }

    return result;
}

export function fromAlphanumeric(text: string) {
    if (text.length % 3 === 1) {
        throw new Error('Bad length');
    }

    const bytes = new Uint8Array(Math.floor(text.length / 3) * 2 + (text.length % 3 ? 1 : 0));
    const digit = (i: number) => {
        const d = ALPHABET.indexOf(text[i]);

        if (d < 0) {
            throw new Error('Bad character');
        }

        return d;
    };
    let out = 0;

    for (let i = 0; i < text.length; i += 3) {
        if (i + 2 < text.length) {
            const n = digit(i) + digit(i + 1) * BASE + digit(i + 2) * BASE * BASE;

            if (n > 0xffff) {
                throw new Error('Bad group');
            }

            bytes[out++] = n >> 8;
            bytes[out++] = n & 0xff;
        } else {
            const n = digit(i) + digit(i + 1) * BASE;

            if (n > 0xff) {
                throw new Error('Bad group');
            }

            bytes[out++] = n;
        }
    }

    return bytes;
}

let crcTable: Uint32Array | null = null;

export function crc32(bytes: Uint8Array) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);

        for (let n = 0; n < 256; n += 1) {
            let c = n;

            for (let i = 0; i < 8; i += 1) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }

            crcTable[n] = c >>> 0;
        }
    }

    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
        crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

export function encodeFrame(frame: Frame) {
    const bytes = new Uint8Array(HEADER_BYTES + frame.block.length);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, FRAME_VERSION);
    view.setUint32(1, frame.checksum);
    view.setUint32(5, frame.length);
    view.setUint32(9, frame.seed);
    bytes.set(frame.block, HEADER_BYTES);

    return URL_PREFIX + toAlphanumeric(bytes);
}

// Throws when the text isn't a version 2 frame.
export function decodeFrame(text: string): Frame {
    const bytes = fromAlphanumeric(text.slice(text.indexOf('#') + 1));
    const view = new DataView(bytes.buffer);

    if (bytes.length <= HEADER_BYTES || view.getUint8(0) !== FRAME_VERSION) {
        throw new Error('Not a version 2 frame');
    }

    return {
        checksum: view.getUint32(1),
        length: view.getUint32(5),
        seed: view.getUint32(9),
        block: bytes.subarray(HEADER_BYTES),
    };
}

export function splitBlocks(data: Uint8Array, blockSize: number) {
    const blocks: Uint8Array[] = [];

    for (let i = 0; i < data.length; i += blockSize) {
        const block = new Uint8Array(blockSize);
        block.set(data.subarray(i, i + blockSize));
        blocks.push(block);
    }

    return blocks;
}

export function joinBlocks(blocks: Uint8Array[], length: number) {
    const data = new Uint8Array(length);

    blocks.forEach((block, i) => {
        const start = i * block.length;
        data.set(block.subarray(0, Math.max(0, length - start)), start);
    });

    return data;
}

async function transform(data: Uint8Array, stream: TransformStream) {
    const response = new Response(new Blob([data.slice()]).stream().pipeThrough(stream));

    return new Uint8Array(await response.arrayBuffer());
}

function concat(parts: Uint8Array[]) {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;

    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }

    return result;
}

function withLength(text: string) {
    const bytes = new TextEncoder().encode(text);
    const length = Math.min(bytes.length, 0xffff);

    return concat([new Uint8Array([length >> 8, length & 0xff]), bytes.subarray(0, length)]);
}

// Wraps a file and its name for sending. Compresses when the browser can
// and it makes the file smaller.
export async function packFile(file: Uint8Array, meta: FileMeta) {
    const plain = concat([withLength(meta.filename), withLength(meta.contentType), file]);

    if (typeof CompressionStream !== 'undefined') {
        try {
            const packed = await transform(plain, new CompressionStream('deflate'));

            if (packed.length < plain.length) {
                return concat([new Uint8Array([FLAG_DEFLATE]), packed]);
            }
        } catch (_ignore) {
            // Send it uncompressed.
        }
    }

    return concat([new Uint8Array([0]), plain]);
}

export async function unpackFile(container: Uint8Array): Promise<[Uint8Array, FileMeta]> {
    let plain = container.subarray(1);

    if (container[0] & FLAG_DEFLATE) {
        plain = await transform(plain, new DecompressionStream('deflate'));
    }

    const decoder = new TextDecoder();
    let offset = 0;
    const read = () => {
        const length = (plain[offset] << 8) | plain[offset + 1];
        const text = decoder.decode(plain.subarray(offset + 2, offset + 2 + length));
        offset += 2 + length;

        return text;
    };
    const filename = read();
    const contentType = read();

    return [plain.subarray(offset), { contentType, filename }];
}
