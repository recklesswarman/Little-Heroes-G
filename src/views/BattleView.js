import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import sugarVillainEscapedImg from '../assets/sugar_villain_escaped.jpg';
import { voicePrompts } from '../utils/voicePrompts.js';

let battleTimer = null;
let secondsRemaining = 120; // 2 minutes (120s)
let totalDuration = 120;
let isBattleRunning = false;
let videoStream = null;
let isCameraActive = false;
let cameraError = null;

// TOOTHBRUSH MOTION DETECTION ENGINE
let motionCanvas = null;
let motionCtx = null;
let prevFrameData = null;
let motionCheckInterval = null;
let isToothbrushMoving = false;
let totalMotionHits = 0;
let lastMotionTimestamp = 0;
let isFallbackActive = false;
let bonusMotionDamage = 0; // Extra damage earned by active brushing

function initMotionDetector() {
  if (!motionCanvas) {
    motionCanvas = document.createElement('canvas');
    motionCanvas.width = 64;
    motionCanvas.height = 48;
    motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
  }
}

function checkToothbrushMotion() {
  const video = document.getElementById('ar-camera-feed');
  if (!video || !videoStream || video.readyState < 2 || !motionCtx) return;

  try {
    motionCtx.drawImage(video, 0, 0, 64, 48);
    const frame = motionCtx.getImageData(0, 0, 64, 48);
    const data = frame.data;

    // First frame initialization
    if (!prevFrameData) {
      prevFrameData = new Uint8Array(data.length / 4);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        prevFrameData[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      }
      return;
    }

    // Sample central lower Region of Interest (ROI) where mouth and toothbrush are held
    // x: 12 to 52 (central 62% width), y: 16 to 44 (lower 58% height)
    let changedPixels = 0;
    let totalSampled = 0;

    for (let y = 16; y < 44; y++) {
      for (let x = 12; x < 52; x++) {
        const pixelIdx = y * 64 + x;
        const byteIdx = pixelIdx * 4;
        const lum = (data[byteIdx] * 299 + data[byteIdx + 1] * 587 + data[byteIdx + 2] * 114) / 1000;
        const diff = Math.abs(lum - prevFrameData[pixelIdx]);

        if (diff > 16) {
          changedPixels++;
        }
        prevFrameData[pixelIdx] = lum;
        totalSampled++;
      }
    }

    const motionRatio = changedPixels / (totalSampled || 1);

    // Threshold: 3.2% of sampled brushing pixels actively moving
    if (motionRatio > 0.032) {
      isToothbrushMoving = true;
      totalMotionHits++;
      lastMotionTimestamp = Date.now();
      onBrushMovementDetected();
    } else {
      if (Date.now() - lastMotionTimestamp > 1400) {
        isToothbrushMoving = false;
        updateMotionUI(false);
      }
    }
  } catch (e) {
    // Video feed not ready yet or restricted
  }
}

// TRIGGERED ON ACTIVE TOOTHBRUSH MOVEMENT
function onBrushMovementDetected() {
  updateMotionUI(true);

  // Periodic visual & sound effects on brushing motion
  if (Math.random() < 0.4) {
    spawnToothpasteFoam();
  }

  if (Math.random() < 0.25) {
    Sound.laser();
    showComicHit('SCRUB POWER! 🪥⚡');

    // Flinch the Sugar Boss
    const boss = document.getElementById('boss-character');
    if (boss) {
      boss.classList.add('scale-110', 'brightness-150');
      setTimeout(() => boss.classList.remove('scale-110', 'brightness-150'), 200);
    }

    // Flinch a random Germ Minion
    const randomMinionId = `minion-${Math.floor(Math.random() * 4) + 1}`;
    const minion = document.getElementById(randomMinionId);
    if (minion) {
      minion.classList.add('scale-75', 'rotate-12', 'brightness-150');
      setTimeout(() => minion.classList.remove('scale-75', 'rotate-12', 'brightness-150'), 250);
    }
  }
}

