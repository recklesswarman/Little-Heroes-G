// Fridge mode toggle: the header 🧊 button turns this tablet into the Fridge Display, saved per
// device, and "Fridge mode off" on the board turns it back.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isFridgeMode, setFridgeMode, FRIDGE_MODE_KEY } from '../src/services/fridgeModeService.js';

let failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); } catch (err) { failed += 1; console.error(`  ❌ ${name}\n     ${err.message}`); }
};
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

check('fridge mode is saved on this device and can be turned off', () => {
  localStorage.removeItem(FRIDGE_MODE_KEY);
  assert.equal(isFridgeMode(), false);
  assert.equal(setFridgeMode(true), true);
  assert.equal(localStorage.getItem(FRIDGE_MODE_KEY), 'on');
  assert.equal(isFridgeMode(), true);
  setFridgeMode(false);
  assert.equal(localStorage.getItem(FRIDGE_MODE_KEY), null);
  assert.equal(isFridgeMode(), false);
});

check('the header has a fridge mode switch for tablets that opens the Fridge Display', () => {
  const header = read('src/components/TopHeader.js');
  assert.match(header, /id="header-fridge-btn"[^>]*role="switch"/);
  assert.match(header, /id="header-fridge-btn"[^>]*hidden sm:flex/, 'tablets and up, not phones');
  assert.match(header, /setFridgeMode\(true\);\s*store\.navigate\('fridge'\)/);
});

check('the board turns fridge mode off, and a fridge-mode tablet opens to the board', () => {
  const view = read('src/views/FridgeDisplayView.js');
  assert.match(view, /Fridge mode off/);
  assert.match(view, /data-fridge-exit[\s\S]*setFridgeMode\(false\)/);
  const main = read('src/main.js');
  assert.match(main, /resolveRouteFromUrl\(\) \|\| \(isFridgeMode\(\) \? 'fridge' : null\)/);
});

if (failed) { console.error(`\n❌ ${failed} fridge mode check(s) failed`); process.exit(1); }
console.log('\n✅ Fridge mode toggle checks passed');
