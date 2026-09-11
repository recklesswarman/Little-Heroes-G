import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import sugarVillainEscapedImg from '../assets/sugar_villain_escaped.jpg';
import { voicePrompts } from '../utils/voicePrompts.js';
import { geminiLiveService } from '../services/geminiLiveService.js';

// =========================================================================
// DENTIST-APPROVED 4 QUADRANTS + TONGUE POLISH SEQUENCE (120s ROUTINE)
// =========================================================================
export const QUADRANTS = [
  {
    id: 'q1',
    zone: 1,
    name: 'Upper Right Molars',
    shortName: 'Upper Right',
    icon: '🦷',
    cellId: 'quadrant-cell-tr',
    startTime: 120,
    endTime: 90,
    instruction: 'Scrub circles on top right teeth!',
    coachMessage: 'Zone 1: Upper Right! Scrub round and round on your top right teeth!',
    brushPosition: { x: 58, y: 55, rotation: -20 },
    roi: { minX: 32, maxX: 54, minY: 14, maxY: 29 }
  },
  {
    id: 'q2',
    zone: 2,
    name: 'Upper Left Molars',
    shortName: 'Upper Left',
    icon: '🦷',
    cellId: 'quadrant-cell-tl',
    startTime: 90,
    endTime: 60,
    instruction: 'Switch to top left teeth! Round and round!',
    coachMessage: 'Zone 2: Upper Left! Keep circling on your top left teeth!',
    brushPosition: { x: 42, y: 55, rotation: 20 },
    roi: { minX: 10, maxX: 32, minY: 14, maxY: 29 }
  },
  {
    id: 'q3',
    zone: 3,
    name: 'Lower Right Chewing Surfaces',
    shortName: 'Lower Right',
    icon: '🦷',
    cellId: 'quadrant-cell-br',
    startTime: 60,
    endTime: 30,
    instruction: 'Down to bottom right teeth! Gentle circles!',
    coachMessage: 'Zone 3: Halfway there! Bottom right teeth next! Keep scrubbing!',
    brushPosition: { x: 58, y: 68, rotation: -15 },
    roi: { minX: 32, maxX: 54, minY: 29, maxY: 44 }
  },
  {
    id: 'q4',
    zone: 4,
    name: 'Lower Left Chewing Surfaces',
    shortName: 'Lower Left',
    icon: '🦷',
    cellId: 'quadrant-cell-bl',
    startTime: 30,
    endTime: 10,
    instruction: 'Bottom left side! Clean away cavity bugs!',
    coachMessage: 'Zone 4: Bottom left side! Clean away those cavity bugs!',
    brushPosition: { x: 42, y: 68, rotation: 15 },
    roi: { minX: 10, maxX: 32, minY: 29, maxY: 44 }
  },
  {
    id: 'q5',
    zone: 5,
    name: 'Tongue Polish & Minty Fresh Sparkle',
    shortName: 'Tongue Polish',
    icon: '👅',
    cellId: 'quadrant-cell-tongue',
    startTime: 10,
    endTime: 0,
    instruction: 'Gentle tongue polish for fresh minty breath!',
    coachMessage: 'Final 10 seconds: Gentle tongue polish for a shiny mint smile!',
    brushPosition: { x: 50, y: 67, rotation: 0 },
    roi: { minX: 20, maxX: 44, minY: 22, maxY: 38 }
  }
];

// =========================================================================
// BATTLE STATE VARIABLES
// =========================================================================
let battleTimer = null;
let secondsRemaining = 120; // 2 minutes (120s)
let totalDuration = 120;
let isBattleRunning = false;
let videoStream = null;
let isCameraActive = false;
let cameraError = null;

// Multi-Zone ROI Motion Detection Engine
let motionCanvas = null;
let motionCtx = null;
let prevFrameData = null;
let motionCheckInterval = null;
let isToothbrushMoving = false;
let totalMotionHits = 0;
let lastMotionTimestamp = 0;
let isFallbackActive = false;
let currentCombo = 0;

// Dynamic Caramel Boss Candy Armor
let isCaramelShieldActive = false;
let caramelShieldHp = 0;
let caramelShieldMaxHp = 6;
let shieldMilestonesTriggered = { 90: false, 30: false };

// Dynamic Hero Bubble Shield
let isHeroShieldActive = false;
let heroShieldTimer = null;

// Projectile Cavity Slime State
let slimeInterval = null;
let activeSlime = null;

// Live Rex Coaching State
let currentRexCoachText = 'Look into the mirror and scrub in circles!';

// =========================================================================
// QUADRANT ENGINE
// =========================================================================
export function getActiveQuadrant(secs, totalSecs = 120) {
  const ratio = Math.max(0, Math.min(1, secs / totalSecs));
  if (ratio > 0.75) return QUADRANTS[0]; // 120 - 90s
  if (ratio > 0.50) return QUADRANTS[1]; // 90 - 60s
  if (ratio > 0.25) return QUADRANTS[2]; // 60 - 30s
  if (ratio > 0.083) return QUADRANTS[3]; // 30 - 10s
  return QUADRANTS[4]; // 10 - 0s
}