// UPDATE TOOTHBRUSH MOTION SENSOR HUD
function updateMotionUI(isMoving) {
  const motionPill = document.getElementById('motion-status-pill');
  const motionText = document.getElementById('motion-status-text');
  const motionMeter = document.getElementById('motion-power-meter');
  const scrubHint = document.getElementById('scrub-action-hint');

  if (isMoving) {
    if (motionPill) motionPill.className = 'flex items-center gap-1.5 bg-primary/20 border border-primary/60 px-3 py-1.5 rounded-full text-[11px] font-black text-primary shadow-sm animate-pulse';
    if (motionText) motionText.textContent = '🪥 Toothbrush Scrubbing: ACTIVE';
    if (motionMeter) motionMeter.style.width = '100%';
    if (scrubHint) scrubHint.textContent = '🔥 AWESOME SCRUBBING! BOSS TAKING HEAVY DAMAGE!';
  } else {
    if (isFallbackActive) {
      if (motionPill) motionPill.className = 'flex items-center gap-1.5 bg-secondary/20 border border-secondary/60 px-3 py-1.5 rounded-full text-[11px] font-black text-secondary shadow-sm';
      if (motionText) motionText.textContent = '🛡️ Auto-Assist Attack: ACTIVE';
      if (motionMeter) motionMeter.style.width = '45%';
      if (scrubHint) scrubHint.textContent = '🛡️ AUTO-ASSIST ACTIVE: KEEP SCRUBBING YOUR TEETH!';
    } else {
      if (motionPill) motionPill.className = 'flex items-center gap-1.5 bg-surface-container-high border border-surface-container-highest px-3 py-1.5 rounded-full text-[11px] font-black text-on-surface-variant shadow-sm';
      if (motionText) motionText.textContent = '🪥 Move Toothbrush to Attack';
      if (motionMeter) motionMeter.style.width = '15%';
      if (scrubHint) scrubHint.textContent = '🪥 MOVE YOUR TOOTHBRUSH IN FRONT OF THE MIRROR!';
    }
  }
}

