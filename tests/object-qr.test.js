const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = { window: {}, console, Uint8Array, Math, Array, Error, String, Number, parseInt };
vm.createContext(ctx);
for (const f of ['qr.js', 'label-codes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx);
const { objectQrValue, parseObjectQr } = ctx.window.CavernCodes;
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const seen = new Set();
for (let i = 0; i < 5000; i++) {
  let code = ''; for (let k = 0; k < 8; k++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  const value = objectQrValue(code);
  assert.equal(value.length, 11);
  assert.equal(parseObjectQr(value), code);
  const qr = new ctx.window.QRCodeLib(0, 0); qr.addData(value); qr.make();
  assert.equal(qr.getModuleCount(), 21, 'le QR objet doit rester en version 1 (21 modules)');
  seen.add(value);
}
assert.equal(parseObjectQr('CA-KIT-ABC123XYZ9'), '');
assert.equal(parseObjectQr('https://exemple.fr/contact.html?i=ABCDEFGH'), '');
assert.throws(() => objectQrValue('ABC'));
const moduleSize = Math.floor(92 / 21);
assert.equal(moduleSize, 4); assert.equal(21 * moduleSize, 84); assert.ok(84 <= 96, 'QR objet ≤ tête 96 points');
const url = 'https://hippo.github.io/La-Caverne-dAlibaab/c.html?ABCDEFGH';
const lost = new ctx.window.QRCodeLib(0, 1); lost.addData(url); lost.make();
assert.ok((lost.getModuleCount() + 2) * 2 <= 96, 'QR anti-perte court doit tenir sur la tête 96 points');
console.log(`QR objet OK : ${seen.size} valeurs, version 1 (21 modules), module 4 pts = 84 pts / 96. QR anti-perte : ${lost.getModuleCount()} modules.`);
