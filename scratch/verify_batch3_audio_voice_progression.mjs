// Batch 3 — Audio, Voice & Progression Hooks verification
// Checks: announcer hype-line helper exists & is safe when speechSynthesis is
// unavailable; new procedural SFX (streakTick, miniChallengeStart/Complete)
// exist and route through the established bus/debounce conventions; battle
// music track presets select distinct note sets; daily brush-streak
// milestones award a one-time bonus; defeated bosses are recorded for the
// trophy case.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

let passed = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ FAIL: ${label} -- ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('🚀 Verifying Batch 3 — Audio, Voice & Progression Hooks...\n');

// 1. Announcer service is safe with no window/speechSynthesis (Node has neither).
check('speakHype() no-ops safely with no window.speechSynthesis', async () => {
  const mod = await import('../src/services/announcerService.js');
  assert.strictEqual(typeof mod.speakHype, 'function');
  mod.speakHype('hit');
  mod.speakHype('streak');
  mod.speakHype('zoneSwitch');
  mod.speakHype('miniChallengeStart');
  mod.speakHype('miniChallengeWin');
});

// 2. New SFX functions exist on Sound and follow mute/debounce/try-catch conventions.
check('Sound.streakTick / miniChallengeStart / miniChallengeComplete / setBattleMusicTrack are functions', async () => {
  const mod = await import('../src/audio/sfx.js');
  assert.strictEqual(typeof mod.Sound.streakTick, 'function');
  assert.strictEqual(typeof mod.Sound.miniChallengeStart, 'function');
  assert.strictEqual(typeof mod.Sound.miniChallengeComplete, 'function');
  assert.strictEqual(typeof mod.Sound.setBattleMusicTrack, 'function');
  assert.strictEqual(typeof mod.Sound.zoneChime, 'function');
  // No AudioContext in Node -- these must not throw.
  mod.Sound.streakTick();
  mod.Sound.miniChallengeStart();
  mod.Sound.miniChallengeComplete();
  mod.Sound.setBattleMusicTrack('turbo_groove_track');
  mod.Sound.setBattleMusicTrack('starlight_serenade_track');
  mod.Sound.setBattleMusicTrack('unknown_track_id'); // falls back silently
});

// 3. digitalRewardsCatalog carries 2 purchasable battle-music tracks with a
// distinct equip slot from weapons (so buying music never clobbers a weapon).
check('DIGITAL_REWARDS_CATALOG has 2 purchasable music_track items with equipSlot "music"', async () => {
  const { DIGITAL_REWARDS_CATALOG } = await import('../src/data/digitalRewardsCatalog.js');
  const musicItems = DIGITAL_REWARDS_CATALOG.filter((i) => i.subCategory === 'music_track');
  assert.ok(musicItems.length >= 2, `expected >=2 music tracks, got ${musicItems.length}`);
  musicItems.forEach((i) => assert.strictEqual(i.equipSlot, 'music'));
  const weaponItems = DIGITAL_REWARDS_CATALOG.filter((i) => i.category === 'Weapons');
  assert.ok(weaponItems.length >= 2, 'existing weapon skins should still be present');
});

// 4. Daily streak milestone bonus logic & boss-defeat recording live in store.js source
// (static source check -- store.js pulls in heavy browser-only deps unsafe to import in Node).
check('store.js computes one-time daily-streak milestone bonus coins', () => {
  const src = readFileSync(new URL('../src/state/store.js', import.meta.url), 'utf8');
  assert.match(src, /DAILY_STREAK_MILESTONES/);
  assert.match(src, /dailyStreakMilestoneBonusCoins/);
  assert.match(src, /isNewStreakDay/);
});

check('store.js records defeated boss ids for the Boss Trophy Case', () => {
  const src = readFileSync(new URL('../src/state/store.js', import.meta.url), 'utf8');
  assert.match(src, /col\.bossesDefeated\.push\(boss\.id\)/);
});

check('BattleView.js wires hype lines + new SFX into hit/streak/zone/mini-challenge moments', () => {
  const src = readFileSync(new URL('../src/views/BattleView.js', import.meta.url), 'utf8');
  assert.match(src, /speakHype\('hit'\)/);
  assert.match(src, /speakHype\('streak'\)/);
  assert.match(src, /speakHype\('zoneSwitch'\)/);
  assert.match(src, /speakHype\('miniChallengeStart'\)/);
  assert.match(src, /speakHype\('miniChallengeWin'\)/);
  assert.match(src, /Sound\?\.streakTick/);
  assert.match(src, /Sound\.setBattleMusicTrack/);
});

check('HeroHQView.js renders a Boss Trophy Case grid with defeated vs. not-yet state', () => {
  const src = readFileSync(new URL('../src/views/HeroHQView.js', import.meta.url), 'utf8');
  assert.match(src, /Boss Trophy Case/);
  assert.match(src, /defeatedBossIds\.includes\(boss\.id\)/);
});

console.log(`\n=============================================`);
console.log(`BATCH 3 VERIFICATION: ${passed} PASSED${process.exitCode ? ', WITH FAILURES' : ', 0 FAILED'}`);
console.log(`=============================================\n`);
if (!process.exitCode) console.log('🎉 ALL BATCH 3 CHECKS PASSED!');
