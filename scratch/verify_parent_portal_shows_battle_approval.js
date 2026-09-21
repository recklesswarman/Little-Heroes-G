import './setup_mock_env.js';
import { store } from '../src/state/store.js';
import { renderParentPortalView } from '../src/views/ParentPortalView.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

const kidName = store.state.selectedHero.name;

store.initColosseumBattle('sugar_bandit', 120);
const reward = store.completeToothbrushBattle('sugar_bandit', 120, 92);
assert(reward && reward.bossName, 'Battle completed and returned a victory reward');

const html = renderParentPortalView();

assert(html.includes('Pending Sign-off Requests (1)'), 'Parent Portal inbox count reflects the new battle approval');
assert(html.includes('Toothbrush AR Battle: Defeated'), 'Parent Portal card shows the battle task title');
assert(html.includes(reward.bossName), "Parent Portal card names the defeated boss");
assert(html.includes(kidName), 'Parent Portal card shows the correct kid name');
assert(html.includes('Chore Point Request'), 'Parent Portal tags it as a point-approval request (task_point_approval)');
assert(html.includes('Pending Approval'), 'Parent Portal shows the pending Gold Points line');
assert(!html.includes('Inbox is Clear!'), 'Parent Portal no longer shows the empty-inbox state');

const req = store.state.pendingApprovals.find(r => r.taskId === 'morning_brush' || r.taskId === 'bedtime_brush');
assert(!!req, 'A queued approval exists matching the brush task id');
assert(html.includes(`+${req.pendingPoints} Gold Points`), `Parent Portal card shows the exact pending points (+${req.pendingPoints})`);

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');
process.exit(failed > 0 ? 1 : 0);
