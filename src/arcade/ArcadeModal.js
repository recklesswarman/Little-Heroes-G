/**
 * ArcadeModal.js
 * 
 * Universal Full-Screen Touch Canvas Modal for the 4 Starlight Arcade Mini-Games.
 * Provides responsive HTML5 Canvas hosting, high-DPI scaling, toddler-accessible
 * Pause, Resume, Restart, Sound Mute, and Exit controls.
 * 
 * Complies strictly with the Explorer Palette:
 * #09141e Midnight Slate, #10b981 Emerald, #00d2d3 Cyan, #f59e0b Solar Amber, #ffb961 Warm Amber.
 * ZERO pink or purple.
 */

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakCompanion, stopCompanionAudio } from '../services/voiceService.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import confetti from 'canvas-confetti';

import { StarlightRunnerGame } from './StarlightRunnerGame.js';
import { GermBustersGame } from './GermBustersGame.js';
import { BubbleCannonGame } from './BubbleCannonGame.js';
import { MazeExplorerGame } from './MazeExplorerGame.js';

export const ARCADE_GAMES_METADATA = {
  starlight_runner: {
    id: 'starlight_runner',
    title: 'Starlight Dino Runner',
    shortTitle: 'Dino Runner',
    subtitle: 'Endless side-scroller with double-jump & fruit collecting',
    icon: '🦖',
    themeColor: '#10b981',
    borderColor: 'border-emerald-500/40',
    bgBadge: 'bg-emerald-500/20 text-emerald-300'
  },
  germ_busters: {
    id: 'germ_busters',
    title: 'Germ Busters',
    shortTitle: 'Germ Busters',
    subtitle: 'Whack-a-mole reflex fun cleansing sugar bugs & tartar',
    icon: '🪥',
    themeColor: '#00d2d3',
    borderColor: 'border-cyan-500/40',
    bgBadge: 'bg-cyan-500/20 text-cyan-300'
  },
  bubble_cannon: {
    id: 'bubble_cannon',
    title: 'Celestial Bubble Cannon',
    shortTitle: 'Bubble Cannon',
    subtitle: 'Aim & launch treat orbs to match 3+ celestial bubbles',
    icon: '🫧',
    themeColor: '#f59e0b',
    borderColor: 'border-amber-500/40',
    bgBadge: 'bg-amber-500/20 text-amber-300'
  },
  maze_explorer: {
    id: 'maze_explorer',
    title: 'Toddler Maze Explorer',
    shortTitle: 'Maze Explorer',
    subtitle: 'Path-tracing labyrinth guiding your pet to treasure',
    icon: '🗺️',
    themeColor: '#ffb961',
    borderColor: 'border-amber-400/40',
    bgBadge: 'bg-amber-400/20 text-amber-200'
  }
};

export class ArcadeModal {
  constructor(gameId, options = {}) {
    this.gameId = gameId;
    this.meta = ARCADE_GAMES_METADATA[gameId] || ARCADE_GAMES_METADATA.starlight_runner;
    this.options = options;
    this.modalEl = null;
    this.canvasEl = null;
    this.gameInstance = null;

    const hero = store.getState().selectedHero;
    this.hero = hero;
    this.activePet = store.getActivePet();
    this.toddlerMode = (hero?.gameDifficulty === 'easy') || store.isEasyMode?.();

    this.isMuted = Sound.isMuted();
    this.isPaused = false;
    this.isGameOver = false;

    this.currentScore = 0;
    this.lastRewardResult = null;

    this.handleResize = this.handleResize.bind(this);
  }

  open() {
    // Check bedtime curfew / screen time lock first!
    if (store.isScreenTimeLocked && store.isScreenTimeLocked(this.hero)) {
      this.renderCurfewLockModal();
      return;
    }

    this.renderModal();
    this.initCanvasAndGame();
    window.addEventListener('resize', this.handleResize);
  }

  close() {
    try {
      if (typeof stopCompanionAudio === 'function') stopCompanionAudio();
    } catch (e) {}
    if (this.gameInstance) {
      this.gameInstance.destroy();
      this.gameInstance = null;
    }
    window.removeEventListener('resize', this.handleResize);
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
    this.modalEl = null;
    Sound.click();
    store.notify();
  }

