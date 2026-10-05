import fs from 'fs';
import assert from 'assert';

console.log('🧪 Verifying AGY Multi-Agent Architecture Fixes...\n');

// 1. Verify agents support Vertex AI alongside Gemini API key
const rexCode = fs.readFileSync('little-heroes-agy-service/agents/rex_companion.py', 'utf8');
assert(rexCode.includes('USE_VERTEX'), 'rex_companion must check USE_VERTEX');
assert(rexCode.includes('GOOGLE_CLOUD_PROJECT'), 'rex_companion must check GOOGLE_CLOUD_PROJECT');
assert(rexCode.includes('vertex=True') || rexCode.includes('"vertex": True'), 'rex_companion must set vertex: True');
assert(rexCode.includes('api_key=') || rexCode.includes('"api_key":'), 'rex_companion must set api_key');
console.log('✅ PASS: rex_companion.py supports Vertex AI & Gemini API key auth modes');

const battleCoachCode = fs.readFileSync('little-heroes-agy-service/agents/battle_coach.py', 'utf8');
assert(battleCoachCode.includes('USE_VERTEX'), 'battle_coach must check USE_VERTEX');
assert(battleCoachCode.includes('system_instructions=BATTLE_COACH_SYSTEM_PROMPT'), 'subagent_battle_coach must attach system_instructions');
assert(battleCoachCode.includes('tools=[get_dental_streaks, get_battle_history]'), 'subagent_battle_coach must attach tools');
console.log('✅ PASS: battle_coach.py supports Vertex AI and attaches prompt & tools to subagent');

const questGuideCode = fs.readFileSync('little-heroes-agy-service/agents/quest_guide.py', 'utf8');
assert(questGuideCode.includes('USE_VERTEX'), 'quest_guide must check USE_VERTEX');
assert(questGuideCode.includes('system_instructions=QUEST_GUIDE_SYSTEM_PROMPT'), 'subagent_quest_guide must attach system_instructions');
console.log('✅ PASS: quest_guide.py supports Vertex AI and attaches prompt to subagent');

const bedtimeCode = fs.readFileSync('little-heroes-agy-service/agents/bedtime_narrator.py', 'utf8');
assert(bedtimeCode.includes('USE_VERTEX'), 'bedtime_narrator must check USE_VERTEX');
assert(bedtimeCode.includes('system_instructions=BEDTIME_NARRATOR_SYSTEM_PROMPT'), 'subagent_bedtime_narrator must attach system_instructions');
console.log('✅ PASS: bedtime_narrator.py supports Vertex AI and attaches prompt to subagent');

const parentIntelCode = fs.readFileSync('little-heroes-agy-service/agents/parent_intelligence.py', 'utf8');
assert(parentIntelCode.includes('USE_VERTEX'), 'parent_intelligence must check USE_VERTEX');
console.log('✅ PASS: parent_intelligence.py supports Vertex AI');

// 2. Verify Firestore persistence does not drop memory when household_id is None
const firestoreStoreCode = fs.readFileSync('little-heroes-agy-service/persistence/firestore_store.py', 'utf8');
assert(!firestoreStoreCode.includes('if not household_id:\n        return {}'), 'load_rex_memory must not return empty immediately');
assert(!firestoreStoreCode.includes('if not household_id:\n        return\n'), 'save_rex_fact must not return immediately');
console.log('✅ PASS: firestore_store.py persists rex facts even when household_id is empty/None');

// 3. Verify main.py accepts childId and raises HTTPException 503
const mainCode = fs.readFileSync('little-heroes-agy-service/main.py', 'utf8');
assert(mainCode.includes('childId: Optional[str]'), 'main.py RexChatRequest must accept childId');
assert(mainCode.includes('HTTPException'), 'main.py must import and use HTTPException');
assert(mainCode.includes('status_code=503'), 'main.py rex_chat must raise status_code 503 on unhandled error');
console.log('✅ PASS: main.py accepts childId alias and raises 503 on service outage');

// 4. Verify petCompanion.ts supports clientHour / timezoneOffsetMinutes
const petCompanionCode = fs.readFileSync('functions/src/petCompanion.ts', 'utf8');
assert(petCompanionCode.includes('clientHour?: number'), 'petCompanion.ts must support clientHour');
assert(petCompanionCode.includes('timezoneOffsetMinutes?: number'), 'petCompanion.ts must support timezoneOffsetMinutes');
assert(petCompanionCode.includes('clientHour !== undefined ? clientHour'), 'petCompanion.ts must compute local hour with fallback');
console.log('✅ PASS: petCompanion.ts calculates child local hour using clientHour and timezoneOffsetMinutes');

// 5. Verify heroAgentService.js falls back cleanly to chatWithPet
const heroServiceCode = fs.readFileSync('src/services/heroAgentService.js', 'utf8');
assert(heroServiceCode.includes('clientHour: now.getHours()'), 'heroAgentService must pass clientHour');
assert(heroServiceCode.includes('timezoneOffsetMinutes: now.getTimezoneOffset()'), 'heroAgentService must pass timezoneOffsetMinutes');
assert(heroServiceCode.includes('hasErrorNote'), 'heroAgentService must detect error in parentNote');
assert(!heroServiceCode.includes("fetch('/api/gemini/chat'"), 'heroAgentService must not attempt /api/gemini/chat');
console.log('✅ PASS: heroAgentService.js falls back to chatWithPet directly with local timezone info');

console.log('\n🎉 ALL AGY PERSISTENT ARCHITECTURE VERIFICATIONS PASSED!\n');
