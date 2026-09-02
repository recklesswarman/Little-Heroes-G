import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import sugarVillainEscapedImg from '../assets/sugar_villain_escaped.jpg';
import { voicePrompts } from '../utils/voicePrompts.js';

let battleTimer = null;
let secondsRemaining = 120; // 2 minutes (120s)
let totalDuration = 120;
let isBattleRunning = false;
let currentBrushZone = 0; // 0: Top Front, 1: Bottom Front, 2: Left Molars, 3: Right Molars
let videoStream = null;
let isCameraActive = false;
let cameraError = null;

const ZONES = [
  {
    id: 0,
    name: 'Top Front Teeth',
    quadrant: 'top-front',
    icon: 'dentistry',
    hint: 'Brush your front top teeth in gentle circles! 🦷',
    voice: 'Brush your top front teeth in gentle circles! Blast those sugar bugs!'
  },
  {
    id: 1,
    name: 'Bottom Front Teeth',
    quadrant: 'bottom-front',
    icon: 'dentistry',
    hint: 'Now gently scrub your bottom front teeth! ✨',
    voice: 'Now brush your bottom front teeth! Keep that toothbrush moving!'
  },
  {
    id: 2,
    name: 'Left Chewing Molars',
    quadrant: 'left-molars',
    icon: 'cleaning_services',
    hint: 'Deep scrub your left back chewing teeth! 🪥',
    voice: 'Great job! Deep scrub into your left chewing teeth!'
  },
  {
    id: 3,
    name: 'Right Chewing Molars',
    quadrant: 'right-molars',
    icon: 'cleaning_services',
    hint: 'Finish strong! Scrub your right chewing teeth! 🌟',
    voice: 'Almost there! Finish scrubbing your right chewing teeth!'
  }
];

