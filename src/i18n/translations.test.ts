// Every translation must have exactly the English keys, keep the same
// {{placeholders}} and HTML tags, and not be left in English by accident.
import assert from 'node:assert/strict';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { enUS } from './en-us';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) || []).sort();
const tags = (text: string) =>
    (text.match(/<\/?[a-z][a-z0-9-]*/gi) || []).map((t) => t.toLowerCase()).sort();
const files = readdirSync(new URL('./translations', import.meta.url)).filter((f) =>
    /^[a-z-]+\.ts$/i.test(f)
);

test('every listed language has a file, and every file is listed', () => {
    const listed = Object.keys(LANGUAGES).filter((tag) => tag !== DEFAULT_LANGUAGE);
    assert.deepEqual(files.map((f) => f.replace(/\.ts$/, '')).sort(), listed.sort());
});

test('every listed language loads', async () => {
    for (const tag of Object.keys(LANGUAGES)) {
        const strings = await LANGUAGES[tag].load();
        assert.equal(typeof strings['app.title'], 'string', tag);
    }
});

for (const file of files) {
    test(`${file} matches English`, async () => {
        const { strings } = await import(`./translations/${file}`);
        const missing = Object.keys(enUS).filter((key) => !(key in strings));
        const extra = Object.keys(strings).filter((key) => !(key in enUS));
        assert.deepEqual(missing, [], 'missing keys');
        assert.deepEqual(extra, [], 'unknown keys');

        for (const key of Object.keys(enUS)) {
            const value = strings[key];
            assert.equal(typeof value, 'string', key);
            assert.ok(value.trim() || !enUS[key].trim(), `${key} is empty`);
            assert.deepEqual(placeholders(value), placeholders(enUS[key]), `${key} placeholders`);
            assert.deepEqual(tags(value), tags(enUS[key]), `${key} HTML tags`);
        }
    });
}