// =========================================================================
// REX DINO MIRROR DEMO SVG COMPONENT
// =========================================================================
export function renderRexMirrorDemoSvg(activeQuadrant, isBrushing = true) {
  const isTongue = activeQuadrant?.id === 'q5';
  const brushPos = activeQuadrant?.brushPosition || { x: 58, y: 55, rotation: -20 };
  const animClass = isTongue ? 'animate-tongue-scrub' : 'animate-dino-scrub';

  return `
    <div class="relative w-full h-full flex flex-col items-center justify-center select-none pointer-events-none">
      <svg class="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rex-dino-skin" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stop-color="#22c55e" />
            <stop offset="1" stop-color="#15803d" />
          </linearGradient>
          <linearGradient id="rex-brush-handle" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#38bdf8" />
            <stop offset="1" stop-color="#0284c7" />
          </linearGradient>
        </defs>

        <!-- Dino Body / Head Base -->
        <circle cx="50" cy="50" r="44" fill="url(#rex-dino-skin)" stroke="#166534" stroke-width="2" />
        
        <!-- Back Spikes -->
        <path d="M26 18L32 8L38 18Z" fill="#f59e0b" stroke="#b45309" stroke-width="1" />
        <path d="M44 14L50 4L56 14Z" fill="#f59e0b" stroke="#b45309" stroke-width="1" />
        <path d="M62 18L68 8L74 18Z" fill="#f59e0b" stroke="#b45309" stroke-width="1" />

        <!-- Snout Area -->
        <ellipse cx="50" cy="62" rx="28" ry="22" fill="#4ade80" />

        <!-- Friendly Big Eyes with Eyebrows -->
        <circle cx="36" cy="38" r="8" fill="#ffffff" stroke="#166534" stroke-width="1.5" />
        <circle cx="37" cy="38" r="4.5" fill="#0f172a" />
        <circle cx="39" cy="36" r="2" fill="#ffffff" />
        <path d="M28 30 Q36 26 42 30" stroke="#166534" stroke-width="2.5" stroke-linecap="round" fill="none" />

        <circle cx="64" cy="38" r="8" fill="#ffffff" stroke="#166534" stroke-width="1.5" />
        <circle cx="63" cy="38" r="4.5" fill="#0f172a" />
        <circle cx="61" cy="36" r="2" fill="#ffffff" />
        <path d="M58 30 Q64 26 72 30" stroke="#166534" stroke-width="2.5" stroke-linecap="round" fill="none" />

        <!-- Cute Nostrils -->
        <ellipse cx="45" cy="50" rx="2" ry="2.5" fill="#15803d" />
        <ellipse cx="55" cy="50" rx="2" ry="2.5" fill="#15803d" />

        <!-- Rosy Cheeks -->
        <ellipse cx="26" cy="56" rx="5" ry="3.5" fill="#f87171" opacity="0.8" />
        <ellipse cx="74" cy="56" rx="5" ry="3.5" fill="#f87171" opacity="0.8" />

        <!-- WIDE OPEN CARTOON MOUTH WITH TEETH -->
        <g id="rex-open-mouth">
          <!-- Dark Mouth Cavity -->
          <ellipse cx="50" cy="67" rx="20" ry="14" fill="#881337" stroke="#4c0519" stroke-width="1.5" />

          <!-- Pink Dino Tongue in Center -->
          <ellipse cx="50" cy="73" rx="11" ry="7" fill="#f43f5e" />
          <path d="M50 68 L50 76" stroke="#be123c" stroke-width="1.5" stroke-linecap="round" />

          <!-- UPPER ROW OF CARTOON TEETH (6 Shiny Rounded Teeth) -->
          <rect x="36" y="55" width="4.5" height="6" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="41" y="55" width="4.5" height="6.5" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="46" y="55" width="4" height="7" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="50" y="55" width="4" height="7" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="54.5" y="55" width="4.5" height="6.5" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="59.5" y="55" width="4.5" height="6" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />

          <!-- LOWER ROW OF CARTOON TEETH (6 Shiny Rounded Teeth) -->
          <rect x="37" y="74" width="4" height="5.5" rx="1.8" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="41.5" y="74.5" width="4" height="5.5" rx="1.8" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="46" y="75" width="4" height="5.5" rx="1.8" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="50" y="75" width="4" height="5.5" rx="1.8" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="54.5" y="74.5" width="4" height="5.5" rx="1.8" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
          <rect x="59" y="74" width="4" height="5.5" rx="1.8" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8" />
        </g>

        <!-- DYNAMIC CARTOON TOOTHBRUSH SCRUBBING IN SYNC WITH QUADRANT -->
        <g id="rex-demo-brush" class="${isBrushing ? animClass : ''}" style="transform-origin: ${brushPos.x}px ${brushPos.y}px;">
          <!-- Brush Handle -->
          <rect x="${brushPos.x - 3}" y="${brushPos.y + 4}" width="6" height="24" rx="3" fill="url(#rex-brush-handle)" stroke="#0369a1" stroke-width="1" transform="rotate(${brushPos.rotation}, ${brushPos.x}, ${brushPos.y})" />
          
          <!-- Brush Head Base -->
          <rect x="${brushPos.x - 5}" y="${brushPos.y - 4}" width="10" height="9" rx="2.5" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1" transform="rotate(${brushPos.rotation}, ${brushPos.x}, ${brushPos.y})" />
          
          <!-- White Bristles -->
          <path d="M${brushPos.x - 4} ${brushPos.y - 4} L${brushPos.x - 4} ${brushPos.y - 8} M${brushPos.x - 1} ${brushPos.y - 4} L${brushPos.x - 1} ${brushPos.y - 8} M${brushPos.x + 2} ${brushPos.y - 4} L${brushPos.x + 2} ${brushPos.y - 8}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" transform="rotate(${brushPos.rotation}, ${brushPos.x}, ${brushPos.y})" />

          <!-- Mint Toothpaste Dollop & Foamy Sparkles -->
          <circle cx="${brushPos.x}" cy="${brushPos.y - 5}" r="3" fill="#2dd4bf" />
          <circle cx="${brushPos.x - 3}" cy="${brushPos.y - 6}" r="1.5" fill="#ffffff" />
          <circle cx="${brushPos.x + 3}" cy="${brushPos.y - 4}" r="1.8" fill="#ffffff" />
        </g>

        <!-- Circular Scrub Arrow Guide Overlay on Rex -->
        <path d="M${brushPos.x - 7} ${brushPos.y - 1} A 8 8 0 1 1 ${brushPos.x + 6} ${brushPos.y + 4}" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-dasharray="3,2" />
        <polygon points="${brushPos.x + 8},${brushPos.y + 1} ${brushPos.x + 6},${brushPos.y + 6} ${brushPos.x + 3},${brushPos.y + 3}" fill="#facc15" />
      </svg>

      <!-- Active Quadrant Tag & Instructions under Rex -->
      <div class="mt-1 flex flex-col items-center">
        <span class="bg-primary text-on-primary text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
          <span>${activeQuadrant?.icon || '🪥'}</span>
          <span>Rex: ${activeQuadrant?.shortName || 'Brushing'}</span>
        </span>
        <span class="text-[8.5px] font-bold text-white/90 text-center drop-shadow mt-0.5 max-w-[125px] leading-tight">
          ${activeQuadrant?.instruction || 'Move toothbrush in circles!'}
        </span>
      </div>
    </div>
  `;
}

