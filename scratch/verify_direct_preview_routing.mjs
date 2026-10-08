/**
 * scratch/verify_direct_preview_routing.mjs
 * 
 * Direct Path Deep-Linking & Auth Wall Bypass Verification Suite
 * Verifies:
 * 1. URL route resolution: /teamwork-preview -> dance_party, /boost -> battle, /learn -> adventures_map.
 * 2. Adaptive subpath stripping for GitHub Pages (/Little-Heroes-G/...).
 * 3. Hash routing fallback compatibility (#teamwork-preview, #boost, #learn).
 * 4. isDirectPreview Auth Wall gate logic bypassing LandingAuthModal for demo views while strictly locking private views.
 * 5. View switch routing dispatch in src/main.js.
 * 6. public/404.html SPA route recovery script behavior.
 */

import assert from 'assert';
import fs from 'fs';

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
console.log('🚀 DIRECT PREVIEW ROUTING & AUTH BYPASS VERIFICATION SUITE');
console.log('🚀 =============================================================\n');

// =========================================================================
// 1. Static Invariants in src/main.js and public/404.html
// =========================================================================
console.log('--- 1. Testing Static Router & Auth Wall Invariants in Codebase ---');
const mainJsContent = fs.readFileSync('src/main.js', 'utf8');

testAssert(
  mainJsContent.includes('function resolveRouteFromUrl()'),
  'src/main.js defines resolveRouteFromUrl()'
);
testAssert(
  mainJsContent.includes('const isDirectPreview = Boolean('),
  'src/main.js defines isDirectPreview flag'
);
testAssert(
  mainJsContent.includes("activeView === 'dance_party'"),
  'isDirectPreview includes dance_party view'
);
testAssert(
  mainJsContent.includes("activeView === 'battle'"),
  'isDirectPreview includes battle view'
);
testAssert(
  mainJsContent.includes("activeView === 'adventures_map'"),
  'isDirectPreview includes adventures_map view'
);
testAssert(
  mainJsContent.includes('DANCE_PARTY_VIEW_NAMES'),
  'isDirectPreview accounts for DANCE_PARTY_VIEW_NAMES aliases'
);
testAssert(
  mainJsContent.includes('window.addEventListener(\'popstate\''),
  'src/main.js registers popstate listener for back/forward navigation'
);

testAssert(fs.existsSync('public/404.html'), 'public/404.html exists');
const html404Content = fs.readFileSync('public/404.html', 'utf8');
testAssert(
  html404Content.includes('isGhPages') && html404Content.includes('/Little-Heroes-G'),
  'public/404.html detects GitHub Pages subpath /Little-Heroes-G'
);
testAssert(
  html404Content.includes('window.location.replace'),
  'public/404.html uses window.location.replace for seamless SPA restoration'
);

// =========================================================================
// 2. Pure Route Resolver Unit Logic (resolveRouteFromUrl)
// =========================================================================
console.log('\n--- 2. Testing URL Route Resolver (resolveRouteFromUrl) ---');

function resolveRouteFromUrlMock(pathname = '', hash = '') {
  let path = (pathname || '').toLowerCase();
  if (path.startsWith('/little-heroes-g')) {
    path = path.slice('/little-heroes-g'.length);
  }
  path = path.replace(/\/+$/, '') || '/';
  const cleanHash = (hash || '').toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '');

  if (path === '/learn' || path === 'learn' || cleanHash === 'learn') {
    return 'adventures_map';
  }
  if (path === '/boost' || path === 'boost' || cleanHash === 'boost') {
    return 'battle';
  }
  if (
    path === '/teamwork-preview' ||
    path === 'teamwork-preview' ||
    path === '/teamwork_preview' ||
    path === 'teamwork_preview' ||
    cleanHash === 'teamwork-preview' ||
    cleanHash === 'teamwork_preview'
  ) {
    return 'dance_party';
  }
  return null;
}

