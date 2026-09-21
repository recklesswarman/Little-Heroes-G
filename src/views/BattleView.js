import { hanaBattle3DService } from '../services/hanaBattle3DService.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, DENTAL_QUADRANTS, getDentalQuadrant } from '../data/hygieneBossesData.js';
import { brushAudioAnalyzer } from '../audio/brushAudioAnalyzer.js';

const sugarVillainEscapedImg = new URL('../assets/sugar_villain_escaped.jpg', import.meta.url).href;

// =========================================================================
// LIVE-ACTION 3D CARTOON TOOTHBRUSH BATTLE ARENA (100% HANDS-FREE ARCADE)
// =========================================================================

// Battle State Variables
let selectedBossId = 'sugar_bandit';
let battleTimer = null;
let bombTimer = null;
let secondsRemaining = 120;
let totalDuration = 120;
let isBattleRunning = false;
let isBattlePaused = false;
let isRhythmBeatActive = true;
let isIntroCountingDown = false;

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

// Deflect Flurry & Spoken /learn State
let isDeflectFlurryActive = false;
let deflectFlurryTimer = null;
let isLearnChallengeActive = false;
let learnChallengeTimer = null;
let speechRecognitionInstance = null;
let hasTriggeredLearnChallenge = false;

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
      color: foundCustom.color || '#a855f7',
      accentBorder: foundCustom.accentBorder || 'border-purple-500',
      gradient: foundCustom.gradient || 'from-purple-900 via-indigo-900 to-slate-900',
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
  const preset = HYGIENE_BOSSES.find(b => b.id === currentSelectedId);
  return preset || HYGIENE_BOSSES[0];
}

// Check if current hero owns/equipped the Laser Toothbrush (+30% buff)
function checkLaserToothbrushEquipped() {
  const hero = store.getState().selectedHero;
  if (!hero) return false;
  const inEquipped = Array.isArray(hero.equippedGear) && hero.equippedGear.includes('laser_toothbrush');
  const inHeroInv = Array.isArray(hero.inventory) && hero.inventory.includes('laser_toothbrush');
  const inStoreInv = Array.isArray(store.getState().inventory) && store.getState().inventory.includes('laser_toothbrush');
  return inEquipped || inHeroInv || inStoreInv;
}