export function renderBattleView() {
  const elapsed = totalDuration - secondsRemaining;
  let hpPercent = 100;

  if (elapsed < 20 && totalMotionHits === 0) {
    hpPercent = 100; // Waiting for motion in initial 20s
  } else {
    // Damage curves smoothly down to 0%
    const progressRatio = Math.min(1, elapsed / totalDuration);
    hpPercent = Math.max(0, Math.round((1 - progressRatio) * 100));
  }

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return `
    <div class="max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-28 flex flex-col gap-3 animate-fade-in select-none">
      
      <!-- Top Bar HUD -->
      <div class="flex items-center justify-between z-20">
        <button id="battle-quit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">close</span> ${isBattleRunning ? 'Quit Battle' : 'Exit'}
        </button>

        <!-- Live Toothbrush Motion Sensor Status Pill -->
        <div id="motion-status-pill" class="flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded-full border border-surface-container-highest text-[11px] font-black text-primary shadow-sm">
          <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
          <span id="motion-status-text">🪥 Toothbrush Motion Sensor Ready</span>
        </div>

        <!-- Timer & Coins HUD -->
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="bg-surface-container-high px-3.5 sm:px-4 py-2 rounded-full border-2 border-secondary-container flex items-center gap-2 shadow-md">
            <span class="material-symbols-outlined text-secondary text-lg sm:text-xl" style="font-variation-settings: 'FILL' 1;">timer</span>
            <span id="battle-timer-display" class="font-headline text-base sm:text-lg font-black text-secondary tracking-wider">${timeStr}</span>
          </div>

          <div class="hidden sm:flex items-center bg-surface-container-high px-3.5 py-2 rounded-full border-2 border-primary-container gap-1.5">
            <span class="material-symbols-outlined text-primary text-base">military_tech</span>
            <span class="font-headline text-xs font-black text-primary">+15 Points & +30 Coins</span>
          </div>
        </div>
      </div>

      <!-- AR Camera Mirror & Boss Battle Canvas -->
      <div class="relative bg-[#050f18] rounded-3xl border-4 border-primary/50 min-h-[500px] sm:min-h-[560px] card-shadow-lg flex flex-col justify-between items-center overflow-hidden">
        
        <!-- Live Webcam AR Video Stream Layer (Full Mirror Feed) -->
        <video id="ar-camera-feed" class="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 bg-[#050f18]" autoplay playsinline muted></video>
        
        <!-- Ambient Vignette -->
        <div class="absolute inset-0 bg-radial from-transparent via-black/20 to-black/75 pointer-events-none z-0"></div>

        <!-- Camera Permission / Retry Button (Shown if camera blocked or needs gesture) -->
        <div id="camera-permission-fallback" class="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center gap-3 bg-black/70 backdrop-blur-sm ${isCameraActive ? 'hidden' : ''}">
          <div class="w-16 h-16 rounded-3xl bg-primary/20 text-primary flex items-center justify-center text-3xl border-2 border-primary/40 shadow-lg">
            <span class="material-symbols-outlined text-4xl">videocam</span>
          </div>
          <div class="max-w-xs">
            <h3 class="font-headline text-base font-black text-white">Turn On Magic Mirror</h3>
            <p class="text-xs text-white/80 mt-1">See your face and move your toothbrush in the mirror to blast the sugar bugs!</p>
          </div>
          <button id="enable-camera-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-5 py-3 rounded-2xl chunky-btn border-primary-container flex items-center gap-2 active:scale-95 shadow-lg">
            <span class="material-symbols-outlined text-lg">photo_camera</span>
            Enable Magic Mirror
          </button>
        </div>

        <!-- TOP: Boss Health Bar HUD & Motion Sensor Power Gauge -->
        <div class="w-full max-w-md z-10 pt-3 px-4 flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black text-error bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-error/30 shadow">
            <span class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-base animate-pulse">coronavirus</span>
              <span class="uppercase tracking-wider">Sugar Bug Overlord</span>
            </span>
            <span id="boss-hp-text" class="text-secondary font-black">${hpPercent}% HP</span>
          </div>
          <div class="w-full h-5 bg-black/70 rounded-full p-1 border-2 border-error/60 overflow-hidden shadow-inner">
            <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-error via-secondary to-primary rounded-full transition-all duration-300 relative" style="width: ${hpPercent}%;">
              <div class="absolute inset-0 bg-white/30 animate-pulse"></div>
            </div>
          </div>

          <!-- Scrub Motion Power Bar -->
          <div class="flex items-center justify-between gap-2 px-1 text-[10px] font-black text-white/80">
            <span class="flex items-center gap-1 text-primary">
              <span class="material-symbols-outlined text-xs">bolt</span> Toothbrush Scrub Power:
            </span>
            <div class="flex-1 h-2 bg-black/60 rounded-full border border-white/20 overflow-hidden">
              <div id="motion-power-meter" class="h-full bg-primary rounded-full transition-all duration-200" style="width: 20%;"></div>
            </div>
          </div>
        </div>

        <!-- CENTER BATTLE STAGE: Boss, Minions, and Toothbrush Target Zone -->
        <div class="relative w-full flex-1 flex flex-col items-center justify-center z-10 px-4 my-2">
          
          <!-- Animated Sugar Villain Boss (Overlord Sugartusk) -->
          <div id="boss-character-wrap" class="relative z-20 flex flex-col items-center">
            
            <!-- Boss Floating SVG Character -->
            <div id="boss-character" class="w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center animate-villain-hover transition-transform">
              <svg class="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]" viewBox="0 0 120 120" fill="none">
                <!-- Outer Spikes / Sugar Crystals -->
                <polygon points="60,2 70,18 88,10 82,28 102,28 92,44 112,52 96,66 114,80 94,88 106,106 86,100 84,118 68,104 60,118 52,104 36,118 34,100 14,106 26,88 6,80 24,66 8,52 28,44 18,28 38,28 32,10 50,18" fill="#7a000c" stroke="#e89300" stroke-width="2" />
                
                <!-- Main Body -->
                <circle cx="60" cy="62" r="38" fill="#93000a" />
                <circle cx="60" cy="62" r="32" fill="#ba1a1a" />
                
                <!-- Golden Candy Horns -->
                <path d="M 38 35 Q 26 15 16 22 Q 28 35 36 40 Z" fill="#f1c40f" stroke="#e89300" stroke-width="1.5" />
                <path d="M 82 35 Q 94 15 104 22 Q 92 35 84 40 Z" fill="#f1c40f" stroke="#e89300" stroke-width="1.5" />
                
                <!-- Horn Stripes -->
                <path d="M 28 22 L 32 30" stroke="#93000a" stroke-width="2" />
                <path d="M 92 22 L 88 30" stroke="#93000a" stroke-width="2" />
                
                <!-- Angry Glowing Eyes -->
                <ellipse cx="46" cy="52" rx="9" ry="11" fill="#ffffff" />
                <circle cx="48" cy="53" r="5" fill="#f1c40f" />
                <circle cx="49" cy="53" r="2.5" fill="#050f18" />
                <path d="M 36 43 L 56 49" stroke="#050f18" stroke-width="3.5" stroke-linecap="round" />

                <ellipse cx="74" cy="52" rx="9" ry="11" fill="#ffffff" />
                <circle cx="72" cy="53" r="5" fill="#f1c40f" />
                <circle cx="71" cy="53" r="2.5" fill="#050f18" />
                <path d="M 84 43 L 64 49" stroke="#050f18" stroke-width="3.5" stroke-linecap="round" />

                <!-- Chomping Mouth with Tartar Teeth -->
                <g class="animate-villain-chomp origin-center">
                  <path d="M 38 72 C 38 88 82 88 82 72 Z" fill="#410002" stroke="#050f18" stroke-width="2" />
                  <!-- Top Jagged Teeth -->
                  <polygon points="42,72 45,78 48,72" fill="#ffffff" />
                  <polygon points="49,72 53,80 57,72" fill="#f1c40f" />
                  <polygon points="58,72 62,81 66,72" fill="#ffffff" />
                  <polygon points="67,72 71,79 75,72" fill="#f1c40f" />
                  <polygon points="76,72 78,77 80,72" fill="#ffffff" />
                  <!-- Bottom Jagged Teeth -->
                  <polygon points="46,84 49,78 52,84" fill="#ffffff" />
                  <polygon points="55,85 58,79 61,85" fill="#ffffff" />
                  <polygon points="64,85 67,78 70,85" fill="#f1c40f" />
                  <polygon points="73,84 75,79 78,84" fill="#ffffff" />
                </g>

                <!-- Dripping Sugar Acid Slime -->
                <path d="M 50 85 Q 52 98 50 106 Q 48 98 50 85" fill="#8e44ad" class="animate-sugar-drip" />
                <path d="M 68 85 Q 70 95 68 102 Q 66 95 68 85" fill="#8e44ad" class="animate-sugar-drip" style="animation-delay: 0.5s;" />
              </svg>
            </div>

            <!-- Sugar Boss Slime Attack Trail -->
            <div id="sugar-attack-beam" class="w-1.5 h-8 bg-gradient-to-b from-error via-secondary to-primary/80 animate-pulse-glow rounded-full shadow-[0_0_12px_#ff5722]"></div>
          </div>

          <!-- MAGIC MIRROR TOOTHBRUSH BATTLE ZONE (Focuses on Toothbrush Movement) -->
          <div id="ar-brushing-target" class="relative w-80 sm:w-96 h-40 sm:h-44 rounded-3xl border-3 border-dashed border-primary/70 bg-black/45 backdrop-blur-[2px] flex flex-col items-center justify-between p-3 shadow-[0_0_30px_rgba(46,204,113,0.3)] animate-mouth-glow">
            
            <!-- Target Alignment Header -->
            <div class="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-primary bg-black/70 px-3 py-1 rounded-full border border-primary/40 shadow-sm">
              <span class="material-symbols-outlined text-sm">cleaning_services</span>
              <span>Magic Mirror Brushing Zone</span>
            </div>

            <!-- Central Motion Target Crosshairs & Teeth Shield -->
            <div class="flex flex-col items-center gap-1 z-10 text-center">
              <div class="flex items-center gap-1.5 text-2xl drop-shadow">
                <span>🦷</span>
                <span class="text-3xl animate-bounce">🪥</span>
                <span>🦷</span>
              </div>
              <span id="motion-target-instruction" class="text-xs font-black text-white bg-primary/80 px-3.5 py-1 rounded-full shadow-md">
                MOVE TOOTHBRUSH TO BLAST BOSS!
              </span>
            </div>

            <!-- Dynamic Toothbrush Foam Burst VFX Layer -->
            <div id="foam-vfx-container" class="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl"></div>

            <!-- Fallback Status Banner (Shown after 20s if motion detection is struggling) -->
            <div id="fallback-assist-badge" class="hidden flex items-center gap-1 text-[10px] font-black text-secondary bg-black/80 px-3 py-0.5 rounded-full border border-secondary/50">
              <span class="material-symbols-outlined text-xs">shield</span>
              <span>Auto-Assist: Timer-Based Attack Active</span>
            </div>
          </div>

          <!-- 4 ANIMATED GERM MINIONS FIGHTING THE BRUSHING ZONE -->
          
          <!-- Minion 1: Plaque Bug (Top-Left) -->
          <div id="minion-1" class="absolute left-2 sm:left-6 top-28 sm:top-32 flex flex-col items-center animate-minion-wiggle z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#2ecc71] border border-[#2ecc71]/40 mb-1 shadow">
              Plaque Bug 👾
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(46,204,113,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <circle cx="25" cy="25" r="18" fill="#27ae60" stroke="#2ecc71" stroke-width="2" />
                <circle cx="14" cy="18" r="4" fill="#2ecc71" />
                <circle cx="36" cy="18" r="4" fill="#2ecc71" />
                <circle cx="20" cy="22" r="5" fill="#fff" />
                <circle cx="21" cy="22" r="2.5" fill="#000" />
                <circle cx="30" cy="22" r="5" fill="#fff" />
                <circle cx="29" cy="22" r="2.5" fill="#000" />
                <path d="M 18 32 Q 25 38 32 32" stroke="#f1c40f" stroke-width="3" fill="none" stroke-linecap="round" />
                <polygon points="21,30 23,34 25,30" fill="#fff" />
                <polygon points="26,30 28,34 30,30" fill="#fff" />
              </svg>
            </div>
          </div>

          <!-- Minion 2: Sour Acid Imp (Top-Right) -->
          <div id="minion-2" class="absolute right-2 sm:right-6 top-28 sm:top-32 flex flex-col items-center animate-minion-chomp z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#3498db] border border-[#3498db]/40 mb-1 shadow">
              Acid Imp 💧
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(52,152,219,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <path d="M 25 6 C 14 18 10 28 10 35 C 10 44 16 48 25 48 C 34 48 40 44 40 35 C 40 28 36 18 25 6 Z" fill="#2980b9" stroke="#3498db" stroke-width="2" />
                <polygon points="14,14 18,22 10,22" fill="#f1c40f" />
                <polygon points="36,14 32,22 40,22" fill="#f1c40f" />
                <circle cx="20" cy="30" r="4.5" fill="#fff" />
                <circle cx="21" cy="31" r="2" fill="#c0392b" />
                <circle cx="30" cy="30" r="4.5" fill="#fff" />
                <circle cx="29" cy="31" r="2" fill="#c0392b" />
                <path d="M 18 38 L 22 42 L 25 38 L 28 42 L 32 38" stroke="#f1c40f" stroke-width="2" fill="none" />
              </svg>
            </div>
          </div>

          <!-- Minion 3: Cavity Drill (Bottom-Left) -->
          <div id="minion-3" class="absolute left-3 sm:left-8 bottom-10 sm:bottom-14 flex flex-col items-center animate-minion-drill z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#e74c3c] border border-[#e74c3c]/40 mb-1 shadow">
              Cavity Drill 🪚
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(231,76,60,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <ellipse cx="25" cy="27" rx="16" ry="14" fill="#c0392b" stroke="#e74c3c" stroke-width="2" />
                <polygon points="18,16 20,8 24,16" fill="#f1c40f" />
                <polygon points="32,16 30,8 26,16" fill="#f1c40f" />
                <circle cx="20" cy="25" r="3.5" fill="#f1c40f" />
                <circle cx="30" cy="25" r="3.5" fill="#f1c40f" />
                <line x1="32" y1="32" x2="44" y2="44" stroke="#ecf0f1" stroke-width="3" stroke-linecap="round" />
                <polygon points="42,42 46,46 41,47" fill="#f1c40f" />
              </svg>
            </div>
          </div>

          <!-- Minion 4: Sugar Mite (Bottom-Right) -->
          <div id="minion-4" class="absolute right-3 sm:right-8 bottom-10 sm:bottom-14 flex flex-col items-center animate-minion-wiggle z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#f39c12] border border-[#f39c12]/40 mb-1 shadow">
              Sugar Mite 🍭
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(243,156,18,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <circle cx="25" cy="26" r="15" fill="#d35400" stroke="#f39c12" stroke-width="2" />
                <path d="M 20 12 Q 16 4 12 8" stroke="#f39c12" stroke-width="2" fill="none" />
                <circle cx="12" cy="8" r="2" fill="#e74c3c" />
                <path d="M 30 12 Q 34 4 38 8" stroke="#f39c12" stroke-width="2" fill="none" />
                <circle cx="38" cy="8" r="2" fill="#e74c3c" />
                <circle cx="20" cy="24" r="4" fill="#fff" />
                <circle cx="21" cy="24" r="2" fill="#000" />
                <circle cx="30" cy="24" r="4" fill="#fff" />
                <circle cx="29" cy="24" r="2" fill="#000" />
                <rect x="21" y="32" width="3" height="4" fill="#fff" />
                <rect x="26" y="32" width="3" height="4" fill="#f1c40f" />
              </svg>
            </div>
          </div>

          <!-- Dynamic Comic Hit Toast Popup -->
          <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-30 text-center">
            <span class="bg-gradient-to-r from-primary to-secondary text-on-primary font-headline text-sm sm:text-base font-black px-4 py-1.5 rounded-full shadow-2xl border-2 border-white scale-125">
              SCRUB POWER! 🪥✨
            </span>
          </div>

        </div>

        <!-- BOTTOM HUD: Guidance Status & Start Button -->
        <div class="w-full z-10 pb-3 px-4 flex flex-col items-center gap-2.5">
          
          <!-- Live Brushing Guidance Banner -->
          <div class="w-full max-w-md bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border-2 border-primary/50 flex items-center justify-between shadow-lg text-center">
            <div class="flex items-center gap-2.5 text-left">
              <div class="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center text-lg flex-shrink-0">
                <span class="material-symbols-outlined text-base">cleaning_services</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black uppercase text-primary tracking-wider">Magic Mirror Action</span>
                <span id="scrub-action-hint" class="text-xs font-bold text-inverse-surface">Move your toothbrush in circles to attack!</span>
              </div>
            </div>
            <span class="text-xl">🪥</span>
          </div>

          <!-- Start / Hands-Free Status Button -->
          <div class="w-full max-w-md">
            ${
              !isBattleRunning
                ? `
              <button id="start-ar-battle-btn" class="w-full bg-primary text-on-primary font-headline text-base font-black py-3.5 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-2xl">cleaning_services</span> START 2-MIN BRUSHING BATTLE!
              </button>
            `
                : `
              <div class="w-full bg-surface-container-lowest/90 backdrop-blur-md text-primary font-headline text-xs font-black py-3 px-4 rounded-2xl border-2 border-primary/50 flex items-center justify-center gap-2 shadow-inner">
                <span class="material-symbols-outlined text-lg animate-pulse">check_circle</span>
                <span>100% HANDS-FREE: KEEP SCRUBBING YOUR TEETH!</span>
              </div>
            `
            }
          </div>

        </div>

      </div>

      <!-- Info Banner explaining Motion Detection & 20s Fallback -->
      <div class="bg-surface-container rounded-3xl p-3.5 sm:p-4 border-2 border-surface-container-highest card-shadow flex items-center justify-between text-xs text-on-surface-variant">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary text-xl">verified</span>
          <span>Camera detects toothbrush motion to deal damage. Auto-assist engages after 20s if motion detection is low.</span>
        </div>
        <span class="text-error font-bold hidden sm:block">⚠️ Early exit forfeits points</span>
      </div>

    </div>
  `;
}