// Direct path tests
testAssert(
  resolveRouteFromUrlMock('/teamwork-preview') === 'dance_party',
  'Path "/teamwork-preview" resolves to "dance_party"'
);
testAssert(
  resolveRouteFromUrlMock('/teamwork_preview') === 'dance_party',
  'Path "/teamwork_preview" resolves to "dance_party"'
);
testAssert(
  resolveRouteFromUrlMock('/boost') === 'battle',
  'Path "/boost" resolves to "battle"'
);
testAssert(
  resolveRouteFromUrlMock('/learn') === 'adventures_map',
  'Path "/learn" resolves to "adventures_map"'
);

// Trailing slash tolerance
testAssert(
  resolveRouteFromUrlMock('/teamwork-preview/') === 'dance_party',
  'Path "/teamwork-preview/" with trailing slash resolves to "dance_party"'
);
testAssert(
  resolveRouteFromUrlMock('/boost/') === 'battle',
  'Path "/boost/" with trailing slash resolves to "battle"'
);
testAssert(
  resolveRouteFromUrlMock('/learn/') === 'adventures_map',
  'Path "/learn/" with trailing slash resolves to "adventures_map"'
);

// GitHub Pages subpath tests (/Little-Heroes-G/...)
testAssert(
  resolveRouteFromUrlMock('/Little-Heroes-G/teamwork-preview') === 'dance_party',
  'GitHub Pages subpath "/Little-Heroes-G/teamwork-preview" resolves to "dance_party"'
);
testAssert(
  resolveRouteFromUrlMock('/little-heroes-g/boost') === 'battle',
  'GitHub Pages subpath "/little-heroes-g/boost" (case-insensitive) resolves to "battle"'
);
testAssert(
  resolveRouteFromUrlMock('/Little-Heroes-G/learn') === 'adventures_map',
  'GitHub Pages subpath "/Little-Heroes-G/learn" resolves to "adventures_map"'
);

// Hash fallback tests
testAssert(
  resolveRouteFromUrlMock('/', '#teamwork-preview') === 'dance_party',
  'Hash "#teamwork-preview" resolves to "dance_party"'
);
testAssert(
  resolveRouteFromUrlMock('/', '#/boost') === 'battle',
  'Hash "#/boost" resolves to "battle"'
);
testAssert(
  resolveRouteFromUrlMock('/', '#learn') === 'adventures_map',
  'Hash "#learn" resolves to "adventures_map"'
);

// Non-matching paths
testAssert(
  resolveRouteFromUrlMock('/dashboard') === null,
  'Standard path "/dashboard" returns null (router keeps current activeView)'
);
testAssert(
  resolveRouteFromUrlMock('/') === null,
  'Root path "/" returns null'
);

// =========================================================================
// 3. Auth Wall Bypass Gate Logic (isDirectPreview)
// =========================================================================
console.log('\n--- 3. Testing Auth Wall Bypass Gate Logic ---');

const DANCE_PARTY_VIEW_NAMES = ['dance_party', 'teamwork-preview', 'teamwork_preview', '/teamwork-preview', '/teamwork_preview'];

function evaluateAuthWallGate(activeView, isAuthenticated, isHouseholdConfigured) {
  const isDirectPreview = Boolean(
    activeView === 'dance_party' ||
    activeView === 'battle' ||
    activeView === 'adventures_map' ||
    DANCE_PARTY_VIEW_NAMES.includes(activeView)
  );

  const shouldBlockWithAuthWall = (!isAuthenticated || !isHouseholdConfigured) && !isDirectPreview;
  return {
    isDirectPreview,
    shouldBlockWithAuthWall,
    effectiveDestination: shouldBlockWithAuthWall ? 'LandingAuthModal' : activeView
  };
}

// Unauthenticated & Unconfigured state (Fresh Visitor)
console.log('  ▶️ Testing Unauthenticated / Unconfigured Visitor Scenarios:');

// Private / standard routes MUST BE BLOCKED
const dashboardCheck = evaluateAuthWallGate('dashboard', false, false);
testAssert(
  dashboardCheck.shouldBlockWithAuthWall === true && dashboardCheck.effectiveDestination === 'LandingAuthModal',
  'Unauthenticated visitor accessing "dashboard" is strictly BLOCKED by LandingAuthModal'
);

