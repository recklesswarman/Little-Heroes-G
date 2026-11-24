// Number Dash pictures (ten frames, number lines, base-ten blocks) and the Math Lab (PhET sims,
// served from the Pi's own copies when it has them).
import './setup_mock_env.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { tenFrameSvg, numberLineSvg, baseTenSvg, mathVisualSvg } from '../shared/mathVisuals.js';
import { MATH_FACT_CHALLENGES } from '../src/data/mathFactsData.js';
import { STANDARD_DESCRIPTIONS } from '../src/data/gradeLevelSkillsData.js';
import { PHET_SIMS, phetFileName, phetOnlineUrl, phetSimUrl, PHET_CREDIT } from '../shared/phetSims.js';
import { localPhetSims, mountPhet } from '../server/phetService.js';
import { renderMathLabView } from '../src/views/MathLabView.js';

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); } catch (err) { failures++; console.error(`  ❌ ${name}\n     ${err.stack || err.message}`); }
}
const dots = (s) => (s.match(/<circle/g) || []).length;

await test('ten frames show the right dots', () => {
  assert.equal(dots(tenFrameSvg({ a: 3, b: 2, op: 'add' })), 5);
  assert.equal((tenFrameSvg({ a: 3, b: 2, op: 'add' }).match(/#fbbf24/g) || []).length, 2, 'two added dots in yellow');
  const sub = tenFrameSvg({ a: 5, b: 2, op: 'sub' });
  assert.equal(dots(sub), 5);
  assert.equal((sub.match(/<path/g) || []).length, 2, 'two crossed out');
  assert.equal(dots(tenFrameSvg({ a: 7, op: 'make10' })), 7);
  assert.equal((tenFrameSvg({ a: 7, op: 'make10' }).match(/<rect/g) || []).length, 10);
  assert.equal((tenFrameSvg({ a: 9, b: 4, op: 'add' }).match(/<rect/g) || []).length, 20, 'two frames past 10');
  assert.equal(dots(tenFrameSvg({ a: 999, b: -4 })), 20, 'clamped');
});

await test('number line and base-ten blocks', () => {
  const nl = numberLineSvg({ from: 0, to: 20, start: 7, jump: 6 });
  assert.ok(nl.includes('>13<') && nl.includes('jump up 6'));
  assert.ok(numberLineSvg({ start: 15, jump: -7 }).includes('jump back 7'));
  const b = baseTenSvg({ tens: 3, ones: 4 });
  assert.equal((b.match(/<rect/g) || []).length, 34);
  assert.ok(b.includes('3 tens and 4 ones'));
  assert.equal(mathVisualSvg(null), '');
  assert.equal(mathVisualSvg({ kind: '<script>' }), '');
  for (const s of [tenFrameSvg({ a: 2 }), nl, b]) assert.ok(!/<script|on\w+=/i.test(s));
});

await test('every Number Dash challenge has a picture that matches its numbers', () => {
  for (const [lvl, list] of Object.entries(MATH_FACT_CHALLENGES)) {
    assert.ok(list.length >= 16, lvl);
    for (const c of list) {
      assert.ok(STANDARD_DESCRIPTIONS[c.standard], c.standard);
      assert.ok(c.visual && mathVisualSvg(c.visual).startsWith('<svg'), `${lvl}: ${c.question}`);
      if (c.visual.kind === 'base-ten') assert.equal(Number(c.options[c.answer]), c.visual.tens * 10 + c.visual.ones);
      const m = c.question.match(/^What is (\d+) (plus|minus) (\d+)\?$/);
      if (m && c.visual.kind === 'ten-frame') assert.deepEqual([c.visual.a, c.visual.b], [Number(m[1]), Number(m[3])]);
      if (m && c.visual.kind === 'number-line') assert.equal(c.visual.start + c.visual.jump, Number(c.options[c.answer]));
    }
  }
  assert.ok(MATH_FACT_CHALLENGES.easy.every((c) => c.visual.kind === 'ten-frame'), 'Milo sees ten frames');
  assert.ok(MATH_FACT_CHALLENGES.hard.some((c) => c.visual.kind === 'base-ten'), 'place value for 2nd grade');
  assert.ok(MATH_FACT_CHALLENGES.medium.some((c) => c.standard === 'K.OA.A.4'), 'make 10');
});

await test('the quest screen draws the picture', () => {
  const src = fs.readFileSync(new URL('../src/views/WorldAdventureMapView.js', import.meta.url), 'utf8');
  assert.ok(src.includes('mathVisualSvg(challenge.visual)'));
});

await test('PhET sims: Pi copies first, PhET online otherwise, with credit', async () => {
  assert.ok(PHET_SIMS.length >= 3 && PHET_CREDIT.includes('CC BY'));
  assert.equal(phetOnlineUrl('make-a-ten'), 'https://phet.colorado.edu/sims/html/make-a-ten/latest/make-a-ten_all.html');
  assert.equal(phetSimUrl('make-a-ten', { localIds: ['make-a-ten'], base: 'https://pi.example' }), 'https://pi.example/phet/make-a-ten_all.html');
  assert.equal(phetSimUrl('make-a-ten'), phetOnlineUrl('make-a-ten'));
  assert.equal(phetSimUrl('../../etc/passwd'), '');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phet-'));
  fs.writeFileSync(path.join(dir, phetFileName('number-play')), `<html>${'x'.repeat(20000)}</html>`);
  fs.writeFileSync(path.join(dir, phetFileName('make-a-ten')), 'tiny');
  assert.deepEqual(localPhetSims(dir), ['number-play'], 'only real copies');
  const app = express();
  mountPhet(app, { dir });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await (await fetch(`${base}/api/phet/sims`)).json(), { local: ['number-play'] });
    const page = await fetch(`${base}/phet/number-play_all.html`);
    assert.equal(page.status, 200);
    assert.equal((await fetch(`${base}/phet/../package.json`)).status, 404);
  } finally {
    server.close();
  }
});

await test('Math Lab screen lists the sims', () => {
  const html = renderMathLabView();
  assert.ok(html.includes('data-math-lab') && PHET_SIMS.every((s) => html.includes(`data-math-lab-sim="${s.id}"`)));
  assert.ok(html.includes('Number Dash') && html.includes('PhET'));
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("case 'math_lab'"));
});

if (failures) {
  console.error(`\n❌ ${failures} Number Dash picture check(s) failed`);
  process.exit(1);
}
console.log('\n✅ Number Dash picture and Math Lab checks passed');