// =========================================================================
// MOTION DETECTION WITH MULTI-ZONE ROI
// =========================================================================
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

    if (!prevFrameData) {
      prevFrameData = new Uint8Array(data.length / 4);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        prevFrameData[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      }
      return;
    }

    const activeQuad = getActiveQuadrant(secondsRemaining, totalDuration);
    const roi = activeQuad.roi;

    let generalChangedPixels = 0;
    let activeZoneChangedPixels = 0;
    let activeZoneSampled = 0;
    let generalSampled = 0;

    for (let y = 14; y < 44; y++) {
      for (let x = 10; x < 54; x++) {
        const pixelIdx = y * 64 + x;
        const byteIdx = pixelIdx * 4;
        const lum = (data[byteIdx] * 299 + data[byteIdx + 1] * 587 + data[byteIdx + 2] * 114) / 1000;
        const diff = Math.abs(lum - prevFrameData[pixelIdx]);

        const inActiveZone = x >= roi.minX && x <= roi.maxX && y >= roi.minY && y <= roi.maxY;

        if (diff > 15) {
          generalChangedPixels++;
          if (inActiveZone) {
            activeZoneChangedPixels++;
          }
        }

        if (inActiveZone) activeZoneSampled++;
        generalSampled++;

        prevFrameData[pixelIdx] = lum;
      }
    }

    const generalRatio = generalChangedPixels / (generalSampled || 1);
    const activeZoneRatio = activeZoneChangedPixels / (activeZoneSampled || 1);

    // Toddler-friendly threshold: 2.8% general motion or 3.2% in active quadrant
    if (activeZoneRatio > 0.032 || generalRatio > 0.028) {
      isToothbrushMoving = true;
      totalMotionHits++;
      lastMotionTimestamp = Date.now();
      currentCombo = Math.min(15, currentCombo + 1);

      const isTargetHit = activeZoneRatio > 0.032;
      onBrushMovementDetected(isTargetHit, activeQuad);
    } else {
      if (Date.now() - lastMotionTimestamp > 1200) {
        isToothbrushMoving = false;
        currentCombo = 0;
        updateMotionUI(false);
      }
    }
  } catch (e) {
    // Canvas reading error or stream transition
  }
}

function onBrushMovementDetected(isTargetHit, activeQuad) {
  updateMotionUI(true, isTargetHit);

  // Periodic foam bubbles
  if (Math.random() < 0.45) {
    spawnToothpasteFoam(activeQuad);
  }

  // Damage Boss or Caramel Shield
  if (Math.random() < 0.3) {
    applyBrushingHit(isTargetHit ? 2 : 1);
  }
}

function updateMotionUI(isMoving, isTargetHit = false) {
  const motionPill = document.getElementById('motion-status-pill');
  const motionText = document.getElementById('motion-status-text');
  const motionMeter = document.getElementById('motion-power-meter');
  const scrubHint = document.getElementById('scrub-action-hint');

  if (isMoving) {
    if (motionPill) {
      motionPill.className = isTargetHit
        ? 'flex items-center gap-1.5 bg-primary/25 border-2 border-primary px-3 py-1.5 rounded-full text-[11px] font-black text-primary shadow-[0_0_12px_rgba(84,233,138,0.5)] animate-pulse'
        : 'flex items-center gap-1.5 bg-secondary/20 border border-secondary/70 px-3 py-1.5 rounded-full text-[11px] font-black text-secondary shadow-sm';
    }
    if (motionText) {
      motionText.textContent = isTargetHit ? '🔥 PERFECT ZONE SCRUBBING!' : '🪥 Toothbrush Active: Good Scrub!';
    }
    if (motionMeter) {
      motionMeter.style.width = isTargetHit ? '100%' : '75%';
    }
    if (scrubHint) {
      scrubHint.textContent = isTargetHit ? '⚡ 2X COMBO DAMAGE! BOSS IS WEAKENING!' : '✨ KEEP CIRCLING IN THE ACTIVE ZONE!';
    }
  } else {
    if (isFallbackActive) {
      if (motionPill) {
        motionPill.className = 'flex items-center gap-1.5 bg-secondary/20 border border-secondary/60 px-3 py-1.5 rounded-full text-[11px] font-black text-secondary shadow-sm';
      }
      if (motionText) motionText.textContent = '🛡️ Toddler Auto-Assist Active';
      if (motionMeter) motionMeter.style.width = '45%';
      if (scrubHint) scrubHint.textContent = '🛡️ AUTO-ASSIST ENGAGED: KEEP BRUSHING YOUR TEETH!';
    } else {
      if (motionPill) {
        motionPill.className = 'flex items-center gap-1.5 bg-surface-container-high border border-surface-container-highest px-3 py-1.5 rounded-full text-[11px] font-black text-on-surface-variant shadow-sm';
      }
      if (motionText) motionText.textContent = '🪥 Move Toothbrush to Attack';
      if (motionMeter) motionMeter.style.width = '20%';
      if (scrubHint) scrubHint.textContent = '🪥 LOOK IN THE MIRROR AND BRUSH IN CIRCLES!';
    }
  }
}

