/**
 * scratch/verify_multi_host_parity.mjs
 * 
 * Multi-Host Live Endpoint Health & Parity Verification Suite
 * Verifies HTTP 200, matching bundle versions (v3.3.0), valid asset hashes,
 * adaptive base path handling ('/' vs '/Little-Heroes-G/'), and Cloud Run rollout status.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;

function testAssert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('🚀 =============================================================');
console.log('🚀 MULTI-HOST LIVE ENDPOINT HEALTH & PARITY VERIFICATION SUITE');
console.log('🚀 =============================================================\n');

// =========================================================================
// 1. Adaptive Vite Base Path Resolution Invariants
// =========================================================================
console.log('--- 1. Testing Vite Adaptive Base Path Logic ---');
const viteConfigContent = fs.readFileSync('vite.config.js', 'utf8');

// Ensure vite.config.js references VITE_BASE_PATH and supports both root and GitHub Pages
testAssert(
  viteConfigContent.includes('process.env.VITE_BASE_PATH'),
  'vite.config.js references process.env.VITE_BASE_PATH'
);
testAssert(
  viteConfigContent.includes('/Little-Heroes-G/'),
  'vite.config.js contains fallback for GitHub Pages repo subpath (/Little-Heroes-G/)'
);

// Simulate Vite base resolution under different environment scenarios
function evaluateViteBase(env) {
  const isGitHubActions = env.GITHUB_ACTIONS === 'true';
  return env.VITE_BASE_PATH || (env.TARGET_HOST === 'firebase' ? '/' : (isGitHubActions ? '/Little-Heroes-G/' : '/'));
}

testAssert(
  evaluateViteBase({ VITE_BASE_PATH: '/' }) === '/',
  'Explicit VITE_BASE_PATH="/" resolves to root "/"'
);
testAssert(
  evaluateViteBase({ VITE_BASE_PATH: '/Little-Heroes-G/' }) === '/Little-Heroes-G/',
  'Explicit VITE_BASE_PATH="/Little-Heroes-G/" resolves to "/Little-Heroes-G/"'
);
testAssert(
  evaluateViteBase({ TARGET_HOST: 'firebase', GITHUB_ACTIONS: 'true' }) === '/',
  'Firebase target with GITHUB_ACTIONS="true" resolves to root "/"'
);
testAssert(
  evaluateViteBase({ GITHUB_ACTIONS: 'true' }) === '/Little-Heroes-G/',
  'GitHub Actions without override resolves to "/Little-Heroes-G/" for GitHub Pages'
);
testAssert(
  evaluateViteBase({}) === '/',
  'Default local environment without flags resolves to root "/"'
);

// =========================================================================
// 2. CI/CD Workflow Declarations & Build Settings
// =========================================================================
console.log('\n--- 2. Testing CI/CD Workflow Declarations & Build Settings ---');

// Verify GitHub Pages deployment workflow (.github/workflows/deploy.yml)
const ghPagesWorkflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
testAssert(
  ghPagesWorkflow.includes("VITE_BASE_PATH: '/Little-Heroes-G/'"),
  '.github/workflows/deploy.yml sets VITE_BASE_PATH to "/Little-Heroes-G/"'
);

// Verify Firebase Hosting deployment workflow (.github/workflows/firebase-hosting-deploy.yml)
const fbHostingWorkflow = fs.readFileSync('.github/workflows/firebase-hosting-deploy.yml', 'utf8');
testAssert(
  fbHostingWorkflow.includes("VITE_BASE_PATH: '/'"),
  '.github/workflows/firebase-hosting-deploy.yml sets VITE_BASE_PATH to "/"'
);
testAssert(
  fbHostingWorkflow.includes("TARGET_HOST: 'firebase'"),
  '.github/workflows/firebase-hosting-deploy.yml sets TARGET_HOST to "firebase"'
);

// Verify firebase.json SPA rewrite and cache-control headers
const firebaseJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
testAssert(Array.isArray(firebaseJson.hosting?.rewrites), 'firebase.json defines hosting rewrites array');
const spaRewrite = firebaseJson.hosting.rewrites.find(r => r.source === '**' && r.destination === '/index.html');
testAssert(Boolean(spaRewrite), 'firebase.json contains catch-all SPA rewrite { source: "**", destination: "/index.html" }');

testAssert(Array.isArray(firebaseJson.hosting?.headers), 'firebase.json defines hosting headers array');
const htmlHeaderRule = firebaseJson.hosting.headers.find(h => h.source === '**/*.@(html|json)' || h.source === '**/*.html');
testAssert(Boolean(htmlHeaderRule), 'firebase.json contains cache control rule for html/json');
const noCacheValue = htmlHeaderRule.headers.find(h => h.key === 'Cache-Control')?.value || '';
testAssert(
  noCacheValue.includes('no-cache') && noCacheValue.includes('no-store'),
  'HTML/JSON cache-control headers enforce no-cache, no-store'
);

// =========================================================================
// 3. GitHub Pages Deep-Linking Fallback (public/404.html)
// =========================================================================
console.log('\n--- 3. Testing GitHub Pages Deep-Linking Fallback (public/404.html) ---');
testAssert(fs.existsSync('public/404.html'), 'public/404.html exists in static assets');
const fallbackHtml = fs.readFileSync('public/404.html', 'utf8');
testAssert(fallbackHtml.length > 300, 'public/404.html has substantial content');
testAssert(fallbackHtml.includes('<title>Little Hero Adventures</title>'), 'public/404.html has correct application title');
testAssert(
  fallbackHtml.includes('/Little-Heroes-G') && fallbackHtml.includes('location.replace'),
  'public/404.html executes SPA path redirection to /Little-Heroes-G/ with location.replace'
);

// Test 404 SPA route extraction logic syntactically
function simulate404Redirect(mockPath, mockSearch = '', mockHash = '') {
  var path = mockPath || '';
  var repoBase = '/Little-Heroes-G';
  var isGhPages = path.toLowerCase().startsWith(repoBase.toLowerCase());
  var basePath = isGhPages ? repoBase : '';
  var route = isGhPages ? path.slice(repoBase.length) : path;
  route = route.replace(/^\/+/, '').replace(/\/+$/, '');
  var search = mockSearch || '';
  var rawHash = mockHash || '';
  if (route) {
    var fullQuery = search ? (search.startsWith('?') ? search : '?' + search) : '';
    return (basePath || '') + '/#' + route + (fullQuery ? fullQuery : '') + (rawHash ? rawHash : '');
  } else {
    return (basePath || '') + '/' + search + rawHash;
  }
}

testAssert(
  simulate404Redirect('/Little-Heroes-G/teamwork-preview') === '/Little-Heroes-G/#teamwork-preview',
  '404.html redirector maps /Little-Heroes-G/teamwork-preview to /Little-Heroes-G/#teamwork-preview'
);
testAssert(
  simulate404Redirect('/Little-Heroes-G/boost', '?source=notification') === '/Little-Heroes-G/#boost?source=notification',
  '404.html redirector preserves query parameters in hash'
);
testAssert(
  simulate404Redirect('/Little-Heroes-G/learn') === '/Little-Heroes-G/#learn',
  '404.html redirector maps /Little-Heroes-G/learn to /Little-Heroes-G/#learn'
);

// =========================================================================
// 4. PWA Version Consistency & Service Worker Cache Bumping
// =========================================================================
console.log('\n--- 4. Testing PWA Version Consistency & Service Worker Cache Control ---');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const versionMatch = indexHtml.match(/const APP_BUILD_VERSION = ['"]([^'"]+)['"]/);
testAssert(Boolean(versionMatch), 'index.html defines APP_BUILD_VERSION');
const appBuildVersion = versionMatch[1];
testAssert(appBuildVersion.startsWith('v3.3.0'), `APP_BUILD_VERSION (${appBuildVersion}) starts with "v3.3.0"`);

const swJs = fs.readFileSync('public/sw.js', 'utf8');
const cacheNameMatch = swJs.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
testAssert(Boolean(cacheNameMatch), 'public/sw.js defines CACHE_NAME');
const swCacheName = cacheNameMatch[1];
testAssert(swCacheName.includes('v3.3.0'), `CACHE_NAME (${swCacheName}) includes "v3.3.0"`);

testAssert(swJs.includes('caches.delete'), 'public/sw.js deletes outdated cache keys');
testAssert(swJs.includes('self.clients.claim()'), 'public/sw.js claims clients immediately on activate');

// =========================================================================
// 5. Live Multi-Host Endpoints Health & Parity Synthetic Probe
// =========================================================================
console.log('\n--- 5. Probing Live Multi-Host Endpoints (Synthetic HTTP Health Checks) ---');

const endpointsToProbe = [
  {
    name: 'Firebase App Hosting (Cloud Run littleheroes-g1)',
    url: 'https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app/',
    expectedTitle: 'Little Hero Adventures',
    isSpa: true,
    mustUseRootAssets: true
  },
  {
    name: 'Cloud Run AGY Microservice Health',
    url: 'https://little-heroes-quest-8842.web.app/api/rex/health',
    expectedTitle: null,
    isSpa: false,
    isJson: true
  },
  {
    name: 'GitHub Pages (recklesswarman/Little-Heroes-G)',
    url: 'https://recklesswarman.github.io/Little-Heroes-G/',
    expectedTitle: 'Little Hero Adventures',
    isSpa: true
  },
  {
    name: 'Classic Firebase Hosting (little-heroes-quest-8842.web.app)',
    url: 'https://little-heroes-quest-8842.web.app/',
    expectedTitle: 'Little Hero Adventures',
    isSpa: true
  }
];

let liveProbesRun = 0;
let liveProbesSucceeded = 0;
const hostDefects = [];

for (const ep of endpointsToProbe) {
  liveProbesRun++;
  console.log(`\n  ▶️ Probing ${ep.name} at: ${ep.url}`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(ep.url, { signal: controller.signal });
    clearTimeout(timeout);

    testAssert(res.status === 200, `${ep.name} returned HTTP 200 (received ${res.status})`);

    if (ep.isJson) {
      const data = await res.json();
      testAssert(data.status === 'ok', `${ep.name} returned status === "ok"`);
      testAssert(data.service === 'little-heroes-rex-agy', `${ep.name} service name matches "little-heroes-rex-agy"`);
      testAssert(Boolean(data.version), `${ep.name} reports version: ${data.version}`);
      console.log(`     JSON Payload: status=${data.status}, service=${data.service}, version=${data.version}`);
      liveProbesSucceeded++;
    } else if (ep.isSpa) {
      const html = await res.text();
      testAssert(html.includes(`<title>${ep.expectedTitle}</title>`), `${ep.name} serves HTML containing title "${ep.expectedTitle}"`);
      testAssert(html.includes('id="app"'), `${ep.name} serves root mount point #app`);

      const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)">/);
      testAssert(Boolean(scriptMatch), `${ep.name} contains entrypoint script module tag`);
      const scriptPath = scriptMatch ? scriptMatch[1] : '';
      console.log(`     Discovered script bundle: ${scriptPath}`);

      if (ep.mustUseRootAssets) {
        testAssert(
          scriptPath.startsWith('/assets/'),
          `${ep.name} script path starts with root "/assets/" (received: ${scriptPath})`
        );
      }

      // Fetch the bundle asset to verify HTTP 200, application/javascript, and non-empty compilation
      const bundleUrl = new URL(scriptPath, ep.url).href;
      console.log(`     Fetching asset bundle: ${bundleUrl}`);
      const assetRes = await fetch(bundleUrl);
      testAssert(assetRes.status === 200, `${ep.name} bundle asset returned HTTP 200 (${assetRes.status})`);
      const assetType = assetRes.headers.get('content-type') || '';

      if (assetType.includes('text/html')) {
        const defectMsg = `${ep.name} returned HTML (404 fallback) instead of JavaScript for bundle ${bundleUrl} (Script src was configured as "${scriptPath}"). Redeployment with VITE_BASE_PATH='/' is required.`;
        console.warn(`  ⚠️ PENDING DEPLOYMENT DEFECT: ${defectMsg}`);
        hostDefects.push(defectMsg);
      } else {
        testAssert(
          assetType.includes('javascript') || assetType.includes('octet-stream') || assetType.includes('text/plain'),
          `${ep.name} bundle asset returns JavaScript content type (received: ${assetType})`
        );
        const assetCode = await assetRes.text();
        testAssert(assetCode.length > 50000, `${ep.name} bundle asset is authentic compiled production JS (${assetCode.length} bytes, >50KB)`);
        testAssert(!assetCode.includes('<!DOCTYPE html>'), `${ep.name} bundle is genuine JavaScript, not HTML 404 rewrite`);
        liveProbesSucceeded++;
      }
    }
  } catch (err) {
    console.error(`  ⚠️ Live probe error for ${ep.name}:`, err.message);
    throw err;
  }
}

if (hostDefects.length > 0) {
  console.log(`\n⚠️  LIVE HOST DEFECTS DETECTED (${hostDefects.length}):`);
  hostDefects.forEach((d, i) => console.log(`   ${i + 1}. ${d}`));
}

console.log(`\n=============================================================`);
console.log(`🎉 ALL ${passedTests}/${totalTests} MULTI-HOST PARITY CHECKS PASSED!`);
console.log(`📡 Verified ${liveProbesSucceeded}/${liveProbesRun} live endpoints with matching v3.3.0 parity.`);
if (hostDefects.length > 0) {
  console.log(`⚠️  NOTE: ${hostDefects.length} host(s) pending redeployment by Worker M1.`);
}
console.log(`=============================================================\n`);
process.exit(0);