// CAMERA STREAM INITIALIZATION & PERSISTENCE
async function initCamera() {
  const video = document.getElementById('ar-camera-feed');
  const fallback = document.getElementById('camera-permission-fallback');

  if (videoStream && videoStream.active) {
    if (video) {
      if (video.srcObject !== videoStream) {
        video.srcObject = videoStream;
      }
      video.play().catch(() => {});
      if (fallback) fallback.classList.add('hidden');
    }
    isCameraActive = true;
    return;
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      videoStream = stream;
      isCameraActive = true;
      cameraError = null;

      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      if (fallback) fallback.classList.add('hidden');
    } catch (err) {
      console.warn('Camera access denied or unavailable; fallback enabled.', err);
      isCameraActive = false;
      cameraError = err;
      if (fallback) fallback.classList.remove('hidden');
    }
  } else {
    if (fallback) fallback.classList.remove('hidden');
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
    isCameraActive = false;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
}

// BURST FOAM BUBBLE PARTICLES
function spawnToothpasteFoam() {
  const container = document.getElementById('foam-vfx-container');
  if (!container) return;

  const bubbleIcons = ['🫧', '✨', '🪥', '🫧', '⭐'];
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'absolute text-lg sm:text-xl pointer-events-none transition-all duration-700 select-none';
    el.textContent = bubbleIcons[Math.floor(Math.random() * bubbleIcons.length)];
    
    const leftPercent = 20 + Math.random() * 60;
    const topPercent = 25 + Math.random() * 50;
    el.style.left = `${leftPercent}%`;
    el.style.top = `${topPercent}%`;
    el.style.transform = `translate(-50%, -50%) scale(0.5)`;
    el.style.opacity = '1';

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(${ (Math.random() - 0.5) * 60 }px, -${ 30 + Math.random() * 40 }px) scale(${ 1 + Math.random() * 0.5 })`;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      el.remove();
    }, 800);
  }
}

// SHOW COMIC ACTION HIT TOAST
function showComicHit(text) {
  const badge = document.getElementById('comic-hit-badge');
  if (!badge) return;

  const hitWords = ['SCRUB HIT! 🪥', 'FOAM BLAST! 🫧', 'SUPER SHINE! ✨', 'GERMS FLEEING! ⚡', 'CLEAN COMBO! 💥'];
  const msg = text || hitWords[Math.floor(Math.random() * hitWords.length)];
  const innerSpan = badge.querySelector('span');
  if (innerSpan) innerSpan.textContent = msg;

  badge.style.opacity = '1';
  badge.style.transform = 'translate(-50%, -50%) scale(1.1) rotate(' + (Math.random() * 10 - 5) + 'deg)';

  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translate(-50%, -50%) scale(0.8)';
  }, 650);
}

// BATTLE LIFECYCLE
function startBattle() {
  isBattleRunning = true;
  secondsRemaining = store.getState().parentSettings.arBattleDuration || 120;
  totalDuration = secondsRemaining;
  totalMotionHits = 0;
  bonusMotionDamage = 0;
  isFallbackActive = false;
  prevFrameData = null;

  Sound.fanfare();
  initCamera();
  initMotionDetector();

  voicePrompts.speak("Look into the magic mirror and move your toothbrush to blast the sugar boss!");

  // Immediately re-render to switch button to hands-free state
  store.notify();

  // Run toothbrush motion detection at 10 FPS (every 100ms)
  if (motionCheckInterval) clearInterval(motionCheckInterval);
  motionCheckInterval = setInterval(checkToothbrushMotion, 100);

  // Smooth DOM update interval every 1000ms
  battleTimer = setInterval(() => {
    secondsRemaining--;
    const elapsedSeconds = totalDuration - secondsRemaining;

    // Update timer text in DOM
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = document.getElementById('battle-timer-display');
    if (timerDisplay) timerDisplay.textContent = timeStr;

    // 20-SECOND FALLBACK CHECK
    // If toothbrush detection has failed or registered low motion for 20 seconds,
    // automatically activate fallback timer-based completion!
    if (elapsedSeconds >= 20 && !isFallbackActive && totalMotionHits < 12) {
      isFallbackActive = true;
      const fallbackBadge = document.getElementById('fallback-assist-badge');
      if (fallbackBadge) fallbackBadge.classList.remove('hidden');

      voicePrompts.speak("Hero Auto-Assist active! Keep on brushing to defeat the sugar overlord!");
      showComicHit('AUTO-ASSIST ENGAGED! 🛡️');
      Sound.laser();
    }

    // CALCULATE BOSS HP
    // If active motion: damage happens immediately.
    // If motion failed: damage begins happening after 20s and smoothly finishes on timer.
    let hpPercent = 100;
    if (elapsedSeconds < 20 && totalMotionHits < 6) {
      hpPercent = 100; // Waiting for motion in initial 20s
    } else {
      // Curve damage down from 100% to 0% across the battle duration
      const effectiveProgress = (elapsedSeconds / totalDuration);
      hpPercent = Math.max(0, Math.round((1 - effectiveProgress) * 100));
    }

    // Update HP bar & text in DOM
    const hpBar = document.getElementById('boss-hp-bar');
    const hpText = document.getElementById('boss-hp-text');
    if (hpBar) hpBar.style.width = `${hpPercent}%`;
    if (hpText) hpText.textContent = `${hpPercent}% HP`;

    // Periodic milestones & encouragement
    if (elapsedSeconds === 60) {
      voicePrompts.speak("Great job! You are halfway there! Keep that toothbrush scrubbing!");
    } else if (secondsRemaining === 15) {
      voicePrompts.speak("Almost there! Final scrub blast to defeat the boss!");
    }

    // Fallback auto-damage action pulse if in fallback mode
    if (isFallbackActive && secondsRemaining % 3 === 0) {
      spawnToothpasteFoam();
      const boss = document.getElementById('boss-character');
      if (boss) {
        boss.classList.add('scale-105', 'brightness-125');
        setTimeout(() => boss.classList.remove('scale-105', 'brightness-125'), 200);
      }
    }

    // Win Condition
    if (secondsRemaining <= 0) {
      clearInterval(battleTimer);
      battleTimer = null;
      if (motionCheckInterval) {
        clearInterval(motionCheckInterval);
        motionCheckInterval = null;
      }
      isBattleRunning = false;
      stopCamera();

      Sound.fanfare();
      confetti({
        particleCount: 160,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#54e98a', '#ffb961', '#3498db', '#f1c40f']
      });

      store.completeToothbrushBattle();
    }
  }, 1000);
}

function quitBattle() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  stopCamera();

  if (isBattleRunning && secondsRemaining > 0) {
    isBattleRunning = false;
    Sound.hit();
    store.showReward(
      'Boss Escaped!',
      'The Sugar Villain and his germ minions ran away! Brush for the full 2 minutes next time to defeat them and earn your Rewards!',
      0,
      0,
      sugarVillainEscapedImg,
      'sentiment_dissatisfied'
    );
  }
  isBattleRunning = false;
  store.navigate('dashboard');
}

export function attachBattleListeners() {
  const quitBtn = document.getElementById('battle-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', quitBattle);
  }

  const startBtn = document.getElementById('start-ar-battle-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startBattle);
  }

  const enableCameraBtn = document.getElementById('enable-camera-btn');
  if (enableCameraBtn) {
    enableCameraBtn.addEventListener('click', () => {
      initCamera();
    });
  }

  // Automatically start camera and init motion detector on view load
  initCamera();
  initMotionDetector();
}
