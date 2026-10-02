import { hanaBattle3DService } from '../services/hanaBattle3DService.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, DENTAL_QUADRANTS, getDentalQuadrant, SUGAR_ATTACK_HAZARDS, getSugarHazardById } from '../data/hygieneBossesData.js';
import { brushAudioAnalyzer } from '../audio/brushAudioAnalyzer.js';
import { DIGITAL_REWARDS_CATALOG } from '../data/digitalRewardsCatalog.js';

const sugarVillainEscapedImg = new URL('../assets/sugar_villain_escaped.jpg', import.meta.url).href;

// Difficulty tiers reuse each kid's existing gameDifficulty
// (easy = Toddler 3-4, medium = Kids 5-6, hard = Kids 7-9): pacing only
// (how often bombs attack / how forgiving the auto-assist is) varies by
// tier. The battle's total countdown length never varies by kid -- it is
// always exactly the duration the parent selected in the Parent Panel.
const BATTLE_DIFFICULTY = {
  easy: { bombIntervalMs: 26000, autoAssistIdleMs: 1200 },
  medium: { bombIntervalMs: 18000, autoAssistIdleMs: 1800 },
  hard: { bombIntervalMs: 13000, autoAssistIdleMs: 2400 }
};
function getDifficultyTier(hero) {
  const tier = hero?.gameDifficulty;
  return ['easy', 'medium', 'hard'].includes(tier) ? tier : 'medium';
}

// Resolves the currently-selected kid's id the same way across every call
// site that needs it (reward crediting, hazard rotation, etc.) instead of
// each one re-deriving it slightly differently.
function getActiveHeroId() {
  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  return hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
}

// =========================================================================
// LIVE-ACTION 3D CARTOON TOOTHBRUSH BATTLE ARENA (100% HANDS-FREE ARCADE)
// =========================================================================

// Battle State Variables
export const ROTATING_VILLAINS = ['sugar_bandit', 'plaque_kraken', 'cavity_knight', 'tartar_titan'];
let hasExplicitBossSelection = false;
let sessionRotatedBossId = null;
let selectedBossId = 'sugar_bandit';
let battleTimer = null;
let bombTimer = null;
let secondsRemaining = 120;
let totalDuration = 120;
let battlePhase = 'brush'; // 'floss' (2-minute preliminary flossing battle) | 'brush' (toothbrush battle)
let lastSpokenQuadId = null;
let isBattleRunning = false;
let isBattlePaused = false;
let isRhythmBeatActive = true;
let isIntroCountingDown = false;
let currentSugarHazard = null;

export function setExplicitBossSelection(val = true) {
  hasExplicitBossSelection = val;
  if (!val) sessionRotatedBossId = null;
}

// Helper to determine if current battle is a nighttime battle
export function isNighttimeBattle() {
  if (typeof store.isNighttimeToothbrushBattle === 'function') {
    return store.isNighttimeToothbrushBattle();
  }
  const hour = new Date().getHours();
  return hour >= 17 || hour < 5;
}

export function shouldRunFlossBattle() {
  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  if (!kidId) return false;
  return store.shouldShowHygieneReminder(kidId, 'floss');
}

export function shouldShowMouthwashReminder() {
  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  if (!kidId) return false;
  return store.isHygieneReminderActive(kidId, 'mouthwash');
}

// Hardware & Multi-Modal Sensors State (Single Atomic MediaStream)
let videoStream = null;
let isCameraActive = false;
let cameraError = null;
let cameraFacingMode = 'user';
let isCameraMotionDetected = false;
let motionCanvas = null;
let motionCtx = null;
let prevFrameData = null;
let motionCheckInterval = null;

// Acoustic Mic State
let micCadenceScore = 0;
let cadenceSamples = [];
let isMicActive = false;

// Deflect Flurry State
let isDeflectFlurryActive = false;
let deflectFlurryTimer = null;

// Auto-Assist Pulse State
let lastScrubTimestamp = 0;
let autoAssistInterval = null;
let isAutoAssistPulseActive = false;
let totalScrubHits = 0;
let currentCombo = 0;

// Quadrant Cleanliness Progress (0% to 100% per zone)
let quadrantCleanliness = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0
};
let lastProgressTimestamp = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0
};

// Dynamic Companion Dialogue Text
let currentRexCoachText = 'Get ready! Scrub in gentle circles on your top right teeth!';

// Helper to retrieve boss data
export function getBattleBoss(bossId) {
  const currentSelectedId = bossId || selectedBossId || (store.getSelectedBossId ? store.getSelectedBossId() : 'sugar_bandit');
  const parentBosses = store.getParentCustomBosses ? store.getParentCustomBosses() : [];
  const foundCustom = parentBosses.find(b => b.id === currentSelectedId);
  if (foundCustom) {
    return {
      ...foundCustom,
      title: foundCustom.title || foundCustom.domain || 'Custom AR Villain',
      avatar: foundCustom.emoji || foundCustom.avatar || '👾',
      color: foundCustom.color || '#0284c7',
      accentBorder: foundCustom.accentBorder || 'border-cyan-500',
      gradient: foundCustom.gradient || 'from-cyan-950 via-slate-900 to-indigo-950',
      shieldName: foundCustom.shieldName || 'Biofilm Energy Shell',
      bombName: foundCustom.attackName || (foundCustom.attackType ? foundCustom.attackType.replace('_', ' ') : 'Sugar Slime Bomb'),
      trophyRelicId: foundCustom.trophyRelicId || 'trophy_sugar_bandit',
      rewardCoins: foundCustom.rewardCoins || 60,
      rewardXP: foundCustom.rewardXP || 120,
      rewardSparks: 20,
      cleansedTitle: `Friendly Cleansed ${foundCustom.name} 🌟`,
      battleDurationSec: foundCustom.battleDurationSec || 120,
      attackType: foundCustom.attackType || 'caramel_bomb'
    };
  }
  if (currentSelectedId === 'sugar_boss') {
    const bandit = HYGIENE_BOSSES.find(b => b.id === 'sugar_bandit') || HYGIENE_BOSSES[0];
    return {
      ...bandit,
      id: 'sugar_boss',
      meshType: 'sugar_bandit',
      title: 'Sugar Fortress Night Showdown',
      name: 'The Sugar Bandit King'
    };
  }
  const preset = HYGIENE_BOSSES.find(b => b.id === currentSelectedId);
  return preset || HYGIENE_BOSSES[0];
}

// Resolve the current hero's equipped weapon and battle buff
export function getActiveCombatWeapon() {
  let weapon = null;
  if (typeof store.getEquippedHeroWeaponObject === 'function') {
    weapon = store.getEquippedHeroWeaponObject();
  } else if (typeof store.getEquippedHeroWeapon === 'function') {
    const raw = store.getEquippedHeroWeapon(true);
    if (typeof raw === 'object' && raw !== null) {
      weapon = raw;
    } else if (typeof raw === 'string') {
      weapon = (store.getState().digitalGear || []).find(g => g.id === raw) ||
               DIGITAL_REWARDS_CATALOG.find(g => g.id === raw) ||
               { id: raw, title: raw === 'laser_toothbrush' ? 'Laser Toothbrush Saber' : raw, icon: '⚔️' };
    }
  }

  const hero = store.getState().selectedHero;
  if (!weapon && hero) {
    const weaponId = hero.equippedWeapon ||
      (Array.isArray(hero.equippedGear) && hero.equippedGear.find(g =>
        g === 'laser_toothbrush' ||
        (store.getState().digitalGear || []).some(dg => dg.id === g) ||
        DIGITAL_REWARDS_CATALOG.some(c => c.id === g)
      )) ||
      (Array.isArray(hero.equippedGear) && hero.equippedGear[0]);
    if (weaponId) {
      weapon = (store.getState().digitalGear || []).find(g => g.id === weaponId) ||
               DIGITAL_REWARDS_CATALOG.find(g => g.id === weaponId) ||
               { id: weaponId, title: weaponId === 'laser_toothbrush' ? 'Laser Toothbrush Saber' : weaponId, icon: '⚔️' };
    }
  }

  if (weapon) {
    let multiplier = 1.3;
    if (weapon.id === 'laser_toothbrush' || weapon.title?.toLowerCase().includes('laser toothbrush')) {
      multiplier = 1.3;
    } else if (weapon.statBonusPercent !== undefined) {
      multiplier = 1.0 + (weapon.statBonusPercent / 100);
    } else if (typeof weapon.statBonus === 'string') {
      const match = weapon.statBonus.match(/\+(\d+)%/);
      if (match) multiplier = 1.0 + (parseInt(match[1]) / 100);
    }
    const icon = weapon.icon || (weapon.category === 'Weapons' || weapon.id?.includes('saber') || weapon.id?.includes('toothbrush') ? '⚔️' : '⚡');
    const title = weapon.title || weapon.name || 'Laser Toothbrush Saber';
    return { weapon: { ...weapon, title, icon }, multiplier, hasWeapon: true };
  }

  const inEquipped = Array.isArray(hero?.equippedGear) && hero.equippedGear.includes('laser_toothbrush');
  const inHeroInv = Array.isArray(hero?.inventory) && hero.inventory.includes('laser_toothbrush');
  if (inEquipped || inHeroInv) {
    return { weapon: { id: 'laser_toothbrush', title: 'Laser Toothbrush Saber', icon: '⚔️' }, multiplier: 1.3, hasWeapon: true };
  }
  return { weapon: null, multiplier: 1.0, hasWeapon: false };
}