export function renderBattleView() {
  const elapsed = totalDuration - secondsRemaining;
  const progressRatio = Math.min(1, elapsed / totalDuration);
  const hpPercent = Math.max(0, Math.round((1 - progressRatio) * 100));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const activeQuad = getActiveQuadrant(secondsRemaining, totalDuration);

  return `
    <div class="max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-28 flex flex-col gap-3 animate-fade-in select-none">
      
      <!-- TOP BAR HUD -->
      <div class="flex items-center justify-between z-20">
        <button id="battle-quit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">close</span> ${isBattleRunning ? 'Quit Battle' : 'Exit'}
        </button>

        <!-- Live Toothbrush Motion Sensor Status Pill -->
        <div id="motion-status-pill" class="flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded-full border border-surface-container-highest text-[11px] font-black text-primary shadow-sm">
          <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
          <span id="motion-status-text">🪥 Toothbrush Sensor Ready</span>
        </div>

        <!-- Timer & Rewards HUD -->
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="bg-surface-container-high px-3.5 sm:px-4 py-2 rounded-full border-2 border-secondary-container flex items-center gap-2 shadow-md">
            <span class="material-symbols-outlined text-secondary text-lg sm:text-xl" style="font-variation-settings: 'FILL' 1;">timer</span>
            <span id="battle-timer-display" class="font-headline text-base sm:text-lg font-black text-secondary tracking-wider">${timeStr}</span>
          </div>

          <div class="hidden sm:flex items-center bg-surface-container-high px-3.5 py-2 rounded-full border-2 border-primary-container gap-1.5">
            <span class="material-symbols-outlined text-primary text-base">military_tech</span>
            <span class="font-headline text-xs font-black text-primary">+30 Coins & Mint Knight Badge</span>
          </div>
        </div>
      </div>

      <!-- MAIN AR BATTLE ARENA & MIRROR VIEW -->
      <div id="battle-stage-container" class="relative bg-[#050f18] rounded-3xl border-4 border-primary/50 min-h-[520px] sm:min-h-[580px] card-shadow-lg flex flex-col justify-between items-center overflow-hidden">
        
        <!-- Live Webcam AR Video Stream Layer (Full Mirror Feed with Horizontal Flip) -->
        <video id="ar-camera-feed" class="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 bg-[#050f18]" autoplay playsinline muted></video>
        
        <!-- Ambient Vignette -->
        <div class="absolute inset-0 bg-radial from-transparent via-black/25 to-black/80 pointer-events-none z-0"></div>

        <!-- Camera Permission Fallback Overlay -->
        <div id="camera-permission-fallback" class="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center gap-3 bg-black/75 backdrop-blur-sm ${isCameraActive ? 'hidden' : ''}">
          <div class="w-16 h-16 rounded-3xl bg-primary/20 text-primary flex items-center justify-center text-3xl border-2 border-primary/40 shadow-lg">
            <span class="material-symbols-outlined text-4xl">videocam</span>
          </div>
          <div class="max-w-xs">
            <h3 class="font-headline text-base font-black text-white">Turn On Magic Mirror</h3>
            <p class="text-xs text-white/80 mt-1">Look into the mirror and brush with Rex to blast the cavity bugs!</p>
          </div>
          <button id="enable-camera-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-5 py-3 rounded-2xl chunky-btn border-primary-container flex items-center gap-2 active:scale-95 shadow-lg">
            <span class="material-symbols-outlined text-lg">photo_camera</span>
            Enable Magic Mirror
          </button>
        </div>

        <!-- TOP BAR IN ARENA: Boss Health & Caramel Shield Gauge -->
        <div class="w-full max-w-lg z-10 pt-3 px-4 flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black text-error bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-error/30 shadow">
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

          <!-- Caramel Candy Armor Bar (Shown when active) -->
          <div id="boss-caramel-shield-layer" class="${isCaramelShieldActive ? '' : 'hidden'} flex flex-col gap-1 mt-0.5 animate-caramel-pulse">
            <div class="flex justify-between items-center text-[10px] font-black text-amber-300 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/50 shadow">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">shield</span>
                <span id="caramel-shield-hp-text">Caramel Candy Armor: ${caramelShieldHp}/${caramelShieldMaxHp} Hits</span>
              </span>
              <span class="animate-bounce">SCRUB TO SHATTER! 💥</span>
            </div>
            <div class="w-full h-2.5 bg-black/80 rounded-full border border-amber-400/50 overflow-hidden p-0.5">
              <div id="caramel-shield-bar" class="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-200" style="width: 100%;"></div>
            </div>
          </div>

          <!-- Scrub Motion Power Gauge -->
          <div class="flex items-center justify-between gap-2 px-1 text-[10px] font-black text-white/80">
            <span class="flex items-center gap-1 text-primary">
              <span class="material-symbols-outlined text-xs">bolt</span> Toothbrush Scrub Power:
            </span>
            <div class="flex-1 h-2 bg-black/60 rounded-full border border-white/20 overflow-hidden">
              <div id="motion-power-meter" class="h-full bg-primary rounded-full transition-all duration-200" style="width: 25%;"></div>
            </div>
          </div>
        </div>

        <!-- SPLIT-SCREEN AR QUADRANT GRID OVERLAY (4 Dentist Zones + Tongue Polish) -->
        <div id="ar-quadrant-grid" class="absolute inset-0 z-10 grid grid-cols-2 grid-rows-2 p-3 sm:p-5 gap-3 pointer-events-none">
          
          <!-- Quadrant Cell: Upper Left (Zone 2) -->
          <div id="quadrant-cell-tl" class="relative rounded-2xl border-2 transition-all duration-300 flex flex-col justify-start items-start p-2.5 ${activeQuad.id === 'q2' ? 'border-primary ring-4 ring-primary/40 bg-primary/15 shadow-[0_0_20px_rgba(84,233,138,0.5)]' : 'border-white/10 bg-black/25 opacity-70'}">
            <div class="flex items-center gap-1 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full ${activeQuad.id === 'q2' ? 'bg-primary text-on-primary' : 'bg-black/60 text-white/70'}">
              <span>🦷 Zone 2: Upper Left</span>
              ${elapsed >= 60 ? '<span class="text-emerald-300">✓ Clean</span>' : ''}
            </div>
            ${activeQuad.id === 'q2' ? `
              <div class="mt-auto self-center flex items-center gap-1 text-xs font-black text-white bg-black/70 px-2.5 py-1 rounded-full border border-primary/50 animate-bounce">
                <span>⟳ Circular Scrub! 🪥</span>
              </div>
            ` : ''}
          </div>

          <!-- Quadrant Cell: Upper Right (Zone 1) -->
          <div id="quadrant-cell-tr" class="relative rounded-2xl border-2 transition-all duration-300 flex flex-col justify-start items-end p-2.5 ${activeQuad.id === 'q1' ? 'border-primary ring-4 ring-primary/40 bg-primary/15 shadow-[0_0_20px_rgba(84,233,138,0.5)]' : 'border-white/10 bg-black/25 opacity-70'}">
            <div class="flex items-center gap-1 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full ${activeQuad.id === 'q1' ? 'bg-primary text-on-primary' : 'bg-black/60 text-white/70'}">
              ${elapsed >= 30 ? '<span class="text-emerald-300">✓ Clean</span>' : ''}
              <span>Zone 1: Upper Right 🦷</span>
            </div>
            ${activeQuad.id === 'q1' ? `
              <div class="mt-auto self-center flex items-center gap-1 text-xs font-black text-white bg-black/70 px-2.5 py-1 rounded-full border border-primary/50 animate-bounce">
                <span>⟳ Circular Scrub! 🪥</span>
              </div>
            ` : ''}
          </div>

          <!-- Quadrant Cell: Lower Left (Zone 4) -->
          <div id="quadrant-cell-bl" class="relative rounded-2xl border-2 transition-all duration-300 flex flex-col justify-end items-start p-2.5 ${activeQuad.id === 'q4' ? 'border-primary ring-4 ring-primary/40 bg-primary/15 shadow-[0_0_20px_rgba(84,233,138,0.5)]' : 'border-white/10 bg-black/25 opacity-70'}">
            ${activeQuad.id === 'q4' ? `
              <div class="mb-auto self-center flex items-center gap-1 text-xs font-black text-white bg-black/70 px-2.5 py-1 rounded-full border border-primary/50 animate-bounce">
                <span>⟳ Circular Scrub! 🪥</span>
              </div>
            ` : ''}
            <div class="flex items-center gap-1 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full ${activeQuad.id === 'q4' ? 'bg-primary text-on-primary' : 'bg-black/60 text-white/70'}">
              <span>🦷 Zone 4: Lower Left</span>
              ${elapsed >= 110 ? '<span class="text-emerald-300">✓ Clean</span>' : ''}
            </div>
          </div>

          <!-- Quadrant Cell: Lower Right (Zone 3) -->
          <div id="quadrant-cell-br" class="relative rounded-2xl border-2 transition-all duration-300 flex flex-col justify-end items-end p-2.5 ${activeQuad.id === 'q3' ? 'border-primary ring-4 ring-primary/40 bg-primary/15 shadow-[0_0_20px_rgba(84,233,138,0.5)]' : 'border-white/10 bg-black/25 opacity-70'}">
            ${activeQuad.id === 'q3' ? `
              <div class="mb-auto self-center flex items-center gap-1 text-xs font-black text-white bg-black/70 px-2.5 py-1 rounded-full border border-primary/50 animate-bounce">
                <span>⟳ Circular Scrub! 🪥</span>
              </div>
            ` : ''}
            <div class="flex items-center gap-1 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full ${activeQuad.id === 'q3' ? 'bg-primary text-on-primary' : 'bg-black/60 text-white/70'}">
              ${elapsed >= 90 ? '<span class="text-emerald-300">✓ Clean</span>' : ''}
              <span>Zone 3: Lower Right 🦷</span>
            </div>
          </div>

        </div>

        <!-- CENTER BATTLE STAGE: Boss, Minions, and Hero Bubble Shield -->
        <div class="relative w-full flex-1 flex flex-col items-center justify-center z-20 px-4 my-1">
          
          <!-- Sugar Villain Boss Character -->
          <div id="boss-character-wrap" class="relative z-20 flex flex-col items-center">
            
            <div id="boss-character" class="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center animate-villain-hover transition-transform">
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
                  <polygon points="42,72 45,78 48,72" fill="#ffffff" />
                  <polygon points="49,72 53,80 57,72" fill="#f1c40f" />
                  <polygon points="58,72 62,81 66,72" fill="#ffffff" />
                  <polygon points="67,72 71,79 75,72" fill="#f1c40f" />
                  <polygon points="76,72 78,77 80,72" fill="#ffffff" />
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

            <!-- Boss Slime Attack Beam Trail -->
            <div id="sugar-attack-beam" class="w-1.5 h-6 bg-gradient-to-b from-error via-secondary to-primary/80 animate-pulse-glow rounded-full shadow-[0_0_12px_#ff5722]"></div>
          </div>

          <!-- HERO BUBBLE SHIELD DOME OVERLAY (Shown when Bubble Shield active) -->
          <div id="hero-bubble-shield-dome" class="${isHeroShieldActive ? '' : 'hidden'} absolute inset-x-8 inset-y-4 rounded-3xl border-4 border-cyan-300 bg-cyan-500/20 backdrop-blur-[1px] animate-hero-bubble flex items-center justify-center pointer-events-none z-25">
            <div class="flex items-center gap-2 bg-black/80 px-4 py-2 rounded-full border border-cyan-400 text-cyan-300 font-headline font-black text-xs shadow-xl">
              <span class="material-symbols-outlined text-lg animate-spin">shield</span>
              <span>HERO BUBBLE SHIELD ACTIVE! SLIME DEFLECTED!</span>
            </div>
          </div>

          <!-- Dynamic Toothpaste Foam Burst VFX Layer -->
          <div id="foam-vfx-container" class="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-30"></div>

          <!-- Dynamic Comic Hit Toast Popup -->
          <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
            <span class="bg-gradient-to-r from-primary via-secondary to-primary text-on-primary font-headline text-sm sm:text-base font-black px-5 py-2 rounded-full shadow-2xl border-2 border-white scale-125">
              SCRUB POWER! 🪥✨
            </span>
          </div>

        </div>

        <!-- MASCOT DINO MIRROR DEMO (PICTURE-IN-PICTURE GUIDANCE CARD) -->
        <div id="rex-mirror-demo-card" class="absolute left-3 bottom-24 sm:bottom-28 z-20 bg-black/80 backdrop-blur-md rounded-2xl border-2 border-primary/60 p-2 sm:p-2.5 shadow-2xl flex flex-col items-center card-shadow-sm max-w-[140px] sm:max-w-[155px]">
          <div class="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary border-b border-white/10 pb-1 w-full justify-center">
            <span class="text-xs">🦖</span> Dino Mirror Demo
          </div>
          
          <div id="rex-demo-svg-container" class="w-full flex justify-center py-1">
            ${renderRexMirrorDemoSvg(activeQuad, isToothbrushMoving)}
          </div>
        </div>

        <!-- BOTTOM HUD: Voice Powers & Hands-Free Status -->
        <div class="w-full z-20 pb-3 px-3 sm:px-4 flex flex-col items-center gap-2">
          
          <!-- Live Rex Battle Coach Subtitle Bar -->
          <div class="w-full max-w-md bg-surface-container-lowest/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border-2 border-primary/50 flex items-center justify-between shadow-lg text-center">
            <div class="flex items-center gap-2.5 text-left">
              <div class="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center text-lg flex-shrink-0">
                <span class="material-symbols-outlined text-base">record_voice_over</span>
              </div>
              <div class="flex flex-col">
                <span class="text-[9px] font-black uppercase text-primary tracking-wider">Rex Battle Coach</span>
                <span id="scrub-action-hint" class="text-xs font-bold text-inverse-surface truncate max-w-[260px]">${currentRexCoachText}</span>
              </div>
            </div>
            
            <!-- Shouting powers badge -->
            <div class="hidden sm:flex items-center gap-1 text-[10px] font-black text-secondary bg-black/60 px-2.5 py-1 rounded-full border border-secondary/40">
              <span>🎙️ Voice Powers Active</span>
            </div>
          </div>

          <!-- Toddler Power Buttons & Start/Stop Button Bar -->
          <div class="w-full max-w-md flex items-center gap-2">
            
            ${
              !isBattleRunning
                ? `
              <button id="start-ar-battle-btn" class="w-full bg-primary text-on-primary font-headline text-base font-black py-3.5 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-2xl">cleaning_services</span> START 2-MIN BRUSHING BATTLE!
              </button>
            `
                : `
              <!-- Tactile Power-Up Buttons for Toddlers (Say or Tap!) -->
              <button id="hero-foam-blast-btn" class="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-headline text-xs font-black py-3 px-2 rounded-2xl chunky-btn-sm border-emerald-400 flex items-center justify-center gap-1.5 shadow-md active:scale-95">
                <span class="text-base">🫧</span> Blast! <span class="hidden sm:inline text-[9px] opacity-80">(Say "Blast!")</span>
              </button>

              <button id="hero-bubble-shield-btn" class="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-headline text-xs font-black py-3 px-2 rounded-2xl chunky-btn-sm border-cyan-400 flex items-center justify-center gap-1.5 shadow-md active:scale-95">
                <span class="text-base">🛡️</span> Shield! <span class="hidden sm:inline text-[9px] opacity-80">(Say "Shield!")</span>
              </button>
            `
            }

          </div>

        </div>

      </div>

      <!-- Info Footer -->
      <div class="bg-surface-container rounded-3xl p-3.5 sm:p-4 border-2 border-surface-container-highest card-shadow flex items-center justify-between text-xs text-on-surface-variant">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary text-xl">verified</span>
          <span>Dentist standard 2-minute battle across 4 quadrants. Hands-free auto-assist ensures fun for 3-4 year olds!</span>
        </div>
        <span class="text-error font-bold hidden sm:block">⚠️ Brush full 2 min for rewards</span>
      </div>

    </div>
  `;
}

