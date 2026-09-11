import { renderBoss3DViewer, initBoss3DViewer, getActiveBoss3DInstance } from '../components/Boss3DViewer.js';
import { renderPet3DViewer, initPet3DViewer, getActivePet3DInstance } from '../components/Pet3DViewer.js';
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
const sugarVillainEscapedImg = new URL('../assets/sugar_villain_escaped.jpg', import.meta.url).href;
import { voicePrompts } from '../utils/voicePrompts.js';
import { geminiLiveService } from '../services/geminiLiveService.js';
import { HYGIENE_BOSSES, DENTAL_BADGES, DENTAL_QUADRANTS, getHygieneBoss, getDentalQuadrant } from '../data/hygieneBossesData.js';
import { brushAudioAnalyzer } from '../audio/brushAudioAnalyzer.js';

// =========================================================================
// INTERACTIVE AR TOOTHBRUSH & HYGIENE BATTLE 2.0
// Boss Selection, Animated Boss Attacks on Teeth, Plaque Dissolve & Dual Sensors
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

// Dynamic Boss Shield & Attack System
let isBossShieldActive = false;
let bossShieldHp = 0;
let bossShieldMaxHp = 6;
let shieldMilestonesTriggered = { 90: false, 30: false };
let bossAttackInterval = null;
let currentBossAttackType = null;
let isHeroShieldActive = false;
let isCoPilotEnabled = true;
let heroShieldTimer = null;
let currentRexCoachText = 'Look in the mirror and brush in circles!';

// =========================================================================
// BOSS SVG RENDERING WITH ANIMATED ATTACK STATES
// =========================================================================
function renderBossCharacterSvg(boss, isAttacking = false, isDamaged = false) {
  const attackEffectClass = isAttacking ? 'scale-110 -translate-y-2 brightness-125' : '';
  const damageEffectClass = isDamaged ? 'animate-bounce brightness-150' : '';

  if (boss.id === 'sugar_bandit') {
    // Sugar Bandit King: Sticky Candy Mastermind with Caramel Slime
    return `
      <div id="boss-character" class="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center transition-all duration-200 ${attackEffectClass} ${damageEffectClass}">
        <svg class="w-full h-full drop-shadow-[0_12px_24px_rgba(243,156,18,0.4)] animate-villain-hover" viewBox="0 0 120 120" fill="none">
          <!-- Outer Sticky Caramel Spikes -->
          <polygon points="60,2 70,18 88,10 82,28 102,28 92,44 112,52 96,66 114,80 94,88 106,106 86,100 84,118 68,104 60,118 52,104 36,118 34,100 14,106 26,88 6,80 24,66 8,52 28,44 18,28 38,28 32,10 50,18" fill="#b45309" stroke="#f59e0b" stroke-width="2.5" />
          
          <!-- Round Body -->
          <circle cx="60" cy="62" r="38" fill="#d97706" />
          <circle cx="60" cy="62" r="32" fill="#f59e0b" />

          <!-- Sticky Bandit Mask -->
          <path d="M 28 46 Q 60 52 92 46 Q 90 60 60 58 Q 30 60 28 46 Z" fill="#78350f" />
          
          <!-- Candy Crown -->
          <polygon points="40,24 48,10 54,20 60,6 66,20 72,10 80,24" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
          <circle cx="60" cy="8" r="3" fill="#ef4444" />
          <circle cx="48" cy="12" r="2.5" fill="#3b82f6" />
          <circle cx="72" cy="12" r="2.5" fill="#10b981" />

          <!-- Mischievous Eyes -->
          <ellipse cx="46" cy="50" rx="7" ry="8" fill="#ffffff" />
          <circle cx="48" cy="50" r="4" fill="#1e293b" />
          <circle cx="49" cy="49" r="1.5" fill="#ffffff" />

          <ellipse cx="74" cy="50" rx="7" ry="8" fill="#ffffff" />
          <circle cx="72" cy="50" r="4" fill="#1e293b" />
          <circle cx="71" cy="49" r="1.5" fill="#ffffff" />

          <!-- Snickering Caramel Mouth -->
          <path d="M 42 70 Q 60 ${isAttacking ? '88' : '80'} 78 70 Q 60 76 42 70 Z" fill="#451a03" stroke="#78350f" stroke-width="1.5" />
          <!-- Sharp Candy Teeth -->
          <polygon points="46,70 50,76 54,70" fill="#fef08a" />
          <polygon points="56,71 60,78 64,71" fill="#ffffff" />
          <polygon points="66,70 70,76 74,70" fill="#fef08a" />

          <!-- Dripping Caramel Splatters -->
          <path d="M 48 76 Q 50 94 48 102 Q 46 94 48 76" fill="#b45309" class="animate-pulse" />
          <path d="M 68 76 Q 70 98 68 106 Q 66 98 68 76" fill="#b45309" class="animate-pulse" />
          <circle cx="48" cy="104" r="3" fill="#f59e0b" />
          <circle cx="68" cy="108" r="3.5" fill="#f59e0b" />
        </svg>

        ${isAttacking ? `
          <!-- Caramel Attack Projectile Splatter toward Teeth -->
          <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-bounce">
            <span class="text-3xl drop-shadow-[0_0_12px_#f59e0b]">🍯</span>
            <span class="text-[9px] font-black text-amber-300 bg-black/80 px-2 py-0.5 rounded-full border border-amber-500">CARAMEL SLIME!</span>
          </div>
        ` : ''}
      </div>
    `;
  } else if (boss.id === 'plaque_kraken') {
    // Plaque Kraken: Deep Biofilm Terror with Swirling Tentacles
    return `
      <div id="boss-character" class="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center transition-all duration-200 ${attackEffectClass} ${damageEffectClass}">
        <svg class="w-full h-full drop-shadow-[0_12px_24px_rgba(16,185,129,0.4)] animate-villain-hover" viewBox="0 0 120 120" fill="none">
          <!-- Kraken Outer Biofilm Aura -->
          <circle cx="60" cy="55" r="42" fill="#064e3b" opacity="0.3" />
          
          <!-- Swirling Biofilm Tentacles Attacking Teeth -->
          <path d="M 24 60 Q 10 80 18 105 Q 26 88 32 74" fill="#047857" stroke="#10b981" stroke-width="2" class="animate-pulse" />
          <path d="M 38 70 Q 28 95 38 116 Q 44 98 46 80" fill="#059669" stroke="#34d399" stroke-width="2" />
          <path d="M 82 70 Q 92 95 82 116 Q 76 98 74 80" fill="#059669" stroke="#34d399" stroke-width="2" />
          <path d="M 96 60 Q 110 80 102 105 Q 94 88 88 74" fill="#047857" stroke="#10b981" stroke-width="2" class="animate-pulse" />

          <!-- Main Dome Head -->
          <ellipse cx="60" cy="50" rx="36" ry="32" fill="#065f46" stroke="#10b981" stroke-width="2.5" />
          <ellipse cx="60" cy="50" rx="30" ry="26" fill="#10b981" />

          <!-- Big Glowing Kraken Eye -->
          <circle cx="60" cy="46" r="14" fill="#ffffff" stroke="#047857" stroke-width="2" />
          <circle cx="60" cy="46" r="8" fill="#0f172a" />
          <circle cx="58" cy="43" r="3" fill="#34d399" />
          <circle cx="62" cy="48" r="1.5" fill="#ffffff" />

          <!-- Biofilm Sucker Rings -->
          <circle cx="38" cy="38" r="4" fill="#a7f3d0" opacity="0.7" />
          <circle cx="82" cy="38" r="4" fill="#a7f3d0" opacity="0.7" />
          <circle cx="50" cy="26" r="3" fill="#a7f3d0" opacity="0.6" />
          <circle cx="70" cy="26" r="3" fill="#a7f3d0" opacity="0.6" />

          <!-- Grumbling Biofilm Beak -->
          <path d="M 48 68 Q 60 80 72 68 Q 60 74 48 68 Z" fill="#022c22" />
          <polygon points="54,68 60,74 66,68" fill="#d1fae5" />
        </svg>

        ${isAttacking ? `
          <!-- Kraken Biofilm Ink Attack toward Teeth -->
          <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-bounce">
            <span class="text-3xl drop-shadow-[0_0_12px_#10b981]">🧪</span>
            <span class="text-[9px] font-black text-emerald-300 bg-black/80 px-2 py-0.5 rounded-full border border-emerald-500">BIOFILM INK SPLAT!</span>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    // Cavity Knight: Acidic Enamel Crusher with Heavy Armor & Sugar Lance
    return `
      <div id="boss-character" class="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center transition-all duration-200 ${attackEffectClass} ${damageEffectClass}">
        <svg class="w-full h-full drop-shadow-[0_12px_24px_rgba(239,68,68,0.4)] animate-villain-hover" viewBox="0 0 120 120" fill="none">
          <!-- Knight Armor Shoulder Plates -->
          <ellipse cx="28" cy="74" rx="16" ry="12" fill="#450a0a" stroke="#dc2626" stroke-width="2" />
          <ellipse cx="92" cy="74" rx="16" ry="12" fill="#450a0a" stroke="#dc2626" stroke-width="2" />
          
          <!-- Horned Enamel-Crushing Helmet -->
          <path d="M 32 30 Q 18 10 8 18 Q 22 36 34 42 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2" />
          <path d="M 88 30 Q 102 10 112 18 Q 98 36 86 42 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2" />

          <!-- Main Helmet Head -->
          <circle cx="60" cy="54" r="34" fill="#7f1d1d" stroke="#ef4444" stroke-width="3" />
          <circle cx="60" cy="54" r="28" fill="#991b1b" />

          <!-- Visor Slit with Glowing Red Acid Eyes -->
          <rect x="36" y="46" width="48" height="14" rx="7" fill="#18181b" stroke="#f87171" stroke-width="1.5" />
          <ellipse cx="48" cy="53" rx="5" ry="3" fill="#facc15" class="animate-pulse" />
          <circle cx="48" cy="53" r="1.5" fill="#ffffff" />
          <ellipse cx="72" cy="53" rx="5" ry="3" fill="#facc15" class="animate-pulse" />
          <circle cx="72" cy="53" r="1.5" fill="#ffffff" />

          <!-- Acidic Mouth Grill -->
          <rect x="44" y="68" width="32" height="10" rx="3" fill="#27272a" stroke="#dc2626" stroke-width="1.5" />
          <line x1="50" y1="68" x2="50" y2="78" stroke="#ef4444" stroke-width="2" />
          <line x1="56" y1="68" x2="56" y2="78" stroke="#ef4444" stroke-width="2" />
          <line x1="62" y1="68" x2="62" y2="78" stroke="#ef4444" stroke-width="2" />
          <line x1="68" y1="68" x2="68" y2="78" stroke="#ef4444" stroke-width="2" />
          <line x1="74" y1="68" x2="74" y2="78" stroke="#ef4444" stroke-width="2" />

          <!-- Sugar Lance Weapon Pointing Down at Teeth -->
          <path d="M 92 48 L 110 98 L 96 90 Z" fill="#facc15" stroke="#ea580c" stroke-width="2" class="animate-pulse" />
        </svg>

        ${isAttacking ? `
          <!-- Acidic Lance Thrust toward Teeth -->
          <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-bounce">
            <span class="text-3xl drop-shadow-[0_0_12px_#ef4444]">⚔️⚡</span>
            <span class="text-[9px] font-black text-rose-300 bg-black/80 px-2 py-0.5 rounded-full border border-rose-500">ACID LANCE STRIKE!</span>
          </div>
        ` : ''}
      </div>
    `;
  }
}

