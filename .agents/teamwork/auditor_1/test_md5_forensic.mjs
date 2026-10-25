import { computeMd5 } from '../../../src/utils/md5.js';
import crypto from 'crypto';
import assert from 'assert';

console.log('Testing canonical RFC 1321 vectors...');
const testVectors = [
  ['', 'd41d8cd98f00b204e9800998ecf8427e'],
  ['a', '0cc175b9c0f1b6a831c399e269772661'],
  ['abc', '900150983cd24fb0d6963f7d28e17f72'],
  ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
  ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
  ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
  ['12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a']
];

for (const [input, expected] of testVectors) {
  const custom = computeMd5(input);
  const native = crypto.createHash('md5').update(input, 'utf8').digest('hex');
  assert.strictEqual(custom, expected, `Failed canonical RFC 1321 vector for "${input}"`);
  assert.strictEqual(custom, native, `Native crypto mismatch for "${input}"`);
}
console.log('PASS: All canonical RFC 1321 vectors matched perfectly.');

console.log('Testing 500 random inputs (Unicode, emojis, arbitrary lengths)...');
for (let i = 0; i < 500; i++) {
  const len = Math.floor(Math.random() * 2000);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789~!@#$%^&*()_+ \n\t\u{1F600}\u{1F31F}\u{2728}\u{1F996}';
  let str = '';
  for (let j = 0; j < len; j++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  const custom = computeMd5(str);
  const native = crypto.createHash('md5').update(str, 'utf8').digest('hex');
  assert.strictEqual(custom, native, `Mismatch on random input of length ${len} at iteration ${i}`);
}
console.log('PASS: 500/500 random inputs matched Node.js crypto.createHash exactly.');
