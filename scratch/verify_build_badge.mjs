// The header build badge shows the real build id and is reachable on phones and tablets too.
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getBuildLabel } from '../src/components/TopHeader.js';

let failures = 0;
async function test(name, fn) { try { await fn(); console.log(`  ✅ ${name}`); } catch (e) { failures++; console.error(`  ❌ ${name}\n     ${e.message}`); } }

console.log('🧪 Header build badge');

await test('the label is the short commit id of the build', () => {
  assert.equal(getBuildLabel('v1.0.0-6f8c88f'), '6f8c88f');
  assert.equal(getBuildLabel('v3.19.1-battle-audit-fixes-20261120'), '20261120');
  assert.equal(getBuildLabel(''), 'build');
  assert.ok(!/[<>"'() ]/.test(getBuildLabel('<img src=x onerror=alert(1)>')));
});
await test('the header badge shows the real build from tablets up, with no old static label', () => {
  const src = fs.readFileSync(new URL('../src/components/TopHeader.js', import.meta.url), 'utf8');
  const button = src.slice(src.indexOf('id="header-version-btn"'), src.indexOf('</button>', src.indexOf('id="header-version-btn"')));
  assert.ok(!button.includes('hidden lg:flex'), 'badge must be visible below the lg breakpoint');
  assert.ok(!button.includes('v3.1 3D') && button.includes('${buildLabel}'));
});
await test('phones get the build and a "Reload latest" button in the parent portal settings', () => {
  const src = fs.readFileSync(new URL('../src/views/ParentPortalView.js', import.meta.url), 'utf8');
  assert.ok(src.includes('parent-reload-latest-btn') && src.includes('getBuildLabel()'));
  assert.ok(/getElementById\('parent-reload-latest-btn'\)\?\.addEventListener\('click'/.test(src));
  assert.ok(src.includes('forceAppHardRefresh'));
});

if (failures) { console.error(`\n❌ ${failures} badge check(s) failed`); process.exit(1); }
console.log('\n✅ All build badge checks passed');
process.exit(0);