// Check if current hero owns/equipped the Laser Toothbrush or combat weapon
function checkLaserToothbrushEquipped() {
  return getActiveCombatWeapon().hasWeapon;
}

// =========================================================================
// MAIN BATTLE VIEW RENDER FUNCTION: FULL-SCREEN VIBRANT 3D ARCADE VIEWPORT
// =========================================================================
export function renderBattleView() {
  const isExplicit = hasExplicitBossSelection || store.state?.hasExplicitBossSelection || store.state?.selectedBossId === 'sugar_boss';
  if (!isExplicit && !isBattleRunning && !store.getBossColosseumState()?.isVictoryModalOpen && !store.getBossColosseumState()?.isDefeatModalOpen) {
    if (!sessionRotatedBossId) {
      const randomIndex = Math.floor(Math.random() * ROTATING_VILLAINS.length);
      sessionRotatedBossId = ROTATING_VILLAINS[randomIndex];
    }
    selectedBossId = sessionRotatedBossId;
    if (store.state) store.state.selectedBossId = selectedBossId;
  } else {
    selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : (store.state?.selectedBossId || selectedBossId);
  }
  const currentBoss = getBattleBoss(selectedBossId);
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};

  // If a battle is not currently actively running and no end-of-battle modal is open, initialize phase & durations based on floss status
  if (!isBattleRunning && !colState.isVictoryModalOpen && !colState.isDefeatModalOpen) {
    if (shouldRunFlossBattle()) {
      battlePhase = 'floss';
      secondsRemaining = 120;
      totalDuration = 120;
    } else {
      battlePhase = 'brush';
      const bossDuration = store.getState().parentSettings?.arBattleDuration || currentBoss.battleDurationSec || 120;
      secondsRemaining = bossDuration;
      totalDuration = bossDuration;
    }
  }

  if (!currentSugarHazard) {
    currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
  }

  const activeCombatWeapon = getActiveCombatWeapon();
  const hasLaserSword = activeCombatWeapon.hasWeapon;
  const activePet = store.getActivePet ? store.getActivePet() : { name: 'Rex', avatar: '🦖' };

  const elapsed = totalDuration - secondsRemaining;
  const progressRatio = Math.min(1, elapsed / totalDuration);
  const hpPercent = secondsRemaining <= 0
    ? 0
    : Math.max(1, Math.min(100, Math.round(((colState.currentHp || (1 - progressRatio) * 100) / (colState.maxHp || 100)) * 100)));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  const showPip = colState.showPipCam !== false;

  // Parent Panel's per-kid, per-day Floss/Mouthwash toggles (ParentPortalView's
  // "hygiene-reminder-toggle-btn" buttons) -- shown as a persistent badge for
  // the whole battle, not just the pre/post blocking reminder screens, so the
  // kid sees what's expected of them the entire time the timer is running.
  const hygieneKid = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const hygieneKidId = hygieneKid?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  const showFlossBadge = hygieneKidId ? store.isHygieneReminderActive(hygieneKidId, 'floss') : false;
  const showMouthwashBadge = hygieneKidId ? store.isHygieneReminderActive(hygieneKidId, 'mouthwash') : false;

  // List of primary hygiene bosses for bottom villain dock
  const availableVillains = [
    { id: 'sugar_bandit', name: 'Sugar Bandit', emoji: '🍬', color: '#f59e0b' },
    { id: 'plaque_kraken', name: 'Plaque Kraken', emoji: '🐙', color: '#06b6d4' },
    { id: 'cavity_knight', name: 'Cavity Knight', emoji: '⚔️', color: '#8b5cf6' },
    { id: 'tartar_titan', name: 'Tartar Titan', emoji: '💎', color: '#0284c7' }
  ];
  const parentBosses = store.getParentCustomBosses ? store.getParentCustomBosses() : [];
  parentBosses.forEach(pb => {
    if (!availableVillains.some(v => v.id === pb.id)) {
      availableVillains.push({
        id: pb.id,
        name: pb.name,
        emoji: pb.emoji || pb.avatar || '👾',
        color: pb.color || '#0284c7'
      });
    }
  });

  return `
    <div class="relative w-full h-[calc(100vh-64px)] min-h-[540px] overflow-hidden bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#081a2e] text-white font-headline select-none">
      
      <!-- ================= 1. FULL VIEWPORT 3D WEBGL ARENA CANVAS ================= -->
      <canvas id="battle-webgl-canvas" class="absolute inset-0 w-full h-full z-0 block cursor-crosshair"></canvas>

      <!-- ================= 2A. PROMINENT CENTERED FLOATING COUNTDOWN TIMER ================= -->
      <div class="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-35 pointer-events-auto">
        <div id="battle-timer-capsule" class="bg-slate-900/95 backdrop-blur-md px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-full border-2 sm:border-3 ${battlePhase === 'floss' ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.65)]' : 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.65)]'} flex items-center gap-1.5 sm:gap-2">
          <span class="material-symbols-outlined ${battlePhase === 'floss' ? 'text-emerald-400' : 'text-amber-400'} text-lg sm:text-2xl animate-pulse">timer</span>
          <span id="battle-timer-display" class="font-headline text-xl sm:text-3xl font-black ${battlePhase === 'floss' ? 'text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.9)]' : 'text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]'} tracking-wider">
            ${timeStr}
          </span>
        </div>
      </div>

      <!-- ================= 2B. TOP FLANKING HUD BAR (MAP QUIT, BOSS HP & CONTROLS) ================= -->
      <div class="absolute top-2 sm:top-3 left-2 right-2 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
        
        <!-- Left: Kid-friendly Map Exit Button & Boss Health Status -->
        <div class="pointer-events-auto flex items-center gap-1.5 sm:gap-2 min-w-0 max-w-[44%] sm:max-w-[40%]">
          <button id="battle-quit-btn" class="bg-gradient-to-b from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl border-2 sm:border-3 border-amber-200 shadow-[0_3px_0_0_#b45309] flex items-center gap-1 active:translate-y-0.5 active:shadow-none transition-all flex-shrink-0 cursor-pointer" title="Return to Map">
            <span class="material-symbols-outlined text-base sm:text-lg font-black">arrow_back</span>
            <span class="hidden xs:inline">Map</span>
          </button>

          <!-- Boss Avatar & Health Heart Bar (or Floss Progress) -->
          <div class="bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-2xl border-2 border-slate-700/80 flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 shadow">
            ${battlePhase === 'floss' ? `
              <span class="text-xl sm:text-2xl filter drop-shadow flex-shrink-0">🧵</span>
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-[9px] sm:text-[10px] font-black text-emerald-300 uppercase truncate">FLOSS BATTLE</span>
                <div class="w-full bg-slate-950 h-2 sm:h-2.5 rounded-full overflow-hidden border border-emerald-400/40 p-0.5 mt-0.5">
                  <div id="floss-progress-bar" class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]" style="width: ${Math.round(((120 - secondsRemaining) / 120) * 100)}%;"></div>
                </div>
              </div>
            ` : `
              <span class="text-xl sm:text-2xl filter drop-shadow flex-shrink-0">
                ${currentBoss.emoji || currentBoss.avatar || '🍬'}
              </span>
              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center justify-between text-[9px] sm:text-[10px] font-black text-amber-300 uppercase truncate">
                  <span class="truncate">${currentBoss.name}</span>
                  <span class="text-[8px] sm:text-[9px] text-rose-300 font-bold ml-1">${hpPercent}%</span>
                </div>
                <div class="w-full bg-slate-950 h-2 sm:h-2.5 rounded-full overflow-hidden border border-white/20 p-0.5 mt-0.5 shadow-inner">
                  <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]" style="width: ${hpPercent}%;"></div>
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- Right: Active Hazard Badge & Controls -->
        <div class="pointer-events-auto flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          ${currentSugarHazard ? `
            <span id="sugar-hazard-badge" class="hidden md:flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-amber-200 bg-amber-950/85 border border-amber-400/60 px-2 sm:px-2.5 py-1 rounded-full shadow backdrop-blur-sm animate-pulse flex-shrink-0">
              <span>${currentSugarHazard.emoji}</span>
              <span class="hidden lg:inline">Hazard:</span>
              <span>${currentSugarHazard.name}</span>
            </span>
          ` : ''}
          <button id="rhythm-toggle-btn" class="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-900/90 border-2 border-slate-700 text-cyan-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 shadow cursor-pointer" title="Toggle Rhythm">
            <span class="material-symbols-outlined text-base sm:text-lg">${isRhythmBeatActive ? 'music_note' : 'music_off'}</span>
          </button>
          <button id="camera-flip-btn" class="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-900/90 border-2 border-slate-700 text-amber-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 shadow cursor-pointer" title="Flip Camera">
            <span class="material-symbols-outlined text-base sm:text-lg">cameraswitch</span>
          </button>
        </div>

      </div>

      <!-- ================= 3. FLOATING MAGIC MIRROR PORTAL (TOP-LEFT) ================= -->
      <div id="pip-window" class="absolute top-16 sm:top-20 left-3 sm:left-6 z-20 flex flex-col items-center pointer-events-none transition-all duration-300 ${showPip ? '' : 'hidden'}">
        <div class="w-24 h-28 sm:w-28 sm:h-32 bg-slate-950/90 border-3 border-amber-400 rounded-3xl p-1 shadow-[0_0_20px_rgba(251,191,36,0.5)] relative flex flex-col overflow-hidden">
          <div class="absolute top-1.5 left-2 flex items-center gap-1 z-10">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="text-[8px] sm:text-[9px] font-black text-amber-300 tracking-tighter uppercase">MAGIC MIRROR ⭐</span>
          </div>
          <div class="w-full h-full bg-slate-900 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
            <video id="ar-camera-feed" class="w-full h-full object-cover transform -scale-x-100 ${isCameraActive ? '' : 'hidden'}" autoplay playsinline muted></video>
            <div id="pip-placeholder" class="absolute inset-0 flex flex-col items-center justify-center ${isCameraActive ? 'hidden' : ''}">
              <span class="text-3xl">🧑‍🚀</span>
              <span class="text-[8px] font-bold text-cyan-300 mt-1">HERO CAM 🪥</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 4. ACTIVE ZONE PROMPT / FLOSS BATTLE BANNER ================= -->
      ${battlePhase === 'floss' ? `
        <div id="floss-banner-container" class="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <div id="floss-active-banner" class="bg-slate-900/95 border-2 border-emerald-400 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2 animate-pulse">
            <span class="text-base">🧵</span>
            <span class="text-xs font-black text-emerald-300 uppercase tracking-wide">FLOSS BATTLE:</span>
            <span id="current-zone-status-text" class="text-xs font-black text-white">Clean between your teeth!</span>
          </div>
          <button id="battle-done-floss-btn" class="pointer-events-auto bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 text-slate-950 font-headline font-black text-xs px-4 py-1.5 rounded-full shadow-lg border-2 border-white/40 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-sm font-black">check_circle</span> Done Flossing! 🪥
          </button>
        </div>
      ` : `
        <div id="active-zone-banner" class="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/95 border-2 border-cyan-400 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 pointer-events-none animate-pulse">
          <span class="text-base">🪥</span>
          <span class="text-xs font-black text-cyan-300 uppercase tracking-wide">BRUSHING ZONE:</span>
          <span id="current-zone-status-text" class="text-xs font-black text-white">${activeQuad.name}</span>
          <span id="current-zone-badge" class="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">${activeQuad.zone}/5</span>
        </div>

        <!-- Parent-Set Floss / Mouthwash Reminder Badges -->
        ${(showFlossBadge || showMouthwashBadge) ? `
          <div id="hygiene-reminder-hud-badges" class="absolute top-28 sm:top-32 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-1.5 pointer-events-none">
            ${showFlossBadge ? `
              <span id="floss-reminder-hud-badge" class="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-emerald-300 bg-emerald-950/80 border border-emerald-400/60 px-2 py-0.5 rounded-full shadow backdrop-blur-sm">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">health_and_safety</span>
                Floss Time! 🦷
              </span>
            ` : ''}
            ${showMouthwashBadge ? `
              <span id="mouthwash-reminder-hud-badge" class="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-secondary bg-secondary/15 border border-secondary/50 px-2 py-0.5 rounded-full shadow backdrop-blur-sm">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">water_drop</span>
                Rinse with Mouthwash after!
              </span>
            ` : ''}
          </div>
        ` : ''}
      `}

      <!-- ================= 6. DEFLECT FLURRY & SPOKEN /LEARN NOTIFICATION BANNERS ================= -->
      <div id="deflect-flurry-banner" class="absolute top-36 sm:top-40 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 opacity-0 scale-90">
        <div class="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-headline font-black text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.95)] border-3 border-white animate-bounce flex items-center gap-2.5">
          <span id="deflect-hazard-emoji" class="text-xl">${currentSugarHazard?.emoji || '🍬'}</span>
          <span id="deflect-hazard-text">${currentSugarHazard ? `${currentSugarHazard.name.toUpperCase()} INCOMING! DEFLECT!` : 'SUGAR HAZARD! SCRUB TO DEFLECT!'}</span>
          <span class="text-xl">🛡️</span>
        </div>
      </div>


      <!-- Comic Deflect Hit Popup -->
      <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
        <span class="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-slate-950 font-headline text-base sm:text-lg font-black px-6 py-2.5 rounded-full shadow-2xl border-3 border-white scale-125">
          DEFLECTED! 🛡️✨
        </span>
      </div>



      <!-- ================= 8. IN-GAME 3D VILLAIN SWITCHER DOCK (BOTTOM-CENTER) ================= -->
      <div class="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-3xl border-2 border-white/20 shadow-2xl">
        <span class="text-[9px] font-black text-slate-400 uppercase tracking-tight hidden sm:inline mr-1">Villain:</span>
        ${availableVillains.map(v => {
          const isSelected = v.id === selectedBossId;
          return `
            <button data-villain-id="${v.id}" class="villain-switch-btn flex items-center gap-1 px-2.5 py-1 rounded-2xl text-xs font-black transition-all ${isSelected ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-[0_2px_0_0_#b45309] scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
              <span>${v.emoji}</span>
              <span class="hidden xs:inline text-[10px]">${v.name}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- ================= 9. COUNTDOWN INTRO OVERLAY ("3... 2... 1... BRUSH!") ================= -->
      <div id="battle-intro-countdown" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none transition-opacity duration-500 opacity-0 hidden">
        <div id="intro-countdown-text" class="text-7xl sm:text-9xl font-black text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.95)] animate-bounce">
          3
        </div>
      </div>

      <!-- ================= 10. CELEBRATORY VICTORY MODAL ================= -->
      ${renderVictoryModal(colState, currentBoss)}

      <!-- ================= 11. REWARD-FREE DEFEAT MODAL (QUIT BEFORE TIMER ENDS) ================= -->
      ${renderDefeatModal(colState)}

    </div>
  `;
}

function renderVictoryModal(colState, currentBoss) {
  if (!colState.isVictoryModalOpen) return '';

  const reward = colState.victoryReward || {
    bossName: currentBoss.name,
    cleansedTitle: currentBoss.cleansedTitle || 'Minty Friend 🍬',
    trophyId: currentBoss.trophyRelicId || 'trophy_sugar_bandit',
    coins: currentBoss.rewardCoins || 50,
    xp: currentBoss.rewardXP || 75,
    sparks: currentBoss.rewardSparks || 15
  };

  const trophyTitle = reward.trophyId === 'trophy_sugar_bandit'
    ? "Sugar Bandit's Golden Candy Crown"
    : reward.trophyId === 'trophy_plaque_kraken'
      ? "Plaque Kraken's Pearly Goblet"
      : "Shiny Hero Trophy";
  const hygieneKid = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const hygieneKidId = hygieneKid?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  const showMouthwashInModal = hygieneKidId && store.isHygieneReminderActive(hygieneKidId, 'mouthwash');
  const isMouthwashAcknowledged = hygieneKidId ? store.hasAcknowledgedHygieneReminderToday(hygieneKidId, 'mouthwash') : false;

  return `
    <div id="colosseum-victory-modal" class="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-sm bg-[#0b1320] border-4 border-emerald-400 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">
        
        <!-- Transformed Cleansed Boss Hero Avatar with Animated Rainbow Aura -->
        <div class="relative mb-3 flex items-center justify-center">
          <div class="absolute -inset-3 rounded-full bg-gradient-to-r from-pink-500 via-amber-400 via-emerald-400 via-cyan-400 to-purple-500 blur-md opacity-85 animate-pulse"></div>
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-emerald-400 bg-slate-900/90 overflow-hidden shadow-[0_0_35px_rgba(52,211,153,0.8)] flex items-center justify-center">
            ${currentBoss.cleansedImage
              ? `<img src="${currentBoss.cleansedImage}" alt="${reward.cleansedTitle}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-5xl\\'>${currentBoss.cleansedAvatar || currentBoss.avatar || '✨'}</span>';" />`
              : `<span class="text-5xl animate-bounce">${currentBoss.cleansedAvatar || currentBoss.avatar || '✨'}</span>`
            }
          </div>
          <div class="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 rounded-full p-1 border-2 border-white text-xs font-black shadow flex items-center justify-center">
            ✨
          </div>
        </div>

        <h2 class="font-headline font-black text-xl sm:text-2xl text-emerald-400 tracking-tight uppercase">
          VILLAIN CLEANSED! 🎉
        </h2>
        <p class="font-headline font-bold text-xs text-slate-300 mt-1">
          ${reward.bossName} transformed into ${reward.cleansedTitle}!
        </p>

        <div class="w-full bg-slate-950/90 rounded-2xl p-3 border-2 border-amber-400/50 flex flex-col items-center gap-1 my-3 shadow-inner">
          <span class="text-[9px] font-black uppercase text-amber-400 tracking-wider">🌟 UNLOCKED 3D HQ TROPHY RELIC</span>
          <span class="font-headline font-black text-xs sm:text-sm text-white">${trophyTitle}</span>
          <span class="text-[10px] text-slate-400">Permanently spotlighted in your Hero HQ hideout!</span>
        </div>

        <div class="w-full bg-slate-950/90 rounded-2xl p-2.5 border-2 border-slate-800 flex items-center justify-around mb-3 shadow-inner">
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">COINS 🪙</span>
            <span class="font-headline font-black text-base text-amber-400">+${reward.coins}</span>
          </div>
          <div class="h-6 w-0.5 bg-slate-800"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">XP ⭐</span>
            <span class="font-headline font-black text-base text-cyan-400">+${reward.xp}</span>
          </div>
          <div class="h-6 w-0.5 bg-slate-800"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">SPARKS ⚡</span>
            <span class="font-headline font-black text-base text-emerald-400">+${reward.sparks}</span>
          </div>
        </div>

        ${showMouthwashInModal ? `
          <div id="mouthwash-victory-card" class="w-full bg-secondary/15 rounded-2xl p-3 border-2 border-secondary/50 flex flex-col items-center gap-1.5 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.25)] animate-pulse">
            <div class="flex items-center gap-1.5 text-secondary font-headline font-black text-xs uppercase tracking-wider">
              <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">water_drop</span>
              DON'T FORGET TO WASHWASH LITTLE HERO! 💧🦖
            </div>
            <p class="text-[11px] font-bold text-slate-200">
              Swish your mouthwash for a fresh, sparkling clean smile!
            </p>
            <button id="mouthwash-modal-ack-btn" class="mt-1 px-4 py-1.5 rounded-xl ${isMouthwashAcknowledged ? 'bg-emerald-600 text-white cursor-default' : 'bg-secondary text-on-secondary cursor-pointer hover:brightness-110 active:scale-95'} font-headline font-black text-xs transition-all flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">check_circle</span> ${isMouthwashAcknowledged ? 'Rinsed ✓' : 'I Rinsed! 💧✨'}
            </button>
          </div>
        ` : ''}

        <div class="w-full flex flex-col gap-2">
          <button id="colosseum-visit-hq-btn" class="w-full py-3 min-h-[48px] rounded-2xl bg-emerald-500 text-slate-950 font-headline font-black text-sm uppercase tracking-wider shadow-[0_6px_0_0_#047857] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-lg font-bold">apartment</span> VIEW TROPHY IN HERO HQ
          </button>

          ${store.state?.previousView === 'bedtime_story' ? `
            <button id="colosseum-return-bedtime-btn" class="w-full py-3 min-h-[44px] rounded-2xl bg-gradient-to-r from-[#00d2d3] to-[#0284c7] text-[#050f18] font-headline font-black text-xs uppercase tracking-wider shadow-[0_4px_0_0_#05253b] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              <span class="material-symbols-outlined text-base">auto_stories</span> CONTINUE BEDTIME ROUTINE (STEP 2)
            </button>
          ` : store.state?.previousView === 'quest_map' ? `
            <button id="colosseum-return-map-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-amber-400 border border-amber-400/40 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
              <span class="material-symbols-outlined text-base">explore</span> RETURN TO WORLD MAP (QUEST 7)
            </button>
          ` : ''}
          
          <button id="colosseum-play-again-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-cyan-400 border-2 border-slate-700 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
            <span class="material-symbols-outlined text-base">replay</span> BATTLE AGAIN
          </button>
        </div>

      </div>
    </div>
  `;
}

// Reward-free modal shown when a kid quits/backs out of a battle before the
// timer finishes. Deliberately has no coins/xp/sparks/trophy row and never
// touches the task/approval system -- finishing the full brush routine is
// what earns those, matching the existing incentive messaging. Mirrors
// renderVictoryModal()'s card shell so the two feel like one cohesive flow.
function renderDefeatModal(colState) {
  if (!colState.isDefeatModalOpen) return '';

  const info = colState.defeatInfo || { bossName: 'The Hygiene Boss', bossAvatar: '🍬' };

  return `
    <div id="colosseum-defeat-modal" class="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-sm bg-[#1a1207] border-4 border-amber-500 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">

        <div class="relative mb-3 flex items-center justify-center">
          <div class="absolute -inset-3 rounded-full bg-amber-500/30 blur-md"></div>
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-amber-500 bg-slate-900/90 overflow-hidden shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center justify-center">
            <img src="${sugarVillainEscapedImg}" alt="${info.bossName} escaped" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-5xl\\'>${info.bossAvatar}</span>';" />
          </div>
        </div>

        <h2 class="font-headline font-black text-xl sm:text-2xl text-amber-400 tracking-tight uppercase">
          ${info.bossName} Escaped!
        </h2>
        <p class="font-headline font-bold text-xs text-slate-300 mt-1 mb-4">
          Brush for the full routine next time to cleanse the villain, earn your sparks, and unlock your 3D HQ trophy!
        </p>

        <div class="w-full flex flex-col gap-2">
          <button id="colosseum-defeat-return-btn" class="w-full py-3 min-h-[48px] rounded-2xl bg-amber-500 text-slate-950 font-headline font-black text-sm uppercase tracking-wider shadow-[0_6px_0_0_#b45309] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-lg font-bold">apartment</span> RETURN TO HERO HQ
          </button>

          <button id="colosseum-defeat-retry-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-cyan-400 border-2 border-slate-700 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-base">replay</span> BATTLE AGAIN
          </button>
        </div>

      </div>
    </div>
  `;
}

// =========================================================================
// HARDWARE SENSORS (CAMERA + MIC FUSION)
// =========================================================================
async function initSensors() {
  if (typeof document === 'undefined') return;
  const video = document.getElementById('ar-camera-feed');
  const pipPlaceholder = document.getElementById('pip-placeholder');

  if (videoStream && videoStream.active) {
    if (video) {
      video.srcObject = videoStream;
      video.play().catch(() => {});
    }
    hanaBattle3DService.setVideoElement(video);
    isCameraActive = true;
    if (pipPlaceholder) pipPlaceholder.classList.add('hidden');
    startOpticalMotionTracker();
    brushAudioAnalyzer.startListening(handleCadenceUpdate, videoStream);
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: cameraFacingMode },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      videoStream = stream;
      isCameraActive = true;
      cameraError = null;

      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      hanaBattle3DService.setVideoElement(video);
      if (pipPlaceholder) pipPlaceholder.classList.add('hidden');
      startOpticalMotionTracker();
      brushAudioAnalyzer.startListening(handleCadenceUpdate, stream);
    } catch (err) {
      console.warn('Atomic camera + mic failed, attempting audio fallback:', err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        videoStream = audioStream;
        brushAudioAnalyzer.startListening(handleCadenceUpdate, audioStream);
      } catch (e) {
        console.warn('Microphone also restricted; using optical/auto-assist fallback.');
      }
      isCameraActive = false;
      cameraError = err;
      if (pipPlaceholder) pipPlaceholder.classList.remove('hidden');
    }
  }
}

function handleCadenceUpdate({ isScrubbing, cadenceScore }) {
  if (isBattlePaused || !isBattleRunning) return;
  const combatWeapon = getActiveCombatWeapon();
  const boostedCadence = Math.min(100, Math.round(cadenceScore * (combatWeapon.multiplier || 1.0)));
  micCadenceScore = boostedCadence;
  cadenceSamples.push(boostedCadence);
  isMicActive = isScrubbing;

  if (isScrubbing) {
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
    handleScrubHit(activeQuad, 'acoustic');

    if (isDeflectFlurryActive && boostedCadence >= 45) {
      triggerDeflectSuccess();
    }
  }
}

function flipCamera() {
  cameraFacingMode = (cameraFacingMode === 'user') ? 'environment' : 'user';
  stopSensors();
  initSensors();
}

function stopSensors() {
  brushAudioAnalyzer.stopListening();
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
  isCameraActive = false;
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  isCameraMotionDetected = false;
  prevFrameData = null;
}

function startOpticalMotionTracker() {
  if (motionCheckInterval) clearInterval(motionCheckInterval);

  if (!motionCanvas) {
    motionCanvas = document.createElement('canvas');
    motionCanvas.width = 64;
    motionCanvas.height = 48;
    motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
  }

  prevFrameData = null;

  motionCheckInterval = setInterval(() => {
    if (!isBattleRunning || isBattlePaused) return;

    const video = document.getElementById('ar-camera-feed');
    if (video && video.readyState >= 2 && !video.paused && motionCtx) {
      motionCtx.save();
      motionCtx.translate(64, 0);
      motionCtx.scale(-1, 1);
      motionCtx.drawImage(video, 0, 0, 64, 48);
      motionCtx.restore();

      const currentFrame = motionCtx.getImageData(0, 0, 64, 48);
      const data = currentFrame.data;

      if (prevFrameData) {
        let diffPixels = 0;
        const totalSampled = data.length / 4;
        for (let i = 0; i < data.length; i += 8) {
          const rDiff = Math.abs(data[i] - prevFrameData[i]);
          const gDiff = Math.abs(data[i + 1] - prevFrameData[i + 1]);
          const bDiff = Math.abs(data[i + 2] - prevFrameData[i + 2]);
          const avgDiff = (rDiff + gDiff + bDiff) / 3;
          if (avgDiff > 25) diffPixels += 2;
        }

        const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
        const roi = activeQuad.roi || { minX: 8, maxX: 56, minY: 12, maxY: 44 };

        let roiDiffPixels = 0;
        let roiSampled = 0;
        const motionRatio = diffPixels / totalSampled;

        for (let y = roi.minY; y < roi.maxY; y += 2) {
          for (let x = roi.minX; x < roi.maxX; x += 2) {
            const idx = (y * 64 + x) * 4;
            const rDiff = Math.abs(data[idx] - prevFrameData[idx]);
            const gDiff = Math.abs(data[idx + 1] - prevFrameData[idx + 1]);
            const bDiff = Math.abs(data[idx + 2] - prevFrameData[idx + 2]);
            if ((rDiff + gDiff + bDiff) / 3 > 25) roiDiffPixels++;
            roiSampled++;
          }
        }
        const roiRatio = roiSampled > 0 ? (roiDiffPixels / roiSampled) : 0;
        const hasMotion = motionRatio > 0.08 || roiRatio > 0.09;

        if (hasMotion) {
          isCameraMotionDetected = true;
          handleScrubHit(activeQuad, 'optical');

          if (isDeflectFlurryActive && (motionRatio >= 0.16 || roiRatio >= 0.16)) {
            triggerDeflectSuccess();
          }
        } else {
          isCameraMotionDetected = false;
        }
      }
      prevFrameData = data;
    }
  }, 100);
}

// =========================================================================
// DEFLECT FLURRY & SPOKEN /LEARN MICRO-CHALLENGE
// =========================================================================
function triggerDeflectFlurry() {
  if (isDeflectFlurryActive || !isBattleRunning || isBattlePaused) return;
  isDeflectFlurryActive = true;

  if (!currentSugarHazard) {
    currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
    hanaBattle3DService.setHazard(currentSugarHazard);
  }

  // One hazard bomb per flurry -- a trailing second bomb 450ms later made
  // every attack a rapid-fire double-hit, which read as overly fast pacing.
  hanaBattle3DService.spawnCaramelBomb(currentSugarHazard);

  const banner = document.getElementById('deflect-flurry-banner');
  if (banner) {
    const emojiEl = document.getElementById('deflect-hazard-emoji');
    const textEl = document.getElementById('deflect-hazard-text');
    if (emojiEl) emojiEl.textContent = currentSugarHazard.emoji;
    if (textEl) textEl.textContent = `${currentSugarHazard.name.toUpperCase()} INCOMING! DEFLECT!`;
    banner.classList.remove('opacity-0', 'scale-90');
    banner.classList.add('opacity-100', 'scale-100');
  }

  currentRexCoachText = currentSugarHazard.rexWarning || 'Sugar Hazard incoming! Scrub faster to raise your enamel shield!';
  updateRexDialogue();
  voicePrompts.speak(currentRexCoachText, null, null, { instant: true });

  if (deflectFlurryTimer) clearTimeout(deflectFlurryTimer);
  deflectFlurryTimer = setTimeout(() => {
    isDeflectFlurryActive = false;
    hideDeflectBanner();
    hanaBattle3DService.setDeflectActive(false);
  }, 2800);
}

function triggerDeflectSuccess() {
  if (!isDeflectFlurryActive) return;
  isDeflectFlurryActive = false;
  if (deflectFlurryTimer) clearTimeout(deflectFlurryTimer);
  hideDeflectBanner();

  const boss = getBattleBoss(selectedBossId);
  hanaBattle3DService.onDeflectRicochet();
  store.triggerColosseumDeflect();

  const hazardName = currentSugarHazard ? currentSugarHazard.shortName.toUpperCase() : 'SUGAR';
  showComicHit(`${hazardName} DEFLECTED! 🛡️✨`);
  if (typeof Sound?.fanfare === 'function') Sound.fanfare();
  currentRexCoachText = "ENAMEL POWER SURGE! You broke the sweet treat barrier!";
  updateRexDialogue();
  voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
  syncCockpitHUD();
}

function hideDeflectBanner() {
  const banner = document.getElementById('deflect-flurry-banner');
  if (banner) {
    banner.classList.remove('opacity-100', 'scale-100');
    banner.classList.add('opacity-0', 'scale-90');
  }
}

// =========================================================================
// BATTLE LIFECYCLE CONTROLLERS
// =========================================================================

export function advanceToBrushPhase() {
  battlePhase = 'brush';
  const currentBoss = getBattleBoss(selectedBossId);
  const bossDuration = store.getState().parentSettings?.arBattleDuration || currentBoss.battleDurationSec || 120;
  secondsRemaining = bossDuration;
  totalDuration = bossDuration;
  lastSpokenQuadId = null;

  if (!currentSugarHazard) {
    currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
  }
  hanaBattle3DService.setHazard(currentSugarHazard);

  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  if (kidId) {
    store.acknowledgeHygieneReminder(kidId, 'floss');
  }

  store.updateColosseumTimer(secondsRemaining, totalDuration);

  Sound.fanfare();
  voicePrompts.speak("Flossing complete! Now 3, 2, 1, BRUSH!", null, null, { instant: true });
  playIntroCountdown();

  // Switch HUD from floss to brush
  const flossContainer = document.getElementById('floss-banner-container');
  if (flossContainer) {
    flossContainer.remove();
  }
  const zoneBanner = document.getElementById('active-zone-banner');
  if (zoneBanner) {
    zoneBanner.classList.remove('hidden');
  }

  // Update initial quadrant coaching
  const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  currentRexCoachText = initialQuad.coachMessage || 'Get ready! Scrub in gentle circles on your top right teeth!';
  lastSpokenQuadId = initialQuad.id;
  updateRexDialogue();

  syncCockpitHUD();
}

export function startBattle() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (bombTimer) {
    clearInterval(bombTimer);
    bombTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  if (autoAssistInterval) {
    clearInterval(autoAssistInterval);
    autoAssistInterval = null;
  }
  isBattleRunning = true;
  isBattlePaused = false;

  const isExplicit = hasExplicitBossSelection || store.state?.hasExplicitBossSelection || store.state?.selectedBossId === 'sugar_boss';
  if (!isExplicit) {
    if (!sessionRotatedBossId) {
      const randomIndex = Math.floor(Math.random() * ROTATING_VILLAINS.length);
      sessionRotatedBossId = ROTATING_VILLAINS[randomIndex];
    }
    selectedBossId = sessionRotatedBossId;
    if (store.state) store.state.selectedBossId = selectedBossId;
  } else {
    selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : (store.state?.selectedBossId || selectedBossId);
  }
  const currentBoss = getBattleBoss(selectedBossId);
  hanaBattle3DService.setBoss(currentBoss);
  syncCockpitHUD();
  
  // Draw this battle's sugar hazard from the kid's weekly rotation (cycles
  // through all 7 before any repeat) instead of a flat random pick.
  currentSugarHazard = getSugarHazardById(store.drawNextSugarHazardId(getActiveHeroId()));
  hanaBattle3DService.setHazard(currentSugarHazard);

  const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const battleCfg = BATTLE_DIFFICULTY[getDifficultyTier(hero)];
  // The Parent Panel's "Toothbrush AR Battle Duration Slider" is the single
  // source of truth for every kid's timer, so it always wins over a
  // boss-specific default.
  const bossDuration = store.getState().parentSettings?.arBattleDuration || currentBoss.battleDurationSec || 120;
  
  const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  const needsFloss = kidId && store.shouldShowHygieneReminder(kidId, 'floss');

  if (needsFloss) {
    battlePhase = 'floss';
    secondsRemaining = 120; // 2-minute preliminary flossing battle
    totalDuration = 120;
  } else {
    battlePhase = 'brush';
    secondsRemaining = bossDuration;
    totalDuration = bossDuration;
  }

  totalScrubHits = 0;
  currentCombo = 0;
  cadenceSamples = [];
  lastScrubTimestamp = Date.now();
  lastSpokenQuadId = null;

  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  lastProgressTimestamp = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };

  store.initColosseumBattle(selectedBossId, totalDuration, true);

  Sound.startBattleRhythm();
  initSensors();

  if (battlePhase === 'floss') {
    currentRexCoachText = "Time to floss, Little Hero! Clean between those teeth so the sugar villains have nowhere to hide!";
    voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
    updateRexDialogue();
  } else {
    // Trigger quick "3, 2, 1, BRUSH!" visual intro overlay
    playIntroCountdown();
    const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
    currentRexCoachText = initialQuad.coachMessage || 'Get ready! Scrub in gentle circles on your top right teeth!';
    lastSpokenQuadId = initialQuad.id;
  }

  // Auto-Assist Fallback Pulse
  if (autoAssistInterval) clearInterval(autoAssistInterval);
  autoAssistInterval = setInterval(() => {
    if (!isBattleRunning || isBattlePaused) return;
    const now = Date.now();
    if (now - lastScrubTimestamp > battleCfg.autoAssistIdleMs) {
      isAutoAssistPulseActive = true;
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleScrubHit(activeQuad, 'assist');
      setTimeout(() => { isAutoAssistPulseActive = false; }, 400);
    }
  }, 1000);

  // Periodic Caramel Bomb Attack Timer (active during brush phase)
  if (bombTimer) clearInterval(bombTimer);
  bombTimer = setInterval(() => {
    if (isBattleRunning && !isBattlePaused && battlePhase === 'brush' && secondsRemaining > 10) {
      triggerDeflectFlurry();
    }
  }, battleCfg.bombIntervalMs);

  // 1 Hz Countdown Battle Loop
  if (battleTimer) clearInterval(battleTimer);
  battleTimer = setInterval(() => {
    if (isBattlePaused) return;

    if (battlePhase === 'floss') {
      secondsRemaining--;
      store.updateColosseumTimer(secondsRemaining, totalDuration);

      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      const timerDisplay = typeof document !== 'undefined' ? document.getElementById('battle-timer-display') : null;
      if (timerDisplay) timerDisplay.textContent = timeStr;

      const flossBar = typeof document !== 'undefined' ? document.getElementById('floss-progress-bar') : null;
      if (flossBar) {
        flossBar.style.width = `${Math.round(((120 - secondsRemaining) / 120) * 100)}%`;
      }

      if (secondsRemaining === 60) {
        currentRexCoachText = "Halfway through flossing! Make sure to get those back molars!";
        voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
        updateRexDialogue();
      }

      if (secondsRemaining <= 0) {
        advanceToBrushPhase();
      }
      return;
    }

    // Phase 2: Toothbrush Countdown Loop
    secondsRemaining--;

    store.updateColosseumTimer(secondsRemaining, totalDuration);

    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = typeof document !== 'undefined' ? document.getElementById('battle-timer-display') : null;
    if (timerDisplay) timerDisplay.textContent = timeStr;

    syncCockpitHUD();

    // Spoken Halfway Encouragement
    if (secondsRemaining === Math.floor(totalDuration / 2)) {
      voicePrompts.speak("Halfway there Little Hero! Keep up the awesome brushing!", null, null, { instant: true });
    }

    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

    const zoneStatusText = document.getElementById('current-zone-status-text');
    if (zoneStatusText) {
      zoneStatusText.textContent = `${activeQuad.name} (${activeQuad.zone}/5)`;
    }

    // Dynamic Quadrant Spoken Alignment on transition (5 equal zones)
    if (activeQuad.id !== lastSpokenQuadId) {
      lastSpokenQuadId = activeQuad.id;
      currentRexCoachText = activeQuad.coachMessage || `Brush your ${activeQuad.name}!`;
      voicePrompts.speak(currentRexCoachText, null, null, { instant: true });
      updateRexDialogue();
    }

    updatePipCanvas();

    if (secondsRemaining <= 0) {
      concludeVictory();
    }
  }, 1000);
}

function playIntroCountdown() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('battle-intro-countdown');
  const countText = document.getElementById('intro-countdown-text');
  if (!overlay || !countText) return;

  overlay.classList.remove('hidden', 'opacity-0');
  overlay.classList.add('opacity-100');

  let count = 3;
  countText.textContent = '3';
  if (typeof Sound?.tap === 'function') Sound.tap();

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countText.textContent = String(count);
      if (typeof Sound?.tap === 'function') Sound.tap();
    } else if (count === 0) {
      countText.textContent = 'BRUSH! 🪥';
      if (typeof Sound?.fanfare === 'function') Sound.fanfare();
    } else {
      clearInterval(countInterval);
      overlay.classList.add('opacity-0');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 500);
    }
  }, 750);
}

function updateRexDialogue() {
  if (typeof document === 'undefined') return;
  const bubble = document.getElementById('rex-dialogue-bubble');
  if (bubble) bubble.textContent = currentRexCoachText;
}

function updatePipCanvas() {
  const video = document.getElementById('ar-camera-feed');
  const canvas = document.getElementById('pip-mirror-canvas');
  if (video && canvas && video.readyState >= 2 && !video.paused) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = canvas.clientWidth || 96;
      canvas.height = canvas.clientHeight || 112;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  }
}

// Scrub Hit Handler: Updates cleanliness, triggers 3D foam streams, checks armor fractures
function handleScrubHit(activeQuad, source = 'manual') {
  if (isBattlePaused || !isBattleRunning) return;

  totalScrubHits++;
  lastScrubTimestamp = Date.now();
  currentCombo = Math.min(50, currentCombo + 1);

  const combatWeapon = getActiveCombatWeapon();
  const hasLaser = combatWeapon.hasWeapon;
  const scrubMultiplier = combatWeapon.multiplier;

  const hero = store.getState().selectedHero;
  const activePet = store.getActivePet ? store.getActivePet() : null;
  const petId = activePet?.id || hero?.activePetId || 1;
  const petBuffs = store.getActivePetGearBuffs ? store.getActivePetGearBuffs(petId) : { damage_boost: 0, defense_boost: 0 };
  const damageBoost = petBuffs.damage_boost || 0;

  const zoneId = activeQuad.id;
  if (quadrantCleanliness[zoneId] !== undefined) {
    const prevClean = quadrantCleanliness[zoneId];
    if (source === 'manual') {
      quadrantCleanliness[zoneId] = Math.min(100, quadrantCleanliness[zoneId] + Math.round(4 * scrubMultiplier));
    } else {
      const now = Date.now();
      const lastT = lastProgressTimestamp[zoneId] || (now - 80);
      const dtSec = Math.min(0.25, Math.max(0.04, (now - lastT) / 1000));
      lastProgressTimestamp[zoneId] = now;
      const ratePerSec = (100 / 24) * scrubMultiplier;
      const inc = ratePerSec * dtSec;
      quadrantCleanliness[zoneId] = Math.min(100, Math.round((quadrantCleanliness[zoneId] + inc) * 10) / 10);
    }
    
    // When zone hits 100% clean: trigger 3D candy armor deconstruction!
    if (prevClean < 100 && quadrantCleanliness[zoneId] >= 100) {
      if (typeof Sound?.sparkle === 'function') Sound.sparkle();
      else if (typeof Sound?.fanfare === 'function') Sound.fanfare();
      showComicHit(`${activeQuad.name.toUpperCase()} 100% CLEAN! ✨`);
      hanaBattle3DService.onArmorFracture(zoneId);
    }
  }

  // Fire 3D foam / laser beam in WebGL scene
  const intensity = Math.min(2.0, (micCadenceScore / 50) || 1.0);
  hanaBattle3DService.onFoamStream(intensity, hasLaser, damageBoost);

  // Sync state with 3D engine
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
  hanaBattle3DService.updateState({
    bossHp: colState.currentHp,
    maxHp: colState.maxHp,
    shieldActive: colState.isShieldActive,
    activeQuadrant: activeQuad.id,
    hasLaser: hasLaser,
    combatWeapon: combatWeapon,
    cadenceScore: micCadenceScore,
    combo: currentCombo,
    isScrubbing: true,
    quadrantCleanliness: quadrantCleanliness
  });

  if (currentCombo > 0 && currentCombo % 5 === 0) {
    hanaBattle3DService.triggerWarriorCounterAttack(currentCombo);
  }

  if (source === 'manual') {
    const weaponTitle = combatWeapon.weapon?.title || 'Weapon';
    showComicHit(hasLaser ? `${weaponTitle.toUpperCase()} BLAST! ⚡` : 'MINTY BLAST! 🫧');
  }

  syncCockpitHUD();
}

function syncCockpitHUD() {
  if (typeof document === 'undefined') return;
  const colState = store.getBossColosseumState();
  const hpPercent = secondsRemaining <= 0
    ? 0
    : Math.max(1, Math.min(100, Math.round((colState.currentHp / colState.maxHp) * 100)));
  
  const hpBar = document.getElementById('boss-hp-bar');
  if (hpBar) hpBar.style.width = `${hpPercent}%`;

  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

  // Update quadrant gem progress & dynamic active pointer arrows
  ['q1', 'q2', 'q3', 'q4'].forEach(qid => {
    const gem = document.getElementById(`gem-${qid}`);
    if (gem) {
      const isCurrent = activeQuad.id === qid;
      const val = Math.round(quadrantCleanliness[qid] || 0);
      const isDone = val >= 100;

      const pctSpan = gem.querySelector('.gem-pct') || gem.querySelector('span:last-child');
      if (pctSpan) {
        pctSpan.textContent = `${val}%`;
        pctSpan.className = `gem-pct text-[9px] font-bold ${isDone ? 'text-emerald-400' : isCurrent ? 'text-cyan-300' : 'text-amber-300'}`;
      }

      const box = gem.querySelector('.gem-box') || gem.querySelector('div:nth-child(2)');
      if (box) {
        if (isCurrent) {
          box.className = 'gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-cyan-500/30 border-3 border-cyan-400 ring-4 ring-cyan-400/50 animate-bounce flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all';
        } else if (isDone) {
          box.className = 'gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-emerald-500/30 border-3 border-emerald-400 flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all';
        } else {
          box.className = 'gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-900/80 border-2 border-slate-700 flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all';
        }
        box.textContent = isDone ? '💎' : '🦷';
      }

      const arrow = gem.querySelector('.gem-arrow');
      if (arrow) {
        arrow.style.display = isCurrent ? 'inline-block' : 'none';
      }
    }
  });

  const zoneStatusText = document.getElementById('current-zone-status-text');
  if (zoneStatusText) {
    zoneStatusText.textContent = `${activeQuad.name}`;
  }
  const zoneBadge = document.getElementById('current-zone-badge');
  if (zoneBadge) {
    zoneBadge.textContent = `${activeQuad.zone}/5`;
  }
}

function concludeVictory() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (bombTimer) {
    clearInterval(bombTimer);
    bombTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  if (autoAssistInterval) {
    clearInterval(autoAssistInterval);
    autoAssistInterval = null;
  }
  if (deflectFlurryTimer) {
    clearTimeout(deflectFlurryTimer);
    deflectFlurryTimer = null;
  }

  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopSensors();
  secondsRemaining = 0;
  isBattlePaused = true;

  // Trigger 3D Cleanse Victory Transformation Sequence
  hanaBattle3DService.onCleanseVictory();
  confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });

  const boss = getBattleBoss(selectedBossId);
  const avgCadence = cadenceSamples.length > 0
    ? Math.round(cadenceSamples.reduce((a, b) => a + b, 0) / cadenceSamples.length)
    : 85;

  voicePrompts.speakBossDefeated(boss.name);

  store.updateColosseumTimer(0, totalDuration);

  // Directly complete the toothbrush battle: records task in pendingApprovals for parent issuance,
  // awards sparks/XP/badges, opens victory modal, and saves state to Cloud Firestore immediately.
  store.completeToothbrushBattle(selectedBossId, totalDuration, avgCadence);

  // When Mouthwash reminder is active for this kid, Rex reminds them in the victory modal
  const hygieneKid = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
  const kidId = hygieneKid?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
  if (kidId && shouldShowMouthwashReminder()) {
    setTimeout(() => {
      voicePrompts.speakMouthwashReminder();
    }, 1200);
  }
}

// Stops every running timer/timeout, releases the camera+mic, and tears down
// the 3D battle scene. Shared by the explicit Quit button and by the
// automatic in-app-navigation guard below -- neither leaves this module's
// setInterval/rhythm loop orphaned and running behind a different screen.
function stopBattleSensorsAndTimers() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (bombTimer) {
    clearInterval(bombTimer);
    bombTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  if (autoAssistInterval) {
    clearInterval(autoAssistInterval);
    autoAssistInterval = null;
  }
  if (deflectFlurryTimer) {
    clearTimeout(deflectFlurryTimer);
    deflectFlurryTimer = null;
  }

  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopSensors();
  hanaBattle3DService.destroy();
}

export function quitBattle() {
  const wasMidBattle = isBattleRunning && secondsRemaining > 0;
  stopBattleSensorsAndTimers();
  isBattleRunning = false;
  isBattlePaused = false;
  hasExplicitBossSelection = false;
  sessionRotatedBossId = null;
  battlePhase = 'brush';
  // A waypoint-launched battle stamps activeWaypointChoreKey so its eventual
  // completeToothbrushBattle() call knows which chore it's for. Quitting
  // before that happens must clear it too, or the breadcrumb survives to
  // mislabel the next, unrelated toothbrush battle's morning/evening chore.
  if (store.state) store.state.activeWaypointChoreKey = null;
  if (wasMidBattle) {
    // Show a real defeat modal (reward-free -- quitting early stays an
    // incentive to finish, same as before) instead of a toast that
    // immediately dumped the kid back to the dashboard. The modal's own
    // button handles navigation once the kid is ready to leave.
    Sound.hit();
    const currentBoss = getBattleBoss(selectedBossId);
    // Stop the 3D render loop now, same as every other end-of-battle path
    // (victory/retry) already does. Without this the old animation-frame
    // chain keeps ticking behind the modal on a now-detached canvas while
    // the next render creates a fresh one, and the two can overlap for a
    // frame -- producing a stray stale timestamp that makes dt briefly go
    // negative and crashes the shockwave-ring renderer (negative arc radius).
    hanaBattle3DService.destroy();
    store.openColosseumDefeatModal({ bossId: currentBoss.id, bossName: currentBoss.name, bossAvatar: currentBoss.emoji || currentBoss.avatar });
    store.notify();
    return;
  }

  const targetView = (store.state && store.state.previousView === 'quest_map')
    ? 'quest_map'
    : (store.state && store.state.previousView === 'bedtime_story')
      ? 'bedtime_story'
      : 'dashboard';
  store.navigate(targetView);
}

// Called by main.js the instant the app navigates away from the Battle view
// to somewhere else (bottom nav, quest map, a reward popup, etc.) without the
// player ever tapping Quit. Without this, battleTimer/bombTimer/autoAssistInterval
// and the rhythm music are module-level state with no DOM/view lifecycle tied
// to them, so they kept ticking and playing forever behind whatever screen the
// player navigated to, and the camera/mic stayed open. This performs the same
// stop-everything cleanup as quitBattle() but has no store side effects (no
// reward popup, no navigate -- a navigation is already in flight), so it is
// safe to call synchronously from inside the render/notify cycle.
export function abandonBattleIfRunning() {
  if (!isBattleRunning) return;
  stopBattleSensorsAndTimers();
  isBattleRunning = false;
  isBattlePaused = false;
  hasExplicitBossSelection = false;
  sessionRotatedBossId = null;
  battlePhase = 'brush';
  // Same stale-breadcrumb risk as quitBattle() -- clearing it is not a
  // reward/notify/navigate side effect, just resetting transient routing
  // state, so it stays safe to call synchronously from the render cycle.
  if (store.state) store.state.activeWaypointChoreKey = null;
}

function showComicHit(text) {
  const badge = document.getElementById('comic-hit-badge');
  if (!badge) return;

  const innerSpan = badge.querySelector('span');
  if (innerSpan) innerSpan.textContent = text;

  badge.style.opacity = '1';
  badge.style.transform = 'translate(-50%, -50%) scale(1.15) rotate(' + (Math.random() * 8 - 4) + 'deg)';

  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translate(-50%, -50%) scale(0.8)';
  }, 650);
}

// =========================================================================
// EVENT LISTENERS & ATTACHMENT
// =========================================================================
export function attachBattleListeners() {
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};

  // Auto-launch battle immediately upon entering view if not running & no end-of-battle modal is open
  if (!isBattleRunning && !colState.isVictoryModalOpen && !colState.isDefeatModalOpen) {
    startBattle();
  }

  // Seamlessly reconnect active video stream if view re-rendered
  const video = document.getElementById('ar-camera-feed');
  if (video && videoStream && videoStream.active) {
    video.srcObject = videoStream;
    video.play().catch(() => {});
    hanaBattle3DService.setVideoElement(video);
    const placeholder = document.getElementById('pip-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    video.classList.remove('hidden');
  }

  // 1. Map Quit Button
  const quitBtn = document.getElementById('battle-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', quitBattle);
  }

  // 2. Audio Rhythm Toggle
  const rhythmBtn = document.getElementById('rhythm-toggle-btn');
  if (rhythmBtn) {
    rhythmBtn.addEventListener('click', () => {
      isRhythmBeatActive = !isRhythmBeatActive;
      Sound.click();
      if (isRhythmBeatActive) {
        Sound.startBattleRhythm();
      } else {
        Sound.stopBattleRhythm();
      }
      const icon = rhythmBtn.querySelector('span');
      if (icon) icon.textContent = isRhythmBeatActive ? 'music_note' : 'music_off';
    });
  }

  // 3. Camera Flip Button
  const cameraFlipBtn = document.getElementById('camera-flip-btn');
  if (cameraFlipBtn) {
    cameraFlipBtn.addEventListener('click', flipCamera);
  }

  // 4. In-Game 3D Villain Switcher Buttons
  document.querySelectorAll('.villain-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vId = btn.getAttribute('data-villain-id');
      if (vId && vId !== selectedBossId) {
        hasExplicitBossSelection = true;
        sessionRotatedBossId = vId;
        selectedBossId = vId;
        if (store.state) store.state.selectedBossId = vId;
        Sound.tap();
        const boss = getBattleBoss(vId);
        hanaBattle3DService.setBoss(boss, quadrantCleanliness);
        if (currentSugarHazard) {
          hanaBattle3DService.setHazard(currentSugarHazard);
        }
        syncCockpitHUD();
        document.querySelectorAll('.villain-switch-btn').forEach(b => {
          const isActive = b.getAttribute('data-villain-id') === vId;
          b.classList.toggle('ring-4', isActive);
          b.classList.toggle('ring-amber-400', isActive);
          b.classList.toggle('scale-105', isActive);
        });
        const bossNameEl = document.getElementById('battle-boss-name-hud');
        if (bossNameEl) bossNameEl.textContent = boss.name;
      }
    });
  });

  // 5. Interactive Canvas Tap (Sugar attack tap deflection & toddler manual scrub helper)
  const canvas = document.getElementById('battle-webgl-canvas');
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (isBattleRunning && !isBattlePaused) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width || 1);
        const scaleY = canvas.height / (rect.height || 1);
        const tapX = e.clientX ? (e.clientX - rect.left) * scaleX : (canvas.width * 0.5);
        const tapY = e.clientY ? (e.clientY - rect.top) * scaleY : (canvas.height * 0.5);

        // Check if user tapped on or near any falling sugar attack with generous 55px hitbox
        const deflected = hanaBattle3DService.checkAndDeflectBombAt ? hanaBattle3DService.checkAndDeflectBombAt(tapX, tapY) : false;
        if (deflected) {
          if (typeof Sound?.tap === 'function') Sound.tap();
          if (typeof Sound?.sparkle === 'function') Sound.sparkle();
          showComicHit('TAPPED & DEFLECTED! 🛡️✨');

          if (isDeflectFlurryActive) {
            triggerDeflectSuccess();
          } else {
            currentCombo += 2;
            const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
            handleScrubHit(activeQuad, 'manual');
          }
          return;
        }

        const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
        handleScrubHit(activeQuad, 'manual');
      }
    });

    const currentBoss = getBattleBoss(selectedBossId);
    const activeCombatWeapon = getActiveCombatWeapon();
    hanaBattle3DService.init(canvas, {
      bossData: currentBoss,
      hazard: currentSugarHazard,
      splineUrl: currentBoss.splineUrl || null,
      combatWeapon: activeCombatWeapon,
      hasLaserEquipped: checkLaserToothbrushEquipped(),
      videoElement: document.getElementById('ar-camera-feed'),
      preserveBattleState: Boolean(isBattleRunning || colState.isVictoryModalOpen || colState.isDefeatModalOpen),
      isVictory: Boolean(colState.isVictoryModalOpen || colState.hasAwardedVictory || hanaBattle3DService.isVictory),
      quadrantCleanliness: quadrantCleanliness
    });
  }

  // 6. Floss Phase: Done Flossing Early Advance
  const doneFlossBtn = document.getElementById('battle-done-floss-btn');
  if (doneFlossBtn) {
    doneFlossBtn.addEventListener('click', () => {
      advanceToBrushPhase();
    });
  }

  // 7. Victory Modal Actions & Mouthwash Acknowledgment
  const mouthwashAckBtn = document.getElementById('mouthwash-modal-ack-btn');
  if (mouthwashAckBtn) {
    mouthwashAckBtn.addEventListener('click', () => {
      const hero = store.getSelectedHero ? store.getSelectedHero() : store.getState().selectedHero;
      const kidId = hero?.id || (store.getSelectedKidId ? store.getSelectedKidId() : store.getState().selectedKidId);
      if (kidId) {
        store.acknowledgeHygieneReminder(kidId, 'mouthwash');
        mouthwashAckBtn.className = 'mt-1 px-4 py-1.5 rounded-xl bg-emerald-600 text-white cursor-default font-headline font-black text-xs transition-all flex items-center gap-1';
        mouthwashAckBtn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Rinsed ✓';
        if (typeof Sound?.fanfare === 'function') Sound.fanfare();
      }
    });
  }

  const visitHqBtn = document.getElementById('colosseum-visit-hq-btn');
  if (visitHqBtn) {
    visitHqBtn.addEventListener('click', () => {
      if (visitHqBtn.dataset.submitting === 'true') return;
      visitHqBtn.dataset.submitting = 'true';
      Sound.tap();
      isBattleRunning = false;
      battlePhase = 'brush';
      hasExplicitBossSelection = false;
      sessionRotatedBossId = null;
      hanaBattle3DService.destroy();

      // NOTE: completing the battle (coins/XP/sparks auto-awarded, the
      // toothbrush_adventure_battle habit marked done, and the parent-
      // configured points submitted for approval) already happened the
      // instant the timer hit zero, in concludeVictory() -> store.
      // completeToothbrushBattle() (guarded by col.hasAwardedVictory so it
      // can never double-fire). This button only needs to close the modal
      // and navigate -- it used to also re-run all of that reward logic
      // inline, which silently double-credited coins and submitted a second,
      // duplicate pending-approval entry to the Parent Portal every time a
      // kid clicked it.
      store.closeColosseumVictoryModal();
      store.navigate('hero_hq');
    });
  }

  const returnBedtimeBtn = document.getElementById('colosseum-return-bedtime-btn');
  if (returnBedtimeBtn) {
    returnBedtimeBtn.addEventListener('click', () => {
      if (returnBedtimeBtn.dataset.submitting === 'true') return;
      returnBedtimeBtn.dataset.submitting = 'true';
      Sound.tap();
      isBattleRunning = false;
      battlePhase = 'brush';
      hasExplicitBossSelection = false;
      sessionRotatedBossId = null;
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
      store.navigate('bedtime_story');
    });
  }

  const returnMapBtn = document.getElementById('colosseum-return-map-btn');
  if (returnMapBtn) {
    returnMapBtn.addEventListener('click', () => {
      if (returnMapBtn.dataset.submitting === 'true') return;
      returnMapBtn.dataset.submitting = 'true';
      Sound.tap();
      isBattleRunning = false;
      battlePhase = 'brush';
      hasExplicitBossSelection = false;
      sessionRotatedBossId = null;
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
      store.navigate('quest_map');
    });
  }

  const playAgainBtn = document.getElementById('colosseum-play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      isBattleRunning = false;
      battlePhase = 'brush';
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
      startBattle();
    });
  }

  const defeatReturnBtn = document.getElementById('colosseum-defeat-return-btn');
  if (defeatReturnBtn) {
    defeatReturnBtn.addEventListener('click', () => {
      Sound.tap();
      hanaBattle3DService.destroy();
      store.closeColosseumDefeatModal();
      const targetView = (store.state && store.state.previousView === 'quest_map')
        ? 'quest_map'
        : (store.state && store.state.previousView === 'bedtime_story')
          ? 'bedtime_story'
          : 'dashboard';
      store.navigate(targetView);
    });
  }

  const defeatRetryBtn = document.getElementById('colosseum-defeat-retry-btn');
  if (defeatRetryBtn) {
    defeatRetryBtn.addEventListener('click', () => {
      isBattleRunning = false;
      battlePhase = 'brush';
      hanaBattle3DService.destroy();
      store.closeColosseumDefeatModal();
      startBattle();
    });
  }

  // 7. Live Rex Battle Voice Commands
  if (typeof window !== 'undefined') {
    if (window._rexBattleFoamHandler) {
      window.removeEventListener('rex-battle-foam', window._rexBattleFoamHandler);
    }
    if (window._rexBattleShieldHandler) {
      window.removeEventListener('rex-battle-shield', window._rexBattleShieldHandler);
    }

    window._rexBattleFoamHandler = (e) => {
      if (isBattleRunning && !isBattlePaused) {
        const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
        handleScrubHit(activeQuad, 'voice');
        showComicHit('DINO FOAM CANNON! 🫧🦖');
        if (typeof hanaBattle3DService.triggerLaserBurst === 'function') {
          hanaBattle3DService.triggerLaserBurst();
        }
      }
    };

    window._rexBattleShieldHandler = (e) => {
      if (isBattleRunning && !isBattlePaused) {
        if (isDeflectFlurryActive) {
          triggerDeflectSuccess();
        } else {
          showComicHit('HERO BUBBLE SHIELD! 🛡️✨');
          hanaBattle3DService.onDeflectRicochet();
          store.triggerColosseumDeflect();
        }
      }
    };

    window.addEventListener('rex-battle-foam', window._rexBattleFoamHandler);
    window.addEventListener('rex-battle-shield', window._rexBattleShieldHandler);
  }
}
