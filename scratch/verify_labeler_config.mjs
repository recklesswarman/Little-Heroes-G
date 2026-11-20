// .github/labeler.yml: every label has patterns, and every pattern points at something that exists,
// so the PR labeler (actions/labeler@v4) does real work and does not silently rot when files move.
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let failed = 0;
async function check(desc, fn) {
  try { await fn(); console.log(`  ok - ${desc}`); }
  catch (e) { failed++; console.error(`  FAIL - ${desc}: ${e.message}`); }
}
console.log('labeler config');

const text = readFileSync('.github/labeler.yml', 'utf8');
const labels = {};
let current = null;
for (const raw of text.split('\n')) {
  const line = raw.replace(/\s+#.*$/, '').trimEnd();
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const head = line.match(/^([A-Za-z0-9_-]+):\s*$/);
  const item = line.match(/^\s+-\s+(\S+)\s*$/);
  if (head) { current = head[1]; labels[current] = []; }
  else if (item && current) labels[current].push(item[1]);
  else assert.fail(`unrecognised line: ${raw}`);
}

await check('there are labels, each with at least one pattern, and the workflow uses this file', () => {
  assert.ok(Object.keys(labels).length >= 5);
  for (const [label, globs] of Object.entries(labels)) assert.ok(globs.length > 0, `${label} has no patterns`);
  assert.ok(/actions\/labeler@/.test(readFileSync('.github/workflows/label.yml', 'utf8')));
});
await check('every pattern points at a path that exists (its fixed part, before any wildcard)', () => {
  for (const [label, globs] of Object.entries(labels)) {
    for (const g of globs) {
      const fixed = g.split('*')[0].replace(/\/$/, '');
      assert.ok(fixed === '' || existsSync(join(process.cwd(), fixed)), `${label}: "${g}" does not match anything in the repo`);
    }
  }
});

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('all passed');
process.exit(0);
