#!/usr/bin/env node
// Shows how much each feature, library, and static file adds to the app.
//
//   npm run size
//
// JavaScript is attributed per source module using Rollup's size of each
// module after tree shaking, then scaled to the real minified and gzipped
// size of the bundle it ended up in. Those per-feature numbers are close
// estimates, not exact byte counts. Static files are measured directly.

import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'dist-size');
const modules = [];

function groupFor(id) {
    const clean = id.replace(/\?.*$/, '').replace(/^\0/, '');
    const nodeModules = clean.lastIndexOf('node_modules/');

    if (nodeModules >= 0) {
        const rest = clean.slice(nodeModules + 'node_modules/'.length).split('/');
        const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];

        return `library: ${name}`;
    }

    const relative = path.relative(root, clean);
    const parts = relative.split(path.sep);

    if (parts[0] === 'src' && parts.length > 2) {
        if (parts[1] === 'services') {
            const service = parts.length > 3 ? parts[2] : parts[2].replace(/\.service\.ts$|\.ts$/, '');

            return `service: ${service}`;
        }

        return `feature: ${parts[1]}`;
    }

    if (parts[0] === 'src') {
        return `app: ${parts[1]}`;
    }

    return 'other';
}

const sizePlugin = {
    name: 'size-report',
    generateBundle(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
            if (chunk.type !== 'chunk') {
                continue;
            }

            const rendered = Object.values(chunk.modules).reduce(
                (sum, m) => sum + m.renderedLength,
                0
            );
            const minified = Buffer.byteLength(chunk.code);
            const gzipped = gzipSync(chunk.code).length;

            for (const [id, info] of Object.entries(chunk.modules)) {
                const share = rendered ? info.renderedLength / rendered : 0;
                modules.push({
                    group: groupFor(id),
                    minified: share * minified,
                    gzipped: share * gzipped,
                });
            }
        }
    },
};

await build({
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'error',
    plugins: [sizePlugin],
    build: { outDir, emptyOutDir: true },
});

const groups = new Map();

for (const m of modules) {
    const entry = groups.get(m.group) || { minified: 0, gzipped: 0 };
    entry.minified += m.minified;
    entry.gzipped += m.gzipped;
    groups.set(m.group, entry);
}

// Static files, grouped by kind.
function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);

        return entry.isDirectory() ? walk(full) : [full];
    });
}

// Keep in step with workbox.globPatterns in vite.config.ts.
const precacheExtensions = /\.(js|mjs|css|html|svg|xml|txt|wasm|png|ico)$/;
const assets = new Map();

for (const file of walk(outDir)) {
    const name = path.relative(outDir, file);

    if (/\.m?js$/.test(name) && !/^(sw|workbox-)/.test(name)) {
        continue; // Already counted per module above.
    }

    let kind = 'other files';

    if (/cities/.test(name)) kind = 'data: cities.txt (Sun & Moon city lookup)';
    else if (/\.wasm$/.test(name)) kind = 'wasm: ZBar barcode reader';
    else if (/\.svg$/.test(name)) kind = 'icons (SVG)';
    else if (/\.(png|ico)$/.test(name)) kind = 'launcher icons (PNG/ICO)';
    else if (/^(sw|workbox-)/.test(name)) kind = 'service worker';
    else if (/\.(html|webmanifest|xml|txt)$/.test(name)) kind = 'pages and manifest';

    const data = fs.readFileSync(file);
    const entry = assets.get(kind) || { raw: 0, gzipped: 0, files: 0, precached: 0 };
    entry.raw += data.length;
    entry.gzipped += gzipSync(data).length;
    entry.files += 1;

    if (precacheExtensions.test(name)) {
        entry.precached += data.length;
    }

    assets.set(kind, entry);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const rows = [...groups.entries()].sort((a, b) => b[1].gzipped - a[1].gzipped);
const jsTotal = rows.reduce((t, [, v]) => ({ m: t.m + v.minified, g: t.g + v.gzipped }), { m: 0, g: 0 });

console.log('## JavaScript by feature, service, and library\n');
console.log('| Part | Minified | Gzipped | Share |');
console.log('|---|---:|---:|---:|');

for (const [group, v] of rows) {
    console.log(`| ${group} | ${kb(v.minified)} | ${kb(v.gzipped)} | ${((v.gzipped / jsTotal.g) * 100).toFixed(1)}% |`);
}

console.log(`| **All JavaScript** | **${kb(jsTotal.m)}** | **${kb(jsTotal.g)}** | |`);
console.log('\n## Other files\n');
console.log('| Kind | Files | Size | Gzipped | Precached for offline |');
console.log('|---|---:|---:|---:|---:|');

for (const [kind, v] of [...assets.entries()].sort((a, b) => b[1].raw - a[1].raw)) {
    console.log(`| ${kind} | ${v.files} | ${kb(v.raw)} | ${kb(v.gzipped)} | ${v.precached === v.raw ? 'yes' : v.precached ? 'partly' : 'no'} |`);
}

fs.rmSync(outDir, { recursive: true, force: true });
