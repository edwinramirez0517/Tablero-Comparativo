const test = require('node:test');
const assert = require('node:assert');
const { formatNumber, getMesNum } = require('./app.js');

test('formatNumber', async (t) => {
    await t.test('handles null and undefined', () => {
        assert.strictEqual(formatNumber(null), "0");
        assert.strictEqual(formatNumber(undefined), "0");
    });

    await t.test('formats thousands and rounds properly', () => {
        assert.strictEqual(formatNumber(1000), "1,000");
        assert.strictEqual(formatNumber(1234567.89), "1,234,568");
        assert.strictEqual(formatNumber(1234.1), "1,234");
        assert.strictEqual(formatNumber(0), "0");
    });

    await t.test('handles negative numbers', () => {
        assert.strictEqual(formatNumber(-1234.5), "-1,234");
    });
});

test('getMesNum', async (t) => {
    await t.test('returns correct number for valid lowercase month', () => {
        assert.strictEqual(getMesNum('enero'), 1);
        assert.strictEqual(getMesNum('junio'), 6);
        assert.strictEqual(getMesNum('diciembre'), 12);
    });

    await t.test('handles capitalized/uppercase input correctly', () => {
        assert.strictEqual(getMesNum('Enero'), 1);
        assert.strictEqual(getMesNum('FEBRERO'), 2);
        assert.strictEqual(getMesNum('Marzo'), 3);
    });

    await t.test('returns 99 for invalid inputs', () => {
        assert.strictEqual(getMesNum('invalid'), 99);
        assert.strictEqual(getMesNum(''), 99);
    });
});
