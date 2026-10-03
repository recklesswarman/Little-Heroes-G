/**
 * scratch/verify_agy_multi_agent_architecture.mjs
 * 
 * Verifies the Google Antigravity (AGY) Multi-Agent Architecture for Little Heroes:
 * 1. JavaScript Service Layer (heroAgentService.js exports & fallback resilience)
 * 2. AppState snapshot compilation from store (quests, dental, battles, pet vitals)
 * 3. AGY Python Microservice structure (FastAPI main.py, Dockerfile, requirements)
 * 4. 5 Specialist AGY Agents & Subagents (Rex, Battle Coach, Quest Guide, Bedtime Narrator, Parent Intelligence)
 * 5. Proactive Triggers & Firestore Persistence modules
 */
import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('🧪 Starting AGY Multi-Agent Architecture Verification...\n');

// ── 1. Check Python Service File Tree ───────────────────────────────────────
console.log('--- 1. Testing AGY Python Service Files ---');

const expectedFiles = [
  'little-heroes-agy-service/main.py',
  'little-heroes-agy-service/Dockerfile',
  'little-heroes-agy-service/requirements.txt',
  'little-heroes-agy-service/schemas/responses.py',
  'little-heroes-agy-service/persistence/firestore_store.py',
  'little-heroes-agy-service/tools/hero_tools.py',
  'little-heroes-agy-service/tools/memory_tools.py',
  'little-heroes-agy-service/agents/rex_companion.py',
  'little-heroes-agy-service/agents/battle_coach.py',
  'little-heroes-agy-service/agents/quest_guide.py',
  'little-heroes-agy-service/agents/bedtime_narrator.py',
  'little-heroes-agy-service/agents/parent_intelligence.py',
  'little-heroes-agy-service/triggers/proactive.py',
];

for (const relPath of expectedFiles) {
  const fullPath = path.resolve(relPath);
  assert(fs.existsSync(fullPath), `Missing expected file: ${relPath}`);
  console.log(`  ✅ PASS: Found ${relPath}`);
}

// ── 2. Validate Agent Architecture in Python Files ──────────────────────────
console.log('\n--- 2. Validating Agent Configs & Subagents ---');

const rexContent = fs.readFileSync('little-heroes-agy-service/agents/rex_companion.py', 'utf8');
assert(rexContent.includes('subagent_battle_coach'), 'rex_companion must import subagent_battle_coach');
assert(rexContent.includes('subagent_quest_guide'), 'rex_companion must import subagent_quest_guide');
assert(rexContent.includes('subagent_bedtime_narrator'), 'rex_companion must import subagent_bedtime_narrator');
assert(rexContent.includes('enable_subagents=True'), 'rex_companion must enable subagents in CapabilitiesConfig');
assert(rexContent.includes('max_subagent_depth=2'), 'rex_companion must configure max_subagent_depth');
assert(rexContent.includes('BudgetConfig('), 'rex_companion must enforce budget limits');
assert(rexContent.includes('CompactionConfig('), 'rex_companion must configure compaction token threshold');
console.log('  ✅ PASS: Rex Companion agent configures 3 specialist subagents with budget & compaction');

const mainContent = fs.readFileSync('little-heroes-agy-service/main.py', 'utf8');
const expectedRoutes = [
  '/api/rex/chat',
  '/api/rex/battle-coach',
  '/api/rex/quest-guide',
  '/api/rex/bedtime-story',
  '/api/rex/parent-report',
  '/api/rex/proactive',
  '/health'
];
for (const route of expectedRoutes) {
  assert(mainContent.includes(route), `main.py must define route: ${route}`);
  console.log(`  ✅ PASS: main.py defines route ${route}`);
}

// ── 3. Validate JS Integration in heroAgentService.js ───────────────────────
console.log('\n--- 3. Validating JS heroAgentService.js Integration ---');

const jsContent = fs.readFileSync('src/services/heroAgentService.js', 'utf8');
const expectedExports = [
  'talkToRexAGY',
  'talkToRex',
  'playRexVoice',
  'getBattleCoachAdvice',
  'getQuestGuideDirections',
  'generateBedtimeChapterAGY',
  'checkProactiveTriggerAGY'
];
for (const exp of expectedExports) {
  assert(jsContent.includes(`export async function ${exp}`) || jsContent.includes(`export function ${exp}`), 
    `heroAgentService.js must export ${exp}`);
  console.log(`  ✅ PASS: heroAgentService.js exports ${exp}`);
}

assert(jsContent.includes('buildAppState'), 'heroAgentService.js must include buildAppState snapshot builder');
assert(jsContent.includes('AbortSignal.timeout'), 'heroAgentService.js must enforce request timeouts');
console.log('  ✅ PASS: heroAgentService has robust buildAppState and fetch timeout guards');

// ── 4. Test Live JS Fallback Execution in Node environment ──────────────────
console.log('\n--- 4. Testing Fallback Execution (Offline Resilience) ---');

// Dynamically import heroAgentService to verify it executes without crashing
const { getBattleCoachAdvice, getQuestGuideDirections, talkToRexAGY } = await import('../src/services/heroAgentService.js');

const coachAdvice = await getBattleCoachAdvice('sugar_bandit', 80, 1, 95);
assert(coachAdvice && coachAdvice.coach_text, 'getBattleCoachAdvice must return coach_text on fallback');
console.log(`  ✅ PASS: getBattleCoachAdvice fallback output: "${coachAdvice.coach_text}"`);

const questDirections = await getQuestGuideDirections('Super Leo', 2, ['wp_morning_sun'], 'wp_phonics_grove');
assert(questDirections && questDirections.guidance_text, 'getQuestGuideDirections must return guidance_text on fallback');
console.log(`  ✅ PASS: getQuestGuideDirections fallback output: "${questDirections.guidance_text}"`);

const rexResp = await talkToRexAGY('Hello Rex!', 'hero_test');
assert(rexResp && rexResp.reply, 'talkToRexAGY must return structured reply on fallback');
console.log(`  ✅ PASS: talkToRexAGY fallback output: "${rexResp.reply}"`);

console.log('\n=============================================');
console.log('TEST RESULTS: ALL AGY ARCHITECTURE CHECKS PASSED!');
console.log('=============================================\n');
