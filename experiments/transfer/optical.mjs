#!/usr/bin/env node
// Optical bench: renders real QR codes, degrades them roughly the way a
// phone camera filming another screen would, and decodes them with the
// same ZBar (WASM) library the app falls back to. Reports how often each QR
// version decodes and how long decoding takes, then which version moves the
// most data per second.
//
//   node optical.mjs --camera=720 --fill=0.6 --runs=20
//
// --camera  camera frame height in pixels (the QR is fit to this)
// --fill    fraction of the frame height the QR takes up
// --blur    comma-separated Gaussian blur sigmas in camera pixels
// --noise   sensor noise standard deviation (0-255 scale)
// --contrast  black and white levels as "black:white" (screen glare lifts
//             black, dim screens lower white)
//
// This is a model, not a phone. Use it to rank options and find where
// decoding falls off a cliff, then confirm the winners on real devices.

import QRCodeModule from '@tofandel/qrcode-svg';
import { mulberry32 } from './lib/prng.mjs';
import { scanImageData } from '@undecaf/zbar-wasm';

const QRCode = QRCodeModule.default || QRCodeModule;
const options = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((a) => a.startsWith('--'))
        .map((a) => {
            const [key, value] = a.slice(2).split('=');

            return [key, value ?? 'true'];
        })
);
const cameraHeight = +(options.camera || 720);
const fill = +(options.fill || 0.6);
const runs = +(options.runs || 20);
const blurs = (options.blur || '0.6,1.2,1.8,2.4').split(',').map(Number);
const noise = +(options.noise || 6);
const [black, white] = (options.contrast || '30:220').split(':').map(Number);
const fps = +(options.fps || 10);
const versions = (options.versions || '10,15,20,25,30,35,40')
    .split(',')
    .map(Number);
const ecl = options.ecl || 'L';

// Byte-mode capacity per version (ISO/IEC 18004), so content lands on the
// intended version.
const DATA_CODEWORDS_L = [19, 34, 55, 80, 108, 136, 156, 194, 232, 274, 324, 370, 428, 461, 523, 589, 647, 721, 795, 861, 932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735, 1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956];
const DATA_CODEWORDS_M = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453, 507, 563, 627, 669, 714, 782, 860, 914, 1000, 1062, 1128, 1193, 1267, 1373, 1455, 1541, 1631, 1725, 1812, 1914, 1992, 2102, 2216, 2334];
const codewords = ecl === 'M' ? DATA_CODEWORDS_M : DATA_CODEWORDS_L;

function byteCapacity(version) {
    return Math.floor((codewords[version - 1] * 8 - 4 - (version <= 9 ? 8 : 16)) / 8);
}

const BASE64 =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function randomContent(length, rng) {
    let text = '';

    for (let i = 0; i < length; i += 1) {
        text += BASE64[Math.floor(rng() * 64)];
    }

    return text;
}

// Draws the QR into a grayscale image the size of the camera frame, with
// 2x2 supersampling so module edges land between pixels like a real lens.
function rasterize(modules, rng) {
    const count = modules.length;
    const quiet = 4;
    const size = Math.round(cameraHeight * fill);
    const width = Math.round((cameraHeight * 4) / 3);
    const height = cameraHeight;
    const scale = size / (count + quiet * 2);
    // Small random placement offset so pixel alignment varies run to run.
    const left = (width - size) / 2 + rng();
    const top = (height - size) / 2 + rng();
    const gray = new Float32Array(width * height).fill(white);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let dark = 0;

            for (let sy = 0.25; sy < 1; sy += 0.5) {
                for (let sx = 0.25; sx < 1; sx += 0.5) {
                    const mx = Math.floor((x + sx - left) / scale) - quiet;
                    const my = Math.floor((y + sy - top) / scale) - quiet;

                    if (mx >= 0 && my >= 0 && mx < count && my < count && modules[my][mx]) {
                        dark += 0.25;
                    }
                }
            }

            gray[y * width + x] = white - (white - black) * dark;
        }
    }

    return { gray, width, height, modulePixels: scale };
}

function gaussianKernel(sigma) {
    const radius = Math.max(1, Math.ceil(sigma * 3));
    const kernel = [];
    let total = 0;

    for (let i = -radius; i <= radius; i += 1) {
        const w = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel.push(w);
        total += w;
    }

    return { radius, kernel: kernel.map((w) => w / total) };
}