// =========================================================================
// MAIN BATTLE VIEW RENDER FUNCTION: FULL-SCREEN VIBRANT 3D ARCADE VIEWPORT
// =========================================================================
export function renderBattleView() {
  selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : selectedBossId;
  const currentBoss = getBattleBoss(selectedBossId);
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
  const hasLaserSword = checkLaserToothbrushEquipped();
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

  // List of primary hygiene bosses for bottom villain dock
  const availableVillains = [
    { id: 'sugar_bandit', name: 'Sugar Bandit', emoji: '🍬', color: '#f59e0b' },
    { id: 'plaque_kraken', name: 'Plaque Kraken', emoji: '🐙', color: '#06b6d4' },
    { id: 'tartar_titan', name: 'Tartar Titan', emoji: '💎', color: '#a855f7' }
  ];

  return `
    <div class="relative w-full h-[calc(100vh-64px)] min-h-[540px] overflow-hidden bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#081a2e] text-white font-headline select-none">
      
      <!-- ================= 1. FULL VIEWPORT 3D WEBGL ARENA CANVAS ================= -->
      <canvas id="battle-webgl-canvas" class="absolute inset-0 w-full h-full z-0 block cursor-crosshair"></canvas>

      <!-- ================= 2. TOP FLOATING BUBBLE BAR ================= -->
      <div class="absolute top-2 sm:top-3 left-2 right-2 sm:left-4 sm:right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
        
        <!-- Left: Kid-friendly Map Exit Button -->
        <button id="battle-quit-btn" class="pointer-events-auto bg-gradient-to-b from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border-2 sm:border-3 border-amber-200 shadow-[0_4px_0_0_#b45309] flex items-center gap-1 active:translate-y-1 active:shadow-none transition-all flex-shrink-0" title="Return to Map">
          <span class="material-symbols-outlined text-lg sm:text-xl font-black">arrow_back</span>
          <span class="hidden xs:inline">Map</span>
        </button>

        <!-- Center: Giant Glowing Bubble Countdown Timer & Boss Health Meter -->
        <div class="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 sm:px-5 py-1.5 sm:py-2 rounded-3xl border-2 sm:border-3 border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center gap-2 sm:gap-4 max-w-sm sm:max-w-md w-full justify-between">
          
          <!-- Boss Avatar & Health Heart Bar -->
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="text-2xl sm:text-3xl filter drop-shadow animate-bounce flex-shrink-0">
              ${currentBoss.emoji || currentBoss.avatar || '🍬'}
            </span>
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center justify-between text-[10px] sm:text-xs font-black text-amber-300 uppercase truncate">
                <span class="truncate">${currentBoss.name}</span>
                <span class="text-[9px] text-rose-300 font-bold ml-1">${hpPercent}% HP</span>
              </div>
              <!-- Curved Boss Health Bar -->
              <div class="w-full bg-slate-950 h-3 sm:h-3.5 rounded-full overflow-hidden border border-white/20 p-0.5 mt-0.5 shadow-inner">
                <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.8)]" style="width: ${hpPercent}%;"></div>
              </div>
            </div>
          </div>

          <!-- Vertical Divider -->
          <div class="h-8 w-0.5 bg-white/20 flex-shrink-0"></div>

          <!-- Giant Countdown Display (02:00 -> 00:00) -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="material-symbols-outlined text-amber-400 text-xl sm:text-2xl animate-pulse">timer</span>
            <span id="battle-timer-display" class="font-headline text-2xl sm:text-4xl font-black text-amber-300 tracking-wider drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]">
              ${timeStr}
            </span>
          </div>

        </div>

        <!-- Right: Audio Rhythm & Mirror Toggle -->
        <div class="pointer-events-auto flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button id="rhythm-toggle-btn" class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900/90 border-2 border-slate-700 text-cyan-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 shadow" title="Toggle Rhythm">
            <span class="material-symbols-outlined text-lg sm:text-xl">${isRhythmBeatActive ? 'music_note' : 'music_off'}</span>
          </button>
          <button id="camera-flip-btn" class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900/90 border-2 border-slate-700 text-amber-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 shadow" title="Flip Camera">
            <span class="material-symbols-outlined text-lg sm:text-xl">cameraswitch</span>
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

      <!-- ================= 4. ACTIVE ZONE PROMPT BANNER ================= -->
      <div id="active-zone-banner" class="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/95 border-2 border-cyan-400 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 pointer-events-none animate-pulse">
        <span class="text-base">🪥</span>
        <span class="text-xs font-black text-cyan-300 uppercase tracking-wide">BRUSHING ZONE:</span>
        <span id="current-zone-status-text" class="text-xs font-black text-white">${activeQuad.name}</span>
        <span id="current-zone-badge" class="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">${activeQuad.zone}/5</span>
      </div>

      <!-- ================= 5. 4 GLOWING TOOTH QUADRANT GEMS (MIRRORED BATHROOM PERSPECTIVE) ================= -->
      <!-- Q1: Upper Right (Screen Top-Right, >50% X) -->
      <div id="gem-q1" class="absolute top-24 sm:top-28 right-3 sm:right-6 z-20 flex items-center gap-2 pointer-events-none transition-all duration-300">
        <div class="flex flex-col items-end">
          <span class="text-[10px] sm:text-xs font-black text-white drop-shadow">Upper Right</span>
          <span class="gem-pct text-[9px] font-bold ${quadrantCleanliness.q1 >= 100 ? 'text-emerald-400' : 'text-amber-300'}">${Math.round(quadrantCleanliness.q1)}%</span>
        </div>
        <div class="gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${activeQuad.id === 'q1' ? 'bg-cyan-500/30 border-3 border-cyan-400 ring-4 ring-cyan-400/50 animate-bounce' : quadrantCleanliness.q1 >= 100 ? 'bg-emerald-500/30 border-3 border-emerald-400' : 'bg-slate-900/80 border-2 border-slate-700'} flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all">
          ${quadrantCleanliness.q1 >= 100 ? '💎' : '🦷'}
        </div>
        <span class="gem-arrow text-cyan-400 text-xl animate-pulse" style="display: ${activeQuad.id === 'q1' ? 'inline-block' : 'none'};">👈</span>
      </div>

      <!-- Q2: Upper Left (Screen Top-Left, <50% X, below mirror) -->
      <div id="gem-q2" class="absolute top-48 sm:top-56 left-3 sm:left-6 z-20 flex items-center gap-2 pointer-events-none transition-all duration-300">
        <span class="gem-arrow text-cyan-400 text-xl animate-pulse" style="display: ${activeQuad.id === 'q2' ? 'inline-block' : 'none'};">👉</span>
        <div class="gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${activeQuad.id === 'q2' ? 'bg-cyan-500/30 border-3 border-cyan-400 ring-4 ring-cyan-400/50 animate-bounce' : quadrantCleanliness.q2 >= 100 ? 'bg-emerald-500/30 border-3 border-emerald-400' : 'bg-slate-900/80 border-2 border-slate-700'} flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all">
          ${quadrantCleanliness.q2 >= 100 ? '💎' : '🦷'}
        </div>
        <div class="flex flex-col items-start">
          <span class="text-[10px] sm:text-xs font-black text-white drop-shadow">Upper Left</span>
          <span class="gem-pct text-[9px] font-bold ${quadrantCleanliness.q2 >= 100 ? 'text-emerald-400' : 'text-amber-300'}">${Math.round(quadrantCleanliness.q2)}%</span>
        </div>
      </div>

      <!-- Q3: Lower Right (Screen Bottom-Right, >50% X) -->
      <div id="gem-q3" class="absolute bottom-20 sm:bottom-24 right-3 sm:right-6 z-20 flex items-center gap-2 pointer-events-none transition-all duration-300">
        <div class="flex flex-col items-end">
          <span class="text-[10px] sm:text-xs font-black text-white drop-shadow">Lower Right</span>
          <span class="gem-pct text-[9px] font-bold ${quadrantCleanliness.q3 >= 100 ? 'text-emerald-400' : 'text-amber-300'}">${Math.round(quadrantCleanliness.q3)}%</span>
        </div>
        <div class="gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${activeQuad.id === 'q3' ? 'bg-cyan-500/30 border-3 border-cyan-400 ring-4 ring-cyan-400/50 animate-bounce' : quadrantCleanliness.q3 >= 100 ? 'bg-emerald-500/30 border-3 border-emerald-400' : 'bg-slate-900/80 border-2 border-slate-700'} flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all">
          ${quadrantCleanliness.q3 >= 100 ? '💎' : '🦷'}
        </div>
        <span class="gem-arrow text-cyan-400 text-xl animate-pulse" style="display: ${activeQuad.id === 'q3' ? 'inline-block' : 'none'};">👈</span>
      </div>

      <!-- Q4: Lower Left (Screen Bottom-Left, <50% X) -->
      <div id="gem-q4" class="absolute bottom-20 sm:bottom-24 left-3 sm:left-6 z-20 flex items-center gap-2 pointer-events-none transition-all duration-300">
        <span class="gem-arrow text-cyan-400 text-xl animate-pulse" style="display: ${activeQuad.id === 'q4' ? 'inline-block' : 'none'};">👉</span>
        <div class="gem-box w-11 h-11 sm:w-13 sm:h-13 rounded-2xl ${activeQuad.id === 'q4' ? 'bg-cyan-500/30 border-3 border-cyan-400 ring-4 ring-cyan-400/50 animate-bounce' : quadrantCleanliness.q4 >= 100 ? 'bg-emerald-500/30 border-3 border-emerald-400' : 'bg-slate-900/80 border-2 border-slate-700'} flex items-center justify-center text-xl sm:text-2xl shadow-lg transition-all">
          ${quadrantCleanliness.q4 >= 100 ? '💎' : '🦷'}
        </div>
        <div class="flex flex-col items-start">
          <span class="text-[10px] sm:text-xs font-black text-white drop-shadow">Lower Left</span>
          <span class="gem-pct text-[9px] font-bold ${quadrantCleanliness.q4 >= 100 ? 'text-emerald-400' : 'text-amber-300'}">${Math.round(quadrantCleanliness.q4)}%</span>
        </div>
      </div>

      <!-- ================= 6. DEFLECT FLURRY & SPOKEN /LEARN NOTIFICATION BANNERS ================= -->
      <div id="deflect-flurry-banner" class="absolute top-28 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 opacity-0 scale-90">
        <div class="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-headline font-black text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.95)] border-3 border-white animate-bounce flex items-center gap-2.5">
          <span class="text-xl">💣</span>
          <span>CARAMEL BOMB! SCRUB FASTER TO DEFLECT!</span>
          <span class="text-xl">🛡️</span>
        </div>
      </div>

      <div id="rex-learn-banner" class="absolute top-28 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 opacity-0 scale-90 max-w-sm w-[92%]">
        <div class="bg-slate-900/95 border-3 border-amber-400 text-white font-headline p-3.5 rounded-3xl shadow-2xl flex items-center gap-3">
          <span class="text-3xl animate-bounce flex-shrink-0">🦖</span>
          <div class="flex-1 min-w-0">
            <div class="text-[9px] font-black text-amber-400 uppercase tracking-wide">REX LEARN MICRO-QUIZ</div>
            <div id="rex-learn-question-text" class="text-xs font-bold text-slate-100 leading-snug">How many times a day do Little Heroes brush their teeth?</div>
            <div class="text-[9px] font-extrabold text-emerald-400 mt-0.5">SAY "TWICE!" OR SCRUB FAST TO SHATTER! 💥</div>
          </div>
        </div>
      </div>

      <!-- Comic Deflect Hit Popup -->
      <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
        <span class="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-slate-950 font-headline text-base sm:text-lg font-black px-6 py-2.5 rounded-full shadow-2xl border-3 border-white scale-125">
          DEFLECTED! 🛡️✨
        </span>
      </div>

      <!-- ================= 7. REX VOICE COMPANION COACHING (BOTTOM-LEFT) ================= -->
      <div class="absolute bottom-16 sm:bottom-18 left-3 sm:left-6 z-25 flex items-end gap-2 pointer-events-none">
        <div class="relative w-12 h-12 sm:w-14 sm:h-14 bg-slate-900/95 rounded-2xl border-2 border-emerald-400 p-1 shadow-lg flex flex-col items-center justify-center overflow-hidden">
          <span class="text-2xl sm:text-3xl">${activePet.avatar || '🦖'}</span>
        </div>
        <div class="bg-slate-900/95 border-2 border-emerald-400/80 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-2xl max-w-[200px] sm:max-w-[280px]">
          <p id="rex-dialogue-bubble" class="font-headline font-bold text-[10px] sm:text-[11px] text-emerald-300 leading-snug">
            ${currentRexCoachText}
          </p>
        </div>
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
      : "Tartar Titan's Enamel Shield Crest";

  return `
    <div id="colosseum-victory-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-sm bg-[#0b1320] border-4 border-emerald-400 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">
        
        <div class="w-20 h-20 rounded-full bg-emerald-500/20 border-3 border-emerald-400 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-bounce">
          <span class="text-4xl">🏆</span>
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

        <div class="w-full bg-slate-950/90 rounded-2xl p-2.5 border-2 border-slate-800 flex items-center justify-around mb-4 shadow-inner">
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

        <div class="w-full flex flex-col gap-2">
          <button id="colosseum-visit-hq-btn" class="w-full py-3 min-h-[48px] rounded-2xl bg-emerald-500 text-slate-950 font-headline font-black text-sm uppercase tracking-wider shadow-[0_6px_0_0_#047857] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-lg font-bold">apartment</span> VIEW TROPHY IN HERO HQ
          </button>
          
          <button id="colosseum-play-again-btn" class="w-full py-2.5 min-h-[44px] rounded-2xl bg-slate-800 text-cyan-400 border-2 border-slate-700 font-headline font-bold text-xs uppercase hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1">
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
  micCadenceScore = cadenceScore;
  cadenceSamples.push(cadenceScore);
  isMicActive = isScrubbing;

  if (isScrubbing) {
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
    handleScrubHit(activeQuad, 'acoustic');

    if (isDeflectFlurryActive && cadenceScore >= 45) {
      triggerDeflectSuccess();
    }

    if (isLearnChallengeActive && cadenceScore >= 55) {
      resolveLearnChallenge(true, 'cadence');
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

          if (isLearnChallengeActive && (motionRatio >= 0.18 || roiRatio >= 0.18)) {
            resolveLearnChallenge(true, 'cadence');
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

  hanaBattle3DService.spawnCaramelBomb();

  const banner = document.getElementById('deflect-flurry-banner');
  if (banner) {
    banner.classList.remove('opacity-0', 'scale-90');
    banner.classList.add('opacity-100', 'scale-100');
  }

  currentRexCoachText = 'Caramel Bomb incoming! Scrub faster to raise your enamel shield!';
  updateRexDialogue();
  voicePrompts.speak('Caramel bomb incoming! Scrub faster to deflect!');

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

  hanaBattle3DService.onDeflectRicochet();
  store.triggerColosseumDeflect();
  showComicHit('DEFLECTED! 🛡️✨');
  if (typeof Sound?.fanfare === 'function') Sound.fanfare();
  currentRexCoachText = 'Awesome deflect! The caramel bounced right back at the boss!';
  updateRexDialogue();
  syncCockpitHUD();
}

function hideDeflectBanner() {
  const banner = document.getElementById('deflect-flurry-banner');
  if (banner) {
    banner.classList.remove('opacity-100', 'scale-100');
    banner.classList.add('opacity-0', 'scale-90');
  }
}

function triggerLearnChallenge() {
  isLearnChallengeActive = true;
  const colState = store.getBossColosseumState();
  colState.isShieldActive = true;
  hanaBattle3DService.updateState({ shieldActive: true });

  const banner = document.getElementById('rex-learn-banner');
  if (banner) {
    banner.classList.remove('opacity-0', 'scale-90');
    banner.classList.add('opacity-100', 'scale-100');
  }

  const question = "Rex Learn Challenge: How many times a day do Little Heroes brush their teeth? Say twice or scrub fast!";
  currentRexCoachText = question;
  updateRexDialogue();

  let recognitionStarted = false;
  const startSafeListening = () => {
    if (!recognitionStarted && isLearnChallengeActive) {
      recognitionStarted = true;
      startSpeechRecognition();
    }
  };

  voicePrompts.speak(question, startSafeListening);
  setTimeout(startSafeListening, 2400);

  if (learnChallengeTimer) clearTimeout(learnChallengeTimer);
  learnChallengeTimer = setTimeout(() => {
    resolveLearnChallenge(false, 'assist');
  }, 8500);
}

function startSpeechRecognition() {
  if (typeof window === 'undefined') return;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return;

  try {
    speechRecognitionInstance = new SpeechRec();
    speechRecognitionInstance.continuous = false;
    speechRecognitionInstance.interimResults = true;
    speechRecognitionInstance.lang = 'en-US';

    speechRecognitionInstance.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript.toLowerCase() + ' ';
      }
      if (transcript.includes('two') || transcript.includes('twice') || transcript.includes('2') || transcript.includes('to') || transcript.includes('too')) {
        resolveLearnChallenge(true, 'voice');
      }
    };

    speechRecognitionInstance.onerror = () => {};
    speechRecognitionInstance.onend = () => {
      if (isLearnChallengeActive) {
        try { speechRecognitionInstance.start(); } catch (e) {}
      }
    };
    speechRecognitionInstance.start();
  } catch (e) {}
}

function stopSpeechRecognition() {
  if (speechRecognitionInstance) {
    try { speechRecognitionInstance.stop(); } catch (e) {}
    speechRecognitionInstance = null;
  }
}

function resolveLearnChallenge(success, method = 'voice') {
  if (!isLearnChallengeActive) return;
  isLearnChallengeActive = false;
  if (learnChallengeTimer) clearTimeout(learnChallengeTimer);
  stopSpeechRecognition();

  const banner = document.getElementById('rex-learn-banner');
  if (banner) {
    banner.classList.remove('opacity-100', 'scale-100');
    banner.classList.add('opacity-0', 'scale-90');
  }

  const colState = store.getBossColosseumState();
  colState.isShieldActive = false;
  colState.shieldHp = 0;
  if (colState.shieldMilestonesTriggered) {
    colState.shieldMilestonesTriggered[90] = true;
  }
  colState.currentHp = Math.max(1, colState.currentHp - 15);
  colState.choreSupernovaCharge = Math.min(100, (colState.choreSupernovaCharge || 0) + 15);
  hanaBattle3DService.onArmorFracture('shield');
  hanaBattle3DService.updateState({ shieldActive: false, bossHp: colState.currentHp });

  if (method === 'voice') {
    currentRexCoachText = "CRITICAL HIT! You brush twice a day! Barrier shattered!";
    showComicHit('CRITICAL LEARN HIT! 🎓💥');
    if (typeof Sound?.fanfare === 'function') Sound.fanfare();
  } else if (method === 'cadence') {
    currentRexCoachText = "VIGOROUS CADENCE! You shattered the caramel barrier!";
    showComicHit('SCRUB SHATTER! ⚡💥');
    if (typeof Sound?.fanfare === 'function') Sound.fanfare();
  } else {
    currentRexCoachText = "Rex power assist! We shattered the barrier together!";
    showComicHit('BARRIER CRACKED! ✨');
  }
  updateRexDialogue();
  voicePrompts.speak(currentRexCoachText);
  syncCockpitHUD();
}

// =========================================================================
// BATTLE LIFECYCLE CONTROLLERS
// =========================================================================
export function startBattle() {
  selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : selectedBossId;
  const currentBoss = getBattleBoss(selectedBossId);
  isBattleRunning = true;
  isBattlePaused = false;
  
  const bossDuration = currentBoss.battleDurationSec || store.getState().parentSettings?.arBattleDuration || 120;
  secondsRemaining = bossDuration;
  totalDuration = bossDuration;
  totalScrubHits = 0;
  currentCombo = 0;
  cadenceSamples = [];
  lastScrubTimestamp = Date.now();
  hasTriggeredLearnChallenge = false;

  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  lastProgressTimestamp = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };

  store.initColosseumBattle(selectedBossId, totalDuration);

  Sound.startBattleRhythm();
  initSensors();

  // Trigger quick "3, 2, 1, BRUSH!" visual intro overlay
  playIntroCountdown();

  // Auto-Assist Fallback Pulse
  if (autoAssistInterval) clearInterval(autoAssistInterval);
  autoAssistInterval = setInterval(() => {
    if (!isBattleRunning || isBattlePaused) return;
    const now = Date.now();
    if (now - lastScrubTimestamp > 1800) {
      isAutoAssistPulseActive = true;
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleScrubHit(activeQuad, 'assist');
      setTimeout(() => { isAutoAssistPulseActive = false; }, 400);
    }
  }, 1000);

  // Periodic Caramel Bomb Attack Timer
  if (bombTimer) clearInterval(bombTimer);
  bombTimer = setInterval(() => {
    if (isBattleRunning && !isBattlePaused && secondsRemaining > 10) {
      triggerDeflectFlurry();
    }
  }, 14000);

  const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  currentRexCoachText = initialQuad.coachMessage || 'Get ready! Scrub in gentle circles on your top right teeth!';

  // 1 Hz Countdown Battle Loop
  if (battleTimer) clearInterval(battleTimer);
  battleTimer = setInterval(() => {
    if (isBattlePaused) return;

    secondsRemaining--;

    store.updateColosseumTimer(secondsRemaining, totalDuration);

    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = document.getElementById('battle-timer-display');
    if (timerDisplay) timerDisplay.textContent = timeStr;

    syncCockpitHUD();

    // Spoken Rex Learn Micro-Challenge at halfway mark
    if (secondsRemaining === Math.floor(totalDuration / 2) && !hasTriggeredLearnChallenge) {
      hasTriggeredLearnChallenge = true;
      triggerLearnChallenge();
    }

    const ratio = secondsRemaining / totalDuration;
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

    const zoneStatusText = document.getElementById('current-zone-status-text');
    if (zoneStatusText) {
      zoneStatusText.textContent = `${activeQuad.name} (${activeQuad.zone}/5)`;
    }

    // Voice & Dialogue quadrant switches
    if (Math.abs(ratio - 0.75) < (1 / totalDuration)) {
      currentRexCoachText = DENTAL_QUADRANTS[1]?.coachMessage || 'Switch to top left teeth!';
      voicePrompts.speak(currentRexCoachText);
      updateRexDialogue();
    } else if (Math.abs(ratio - 0.50) < (1 / totalDuration)) {
      currentRexCoachText = DENTAL_QUADRANTS[2]?.coachMessage || 'Halfway there! Bottom right teeth next!';
      voicePrompts.speak(currentRexCoachText);
      updateRexDialogue();
    } else if (Math.abs(ratio - 0.25) < (1 / totalDuration)) {
      currentRexCoachText = DENTAL_QUADRANTS[3]?.coachMessage || 'Bottom left side! Keep scrubbing!';
      voicePrompts.speak(currentRexCoachText);
      updateRexDialogue();
    } else if (Math.abs(ratio - 0.08) < (1 / totalDuration)) {
      currentRexCoachText = DENTAL_QUADRANTS[4]?.coachMessage || 'Final seconds: Gentle tongue polish for fresh breath!';
      voicePrompts.speak(currentRexCoachText);
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

  const hasLaser = checkLaserToothbrushEquipped();
  const scrubMultiplier = hasLaser ? 1.3 : 1.0;

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
    cadenceScore: micCadenceScore,
    isScrubbing: true,
    quadrantCleanliness: quadrantCleanliness
  });

  if (source === 'manual') {
    showComicHit(hasLaser ? 'LASER BLAST! ⚡' : 'MINTY BLAST! 🫧');
  }

  syncCockpitHUD();
}

function syncCockpitHUD() {
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
  if (learnChallengeTimer) {
    clearTimeout(learnChallengeTimer);
    learnChallengeTimer = null;
  }
  stopSpeechRecognition();

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
  store.completeToothbrushBattle(selectedBossId, totalDuration, avgCadence);
}

export function quitBattle() {
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
  if (learnChallengeTimer) {
    clearTimeout(learnChallengeTimer);
    learnChallengeTimer = null;
  }
  stopSpeechRecognition();

  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopSensors();
  hanaBattle3DService.destroy();

  if (isBattleRunning && secondsRemaining > 0) {
    isBattleRunning = false;
    Sound.hit();
    store.showReward(
      'Boss Escaped!',
      'The Hygiene Boss escaped! Brush for the full routine next time to cleanse the villain, earn your sparks, and unlock your 3D HQ trophy!',
      0,
      0,
      sugarVillainEscapedImg,
      'sentiment_dissatisfied'
    );
  }

  isBattleRunning = false;
  isBattlePaused = false;
  const targetView = (store.state && store.state.previousView === 'quest_map') ? 'quest_map' : 'dashboard';
  store.navigate(targetView);
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

  // Auto-launch battle immediately upon entering view if not running & not victory modal
  if (!isBattleRunning && !colState.isVictoryModalOpen) {
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
        selectedBossId = vId;
        if (store.setSelectedBossId) store.setSelectedBossId(vId);
        Sound.tap();
        const boss = getBattleBoss(vId);
        hanaBattle3DService.setBoss(boss, quadrantCleanliness);
        store.notify();
      }
    });
  });

  // 5. Interactive Canvas Tap (Manual scrub helper for younger toddlers)
  const canvas = document.getElementById('battle-webgl-canvas');
  if (canvas) {
    canvas.addEventListener('pointerdown', () => {
      if (isBattleRunning && !isBattlePaused) {
        const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
        handleScrubHit(activeQuad, 'manual');
      }
    });

    const currentBoss = getBattleBoss(selectedBossId);
    hanaBattle3DService.init(canvas, {
      bossData: currentBoss,
      splineUrl: currentBoss.splineUrl || null,
      hasLaserEquipped: checkLaserToothbrushEquipped(),
      videoElement: document.getElementById('ar-camera-feed'),
      preserveBattleState: isBattleRunning,
      quadrantCleanliness: quadrantCleanliness
    });
  }

  // 6. Victory Modal Actions
  const visitHqBtn = document.getElementById('colosseum-visit-hq-btn');
  if (visitHqBtn) {
    visitHqBtn.addEventListener('click', () => {
      isBattleRunning = false;
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
      store.navigate('hero_hq');
    });
  }

  const playAgainBtn = document.getElementById('colosseum-play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      isBattleRunning = false;
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
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
