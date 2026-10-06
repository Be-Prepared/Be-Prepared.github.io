import { applyOrder, mergeOrder, moveItem } from './tile-order';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const tiles = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (items: { id: string }[]) => items.map((item) => item.id);

test('applyOrder keeps the default without a saved order', () => {
    assert.deepEqual(ids(applyOrder(tiles('a', 'b', 'c'), null)), ['a', 'b', 'c']);
});

test('applyOrder follows the saved order', () => {
    assert.deepEqual(ids(applyOrder(tiles('a', 'b', 'c'), ['c', 'a', 'b'])), [
        'c',
        'a',
        'b',
    ]);
});

test('applyOrder puts unknown tiles at the end and drops missing ones', () => {
    assert.deepEqual(
        ids(applyOrder(tiles('a', 'b', 'new'), ['b', 'gone', 'a'])),
        ['b', 'a', 'new']
    );
});

test('moveItem moves forward and backward', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
    assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
});

test('moveItem ignores out-of-range moves', () => {
    const items = ['a', 'b'];
    assert.equal(moveItem(items, 0, 0), items);
    assert.equal(moveItem(items, 0, 5), items);
    assert.equal(moveItem(items, -1, 1), items);
});

test('mergeOrder keeps hidden tiles in place', () => {
    // "nfc" is hidden on this phone. Reordering the visible ones must not
    // lose its spot.
    const all = ['a', 'nfc', 'b', 'c'];
    assert.deepEqual(mergeOrder(['c', 'a', 'b'], null, all), ['c', 'nfc', 'a', 'b']);
});

test('mergeOrder builds on the previous order', () => {
    const all = ['a', 'b', 'c', 'd'];
    assert.deepEqual(mergeOrder(['d', 'c'], ['b', 'c', 'd', 'a'], all), [
        'b',
        'd',
        'c',
        'a',
    ]);
});