// =========================================================================
// COMBAT & SHIELD SYSTEM
// =========================================================================
function applyBrushingHit(multiplier = 1) {
  if (isCaramelShieldActive) {
    // Damage Caramel Candy Armor
    caramelShieldHp = Math.max(0, caramelShieldHp - multiplier);
    updateCaramelShieldUI();

    Sound.laser();
    showComicHit(`CRACK! 🛡️ ${caramelShieldHp}/${caramelShieldMaxHp}`);

    if (caramelShieldHp <= 0) {
      shatterCaramelShield();
    }
    return;
  }

  // Regular Boss hit
  Sound.laser();
  if (Math.random() < 0.4) {
    showComicHit(multiplier > 1 ? 'ZONE CRITICAL! 🪥💥' : 'SCRUB HIT! ✨');
  }

  const boss = document.getElementById('boss-character');
  if (boss) {
    boss.classList.add('scale-105', 'brightness-125');
    setTimeout(() => boss.classList.remove('scale-105', 'brightness-125'), 180);
  }
}

function triggerCaramelShield() {
  isCaramelShieldActive = true;
  caramelShieldHp = caramelShieldMaxHp;
  Sound.speedUpBattleRhythm(true);

  const shieldEl = document.getElementById('boss-caramel-shield-layer');
  if (shieldEl) shieldEl.classList.remove('hidden');

  updateCaramelShieldUI();
  showComicHit('CARAMEL ARMOR! 🛡️⚡');
  voicePrompts.speak('Watch out! The Sugar Boss put up Caramel Candy Armor! Scrub super fast to shatter it!');

  geminiLiveService.setQuestContext({
    gameTitle: 'Toothbrush AR Battle',
    activeView: 'ar_battle',
    question: 'Sugar Boss cast Caramel Candy Armor! Help shatter it!',
    options: ['Toothpaste Blast', 'Bubble Shield', 'Scrub Combo']
  });
}

