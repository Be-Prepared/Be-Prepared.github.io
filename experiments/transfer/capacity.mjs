#!/usr/bin/env node
// How many file bytes fit in one QR frame, and what that means for transfer
// time. Compares today's frame format with proposed ones.
//
//   node capacity.mjs --fps=10 --file=1048576 --decode=0.9
//
// --decode is the fraction of shown frames the receiver decodes (measure it
// with the optical bench described in README.md). Overheads come from
// sim.mjs results on a perfect channel; loss is accounted for by --decode.

const options = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((a) => a.startsWith('--'))
        .map((a) => {
            const [key, value] = a.slice(2).split('=');

            return [key, value ?? 'true'];
        })
);
const fps = +(options.fps || 10);
const fileBytes = +(options.file || 1048576);
const decodeRate = +(options.decode || 1);

// Data codewords (bytes) per QR version, from ISO/IEC 18004 table 7.
const DATA_CODEWORDS = {
    L: [19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 647, 721, 795, 861, 932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956],
    M: [16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453, 507, 563, 627, 669, 714, 782, 860, 914, 1000, 1062, 1128, 1193, 1267, 1373, 1455, 1541, 1631, 1725, 1812, 1914, 1992, 2102, 2216, 2334],
};

const URL_PREFIX = 'https://be-prepared.github.io/r#'.length;

// Bits for one QR segment holding `length` characters.
function byteSegmentBits(version, length) {
    return 4 + (version <= 9 ? 8 : 16) + 8 * length;
}

function alphanumericSegmentBits(version, length) {
    const countBits = version <= 9 ? 9 : version <= 26 ? 11 : 13;

    return 4 + countBits + 11 * Math.floor(length / 2) + 6 * (length % 2);
}

// Characters needed to carry `bytes` of binary data.
const base64Length = (bytes) => 4 * Math.ceil(bytes / 3);
// Base45 (RFC 9285) uses exactly QR's alphanumeric character set: 2 bytes
// become 3 characters, so QR packs it at 11 bits per 2 characters.
const base45Length = (bytes) => 3 * Math.floor(bytes / 2) + 2 * (bytes % 2);

// Frame formats. `header` is bytes before the payload; `segments` returns
// the total QR bits for a frame carrying `bytes` (header included).
const AVERAGE_DEGREE = 5.77; // The app's distribution; see sim.mjs.
const formats = [
    {
        name: 'today: URL + base64, index list',
        header: 16 + 4 * AVERAGE_DEGREE,
        bits: (v, bytes) => byteSegmentBits(v, URL_PREFIX + base64Length(bytes)),
        overhead: +(options['today-overhead'] || 1.338),
    },
    {
        name: 'URL + base45, index list',
        header: 16 + 4 * AVERAGE_DEGREE,
        bits: (v, bytes) =>
            byteSegmentBits(v, URL_PREFIX) +
            alphanumericSegmentBits(v, base45Length(bytes)),
        overhead: +(options['today-overhead'] || 1.338),
    },
    {
        name: 'URL + base45, seeded (16-byte header)',
        header: 16,
        bits: (v, bytes) =>
            byteSegmentBits(v, URL_PREFIX) +
            alphanumericSegmentBits(v, base45Length(bytes)),
        overhead: +(options['new-overhead'] || 1.002),
    },
];

function maxPayload(format, version, level) {
    const capacityBits = DATA_CODEWORDS[level][version - 1] * 8;
    let low = 0;
    let high = 4096;

    while (high - low > 1) {
        const mid = (low + high) >>> 1;
        const total = Math.ceil(mid + format.header);

        if (format.bits(version, total) <= capacityBits) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return low;
}

function transferSeconds(format, payload) {
    if (payload <= 0) {
        return Infinity;
    }

    const blocks = Math.ceil(fileBytes / payload);
    const framesShown = (blocks * format.overhead) / decodeRate;

    return framesShown / fps;
}

const fmtTime = (seconds) =>
    seconds === Infinity
        ? '—'
        : seconds >= 60
          ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
          : `${seconds.toFixed(1)}s`;

console.log(
    `File ${fileBytes} bytes, ${fps} frames/s, ${Math.round(decodeRate * 100)}% of frames decoded\n`
);

for (const level of ['L', 'M']) {
    console.log(`Error correction ${level}: payload bytes per frame / time to transfer\n`);
    console.log(`| QR version | ${formats.map((f) => f.name).join(' | ')} |`);
    console.log(`|---:|${formats.map(() => '---:').join('|')}|`);

    for (const version of [5, 10, 15, 20, 25, 30, 35, 40]) {
        const cells = formats.map((format) => {
            const payload = maxPayload(format, version, level);

            return `${payload} B / ${fmtTime(transferSeconds(format, payload))}`;
        });
        console.log(`| ${version} | ${cells.join(' | ')} |`);
    }

    console.log('');
}