export function renderBattleView() {
  const hpPercent = Math.max(0, Math.round((secondsRemaining / totalDuration) * 100));
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const activeZone = ZONES[currentBrushZone] || ZONES[0];

  return `
    <div class="max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-28 flex flex-col gap-3.5 animate-fade-in select-none">
      
      <!-- Top Bar HUD -->
      <div class="flex items-center justify-between z-20">
        <button id="battle-quit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">close</span> ${isBattleRunning ? 'Quit Battle' : 'Exit'}
        </button>

        <!-- Camera Mirror Status Pill -->
        <div id="camera-status-pill" class="flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded-full border border-surface-container-highest text-[11px] font-black text-primary shadow-sm">
          <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
          <span id="camera-status-text">AR Camera Active</span>
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
        
        <!-- Ambient Vignette & Target Grid -->
        <div class="absolute inset-0 bg-radial from-transparent via-black/20 to-black/75 pointer-events-none z-0"></div>

        <!-- Camera Permission / Retry Button (Shown if camera blocked or needs gesture) -->
        <div id="camera-permission-fallback" class="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center gap-3 bg-black/70 backdrop-blur-sm ${isCameraActive ? 'hidden' : ''}">
          <div class="w-16 h-16 rounded-3xl bg-primary/20 text-primary flex items-center justify-center text-3xl border-2 border-primary/40 shadow-lg">
            <span class="material-symbols-outlined text-4xl">videocam</span>
          </div>
          <div class="max-w-xs">
            <h3 class="font-headline text-base font-black text-white">Turn On AR Camera Mirror</h3>
            <p class="text-xs text-white/80 mt-1">See your face and teeth in the magic AR mirror to fight the sugar bugs!</p>
          </div>
          <button id="enable-camera-btn" class="bg-primary text-on-primary font-headline text-xs font-black px-5 py-3 rounded-2xl chunky-btn border-primary-container flex items-center gap-2 active:scale-95 shadow-lg">
            <span class="material-symbols-outlined text-lg">photo_camera</span>
            Enable Camera Feed
          </button>
        </div>

        <!-- TOP: Boss Health Bar HUD -->
        <div class="w-full max-w-md z-10 pt-3 px-4 flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black text-error bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-error/30">
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
        </div>

        <!-- CENTER BATTLE STAGE: Boss, Minions, and Mouth Alignment Zone -->
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

            <!-- Sugar Boss Attack Laser / Slime Trail to Mouth -->
            <div id="sugar-attack-beam" class="w-1.5 h-10 bg-gradient-to-b from-error via-secondary to-primary/80 animate-pulse-glow rounded-full shadow-[0_0_12px_#ff5722]"></div>
          </div>

          <!-- AR MOUTH ALIGNMENT ZONE & DENTAL QUADRANTS (Kid's Teeth Target) -->
          <div id="ar-mouth-stage" class="relative w-72 sm:w-80 h-36 sm:h-40 rounded-3xl border-3 border-dashed border-primary/60 bg-black/45 backdrop-blur-[2px] flex flex-col items-center justify-between p-2.5 shadow-[0_0_30px_rgba(46,204,113,0.3)] animate-mouth-glow">
            
            <!-- Alignment Label Header -->
            <div class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary bg-black/60 px-2.5 py-0.5 rounded-full border border-primary/30">
              <span class="material-symbols-outlined text-xs">face</span>
              <span>Align Teeth in Magic Mirror</span>
            </div>

            <!-- Upper Dental Arch (Top Teeth) -->
            <div class="w-full flex items-center justify-between px-3">
              <!-- Upper Left Molars (Zone 2) -->
              <div id="quadrant-2-top" class="quadrant-zone flex items-center gap-1 p-1 rounded-xl transition-all ${currentBrushZone === 2 ? 'ring-2 ring-primary bg-primary/20 scale-105' : 'opacity-75'}">
                <span class="text-sm">🦷</span>
                <span class="text-sm">🦷</span>
              </div>

              <!-- Upper Front Teeth (Zone 0 - Active Target) -->
              <div id="quadrant-0" class="quadrant-zone flex items-center gap-1 p-1.5 rounded-xl transition-all ${currentBrushZone === 0 ? 'ring-3 ring-primary bg-primary/30 scale-110 shadow-[0_0_16px_#2ecc71]' : 'opacity-75'}">
                <span class="text-base">🦷</span>
                <span class="text-base">🦷</span>
                <span class="text-base">🦷</span>
                <span class="text-base">🦷</span>
              </div>

              <!-- Upper Right Molars (Zone 3) -->
              <div id="quadrant-3-top" class="quadrant-zone flex items-center gap-1 p-1 rounded-xl transition-all ${currentBrushZone === 3 ? 'ring-2 ring-primary bg-primary/20 scale-105' : 'opacity-75'}">
                <span class="text-sm">🦷</span>
                <span class="text-sm">🦷</span>
              </div>
            </div>

            <!-- Lower Dental Arch (Bottom Teeth) -->
            <div class="w-full flex items-center justify-between px-3">
              <!-- Lower Left Molars (Zone 2) -->
              <div id="quadrant-2-bot" class="quadrant-zone flex items-center gap-1 p-1 rounded-xl transition-all ${currentBrushZone === 2 ? 'ring-2 ring-primary bg-primary/20 scale-105' : 'opacity-75'}">
                <span class="text-sm">🦷</span>
                <span class="text-sm">🦷</span>
              </div>

              <!-- Lower Front Teeth (Zone 1 - Target) -->
              <div id="quadrant-1" class="quadrant-zone flex items-center gap-1 p-1.5 rounded-xl transition-all ${currentBrushZone === 1 ? 'ring-3 ring-primary bg-primary/30 scale-110 shadow-[0_0_16px_#2ecc71]' : 'opacity-75'}">
                <span class="text-base">🦷</span>
                <span class="text-base">🦷</span>
                <span class="text-base">🦷</span>
                <span class="text-base">🦷</span>
              </div>

              <!-- Lower Right Molars (Zone 3) -->
              <div id="quadrant-3-bot" class="quadrant-zone flex items-center gap-1 p-1 rounded-xl transition-all ${currentBrushZone === 3 ? 'ring-2 ring-primary bg-primary/20 scale-105' : 'opacity-75'}">
                <span class="text-sm">🦷</span>
                <span class="text-sm">🦷</span>
              </div>
            </div>

            <!-- Active Quadrant Glowing Arrow & Tooltip -->
            <div class="flex items-center gap-1 text-[10px] font-black text-white bg-primary/90 px-3 py-1 rounded-full shadow-md animate-bounce">
              <span class="material-symbols-outlined text-xs">cleaning_services</span>
              <span id="active-quadrant-label">BRUSH HERE: ${activeZone.name.toUpperCase()}</span>
            </div>

            <!-- Dynamic Toothpaste Foam Burst VFX Layer -->
            <div id="foam-vfx-container" class="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl"></div>
          </div>

          <!-- 4 ANIMATED GERM MINIONS FIGHTING THE TEETH -->
          
          <!-- Minion 1: Plaque Goblin (Top-Left Teeth) -->
          <div id="minion-1" class="absolute left-2 sm:left-6 top-28 sm:top-32 flex flex-col items-center animate-minion-wiggle z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#2ecc71] border border-[#2ecc71]/40 mb-1 shadow">
              Plaque Bug 👾
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(46,204,113,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <!-- Spiky Green Blob Body -->
                <circle cx="25" cy="25" r="18" fill="#27ae60" stroke="#2ecc71" stroke-width="2" />
                <circle cx="14" cy="18" r="4" fill="#2ecc71" />
                <circle cx="36" cy="18" r="4" fill="#2ecc71" />
                <!-- Googly Eyes -->
                <circle cx="20" cy="22" r="5" fill="#fff" />
                <circle cx="21" cy="22" r="2.5" fill="#000" />
                <circle cx="30" cy="22" r="5" fill="#fff" />
                <circle cx="29" cy="22" r="2.5" fill="#000" />
                <!-- Chomping Pincer Teeth -->
                <path d="M 18 32 Q 25 38 32 32" stroke="#f1c40f" stroke-width="3" fill="none" stroke-linecap="round" />
                <polygon points="21,30 23,34 25,30" fill="#fff" />
                <polygon points="26,30 28,34 30,30" fill="#fff" />
              </svg>
            </div>
            <!-- Attack Acid Splatter -->
            <span class="text-xs animate-pulse">🧪</span>
          </div>

          <!-- Minion 2: Sour Acid Bug (Top-Right Teeth) -->
          <div id="minion-2" class="absolute right-2 sm:right-6 top-28 sm:top-32 flex flex-col items-center animate-minion-chomp z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#3498db] border border-[#3498db]/40 mb-1 shadow">
              Acid Imp 💧
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(52,152,219,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <!-- Cyan-Blue Droplet Monster -->
                <path d="M 25 6 C 14 18 10 28 10 35 C 10 44 16 48 25 48 C 34 48 40 44 40 35 C 40 28 36 18 25 6 Z" fill="#2980b9" stroke="#3498db" stroke-width="2" />
                <!-- Sharp Horns -->
                <polygon points="14,14 18,22 10,22" fill="#f1c40f" />
                <polygon points="36,14 32,22 40,22" fill="#f1c40f" />
                <!-- Angry Eyes -->
                <circle cx="20" cy="30" r="4.5" fill="#fff" />
                <circle cx="21" cy="31" r="2" fill="#c0392b" />
                <circle cx="30" cy="30" r="4.5" fill="#fff" />
                <circle cx="29" cy="31" r="2" fill="#c0392b" />
                <!-- Sharp Fangs -->
                <path d="M 18 38 L 22 42 L 25 38 L 28 42 L 32 38" stroke="#f1c40f" stroke-width="2" fill="none" />
              </svg>
            </div>
            <!-- Acid Lightning -->
            <span class="text-xs animate-bounce">⚡</span>
          </div>

          <!-- Minion 3: Cavity Imp (Bottom-Left Chewing Teeth) -->
          <div id="minion-3" class="absolute left-3 sm:left-8 bottom-12 sm:bottom-16 flex flex-col items-center animate-minion-drill z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#e74c3c] border border-[#e74c3c]/40 mb-1 shadow">
              Cavity Drill 🪚
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(231,76,60,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <!-- Dark Red Imp Body -->
                <ellipse cx="25" cy="27" rx="16" ry="14" fill="#c0392b" stroke="#e74c3c" stroke-width="2" />
                <!-- Bat Wings -->
                <path d="M 10 22 Q 4 14 10 32" stroke="#962d22" stroke-width="2.5" fill="none" />
                <path d="M 40 22 Q 46 14 40 32" stroke="#962d22" stroke-width="2.5" fill="none" />
                <!-- Imp Horns -->
                <polygon points="18,16 20,8 24,16" fill="#f1c40f" />
                <polygon points="32,16 30,8 26,16" fill="#f1c40f" />
                <!-- Angry Eyes -->
                <circle cx="20" cy="25" r="3.5" fill="#f1c40f" />
                <circle cx="30" cy="25" r="3.5" fill="#f1c40f" />
                <!-- Toothpick Drill -->
                <line x1="32" y1="32" x2="44" y2="44" stroke="#ecf0f1" stroke-width="3" stroke-linecap="round" />
                <polygon points="42,42 46,46 41,47" fill="#f1c40f" />
              </svg>
            </div>
          </div>

          <!-- Minion 4: Sugar Mite (Bottom-Right Chewing Teeth) -->
          <div id="minion-4" class="absolute right-3 sm:right-8 bottom-12 sm:bottom-16 flex flex-col items-center animate-minion-wiggle z-20">
            <div class="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-[#f39c12] border border-[#f39c12]/40 mb-1 shadow">
              Sugar Mite 🍭
            </div>
            <div class="w-12 h-12 sm:w-14 sm:h-14 relative drop-shadow-[0_4px_10px_rgba(243,156,18,0.5)]">
              <svg viewBox="0 0 50 50" class="w-full h-full">
                <!-- Amber Candy Bug -->
                <circle cx="25" cy="26" r="15" fill="#d35400" stroke="#f39c12" stroke-width="2" />
                <!-- Antennae -->
                <path d="M 20 12 Q 16 4 12 8" stroke="#f39c12" stroke-width="2" fill="none" />
                <circle cx="12" cy="8" r="2" fill="#e74c3c" />
                <path d="M 30 12 Q 34 4 38 8" stroke="#f39c12" stroke-width="2" fill="none" />
                <circle cx="38" cy="8" r="2" fill="#e74c3c" />
                <!-- Eyes -->
                <circle cx="20" cy="24" r="4" fill="#fff" />
                <circle cx="21" cy="24" r="2" fill="#000" />
                <circle cx="30" cy="24" r="4" fill="#fff" />
                <circle cx="29" cy="24" r="2" fill="#000" />
                <!-- Chewing Teeth -->
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

        <!-- BOTTOM HUD: Zone Instructions & Hands-Free Action Button -->
        <div class="w-full z-10 pb-3 px-4 flex flex-col items-center gap-2.5">
          
          <!-- Active Guided Brushing Zone Banner -->
          <div class="w-full max-w-md bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border-2 border-primary/50 flex items-center justify-between shadow-lg text-center">
            <div class="flex items-center gap-2.5 text-left">
              <div class="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center text-lg flex-shrink-0">
                <span class="material-symbols-outlined text-base">record_voice_over</span>
              </div>
              <div class="flex flex-col">
                <span id="zone-name-text" class="text-[10px] font-black uppercase text-primary tracking-wider">Target: ${activeZone.name}</span>
                <span id="zone-hint-text" class="text-xs font-bold text-inverse-surface">${activeZone.hint}</span>
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

      <!-- Info Banner -->
      <div class="bg-surface-container rounded-3xl p-3.5 sm:p-4 border-2 border-surface-container-highest card-shadow flex items-center justify-between text-xs text-on-surface-variant">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary text-xl">verified</span>
          <span>AR mirror displays live video feed while tooth movement damages the sugar villains!</span>
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
  const statusPill = document.getElementById('camera-status-text');

  if (videoStream && videoStream.active) {
    if (video) {
      if (video.srcObject !== videoStream) {
        video.srcObject = videoStream;
      }
      video.play().catch(() => {});
      if (fallback) fallback.classList.add('hidden');
      if (statusPill) statusPill.textContent = 'AR Camera Active';
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
      if (statusPill) statusPill.textContent = 'AR Camera Active';
    } catch (err) {
      console.warn('Camera access denied or unavailable; fallback enabled.', err);
      isCameraActive = false;
      cameraError = err;
      if (fallback) fallback.classList.remove('hidden');
      if (statusPill) statusPill.textContent = 'Camera Off (Tap to Enable)';
    }
  } else {
    if (fallback) fallback.classList.remove('hidden');
    if (statusPill) statusPill.textContent = 'Camera Unsupported';
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
    isCameraActive = false;
  }
}

// BURST FOAM BUBBLE PARTICLES OVER ACTIVE TEETH ZONE
function spawnToothpasteFoam() {
  const container = document.getElementById('foam-vfx-container');
  if (!container) return;

  const bubbleIcons = ['🫧', '✨', '🪥', '🫧', '⭐'];
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'absolute text-lg sm:text-xl pointer-events-none transition-all duration-700 select-none';
    el.textContent = bubbleIcons[Math.floor(Math.random() * bubbleIcons.length)];
    
    // Position within active mouth quadrant area
    const leftPercent = 25 + Math.random() * 50;
    const topPercent = 35 + Math.random() * 40;
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
  }, 700);
}

// UPDATE ACTIVE QUADRANT HIGHLIGHT IN MOUTH STAGE
function updateActiveQuadrantUI(zoneIdx) {
  const zone = ZONES[zoneIdx] || ZONES[0];

  const zoneName = document.getElementById('zone-name-text');
  const zoneHint = document.getElementById('zone-hint-text');
  const quadLabel = document.getElementById('active-quadrant-label');

  if (zoneName) zoneName.textContent = `Target: ${zone.name}`;
  if (zoneHint) zoneHint.textContent = zone.hint;
  if (quadLabel) quadLabel.textContent = `BRUSH HERE: ${zone.name.toUpperCase()}`;

  // Update quadrant styling in mouth overlay
  document.querySelectorAll('.quadrant-zone').forEach((el) => {
    el.classList.remove('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110', 'shadow-[0_0_16px_#2ecc71]');
    el.classList.add('opacity-75');
  });

  const q0 = document.getElementById('quadrant-0');
  const q1 = document.getElementById('quadrant-1');
  const q2Top = document.getElementById('quadrant-2-top');
  const q2Bot = document.getElementById('quadrant-2-bot');
  const q3Top = document.getElementById('quadrant-3-top');
  const q3Bot = document.getElementById('quadrant-3-bot');

  if (zoneIdx === 0 && q0) {
    q0.classList.remove('opacity-75');
    q0.classList.add('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110', 'shadow-[0_0_16px_#2ecc71]');
  } else if (zoneIdx === 1 && q1) {
    q1.classList.remove('opacity-75');
    q1.classList.add('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110', 'shadow-[0_0_16px_#2ecc71]');
  } else if (zoneIdx === 2) {
    if (q2Top) { q2Top.classList.remove('opacity-75'); q2Top.classList.add('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110'); }
    if (q2Bot) { q2Bot.classList.remove('opacity-75'); q2Bot.classList.add('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110'); }
  } else if (zoneIdx === 3) {
    if (q3Top) { q3Top.classList.remove('opacity-75'); q3Top.classList.add('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110'); }
    if (q3Bot) { q3Bot.classList.remove('opacity-75'); q3Bot.classList.add('ring-3', 'ring-primary', 'bg-primary/30', 'scale-110'); }
  }
}

// BATTLE LIFECYCLE
function startBattle() {
  isBattleRunning = true;
  secondsRemaining = store.getState().parentSettings.arBattleDuration || 120;
  totalDuration = secondsRemaining;
  currentBrushZone = 0;

  Sound.fanfare();
  initCamera();

  // Voice guidance for initial zone
  const activeZone = ZONES[0];
  voicePrompts.speak(activeZone.voice);

  // Immediately re-render to switch button to hands-free state
  store.notify();

  // Smooth DOM update interval without wiping the camera video feed
  battleTimer = setInterval(() => {
    secondsRemaining--;

    // Update timer text in DOM
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const timerDisplay = document.getElementById('battle-timer-display');
    if (timerDisplay) timerDisplay.textContent = timeStr;

    // Update Boss HP bar & percentage in DOM
    const hpPercent = Math.max(0, Math.round((secondsRemaining / totalDuration) * 100));
    const hpBar = document.getElementById('boss-hp-bar');
    const hpText = document.getElementById('boss-hp-text');
    if (hpBar) hpBar.style.width = `${hpPercent}%`;
    if (hpText) hpText.textContent = `${hpPercent}% HP`;

    // Check Quadrant Rotation (every 30 seconds for 4 quadrants)
    const zoneIndex = Math.min(3, Math.floor((totalDuration - secondsRemaining) / (totalDuration / 4)));
    if (zoneIndex !== currentBrushZone) {
      currentBrushZone = zoneIndex;
      Sound.laser();
      updateActiveQuadrantUI(currentBrushZone);
      voicePrompts.speak(ZONES[currentBrushZone].voice);
      showComicHit(`NEW ZONE: ${ZONES[currentBrushZone].name.toUpperCase()}! 🪥`);
    }

    // Toothbrush Action Pulse & Hit Reactions every 2-3 seconds
    if (secondsRemaining % 2 === 0) {
      spawnToothpasteFoam();
    }

    if (secondsRemaining % 3 === 0) {
      Sound.laser();
      showComicHit();

      // Boss flinch reaction
      const boss = document.getElementById('boss-character');
      if (boss) {
        boss.classList.add('scale-110', 'brightness-150');
        setTimeout(() => boss.classList.remove('scale-110', 'brightness-150'), 250);
      }

      // Minion hit flinch
      const minionId = `minion-${(secondsRemaining % 4) + 1}`;
      const minion = document.getElementById(minionId);
      if (minion) {
        minion.classList.add('scale-75', 'rotate-12', 'brightness-150');
        setTimeout(() => minion.classList.remove('scale-75', 'rotate-12', 'brightness-150'), 300);
      }
    }

    // Win Condition
    if (secondsRemaining <= 0) {
      clearInterval(battleTimer);
      battleTimer = null;
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

  // Automatically start camera on view load for seamless mirror experience
  initCamera();
}
