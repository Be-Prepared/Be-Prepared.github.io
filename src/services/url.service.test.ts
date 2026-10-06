import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UrlService } from './url.service';

const urlService = new UrlService();

test('isUrl accepts allowed schemes', () => {
    assert.equal(urlService.isUrl('https://example.com'), true);
    assert.equal(urlService.isUrl('geo:37.78,-122.39'), true);
    assert.equal(urlService.isUrl('mailto:someone@example.com'), true);
});

test('isUrl ignores the case of the scheme', () => {
    assert.equal(urlService.isUrl('HTTPS://EXAMPLE.COM'), true);
    assert.equal(urlService.isUrl('Http://example.com'), true);
    assert.equal(urlService.isUrl('GEO:37.78,-122.39'), true);
});

test('isUrl rejects other text', () => {
    assert.equal(urlService.isUrl('javascript:alert(1)'), false);
    assert.equal(urlService.isUrl('JAVASCRIPT:alert(1)'), false);
    assert.equal(urlService.isUrl('hello world'), false);
    assert.equal(urlService.isUrl('httpsx://example.com'), false);
});
