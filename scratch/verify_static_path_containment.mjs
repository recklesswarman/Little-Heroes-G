import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveDistFile } from '../scripts/distPath.js';

const distDir = path.resolve('app/dist');

assert.equal(resolveDistFile(distDir, '/'), path.join(distDir, 'index.html'));
assert.equal(resolveDistFile(distDir, '/assets/main.js?v=1'), path.join(distDir, 'assets', 'main.js'));
assert.equal(resolveDistFile(distDir, '/../secret.txt'), null);
assert.equal(resolveDistFile(distDir, '/assets/../../secret.txt'), null);
assert.equal(resolveDistFile(distDir, '/..\\..\\secret.txt'), null);

console.log('Static request paths remain contained in the build directory.');