function updateCaramelShieldUI() {
  const bar = document.getElementById('caramel-shield-bar');
  const text = document.getElementById('caramel-shield-hp-text');
  if (bar) {
    const pct = Math.round((caramelShieldHp / caramelShieldMaxHp) * 100);
    bar.style.width = `${pct}%`;
  }
  if (text) {
    text.textContent = `Caramel Armor: ${caramelShieldHp}/${caramelShieldMaxHp} Hits`;
  }
}

function shatterCaramelShield() {
  isCaramelShieldActive = false;
  Sound.shieldShatter();
  Sound.speedUpBattleRhythm(false);

  const shieldEl = document.getElementById('boss-caramel-shield-layer');
  if (shieldEl) shieldEl.classList.add('hidden');

  showComicHit('SHIELD SHATTERED! 💥');
  voicePrompts.speak('Great job! You smashed the caramel candy armor! Keep scrubbing!');

  confetti({
    particleCount: 50,
    spread: 70,
    origin: { y: 0.35 },
    colors: ['#f59e0b', '#fbbf24', '#d97706', '#ffffff']
  });
}

// Hero Bubble Shield Power-up
export function activateHeroBubbleShield() {
  if (isHeroShieldActive) return;

  isHeroShieldActive = true;
  Sound.shieldDeflect();
  showComicHit('BUBBLE SHIELD! 🛡️✨');

  const shieldDome = document.getElementById('hero-bubble-shield-dome');
  if (shieldDome) shieldDome.classList.remove('hidden');

  const shieldBtn = document.getElementById('hero-bubble-shield-btn');
  if (shieldBtn) {
    shieldBtn.classList.add('ring-4', 'ring-cyan-400', 'bg-cyan-500/30');
  }

  if (heroShieldTimer) clearTimeout(heroShieldTimer);
  heroShieldTimer = setTimeout(() => {
    isHeroShieldActive = false;
    if (shieldDome) shieldDome.classList.add('hidden');
    if (shieldBtn) {
      shieldBtn.classList.remove('ring-4', 'ring-cyan-400', 'bg-cyan-500/30');
    }
  }, 6000);
}

