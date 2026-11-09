const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const context = { crypto: webcrypto, Uint8Array, Set, String, Number, Error, encodeURIComponent };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../src/ean13.js'), 'utf8'), context);
const ean = context.EAN13Barcode;
assert.equal(ean.checksum('400638133393'), '1'); // GS1 reference vector, checksum only
assert.equal(ean.valid('4006381333931'), false); // commercial prefix is not accepted for private IDs
assert.equal(ean.modules('2000000000008').length, 95);
assert.equal(ean.valid('2000000000008'), true);
const used = new Set();
for (let i = 0; i < 5000; i++) {
  const code = ean.generate(used);
  assert.match(code, /^2\d{12}$/);
  assert.ok(ean.valid(code), `Invalid check digit: ${code}`);
  assert.ok(!used.has(code), `Duplicate EAN: ${code}`);
  used.add(code);
}
assert.equal(ean.toSvg('2000000000008').includes('2000000000008'), true);
console.log(`EAN-13 OK: checksum, structure, 95 modules, SVG, ${used.size} unique generated values.`);
