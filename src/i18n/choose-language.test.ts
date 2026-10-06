import assert from 'node:assert/strict';
import { chooseLanguage } from './choose-language';
import { test } from 'node:test';

const available = ['', 'en', 'en-US', 'es', 'pt-BR'];

test('exact match wins', () => {
    assert.equal(chooseLanguage(['pt-BR'], available), 'pt-BR');
    assert.equal(chooseLanguage(['en-US'], available), 'en-US');
});

test('same language in another region', () => {
    assert.equal(chooseLanguage(['es-MX'], available), 'es');
    assert.equal(chooseLanguage(['pt-PT'], available), 'pt-BR');
    assert.equal(chooseLanguage(['en-GB'], available), 'en');
});

test('later preferences are used when the first is unavailable', () => {
    // Someone who prefers Japanese but also reads Spanish.
    assert.equal(chooseLanguage(['ja-JP', 'ja', 'es-ES'], available), 'es');
});

test('case does not matter', () => {
    assert.equal(chooseLanguage(['PT-br'], available), 'pt-BR');
});

test('nothing usable falls back to the default', () => {
    assert.equal(chooseLanguage(['ja', 'ko'], available), '');
    assert.equal(chooseLanguage([], available), '');
    assert.equal(chooseLanguage([''], available), '');
});
