/**
 * WorldAdventureMapView.js
 * Consolidated 3D World Adventure Map & Waypoint Quests View
 * Dual-Tab Switcher:
 *   - Tab 1: "Today's Path" (Sequential morning-to-night routine & chore waypoints)
 *   - Tab 2: "3D Adventure Island" (Full 360° touch turntable procedural archipelago)
 *
 * Fully integrated with:
 *   - 3D Boss Colosseum direct links for toothbrushing
 *   - Secret Discovery Shrines & Parent Streak Stashes
 *   - Rex AI Voice / Gemini Live Co-Pilot & Learning Mini-Games
 *   - Strict Explorer Palette: Emerald green, solar orange, amber, starlight cyan, dark slate (No pink/purple)
 */

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import {
  WORLD_BIOMES,
  PATH_OF_VALOR_WAYPOINTS,
  SECRET_SHRINES,
  TOY_BOX_ENTITIES
} from '../data/worldMapData.js';
import { WorldAdventureMapCanvas } from '../components/WorldAdventureMapCanvas.js';
import { ADVENTURE_GAMES, getGameChallenges } from '../data/learningGamesData.js';
import { geminiLiveService } from '../services/geminiLiveService.js';
import { renderRexAvatarSvg } from '../components/LiveRexWidget.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import confetti from 'canvas-confetti';

let activeCanvasInstance = null;
let activeMiniGame = null;
let currentMiniGameIdx = 0;
let selectedModalWaypoint = null;