  renderCurfewLockModal() {
    const existing = document.getElementById('arcade-modal-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'arcade-modal-root';
    root.className = 'fixed inset-0 z-50 bg-[#09141e]/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none';

    const lockMsg = store.getScreenTimeLockMessage ? store.getScreenTimeLockMessage(this.hero) : 'Time for bedtime!';

    root.innerHTML = `
      <div class="w-full max-w-md bg-[#0d2235] border-3 border-amber-500/50 rounded-3xl p-6 text-center flex flex-col items-center gap-4 card-shadow">
        <div class="w-20 h-20 rounded-full bg-amber-500/20 border-3 border-amber-400 flex items-center justify-center text-4xl animate-bounce">
          🦖🌙
        </div>
        <h2 class="font-headline text-xl font-black text-amber-300">Screen Time Lock Active</h2>
        <p class="text-sm font-bold text-inverse-surface leading-relaxed">${escapeHtml(lockMsg)}</p>
        <button id="curfew-close-btn" class="w-full bg-primary text-on-primary font-headline text-sm font-black py-3.5 rounded-2xl chunky-btn shadow-chunky-sm active:scale-95">
          BACK TO MOVEMENT HUB 🌟
        </button>
      </div>
    `;

    document.body.appendChild(root);
    this.modalEl = root;

    const closeBtn = root.querySelector('#curfew-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }

  renderModal() {
    const existing = document.getElementById('arcade-modal-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'arcade-modal-root';
    root.className = 'fixed inset-0 z-50 bg-[#09141e]/98 backdrop-blur-md flex flex-col animate-fade-in select-none';

    const petName = this.activePet ? escapeHtml(this.activePet.name) : 'Companion';
    const topScores = store.getArcadeHighScores ? store.getArcadeHighScores(this.gameId, this.hero) : [];
    const bestScore = topScores.length > 0 ? topScores[0] : 0;

    root.innerHTML = `
      <!-- Top Control Bar -->
      <header class="flex items-center justify-between px-3 sm:px-6 py-3 bg-[#0d2235]/90 border-b-2 border-secondary/30 shrink-0">
        
        <!-- Left: Exit Button -->
        <button id="arcade-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-black px-3.5 py-2 rounded-xl border border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
          <span class="material-symbols-outlined text-base">arrow_back</span>
          <span class="hidden sm:inline">Exit</span>
        </button>

        <!-- Center: Game Title & Pet Badge -->
        <div class="flex items-center gap-2">
          <span class="text-2xl">${this.meta.icon}</span>
          <div class="flex flex-col text-center">
            <span class="font-headline text-xs sm:text-sm font-black text-inverse-surface leading-tight">${this.meta.title}</span>
            <span class="text-[10px] font-bold text-secondary">Hero Pet: ${petName} • 🏆 Best: ${bestScore}</span>
          </div>
        </div>

        <!-- Right: Audio, Toddler Mode, Pause -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          
          <!-- Toddler Mode Toggle -->
          <button id="arcade-mode-toggle-btn" class="bg-surface-container hover:bg-surface-bright text-xs font-black px-2.5 py-1.5 rounded-xl border border-secondary/40 flex items-center gap-1 text-secondary active:scale-95" title="Toggle Toddler / Big Kid mode">
            <span>${this.toddlerMode ? '👶 Toddler' : '🚀 Big Kid'}</span>
          </button>

          <!-- Audio Mute Toggle -->
          <button id="arcade-sound-btn" class="bg-surface-container hover:bg-surface-bright p-2 rounded-xl border border-surface-container-highest text-inverse-surface flex items-center justify-center active:scale-95" title="Toggle Sound">
            <span class="material-symbols-outlined text-base">${this.isMuted ? 'volume_off' : 'volume_up'}</span>
          </button>

          <!-- Pause Button -->
          <button id="arcade-pause-btn" class="bg-surface-container hover:bg-surface-bright p-2 rounded-xl border border-surface-container-highest text-inverse-surface flex items-center justify-center active:scale-95" title="Pause Game">
            <span class="material-symbols-outlined text-base">pause</span>
          </button>
        </div>
      </header>

      <!-- Main Canvas Viewport Container -->
      <main id="arcade-viewport" class="relative flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <canvas id="arcade-canvas" class="block rounded-2xl shadow-2xl border-2 border-secondary/30 touch-none max-w-full max-h-full"></canvas>

        <!-- Overlays (Pause, Game Over) -->
        <div id="arcade-pause-overlay" class="hidden absolute inset-0 bg-[#09141e]/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4 p-6 text-center animate-fade-in">
          <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl">
            ⏸️
          </div>
          <h2 class="font-headline text-2xl font-black text-inverse-surface">Game Paused</h2>
          <div class="flex flex-col gap-2.5 w-full max-w-xs mt-2">
            <button id="arcade-resume-btn" class="bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-xl chunky-btn shadow-sm active:scale-95">
              RESUME GAME ▶️
            </button>
            <button id="arcade-finish-claim-btn" class="bg-surface-container text-amber-300 font-headline text-xs font-black py-2.5 rounded-xl border border-amber-400/40 chunky-btn-sm active:scale-95">
              FINISH & CLAIM REWARDS 🏆
            </button>
            <button id="arcade-restart-btn" class="bg-surface-container text-secondary font-headline text-xs font-black py-2.5 rounded-xl border border-secondary/40 chunky-btn-sm active:scale-95">
              RESTART ROUND 🔄
            </button>
            <button id="arcade-overlay-exit-btn" class="bg-surface-container-high text-on-surface-variant font-headline text-xs font-black py-2.5 rounded-xl chunky-btn-sm active:scale-95">
              EXIT TO ARCADE 🚪
            </button>
          </div>
        </div>

        <div id="arcade-gameover-overlay" class="hidden absolute inset-0 bg-[#09141e]/92 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3.5 p-6 text-center animate-fade-in overflow-y-auto">
          <!-- Filled dynamically when round completes -->
        </div>

        <!-- Touch Controls Bar for Mobile Runner & Maze -->
        <div id="arcade-touch-controls" class="absolute bottom-4 left-0 right-0 px-6 flex justify-between items-center pointer-events-none z-10">
          <!-- Populated if game requires explicit buttons -->
        </div>
      </main>
    `;

    document.body.appendChild(root);
    this.modalEl = root;

    this.bindModalEvents();
  }

  bindModalEvents() {
    if (!this.modalEl) return;

    // Exit handler: if child has points mid-game, conclude round so they get coins
    const handleExitClick = () => {
      if (!this.isGameOver && this.currentScore > 0) {
        this.togglePause(false);
        this.handleGameOver(this.currentScore, { cleared: false, exited: true });
      } else {
        this.close();
      }
    };

    // Exit Buttons
    const exitBtn = this.modalEl.querySelector('#arcade-exit-btn');
    if (exitBtn) exitBtn.addEventListener('click', handleExitClick);

    const overlayExitBtn = this.modalEl.querySelector('#arcade-overlay-exit-btn');
    if (overlayExitBtn) overlayExitBtn.addEventListener('click', handleExitClick);

    const finishBtn = this.modalEl.querySelector('#arcade-finish-claim-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        this.togglePause(false);
        this.handleGameOver(this.currentScore, { cleared: false, manualFinish: true });
      });
    }

    // Sound Toggle Button
    const soundBtn = this.modalEl.querySelector('#arcade-sound-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        Sound.toggleMute();
        this.isMuted = Sound.isMuted();
        const icon = soundBtn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = this.isMuted ? 'volume_off' : 'volume_up';
      });
    }

    // Toddler Mode Toggle
    const modeBtn = this.modalEl.querySelector('#arcade-mode-toggle-btn');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        this.toddlerMode = !this.toddlerMode;
        modeBtn.innerHTML = `<span>${this.toddlerMode ? '👶 Toddler' : '🚀 Big Kid'}</span>`;
        if (this.gameInstance) {
          if (typeof this.gameInstance.setToddlerMode === 'function') {
            this.gameInstance.setToddlerMode(this.toddlerMode);
          } else {
            this.gameInstance.toddlerMode = this.toddlerMode;
            this.gameInstance.restart();
          }
        }
        Sound.click();
      });
    }

    // Pause / Resume
    const pauseBtn = this.modalEl.querySelector('#arcade-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.togglePause();
      });
    }

    const resumeBtn = this.modalEl.querySelector('#arcade-resume-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        this.togglePause(false);
      });
    }

    const restartBtn = this.modalEl.querySelector('#arcade-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.togglePause(false);
        if (this.gameInstance) this.gameInstance.restart();
      });
    }
  }

  togglePause(forceState = null) {
    if (!this.gameInstance) return;
    this.isPaused = forceState !== null ? forceState : !this.isPaused;

    const overlay = this.modalEl.querySelector('#arcade-pause-overlay');
    const pauseBtnIcon = this.modalEl.querySelector('#arcade-pause-btn .material-symbols-outlined');

    if (this.isPaused) {
      this.gameInstance.pause();
      if (overlay) overlay.classList.remove('hidden');
      if (pauseBtnIcon) pauseBtnIcon.textContent = 'play_arrow';
    } else {
      if (overlay) overlay.classList.add('hidden');
      if (pauseBtnIcon) pauseBtnIcon.textContent = 'pause';
      this.gameInstance.resume();
    }
    Sound.click();
  }

  initCanvasAndGame() {
    this.canvasEl = this.modalEl.querySelector('#arcade-canvas');
    if (!this.canvasEl) return;

    this.handleResize();

    const gameOptions = {
      pet: this.activePet,
      toddlerMode: this.toddlerMode,
      onScoreUpdate: (score, streak) => {
        this.currentScore = score;
      },
      onGameOver: (finalScore, stats) => {
        this.handleGameOver(finalScore, stats);
      },
      onVoiceCheer: (phrase) => {
        if (this.isMuted || Sound.isMuted()) return;
        try {
          const petId = this.activePet ? this.activePet.id : 'rex';
          speakCompanion(phrase, petId).catch(() => {});
        } catch (e) {}
      }
    };

    if (this.gameId === 'starlight_runner') {
      this.gameInstance = new StarlightRunnerGame(this.canvasEl, gameOptions);
      this.setupRunnerTouchButton();
    } else if (this.gameId === 'germ_busters') {
      this.gameInstance = new GermBustersGame(this.canvasEl, gameOptions);
    } else if (this.gameId === 'bubble_cannon') {
      this.gameInstance = new BubbleCannonGame(this.canvasEl, gameOptions);
    } else if (this.gameId === 'maze_explorer') {
      this.gameInstance = new MazeExplorerGame(this.canvasEl, gameOptions);
      this.setupMazeTouchDPad();
    } else {
      this.gameInstance = new StarlightRunnerGame(this.canvasEl, gameOptions);
    }

    this.gameInstance.start();
  }

  setupRunnerTouchButton() {
    const controls = this.modalEl.querySelector('#arcade-touch-controls');
    if (!controls) return;
    controls.innerHTML = `
      <div></div>
      <button id="touch-runner-jump-btn" class="pointer-events-auto w-24 h-24 rounded-full bg-linear-to-b from-emerald-500 to-emerald-700 border-4 border-cyan-300 text-white font-headline text-sm font-black shadow-2xl active:scale-90 flex flex-col items-center justify-center">
        <span class="text-2xl">⬆️</span>
        <span>JUMP</span>
      </button>
    `;
    const btn = controls.querySelector('#touch-runner-jump-btn');
    if (btn) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.gameInstance && typeof this.gameInstance.jump === 'function') {
          this.gameInstance.jump();
        }
      });
    }
  }

  setupMazeTouchDPad() {
    const controls = this.modalEl.querySelector('#arcade-touch-controls');
    if (!controls) return;
    controls.innerHTML = `
      <div class="pointer-events-auto grid grid-cols-3 gap-1.5 w-44">
        <div></div>
        <button data-dpad="up" class="h-12 rounded-xl bg-surface-container border-2 border-secondary/50 text-xl font-black text-secondary flex items-center justify-center active:scale-90">⬆️</button>
        <div></div>
        <button data-dpad="left" class="h-12 rounded-xl bg-surface-container border-2 border-secondary/50 text-xl font-black text-secondary flex items-center justify-center active:scale-90">⬅️</button>
        <button data-dpad="down" class="h-12 rounded-xl bg-surface-container border-2 border-secondary/50 text-xl font-black text-secondary flex items-center justify-center active:scale-90">⬇️</button>
        <button data-dpad="right" class="h-12 rounded-xl bg-surface-container border-2 border-secondary/50 text-xl font-black text-secondary flex items-center justify-center active:scale-90">➡️</button>
      </div>
      <div></div>
    `;

    controls.querySelectorAll('button[data-dpad]').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dir = btn.getAttribute('data-dpad');
        if (this.gameInstance && typeof this.gameInstance.tryMove === 'function') {
          if (dir === 'up') this.gameInstance.tryMove(0, -1);
          if (dir === 'down') this.gameInstance.tryMove(0, 1);
          if (dir === 'left') this.gameInstance.tryMove(-1, 0);
          if (dir === 'right') this.gameInstance.tryMove(1, 0);
        }
      });
    });
  }

  handleResize() {
    if (!this.canvasEl || !this.modalEl) return;
    const viewport = this.modalEl.querySelector('#arcade-viewport');
    if (!viewport) return;

    const hasBottomTouchBar = (this.gameId === 'starlight_runner' || this.gameId === 'maze_explorer');
    const bottomReserve = hasBottomTouchBar ? 64 : 24;

    const availableW = viewport.clientWidth - 24;
    const availableH = viewport.clientHeight - bottomReserve;

    // Standard aspect ratio: 16:10 or 3:2
    let w = Math.min(availableW, 680);
    let h = Math.min(availableH, Math.floor(w * 0.62));
    if (h > availableH) {
      h = availableH;
      w = Math.floor(h / 0.62);
    }

    this.canvasEl.width = Math.max(320, w);
    this.canvasEl.height = Math.max(240, h);

    if (this.gameInstance) {
      if (typeof this.gameInstance.resize === 'function') {
        this.gameInstance.resize(this.canvasEl.width, this.canvasEl.height);
      } else {
        this.gameInstance.width = this.canvasEl.width;
        this.gameInstance.height = this.canvasEl.height;
      }
    }
  }

  handleGameOver(finalScore, stats = {}) {
    this.isGameOver = true;

    // Record score & award Hero Coins + Pet Sparks via store
    const result = store.recordArcadeResult ? store.recordArcadeResult(this.gameId, finalScore, {
      cleared: Boolean(stats.won || stats.cleared)
    }) : { coinsWon: 10, sparksWon: 5, isNewHighScore: false, highScores: [finalScore] };

    this.lastRewardResult = result;

    try {
      confetti({
        particleCount: result.isNewHighScore ? 120 : 70,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#10b981', '#00d2d3', '#f59e0b', '#ffb961', '#ffffff']
      });
    } catch (e) {}

    this.renderGameOverOverlay(finalScore, result, stats);
  }

  renderGameOverOverlay(finalScore, result, stats) {
    const overlay = this.modalEl.querySelector('#arcade-gameover-overlay');
    if (!overlay) return;

    if (result.locked) {
      overlay.innerHTML = `
        <div class="w-full max-w-sm bg-[#0d2235] border-3 border-amber-500/50 rounded-3xl p-5 sm:p-6 text-center flex flex-col items-center gap-3 card-shadow animate-bounce-slow">
          <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center text-3xl">
            🌙
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-wider text-amber-400">
              BEDTIME CURFEW ACTIVE
            </span>
            <h2 class="font-headline text-2xl font-black text-inverse-surface mt-0.5">
              Round Saved! Score: ${finalScore}
            </h2>
          </div>
          <p class="text-xs font-bold text-inverse-surface leading-relaxed px-2 bg-surface-container p-3 rounded-xl border border-secondary/30">
            ${escapeHtml(result.lockMessage || 'Rex says: Time to get cozy for sleep! 🦖🌙')}
          </p>
          <button id="arcade-finish-exit-btn" class="w-full bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-xl chunky-btn shadow-chunky-sm active:scale-95 mt-2">
            BACK TO HUB 🌙
          </button>
        </div>
      `;
      overlay.classList.remove('hidden');
      const finishExitBtn = overlay.querySelector('#arcade-finish-exit-btn');
      if (finishExitBtn) {
        finishExitBtn.addEventListener('click', () => {
          this.close();
        });
      }
      return;
    }

    const topScores = result.highScores || [];
    const coinsWon = result.coinsWon || 0;
    const sparksWon = result.sparksWon || 0;
    const isNewHigh = result.isNewHighScore;

    overlay.innerHTML = `
      <div class="w-full max-w-sm bg-[#0d2235] border-3 ${isNewHigh ? 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.5)]' : 'border-secondary/50'} rounded-3xl p-5 sm:p-6 text-center flex flex-col items-center gap-3 card-shadow animate-bounce-slow">
        
        <div class="w-16 h-16 rounded-2xl ${isNewHigh ? 'bg-amber-500/20 border-2 border-amber-400 text-amber-300' : 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300'} flex items-center justify-center text-3xl">
          ${isNewHigh ? '🏆' : '🎉'}
        </div>

        <div class="flex flex-col">
          <span class="text-[10px] font-black uppercase tracking-wider ${isNewHigh ? 'text-amber-400' : 'text-emerald-400'}">
            ${isNewHigh ? 'NEW HIGH SCORE!' : 'ROUND COMPLETE!'}
          </span>
          <h2 class="font-headline text-2xl font-black text-inverse-surface mt-0.5">
            Score: ${finalScore}
          </h2>
        </div>

        <!-- Reward Breakdown -->
        <div class="w-full grid grid-cols-2 gap-2.5 my-1">
          <div class="bg-surface-container p-2.5 rounded-xl border border-secondary/30 flex flex-col items-center">
            <span class="text-xl">🪙</span>
            <span class="font-headline text-sm font-black text-secondary">+${coinsWon} Coins</span>
            <span class="text-[9px] text-on-surface-variant">${result.coinsCapped ? 'Daily Cap Reached (50🪙/day)' : 'Hero Tokens'}</span>
          </div>

          <div class="bg-surface-container p-2.5 rounded-xl border border-amber-500/30 flex flex-col items-center">
            <span class="text-xl">⚡</span>
            <span class="font-headline text-sm font-black text-amber-400">+${sparksWon} Sparks</span>
            <span class="text-[9px] text-amber-300/80">Pet Training XP</span>
          </div>
        </div>

        <!-- Top 3 High Scores -->
        <div class="w-full bg-surface-container-high/80 rounded-xl p-2.5 border border-surface-container-highest text-left">
          <span class="text-[10px] font-black uppercase text-on-surface-variant block mb-1">Top High Scores</span>
          <div class="flex items-center justify-around text-xs font-black">
            <span>🥇 ${topScores[0] || finalScore}</span>
            <span>🥈 ${topScores[1] || '-'}</span>
            <span>🥉 ${topScores[2] || '-'}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex flex-col gap-2 mt-1">
          <button id="arcade-play-again-btn" class="w-full bg-primary text-on-primary font-headline text-xs font-black py-3 rounded-xl chunky-btn shadow-chunky-sm active:scale-95">
            PLAY AGAIN 🔄
          </button>
          <button id="arcade-finish-exit-btn" class="w-full bg-surface-container text-on-surface font-headline text-xs font-black py-2.5 rounded-xl border border-surface-container-highest chunky-btn-sm active:scale-95">
            BACK TO ARCADE 🌟
          </button>
        </div>

      </div>
    `;

    overlay.classList.remove('hidden');

    const playAgainBtn = overlay.querySelector('#arcade-play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        this.isGameOver = false;
        if (this.gameInstance) this.gameInstance.restart();
      });
    }

    const finishExitBtn = overlay.querySelector('#arcade-finish-exit-btn');
    if (finishExitBtn) {
      finishExitBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }
}
