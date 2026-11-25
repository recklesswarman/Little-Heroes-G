import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const src = 'shared/ledger';
const dest = 'functions-ledger/src/core';

const srcFiles = readdirSync(src).sort();
const destFiles = readdirSync(dest).sort();

assert.deepStrictEqual(
  destFiles,
  srcFiles,
  'functions-ledger/src/core has different files; run: node scripts/sync-ledger-core.mjs'
);
for (const f of srcFiles) {
  assert.strictEqual(
    readFileSync(`${dest}/${f}`, 'utf8'),
    readFileSync(`${src}/${f}`, 'utf8'),
    `${f} drifted; run: node scripts/sync-ledger-core.mjs`
  );
}
console.log(`✅ ledger core copies in sync (${srcFiles.length} file(s))`);
