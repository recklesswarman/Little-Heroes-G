// Copies shared/ledger into functions-ledger/src/core because Firebase Functions
// deploys each codebase directory independently. Run after editing shared/ledger:
//   node scripts/sync-ledger-core.mjs
// scratch/verify_ledger_core_sync.mjs fails if the two copies drift.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'shared', 'ledger');
const dest = join(root, 'functions-ledger', 'src', 'core');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).sort();
for (const file of files) {
  cpSync(join(src, file), join(dest, file));
}
console.log(`Synced ${files.length} file(s) to functions-ledger/src/core`);