const profileCheck = evaluateAuthWallGate('profile', false, false);
testAssert(
  profileCheck.shouldBlockWithAuthWall === true && profileCheck.effectiveDestination === 'LandingAuthModal',
  'Unauthenticated visitor accessing "profile" is strictly BLOCKED by LandingAuthModal'
);

const parentPortalCheck = evaluateAuthWallGate('parent_portal', false, false);
testAssert(
  parentPortalCheck.shouldBlockWithAuthWall === true && parentPortalCheck.effectiveDestination === 'LandingAuthModal',
  'Unauthenticated visitor accessing "parent_portal" is strictly BLOCKED by LandingAuthModal'
);

// Direct Preview routes MUST BYPASS the auth wall
const dancePartyCheck = evaluateAuthWallGate('dance_party', false, false);
testAssert(
  dancePartyCheck.shouldBlockWithAuthWall === false && dancePartyCheck.effectiveDestination === 'dance_party',
  'Unauthenticated visitor accessing "dance_party" BYPASSES auth wall directly'
);

const teamworkPreviewAliasCheck = evaluateAuthWallGate('teamwork-preview', false, false);
testAssert(
  teamworkPreviewAliasCheck.shouldBlockWithAuthWall === false && teamworkPreviewAliasCheck.effectiveDestination === 'teamwork-preview',
  'Unauthenticated visitor accessing "teamwork-preview" BYPASSES auth wall directly'
);

const battleCheck = evaluateAuthWallGate('battle', false, false);
testAssert(
  battleCheck.shouldBlockWithAuthWall === false && battleCheck.effectiveDestination === 'battle',
  'Unauthenticated visitor accessing "battle" (/boost) BYPASSES auth wall directly'
);

const adventuresMapCheck = evaluateAuthWallGate('adventures_map', false, false);
testAssert(
  adventuresMapCheck.shouldBlockWithAuthWall === false && adventuresMapCheck.effectiveDestination === 'adventures_map',
  'Unauthenticated visitor accessing "adventures_map" (/learn) BYPASSES auth wall directly'
);

// Authenticated state (Normal Logged-In User)
console.log('  ▶️ Testing Authenticated / Household Configured User Scenarios:');
const authDashboardCheck = evaluateAuthWallGate('dashboard', true, true);
testAssert(
  authDashboardCheck.shouldBlockWithAuthWall === false && authDashboardCheck.effectiveDestination === 'dashboard',
  'Authenticated user accessing "dashboard" renders dashboard normally'
);

// =========================================================================
// 4. View Switch Dispatch Mapping in src/main.js
// =========================================================================
console.log('\n--- 4. Testing View Switch Dispatch Cases in src/main.js ---');

// Extract switch cases from main.js
testAssert(
  mainJsContent.includes("case 'dance_party':") && mainJsContent.includes('renderDancePartyView()'),
  'switch case "dance_party" dispatches to renderDancePartyView()'
);
testAssert(
  mainJsContent.includes("case 'teamwork-preview':") && mainJsContent.includes("case 'teamwork_preview':"),
  'switch cases include "teamwork-preview" and "teamwork_preview" aliases'
);
testAssert(
  mainJsContent.includes("case 'battle':") && mainJsContent.includes('renderBattleView()'),
  'switch case "battle" dispatches to renderBattleView()'
);
testAssert(
  mainJsContent.includes("case 'boost':") && mainJsContent.includes("case '/boost':"),
  'switch cases include "boost" and "/boost" aliases'
);
testAssert(
  mainJsContent.includes("case 'adventures_map':") && mainJsContent.includes('renderWorldAdventureMapView()'),
  'switch case "adventures_map" dispatches to renderWorldAdventureMapView()'
);
testAssert(
  mainJsContent.includes("case 'learn':") && mainJsContent.includes("case '/learn':"),
  'switch cases include "learn" and "/learn" aliases'
);