// =========================================================================
// INTERACTIVE HIGH-CONTRAST DENTAL ARCH (KIDS' TEETH & PLAQUE DISSOLVE)
// =========================================================================
function renderMouthArchSvg(activeQuad) {
  // Plaque opacities based on clean progress (1.0 = dirty, 0.0 = diamond clean)
  const op1 = Math.max(0, 1 - (quadrantCleanliness.q1 / 100));
  const op2 = Math.max(0, 1 - (quadrantCleanliness.q2 / 100));
  const op3 = Math.max(0, 1 - (quadrantCleanliness.q3 / 100));
  const op4 = Math.max(0, 1 - (quadrantCleanliness.q4 / 100));
  const op5 = Math.max(0, 1 - (quadrantCleanliness.q5 / 100));

  return `
    <div id="interactive-mouth-map" class="relative w-full max-w-[340px] sm:max-w-[400px] h-[190px] sm:h-[220px] select-none cursor-pointer">
      <svg class="w-full h-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]" viewBox="0 0 360 200" fill="none">
        <defs>
          <radialGradient id="mouth-cavity-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#4c0519" />
            <stop offset="70%" stop-color="#2a020d" />
            <stop offset="100%" stop-color="#140106" />
          </radialGradient>
          <linearGradient id="gum-upper-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f43f5e" />
            <stop offset="100%" stop-color="#be123c" />
          </linearGradient>
          <linearGradient id="gum-lower-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#be123c" />
            <stop offset="100%" stop-color="#9f1239" />
          </linearGradient>
          <radialGradient id="plaque-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="80%" stop-color="#84cc16" />
            <stop offset="100%" stop-color="#65a30d" />
          </radialGradient>
        </defs>

        <!-- Outer Lips / Mouth Cavity Base -->
        <ellipse cx="180" cy="100" rx="165" ry="88" fill="url(#mouth-cavity-grad)" stroke="#fda4af" stroke-width="4" />

        <!-- Tongue in Center (Zone 5) -->
        <g id="dental-arch-q5" class="${activeQuad.id === 'q5' ? 'animate-pulse ring-2' : ''}">
          <ellipse cx="180" cy="122" rx="60" ry="32" fill="#fb7185" stroke="#f43f5e" stroke-width="2.5" />
          <path d="M 180 100 L 180 134" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" />
          <!-- Plaque Layer on Tongue -->
          <ellipse cx="180" cy="120" rx="42" ry="18" fill="url(#plaque-grad)" opacity="${op5 * 0.85}" />
          ${op5 <= 0.2 ? '<circle cx="180" cy="115" r="5" fill="#ffffff" class="animate-ping" /><text x="172" y="124" font-size="14">✨</text>' : ''}
        </g>

        <!-- Upper Gums Arch -->
        <path d="M 45 68 Q 180 20 315 68 Q 180 34 45 68 Z" fill="url(#gum-upper-grad)" />

        <!-- ========================================== -->
        <!-- UPPER LEFT QUADRANT (Zone 2: Kid's Top Left Teeth) -->
        <!-- ========================================== -->
        <g id="dental-arch-q2" class="cursor-pointer">
          <!-- Teeth: Incisors to Molars -->
          <rect x="75" y="48" width="22" height="26" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="100" y="42" width="22" height="28" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="125" y="38" width="24" height="30" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="152" y="36" width="24" height="32" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />

          <!-- Plaque & Sugar Bug Overlay (Dissolves as kid brushes!) -->
          <g opacity="${op2}">
            <ellipse cx="115" cy="52" rx="42" ry="14" fill="url(#plaque-grad)" opacity="0.9" />
            <text x="86" y="58" font-size="11">👾</text>
            <text x="135" y="56" font-size="11">🍬</text>
          </g>

          <!-- Gleam Diamond Stars when Clean -->
          ${op2 <= 0.15 ? `
            <text x="95" y="48" font-size="14" class="animate-bounce">💎</text>
            <text x="140" y="45" font-size="13" class="animate-pulse">✨</text>
          ` : ''}
        </g>

        <!-- ========================================== -->
        <!-- UPPER RIGHT QUADRANT (Zone 1: Kid's Top Right Teeth) -->
        <!-- ========================================== -->
        <g id="dental-arch-q1" class="cursor-pointer">
          <rect x="184" y="36" width="24" height="32" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="211" y="38" width="24" height="30" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="238" y="42" width="22" height="28" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="263" y="48" width="22" height="26" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />

          <!-- Plaque & Sugar Bug Overlay (Dissolves as kid brushes!) -->
          <g opacity="${op1}">
            <ellipse cx="245" cy="52" rx="42" ry="14" fill="url(#plaque-grad)" opacity="0.9" />
            <text x="215" y="56" font-size="11">🍬</text>
            <text x="255" y="58" font-size="11">👾</text>
          </g>

          <!-- Gleam Diamond Stars when Clean -->
          ${op1 <= 0.15 ? `
            <text x="210" y="45" font-size="13" class="animate-pulse">✨</text>
            <text x="250" y="48" font-size="14" class="animate-bounce">💎</text>
          ` : ''}
        </g>

        <!-- Lower Gums Arch -->
        <path d="M 45 132 Q 180 178 315 132 Q 180 164 45 132 Z" fill="url(#gum-lower-grad)" />

        <!-- ========================================== -->
        <!-- LOWER LEFT QUADRANT (Zone 4: Kid's Bottom Left Teeth) -->
        <!-- ========================================== -->
        <g id="dental-arch-q4" class="cursor-pointer">
          <rect x="80" y="126" width="20" height="24" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="103" y="130" width="22" height="26" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="128" y="134" width="22" height="28" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="153" y="136" width="23" height="28" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />

          <!-- Plaque & Sugar Bug Overlay -->
          <g opacity="${op4}">
            <ellipse cx="120" cy="146" rx="42" ry="12" fill="url(#plaque-grad)" opacity="0.9" />
            <text x="96" y="148" font-size="11">👾</text>
            <text x="136" y="152" font-size="11">🍭</text>
          </g>

          ${op4 <= 0.15 ? `
            <text x="105" y="150" font-size="14" class="animate-bounce">💎</text>
            <text x="140" y="152" font-size="13" class="animate-pulse">✨</text>
          ` : ''}
        </g>

        <!-- ========================================== -->
        <!-- LOWER RIGHT QUADRANT (Zone 3: Kid's Bottom Right Teeth) -->
        <!-- ========================================== -->
        <g id="dental-arch-q3" class="cursor-pointer">
          <rect x="184" y="136" width="23" height="28" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="210" y="134" width="22" height="28" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="235" y="130" width="22" height="26" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="260" y="126" width="20" height="24" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />

          <!-- Plaque & Sugar Bug Overlay -->
          <g opacity="${op3}">
            <ellipse cx="240" cy="146" rx="42" ry="12" fill="url(#plaque-grad)" opacity="0.9" />
            <text x="210" y="152" font-size="11">🍭</text>
            <text x="250" y="148" font-size="11">👾</text>
          </g>

          ${op3 <= 0.15 ? `
            <text x="215" y="152" font-size="13" class="animate-pulse">✨</text>
            <text x="245" y="150" font-size="14" class="animate-bounce">💎</text>
          ` : ''}
        </g>

        <!-- DYNAMIC ACTIVE QUADRANT TARGET HIGHLIGHT BEACON -->
        ${activeQuad.id === 'q1' ? `
          <rect x="182" y="32" width="106" height="46" rx="12" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="6,3" class="animate-pulse" />
          <polygon points="235,16 245,28 225,28" fill="#facc15" class="animate-bounce" />
          <text x="200" y="24" font-size="10" font-weight="900" fill="#fef08a">BRUSH HERE! 🪥</text>
        ` : ''}

        ${activeQuad.id === 'q2' ? `
          <rect x="72" y="32" width="106" height="46" rx="12" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="6,3" class="animate-pulse" />
          <polygon points="125,16 135,28 115,28" fill="#facc15" class="animate-bounce" />
          <text x="90" y="24" font-size="10" font-weight="900" fill="#fef08a">BRUSH HERE! 🪥</text>
        ` : ''}

        ${activeQuad.id === 'q3' ? `
          <rect x="182" y="122" width="102" height="46" rx="12" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="6,3" class="animate-pulse" />
          <polygon points="235,188 245,176 225,176" fill="#facc15" class="animate-bounce" />
          <text x="200" y="196" font-size="10" font-weight="900" fill="#fef08a">BRUSH HERE! 🪥</text>
        ` : ''}

        ${activeQuad.id === 'q4' ? `
          <rect x="76" y="122" width="104" height="46" rx="12" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="6,3" class="animate-pulse" />
          <polygon points="125,188 135,176 115,176" fill="#facc15" class="animate-bounce" />
          <text x="90" y="196" font-size="10" font-weight="900" fill="#fef08a">BRUSH HERE! 🪥</text>
        ` : ''}

        ${activeQuad.id === 'q5' ? `
          <ellipse cx="180" cy="122" rx="64" ry="36" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6,3" class="animate-pulse" />
          <text x="145" y="92" font-size="10" font-weight="900" fill="#7dd3fc">TONGUE POLISH! 👅</text>
        ` : ''}
      </svg>

      <!-- Click to Scrub Hint Tag -->
      <div class="absolute bottom-1 right-2 bg-black/75 px-2 py-0.5 rounded-full border border-white/20 text-[9px] font-black text-white/80 pointer-events-none">
        👆 Tap teeth to scrub!
      </div>
    </div>
  `;
}

