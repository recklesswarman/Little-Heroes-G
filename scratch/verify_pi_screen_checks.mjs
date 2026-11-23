// Screen checks on the Pi (scripts/pi/screens): report sorting and wiring. The pictures themselves
// run on the Pi after each deploy (they need a browser); this checks the parts CI can.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../scripts/pi/screens/summarize.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); } catch (err) { failed += 1; console.error(`  ❌ ${name}\n     ${err.message}`); }
};

const result = (status, ...messages) => ({ status, errors: messages.map((message) => ({ message })) });
const report = {
  suites: [{
    specs: [
      { title: 'fridge', tests: [{ projectName: 'tablet', results: [result('passed')] }] },
      { title: 'profile', tests: [{ projectName: 'phone', results: [result('failed', '\u001b[2mexpect(\u001b[22mpage).toHaveScreenshot(expected) failed\n\n  10 pixels\n\n> 76 | expect(errors, `x script errors`)')] }] },
      { title: 'math-lab', tests: [{ projectName: 'tablet', results: [result('failed', "Error: A snapshot doesn't exist at /x.png, writing actual.")] }] }
    ],
    suites: [{
      specs: [
        { title: 'dashboard', tests: [{ projectName: 'phone', results: [result('failed', 'Error: dashboard script errors\n\nexpect(received).toEqual(expected)')] }] },
        { title: 'bedtime', tests: [{ projectName: 'tablet', results: [result('timedOut', 'page.waitForSelector: Timeout 20000ms exceeded.')] }] },
        { title: 'learn-map', tests: [{ projectName: 'tablet', results: [result('failed', 'expect(page).toHaveScreenshot(expected) failed', 'Error: learn-map drew no words')] }] }
      ]
    }]
  }]
};

check('a changed or new picture is "changed"; a crash, blank screen or timeout is "broken"', () => {
  const s = summarize(report);
  assert.equal(s.total, 6);
  assert.deepEqual(s.changed, ['profile (phone)', 'math-lab (tablet)']);
  assert.deepEqual(s.broken, ['dashboard (phone)', 'bedtime (tablet)', 'learn-map (tablet)']);
  assert.deepEqual(summarize(null), { broken: [], changed: [], total: 0 });
});

check('the Fridge Display and kid screens are pictured on a tablet and a phone, with fixed data', () => {
  const spec = read('scripts/pi/screens/screens.spec.mjs');
  for (const name of ['fridge', 'dashboard', 'learn-map', 'math-lab', 'bedtime', 'profile']) assert.match(spec, new RegExp(`name: '${name}'`));
  assert.match(spec, /page\.clock\.setFixedTime/);
  assert.match(spec, /route\.abort\(\)/);
  assert.match(spec, /toHaveScreenshot/);
  assert.doesNotMatch(spec, /Kaleb|Kayden/, 'no real names in the public repo');
  const config = read('scripts/pi/screens/playwright.config.mjs');
  assert.match(config, /name: 'tablet'/);
  assert.match(config, /name: 'phone'/);
  assert.match(config, /SCREENS_DIR/);
  assert.match(config, /\/usr\/bin\/chromium/);
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.devDependencies?.['@playwright/test'], '@playwright/test is a dev dependency');
});

check('runs on the Pi after each deploy, alerts pi-alerts, and keeps before/after pictures', () => {
  const sh = read('scripts/pi/screens/run-screens.sh');
  assert.match(sh, /pi-alerts/);
  assert.match(sh, /--accept/);
  assert.match(sh, /--update-snapshots=changed/);
  assert.match(sh, /exit 1/);
  assert.ok(fs.statSync(path.join(root, 'scripts/pi/screens/run-screens.sh')).mode & 0o111, 'run-screens.sh is executable');
  const wf = read('.github/workflows/deploy-pi.yml');
  assert.match(wf, /screens:\n\s+needs: deploy/);
  assert.match(wf, /runs-on: \[self-hosted, pi\][\s\S]*run-screens\.sh/);
  assert.match(wf, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(wf, /pull_request/, 'never runs pull request code on the Pi');
});

if (failed) { console.error(`\n❌ ${failed} screen check test(s) failed`); process.exit(1); }
console.log('\n✅ Pi screen checks passed');
