// node test.js
const assert = require('assert');
const { fitWithin, clamp01, grow, crop } = require('./core.js');

assert.deepStrictEqual(fitWithin(4000, 3000, 1000), { w: 1000, h: 750 });
assert.deepStrictEqual(fitWithin(400, 300, 1000), { w: 400, h: 300 });
assert.strictEqual(clamp01(-0.2), 0);
assert.strictEqual(clamp01(1.4), 1);
let b = grow(null, 10, 20);
b = grow(b, 5, 40);
b = grow(b, 30, 15);
assert.deepStrictEqual(b, { x0: 5, y0: 15, x1: 30, y1: 40 });
assert.deepStrictEqual(crop(b, 8, 300, 200), { x: 0, y: 7, w: 38, h: 41 });
assert.deepStrictEqual(crop({ x0: 290, y0: 195, x1: 299, y1: 199 }, 8, 300, 200), { x: 282, y: 187, w: 18, h: 13 });
console.log('ok');
