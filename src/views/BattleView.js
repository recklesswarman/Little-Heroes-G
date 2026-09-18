import { hanaBattle3DService } from '../services/hanaBattle3DService.js';
import { renderDental3DMap, initDental3DMap, updateDental3DMapProgress, destroyDental3DMap, DENTAL_ZONES } from '../components/Dental3DMap.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, DENTAL_QUADRANTS, getDentalQuadrant } from '../data/hygieneBossesData.js';
import { brushAudioAnalyzer } from '../audio/brushAudioAnalyzer.js';

const sugarVillainEscapedImg = new URL('../assets/sugar_villain_escaped.jpg', import.meta.url).href;

// =========================================================================
// 3D HYGIENE BOSS BLASTER COLOSSEUM 4.0 (HANA 3D WEBGL ARENA + HANDS-FREE SENSOR FUSION)
// Features:
// - Pure 3D WebGL Scene via hanaBattle3DService (Spline 3D Runtime & Procedural Fallback)
// - Breakable 3D Candy Armor Deconstruction per Quadrant
// - Floating 3D Hero Mirror (Live Webcam Video Texture)
// - Interactive 3D Mouth Hologram HUD (Plaque to Diamond White)
// - Dynamic 3D Foam & Laser Particle Streams
// - 100% Hands-Free Atomic MediaStream (Single getUserMedia for Video + 2.8kHz Mic)
// - Incoming Caramel Bombs & Deflect Flurry
// - Spoken Rex /learn Voice Micro-Challenge at 60s Mark
// - Mirrored Bathroom Perspective for Quadrants 1-5
// - Atomic Consolidated Victory & -15min Chore Turbo Boost
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
let studioViewportMode = 'colosseum'; // 'colosseum' or 'spline'

// Hardware & Multi-Modal Sensors State (Single Atomic MediaStream)
let videoStream = null;
let isCameraActive = false;
let cameraError = null;
let cameraFacingMode = 'user'; // 'user' or 'environment'
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

// Auto-Assist Pulse State (Non-frustrating steady rhythm for kids)
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

