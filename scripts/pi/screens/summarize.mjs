// Reads Playwright's JSON report and sorts failed screens: "changed" (only the picture differs, or
// it is new) and "broken" (anything else: the app crashed, drew nothing or had script errors).
import fs from 'node:fs';

export function summarize(report) {
  const out = { broken: [], changed: [], total: 0 };
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        out.total += 1;
        const result = (t.results || []).at(-1) || {};
        if (result.status === 'passed' || result.status === 'skipped') continue;
        const name = `${spec.title} (${t.projectName})`;
        // The first line of each error says what failed (the rest is a call log and code).
        const firsts = (result.errors || []).map((e) => String(e.message || '').replace(/\u001b\[[0-9;]*m/g, '').trim().split('\n')[0]);
        const onlyPicture = firsts.length > 0
          && firsts.every((line) => /toHaveScreenshot|snapshot doesn't exist/i.test(line));
        (onlyPicture ? out.changed : out.broken).push(name);
      }
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of report?.suites || []) walk(suite);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let report = {};
  try { report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); } catch {}
  process.stdout.write(JSON.stringify(summarize(report)));
}