// Toothpaste Foam Mega Blast Power-up
export function triggerMegaFoamBlast() {
  Sound.foamSploosh();
  showComicHit('FOAM CANNON BLAST! 🫧💥');

  if (isCaramelShieldActive) {
    caramelShieldHp = Math.max(0, caramelShieldHp - 4);
    updateCaramelShieldUI();
    if (caramelShieldHp <= 0) {
      shatterCaramelShield();
    }
  } else {
    const boss = document.getElementById('boss-character');
    if (boss) {
      boss.classList.add('scale-125', 'brightness-200', 'rotate-6');
      setTimeout(() => boss.classList.remove('scale-125', 'brightness-200', 'rotate-6'), 400);
    }
  }

  for (let i = 0; i < 10; i++) {
    setTimeout(() => spawnToothpasteFoam(), i * 60);
  }
}

// Cavity Slime Projectiles
function spawnSlimeAttack() {
  if (!isBattleRunning || activeSlime) return;

  const container = document.getElementById('battle-stage-container');
  if (!container) return;

  const slime = document.createElement('div');
  slime.className = 'absolute z-30 pointer-events-none transition-all duration-[2200ms] ease-in-out';
  slime.style.top = '25%';
  slime.style.left = '50%';
  slime.style.transform = 'translate(-50%, -50%) scale(0.5)';
  slime.innerHTML = `
    <div class="flex flex-col items-center animate-spin" style="animation-duration: 3s;">
      <span class="text-3xl drop-shadow-[0_0_12px_#a855f7]">👾</span>
      <span class="text-[9px] font-black text-purple-300 bg-black/80 px-2 py-0.5 rounded-full border border-purple-500">Cavity Slime!</span>
    </div>
  `;

  container.appendChild(slime);
  activeSlime = slime;

  requestAnimationFrame(() => {
    slime.style.top = '70%';
    slime.style.transform = 'translate(-50%, -50%) scale(1.3)';
  });

  setTimeout(() => {
    if (!activeSlime || !slime.parentNode) return;

    if (isHeroShieldActive) {
      Sound.shieldDeflect();
      showComicHit('SLIME DEFLECTED! 🛡️💥');

      slime.style.transitionDuration = '600ms';
      slime.style.top = '20%';
      slime.style.transform = 'translate(-50%, -50%) scale(0.3)';

      setTimeout(() => {
        slime.remove();
        activeSlime = null;
      }, 600);
    } else {
      Sound.hit();
      showComicHit('SLIME SPLAT! 🫧');
      slime.remove();
      activeSlime = null;
    }
  }, 2200);
}

