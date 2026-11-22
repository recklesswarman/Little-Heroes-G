// Every shipped third-party icon is credited, in the shared emoji/icon lists, and the budget holds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENMOJI_AVAILABLE } from '../src/utils/emojiArt.js';
import { GAME_ICONS } from '../src/utils/gameIcons.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ PASS: ${m}`); passed++; } else { console.error(`  ❌ FAIL: ${m}`); failed++; } };

console.log('📜 --- Asset credits and budget --- 📜');
const gi = path.join(ROOT, 'public/assets/icons/game-icons');
const om = path.join(ROOT, 'public/assets/icons/openmoji');
assert(fs.readFileSync(path.join(gi, 'CREDITS.md'), 'utf8').includes('CC BY 3.0'), 'game-icons CREDITS.md names the CC BY 3.0 licence');
assert(fs.readFileSync(path.join(om, 'CREDITS.md'), 'utf8').includes('CC BY-SA 4.0'), 'OpenMoji CREDITS.md names the CC BY-SA 4.0 licence');
for (const hex of OPENMOJI_AVAILABLE) assert(fs.existsSync(path.join(om, `${hex}.svg`)), `OpenMoji ${hex} exists`);
for (const [name, file] of Object.entries(GAME_ICONS)) assert(fs.existsSync(path.join(gi, `${file}.svg`)), `game-icon ${name} exists`);
let bytes = 0;
for (const dir of [gi, om]) for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.svg')) continue;
  const t = fs.readFileSync(path.join(dir, f), 'utf8');
  bytes += t.length;
  if (/<script|onload=|javascript:/i.test(t)) assert(false, `${f} has no script`);
}
assert(bytes <= 1.5 * 1024 * 1024, `new icons stay under 1.5 MB (${Math.round(bytes / 1024)} KB)`);
console.log(`\nTEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed ? 1 : 0);
