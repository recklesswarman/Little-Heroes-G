import './setup_mock_env.js';
import { store } from '../src/state/store.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

store.initColosseumBattle('sugar_bandit', 120);
const before = { points: store.state.selectedHero.points || 0, pending: (store.state.pendingApprovals || []).length };

const reward = store.completeToothbrushBattle('sugar_bandit', 120, 90);

assert(reward && reward.coins > 0, 'Battle completion returns a coin reward');
assert(store.state.pendingApprovals.length === before.pending + 1, 'A new pendingApprovals entry was queued for the battle');

const req = store.state.pendingApprovals[store.state.pendingApprovals.length - 1];
assert(req.type === 'task_point_approval', 'Queued approval has type task_point_approval');
assert(req.pendingPoints > 0, `Queued approval carries pendingPoints (${req.pendingPoints})`);
assert(req.kidId === store.state.selectedHero.id, 'Queued approval references the correct kid');

store.approveParentRequest(req.id);
const after = store.state.selectedHero.points || 0;
assert(after === before.points + req.pendingPoints, `Hero points increased by the pending amount (${before.points} -> ${after})`);
assert(store.state.pendingApprovals.length === before.pending, 'Approval removed from pending queue after approval');

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