// =========================================================================
// VFX & PARTICLES
// =========================================================================
function spawnToothpasteFoam(activeQuad) {
  const container = document.getElementById('foam-vfx-container');
  if (!container) return;

  const bubbleIcons = ['🫧', '✨', '🪥', '🫧', '⭐'];
  for (let i = 0; i < 2; i++) {
    const el = document.createElement('div');
    el.className = 'absolute text-lg sm:text-2xl pointer-events-none transition-all duration-700 select-none';
    el.textContent = bubbleIcons[Math.floor(Math.random() * bubbleIcons.length)];

    let leftPercent = 30 + Math.random() * 40;
    let topPercent = 35 + Math.random() * 40;

    if (activeQuad) {
      if (activeQuad.id === 'q1') { leftPercent = 65 + Math.random() * 25; topPercent = 20 + Math.random() * 30; }
      else if (activeQuad.id === 'q2') { leftPercent = 10 + Math.random() * 25; topPercent = 20 + Math.random() * 30; }
      else if (activeQuad.id === 'q3') { leftPercent = 65 + Math.random() * 25; topPercent = 55 + Math.random() * 30; }
      else if (activeQuad.id === 'q4') { leftPercent = 10 + Math.random() * 25; topPercent = 55 + Math.random() * 30; }
    }

    el.style.left = `${leftPercent}%`;
    el.style.top = `${topPercent}%`;
    el.style.transform = `translate(-50%, -50%) scale(0.5)`;
    el.style.opacity = '1';

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(${ (Math.random() - 0.5) * 60 }px, -${ 30 + Math.random() * 40 }px) scale(${ 1.1 + Math.random() * 0.4 })`;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      el.remove();
    }, 750);
  }
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
// CAMERA INITIALIZATION & MANAGEMENT
// =========================================================================
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
      console.warn('Camera access restricted or unavailable; fallback enabled.', err);
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

// =========================================================================
// BATTLE LIFECYCLE CONTROLLERS
// =========================================================================
export function startBattle() {
  isBattleRunning = true;
  secondsRemaining = store.getState().parentSettings?.arBattleDuration || 120;
  totalDuration = secondsRemaining;
  totalMotionHits = 0;
  isFallbackActive = false;
  currentCombo = 0;
  prevFrameData = null;
  isCaramelShieldActive = false;
  caramelShieldHp = 0;
  shieldMilestonesTriggered = { 90: false, 30: false };
  isHeroShieldActive = false;

  // Audio & Hardware Init
  Sound.startBattleRhythm();
  initCamera();
  initMotionDetector();

  // Rex Initial Spoken Cue
  const initialQuad = getActiveQuadrant(secondsRemaining, totalDuration);
  currentRexCoachText = initialQuad.coachMessage;
  voicePrompts.speak(initialQuad.coachMessage);

  geminiLiveService.setQuestContext({
    gameTitle: 'Toothbrush AR Battle',
    activeView: 'ar_battle',
    question: 'Quadrant 1: Upper Right teeth. Move toothbrush in circles!',
    options: ['Toothpaste Blast', 'Bubble Shield', 'Rex Roar']
  });

  // Re-render to switch button to battle powers
  store.notify();

  // 10 FPS Motion Check Interval
  if (motionCheckInterval) clearInterval(motionCheckInterval);
  motionCheckInterval = setInterval(checkToothbrushMotion, 100);

  // Slime Attack Interval (Every 18 seconds)
  if (slimeInterval) clearInterval(slimeInterval);
  slimeInterval = setInterval(spawnSlimeAttack, 18000);

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

    // Active Quadrant Transition Detection
    const activeQuad = getActiveQuadrant(secondsRemaining, totalDuration);
    updateQuadrantGridUI(activeQuad);

    // Update Rex Mirror Demo container
    const rexContainer = document.getElementById('rex-demo-svg-container');
    if (rexContainer) {
      rexContainer.innerHTML = renderRexMirrorDemoSvg(activeQuad, isToothbrushMoving);
    }

    // CARAMEL CANDY SHIELD TRIGGERS (At 90s remaining and 30s remaining)
    if (secondsRemaining === 90 && !shieldMilestonesTriggered[90]) {
      shieldMilestonesTriggered[90] = true;
      triggerCaramelShield();
    } else if (secondsRemaining === 30 && !shieldMilestonesTriggered[30]) {
      shieldMilestonesTriggered[30] = true;
      triggerCaramelShield();
    }

    // QUADRANT SPEECH ANNOUNCEMENTS
    if (secondsRemaining === 90) {
      voicePrompts.speak(QUADRANTS[1].coachMessage);
      currentRexCoachText = QUADRANTS[1].coachMessage;
    } else if (secondsRemaining === 60) {
      voicePrompts.speak(QUADRANTS[2].coachMessage);
      currentRexCoachText = QUADRANTS[2].coachMessage;
    } else if (secondsRemaining === 30) {
      voicePrompts.speak(QUADRANTS[3].coachMessage);
      currentRexCoachText = QUADRANTS[3].coachMessage;
    } else if (secondsRemaining === 10) {
      voicePrompts.speak(QUADRANTS[4].coachMessage);
      currentRexCoachText = QUADRANTS[4].coachMessage;
    }

    // TODDLER GRACE AUTO-ASSIST (Engages after 18s if low motion)
    if (elapsedSeconds >= 18 && !isFallbackActive && totalMotionHits < 10) {
      isFallbackActive = true;
      voicePrompts.speak('Hero Auto-Assist active! Keep on brushing to beat the sugar bugs!');
      showComicHit('AUTO-ASSIST ENGAGED! 🛡️');
      Sound.laser();
    }

    // AUTO-ASSIST PERIODIC ATTACK PULSE
    if (isFallbackActive && secondsRemaining % 3 === 0) {
      spawnToothpasteFoam(activeQuad);
      applyBrushingHit(1);
    }

    // BOSS HP BAR UPDATE
    const progressRatio = Math.min(1, elapsedSeconds / totalDuration);
    const hpPercent = Math.max(0, Math.round((1 - progressRatio) * 100));
    const hpBar = document.getElementById('boss-hp-bar');
    const hpText = document.getElementById('boss-hp-text');
    if (hpBar) hpBar.style.width = `${hpPercent}%`;
    if (hpText) hpText.textContent = `${hpPercent}% HP`;

    // WIN CONDITION (2 Minutes Complete)
    if (secondsRemaining <= 0) {
      concludeVictory();
    }
  }, 1000);
}

function updateQuadrantGridUI(activeQuad) {
  const cells = [
    { id: 'quadrant-cell-tl', isTarget: activeQuad.id === 'q2' },
    { id: 'quadrant-cell-tr', isTarget: activeQuad.id === 'q1' },
    { id: 'quadrant-cell-bl', isTarget: activeQuad.id === 'q4' },
    { id: 'quadrant-cell-br', isTarget: activeQuad.id === 'q3' }
  ];

  cells.forEach(({ id, isTarget }) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (isTarget) {
      el.className = 'relative rounded-2xl border-2 transition-all duration-300 flex flex-col justify-start items-start p-2.5 border-primary ring-4 ring-primary/40 bg-primary/15 shadow-[0_0_20px_rgba(84,233,138,0.5)]';
    } else {
      el.className = 'relative rounded-2xl border-2 transition-all duration-300 flex flex-col justify-start items-start p-2.5 border-white/10 bg-black/25 opacity-70';
    }
  });

  const hintEl = document.getElementById('scrub-action-hint');
  if (hintEl) hintEl.textContent = activeQuad.instruction;
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
  if (slimeInterval) {
    clearInterval(slimeInterval);
    slimeInterval = null;
  }

  isBattleRunning = false;
  Sound.stopBattleRhythm();
  stopCamera();

  // Boss Defeat Animation
  const boss = document.getElementById('boss-character');
  if (boss) {
    boss.classList.add('animate-villain-defeat');
  }

  // Celebratory Audio & Confetti
  Sound.fanfare();
  confetti({
    particleCount: 180,
    spread: 120,
    origin: { y: 0.5 },
    colors: ['#54e98a', '#ffb961', '#38bdf8', '#f1c40f', '#ec4899']
  });

  voicePrompts.speak('ROAAAR! Super victory, Hero! You defeated the Sugar Overlord and earned the Mint Knight Badge!');

  // Award Mint Knight Badge & Record to Household Ledger
  store.completeToothbrushBattle();
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
  if (slimeInterval) {
    clearInterval(slimeInterval);
    slimeInterval = null;
  }

  Sound.stopBattleRhythm();
  stopCamera();

  if (isBattleRunning && secondsRemaining > 0) {
    isBattleRunning = false;
    Sound.hit();
    store.showReward(
      'Boss Escaped!',
      'The Sugar Villain ran away! Brush for the full 2 minutes next time to earn your rewards!',
      0,
      0,
      sugarVillainEscapedImg,
      'sentiment_dissatisfied'
    );
  }

  isBattleRunning = false;
  store.navigate('dashboard');
}

// =========================================================================
// EVENT LISTENERS & HOOKS
// =========================================================================
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

  const foamBlastBtn = document.getElementById('hero-foam-blast-btn');
  if (foamBlastBtn) {
    foamBlastBtn.addEventListener('click', () => {
      triggerMegaFoamBlast();
    });
  }

  const shieldBtn = document.getElementById('hero-bubble-shield-btn');
  if (shieldBtn) {
    shieldBtn.addEventListener('click', () => {
      activateHeroBubbleShield();
    });
  }

  // Window Voice Power-Up Events (dispatched by Gemini Live & Rex Companion)
  const onRexFoam = () => {
    if (isBattleRunning) {
      triggerMegaFoamBlast();
    }
  };
  const onRexShield = () => {
    if (isBattleRunning) {
      activateHeroBubbleShield();
    }
  };
  const onRexCheer = (e) => {
    if (isBattleRunning) {
      showComicHit(e.detail?.quadrantName ? `CLEARED ${e.detail.quadrantName}! ⭐` : 'REX ROAR! 🦖⚡');
      Sound.chime();
    }
  };
  const onRexVictory = () => {
    if (isBattleRunning) {
      concludeVictory();
    }
  };

  window.addEventListener('rex-battle-foam', onRexFoam);
  window.addEventListener('rex-battle-shield', onRexShield);
  window.addEventListener('rex-battle-cheer', onRexCheer);
  window.addEventListener('rex-battle-victory', onRexVictory);

  // Initialize camera and motion detector
  initCamera();
  initMotionDetector();
}
