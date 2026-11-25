/**
 * scratch/verify_no_direct_balance_mutation.mjs
 *
 * Phase 3 Static Guard:
 * 1. Fails if any file under src/ (outside walletService.js, src/data/, and
 *    legacy-wrapped store.js) directly mutates hero balance fields
 *    (coins, points, xp, sparks, evolutionSparks, petSparkMap, petXpMap, petLevelMap)
 *    without being marked `// LEGACY_LEDGER` or inside `if (isLegacyLedger())`.
 * 2. Fails if Math Gate (`generateMathChallenge`, `mathChallengeEnabled`) or
 *    legacy `src/utils/biometrics.js` are reintroduced.
 * 3. Fails if unused `submitTaskForApproval` or `addPendingApproval` are reintroduced in store.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

// Direct mutation of hero balance properties (excluding definition edits like habit.coins / chore.points,
// Three.js particle arrays like this.sparks = [], and out-of-scope petBondMap[petId].xp).
const MUTATION_RE = /\b(hero|selectedHero|targetHero|h|kid)\.(coins|points|xp|sparks|evolutionSparks)\s*([+-])?=(?!=)|\bpet(Spark|Xp|Level)Map\[[^\]]+\]\s*([+-])?=(?!=)/;

const EXEMPT_FILES = new Set([
  'src/services/walletService.js',
  // store.js legacy methods are intercepted by attachLedgerBridge(store) when !isLegacyLedger()
  'src/state/store.js'
]);

const violations = [];
const allFiles = walk(SRC_DIR);

for (const absPath of allFiles) {
  const rel = path.relative(REPO_ROOT, absPath).replace(/\\/g, '/');
  if (rel.startsWith('src/data/') || EXEMPT_FILES.has(rel)) continue;

  const lines = fs.readFileSync(absPath, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('LEGACY_LEDGER')) continue;
    if (MUTATION_RE.test(line)) {
      violations.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  }
}

console.log('🧪 Running Phase 3 Static Guard (verify_no_direct_balance_mutation.mjs)...');

assert.equal(
  violations.length,
  0,
  `Direct balance mutations found outside walletService/legacy branches:\n${violations.join('\n')}`
);
console.log('  ✅ Zero direct hero balance mutations outside walletService.js and bridged legacy store.js');

// Check Math Gate and legacy biometrics.js are gone
assert.equal(
  fs.existsSync(path.join(REPO_ROOT, 'src/utils/biometrics.js')),
  false,
  'src/utils/biometrics.js must be deleted (replaced by passkeyClient.js)'
);

const lockModalSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/components/ParentLockModal.js'), 'utf8');
assert.equal(lockModalSrc.includes('generateMathChallenge'), false, 'generateMathChallenge must be removed');
assert.equal(lockModalSrc.includes('mathChallengeEnabled'), false, 'mathChallengeEnabled must be removed');
assert.equal(lockModalSrc.includes('Math Gate'), false, 'Math Gate tab must be removed');
console.log('  ✅ Math Gate and src/utils/biometrics.js removed');

// Check unused submitTaskForApproval / addPendingApproval are deleted from store.js
const storeSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/state/store.js'), 'utf8');
assert.equal(/^\s*submitTaskForApproval\s*\(/m.test(storeSrc), false, 'submitTaskForApproval must be deleted from store.js');
assert.equal(/^\s*addPendingApproval\s*\(/m.test(storeSrc), false, 'addPendingApproval must be deleted from store.js');
assert.equal(storeSrc.includes('attachLedgerBridge(new Store())'), true, 'store.js must attach ledgerStoreBridge');
console.log('  ✅ Unused submitTaskForApproval/addPendingApproval removed and ledgerStoreBridge attached');

console.log('✅ All Phase 3 static guards passed!');