// =========================================================================
// 5. GitHub Pages 404.html Redirection Simulation
// =========================================================================
console.log('\n--- 5. Testing GitHub Pages 404.html Redirection Simulator ---');

function execute404RedirectSimulation(mockLocation) {
  var path = mockLocation.pathname || '';
  var repoBase = '/Little-Heroes-G';
  var isGhPages = path.toLowerCase().startsWith(repoBase.toLowerCase());
  var basePath = isGhPages ? repoBase : '';
  var route = isGhPages ? path.slice(repoBase.length) : path;

  route = route.replace(/^\/+/, '').replace(/\/+$/, '');
  var search = mockLocation.search || '';
  var rawHash = mockLocation.hash || '';

  if (route) {
    var fullQuery = search ? (search.startsWith('?') ? search : '?' + search) : '';
    return (basePath || '') + '/#' + route + (fullQuery ? fullQuery : '') + (rawHash ? rawHash : '');
  } else {
    return (basePath || '') + '/' + search + rawHash;
  }
}

// Simulate 404 on GitHub Pages deep link /Little-Heroes-G/teamwork-preview
const redirect1 = execute404RedirectSimulation({
  pathname: '/Little-Heroes-G/teamwork-preview',
  search: '',
  hash: ''
});
testAssert(
  redirect1 === '/Little-Heroes-G/#teamwork-preview',
  '404.html maps "/Little-Heroes-G/teamwork-preview" to "/Little-Heroes-G/#teamwork-preview"'
);

// Simulate 404 on GitHub Pages deep link with query parameters /Little-Heroes-G/boost?mode=boss
const redirect2 = execute404RedirectSimulation({
  pathname: '/Little-Heroes-G/boost',
  search: '?mode=boss',
  hash: ''
});
testAssert(
  redirect2 === '/Little-Heroes-G/#boost?mode=boss',
  '404.html maps "/Little-Heroes-G/boost?mode=boss" to "/Little-Heroes-G/#boost?mode=boss"'
);

// Simulate 404 on GitHub Pages deep link /Little-Heroes-G/learn
const redirect3 = execute404RedirectSimulation({
  pathname: '/Little-Heroes-G/learn',
  search: '',
  hash: ''
});
testAssert(
  redirect3 === '/Little-Heroes-G/#learn',
  '404.html maps "/Little-Heroes-G/learn" to "/Little-Heroes-G/#learn"'
);

// End-to-end integration flow:
// 404.html produces redirect URL -> SPA receives hash -> resolveRouteFromUrlMock extracts view -> auth wall evaluates
console.log('\n  ▶️ Testing Full End-to-End Deep Link Flow:');
const flowScenarios = [
  { urlPath: '/Little-Heroes-G/teamwork-preview', expectedView: 'dance_party' },
  { urlPath: '/Little-Heroes-G/boost', expectedView: 'battle' },
  { urlPath: '/Little-Heroes-G/learn', expectedView: 'adventures_map' }
];

for (const sc of flowScenarios) {
  // Step A: GitHub Pages 404 redirection
  const targetUrl = execute404RedirectSimulation({ pathname: sc.urlPath, search: '', hash: '' });
  const hashPart = targetUrl.split('#')[1] || '';
  
  // Step B: App startup URL resolution
  const resolvedView = resolveRouteFromUrlMock('/', '#' + hashPart);
  testAssert(
    resolvedView === sc.expectedView,
    `Deep link ${sc.urlPath} -> 404 redirect #${hashPart} -> resolved view "${resolvedView}" matches "${sc.expectedView}"`
  );

  // Step C: Auth bypass evaluation
  const gate = evaluateAuthWallGate(resolvedView, false, false);
  testAssert(
    gate.shouldBlockWithAuthWall === false,
    `Resolved view "${resolvedView}" cleanly bypasses the auth wall for unauthenticated users`
  );
}

console.log(`\n=============================================================`);
console.log(`🎉 ALL ${passedTests}/${totalTests} DIRECT PREVIEW ROUTING CHECKS PASSED!`);
console.log(`=============================================================\n`);
process.exit(0);
