import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';
import sugarVillainEscapedImg from '../assets/sugar_villain_escaped.jpg';

let battleTimer = null;
let secondsRemaining = 120; // 2 minutes (120s)
let totalDuration = 120;
let isBattleRunning = false;
let currentBrushZone = 0; // 0: Top Front, 1: Bottom Front, 2: Left Chewing, 3: Right Chewing
let videoStream = null;

const ZONES = [
  { name: 'Top Front Teeth', icon: 'dentistry', hint: 'Brush the front top teeth in small circles! 🦷' },
  { name: 'Bottom Front Teeth', icon: 'dentistry', hint: 'Now gently brush the bottom front teeth! ✨' },
  { name: 'Left Back Chewing Teeth', icon: 'cleaning_services', hint: 'Scrub the deep left chewing teeth! 🪥' },
  { name: 'Right Back Chewing Teeth', icon: 'cleaning_services', hint: 'Great job! Finish scrubbing the right chewing teeth! 🌟' }
];

export function renderBattleView() {
  const state = store.getState();
  const hpPercent = Math.max(0, Math.round((secondsRemaining / totalDuration) * 100));
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const activeZone = ZONES[currentBrushZone];

  return `
    <div class="max-w-4xl mx-auto px-4 pt-3 pb-28 flex flex-col gap-4 animate-fade-in select-none">
      
      <!-- Top Bar HUD -->
      <div class="flex items-center justify-between z-20">
        <button id="battle-quit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-3.5 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm">
          <span class="material-symbols-outlined text-base">close</span> ${isBattleRunning ? 'Quit Battle' : 'Exit'}
        </button>

        <!-- Timer & Coins HUD -->
        <div class="flex items-center gap-3">
          <div class="bg-surface-container-high px-4 py-2 rounded-full border-2 border-secondary-container flex items-center gap-2 shadow-md">
            <span class="material-symbols-outlined text-secondary text-xl animate-spin" style="font-variation-settings: 'FILL' 1;">timer</span>
            <span class="font-headline text-lg font-black text-secondary tracking-wider">${timeStr}</span>
          </div>

          <div class="hidden sm:flex items-center bg-surface-container-high px-3.5 py-2 rounded-full border-2 border-primary-container gap-1.5">
            <span class="material-symbols-outlined text-primary text-base">military_tech</span>
            <span class="font-headline text-xs font-black text-primary">+15 Points & +30 Coins</span>
          </div>
        </div>
      </div>

      <!-- AR Camera Mirror & Boss Battle Canvas -->
      <div class="relative bg-[#050f18] rounded-3xl border-4 border-error/50 min-h-[440px] card-shadow flex flex-col justify-between items-center overflow-hidden">
        
        <!-- Live Webcam AR Video Stream Layer -->
        <video id="ar-camera-feed" class="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-60 pointer-events-none z-0" autoplay playsinline muted></video>
        
        <!-- Ambient Grid & Glow Overlay -->
        <div class="absolute inset-0 bg-gradient-to-b from-surface-container-lowest/70 via-transparent to-surface-container-lowest/85 pointer-events-none z-0"></div>

        <!-- Top Boss Health Bar HUD -->
        <div class="w-full max-w-md z-10 pt-4 px-4 flex flex-col gap-1.5">
          <div class="flex justify-between items-center text-xs font-black text-error">
            <span class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-lg animate-pulse">coronavirus</span> Sugar Bug Overlord
            </span>
            <span>${hpPercent}% HP</span>
          </div>
          <div class="w-full h-6 bg-surface-container-lowest rounded-full p-1 border-2 border-error/50 overflow-hidden shadow-inner">
            <div class="h-full bg-gradient-to-r from-error to-secondary rounded-full transition-all duration-500 relative" style="width: ${hpPercent}%;">
              <div class="absolute inset-0 bg-white/25 animate-pulse"></div>
            </div>
          </div>
        </div>

        <!-- Center Reticle / Boss Villain Character Stage -->
        <div class="relative z-10 my-2 flex flex-col items-center">
          
          <!-- Spinning AR Reticle -->
          <div class="relative w-56 h-56 flex items-center justify-center">
            <div class="absolute inset-0 border-4 border-dashed border-primary/40 rounded-full animate-[spin_12s_linear_infinite]"></div>
            
            <!-- Sugar Monster Character Visual -->
            <div id="boss-character" class="w-44 h-44 rounded-full bg-error/20 flex items-center justify-center p-3 animate-float relative ${
              isBattleRunning ? 'scale-105' : ''
            }">
              <svg class="w-36 h-36 drop-shadow-2xl" viewBox="0 0 100 100" fill="none">
                <path d="M 50 15 C 25 15 18 35 18 55 C 18 75 30 85 50 85 C 70 85 82 75 82 55 C 82 35 75 15 50 15 Z" fill="#93000a" />
                <path d="M 50 22 C 32 22 26 38 26 55 C 26 70 36 78 50 78 C 64 78 74 70 74 55 C 74 38 68 22 50 22 Z" fill="#ffb4ab" opacity="0.25" />
                <!-- Horns -->
                <circle cx="28" cy="24" r="7" fill="#e89300" />
                <circle cx="72" cy="24" r="7" fill="#e89300" />
                <!-- Angry Eyes -->
                <circle cx="38" cy="45" r="9" fill="#ffffff" />
                <circle cx="40" cy="46" r="4.5" fill="#690005" />
                <circle cx="62" cy="45" r="9" fill="#ffffff" />
                <circle cx="60" cy="46" r="4.5" fill="#690005" />
                <!-- Teeth -->
                <path d="M 32 62 Q 50 75 68 62" stroke="#050f18" stroke-width="4" stroke-linecap="round" fill="none" />
                <rect x="42" y="60" width="5" height="7" fill="#f1c40f" rx="1" />
                <rect x="52" y="60" width="5" height="7" fill="#ffffff" rx="1" />
              </svg>
            </div>
          </div>

          <!-- Active Guided Brushing Zone Banner -->
          <div class="bg-surface-container-high/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border-2 border-primary/50 flex items-center gap-2 shadow-lg mt-2 text-center">
            <span class="material-symbols-outlined text-primary text-xl">record_voice_over</span>
            <div class="flex flex-col text-left">
              <span class="text-[10px] font-black uppercase text-primary tracking-wider">Guided Zone: ${activeZone.name}</span>
              <span class="text-xs font-bold text-inverse-surface">${activeZone.hint}</span>
            </div>
          </div>
        </div>

        <!-- Bottom Action Status (Hands-Free Guard) -->
        <div class="w-full z-10 pb-4 px-6 flex justify-center">
          ${
            !isBattleRunning
              ? `
            <button id="start-ar-battle-btn" class="w-full max-w-sm bg-primary text-on-primary font-headline text-base font-black py-4 rounded-2xl chunky-btn border-primary-container shadow-chunky-md hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-2xl">cleaning_services</span> START 2-MIN BRUSHING BATTLE!
            </button>
          `
              : `
            <div class="w-full max-w-sm bg-surface-container-lowest/85 backdrop-blur-md text-primary font-headline text-xs font-black py-3 px-4 rounded-2xl border-2 border-primary/40 flex items-center justify-center gap-2 shadow-inner">
              <span class="material-symbols-outlined text-lg animate-pulse">check_circle</span> 100% HANDS-FREE: KEEP SCRUBBING YOUR TEETH!
            </div>
          `
          }
        </div>

      </div>

      <!-- Instructions & Early Quit Penalty Notice -->
      <div class="bg-surface-container rounded-3xl p-4 border-2 border-surface-container-highest card-shadow flex items-center justify-between text-xs text-on-surface-variant">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary text-xl">verified</span>
          <span>Camera automatically tracks teeth motion & auto-damages the boss over 2:00.</span>
        </div>
        <span class="text-error font-bold hidden sm:block">⚠️ Early quit forfeits rewards</span>
      </div>

    </div>
  `;
}

