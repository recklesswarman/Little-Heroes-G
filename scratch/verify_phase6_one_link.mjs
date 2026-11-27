/**
 * scratch/verify_phase6_one_link.mjs
 *
 * Phase 6 verification: One canonical link for the whole app
 * (https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app),
 * lightweight redirects on retired static hosts (GitHub Pages & Classic Firebase Hosting),
 * Pi Fridge Display kiosk default URL, server.js cache headers & optional APP_REDIRECT_URL,
 * and updated deployment documentation.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CANONICAL_ORIGIN = 'https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app';
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}\n     ${err.message}`);
    failed++;
  }
}

console.log('🧪 Phase 6: One Link Consolidation Verification\n');

check('redirect/index.html, redirect/404.html, and redirect/sw.js exist', () => {
  assert.ok(fs.existsSync('redirect/index.html'), 'redirect/index.html missing');
  assert.ok(fs.existsSync('redirect/404.html'), 'redirect/404.html missing');
  assert.ok(fs.existsSync('redirect/sw.js'), 'redirect/sw.js missing');
  assert.equal(
    fs.readFileSync('redirect/index.html', 'utf8'),
    fs.readFileSync('redirect/404.html', 'utf8'),
    'redirect/index.html and redirect/404.html must stay identical'
  );
});

check('redirect/index.html preserves path, query, and hash and strips /Little-Heroes-G prefix', () => {
  const html = fs.readFileSync('redirect/index.html', 'utf8');
  assert.ok(html.includes(CANONICAL_ORIGIN), 'must target canonical App Hosting origin');
  assert.ok(html.includes('http-equiv="refresh"'), 'must include meta refresh fallback');
  assert.ok(html.includes('serviceWorker'), 'must unregister stale service workers');

  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'inline redirect script missing');

  const evalRedirect = (pathname, search = '', hash = '') => {
    let replacedUrl = null;
    const sandbox = {
      window: {
        location: {
          pathname,
          search,
          hash,
          replace(url) { replacedUrl = url; }
        }
      },
      navigator: {}
    };
    vm.runInNewContext(scriptMatch[1], sandbox);
    return replacedUrl;
  };

  assert.equal(evalRedirect('/'), `${CANONICAL_ORIGIN}/`);
  assert.equal(evalRedirect('/index.html'), `${CANONICAL_ORIGIN}/`);
  assert.equal(evalRedirect('/404.html'), `${CANONICAL_ORIGIN}/`);
  assert.equal(evalRedirect('/Little-Heroes-G/'), `${CANONICAL_ORIGIN}/`);
  assert.equal(evalRedirect('/Little-Heroes-G'), `${CANONICAL_ORIGIN}/`);
  assert.equal(
    evalRedirect('/Little-Heroes-G/', '?source=alert', '#parent-portal'),
    `${CANONICAL_ORIGIN}/?source=alert#parent-portal`
  );
  assert.equal(
    evalRedirect('/Little-Heroes-G/boost', '?from=gh', '#tab=2'),
    `${CANONICAL_ORIGIN}/boost?from=gh#tab=2`
  );
  assert.equal(
    evalRedirect('/fridge', '?kiosk=1', '#fridge'),
    `${CANONICAL_ORIGIN}/fridge?kiosk=1#fridge`
  );
});

check('redirect/sw.js clears caches, unregisters itself, and navigates clients to canonical origin', () => {
  const sw = fs.readFileSync('redirect/sw.js', 'utf8');
  assert.ok(sw.includes(CANONICAL_ORIGIN), 'sw.js must target canonical origin');
  assert.ok(sw.includes('self.skipWaiting()'), 'sw.js must skipWaiting');
  assert.ok(sw.includes('caches.delete'), 'sw.js must clear old caches');
  assert.ok(sw.includes('self.registration.unregister()'), 'sw.js must unregister itself');
});

check('firebase.json defines 301 redirects to canonical App Hosting URL while preserving /api rewrites', () => {
  const cfg = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
  const redirects = cfg.hosting?.redirects || [];
  assert.ok(
    redirects.some(r => r.source === '/' && r.destination === `${CANONICAL_ORIGIN}/` && r.type === 301),
    'missing 301 redirect for /'
  );
  assert.ok(
    redirects.some(r => r.source === '/index.html' && r.destination === `${CANONICAL_ORIGIN}/` && r.type === 301),
    'missing 301 redirect for /index.html'
  );
  const rewrites = cfg.hosting?.rewrites || [];
  assert.ok(rewrites.some(r => r.source === '/api/rex/**'), 'must preserve /api/rex/** rewrite');
  assert.ok(rewrites.some(r => r.source === '/api/gemini/**'), 'must preserve /api/gemini/** rewrite');
  assert.ok(rewrites.some(r => r.source === '**' && r.destination === '/index.html'), 'must preserve catch-all rewrite');
  const uris = cfg.auth?.providers?.googleSignIn?.authorizedRedirectUris || [];
  assert.ok(uris.includes(CANONICAL_ORIGIN), 'Google Sign-In authorizedRedirectUris must include canonical App Hosting URL');
});

check('deploy.yml and firebase-hosting-deploy.yml publish lightweight redirects instead of Vite builds', () => {
  const gh = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.ok(gh.includes("path: './redirect'"), 'deploy.yml must upload ./redirect');
  assert.ok(!gh.includes('npm run build'), 'deploy.yml must not run a Vite build');

  const fb = fs.readFileSync('.github/workflows/firebase-hosting-deploy.yml', 'utf8');
  assert.ok(fb.includes('cp -R redirect dist'), 'firebase-hosting-deploy.yml must copy redirect into dist');
  assert.ok(!fb.includes('npm run build'), 'firebase-hosting-deploy.yml must not run a Vite build');
});

check('Pi fridge kiosk opens canonical App Hosting URL by default', () => {
  const sh = fs.readFileSync('scripts/pi/fridge-display.sh', 'utf8');
  assert.ok(
    sh.includes(`FRIDGE_URL:-${CANONICAL_ORIGIN}/#fridge`),
    'fridge-display.sh must default FRIDGE_URL to canonical App Hosting #fridge URL'
  );
});

check('server.js serves immutable asset cache headers and validates APP_REDIRECT_URL origin', () => {
  const srv = fs.readFileSync('server.js', 'utf8');
  assert.ok(srv.includes('public, max-age=31536000, immutable'), 'server.js must cache /assets/* immutably');
  assert.ok(srv.includes('no-cache, no-store, must-revalidate'), 'server.js must not cache html/json/sw.js');
  assert.ok(srv.includes('APP_REDIRECT_URL'), 'server.js must support optional APP_REDIRECT_URL for Pi');
  assert.ok(srv.includes('dest.origin !== APP_REDIRECT_ORIGIN'), 'server.js must guard redirect origin');
});

check('CLAUDE.md and deployment guidelines document the one canonical App Hosting link', () => {
  const claude = fs.readFileSync('CLAUDE.md', 'utf8');
  const guide = fs.readFileSync('.agents/rules/multi_deployment_and_cache_sync_guidelines.md', 'utf8');
  assert.ok(claude.includes(CANONICAL_ORIGIN) && claude.includes('redirect/'), 'CLAUDE.md must document canonical link and redirect/');
  assert.ok(guide.includes(CANONICAL_ORIGIN) && guide.includes('Redirect Only'), 'deployment guidelines must document canonical link and redirect-only hosts');
});

if (failed > 0) {
  console.error(`\n❌ ${failed} Phase 6 check(s) failed`);
  process.exit(1);
}
console.log(`\n✅ All ${passed} Phase 6 one-link checks passed!`);
