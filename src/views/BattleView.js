import { BossColosseumCanvas } from '../components/BossColosseumCanvas.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import { voicePrompts } from '../utils/voicePrompts.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, DENTAL_QUADRANTS, getHygieneBoss, getDentalQuadrant } from '../data/hygieneBossesData.js';
import { brushAudioAnalyzer } from '../audio/brushAudioAnalyzer.js';

const sugarVillainEscapedImg = new URL('../assets/sugar_villain_escaped.jpg', import.meta.url).href;

// =========================================================================
// 3D HYGIENE BOSS BLASTER COLOSSEUM 2.0 (STITCH + CANVAS ENGINE)
// Boss Blaster Arena with Candy Ruins, Auto-Aim Foam, Shield Deflections & PIP
// =========================================================================

// Battle State Variables
let selectedBossId = 'sugar_bandit';
let battleTimer = null;
let secondsRemaining = 120;
let totalDuration = 120;
let isBattleRunning = false;
let videoStream = null;
let isCameraActive = false;
let cameraError = null;
let activeColosseumCanvas = null;

// Dual-Sensor State: Optical Motion + Acoustic Mic Cadence
let motionCanvas = null;
let motionCtx = null;
let prevFrameData = null;
let motionCheckInterval = null;
let isToothbrushMoving = false;
let totalMotionHits = 0;
let lastMotionTimestamp = 0;
let isFallbackActive = false;
let currentCombo = 0;
let micCadenceScore = 0;
let cadenceSamples = [];
let isMicActive = false;

// Quadrant Cleanliness Progress (0 to 100% per quadrant)
let quadrantCleanliness = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0
};

// Dynamic Shield & Coaching Text
let currentRexCoachText = 'Swipe up or tap to blast minty foam! Swipe down to deflect!';