// =========================================================================
// REX DINO MIRROR DEMO CARD (PICTURE-IN-PICTURE)
// =========================================================================
function renderRexMirrorDemoSvg(activeQuadrant, isBrushing = true) {
  const isTongue = activeQuadrant?.id === 'q5';
  const brushPos = activeQuadrant?.brushPosition || { x: 58, y: 55, rotation: -20 };
  const animClass = isTongue ? 'animate-tongue-scrub' : 'animate-dino-scrub';

  return `
    <div class="relative w-full flex flex-col items-center justify-center select-none pointer-events-none">
      <svg class="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-md" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rex-skin" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stop-color="#22c55e" />
            <stop offset="1" stop-color="#15803d" />
          </linearGradient>
        </defs>

        <!-- Dino Head Base -->
        <circle cx="50" cy="50" r="44" fill="url(#rex-skin)" stroke="#166534" stroke-width="2" />
        <!-- Spikes -->
        <path d="M26 18L32 8L38 18Z" fill="#f59e0b" stroke="#b45309" stroke-width="1" />
        <path d="M44 14L50 4L56 14Z" fill="#f59e0b" stroke="#b45309" stroke-width="1" />
        <path d="M62 18L68 8L74 18Z" fill="#f59e0b" stroke="#b45309" stroke-width="1" />

        <!-- Snout -->
        <ellipse cx="50" cy="62" rx="26" ry="20" fill="#4ade80" />

        <!-- Friendly Eyes -->
        <circle cx="36" cy="38" r="7" fill="#ffffff" />
        <circle cx="37" cy="38" r="4" fill="#0f172a" />
        <circle cx="64" cy="38" r="7" fill="#ffffff" />
        <circle cx="63" cy="38" r="4" fill="#0f172a" />

        <!-- Open Mouth with Teeth -->
        <ellipse cx="50" cy="66" rx="18" ry="12" fill="#881337" stroke="#4c0519" stroke-width="1.5" />
        <ellipse cx="50" cy="72" rx="10" ry="6" fill="#f43f5e" />

        <!-- Cartoon Teeth -->
        <rect x="38" y="56" width="4" height="5" rx="1.5" fill="#ffffff" />
        <rect x="44" y="56" width="4" height="6" rx="1.5" fill="#ffffff" />
        <rect x="52" y="56" width="4" height="6" rx="1.5" fill="#ffffff" />
        <rect x="58" y="56" width="4" height="5" rx="1.5" fill="#ffffff" />

        <!-- Toothbrush in Hand Scrubbing -->
        <g class="${isBrushing ? animClass : ''}" style="transform-origin: ${brushPos.x}px ${brushPos.y}px;">
          <rect x="${brushPos.x - 2}" y="${brushPos.y + 2}" width="4" height="18" rx="2" fill="#38bdf8" stroke="#0284c7" stroke-width="1" />
          <rect x="${brushPos.x - 4}" y="${brushPos.y - 4}" width="8" height="7" rx="2" fill="#e0f2fe" stroke="#38bdf8" stroke-width="0.8" />
          <circle cx="${brushPos.x}" cy="${brushPos.y - 4}" r="2.5" fill="#2dd4bf" />
        </g>
      </svg>
      <div class="text-[9px] font-black text-white/90 text-center leading-tight mt-0.5">
        ${activeQuadrant?.shortName || 'Brushing'}
      </div>
    </div>
  `;
}

