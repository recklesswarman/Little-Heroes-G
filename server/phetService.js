// Math Lab: serves the Pi's copies of the PhET sims (shared/phetSims.js) at /phet/ and lists the
// ones it has at GET /api/phet/sims, so the Math Lab opens them from the Pi without the internet.
// Copies are downloaded by scripts/pi/phet-sims.mjs into PHET_DIR (default ~/apps/phet).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { PHET_SIMS, phetFileName } from '../shared/phetSims.js';

export function phetDir(env = process.env) {
  return env.PHET_DIR || path.join(os.homedir(), 'apps', 'phet');
}

/** Ids of the sims this server has a copy of. */
export function localPhetSims(dir = phetDir()) {
  return PHET_SIMS.filter((s) => {
    try { return fs.statSync(path.join(dir, phetFileName(s.id))).size > 10000; } catch { return false; }
  }).map((s) => s.id);
}

export function mountPhet(app, { dir = phetDir() } = {}) {
  app.get('/api/phet/sims', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ local: localPhetSims(dir) });
  });
  app.use('/phet', express.static(dir, { maxAge: '7d', index: false, dotfiles: 'deny' }));
}