// =========================================================================
// MAIN BATTLE VIEW RENDER FUNCTION
// =========================================================================
export function renderBattleView() {
  const currentBoss = getHygieneBoss(selectedBossId) || HYGIENE_BOSSES[0];
  const badges = store.getDentalBadges ? store.getDentalBadges() : DENTAL_BADGES;
  const colState = store.getBossColosseumState ? store.getBossColosseumState() : {};

  if (!isBattleRunning) {
    // =========================================================================
    // LOBBY & BOSS SELECTION SCREEN (PRE-BATTLE)
    // =========================================================================
    return `
      <div class="max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-4 animate-fade-in select-none">
        
        <!-- HEADER -->
        <div class="flex items-center justify-between">
          <button id="battle-lobby-back-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
            <span class="material-symbols-outlined text-base">arrow_back</span> Back to Hub
          </button>
          
          <div class="flex items-center gap-2">
            <span class="text-xs font-black text-primary bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-full flex items-center gap-1">
              <span>🦷</span> 4 Quadrants (120s)
            </span>
            <span class="text-xs font-black text-secondary bg-secondary/10 border border-secondary/30 px-3 py-1.5 rounded-full flex items-center gap-1">
              <span>⚡</span> +15 Sparks
            </span>
          </div>
        </div>

        <!-- TITLE HERO CARD -->
        <div class="bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-highest rounded-3xl p-5 border-2 border-surface-container-highest card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-3xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-4xl shadow-inner flex-shrink-0">
              ⚔️
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="bg-primary text-on-primary text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">3D Colosseum 2.0</span>
                <span class="text-xs font-bold text-on-surface-variant">Dentist Approved</span>
              </div>
              <h1 class="font-headline text-xl sm:text-2xl font-black text-on-surface mt-1">Hygiene Boss Blaster Colosseum</h1>
              <p class="text-xs text-on-surface-variant mt-0.5 max-w-md">Choose your villain, enter the 3D Candy Kingdom Ruins, deflect sugar bombs, and cleanse the arena with rapid mint foam!</p>
            </div>
          </div>

          <!-- Quick Badges Preview -->
          <div class="flex items-center gap-1.5 bg-black/20 p-2 rounded-2xl border border-white/10">
            ${badges.slice(0, 4).map(b => `
              <div class="w-9 h-9 rounded-xl ${b.unlocked ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-container-lowest/50 border-white/10 text-white/40 grayscale'} border flex items-center justify-center text-base" title="${b.name}: ${b.desc}">
                ${b.icon}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- BOSS SELECTION CARDS -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-sm font-black uppercase tracking-wider text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-base text-primary">swords</span> Select Hygiene Boss Encounter:
            </h2>
            <span class="text-xs text-on-surface-variant">Tap to choose</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${HYGIENE_BOSSES.map(b => {
              const isSelected = b.id === selectedBossId;
              const trophyPreview = b.trophyRelicId === 'trophy_sugar_bandit' 
                ? '👑 Golden Candy Crown' 
                : b.trophyRelicId === 'trophy_plaque_kraken' 
                  ? '🐙 Pearly Goblet' 
                  : '🛡️ Enamel Shield Crest';

              return `
                <div data-boss-id="${b.id}" class="boss-select-card cursor-pointer relative bg-surface-container-high rounded-3xl p-4 border-4 transition-all duration-200 ${isSelected ? (b.accentBorder || 'border-primary') + ' bg-gradient-to-b ' + b.gradient + ' scale-[1.02] shadow-xl' : 'border-surface-container-highest hover:border-white/30'} flex flex-col justify-between gap-3">
                  
                  ${isSelected ? `
                    <div class="absolute -top-3 -right-2 bg-primary text-on-primary text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">check</span> READY
                    </div>
                  ` : ''}

                  <div class="flex items-center gap-3">
                    <div class="w-14 h-14 rounded-2xl bg-black/40 border border-white/15 flex items-center justify-center text-3xl shadow-md">
                      ${b.avatar}
                    </div>
                    <div>
                      <h3 class="font-headline text-base font-black text-on-surface leading-tight">${b.name}</h3>
                      <span class="text-[10px] font-bold text-on-surface-variant block mt-0.5">${b.title}</span>
                      <span class="text-[9px] font-black uppercase text-secondary tracking-wider">${b.difficulty}</span>
                    </div>
                  </div>

                  <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">${b.description}</p>

                  <!-- 3D Boss Stats & Trophy Unlock Preview -->
                  <div class="bg-black/30 rounded-2xl p-2.5 border border-white/10 flex flex-col gap-1 text-[10px]">
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span>🛡️ Boss Shield:</span>
                      <span class="font-bold text-amber-300">${b.shieldName}</span>
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span>💣 Sugar Attack:</span>
                      <span class="font-bold text-rose-300">${b.bombName || b.attackName}</span>
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant border-t border-white/10 pt-1 mt-0.5">
                      <span>🏆 HQ Trophy Relic:</span>
                      <span class="font-bold text-primary truncate max-w-[140px]">${trophyPreview}</span>
                    </div>
                  </div>

                  <div class="flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-bold text-on-surface-variant">
                    <span class="text-primary font-black">+50 🪙 Coins</span>
                    <span class="text-secondary font-black">+15 ⚡ Sparks</span>
                    <span class="text-accent font-black">+75 XP</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- START 3D ARENA ACTION CONTAINER -->
        <div class="bg-surface-container-high rounded-3xl p-4 sm:p-5 border-2 border-surface-container-highest flex flex-col sm:flex-row items-center justify-between gap-4 card-shadow">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-2xl">
              ${currentBoss.avatar}
            </div>
            <div>
              <div class="text-xs text-on-surface-variant font-bold">Selected Encounter:</div>
              <div class="font-headline text-base font-black text-on-surface">${currentBoss.name}</div>
              <div class="text-[10px] text-primary font-bold">Auto-Aim Rapid Blaster • Deflection Shield Ready</div>
            </div>
          </div>

          <button id="start-ar-battle-btn" class="w-full sm:w-auto bg-primary text-on-primary font-headline text-base font-black px-8 py-4 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl">swords</span> ENTER 3D COLOSSEUM ARENA!
          </button>
        </div>

        <!-- Plaque Buster Badges Info Card -->
        <div class="bg-surface-container rounded-3xl p-4 border-2 border-surface-container-highest card-shadow">
          <h3 class="font-headline text-xs font-black uppercase tracking-wider text-on-surface mb-3 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-base text-primary">military_tech</span> Plaque Buster Collectible Badges:
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            ${badges.map(b => `
              <div class="bg-surface-container-high rounded-2xl p-3 border ${b.unlocked ? 'border-primary/40 bg-primary/10' : 'border-surface-container-highest opacity-75'} flex flex-col gap-1">
                <div class="flex items-center justify-between">
                  <span class="text-xl">${b.icon}</span>
                  <span class="text-[9px] font-black uppercase ${b.unlocked ? 'text-primary' : 'text-on-surface-variant'}">${b.unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
                </div>
                <div class="font-headline text-xs font-black text-on-surface leading-tight mt-1">${b.name}</div>
                <div class="text-[10px] text-on-surface-variant leading-snug">${b.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
  }

  // =========================================================================
  // ACTIVE 3D COLOSSEUM BATTLE ARENA (DURING BATTLE)
  // Stitch screen 697ce3c050d04a32ab598e7cbe6cd6eb layout
  // =========================================================================
  const elapsed = totalDuration - secondsRemaining;
  const progressRatio = Math.min(1, elapsed / totalDuration);
  const hpPercent = Math.max(0, Math.round(((colState.currentHp || (1 - progressRatio) * 100) / (colState.maxHp || 100)) * 100));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  const showPip = colState.showPipCam || false;
  const ammoPercent = colState.ammoTank || 95;
  const isSupernovaReady = (colState.choreSupernovaCharge || 0) >= 50;

  return `
    <div class="w-full h-full min-h-[calc(100vh-80px)] flex flex-col justify-between bg-[#09141e] text-slate-100 font-body select-none overflow-hidden relative animate-fade-in">
      
      <!-- ================= TOP HUD NAVIGATION BAR ================= -->
      <header class="w-full z-40 bg-[#050f18]/95 backdrop-blur-md border-b-4 border-[#2b3640] px-3 sm:px-4 py-2.5 flex flex-col gap-2 shrink-0 shadow-xl">
        <div class="flex items-center justify-between gap-2 sm:gap-3 max-w-5xl mx-auto w-full">
          
          <!-- Back / Exit Button -->
          <button id="battle-quit-btn" class="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#121d26] border-2 border-[#2b3640] text-[#00d2d3] shadow-[0_4px_0_0_#050f18] hover:bg-[#16212b] active:scale-95 transition-all flex-shrink-0" title="Exit Battle">
            <span class="material-symbols-outlined text-xl sm:text-2xl">arrow_back</span>
          </button>

          <!-- Boss Banner & Star Shield Tier -->
          <div class="flex-1 max-w-md flex flex-col">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-base sm:text-lg">${currentBoss.avatar}</span>
                <span class="font-headline font-black text-xs sm:text-sm tracking-wide text-[#ffb961] uppercase truncate drop-shadow-[0_2px_0_#050f18]">
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
            <div class="w-full bg-[#121d26] h-3.5 sm:h-4 rounded-full p-0.5 border-2 border-[#2b3640] relative shadow-inner overflow-hidden mt-0.5">
              <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-[#f39c12] via-[#e74c3c] to-[#f39c12] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(243,156,18,0.7)]" style="width: ${hpPercent}%;"></div>
              <div class="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/2 pointer-events-none"></div>
            </div>

            ${colState.isShieldActive ? `
              <div class="flex justify-between items-center text-[9px] font-black text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/50 mt-1 animate-pulse">
                <span>🛡️ ${currentBoss.shieldName}: ${colState.shieldHp}/${colState.maxShieldHp} HP</span>
                <span>DEFLECT OR BLAST TO SHATTER! 💥</span>
              </div>
            ` : ''}
          </div>

          <!-- Minty Foam Ammo Gauge Pill & Timer -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Ammo Tank -->
            <div class="hidden sm:flex items-center gap-2 bg-[#121d26] px-2.5 py-1.5 rounded-2xl border-2 border-[#00d2d3]/40 shadow-[0_4px_0_0_#050f18]">
              <div class="flex flex-col items-end leading-none">
                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">MINT FOAM</span>
                <span id="foam-count" class="font-headline font-extrabold text-xs text-[#00d2d3]">${ammoPercent}%</span>
              </div>
              <div class="w-3 h-6 bg-[#050f18] rounded-full p-0.5 border border-[#2b3640] flex flex-col justify-end overflow-hidden">
                <div id="foam-pill-fill" class="w-full bg-[#00d2d3] rounded-full transition-all duration-300" style="height: ${ammoPercent}%;"></div>
              </div>
            </div>

            <!-- Timer Display -->
            <div class="bg-[#121d26] px-3 py-1.5 rounded-2xl border-2 border-[#ffb961]/50 flex items-center gap-1.5 shadow-[0_4px_0_0_#050f18]">
              <span class="material-symbols-outlined text-[#ffb961] text-base">timer</span>
              <span id="battle-timer-display" class="font-headline text-sm sm:text-base font-black text-[#ffb961] tracking-wider">${timeStr}</span>
            </div>
          </div>

        </div>
      </header>

      <!-- ================= CENTER 3D ARENA VIEWPORT ================= -->
      <main id="arena-viewport" class="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-[#09141e] via-[#0c1b28] to-[#07111a] min-h-[380px] sm:min-h-[460px]">
        
        <!-- Canvas mount container for BossColosseumCanvas engine -->
        <div id="colosseum-canvas-mount" class="absolute inset-0 w-full h-full z-10"></div>

        <!-- Camera Mirror Feed (Hidden for optical motion tracking, mirrored in PIP) -->
        <video id="ar-camera-feed" class="hidden absolute" autoplay playsinline muted></video>

        <!-- PIP MIRROR CAM (Top-Right of Viewport) -->
        <div class="absolute top-3 right-3 z-30 flex flex-col items-end">
          <div id="pip-window" class="w-20 h-24 sm:w-24 sm:h-28 bg-[#050f18]/95 border-2 border-[#00d2d3] rounded-2xl p-1 shadow-2xl relative flex flex-col overflow-hidden ${showPip ? '' : 'hidden'}">
            <div class="absolute top-1.5 left-2 flex items-center gap-1 z-10">
              <span class="w-2 h-2 rounded-full bg-[#2ecc71] animate-ping"></span>
              <span class="text-[9px] font-extrabold text-[#2ecc71] tracking-tighter">AR MIRROR</span>
            </div>
            <div class="w-full h-full bg-[#121d26] rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
              <canvas id="pip-mirror-canvas" class="w-full h-full object-cover transform -scale-x-100"></canvas>
              <div id="pip-placeholder" class="absolute inset-0 flex flex-col items-center justify-center ${isCameraActive ? 'hidden' : ''}">
                <span class="material-symbols-outlined text-3xl text-slate-500">face</span>
                <span class="text-[8px] font-bold text-[#00d2d3] mt-1">BRUSHING 🪥</span>
              </div>
            </div>
          </div>

          <button id="pip-toggle-btn" class="mt-1 text-[10px] font-bold text-slate-300 bg-[#121d26]/90 px-2.5 py-1 rounded-xl border border-[#2b3640] flex items-center gap-1 hover:text-[#00d2d3] active:scale-95 shadow">
            <span class="material-symbols-outlined text-xs">flip_camera_ios</span> ${showPip ? 'Hide Mirror' : 'Magic Mirror 🪞'}
          </button>
        </div>

        <!-- GESTURE BANNER INSTRUCTION PILL (Top-Left) -->
        <div class="absolute top-3 left-3 sm:left-4 z-20 pointer-events-none">
          <div class="bg-[#16212b]/90 backdrop-blur-md px-3 py-1.5 rounded-full border-2 border-[#ffb961]/50 flex items-center gap-2 shadow-[0_4px_0_0_#09141e]">
            <span class="text-[#ffb961] text-xs sm:text-sm animate-bounce">⚡</span>
            <p class="font-headline font-extrabold text-[10px] sm:text-[11px] text-[#ffb961] tracking-tight">
              SWIPE UP: BLAST • SWIPE DOWN: DEFLECT 🛡️
            </p>
          </div>
        </div>

        <!-- REX DINO COMPANION (Foreground Cheering Assist) -->
        <div class="absolute bottom-2 left-3 sm:left-4 z-20 flex items-end gap-2 pointer-events-none">
          <div class="relative w-14 h-14 sm:w-18 sm:h-18 bg-[#121d26]/90 rounded-2xl border-2 border-[#2ecc71] p-1 shadow-lg flex flex-col items-center justify-center overflow-hidden">
            <span class="text-2xl sm:text-3xl">🦖</span>
            <span class="text-[8px] font-headline font-extrabold text-[#54e98a] bg-[#050f18]/90 px-1.5 py-0.2 rounded-full mt-0.5">
              REX
            </span>
          </div>

          <!-- Speech Bubble from Rex -->
          <div class="bg-[#16212b]/95 border-2 border-[#2ecc71]/60 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-xl max-w-[200px] sm:max-w-[260px] -mb-1">
            <p id="rex-dialogue-bubble" class="font-headline font-bold text-[10px] sm:text-[11px] text-[#54e98a] leading-snug">
              ${currentRexCoachText}
            </p>
          </div>
        </div>

        <!-- Comic Hit Popup Notification -->
        <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
          <span class="bg-gradient-to-r from-[#2ecc71] via-[#00d2d3] to-[#2ecc71] text-white font-headline text-sm sm:text-base font-black px-5 py-2 rounded-full shadow-2xl border-2 border-white scale-125">
            DEFLECTED! 🛡️✨
          </span>
        </div>

      </main>

      <!-- ================= BOTTOM DECK & TACTILE CONTROLS ================= -->
      <footer class="w-full z-40 bg-[#050f18]/95 backdrop-blur-md border-t-4 border-[#2b3640] px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 shadow-2xl flex flex-col gap-2">
        
        <!-- Controls Row: Blaster Button, Giant DEFLECT Button, CHORE SUPERNOVA -->
        <div class="flex items-center justify-between gap-2 sm:gap-3 max-w-lg mx-auto w-full">
          
          <!-- Rapid-Foam Blaster Tube Trigger -->
          <button id="hero-foam-blast-btn" class="flex-1 flex flex-col items-center justify-center py-2.5 px-2.5 rounded-2xl bg-[#121d26] border-3 border-[#00d2d3] text-[#00d2d3] shadow-[0_6px_0_0_#008889] hover:bg-[#16212b] active:translate-y-1 active:shadow-none transition-all">
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined text-xl sm:text-2xl">water_bottle</span>
              <span class="font-headline font-black text-xs sm:text-sm tracking-wide">FOAM BLAST</span>
            </div>
            <span class="text-[9px] font-bold text-slate-400 mt-0.5">Rapid Scrub ⚡</span>
          </button>

          <!-- Giant Chunky Green DEFLECT! 🛡️ Button -->
          <button id="hero-deflect-btn" class="flex-[1.3] flex flex-col items-center justify-center py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl bg-[#2ecc71] border-3 border-[#54e98a] text-[#003919] font-headline font-black shadow-[0_8px_0_0_#1b7a43,0_12px_20px_rgba(46,204,113,0.4)] hover:brightness-110 active:translate-y-1.5 active:shadow-[0_2px_0_0_#1b7a43] transition-all">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-2xl text-[#003919] font-extrabold">shield</span>
              <span class="text-sm sm:text-base tracking-wider uppercase text-[#003919]">DEFLECT! 🛡️</span>
            </div>
            <span class="text-[9px] sm:text-[10px] font-extrabold text-[#003919] uppercase tracking-tighter">Bounces Sugar Bombs</span>
          </button>

          <!-- Glowing CHORE SUPERNOVA ⭐ Mega-Bubble Button -->
          <button id="hero-supernova-btn" class="flex-1 flex flex-col items-center justify-center py-2.5 px-2.5 rounded-2xl bg-gradient-to-br from-[#f39c12] to-[#ffb961] border-3 border-[#ffb961] text-[#09141e] font-headline font-black shadow-[0_6px_0_0_#b36b00] hover:brightness-110 active:translate-y-1 active:shadow-none transition-all">
            <div class="flex items-center gap-1">
              <span class="text-base">⭐</span>
              <span class="font-black text-xs sm:text-sm tracking-tight text-[#09141e] uppercase">SUPERNOVA</span>
            </div>
            <span class="text-[9px] font-extrabold text-[#472a00] mt-0.5">Clears All Bombs</span>
          </button>
        </div>

        <!-- Habit Quadrant & Cadence Status Bar -->
        <div class="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 font-bold px-2 max-w-lg mx-auto w-full">
          <div class="flex items-center gap-1.5 truncate">
            <span class="text-sm">${activeQuad.icon}</span>
            <span class="text-[#00d2d3] font-black truncate">Zone ${activeQuad.zone}: ${activeQuad.name}</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span id="sensor-status-label" class="text-slate-300">${isToothbrushMoving ? '🔥 Toothbrush Active!' : '🪥 Sensor Ready'}</span>
            <span class="text-[#ffb961] font-black">+${currentBoss.rewardSparks} Sparks ⚡</span>
          </div>
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
      <div class="w-full max-w-sm bg-[#121d26] border-4 border-[#2ecc71] rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col items-center text-center relative overflow-hidden">
        
        <!-- Top Trophy Sparkle Icon -->
        <div class="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[#2ecc71]/20 border-3 border-[#2ecc71] flex items-center justify-center mb-3 shadow-[0_0_30px_#2ecc71]">
          <span class="text-4xl">🏆</span>
        </div>

        <!-- Main Headline -->
        <h2 class="font-headline font-black text-xl sm:text-2xl text-[#54e98a] tracking-tight drop-shadow-[0_2px_0_#050f18] uppercase">
          VILLAIN CLEANSED! 🎉
        </h2>
        <p class="font-headline font-bold text-xs text-slate-300 mt-1">
          ${reward.bossName} transformed into ${reward.cleansedTitle}!
        </p>

        <!-- Unlocked 3D Trophy Relic Spotlight -->
        <div class="w-full bg-[#050f18]/90 rounded-2xl p-3 border-2 border-[#ffb961]/50 flex flex-col items-center gap-1 my-3 shadow-inner">
          <span class="text-[9px] font-black uppercase text-[#ffb961] tracking-wider">🌟 UNLOCKED 3D HQ TROPHY RELIC</span>
          <span class="font-headline font-black text-xs sm:text-sm text-white">${trophyTitle}</span>
          <span class="text-[10px] text-slate-400">Permanently spotlighted in your Hero HQ hideout!</span>
        </div>

        <!-- Loot Reward Box -->
        <div class="w-full bg-[#050f18]/90 rounded-2xl p-2.5 border-2 border-[#2b3640] flex items-center justify-around mb-4 shadow-inner">
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">COINS</span>
            <span class="font-headline font-black text-base text-[#ffb961] flex items-center gap-0.5">
              <span>+${reward.coins}</span> 🪙
            </span>
          </div>
          <div class="h-6 w-0.5 bg-[#2b3640]"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">HERO XP</span>
            <span class="font-headline font-black text-base text-[#00d2d3] flex items-center gap-0.5">
              <span>+${reward.xp}</span> ⭐
            </span>
          </div>
          <div class="h-6 w-0.5 bg-[#2b3640]"></div>
          <div class="flex flex-col items-center">
            <span class="text-xs text-slate-400 font-bold">SPARKS</span>
            <span class="font-headline font-black text-base text-[#54e98a] flex items-center gap-0.5">
              <span>+${reward.sparks}</span> ⚡
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex flex-col gap-2">
          <button id="colosseum-visit-hq-btn" class="w-full py-3 rounded-2xl bg-[#2ecc71] text-[#003919] font-headline font-black text-sm uppercase tracking-wider shadow-[0_6px_0_0_#1b7a43] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-lg font-bold">apartment</span> VIEW TROPHY IN HERO HQ
          </button>
          
          <button id="colosseum-play-again-btn" class="w-full py-2.5 rounded-2xl bg-[#16212b] text-[#00d2d3] border-2 border-[#2b3640] font-headline font-bold text-xs uppercase hover:bg-[#1f2d3a] active:scale-95 transition-all flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-base">replay</span> BATTLE AGAIN
          </button>
        </div>

      </div>
    </div>
  `;
}

// =========================================================================
// CAMERA INITIALIZATION & PIP MIRROR
// =========================================================================
async function initCamera() {
  const video = document.getElementById('ar-camera-feed');
  const pipCanvas = document.getElementById('pip-mirror-canvas');
  const pipPlaceholder = document.getElementById('pip-placeholder');

  if (videoStream && videoStream.active) {
    if (video) {
      if (video.srcObject !== videoStream) video.srcObject = videoStream;
      video.play().catch(() => {});
    }
    isCameraActive = true;
    if (pipPlaceholder) pipPlaceholder.classList.add('hidden');
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      videoStream = stream;
      isCameraActive = true;
      cameraError = null;

      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      if (pipPlaceholder) pipPlaceholder.classList.add('hidden');
    } catch (err) {
      console.warn('Camera restricted or unavailable; audio & tap fallback enabled.', err);
      isCameraActive = false;
      cameraError = err;
      if (pipPlaceholder) pipPlaceholder.classList.remove('hidden');
    }
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
    isCameraActive = false;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
}

// =========================================================================
// BATTLE LIFECYCLE CONTROLLERS
// =========================================================================
export function startBattle() {
  const boss = getHygieneBoss(selectedBossId);
  isBattleRunning = true;
  secondsRemaining = store.getState().parentSettings?.arBattleDuration || 120;
  totalDuration = secondsRemaining;
  totalMotionHits = 0;
  isFallbackActive = false;
  currentCombo = 0;
  prevFrameData = null;
  cadenceSamples = [];

  // Reset quadrant cleanliness
  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };

  // Init Colosseum State in Store
  store.initColosseumBattle(selectedBossId);

  // Audio & Hardware Init
  Sound.startBattleRhythm();
  initCamera();

  // Initialize Acoustic Microphone Scrub Analyzer
  brushAudioAnalyzer.startListening(({ isScrubbing, cadenceScore }) => {
    micCadenceScore = cadenceScore;
    cadenceSamples.push(cadenceScore);
    isMicActive = isScrubbing;

    if (isScrubbing) {
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleScrubHit(activeQuad);
    }
  });

  // Rex Spoken Cue
  const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  currentRexCoachText = initialQuad.coachMessage || 'Swipe up to blast minty foam! Swipe down to deflect!';
  voicePrompts.speak(`Battle start! ${initialQuad.coachMessage || ''}`);

  // Re-render into active battle arena
  store.notify();

  // 1 Hz Battle Loop
  if (battleTimer) clearInterval(battleTimer);
  battleTimer = setInterval(() => {
    secondsRemaining--;
    const elapsedSeconds = totalDuration - secondsRemaining;

    // Timer string update
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = document.getElementById('battle-timer-display');
    if (timerDisplay) timerDisplay.textContent = timeStr;

    // Quadrant transitions
    if (secondsRemaining === 90) {
      voicePrompts.speak(DENTAL_QUADRANTS[1]?.coachMessage || 'Brush top left teeth!');
      currentRexCoachText = DENTAL_QUADRANTS[1]?.coachMessage || '';
      updateRexDialogue();
    } else if (secondsRemaining === 60) {
      voicePrompts.speak(DENTAL_QUADRANTS[2]?.coachMessage || 'Brush bottom right teeth!');
      currentRexCoachText = DENTAL_QUADRANTS[2]?.coachMessage || '';
      updateRexDialogue();
    } else if (secondsRemaining === 30) {
      voicePrompts.speak(DENTAL_QUADRANTS[3]?.coachMessage || 'Brush bottom left teeth!');
      currentRexCoachText = DENTAL_QUADRANTS[3]?.coachMessage || '';
      updateRexDialogue();
    } else if (secondsRemaining === 10) {
      voicePrompts.speak(DENTAL_QUADRANTS[4]?.coachMessage || 'Polish the tongue!');
      currentRexCoachText = DENTAL_QUADRANTS[4]?.coachMessage || '';
      updateRexDialogue();
    }

    // Mirror video to PIP canvas
    updatePipCanvas();

    // WIN CONDITION (2 Minutes Complete)
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

function handleScrubHit(activeQuad) {
  isToothbrushMoving = true;
  totalMotionHits++;
  lastMotionTimestamp = Date.now();
  currentCombo = Math.min(20, currentCombo + 1);

  if (activeColosseumCanvas) {
    activeColosseumCanvas.fireFoam();
  } else {
    store.fireColosseumBlaster();
  }

  showComicHit('MINTY BLAST! 🫧');
  syncColosseumHUD();
}

function syncColosseumHUD() {
  const colState = store.getBossColosseumState();
  const hpPercent = Math.max(0, Math.round((colState.currentHp / colState.maxHp) * 100));
  
  const hpBar = document.getElementById('boss-hp-bar');
  if (hpBar) hpBar.style.width = `${hpPercent}%`;

  const foamCount = document.getElementById('foam-count');
  const foamFill = document.getElementById('foam-pill-fill');
  if (foamCount) foamCount.textContent = `${colState.ammoTank || 95}%`;
  if (foamFill) foamFill.style.height = `${colState.ammoTank || 95}%`;

  if (colState.currentHp <= 0 && !colState.isVictoryModalOpen) {
    concludeVictory();
  }
}

function concludeVictory() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }

  isBattleRunning = false;
  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopCamera();

  if (activeColosseumCanvas) {
    activeColosseumCanvas.destroy();
    activeColosseumCanvas = null;
  }

  const boss = getHygieneBoss(selectedBossId);
  const avgCadence = cadenceSamples.length > 0
    ? Math.round(cadenceSamples.reduce((a, b) => a + b, 0) / cadenceSamples.length)
    : 85;

  voicePrompts.speakBossDefeated(boss.name);

  // Trigger defeat and show Victory Modal
  store.defeatColosseumBoss();
  store.completeToothbrushBattle(selectedBossId, totalDuration, avgCadence);
}

export function quitBattle() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }

  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopCamera();

  if (activeColosseumCanvas) {
    activeColosseumCanvas.destroy();
    activeColosseumCanvas = null;
  }

  if (isBattleRunning && secondsRemaining > 0) {
    isBattleRunning = false;
    Sound.hit();
    store.showReward(
      'Boss Escaped!',
      'The Hygiene Boss escaped! Brush for the full 2 minutes next time to earn your sparks and trophy!',
      0,
      0,
      sugarVillainEscapedImg,
      'sentiment_dissatisfied'
    );
  }

  isBattleRunning = false;
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
// EVENT LISTENERS & HOOKS
// =========================================================================
export function attachBattleListeners() {
  // 1. Pre-battle boss selection cards
  const bossCards = document.querySelectorAll('.boss-select-card');
  bossCards.forEach(card => {
    card.addEventListener('click', () => {
      const bId = card.getAttribute('data-boss-id');
      if (bId) {
        selectedBossId = bId;
        Sound.tap();
        store.notify();
      }
    });
  });

  const lobbyBackBtn = document.getElementById('battle-lobby-back-btn');
  if (lobbyBackBtn) {
    lobbyBackBtn.addEventListener('click', () => {
      store.navigate('dashboard');
    });
  }

  const startBtn = document.getElementById('start-ar-battle-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startBattle);
  }

  // 2. Active battle controls
  const quitBtn = document.getElementById('battle-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', quitBattle);
  }

  const foamBlastBtn = document.getElementById('hero-foam-blast-btn');
  if (foamBlastBtn) {
    foamBlastBtn.addEventListener('click', () => {
      if (activeColosseumCanvas) activeColosseumCanvas.fireFoam();
      else store.fireColosseumBlaster();
      syncColosseumHUD();
    });
  }

  const deflectBtn = document.getElementById('hero-deflect-btn');
  if (deflectBtn) {
    deflectBtn.addEventListener('click', () => {
      if (activeColosseumCanvas) activeColosseumCanvas.triggerDeflect();
      else store.triggerColosseumDeflect();
      showComicHit('DEFLECT ACTIVE! 🛡️');
      syncColosseumHUD();
    });
  }

  const supernovaBtn = document.getElementById('hero-supernova-btn');
  if (supernovaBtn) {
    supernovaBtn.addEventListener('click', () => {
      if (activeColosseumCanvas) activeColosseumCanvas.triggerSupernova();
      else store.unleashChoreSupernova();
      showComicHit('SUPERNOVA BLAST! ⭐');
      syncColosseumHUD();
    });
  }

  const pipToggleBtn = document.getElementById('pip-toggle-btn');
  if (pipToggleBtn) {
    pipToggleBtn.addEventListener('click', () => {
      store.toggleColosseumPipCam();
      if (!isCameraActive) initCamera();
    });
  }

  // 3. Victory Modal Actions
  const visitHqBtn = document.getElementById('colosseum-visit-hq-btn');
  if (visitHqBtn) {
    visitHqBtn.addEventListener('click', () => {
      store.closeColosseumVictoryModal();
      store.navigate('hero_hq');
    });
  }

  const playAgainBtn = document.getElementById('colosseum-play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      store.closeColosseumVictoryModal();
      startBattle();
    });
  }

  // 4. Initialize 3D Colosseum Canvas Mount
  if (isBattleRunning) {
    const mountEl = document.getElementById('colosseum-canvas-mount');
    if (mountEl) {
      if (activeColosseumCanvas) {
        activeColosseumCanvas.destroy();
      }
      activeColosseumCanvas = new BossColosseumCanvas(mountEl, { bossId: selectedBossId });
    }
  }
}