// =========================================================================
// MAIN BATTLE VIEW RENDER FUNCTION
// =========================================================================
export function renderBattleView() {
  const currentBoss = getHygieneBoss(selectedBossId);
  const badges = store.getDentalBadges();

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
              🪥
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="bg-primary text-on-primary text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Battle 2.0</span>
                <span class="text-xs font-bold text-on-surface-variant">Dentist Approved</span>
              </div>
              <h1 class="font-headline text-xl sm:text-2xl font-black text-on-surface mt-1">Toothbrush AR Battle</h1>
              <p class="text-xs text-on-surface-variant mt-0.5 max-w-md">Choose your Hygiene Boss, turn on the Magic Mirror, and brush away plaque to earn sparks & badges!</p>
            </div>
          </div>

          <!-- Quick Badges Preview -->
          <div class="flex items-center gap-1.5 bg-black/20 p-2 rounded-2xl border border-white/10">
            ${badges.map(b => `
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
              <span class="material-symbols-outlined text-base text-primary">swords</span> Select Hygiene Boss:
            </h2>
            <span class="text-xs text-on-surface-variant">Tap to choose</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${HYGIENE_BOSSES.map(b => {
              const isSelected = b.id === selectedBossId;
              return `
                <div data-boss-id="${b.id}" class="boss-select-card cursor-pointer relative bg-surface-container-high rounded-3xl p-4 border-4 transition-all duration-200 ${isSelected ? b.accentBorder + ' bg-gradient-to-b ' + b.gradient + ' scale-[1.02] shadow-xl' : 'border-surface-container-highest hover:border-white/30'} flex flex-col justify-between gap-3">
                  
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

                  <div class="bg-black/30 rounded-2xl p-2.5 border border-white/10 flex flex-col gap-1 text-[10px]">
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span>🛡️ Boss Shield:</span>
                      <span class="font-bold text-amber-300">${b.shieldName}</span>
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span>⚡ Weakness:</span>
                      <span class="font-bold text-primary">${b.weakness}</span>
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

        <!-- START BATTLE ACTION CONTAINER -->
        <div class="bg-surface-container-high rounded-3xl p-4 sm:p-5 border-2 border-surface-container-highest flex flex-col sm:flex-row items-center justify-between gap-4 card-shadow">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary border border-secondary/40 flex items-center justify-center text-2xl">
              ${currentBoss.avatar}
            </div>
            <div>
              <div class="text-xs text-on-surface-variant font-bold">Selected Encounter:</div>
              <div class="font-headline text-base font-black text-on-surface">${currentBoss.name}</div>
              <div class="text-[10px] text-primary font-bold">Dual-Sensor Motion + Acoustic Mic Ready</div>
            </div>
          </div>

          <button id="start-ar-battle-btn" class="w-full sm:w-auto bg-primary text-on-primary font-headline text-base font-black px-8 py-4 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-2xl">swords</span> START 2-MIN BRUSHING BATTLE!
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
  // ACTIVE BATTLE ARENA (DURING BATTLE)
  // Clean, uncluttered layout: Boss attacking teeth, real-time plaque dissolve
  // =========================================================================
  const elapsed = totalDuration - secondsRemaining;
  const progressRatio = Math.min(1, elapsed / totalDuration);
  const hpPercent = Math.max(0, Math.round((1 - progressRatio) * 100));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

  return `
    <div class="max-w-4xl mx-auto px-2 sm:px-4 pt-2 pb-24 flex flex-col gap-2.5 animate-fade-in select-none">
      
      <!-- TOP HUD BAR (Clean, non-overlapping) -->
      <div class="flex items-center justify-between gap-2 z-20">
        
        <!-- Quit Button -->
        <button id="battle-quit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3 py-2 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1 chunky-btn-sm active:scale-95 flex-shrink-0">
          <span class="material-symbols-outlined text-base">close</span> Quit
        </button>

        <!-- Boss Health & Shield Meter Pill -->
        <div class="flex-1 max-w-sm bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20 shadow flex flex-col gap-1">
          <div class="flex justify-between items-center text-[11px] font-black">
            <span class="flex items-center gap-1 text-white truncate">
              <span>${currentBoss.avatar}</span>
              <span class="truncate">${currentBoss.name}</span>
            </span>
            <span id="boss-hp-text" class="text-secondary font-black flex-shrink-0">${hpPercent}% HP</span>
          </div>

          <div class="w-full h-3 bg-black/80 rounded-full border border-error/50 overflow-hidden">
            <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-error via-secondary to-primary rounded-full transition-all duration-300" style="width: ${hpPercent}%;"></div>
          </div>

          ${isBossShieldActive ? `
            <!-- Shield Bar Layer -->
            <div id="boss-shield-layer" class="flex justify-between items-center text-[9px] font-black text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/50 mt-0.5 animate-pulse">
              <span>🛡️ ${currentBoss.shieldName}: ${bossShieldHp}/${bossShieldMaxHp}</span>
              <span class="animate-bounce">SCRUB TO SHATTER! 💥</span>
            </div>
          ` : ''}
        </div>

        <!-- Dual-Sensor Status & Timer -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Live Sensor Pill -->
          <div id="dual-sensor-pill" class="hidden sm:flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1.5 rounded-2xl border border-surface-container-highest text-[10px] font-black text-primary shadow-sm">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span id="sensor-status-label">${isToothbrushMoving ? '🔥 Scrubbing!' : '🪥 Sensor Ready'}</span>
          </div>

          <!-- Timer -->
          <div class="bg-surface-container-high px-3 py-1.5 rounded-2xl border-2 border-secondary-container flex items-center gap-1.5 shadow-md">
            <span class="material-symbols-outlined text-secondary text-base" style="font-variation-settings: 'FILL' 1;">timer</span>
            <span id="battle-timer-display" class="font-headline text-base sm:text-lg font-black text-secondary tracking-wider">${timeStr}</span>
          </div>
        </div>

      </div>

      <!-- MAIN AR BATTLE ARENA -->
      <div id="battle-stage-container" class="relative bg-[#050f18] rounded-3xl border-4 border-primary/50 min-h-[480px] sm:min-h-[520px] card-shadow-lg flex flex-col justify-between items-center overflow-hidden">
        
        <!-- Camera Mirror Feed (Flipped) -->
        <video id="ar-camera-feed" class="absolute inset-0 w-full h-full object-cover transform -scale-x-100 z-0 bg-[#050f18]" autoplay playsinline muted></video>
        
        <!-- Dark Ambient Gradient Overlay for Clean Legibility -->
        <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/85 pointer-events-none z-0"></div>

        <!-- Camera Off / Permission Helper Tag -->
        <div id="camera-status-pill" class="absolute top-2 right-2 z-10 ${isCameraActive ? 'hidden' : ''}">
          <button id="enable-camera-btn" class="bg-black/80 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1 shadow">
            <span class="material-symbols-outlined text-xs text-primary">videocam</span> Magic Mirror (Tap to Turn On)
          </button>
        </div>

        <!-- UPPER ARENA: ANIMATED BOSS ATTACKING TEETH -->
        <div class="relative z-10 w-full flex flex-col items-center pt-2">
          <div id="boss-character-wrapper" class="relative flex flex-col items-center w-full">
            ${renderBoss3DViewer({
              canvasId: 'boss-3d-canvas',
              bossId: currentBoss.id,
              width: 320,
              height: 260,
              showBadge: true
            })}
          </div>
        </div>

        <!-- HERO BUBBLE SHIELD DOME -->
        <div id="hero-bubble-shield-dome" class="${isHeroShieldActive ? '' : 'hidden'} absolute inset-x-6 inset-y-12 rounded-3xl border-4 border-cyan-300 bg-cyan-500/15 backdrop-blur-[1px] animate-hero-bubble flex items-center justify-center pointer-events-none z-25">
          <div class="bg-black/85 px-4 py-2 rounded-full border border-cyan-400 text-cyan-300 font-headline font-black text-xs shadow-xl flex items-center gap-2">
            <span class="material-symbols-outlined text-base animate-spin">shield</span>
            <span>HERO BUBBLE SHIELD ACTIVE! ATTACKS BLOCKED!</span>
          </div>
        </div>

        <!-- Dynamic Foam VFX Container -->
        <div id="foam-vfx-container" class="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-30"></div>

        <!-- Comic Hit Popup -->
        <div id="comic-hit-badge" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 transition-all duration-300 z-35 text-center">
          <span class="bg-gradient-to-r from-primary via-secondary to-primary text-on-primary font-headline text-sm sm:text-base font-black px-5 py-2 rounded-full shadow-2xl border-2 border-white scale-125">
            SCRUB POWER! 🪥✨
          </span>
        </div>

        <!-- LOWER-CENTER ARENA: INTERACTIVE KIDS' TEETH & PLAQUE DISSOLVE ARCH -->
        <div class="relative z-20 w-full flex flex-col items-center px-2 mb-2">
          
          <!-- Current Active Quadrant Instruction Banner -->
          <div class="flex items-center gap-2 bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-primary/60 shadow-md mb-1.5">
            <span class="text-sm">${activeQuad.icon}</span>
            <span class="text-xs font-black text-primary">Zone ${activeQuad.zone}: ${activeQuad.name}</span>
            <span class="text-[10px] text-white/80 font-bold hidden sm:inline">• ${activeQuad.instruction}</span>
          </div>

          <!-- Dental Arch SVG with Real-time Plaque Dissolve & 3D Splatter Overlay -->
          <div class="relative w-full flex items-center justify-center">
            ${renderMouthArchSvg(activeQuad)}
            <!-- Sticky Slime Splatters on Teeth Layer -->
            <div id="teeth-splatter-overlay" class="absolute inset-0 pointer-events-none z-10 overflow-visible"></div>
            <!-- Frothy Foam Trails Layer -->
            <div id="teeth-foam-overlay" class="absolute inset-0 pointer-events-none z-20 overflow-visible"></div>
          </div>

        </div>

        <!-- PICTURE-IN-PICTURE REX DINO COACH / 3D CO-PILOT (Bottom Left Corner) -->
        <div id="rex-coach-card" class="absolute left-2.5 bottom-16 sm:bottom-20 z-20 bg-black/85 backdrop-blur-md rounded-2xl border-2 border-primary/60 p-2 shadow-2xl flex flex-col items-center max-w-[120px] sm:max-w-[135px]">
          <div class="text-[9px] font-black uppercase text-primary border-b border-white/10 pb-0.5 w-full flex items-center justify-between px-0.5">
            <span>🦖 Co-Pilot</span>
            <button id="copilot-toggle-btn" class="text-[8px] bg-white/10 hover:bg-white/20 px-1 py-0.5 rounded text-white font-bold" title="Toggle 3D Pet Co-Pilot">
              ${isCoPilotEnabled ? '3D' : '2D'}
            </button>
          </div>
          <div id="rex-demo-svg-container" class="w-full flex justify-center py-0.5">
            ${
              isCoPilotEnabled
                ? renderPet3DViewer({
                    canvasId: 'battle-copilot-3d-canvas',
                    petId: store.getActivePet()?.id || 'rex',
                    stage: store.getActivePet()?.stage || 1,
                    mode: 'sanctuary',
                    width: 105,
                    height: 105,
                    showControls: false
                  })
                : renderRexMirrorDemoSvg(activeQuad, isToothbrushMoving)
            }
          </div>
        </div>

        <!-- BOTTOM CONTROLS & TACTILE POWER BUTTONS -->
        <div class="w-full z-20 pb-2.5 px-3 flex flex-col items-center gap-2">
          
          <!-- Live Coach Subtitle Bar -->
          <div class="w-full max-w-md bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 flex items-center justify-between text-left shadow">
            <div class="flex items-center gap-2">
              <span class="text-base">🎙️</span>
              <span id="scrub-action-hint" class="text-xs font-bold text-white truncate max-w-[280px] sm:max-w-[340px]">${currentRexCoachText}</span>
            </div>
            <div class="flex items-center gap-1 text-[10px] font-black text-secondary">
              <span>⚡</span>
              <span id="cadence-score-label">${micCadenceScore}% Cadence</span>
            </div>
          </div>

          <!-- Tactile Action Power Buttons (Zero-Frustration Accessibility) -->
          <div class="w-full max-w-md flex items-center gap-2">
            
            <button id="hero-foam-blast-btn" class="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-headline text-xs font-black py-2.5 px-2 rounded-2xl chunky-btn-sm border-emerald-400 flex items-center justify-center gap-1 shadow-md active:scale-95">
              <span>🫧</span> Foam Blast!
            </button>

            <button id="hero-bubble-shield-btn" class="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-headline text-xs font-black py-2.5 px-2 rounded-2xl chunky-btn-sm border-cyan-400 flex items-center justify-center gap-1 shadow-md active:scale-95">
              <span>🛡️</span> Bubble Shield!
            </button>

            <button id="hero-manual-scrub-btn" class="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-headline text-xs font-black py-2.5 px-2 rounded-2xl chunky-btn-sm border-amber-400 flex items-center justify-center gap-1 shadow-md active:scale-95">
              <span>🪥</span> Tap Scrub!
            </button>

          </div>

        </div>

      </div>

      <!-- BOTTOM BANNER -->
      <div class="bg-surface-container rounded-2xl p-2.5 border border-surface-container-highest flex items-center justify-between text-xs text-on-surface-variant">
        <div class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-secondary text-base">verified</span>
          <span>Dentist standard 2-minute 4-quadrant routine with tongue polish.</span>
        </div>
        <span class="text-primary font-bold hidden sm:inline">+15 Evolution Sparks ⚡ to Active Pet</span>
      </div>

    </div>
  `;
}

// =========================================================================
// SENSOR FUSION: CAMERA MOTION + ACOUSTIC MIC CADENCE
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

    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
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

        if (diff > 14) {
          generalChangedPixels++;
          if (inActiveZone) activeZoneChangedPixels++;
        }

        if (inActiveZone) activeZoneSampled++;
        generalSampled++;
        prevFrameData[pixelIdx] = lum;
      }
    }

    const generalRatio = generalChangedPixels / (generalSampled || 1);
    const activeZoneRatio = activeZoneChangedPixels / (activeZoneSampled || 1);

    if (activeZoneRatio > 0.03 || generalRatio > 0.025) {
      handleSuccessfulScrubHit(true, activeQuad);
    } else {
      if (Date.now() - lastMotionTimestamp > 1200 && !isMicActive) {
        isToothbrushMoving = false;
        currentCombo = 0;
        updateSensorUI(false);
      }
    }
  } catch (e) {
    // Stream transition
  }
}