// Separable Gaussian blur: defocus, motion, and display pixel bleed.
function blur(image, sigma) {
    if (sigma <= 0) {
        return image;
    }

    const { gray, width, height } = image;
    const { radius, kernel } = gaussianKernel(sigma);
    const temp = new Float32Array(gray.length);
    const out = new Float32Array(gray.length);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let sum = 0;

            for (let i = -radius; i <= radius; i += 1) {
                const xx = Math.min(width - 1, Math.max(0, x + i));
                sum += gray[y * width + xx] * kernel[i + radius];
            }

            temp[y * width + x] = sum;
        }
    }

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let sum = 0;

            for (let i = -radius; i <= radius; i += 1) {
                const yy = Math.min(height - 1, Math.max(0, y + i));
                sum += temp[yy * width + x] * kernel[i + radius];
            }

            out[y * width + x] = sum;
        }
    }

    return { ...image, gray: out };
}

function toImageData(image, rng) {
    const { gray, width, height } = image;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < gray.length; i += 1) {
        // Box-Muller Gaussian noise.
        const n =
            noise *
            Math.sqrt(-2 * Math.log(rng() || 1e-12)) *
            Math.cos(2 * Math.PI * rng());
        const v = gray[i] + n;
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
    }

    return { data, width, height };
}

async function trial(version, sigma, run) {
    const rng = mulberry32(version * 1000003 + Math.round(sigma * 100) * 7919 + run);
    // Aim between the previous version's capacity and this one's.
    const low = version > 1 ? byteCapacity(version - 1) + 1 : 1;
    const length = Math.floor(low + (byteCapacity(version) - low) * 0.9);
    const content = randomContent(length, rng);
    const qr = new QRCode({ content, ecl, padding: 0 }).qrcode;
    const image = blur(rasterize(qr.modules, rng), sigma);
    const imageData = toImageData(image, rng);
    const start = process.hrtime.bigint();
    const symbols = await scanImageData(imageData);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const ok = symbols.some((s) => s.decode() === content);

    return { actualVersion: qr.typeNumber, length, modulePixels: image.modulePixels, ms, ok };
}

console.log(
    `Camera ${Math.round((cameraHeight * 4) / 3)}x${cameraHeight}, QR fills ${Math.round(fill * 100)}% of height, ` +
        `noise σ=${noise}, levels ${black}..${white}, ECC ${ecl}, ${runs} runs per cell, ${fps} frames/s\n`
);
console.log(
    `| QR version | Bytes | Pixels per module | ${blurs
        .map((b) => `blur σ=${b}: decoded / ms / bytes per s`)
        .join(' | ')} |`
);
console.log(`|---:|---:|---:|${blurs.map(() => '---:').join('|')}|`);

const best = Object.fromEntries(blurs.map((b) => [b, { rate: 0, version: 0 }]));

for (const version of versions) {
    const cells = [];
    let length = 0;
    let modulePixels = 0;

    for (const sigma of blurs) {
        let decoded = 0;
        let totalMs = 0;

        for (let run = 0; run < runs; run += 1) {
            const result = await trial(version, sigma, run);
            length = result.length;
            modulePixels = result.modulePixels;
            totalMs += result.ms;

            if (result.ok) {
                decoded += 1;
            }

            if (result.actualVersion !== version) {
                throw new Error(`Expected version ${version}, got ${result.actualVersion}`);
            }
        }

        const rate = decoded / runs;
        // Content is base64 text, so real payload is 3/4 of the characters.
        const bytesPerSecond = rate * fps * length * 0.75;

        if (bytesPerSecond > best[sigma].rate) {
            best[sigma] = { rate: bytesPerSecond, version };
        }

        cells.push(
            `${Math.round(rate * 100)}% / ${(totalMs / runs).toFixed(0)} / ${Math.round(bytesPerSecond)}`
        );
        process.stderr.write('.');
    }

    console.log(`| ${version} | ${length} | ${modulePixels.toFixed(2)} | ${cells.join(' | ')} |`);
}

process.stderr.write('\n');
console.log('');

for (const sigma of blurs) {
    console.log(
        `Blur σ=${sigma}: best is version ${best[sigma].version} at about ${Math.round(best[sigma].rate)} bytes/s`
    );
}
