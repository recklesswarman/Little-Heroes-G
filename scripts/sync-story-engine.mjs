// Copies shared/storyEngine into functions/src/storyEngine because Firebase Functions
// only deploys the functions/ directory. Run after editing shared/storyEngine:
//   node scripts/sync-story-engine.mjs
// scratch/verify_story_engine_sync.mjs fails if the two copies drift.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'shared', 'storyEngine');
const dest = join(root, 'functions', 'src', 'storyEngine');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const file of readdirSync(src)) {
  cpSync(join(src, file), join(dest, file));
}
console.log(`Synced ${readdirSync(src).length} file(s) to functions/src/storyEngine`);