function handleSuccessfulScrubHit(isTargetHit, activeQuad) {
  isToothbrushMoving = true;
  totalMotionHits++;
  lastMotionTimestamp = Date.now();
  currentCombo = Math.min(20, currentCombo + 1);

  updateSensorUI(true, isTargetHit);

  // Dissolve plaque on active quadrant
  if (activeQuad && activeQuad.id) {
    quadrantCleanliness[activeQuad.id] = Math.min(100, (quadrantCleanliness[activeQuad.id] || 0) + 2.5);
    updateMouthMapUI(activeQuad);
  }

  // Scrub and remove sticky slime splatters
  const splats = document.querySelectorAll('.teeth-slime-splat');
  if (splats.length > 0) {
    const firstSplat = splats[0];
    firstSplat.style.opacity = '0';
    firstSplat.style.transform = 'scale(1.5)';
    setTimeout(() => firstSplat.remove(), 200);
  }

  // 3D Pet Co-Pilot cheering reaction
  if (isCoPilotEnabled && currentCombo % 3 === 0) {
    const coPilot = getActivePet3DInstance('battle-copilot-3d-canvas');
    if (coPilot) coPilot.triggerHeadScratch();
  }

  // Periodic foam bubbles
  if (Math.random() < 0.4) {
    spawnToothpasteFoam(activeQuad);
  }

  // Damage Boss or Shield
  if (Math.random() < 0.35) {
    applyBrushingHit(isTargetHit ? 2 : 1);
  }
}