// Helper to retrieve boss data from parent custom bosses or preset hygiene bosses
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
// MAIN BATTLE VIEW RENDER FUNCTION
// =========================================================================
export function renderBattleView() {
  selectedBossId = store.getSelectedBossId ? store.getSelectedBossId() : selectedBossId;
  const currentBoss = getBattleBoss(selectedBossId);
  const badges = store.getDentalBadges ? store.getDentalBadges() : DENTAL_BADGES;
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};
  const hasLaserSword = checkLaserToothbrushEquipped();
  const parentCustomBosses = store.getParentCustomBosses ? store.getParentCustomBosses() : [];
  const activePet = store.getActivePet ? store.getActivePet() : { name: 'Rex', avatar: '🦖' };

  if (!isBattleRunning && !colState.isVictoryModalOpen) {
    // =========================================================================
    // 1. LOBBY & BOSS SELECTION SCREEN (PRE-BATTLE)
    // =========================================================================
    const allAvailableBosses = [
      ...parentCustomBosses,
      ...HYGIENE_BOSSES.filter(b => !parentCustomBosses.some(cb => cb.id === b.id))
    ];

    return `
      <div class="max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-4 animate-fade-in select-none">
        
        <!-- HEADER NAVIGATION BAR -->
        <div class="flex items-center justify-between">
          <button id="battle-lobby-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 min-h-[44px] rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95 transition-all">
            <span class="material-symbols-outlined text-base">arrow_back</span> Back to Hub
          </button>
          
          <div class="flex items-center gap-2">
            <button id="battle-force-reload-btn" class="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-headline text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/40 flex items-center gap-1 active:scale-95 transition-all shadow-sm" title="Force Reload App to latest version & clear cache">
              <span class="material-symbols-outlined text-sm">cached</span>
              <span>v3.1 Reload</span>
            </button>
            <span class="text-xs font-black text-cyan-400 bg-cyan-950/70 border border-cyan-500/40 px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
              <span>🦷</span> 4 Zones + Tongue
            </span>
            <span class="text-xs font-black text-amber-400 bg-amber-950/70 border border-amber-500/40 px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
              <span>⚡</span> +${currentBoss.rewardSparks || 15} Sparks
            </span>
          </div>
        </div>

        <!-- HERO BANNER WITH LASER TOOTHBRUSH GEAR SPOTLIGHT -->
        <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 border-2 border-cyan-500/30 card-shadow flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="flex items-center gap-4 z-10">
            <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-500/30 to-blue-600/20 border-2 border-cyan-400/50 flex items-center justify-center text-4xl shadow-inner flex-shrink-0">
              ⚔️
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="bg-cyan-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Hana 3D Cockpit v3.1</span>
                <span class="text-xs font-bold text-slate-300">Hands-Free Live Action</span>
              </div>
              <h1 class="font-headline text-xl sm:text-2xl font-black text-white mt-1">Toothbrush Battle Cockpit</h1>
              <p class="text-xs text-slate-300 mt-0.5 max-w-md leading-relaxed">
                Hands-free 3D combat! Your toothbrush audio & optical motion crack candy armor, deflect sugar bombs, and purify bosses in real-time.
              </p>
            </div>
          </div>

          <!-- Laser Toothbrush Status Indicator -->
          <div class="z-10 bg-black/40 p-3 rounded-2xl border ${hasLaserSword ? 'border-cyan-400/60 bg-cyan-950/40' : 'border-white/10'} flex items-center gap-3">
            <span class="text-2xl">${hasLaserSword ? '⚡' : '🪥'}</span>
            <div class="flex flex-col text-left">
              <span class="text-[10px] font-extrabold uppercase ${hasLaserSword ? 'text-cyan-300' : 'text-slate-400'}">
                ${hasLaserSword ? 'Laser Toothbrush Active' : 'Standard Toothbrush'}
              </span>
              <span class="text-[9px] text-slate-300">
                ${hasLaserSword ? '+30% Scrub Power & Neon Laser Beam' : 'Equip Laser Toothbrush in Shop for +30% boost'}
              </span>
            </div>
          </div>
        </div>

        <!-- PRIMARY TOP LAUNCH BAR (Immediately visible above the fold on mobile screens) -->
        <div class="bg-gradient-to-r from-emerald-950 via-slate-900 to-cyan-950 rounded-3xl p-4 sm:p-5 border-3 border-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.35)] flex flex-col sm:flex-row items-center justify-between gap-4 card-shadow">
          <div class="flex items-center gap-3.5 w-full sm:w-auto">
            <div class="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400/50 flex items-center justify-center text-3xl shadow-inner flex-shrink-0 animate-bounce">
              ${currentBoss.emoji || currentBoss.avatar || '👾'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="bg-emerald-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">2-MIN ROUTINE READY</span>
                <span class="text-xs font-bold text-slate-300">${currentBoss.name}</span>
              </div>
              <div class="font-headline text-base sm:text-lg font-black text-white mt-0.5">Live-Action Hana 3D Battle Arena</div>
              <div class="text-[11px] text-emerald-400 font-bold">100% Hands-Free • Audio Bristle Detection Active</div>
            </div>
          </div>

          <button id="top-start-ar-battle-btn" class="w-full sm:w-auto bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 text-slate-950 font-headline text-base sm:text-lg font-black px-8 py-4 min-h-[56px] rounded-2xl shadow-[0_6px_0_0_#065f46] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2.5 flex-shrink-0 cursor-pointer">
            <span class="material-symbols-outlined text-2xl font-black">swords</span>
            <span>START 2-MINUTE 3D BATTLE!</span>
          </button>
        </div>

        <!-- BOSS SELECTION CAROUSEL -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span class="material-symbols-outlined text-base text-cyan-400">swords</span> Select Hygiene Boss Encounter:
            </h2>
            <span class="text-xs text-slate-400">Tap to choose villain</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${allAvailableBosses.map(b => {
              const isSelected = b.id === selectedBossId;
              const isParentCrafted = Boolean(b.isParentCrafted || b.isCustom);
              const durationSec = b.battleDurationSec || 120;
              const trophyTitle = b.trophyRelicId === 'trophy_sugar_bandit' 
                ? '👑 Golden Candy Crown' 
                : b.trophyRelicId === 'trophy_plaque_kraken' 
                  ? '🐙 Pearly Goblet' 
                  : '🛡️ Enamel Shield Crest';

              return `
                <div data-boss-id="${b.id}" class="boss-select-card cursor-pointer relative bg-slate-900/90 rounded-3xl p-4 border-3 transition-all duration-200 ${isSelected ? (b.accentBorder || 'border-cyan-400') + ' scale-[1.02] shadow-xl shadow-cyan-500/20 bg-gradient-to-b ' + (b.gradient || 'from-cyan-900/30 to-slate-900') : 'border-slate-800 hover:border-slate-600'} flex flex-col justify-between gap-3">
                  
                  ${isSelected ? `
                    <div class="absolute -top-3 -right-2 bg-cyan-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">check</span> READY
                    </div>
                  ` : ''}

                  ${isParentCrafted ? `
                    <div class="absolute -top-3 left-3 bg-purple-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <span>✨</span> PARENT AI BOSS
                    </div>
                  ` : ''}

                  <div class="flex items-center gap-3 mt-1">
                    <div class="w-14 h-14 rounded-2xl bg-black/50 border border-white/15 flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                      ${b.emoji || b.avatar || '👾'}
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="font-headline text-base font-black text-white leading-tight truncate">${b.name}</h3>
                      <span class="text-[10px] font-bold text-slate-400 block mt-0.5 truncate">${b.title || 'Hygiene Boss'}</span>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[9px] font-black uppercase text-amber-400 tracking-wider">${durationSec}s Timer</span>
                        ${b.splineUrl ? '<span class="text-[9px] font-black text-purple-400 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-500/40">3D Spline</span>' : ''}
                      </div>
                    </div>
                  </div>

                  <p class="text-xs text-slate-300 line-clamp-2 leading-relaxed">${b.desc || b.description || 'Defeat this boss with gentle, thorough brushing!'}</p>

                  <!-- Boss Stats Box -->
                  <div class="bg-black/40 rounded-2xl p-2.5 border border-white/10 flex flex-col gap-1 text-[10px]">
                    <div class="flex justify-between items-center text-slate-300">
                      <span>🛡️ Boss Shield:</span>
                      <span class="font-bold text-amber-300">${b.shieldName || 'Biofilm Barrier'}</span>
                    </div>
                    <div class="flex justify-between items-center text-slate-300">
                      <span>💣 Attack Type:</span>
                      <span class="font-bold text-rose-300">${b.bombName || b.attackName || 'Sugar Bomb'}</span>
                    </div>
                    <div class="flex justify-between items-center text-slate-300 border-t border-white/10 pt-1 mt-0.5">
                      <span>🏆 3D Trophy Relic:</span>
                      <span class="font-bold text-cyan-300 truncate max-w-[140px]">${trophyTitle}</span>
                    </div>
                  </div>

                  <!-- Rewards Footer -->
                  <div class="flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-bold text-slate-300">
                    <span class="text-cyan-400 font-black">+${b.rewardCoins || 50} 🪙 Coins</span>
                    <span class="text-amber-400 font-black">+${b.rewardSparks || 15} ⚡ Sparks</span>
                    <span class="text-emerald-400 font-black">+${b.rewardXP || 75} XP</span>
                  </div>

                  ${isSelected ? `
                    <button data-launch-boss-id="${b.id}" class="boss-card-launch-btn w-full mt-1 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-headline font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all">
                      <span class="material-symbols-outlined text-sm font-bold">swords</span> Battle ${b.name} Now!
                    </button>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- START 3D COCKPIT ACTION CONTAINER -->
        <div class="bg-slate-900/90 rounded-3xl p-4 sm:p-5 border-2 border-cyan-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 card-shadow">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center text-2xl">
              ${currentBoss.emoji || currentBoss.avatar || '👾'}
            </div>
            <div>
              <div class="text-xs text-slate-400 font-bold">Encounter Selected:</div>
              <div class="font-headline text-base font-black text-white">${currentBoss.name}</div>
              <div class="text-[10px] text-cyan-400 font-bold">
                ${currentBoss.battleDurationSec || 120}s Routine • Hands-Free Sensor Fusion • Deflect Shield Ready
              </div>
            </div>
          </div>

          <button id="start-ar-battle-btn" class="w-full sm:w-auto bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-headline text-base font-black px-8 py-4 min-h-[54px] rounded-2xl shadow-[0_6px_0_0_#0891b2] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl">swords</span> ENTER 3D BATTLE COCKPIT!
          </button>
        </div>

        <!-- Plaque Buster Badges Info Card -->
        <div class="bg-slate-900/90 rounded-3xl p-4 border-2 border-slate-800 card-shadow">
          <h3 class="font-headline text-xs font-black uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-cyan-400">military_tech</span> Plaque Buster Collectible Badges:
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            ${badges.map(b => `
              <div class="bg-slate-800/80 rounded-2xl p-3 border ${b.unlocked ? 'border-cyan-400/50 bg-cyan-950/20' : 'border-slate-700/60 opacity-70'} flex flex-col gap-1">
                <div class="flex items-center justify-between">
                  <span class="text-xl">${b.icon}</span>
                  <span class="text-[9px] font-black uppercase ${b.unlocked ? 'text-cyan-400' : 'text-slate-400'}">${b.unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
                </div>
                <div class="font-headline text-xs font-black text-white leading-tight mt-1">${b.name}</div>
                <div class="text-[10px] text-slate-300 leading-snug">${b.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Safety fallback for Victory Modal -->
        ${renderVictoryModal(colState, currentBoss)}

      </div>
    `;
  }

  // =========================================================================
  // 2. ACTIVE KID-ERGONOMIC BATTLE COCKPIT (DURING BATTLE)
  // High-contrast, readable from 4-6 feet in bathroom, interactive 3D mouth map
  // =========================================================================
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
  const isSupernovaReady = (colState.choreSupernovaCharge || 0) >= 40;

  return `
    <div class="w-full h-full min-h-[calc(100vh-80px)] flex flex-col justify-between bg-[#070f17] text-slate-100 font-body select-none overflow-hidden relative animate-fade-in">
      
      <!-- ================= TOP HUD: GIANT TIMER & BOSS HP ================= -->
      <header class="w-full z-40 bg-[#050e16]/95 backdrop-blur-md border-b-4 border-[#1e293b] px-3 sm:px-4 py-2 flex flex-col gap-2 shrink-0 shadow-2xl">
        <div class="flex items-center justify-between gap-2 sm:gap-4 max-w-6xl mx-auto w-full">
          
          <!-- Back / Exit Button -->
          <button id="battle-quit-btn" class="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-[#0f172a] border-2 border-[#334155] text-cyan-400 shadow-[0_4px_0_0_#020617] hover:bg-[#1e293b] active:scale-95 transition-all flex-shrink-0" title="Exit Battle">
            <span class="material-symbols-outlined text-2xl font-bold">arrow_back</span>
          </button>

          <!-- Boss Banner & Star Shield Tier -->
          <div class="flex-1 max-w-md flex flex-col">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-xl sm:text-2xl">${currentBoss.emoji || currentBoss.avatar || '👾'}</span>
                <span class="font-headline font-black text-xs sm:text-sm tracking-wide text-[#ffb961] uppercase truncate">
                  ${currentBoss.name}
                </span>
              </div>
              <!-- 3 Shield Stars -->
              <div class="flex items-center gap-1 flex-shrink-0 ml-1">
                <span id="shield-star-1" class="text-sm ${colState.shieldMilestonesTriggered?.[90] ? 'text-slate-600' : 'text-[#ffb961] drop-shadow-[0_0_6px_#ffb961]'}">★</span>
                <span id="shield-star-2" class="text-sm ${colState.shieldMilestonesTriggered?.[30] ? 'text-slate-600' : 'text-[#ffb961] drop-shadow-[0_0_6px_#ffb961]'}">★</span>
                <span id="shield-star-3" class="text-sm text-[#ffb961] drop-shadow-[0_0_6px_#ffb961]">★</span>
              </div>
            </div>

            <!-- Boss Health Bar -->
            <div class="w-full bg-[#0b1320] h-4 rounded-full p-0.5 border-2 border-[#334155] relative shadow-inner overflow-hidden mt-0.5">
              <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.8)]" style="width: ${hpPercent}%;"></div>
              <div class="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/2 pointer-events-none"></div>
            </div>

            ${colState.isShieldActive ? `
              <div class="flex justify-between items-center text-[9px] font-black text-amber-300 bg-amber-950/90 px-2 py-0.5 rounded-full border border-amber-500/60 mt-1 animate-pulse">
                <span>🛡️ ${currentBoss.shieldName || 'Shield'}: ${colState.shieldHp}/${colState.maxShieldHp || 8} HP</span>
                <span>BRUSH FAST OR ANSWER TO SHATTER! 💥</span>
              </div>
            ` : ''}
          </div>

          <!-- GIANT HIGH-CONTRAST BATHROOM TIMER (Readable 4-6 feet away) -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Laser Toothbrush Glow Badge -->
            ${hasLaserSword ? `
              <div class="hidden md:flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-400/60 px-2.5 py-1 rounded-xl shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-pulse">
                <span class="text-cyan-300 text-sm">⚡</span>
                <span class="text-[10px] font-black text-cyan-300 uppercase tracking-tight">Laser +30%</span>
              </div>
            ` : ''}

            <!-- Giant Countdown Timer Display -->
            <div class="bg-[#0b1320] px-4 py-1.5 sm:py-2 rounded-2xl border-3 border-[#ffb961]/60 flex items-center gap-2 shadow-[0_4px_0_0_#020617,0_0_15px_rgba(255,185,97,0.3)]">
              <span class="material-symbols-outlined text-[#ffb961] text-lg sm:text-2xl animate-pulse">timer</span>
              <span id="battle-timer-display" class="font-headline text-xl sm:text-3xl font-black text-[#ffb961] tracking-widest drop-shadow-[0_0_10px_rgba(255,185,97,0.8)]">
                ${timeStr}
              </span>
            </div>
          </div>

        </div>
      </header>

      <!-- ================= CENTER COCKPIT: 3D ARENA + DENTAL ARCH MAP ================= -->
      <main id="cockpit-viewport" class="relative flex-1 w-full overflow-hidden flex flex-col lg:flex-row items-center justify-between p-2 sm:p-4 gap-3 bg-gradient-to-b from-[#070f17] via-[#091522] to-[#050b12]">
        
        <!-- LEFT / MAIN: PURE 3D WEBGL ARENA CANVAS & AR WEBCAM MIRROR -->
        <div class="relative flex-1 w-full h-[320px] sm:h-[420px] lg:h-full rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-2xl flex flex-col items-center justify-center">
          
          <!-- Unified Pure 3D WebGL / Spline Battle Canvas -->
          <canvas id="battle-webgl-canvas" class="absolute inset-0 w-full h-full z-10 block select-none cursor-crosshair"></canvas>

          <!-- Camera Feed for Optical Motion Detection & 3D Video Texture (visually offscreen to keep WebKit decoding active) -->
          <video id="ar-camera-feed" class="absolute pointer-events-none opacity-0 w-px h-px" autoplay playsinline muted></video>

          <!-- DEFLECT FLURRY ALERT BANNER -->
          <div id="deflect-flurry-banner" class="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 opacity-0 scale-90">
            <div class="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-headline font-black text-xs sm:text-sm px-5 py-2 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.9)] border-2 border-white animate-bounce flex items-center gap-2">
              <span class="text-base">💣</span>
              <span>DEFLECT FLURRY! SCRUB FASTER!</span>
              <span class="text-base">🛡️</span>
            </div>
          </div>

          <!-- SPOKEN REX LEARN MICRO-CHALLENGE BANNER -->
          <div id="rex-learn-banner" class="absolute top-16 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none transition-all duration-300 opacity-0 scale-90 max-w-sm w-[92%]">
            <div class="bg-slate-900/95 border-3 border-amber-400 text-white font-headline p-3 rounded-2xl shadow-2xl flex items-center gap-3">
              <span class="text-3xl animate-bounce flex-shrink-0">🦖</span>
              <div class="flex-1 min-w-0">
                <div class="text-[9px] font-black text-amber-400 uppercase tracking-wide">REX LEARN MICRO-QUIZ</div>
                <div id="rex-learn-question-text" class="text-xs font-bold text-slate-100 leading-snug">How many times a day do Little Heroes brush their teeth?</div>
                <div class="text-[9px] font-extrabold text-emerald-400 mt-0.5">SAY YOUR ANSWER OR SCRUB FAST TO SHATTER! 💥</div>
              </div>
            </div>
          </div>

          <!-- PIP AR MAGIC MIRROR (Top-Right of Arena) -->
          <div class="absolute top-3 right-3 z-30 flex flex-col items-end">
            <div id="pip-window" class="w-24 h-28 sm:w-28 sm:h-32 bg-[#050e16]/95 border-2 border-cyan-400 rounded-2xl p-1 shadow-2xl relative flex flex-col overflow-hidden ${showPip ? '' : 'hidden'}">
              <div class="absolute top-1.5 left-2 flex items-center gap-1 z-10">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span class="text-[9px] font-black text-emerald-300 tracking-tighter">AR MIRROR</span>
              </div>
              <div class="w-full h-full bg-[#0b1320] rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
                <canvas id="pip-mirror-canvas" class="w-full h-full object-cover transform -scale-x-100"></canvas>
                <div id="pip-placeholder" class="absolute inset-0 flex flex-col items-center justify-center ${isCameraActive ? 'hidden' : ''}">
                  <span class="material-symbols-outlined text-3xl text-slate-500">face</span>
                  <span class="text-[8px] font-bold text-cyan-400 mt-1">BRUSHING 🪥</span>
                </div>
              </div>
            </div>

            <!-- Mirror Controls -->
            <div class="flex items-center gap-1 mt-1">
              <button id="camera-flip-btn" class="text-[10px] font-bold text-slate-300 bg-[#0b1320]/90 px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-700 flex items-center gap-1 hover:text-cyan-400 active:scale-95 shadow" title="Flip Camera">
                <span class="material-symbols-outlined text-sm">cameraswitch</span> Flip
              </button>
              <button id="pip-toggle-btn" class="text-[10px] font-bold text-slate-300 bg-[#0b1320]/90 px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-700 flex items-center gap-1 hover:text-cyan-400 active:scale-95 shadow">
                <span class="material-symbols-outlined text-sm">flip_camera_ios</span> ${showPip ? 'Hide' : 'Mirror'}
              </button>
            </div>
          </div>

          <!-- REX / PET COMPANION REAL-TIME VOICE COACHING (Bottom-Left) -->
          <div class="absolute bottom-2 left-3 sm:left-4 z-20 flex items-end gap-2 pointer-events-none">
            <div class="relative w-14 h-14 sm:w-16 sm:h-16 bg-[#0b1320]/95 rounded-2xl border-2 border-emerald-400 p-1 shadow-lg flex flex-col items-center justify-center overflow-hidden">
              <span class="text-2xl sm:text-3xl">${activePet.avatar || '🦖'}</span>
              <span class="text-[8px] font-headline font-black text-emerald-300 bg-black/80 px-1.5 py-0.2 rounded-full mt-0.5">
                ${activePet.name || 'REX'}
              </span>
            </div>

            <!-- Dynamic Coaching Speech Bubble -->
            <div class="bg-[#0b1320]/95 border-2 border-emerald-400/70 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-2xl max-w-[200px] sm:max-w-[280px] -mb-1">
              <p id="rex-dialogue-bubble" class="font-headline font-bold text-[10px] sm:text-[11px] text-emerald-300 leading-snug">
                ${currentRexCoachText}
              </p>
            </div>
          </div>

          <!-- Comic Hit Popup Notification -->
          <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
            <span class="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-slate-950 font-headline text-sm sm:text-base font-black px-5 py-2 rounded-full shadow-2xl border-2 border-white scale-125">
              DEFLECTED! 🛡️✨
            </span>
          </div>

        </div>

        <!-- RIGHT / HUD: INTERACTIVE 3D DENTAL ARCH MAP & PLAQUE DISSOLVE ENGINE -->
        <div id="dental-arch-hud-wrapper" class="w-full lg:w-[420px] shrink-0 flex flex-col justify-center">
          ${renderDental3DMap({
            quadrantProgress: quadrantCleanliness,
            activeQuadrant: activeQuad.id,
            containerId: 'dental-3d-map-container'
          })}
        </div>

      </main>

      <!-- ================= SENSOR FUSION INDICATOR STRIP ================= -->
      <div class="w-full z-30 bg-[#050e16]/95 border-t border-b border-slate-800 px-3 py-1.5 flex items-center justify-between max-w-6xl mx-auto text-[10px] font-extrabold text-slate-300">
        
        <!-- Sensor Status Badges -->
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <!-- Optical Camera Motion Sensor -->
          <div id="sensor-camera-badge" class="flex items-center gap-1 px-2 py-0.5 rounded-lg ${isCameraMotionDetected ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
            <span class="w-1.5 h-1.5 rounded-full ${isCameraMotionDetected ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}"></span>
            <span>CAMERA OPTICAL</span>
          </div>

          <!-- Acoustic Microphone Bristle Cadence -->
          <div id="sensor-mic-badge" class="flex items-center gap-1 px-2 py-0.5 rounded-lg ${isMicActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
            <span class="w-1.5 h-1.5 rounded-full ${isMicActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}"></span>
            <span>2.8kHz ACOUSTIC</span>
          </div>

          <!-- Auto-Assist Pulse -->
          <div id="sensor-assist-badge" class="flex items-center gap-1 px-2 py-0.5 rounded-lg ${isAutoAssistPulseActive ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
            <span>⚡</span>
            <span>AUTO-ASSIST RHYTHM</span>
          </div>
        </div>

        <!-- Current Brushing Zone Info -->
        <div class="flex items-center gap-1.5 text-cyan-300 truncate font-black">
          <span>🦷</span>
          <span id="current-zone-status-text" class="truncate">${activeQuad.name} (${activeQuad.zone}/5)</span>
        </div>

      </div>

      <!-- ================= BOTTOM DECK: CHUNKY KID-FRIENDLY TACTILE CONTROLS ================= -->
      <footer class="w-full z-40 bg-[#050e16]/95 backdrop-blur-md border-t-4 border-[#1e293b] px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 shadow-2xl flex flex-col gap-2">
        
        <div class="flex items-center justify-between gap-2 sm:gap-3 max-w-lg mx-auto w-full">
          
          <!-- Rapid-Foam Blaster Button -->
          <button id="hero-foam-blast-btn" class="flex-1 flex flex-col items-center justify-center py-2.5 px-2 min-h-[56px] rounded-2xl bg-[#0f172a] border-3 border-cyan-400 text-cyan-400 shadow-[0_6px_0_0_#0891b2] hover:bg-[#1e293b] active:translate-y-1 active:shadow-none transition-all">
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined text-xl sm:text-2xl">water_bottle</span>
              <span class="font-headline font-black text-xs sm:text-sm tracking-wide">FOAM BLAST</span>
            </div>
            <span class="text-[9px] font-bold text-slate-400 mt-0.5">Rapid Scrub ⚡</span>
          </button>

          <!-- Giant Chunky DEFLECT! Button -->
          <button id="hero-deflect-btn" class="flex-[1.3] flex flex-col items-center justify-center py-3 sm:py-3.5 px-3 sm:px-4 min-h-[58px] rounded-2xl bg-emerald-500 border-3 border-emerald-300 text-slate-950 font-headline font-black shadow-[0_8px_0_0_#047857,0_10px_20px_rgba(16,185,129,0.4)] hover:brightness-110 active:translate-y-1.5 active:shadow-[0_2px_0_0_#047857] transition-all">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-2xl text-slate-950 font-black">shield</span>
              <span class="text-sm sm:text-base tracking-wider uppercase text-slate-950">DEFLECT! 🛡️</span>
            </div>
            <span class="text-[9px] sm:text-[10px] font-black text-slate-900 uppercase tracking-tighter">Bounces Sugar Bombs</span>
          </button>

          <!-- CHORE SUPERNOVA Mega-Bubble Button -->
          <button id="hero-supernova-btn" class="flex-1 flex flex-col items-center justify-center py-2.5 px-2 min-h-[56px] rounded-2xl ${isSupernovaReady ? 'bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-300 shadow-[0_6px_0_0_#b45309] animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-400 shadow-[0_4px_0_0_#1e293b]'} border-3 font-headline font-black active:translate-y-1 active:shadow-none transition-all">
            <div class="flex items-center gap-1">
              <span class="text-base">⭐</span>
              <span class="font-black text-xs sm:text-sm tracking-tight text-slate-950 uppercase">SUPERNOVA</span>
            </div>
            <span class="text-[9px] font-extrabold text-slate-900 mt-0.5">${isSupernovaReady ? 'READY TO BLAST!' : 'Scrub to Charge'}</span>
          </button>

        </div>

        <!-- Secondary Controls: Pause, Rhythm Guide, Quit -->
        <div class="flex flex-wrap items-center justify-between gap-1.5 max-w-lg mx-auto w-full text-xs text-slate-400 font-bold px-1">
          <button id="battle-pause-btn" class="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl bg-slate-800/80 border border-slate-700 hover:text-white active:scale-95">
            <span class="material-symbols-outlined text-sm">${isBattlePaused ? 'play_arrow' : 'pause'}</span>
            <span>${isBattlePaused ? 'Resume' : 'Pause (Rinse/Spit)'}</span>
          </button>

          <button id="rhythm-toggle-btn" class="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl bg-slate-800/80 border border-slate-700 hover:text-cyan-400 active:scale-95">
            <span class="material-symbols-outlined text-sm">music_note</span>
            <span>${isRhythmBeatActive ? 'Rhythm: ON' : 'Rhythm: OFF'}</span>
          </button>

          <button id="battle-quit-footer-btn" class="flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl bg-slate-800/80 border border-slate-700 hover:text-rose-400 active:scale-95 text-slate-400">
            <span class="material-symbols-outlined text-sm">close</span>
            <span>Quit</span>
          </button>
        </div>

      </footer>

      <!-- ================= VICTORY MODAL: SUGAR VILLAIN CLEANSED ================= -->
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
      : "Cavity Knight's Enamel Shield Crest";

  return `
    <div id="colosseum-victory-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-sm bg-[#0b1320] border-4 border-emerald-400 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">
        
        <!-- Top Trophy Sparkle Icon -->
        <div class="w-20 h-20 rounded-full bg-emerald-500/20 border-3 border-emerald-400 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
          <span class="text-4xl">🏆</span>
        </div>

        <!-- Main Headline -->
        <h2 class="font-headline font-black text-xl sm:text-2xl text-emerald-400 tracking-tight uppercase">
          VILLAIN CLEANSED! 🎉
        </h2>
        <p class="font-headline font-bold text-xs text-slate-300 mt-1">
          ${reward.bossName} transformed into ${reward.cleansedTitle}!
        </p>

        <!-- Unlocked 3D Trophy Relic Spotlight -->
        <div class="w-full bg-slate-950/90 rounded-2xl p-3 border-2 border-amber-400/50 flex flex-col items-center gap-1 my-3 shadow-inner">
          <span class="text-[9px] font-black uppercase text-amber-400 tracking-wider">🌟 UNLOCKED 3D HQ TROPHY RELIC</span>
          <span class="font-headline font-black text-xs sm:text-sm text-white">${trophyTitle}</span>
          <span class="text-[10px] text-slate-400">Permanently spotlighted in your Hero HQ hideout!</span>
        </div>

        <!-- Loot Reward Box -->
        <div class="w-full bg-slate-950/90 rounded-2xl p-2.5 border-2 border-slate-800 flex items-center justify-around mb-4 shadow-inner">
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">COINS 🪙</span>
            <span class="font-headline font-black text-base text-amber-400">+${reward.coins}</span>
          </div>
          <div class="h-6 w-0.5 bg-slate-800"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">POINTS ⭐</span>
            <span class="font-headline font-black text-base text-cyan-400">+15 (Pending)</span>
          </div>
          <div class="h-6 w-0.5 bg-slate-800"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">SPARKS ⚡</span>
            <span class="font-headline font-black text-base text-emerald-400">+${reward.sparks}</span>
          </div>
        </div>

        <!-- Action Buttons -->
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
// SINGLE ATOMIC MEDIASTREAM INITIALIZATION (CAMERA + MIC FUSION)
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
      // Single atomic getUserMedia for both video (640x480 user facing) and audio
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

      // Pass atomic stream directly to acoustic brush audio analyzer
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

    // Deflect flurry check
    if (isDeflectFlurryActive && cadenceScore >= 45) {
      triggerDeflectSuccess();
    }

    // Learn micro-challenge check
    if (isLearnChallengeActive && cadenceScore >= 55) {
      resolveLearnChallenge(true, 'cadence');
    }
  }
  updateSensorBadges();
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

// Lightweight optical motion tracker comparing mirrored luminance changes across 64x48 thumbnail
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
      // Draw mirrored so pixel coordinates match mirrored bathroom perspective
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
        for (let i = 0; i < data.length; i += 8) { // sample every other pixel
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

        // Sample active quadrant ROI specifically for precision mouth tracking
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

          // Deflect flurry requires scrubbing faster (higher velocity threshold)
          if (isDeflectFlurryActive && (motionRatio >= 0.16 || roiRatio >= 0.16)) {
            triggerDeflectSuccess();
          }

          // Learn challenge check (vigorous scrubbing option)
          if (isLearnChallengeActive && (motionRatio >= 0.18 || roiRatio >= 0.18)) {
            resolveLearnChallenge(true, 'cadence');
          }
        } else {
          isCameraMotionDetected = false;
        }
        updateSensorBadges();
      }
      prevFrameData = data;
    }
  }, 100); // 10 FPS is ultra-responsive, low CPU
}

function updateSensorBadges() {
  const camBadge = document.getElementById('sensor-camera-badge');
  if (camBadge) {
    camBadge.className = `flex items-center gap-1 px-2 py-0.5 rounded-lg ${isCameraMotionDetected ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`;
    const dot = camBadge.querySelector('span');
    if (dot) dot.className = `w-1.5 h-1.5 rounded-full ${isCameraMotionDetected ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`;
  }

  const micBadge = document.getElementById('sensor-mic-badge');
  if (micBadge) {
    micBadge.className = `flex items-center gap-1 px-2 py-0.5 rounded-lg ${isMicActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`;
    const dot = micBadge.querySelector('span');
    if (dot) dot.className = `w-1.5 h-1.5 rounded-full ${isMicActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`;
  }

  const assistBadge = document.getElementById('sensor-assist-badge');
  if (assistBadge) {
    assistBadge.className = `flex items-center gap-1 px-2 py-0.5 rounded-lg ${isAutoAssistPulseActive ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`;
  }
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
  // Deal deflect damage and register shield deflection in store economy
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

  const question = "Rex Learn Challenge: How many times a day do Little Heroes brush their teeth? Say your answer or scrub fast!";
  currentRexCoachText = question;
  updateRexDialogue();

  // Wait for the synthesized voice prompt to finish before opening the mic listener,
  // preventing the microphone from picking up the device's own speech output!
  let recognitionStarted = false;
  const startSafeListening = () => {
    if (!recognitionStarted && isLearnChallengeActive) {
      recognitionStarted = true;
      startSpeechRecognition();
    }
  };

  voicePrompts.speak(question, startSafeListening);
  setTimeout(startSafeListening, 2400); // safety fallback

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
  // Deal critical learn damage to boss and charge Supernova
  colState.currentHp = Math.max(1, colState.currentHp - 15);
  colState.choreSupernovaCharge = Math.min(100, (colState.choreSupernovaCharge || 0) + 15);
  hanaBattle3DService.onArmorFracture('shield');
  hanaBattle3DService.updateState({ shieldActive: false, bossHp: colState.currentHp });

  if (method === 'voice') {
    currentRexCoachText = "CRITICAL HIT! That's right! You brush twice a day! Barrier shattered!";
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

  // Reset quadrant cleanliness to 0
  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };
  lastProgressTimestamp = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };

  // Init Colosseum State in Store
  store.initColosseumBattle(selectedBossId, totalDuration);

  // Audio & Hardware Sensor Fusion Init
  Sound.startBattleRhythm();
  initSensors();

  // Start Auto-Assist Fallback Pulse (Ensures steady progress for young kids)
  if (autoAssistInterval) clearInterval(autoAssistInterval);
  autoAssistInterval = setInterval(() => {
    if (!isBattleRunning || isBattlePaused) return;
    const now = Date.now();
    if (now - lastScrubTimestamp > 1800) {
      isAutoAssistPulseActive = true;
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleScrubHit(activeQuad, 'assist');
      setTimeout(() => { isAutoAssistPulseActive = false; updateSensorBadges(); }, 400);
    }
  }, 1000);

  // Periodic Caramel Bomb Attack Timer (Every 14 seconds)
  if (bombTimer) clearInterval(bombTimer);
  bombTimer = setInterval(() => {
    if (isBattleRunning && !isBattlePaused && secondsRemaining > 10) {
      triggerDeflectFlurry();
    }
  }, 14000);

  // Companion Initial Voice Cue
  const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  currentRexCoachText = initialQuad.coachMessage || 'Get ready! Scrub in gentle circles on your top right teeth!';
  voicePrompts.speak(`Battle start! ${initialQuad.coachMessage || ''}`);

  // Notify store to render cockpit
  store.notify();

  // Initialize Dental 3D Map Canvas foam engine after mount
  setTimeout(() => {
    initDental3DMap('dental-3d-map-container');
    updateDental3DMapProgress(quadrantCleanliness, initialQuad.id, false, checkLaserToothbrushEquipped());
  }, 100);

  // 1 Hz Countdown Battle Loop
  if (battleTimer) clearInterval(battleTimer);
  battleTimer = setInterval(() => {
    if (isBattlePaused) return;

    secondsRemaining--;
    const elapsedSeconds = totalDuration - secondsRemaining;

    // Sync timer progress with store
    store.updateColosseumTimer(secondsRemaining, totalDuration);

    // Timer string update
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

    // Quadrant transitions based on fractional duration
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

    // Mirror video to PIP canvas
    updatePipCanvas();

    // WIN CONDITION (Timer reaches zero)
    if (secondsRemaining <= 0) {
      concludeVictory();
    }
  }, 1000);
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

// Scrub Hit Handler: Updates cleanliness, triggers 3D foam streams, checks armor fractures & gear buff
function handleScrubHit(activeQuad, source = 'manual') {
  if (isBattlePaused || !isBattleRunning) return;

  totalScrubHits++;
  lastScrubTimestamp = Date.now();
  currentCombo = Math.min(50, currentCombo + 1);

  const hasLaser = checkLaserToothbrushEquipped();
  const scrubMultiplier = hasLaser ? 1.3 : 1.0;

  // Pet gear damage boost multiplier
  const hero = store.getState().selectedHero;
  const activePet = store.getActivePet ? store.getActivePet() : null;
  const petId = activePet?.id || hero?.activePetId || 1;
  const petBuffs = store.getActivePetGearBuffs ? store.getActivePetGearBuffs(petId) : { damage_boost: 0, defense_boost: 0 };
  const damageBoost = petBuffs.damage_boost || 0;

  // Advance quadrant cleanliness (paced to ~24s full quadrant routine duration)
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

  // Update Interactive 3D Dental Map HUD
  updateDental3DMapProgress(quadrantCleanliness, zoneId, true, hasLaser);

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

  const supernovaBtn = document.getElementById('hero-supernova-btn');
  if (supernovaBtn) {
    const isCharged = (colState.choreSupernovaCharge || 0) >= 40;
    if (isCharged) {
      supernovaBtn.className = 'flex-1 flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 border-3 border-amber-300 text-slate-950 font-headline font-black shadow-[0_6px_0_0_#b45309] active:translate-y-1 active:shadow-none transition-all animate-pulse';
      const label = supernovaBtn.querySelector('span:last-child');
      if (label) label.textContent = 'READY TO BLAST!';
    }
  }

  const star1 = document.getElementById('shield-star-1');
  if (star1) {
    star1.className = `text-sm ${colState.shieldMilestonesTriggered?.[90] ? 'text-slate-600' : 'text-[#ffb961] drop-shadow-[0_0_6px_#ffb961]'}`;
  }
  const star2 = document.getElementById('shield-star-2');
  if (star2) {
    star2.className = `text-sm ${colState.shieldMilestonesTriggered?.[30] ? 'text-slate-600' : 'text-[#ffb961] drop-shadow-[0_0_6px_#ffb961]'}`;
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

  // Stop active rhythms and sensors while keeping victory cockpit alive
  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopSensors();
  secondsRemaining = 0;
  isBattlePaused = true;
  // Keep isBattleRunning = true while victory modal is displayed so the cleansed 3D arena remains visible!

  // Trigger 3D Cleanse Victory Transformation Sequence
  hanaBattle3DService.onCleanseVictory();

  const boss = getBattleBoss(selectedBossId);
  const avgCadence = cadenceSamples.length > 0
    ? Math.round(cadenceSamples.reduce((a, b) => a + b, 0) / cadenceSamples.length)
    : 85;

  voicePrompts.speakBossDefeated(boss.name);

  // Single Atomic Victory State Transition in Store
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
  destroyDental3DMap();
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
  store.navigate('dashboard');
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
  // 1. Pre-Battle Boss Selection Cards
  document.querySelectorAll('.boss-select-card').forEach(card => {
    card.addEventListener('click', () => {
      const bId = card.getAttribute('data-boss-id');
      if (bId) {
        selectedBossId = bId;
        if (store.setSelectedBossId) store.setSelectedBossId(bId);
        Sound.tap();
        store.notify();
      }
    });
  });

  document.querySelectorAll('.boss-card-launch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bId = btn.getAttribute('data-launch-boss-id');
      if (bId) {
        selectedBossId = bId;
        if (store.setSelectedBossId) store.setSelectedBossId(bId);
      }
      startBattle();
    });
  });

  const lobbyBackBtn = document.getElementById('battle-lobby-back-btn');
  if (lobbyBackBtn) {
    lobbyBackBtn.addEventListener('click', () => {
      store.navigate('dashboard');
    });
  }

  const forceReloadBtn = document.getElementById('battle-force-reload-btn');
  if (forceReloadBtn) {
    forceReloadBtn.addEventListener('click', () => {
      Sound.tap();
      if (typeof window.forceAppHardRefresh === 'function') {
        window.forceAppHardRefresh();
      } else {
        window.location.reload();
      }
    });
  }

  const startBtn = document.getElementById('start-ar-battle-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startBattle);
  }

  const topStartBtn = document.getElementById('top-start-ar-battle-btn');
  if (topStartBtn) {
    topStartBtn.addEventListener('click', startBattle);
  }

  // 2. Active Cockpit Header Controls
  const quitBtn = document.getElementById('battle-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', quitBattle);
  }

  const quitFooterBtn = document.getElementById('battle-quit-footer-btn');
  if (quitFooterBtn) {
    quitFooterBtn.addEventListener('click', quitBattle);
  }

  // 3. Tactile Action Buttons (Foam Blast, Deflect, Supernova)
  const foamBlastBtn = document.getElementById('hero-foam-blast-btn');
  if (foamBlastBtn) {
    foamBlastBtn.addEventListener('click', () => {
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleScrubHit(activeQuad, 'manual');
    });
  }

  const deflectBtn = document.getElementById('hero-deflect-btn');
  if (deflectBtn) {
    deflectBtn.addEventListener('click', () => {
      hanaBattle3DService.onDeflectRicochet();
      store.triggerColosseumDeflect();
      showComicHit('DEFLECT ACTIVE! 🛡️');
      syncCockpitHUD();
    });
  }

  const supernovaBtn = document.getElementById('hero-supernova-btn');
  if (supernovaBtn) {
    supernovaBtn.addEventListener('click', () => {
      const res = store.unleashChoreSupernova();
      if (res && res.success) {
        hanaBattle3DService.triggerSupernova();
        showComicHit('SUPERNOVA BLAST! ⭐');
        syncCockpitHUD();
      }
    });
  }

  // 4. Secondary Cockpit Controls (Pause, Rhythm, Camera Flip, Mirror)
  const pauseBtn = document.getElementById('battle-pause-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      isBattlePaused = !isBattlePaused;
      Sound.click();
      if (isBattlePaused) {
        Sound.stopBattleRhythm();
      } else if (isRhythmBeatActive) {
        Sound.startBattleRhythm();
      }
      store.notify();
    });
  }

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
      rhythmBtn.querySelector('span:last-child').textContent = isRhythmBeatActive ? 'Rhythm: ON' : 'Rhythm: OFF';
    });
  }

  const cameraFlipBtn = document.getElementById('camera-flip-btn');
  if (cameraFlipBtn) {
    cameraFlipBtn.addEventListener('click', flipCamera);
  }

  const pipToggleBtn = document.getElementById('pip-toggle-btn');
  if (pipToggleBtn) {
    pipToggleBtn.addEventListener('click', () => {
      store.toggleColosseumPipCam();
      if (!isCameraActive) initSensors();
    });
  }

  // 5. Interactive Quadrant Card Taps on Dental Map
  document.querySelectorAll('.dental-zone-card').forEach(card => {
    card.addEventListener('click', () => {
      const zoneId = card.id.replace('zone-card-', '');
      if (zoneId) {
        Sound.tap();
        handleScrubHit({ id: zoneId, name: zoneId.toUpperCase(), zone: zoneId }, 'manual');
      }
    });
  });

  // 6. Victory Modal Actions
  const visitHqBtn = document.getElementById('colosseum-visit-hq-btn');
  if (visitHqBtn) {
    visitHqBtn.addEventListener('click', () => {
      isBattleRunning = false;
      destroyDental3DMap();
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
      store.navigate('hero_hq');
    });
  }

  const playAgainBtn = document.getElementById('colosseum-play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      isBattleRunning = false;
      destroyDental3DMap();
      hanaBattle3DService.destroy();
      store.closeColosseumVictoryModal();
      startBattle();
    });
  }

  // 7. Mount Pure 3D WebGL / Spline Arena Engine
  if (isBattleRunning) {
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
        videoElement: document.getElementById('ar-camera-feed')
      });
    }
  }
}
