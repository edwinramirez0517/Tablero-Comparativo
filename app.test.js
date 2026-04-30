const test = require('node:test');
const assert = require('node:assert');
const { getMesNum } = require('./app.js');

test('getMesNum - valid month names', (t) => {
  assert.strictEqual(getMesNum('enero'), 1);
  assert.strictEqual(getMesNum('febrero'), 2);
  assert.strictEqual(getMesNum('diciembre'), 12);
});

test('getMesNum - valid month names with different casing', (t) => {
  assert.strictEqual(getMesNum('Enero'), 1);
  assert.strictEqual(getMesNum('ENERO'), 1);
  assert.strictEqual(getMesNum('mArZo'), 3);
});

test('getMesNum - invalid month names', (t) => {
  assert.strictEqual(getMesNum('not-a-month'), 99);
  assert.strictEqual(getMesNum('january'), 99); // English not supported by default
});

test('getMesNum - edge cases: empty string', (t) => {
  assert.strictEqual(getMesNum(''), 99);
});

test('getMesNum - edge cases: null/undefined/non-string', (t) => {
  assert.strictEqual(getMesNum(null), 99);
  assert.strictEqual(getMesNum(undefined), 99);
  assert.strictEqual(getMesNum(123), 99);
});