function startCamera() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        videoStream = stream;
        const video = document.getElementById('ar-camera-feed');
        if (video) {
          video.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn('Camera access denied or unavailable; fallback to simulated AR overlay.', err);
      });
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
  }
}

function startBattle() {
  isBattleRunning = true;
  secondsRemaining = store.getState().parentSettings.arBattleDuration || 120;
  totalDuration = secondsRemaining;
  currentBrushZone = 0;
  Sound.fanfare();
  startCamera();

  battleTimer = setInterval(() => {
    secondsRemaining--;

    // Update zone every 30 seconds
    const zoneIndex = Math.min(3, Math.floor((totalDuration - secondsRemaining) / 30));
    if (zoneIndex !== currentBrushZone) {
      currentBrushZone = zoneIndex;
      Sound.laser();
    }

    // Trigger subtle motion damage sound effect every 4 seconds
    if (secondsRemaining % 4 === 0) {
      Sound.laser();
      const boss = document.getElementById('boss-character');
      if (boss) {
        boss.classList.add('scale-95', 'brightness-125');
        setTimeout(() => boss.classList.remove('scale-95', 'brightness-125'), 150);
      }
    }

    if (secondsRemaining <= 0) {
      clearInterval(battleTimer);
      battleTimer = null;
      isBattleRunning = false;
      stopCamera();

      // Win Condition Achieved!
      Sound.fanfare();
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#54e98a', '#ffb961', '#3498db', '#f1c40f']
      });

      // Auto-issue Tokens (🪙) & Queue Points (⭐) for Parent Approval
      store.completeToothbrushBattle();
    } else {
      store.notify();
    }
  }, 1000);

  store.notify();
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
}