function updateSensorUI(isMoving, isTargetHit = false) {
  const pill = document.getElementById('dual-sensor-pill');
  const label = document.getElementById('sensor-status-label');
  const hint = document.getElementById('scrub-action-hint');

  if (isMoving) {
    if (pill) {
      pill.className = isTargetHit
        ? 'flex items-center gap-1.5 bg-primary/25 border-2 border-primary px-2.5 py-1.5 rounded-2xl text-[10px] font-black text-primary shadow-[0_0_12px_rgba(84,233,138,0.5)] animate-pulse'
        : 'flex items-center gap-1.5 bg-secondary/20 border border-secondary/70 px-2.5 py-1.5 rounded-2xl text-[10px] font-black text-secondary shadow-sm';
    }
    if (label) {
      label.textContent = isTargetHit ? '🔥 PERFECT ZONE SCRUB!' : '🪥 Toothbrush Active!';
    }
    if (hint) {
      hint.textContent = isTargetHit ? '⚡ 2X COMBO! BOSS IS RECOILING!' : '✨ KEEP CIRCLING IN THE ACTIVE ZONE!';
    }
  } else {
    if (pill) {
      pill.className = 'flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1.5 rounded-2xl border border-surface-container-highest text-[10px] font-black text-on-surface-variant shadow-sm';
    }
    if (label) label.textContent = '🪥 Move Toothbrush to Attack';
  }
}

function updateMouthMapUI(activeQuad) {
  const mouthMapContainer = document.getElementById('interactive-mouth-map');
  if (mouthMapContainer) {
    mouthMapContainer.outerHTML = renderMouthArchSvg(activeQuad);
    attachMouthMapListeners();
  }
}