export function renderWorldAdventureMapView() {
  const state = store.getState();
  const hero = state.selectedHero;
  const activePet = store.getActivePet();
  const mapState = store.getWorldAdventureMapState();
  const activeTab = mapState.activeTab || 'path';
  const timeOfDay = store.getWorldAdventureMapState().islandTimeOverride || getTimeOfDayDefault();
  const kidDifficulty = hero.gameDifficulty || 'medium';

  // 1. IF PLAYING AN ADVENTURE MINI-GAME (Phonics, Math, etc.)
  if (activeMiniGame) {
    const challenges = getGameChallenges(activeMiniGame, kidDifficulty);
    const challenge = challenges[currentMiniGameIdx] || challenges[0];

    return `
      <div class="max-w-2xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-5 animate-fade-in select-none">
        
        <!-- Header -->
        <div class="flex items-center justify-between">
          <button id="world-game-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-4 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
            <span class="material-symbols-outlined text-base">arrow_back</span> Return to World Map
          </button>
          <div class="flex items-center gap-2">
            <span class="text-xs font-black uppercase text-[#f39c12]">${activeMiniGame.subject}</span>
            <span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-bold text-primary border border-primary/30">
              Challenge ${currentMiniGameIdx + 1} / ${challenges.length}
            </span>
          </div>
        </div>

        <!-- Question Arena Card -->
        <div class="bg-[#09141e] rounded-4xl p-6 sm:p-8 border-4 border-surface-container-highest shadow-[0_12px_0_0_#050f18] flex flex-col gap-6 text-center relative overflow-hidden">
          <div class="flex items-center justify-center gap-3">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border-2 border-surface-bright" style="background-color: ${activeMiniGame.color}25; color: ${activeMiniGame.color};">
              <span class="material-symbols-outlined text-3xl">${activeMiniGame.icon}</span>
            </div>
            <div class="flex flex-col text-left">
              <h2 class="font-headline text-xl font-black text-white">${activeMiniGame.title}</h2>
              <p class="text-xs text-slate-300 font-bold">${activeMiniGame.desc}</p>
            </div>
          </div>

          <div class="bg-[#0f2334] rounded-3xl p-6 border-2 border-surface-container-highest shadow-inner">
            <p class="font-headline text-xl sm:text-2xl font-black text-[#2ecc71] leading-snug">
              ${challenge.question}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3" id="world-mini-game-options">
            ${challenge.options.map((opt, idx) => `
              <button data-opt-idx="${idx}" class="world-game-opt-btn bg-[#162a3b] hover:bg-[#1f384d] text-white font-headline text-base font-black py-4 px-6 rounded-2xl border-2 border-surface-container-highest flex items-center justify-between active:scale-98 transition-all hover:border-[#2ecc71]">
                <span>${opt}</span>
                <span class="w-7 h-7 rounded-full bg-[#09141e] flex items-center justify-center text-xs text-slate-300">${String.fromCharCode(65 + idx)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // 2. MASTER DUAL-TAB VIEW: Today's Path vs 3D Adventure Island
  return `
    <div class="max-w-5xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-5 animate-fade-in select-none">
      
      <!-- TOP NAVIGATION & COMPANION VITAL BAR -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-headline text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-[#2ecc71] text-3xl" style="font-variation-settings: 'FILL' 1;">explore</span>
              World Adventure Map
            </h1>
            <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-primary/20 text-primary border-primary/30">
              ${kidDifficulty === 'easy' ? 'Audio Guided (3-4)' : kidDifficulty === 'hard' ? 'Hero Master (7-9)' : 'Explorer (5-6)'}
            </span>
          </div>
          <p class="text-xs font-bold text-slate-300">Conquer your daily routine stops and explore the 3D Floating Realm with ${activePet.name}!</p>
        </div>

        <div class="flex items-center gap-2.5 self-end sm:self-auto">
          <!-- Active Companion Badge -->
          <div class="bg-[#0f2334] px-3.5 py-1.5 rounded-2xl border-2 border-primary/30 flex items-center gap-2 shadow-sm">
            <img src="${activePet.avatar}" class="w-7 h-7 rounded-full border-2 border-[#2ecc71] object-cover" />
            <div class="flex flex-col">
              <span class="text-[9px] font-black uppercase text-slate-300">${activePet.name}</span>
              <span class="font-headline text-[11px] font-black text-[#f39c12] flex items-center gap-0.5">
                <span class="material-symbols-outlined text-xs">bolt</span> ${activePet.energy || 85}%
              </span>
            </div>
          </div>

          <!-- Total Stars -->
          <div class="bg-[#0f2334] px-3.5 py-1.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 shadow-sm">
            <span class="text-[#ffb961] text-base">⭐</span>
            <span class="font-headline text-xs font-black text-white">${hero.stars || 14} Stars</span>
          </div>
        </div>
      </div>

      <!-- DUAL-TAB SWITCHER (STRICT EXPLORER THEME) -->
      <div class="grid grid-cols-2 gap-2 bg-[#09141e] p-1.5 rounded-3xl border-3 border-surface-container-highest shadow-md">
        <button id="tab-btn-path" class="py-3 px-4 rounded-2xl font-headline text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
          activeTab === 'path'
            ? 'bg-gradient-to-r from-[#2ecc71] to-[#27ae60] text-[#050f18] shadow-[0_4px_0_0_#145237] -translate-y-0.5'
            : 'text-slate-300 hover:text-white hover:bg-surface-container-high/40'
        }">
          <span class="material-symbols-outlined text-base sm:text-lg" style="font-variation-settings: 'FILL' 1;">route</span>
          <span>TODAY'S PATH (8 STOPS)</span>
        </button>

        <button id="tab-btn-island" class="py-3 px-4 rounded-2xl font-headline text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
          activeTab === 'island'
            ? 'bg-gradient-to-r from-[#00d2d3] to-[#01a3a4] text-[#050f18] shadow-[0_4px_0_0_#065261] -translate-y-0.5'
            : 'text-slate-300 hover:text-white hover:bg-surface-container-high/40'
        }">
          <span class="material-symbols-outlined text-base sm:text-lg" style="font-variation-settings: 'FILL' 1;">public</span>
          <span>3D ADVENTURE ISLAND</span>
        </button>
      </div>

      <!-- TAB 1: TODAY'S PATH (SEQUENTIAL ROUTINE TRAIL) -->
      ${activeTab === 'path' ? renderTodaysPathTab(hero, activePet, mapState) : ''}

      <!-- TAB 2: 3D ADVENTURE ISLAND (360 TURNTABLE SANDBOX) -->
      ${activeTab === 'island' ? renderIslandSandboxTab(hero, activePet, mapState, timeOfDay) : ''}

      <!-- WAYPOINT DETAIL MODAL (WHEN A STOP IS CLICKED) -->
      ${selectedModalWaypoint ? renderWaypointModal(selectedModalWaypoint, hero) : ''}

    </div>
  `;
}

function getTimeOfDayDefault() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'bedtime';
}

function renderTodaysPathTab(hero, activePet, mapState) {
  const waypoints = PATH_OF_VALOR_WAYPOINTS;
  const nextWaypoint = waypoints.find(w => !isWaypointDone(w, hero)) || waypoints[0];

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      
      <!-- NEXT UP BANNER (CHUNKY CALLOUT) -->
      <div class="bg-gradient-to-r from-[#122838] via-[#0b1b26] to-[#09141e] border-3 border-[#2ecc71]/60 rounded-3xl p-5 shadow-[0_8px_0_0_#050f18] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-14 h-14 rounded-2xl bg-[#2ecc71]/20 border-2 border-[#2ecc71] flex items-center justify-center text-[#2ecc71] shrink-0 shadow-inner">
            <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">${nextWaypoint.icon}</span>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#f39c12] text-black">Next Hero Stop</span>
              <span class="text-xs font-bold text-slate-300">Step ${nextWaypoint.stepNumber} of 8</span>
            </div>
            <h2 class="font-headline text-lg sm:text-xl font-black text-white">${nextWaypoint.title}</h2>
            <p class="text-xs text-slate-300 font-semibold">${nextWaypoint.speechPrompt}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto">
          ${nextWaypoint.linkedBossId ? `
            <button id="path-launch-boss-btn" class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-headline font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_0_0_#4a0008] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer animate-pulse">
              <span class="material-symbols-outlined text-base">swords</span>
              <span>BATTLE BOSS!</span>
            </button>
          ` : `
            <button data-complete-waypoint="${nextWaypoint.id}" class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-[#2ecc71] to-[#27ae60] text-[#050f18] font-headline font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_0_0_#145237] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer">
              <span class="material-symbols-outlined text-base">check_circle</span>
              <span>COMPLETE HABIT</span>
            </button>
          `}
        </div>
      </div>

      <!-- 8 SEQUENTIAL ROUTINE STOPS LIST -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        ${waypoints.map((wp) => {
          const isDone = isWaypointDone(wp, hero);
          return `
            <div class="bg-[#0f2334] rounded-3xl p-4 border-2 ${isDone ? 'border-[#2ecc71]/40 opacity-90' : 'border-surface-container-highest'} shadow-[0_4px_0_0_#050f18] flex items-center justify-between gap-3 hover:border-primary/50 transition-all">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                  isDone ? 'bg-[#2ecc71] text-[#050f18]' : 'bg-[#1a3850] text-[#ffb961]'
                }">
                  ${isDone ? '<span class="material-symbols-outlined font-black">check</span>' : `<span class="font-headline font-black">${wp.stepNumber}</span>`}
                </div>
                <div class="flex flex-col text-left">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-black uppercase text-[#f39c12]">${wp.category}</span>
                    <span class="text-slate-400">•</span>
                    <span class="text-[11px] font-bold text-slate-300">+${wp.rewardCoins} 🪙 +${wp.rewardSparks} ⚡</span>
                  </div>
                  <h3 class="font-headline text-sm sm:text-base font-black text-white leading-tight ${isDone ? 'line-through text-slate-400' : ''}">
                    ${wp.title}
                  </h3>
                </div>
              </div>

              <button data-view-waypoint="${wp.id}" class="bg-[#1b3d58] hover:bg-[#255073] text-white p-2.5 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95 shrink-0" title="Inspect Stop">
                <span class="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- LEARNING ADVENTURES REALMS SHORTCUT CARDS -->
      <div class="mt-4 bg-[#09141e] rounded-3xl p-5 border-3 border-surface-container-highest shadow-md flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#f39c12]">school</span>
            <span class="font-headline font-black text-sm text-white">Pet Learning Mini-Games</span>
          </div>
          <span class="text-[11px] font-bold text-slate-300">Earn +25 Tokens per game!</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          ${ADVENTURE_GAMES.slice(0, 3).map(g => `
            <button data-launch-game="${g.id}" class="bg-[#0f2334] hover:bg-[#16334a] p-3 rounded-2xl border-2 border-surface-container-highest flex items-center gap-2.5 text-left active:scale-95 transition-all">
              <span class="material-symbols-outlined text-2xl text-[#2ecc71]">${g.icon}</span>
              <div class="flex flex-col min-w-0">
                <span class="font-headline text-xs font-black text-white truncate">${g.title}</span>
                <span class="text-[10px] text-slate-400 font-bold">${g.subject}</span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}

function renderIslandSandboxTab(hero, activePet, mapState, timeOfDay) {
  const interactions = mapState.toyBoxInteractions || { applesHarvested: 0, waterfallSplashes: 0, chimesPlayed: 0 };
  const isLullabyActive = mapState.bedtimeLullabyActive;

  return `
    <div class="flex flex-col gap-4 animate-fade-in">
      
      <!-- TOP 3D HUD CONTROLS (TIME & RECENTER) -->
      <div class="flex flex-wrap items-center justify-between gap-2.5 bg-[#09141e] px-4 py-2.5 rounded-2xl border-2 border-surface-container-highest">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase text-slate-300">Atmosphere:</span>
          <span class="text-xs font-black px-2.5 py-0.5 rounded-full ${
            timeOfDay === 'bedtime' ? 'bg-[#ffb961]/20 text-[#ffb961] border border-[#ffb961]/40' :
            timeOfDay === 'sunset' ? 'bg-[#f39c12]/20 text-[#f39c12] border border-[#f39c12]/40' :
            timeOfDay === 'morning' ? 'bg-[#2ecc71]/20 text-[#2ecc71] border border-[#2ecc71]/40' :
            'bg-[#00d2d3]/20 text-[#00d2d3] border border-[#00d2d3]/40'
          }">
            ${timeOfDay === 'bedtime' ? '🌙 Bedtime Twilight & Fireflies' :
              timeOfDay === 'sunset' ? '🌅 Golden Sunset' :
              timeOfDay === 'morning' ? '☀️ Morning Sunrise' : '🌤️ Sunny Daylight'}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Bedtime Lullaby Toggle Button -->
          <button id="island-toggle-lullaby-btn" class="px-3 py-1.5 rounded-xl font-headline text-xs font-black flex items-center gap-1.5 chunky-btn-sm transition-all ${
            isLullabyActive ? 'bg-[#ffb961] text-[#050f18] shadow' : 'bg-surface-container-high text-slate-300 hover:text-white'
          }">
            <span class="material-symbols-outlined text-sm">music_note</span>
            <span>${isLullabyActive ? 'Lullaby Playing' : 'Play Lullaby'}</span>
          </button>

          <!-- Recenter Camera -->
          <button id="island-recenter-cam-btn" class="bg-surface-container-high hover:bg-surface-bright text-white px-3 py-1.5 rounded-xl font-headline text-xs font-black flex items-center gap-1 chunky-btn-sm active:scale-95">
            <span class="material-symbols-outlined text-sm">restart_alt</span>
            <span>Reset View</span>
          </button>
        </div>
      </div>

      <!-- MAIN 3D FLOATING ISLAND CANVAS VIEWPORT -->
      <div class="relative bg-[#050f18] rounded-4xl border-4 border-surface-container-highest shadow-[0_16px_0_0_#030910] min-h-[560px] overflow-hidden flex flex-col justify-between">
        
        <canvas id="world-adventure-canvas" class="w-full h-[560px] block cursor-grab active:cursor-grabbing touch-none select-none"></canvas>

        <!-- FLOATING OVERLAY HINTS -->
        <div class="absolute top-4 left-4 pointer-events-none bg-[#09141e]/85 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-surface-container-highest text-xs text-slate-300 font-bold flex items-center gap-2 shadow">
          <span class="text-[#2ecc71] animate-pulse">●</span>
          <span>Drag to orbit 360° • Pinch to zoom • Tap objects to interact!</span>
        </div>

        <!-- BOTTOM TOY-BOX STATS STRIP -->
        <div class="absolute bottom-4 left-4 right-4 bg-[#09141e]/90 backdrop-blur-md p-3 rounded-2xl border-2 border-surface-container-highest flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div class="flex items-center gap-4 text-xs font-black">
            <span class="text-[#2ecc71] flex items-center gap-1">
              🍎 ${interactions.applesHarvested} Apples Picked
            </span>
            <span class="text-[#00d2d3] flex items-center gap-1">
              🐟 ${interactions.waterfallSplashes} Splashes Made
            </span>
            <span class="text-[#ffb961] flex items-center gap-1">
              🎵 ${interactions.chimesPlayed} Chimes Ringing
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button id="island-inspect-secrets-btn" class="bg-primary/20 text-primary border border-primary/40 px-3 py-1 rounded-xl text-xs font-black hover:bg-primary/30 active:scale-95 transition-all">
              ★ View 4 Secret Shrines
            </button>
          </div>
        </div>

      </div>

    </div>
  `;
}

function renderWaypointModal(wp, hero) {
  const isDone = isWaypointDone(wp, hero);

  return `
    <div id="waypoint-modal-backdrop" class="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div class="bg-[#09141e] border-4 border-surface-container-highest rounded-4xl p-6 sm:p-8 max-w-md w-full shadow-[0_16px_0_0_#050f18] flex flex-col gap-5 text-center relative overflow-hidden">
        
        <button id="close-waypoint-modal-btn" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high text-slate-300 hover:text-white flex items-center justify-center font-black">
          ✕
        </button>

        <!-- Icon & Title -->
        <div class="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-inner border-2 border-surface-bright" style="background-color: ${wp.color}25; color: ${wp.color};">
          <span class="material-symbols-outlined text-4xl">${wp.icon}</span>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-xs font-black uppercase text-[#f39c12]">Waypoint Stop ${wp.stepNumber}</span>
          <h2 class="font-headline text-2xl font-black text-white">${wp.title}</h2>
          <p class="text-xs text-slate-300 font-bold mt-1">${wp.speechPrompt}</p>
        </div>

        <!-- Rewards Box -->
        <div class="grid grid-cols-3 gap-2 bg-[#0f2334] p-3 rounded-2xl border border-surface-container-highest">
          <div class="flex flex-col items-center">
            <span class="text-[10px] uppercase font-black text-slate-400">Tokens</span>
            <span class="text-sm font-black text-[#2ecc71]">+${wp.rewardCoins} 🪙</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-[10px] uppercase font-black text-slate-400">Hero XP</span>
            <span class="text-sm font-black text-[#00d2d3]">+${wp.rewardXp} ⭐</span>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-[10px] uppercase font-black text-slate-400">Sparks</span>
            <span class="text-sm font-black text-[#ffb961]">+${wp.rewardSparks} ⚡</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2 pt-2">
          ${wp.linkedBossId ? `
            <button id="modal-boss-fight-btn" class="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-headline text-base font-black tracking-wide shadow-[0_6px_0_0_#4a0008] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer animate-pulse">
              <span class="material-symbols-outlined text-2xl">swords</span>
              <span>LAUNCH HYGIENE BOSS BATTLE!</span>
            </button>
          ` : `
            <button id="modal-complete-chore-btn" class="w-full py-4 rounded-2xl bg-gradient-to-r from-[#2ecc71] to-[#27ae60] text-[#050f18] font-headline text-base font-black tracking-wide shadow-[0_6px_0_0_#145237] active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 cursor-pointer">
              <span class="material-symbols-outlined text-2xl">check_circle</span>
              <span>${isDone ? 'COMPLETED TODAY' : 'MARK CHORE COMPLETE'}</span>
            </button>
          `}
        </div>

      </div>
    </div>
  `;
}

function isWaypointDone(wp, hero) {
  // Check if routine/chore for this waypoint is completed today
  const routines = store.getState().taskForest || [];
  const r = routines.find(r => r.id === wp.choreKey);
  return r ? r.completed : false;
}

export function attachWorldAdventureMapListeners() {
  const mapState = store.getWorldAdventureMapState();
  const activeTab = mapState.activeTab || 'path';

  // 1. Dual-Tab Switcher
  const pathTabBtn = document.getElementById('tab-btn-path');
  const islandTabBtn = document.getElementById('tab-btn-island');

  if (pathTabBtn) {
    pathTabBtn.addEventListener('click', () => {
      Sound.tap();
      store.setWorldMapTab('path');
      store.notify();
    });
  }

  if (islandTabBtn) {
    islandTabBtn.addEventListener('click', () => {
      Sound.tap();
      store.setWorldMapTab('island');
      store.notify();
    });
  }

  // 2. Initialize 3D Canvas if Island Tab is active
  if (activeTab === 'island') {
    const canvasElem = document.getElementById('world-adventure-canvas');
    if (canvasElem) {
      if (activeCanvasInstance) {
        activeCanvasInstance.destroy();
      }
      activeCanvasInstance = new WorldAdventureMapCanvas(canvasElem, {
        onWaypointClick: (wp) => {
          selectedModalWaypoint = wp;
          store.notify();
        }
      });
    }

    // Recenter camera button
    const recenterBtn = document.getElementById('island-recenter-cam-btn');
    if (recenterBtn && activeCanvasInstance) {
      recenterBtn.addEventListener('click', () => {
        Sound.chirp();
        activeCanvasInstance.recenter();
      });
    }

    // Toggle lullaby button
    const lullabyBtn = document.getElementById('island-toggle-lullaby-btn');
    if (lullabyBtn) {
      lullabyBtn.addEventListener('click', () => {
        const active = store.toggleBedtimeLullaby();
        if (active) {
          voicePrompts.speak("Bedtime twilight mode activated. Sweet dreams Little Hero!");
        }
      });
    }

    // Secret Shrines List Button
    const secretsBtn = document.getElementById('island-inspect-secrets-btn');
    if (secretsBtn) {
      secretsBtn.addEventListener('click', () => {
        Sound.tap();
        const shrines = SECRET_SHRINES;
        const msg = shrines.map((s, i) => `${i + 1}. ${s.name}: ${s.hint}`).join('\n\n');
        store.showReward('4 Secret Island Shrines', msg, 0, 0);
      });
    }
  }

  // 3. Waypoint Navigation & Completers in Today's Path
  document.querySelectorAll('[data-view-waypoint]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wpId = btn.getAttribute('data-view-waypoint');
      const wp = PATH_OF_VALOR_WAYPOINTS.find(w => w.id === wpId);
      if (wp) {
        Sound.tap();
        selectedModalWaypoint = wp;
        store.notify();
      }
    });
  });

  document.querySelectorAll('[data-complete-waypoint]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wpId = btn.getAttribute('data-complete-waypoint');
      const res = store.completeWaypointChore(wpId);
      if (res.success) {
        store.showReward(
          'Chore Waypoint Mastered!',
          `Awesome job completing ${res.waypoint.title}!`,
          res.waypoint.rewardCoins,
          Math.round(res.waypoint.rewardCoins / 2)
        );
      }
    });
  });

  const launchBossBtn = document.getElementById('path-launch-boss-btn');
  if (launchBossBtn) {
    launchBossBtn.addEventListener('click', () => {
      Sound.click();
      voicePrompts.speak("3, 2, 1, BRUSH!");
      store.navigate('ar_battle');
    });
  }

  // 4. Modal Handlers
  const closeModalBtn = document.getElementById('close-waypoint-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      selectedModalWaypoint = null;
      store.notify();
    });
  }

  const modalBossBtn = document.getElementById('modal-boss-fight-btn');
  if (modalBossBtn) {
    modalBossBtn.addEventListener('click', () => {
      selectedModalWaypoint = null;
      Sound.click();
      store.navigate('ar_battle');
    });
  }

  const modalCompleteBtn = document.getElementById('modal-complete-chore-btn');
  if (modalCompleteBtn && selectedModalWaypoint) {
    modalCompleteBtn.addEventListener('click', () => {
      const wp = selectedModalWaypoint;
      selectedModalWaypoint = null;
      const res = store.completeWaypointChore(wp.id);
      if (res.success) {
        store.showReward(
          'Chore Completed!',
          `Way to go! You cleared ${wp.title}!`,
          wp.rewardCoins,
          Math.round(wp.rewardCoins / 2)
        );
      }
    });
  }

  // 5. Mini-game launcher
  document.querySelectorAll('[data-launch-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.getAttribute('data-launch-game');
      const game = ADVENTURE_GAMES.find(g => g.id === gId);
      if (game) {
        Sound.click();
        activeMiniGame = game;
        currentMiniGameIdx = 0;
        store.notify();
      }
    });
  });

  const exitMiniGameBtn = document.getElementById('world-game-exit-btn');
  if (exitMiniGameBtn) {
    exitMiniGameBtn.addEventListener('click', () => {
      activeMiniGame = null;
      currentMiniGameIdx = 0;
      store.notify();
    });
  }

  document.querySelectorAll('.world-game-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!activeMiniGame) return;
      const kidDiff = store.getState().selectedHero?.gameDifficulty || 'medium';
      const challenges = getGameChallenges(activeMiniGame, kidDiff);
      const challenge = challenges[currentMiniGameIdx] || challenges[0];
      const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);

      if (optIdx === challenge.answer) {
        Sound.fanfare();
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
        btn.classList.add('bg-emerald-500/20', 'border-emerald-400');
        setTimeout(() => {
          if (currentMiniGameIdx + 1 < challenges.length) {
            currentMiniGameIdx++;
            store.notify();
          } else {
            const hero = store.getState().selectedHero;
            hero.coins = (hero.coins || 0) + 25;
            hero.xp = (hero.xp || 0) + 20;
            activeMiniGame = null;
            currentMiniGameIdx = 0;
            store.showReward('Realm Challenge Cleared!', 'You earned +25 Coins & +20 XP!', 25, 10);
          }
        }, 500);
      } else {
        Sound.boing();
        btn.classList.add('border-red-500', 'text-red-400', 'animate-shake');
        setTimeout(() => btn.classList.remove('border-red-500', 'text-red-400', 'animate-shake'), 600);
      }
    });
  });
}
