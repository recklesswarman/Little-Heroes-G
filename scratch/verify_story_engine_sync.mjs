import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const src = 'shared/storyEngine';
const dest = 'functions/src/storyEngine';

const srcFiles = readdirSync(src).sort();
const destFiles = readdirSync(dest).sort();

assert.deepStrictEqual(destFiles, srcFiles,
  `functions copy has different files; run: node scripts/sync-story-engine.mjs`);
for (const f of srcFiles) {
  assert.strictEqual(readFileSync(`${dest}/${f}`, 'utf8'), readFileSync(`${src}/${f}`, 'utf8'),
    `${f} drifted; run: node scripts/sync-story-engine.mjs`);
}
console.log(`story engine copies in sync (${srcFiles.length} file(s))`);