// =========================================================================
// COMBAT, SHIELDS & BOSS ATTACKS
// =========================================================================
function applyBrushingHit(multiplier = 1) {
  if (isBossShieldActive) {
    bossShieldHp = Math.max(0, bossShieldHp - multiplier);
    updateBossShieldUI();
    Sound.laser();
    showComicHit(`SHIELD HIT! 🛡️ ${bossShieldHp}/${bossShieldMaxHp}`);

    if (bossShieldHp <= 0) {
      shatterBossShield();
    }
    return;
  }

  // Trigger 3D Boss knockback recoil & foam hit particles
  const boss3D = getActiveBoss3DInstance('boss-3d-canvas');
  if (boss3D) {
    boss3D.triggerKnockback(multiplier > 1 ? 45 : 30);
  }

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

function triggerBossShield() {
  const boss = getHygieneBoss(selectedBossId);
  isBossShieldActive = true;
  bossShieldHp = boss.shieldHp || 6;
  bossShieldMaxHp = bossShieldHp;
  Sound.speedUpBattleRhythm(true);

  showComicHit(`${boss.shieldName.toUpperCase()}! 🛡️⚡`);
  voicePrompts.speak(`Watch out! ${boss.name} put up ${boss.shieldName}! Scrub super fast to shatter it!`);

  // Activate 3D Boss Shield barrier
  const boss3DShield = getActiveBoss3DInstance('boss-3d-canvas');
  if (boss3DShield) {
    boss3DShield.setShield(true);
  }

  const container = document.getElementById('boss-character-wrapper');
  if (container) {
    // Keep 3D canvas active
  }

  store.notify();
}

function updateBossShieldUI() {
  const shieldLayer = document.getElementById('boss-shield-layer');
  if (shieldLayer) {
    const boss = getHygieneBoss(selectedBossId);
    shieldLayer.innerHTML = `
      <span>🛡️ ${boss.shieldName}: ${bossShieldHp}/${bossShieldMaxHp}</span>
      <span class="animate-bounce">SCRUB TO SHATTER! 💥</span>
    `;
  }
}

function shatterBossShield() {
  isBossShieldActive = false;
  
  // Shatter 3D Boss Shield & stun into dizzy spin
  const boss3D = getActiveBoss3DInstance('boss-3d-canvas');
  if (boss3D) {
    boss3D.setShield(false);
    boss3D.triggerDizzy(2500);
  }

  Sound.shieldShatter();
  Sound.speedUpBattleRhythm(false);

  showComicHit('SHIELD SHATTERED! 💥');
  voicePrompts.speakBossDizzy();

  confetti({
    particleCount: 50,
    spread: 70,
    origin: { y: 0.35 },
    colors: ['#f59e0b', '#fbbf24', '#10b981', '#ffffff']
  });

  store.notify();
}

// Boss Attack Cycle: Boss attacks the teeth every 12-16 seconds

// Splatter-and-Scrub: Spawns sticky slime on the teeth mirror overlay during boss attack
function spawnTeethSlimeSplatters(quadrantId, boss) {
  const container = document.getElementById('teeth-splatter-overlay');
  if (!container) return;

  const color = boss.id.includes('kraken') ? '#10b981' : boss.id.includes('goblin') ? '#c084fc' : '#f59e0b';
  const emoji = boss.id.includes('kraken') ? '🦠' : boss.id.includes('goblin') ? '🧪' : '🍯';

  for (let i = 0; i < 4; i++) {
    const splat = document.createElement('div');
    const x = Math.random() * 70 + 15;
    const y = Math.random() * 50 + 25;
    splat.className = 'absolute transition-all duration-300 pointer-events-none z-20 teeth-slime-splat animate-bounce';
    splat.style.left = `${x}%`;
    splat.style.top = `${y}%`;
    splat.innerHTML = `
      <div class="relative flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
        <div class="w-7 h-7 rounded-full blur-[1px] opacity-90" style="background-color: ${color};"></div>
        <span class="absolute text-sm select-none">${emoji}</span>
      </div>
    `;
    container.appendChild(splat);

    setTimeout(() => {
      if (splat.parentNode) {
        splat.style.opacity = '0';
        splat.style.transform = 'scale(1.4)';
        setTimeout(() => splat.remove(), 300);
      }
    }, 4000);
  }
}

function triggerBossAttack() {
  if (!isBattleRunning) return;
  const boss = getHygieneBoss(selectedBossId);
  currentBossAttackType = boss.attackName;
  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

  // Trigger 3D Boss Lunge on 3D Canvas
  const boss3D = getActiveBoss3DInstance('boss-3d-canvas');
  if (boss3D) {
    boss3D.triggerLunge(activeQuad.id);
  }

  // Spawn animated sticky slime splatters directly on teeth overlay
  spawnTeethSlimeSplatters(activeQuad.id, boss);

  if (typeof Sound.bossLunge === 'function') {
    Sound.bossLunge();
  } else {
    Sound.hit();
  }
  voicePrompts.speakBossLunge(boss.name, activeQuad.name);

  setTimeout(() => {
    if (!isBattleRunning) return;
    if (isHeroShieldActive) {
      Sound.shieldDeflect();
      showComicHit('ATTACK DEFLECTED! 🛡️✨');
    } else {
      showComicHit('TEETH DEFENDED! 🪥');
    }

    currentBossAttackType = null;
    if (wrapper) {
      wrapper.innerHTML = renderBossCharacterSvg(boss, false, false);
    }
  }, 2200);
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

  if (isBossShieldActive) {
    bossShieldHp = Math.max(0, bossShieldHp - 4);
    updateBossShieldUI();
    if (bossShieldHp <= 0) {
      shatterBossShield();
    }
  } else {
    const boss = document.getElementById('boss-character');
    if (boss) {
      boss.classList.add('scale-125', 'brightness-200', 'rotate-6');
      setTimeout(() => boss.classList.remove('scale-125', 'brightness-200', 'rotate-6'), 400);
    }
  }

  // Clean active quadrant
  const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  quadrantCleanliness[activeQuad.id] = Math.min(100, (quadrantCleanliness[activeQuad.id] || 0) + 15);
  updateMouthMapUI(activeQuad);

  for (let i = 0; i < 10; i++) {
    setTimeout(() => spawnToothpasteFoam(activeQuad), i * 60);
  }
}

// Toothpaste Foam VFX
function spawnToothpasteFoam(activeQuad) {
  const container = document.getElementById('foam-vfx-container');
  if (!container) return;

  const bubbleIcons = ['🫧', '✨', '🪥', '🫧', '⭐'];
  for (let i = 0; i < 2; i++) {
    const el = document.createElement('div');
    el.className = 'absolute text-lg sm:text-2xl pointer-events-none transition-all duration-700 select-none';
    el.textContent = bubbleIcons[Math.floor(Math.random() * bubbleIcons.length)];

    let leftPercent = 35 + Math.random() * 30;
    let topPercent = 45 + Math.random() * 30;

    el.style.left = `${leftPercent}%`;
    el.style.top = `${topPercent}%`;
    el.style.transform = 'translate(-50%, -50%) scale(0.5)';
    el.style.opacity = '1';

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(${(Math.random() - 0.5) * 60}px, -${30 + Math.random() * 40}px) scale(${1.1 + Math.random() * 0.4})`;
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 750);
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
// CAMERA INITIALIZATION & LIFECYCLE
// =========================================================================
async function initCamera() {
  const video = document.getElementById('ar-camera-feed');
  const pill = document.getElementById('camera-status-pill');

  if (videoStream && videoStream.active) {
    if (video) {
      if (video.srcObject !== videoStream) {
        video.srcObject = videoStream;
      }
      video.play().catch(() => {});
      if (pill) pill.classList.add('hidden');
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
      if (pill) pill.classList.add('hidden');
    } catch (err) {
      console.warn('Camera restricted or unavailable; audio & tap fallback enabled.', err);
      isCameraActive = false;
      cameraError = err;
      if (pill) pill.classList.remove('hidden');
    }
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
  const boss = getHygieneBoss(selectedBossId);
  isBattleRunning = true;
  secondsRemaining = store.getState().parentSettings?.arBattleDuration || 120;
  totalDuration = secondsRemaining;
  totalMotionHits = 0;
  isFallbackActive = false;
  currentCombo = 0;
  prevFrameData = null;
  isBossShieldActive = false;
  bossShieldHp = 0;
  shieldMilestonesTriggered = { 90: false, 30: false };
  isHeroShieldActive = false;
  currentBossAttackType = null;
  cadenceSamples = [];

  // Reset quadrant cleanliness
  quadrantCleanliness = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 };

  // Audio & Hardware Init
  Sound.startBattleRhythm();
  initCamera();
  initMotionDetector();

  // Initialize Acoustic Microphone Scrub Analyzer
  brushAudioAnalyzer.startListening(({ isScrubbing, cadenceScore }) => {
    micCadenceScore = cadenceScore;
    cadenceSamples.push(cadenceScore);
    isMicActive = isScrubbing;

    const cadenceLabel = document.getElementById('cadence-score-label');
    if (cadenceLabel) {
      cadenceLabel.textContent = `${cadenceScore}% Cadence`;
    }

    if (isScrubbing) {
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleSuccessfulScrubHit(true, activeQuad);
    }
  });

  // Rex Spoken Cue
  const initialQuad = getDentalQuadrant(secondsRemaining, totalDuration);
  currentRexCoachText = initialQuad.coachMessage;
  voicePrompts.speak(`Battle start! ${initialQuad.coachMessage}`);

  // Re-render into active battle arena
  store.notify();

  // 10 FPS Motion Check Interval
  if (motionCheckInterval) clearInterval(motionCheckInterval);
  motionCheckInterval = setInterval(checkToothbrushMotion, 100);

  // Boss Attack Cycle (Every 14 seconds)
  if (bossAttackInterval) clearInterval(bossAttackInterval);
  bossAttackInterval = setInterval(triggerBossAttack, 14000);

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
    const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);

    // Update Rex Mirror Demo container
    const rexContainer = document.getElementById('rex-demo-svg-container');
    if (rexContainer) {
      rexContainer.innerHTML = renderRexMirrorDemoSvg(activeQuad, isToothbrushMoving);
    }

    // BOSS SHIELD TRIGGERS (At 90s remaining and 30s remaining)
    if (secondsRemaining === 90 && !shieldMilestonesTriggered[90]) {
      shieldMilestonesTriggered[90] = true;
      triggerBossShield();
    } else if (secondsRemaining === 30 && !shieldMilestonesTriggered[30]) {
      shieldMilestonesTriggered[30] = true;
      triggerBossShield();
    }

    // QUADRANT SPEECH ANNOUNCEMENTS
    if (secondsRemaining === 90) {
      voicePrompts.speak(DENTAL_QUADRANTS[1].coachMessage);
      currentRexCoachText = DENTAL_QUADRANTS[1].coachMessage;
      updateMouthMapUI(DENTAL_QUADRANTS[1]);
    } else if (secondsRemaining === 60) {
      voicePrompts.speak(DENTAL_QUADRANTS[2].coachMessage);
      currentRexCoachText = DENTAL_QUADRANTS[2].coachMessage;
      updateMouthMapUI(DENTAL_QUADRANTS[2]);
    } else if (secondsRemaining === 30) {
      voicePrompts.speak(DENTAL_QUADRANTS[3].coachMessage);
      currentRexCoachText = DENTAL_QUADRANTS[3].coachMessage;
      updateMouthMapUI(DENTAL_QUADRANTS[3]);
    } else if (secondsRemaining === 10) {
      voicePrompts.speak(DENTAL_QUADRANTS[4].coachMessage);
      currentRexCoachText = DENTAL_QUADRANTS[4].coachMessage;
      updateMouthMapUI(DENTAL_QUADRANTS[4]);
    }

    // TODDLER GRACE AUTO-ASSIST (Engages after 18s if low motion)
    if (elapsedSeconds >= 18 && !isFallbackActive && totalMotionHits < 10) {
      isFallbackActive = true;
      voicePrompts.speak('Hero Auto-Assist active! Keep on brushing to beat the sugar bugs!');
      showComicHit('AUTO-ASSIST ACTIVE! 🛡️');
      Sound.laser();
    }

    // Auto-assist periodic tick
    if (isFallbackActive && secondsRemaining % 3 === 0) {
      handleSuccessfulScrubHit(false, activeQuad);
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

function concludeVictory() {
  if (battleTimer) {
    clearInterval(battleTimer);
    battleTimer = null;
  }
  if (motionCheckInterval) {
    clearInterval(motionCheckInterval);
    motionCheckInterval = null;
  }
  if (bossAttackInterval) {
    clearInterval(bossAttackInterval);
    bossAttackInterval = null;
  }

  isBattleRunning = false;
  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopCamera();

  const boss = getHygieneBoss(selectedBossId);
  const avgCadence = cadenceSamples.length > 0
    ? Math.round(cadenceSamples.reduce((a, b) => a + b, 0) / cadenceSamples.length)
    : 85;

  // Trigger 3D Defeat Climax on 3D Boss
  const boss3D = getActiveBoss3DInstance('boss-3d-canvas');
  if (boss3D) {
    boss3D.triggerDefeat();
  }

  // Trigger Co-Pilot victory backflip
  if (isCoPilotEnabled) {
    const coPilot = getActivePet3DInstance('battle-copilot-3d-canvas');
    if (coPilot) coPilot.triggerBellyTickle();
  }

  voicePrompts.speakBossDefeated(boss.name);

  // Award full Toothbrush Battle 2.0 rewards (+50 coins, +75 XP, +15 sparks, badges)
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
  if (bossAttackInterval) {
    clearInterval(bossAttackInterval);
    bossAttackInterval = null;
  }

  Sound.stopBattleRhythm();
  brushAudioAnalyzer.stopListening();
  stopCamera();

  if (isBattleRunning && secondsRemaining > 0) {
    isBattleRunning = false;
    Sound.hit();
    store.showReward(
      'Boss Escaped!',
      'The Hygiene Boss ran away! Brush for the full 2 minutes next time to earn your sparks and badges!',
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
function attachMouthMapListeners() {
  const mouthMap = document.getElementById('interactive-mouth-map');
  if (mouthMap) {
    mouthMap.addEventListener('click', (e) => {
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleSuccessfulScrubHit(true, activeQuad);
      Sound.laser();
    });
  }
}

export function attachBattleListeners() {
  // Lobby boss cards
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

  const manualScrubBtn = document.getElementById('hero-manual-scrub-btn');
  if (manualScrubBtn) {
    manualScrubBtn.addEventListener('click', () => {
      const activeQuad = getDentalQuadrant(secondsRemaining, totalDuration);
      handleSuccessfulScrubHit(true, activeQuad);
      Sound.laser();
    });
  }

  attachMouthMapListeners();

  // Window Voice Power-Up Events (dispatched by Gemini Live & Rex)
  const onRexFoam = () => {
    if (isBattleRunning) triggerMegaFoamBlast();
  };
  const onRexShield = () => {
    if (isBattleRunning) activateHeroBubbleShield();
  };
  const onRexCheer = (e) => {
    if (isBattleRunning) {
      showComicHit(e.detail?.quadrantName ? `CLEARED ${e.detail.quadrantName}! ⭐` : 'REX ROAR! 🦖⚡');
      Sound.chime();
    }
  };
  const onRexVictory = () => {
    if (isBattleRunning) concludeVictory();
  };

  window.addEventListener('rex-battle-foam', onRexFoam);
  window.addEventListener('rex-battle-shield', onRexShield);
  window.addEventListener('rex-battle-cheer', onRexCheer);
  window.addEventListener('rex-battle-victory', onRexVictory);

  // Co-pilot toggle button
  const copilotBtn = document.getElementById('copilot-toggle-btn');
  if (copilotBtn) {
    copilotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isCoPilotEnabled = !isCoPilotEnabled;
      Sound.tap();
      store.notify();
    });
  }

  // If in battle mode, initialize 3D Viewers, camera, and motion detector
  if (isBattleRunning) {
    initBoss3DViewer('boss-3d-canvas', {
      bossId: selectedBossId
    });
    if (isCoPilotEnabled) {
      initPet3DViewer('battle-copilot-3d-canvas', {
        petId: store.getActivePet()?.id || 'rex',
        stage: store.getActivePet()?.stage || 1,
        mode: 'sanctuary'
      });
    }
    initCamera();
    initMotionDetector();
  }
}
