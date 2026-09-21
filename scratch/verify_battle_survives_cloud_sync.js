import './setup_mock_env.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

// Simulate a battle in progress on this device: HP partway down, mid-countdown.
store.initColosseumBattle('sugar_bandit', 120);
const liveCol = store.getBossColosseumState();
liveCol.currentHp = 42;
liveCol.secondsRemaining = 61;
liveCol.comboCount = 7;

// A cloud snapshot arrives (e.g. from another device, or an earlier/stale save
// echoed back) that carries a completely different bossColosseum payload.
store.hydrateFromCloud({
  stateSnapshot: {
    bossColosseum: {
      activeBossId: 'cavity_knight',
      currentHp: 999,
      maxHp: 999,
      secondsRemaining: 5,
      isVictoryModalOpen: true,
      hasAwardedVictory: true
    }
  }
});

const colAfterSync = store.getBossColosseumState();
assert(colAfterSync.currentHp === 42, `Live battle HP survives cloud sync (got ${colAfterSync.currentHp})`);
assert(colAfterSync.secondsRemaining === 61, `Live battle countdown survives cloud sync (got ${colAfterSync.secondsRemaining})`);
assert(colAfterSync.activeBossId === 'sugar_bandit', `Live battle boss survives cloud sync (got ${colAfterSync.activeBossId})`);
assert(colAfterSync.isVictoryModalOpen === false, 'Cloud snapshot cannot force-open the victory modal on this device');
assert(colAfterSync === liveCol, 'getBossColosseumState() still returns the same live object after a cloud sync');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
