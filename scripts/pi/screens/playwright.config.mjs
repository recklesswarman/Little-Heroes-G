// Screen checks for the Fridge Display and kid screens (scripts/pi/screens/run-screens.sh).
// Runs on the family Pi after each deploy, against the app it just started. Pictures are kept on
// the Pi (SCREENS_DIR, default ~/apps/screen-checks) because they depend on the Pi's own fonts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const dir = process.env.SCREENS_DIR || path.join(os.homedir(), 'apps', 'screen-checks');

/** The Pi's own Chromium when it has one (Playwright's download is used otherwise). */
function chromeBin() {
  const list = [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  return list.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}

const executablePath = chromeBin();

export default defineConfig({
  testDir: '.',
  testMatch: /screens\.spec\.mjs$/,
  outputDir: path.join(dir, 'last-run'),
  snapshotPathTemplate: path.join(dir, 'baseline', '{arg}{ext}'),
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: path.join(dir, 'report.json') }]],
  updateSnapshots: 'missing',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide', scale: 'css' }
  },
  use: {
    baseURL: process.env.SCREENS_URL || 'http://127.0.0.1:3000',
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }
  },
  projects: [
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, hasTouch: true } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } }
  ]
});
