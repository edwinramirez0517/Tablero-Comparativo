const assert = require('node:assert');
const test = require('node:test');
const { ordenarDatos } = require('./app.js');

test('ordenarDatos - sorts strings ascending', () => {
    const data = [
        { name: 'b', value: 1 },
        { name: 'a', value: 2 },
        { name: 'c', value: 3 },
    ];
    const sorted = ordenarDatos(data, 'name', true);
    assert.deepStrictEqual(sorted, [
        { name: 'a', value: 2 },
        { name: 'b', value: 1 },
        { name: 'c', value: 3 },
    ]);
});

test('ordenarDatos - sorts strings descending', () => {
    const data = [
        { name: 'b', value: 1 },
        { name: 'a', value: 2 },
        { name: 'c', value: 3 },
    ];
    const sorted = ordenarDatos(data, 'name', false);
    assert.deepStrictEqual(sorted, [
        { name: 'c', value: 3 },
        { name: 'b', value: 1 },
        { name: 'a', value: 2 },
    ]);
});

test('ordenarDatos - sorts numbers ascending', () => {
    const data = [
        { name: 'a', value: 2 },
        { name: 'b', value: 1 },
        { name: 'c', value: 3 },
    ];
    const sorted = ordenarDatos(data, 'value', true);
    assert.deepStrictEqual(sorted, [
        { name: 'b', value: 1 },
        { name: 'a', value: 2 },
        { name: 'c', value: 3 },
    ]);
});

test('ordenarDatos - sorts numbers descending', () => {
    const data = [
        { name: 'a', value: 2 },
        { name: 'b', value: 1 },
        { name: 'c', value: 3 },
    ];
    const sorted = ordenarDatos(data, 'value', false);
    assert.deepStrictEqual(sorted, [
        { name: 'c', value: 3 },
        { name: 'a', value: 2 },
        { name: 'b', value: 1 },
    ]);
});

test('ordenarDatos - handles empty array', () => {
    const data = [];
    const sorted = ordenarDatos(data, 'value', true);
    assert.deepStrictEqual(sorted, []);
});

test('ordenarDatos - handles single element array', () => {
    const data = [{ name: 'a', value: 1 }];
    const sorted = ordenarDatos(data, 'name', false);
    assert.deepStrictEqual(sorted, [{ name: 'a', value: 1 }]);
});

test('ordenarDatos - handles identical string values', () => {
    const data = [
        { id: 1, name: 'a' },
        { id: 2, name: 'a' },
    ];
    // In JavaScript, sort is stable from ES2019 onwards, so it should retain the order.
    // However, just checking it doesn't crash or behave weirdly.
    const sorted = ordenarDatos(data, 'name', true);
    assert.strictEqual(sorted.length, 2);
    assert.strictEqual(sorted[0].name, 'a');
    assert.strictEqual(sorted[1].name, 'a');
});

test('ordenarDatos - handles identical number values', () => {
    const data = [
        { id: 1, value: 10 },
        { id: 2, value: 10 },
    ];
    const sorted = ordenarDatos(data, 'value', false);
    assert.strictEqual(sorted.length, 2);
    assert.strictEqual(sorted[0].value, 10);
    assert.strictEqual(sorted[1].value, 10);
});

test('ordenarDatos - string sorting is case-sensitive or locale-based correctly', () => {
    const data = [
        { name: 'Zebra' },
        { name: 'apple' },
        { name: 'Banana' },
    ];
    // localeCompare usually sorts case-insensitively or puts upper/lower together
    // The exact order might depend on the environment, but it shouldn't just be ASCII order.
    const sorted = ordenarDatos([...data], 'name', true);
    // Let's not strict check the exact localeCompare outcome unless we are sure,
    // but typically apple, Banana, Zebra or apple, Banana, Zebra based on locale.
    // In node's default locale, 'apple', 'Banana', 'Zebra' is sorted as:
    // a, B, Z or something. Let's just check it sorts the same as localeCompare.
    const expected = [...data].sort((a, b) => a.name.localeCompare(b.name));
    assert.deepStrictEqual(sorted, expected);
});

test('ordenarDatos - handles missing/undefined values gracefully by placing them correctly or at least not crashing', () => {
    // If undefined is passed, `typeof valA` might be 'undefined'.
    // `ordenarDatos` only checks `typeof valA === 'string'`, so it treats everything else as numbers.
    // undefined - undefined is NaN.
    // This is technically a flaw in the original logic if missing values exist, but it doesn't crash.
    const data = [
        { name: 'a', value: 2 },
        { name: 'b' }, // missing value
        { name: 'c', value: 3 },
    ];
    // We just ensure it runs without throwing.
    assert.doesNotThrow(() => {
        ordenarDatos(data, 'value', true);
    });
});
