import { store } from '../state/store.js';
import { ADVENTURE_GAMES, getGameChallenges } from '../data/learningGamesData.js';
import { Sound } from '../audio/sfx.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import confetti from 'canvas-confetti';

let activeGame = null;
let currentChallengeIdx = 0;

export function renderQuestMapView() {
  const state = store.getState();
  const activePet = store.getActivePet();
  const hero = state.selectedHero;
  const kidDifficulty = hero.gameDifficulty || 'medium';

  // If a mini-game stop is actively being played
  if (activeGame) {
    const challenges = getGameChallenges(activeGame, kidDifficulty);
    const challenge = challenges[currentChallengeIdx] || challenges[0];
    const isEasyMode = kidDifficulty === 'easy';

    return `
      <div class="max-w-2xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-5 animate-fade-in select-none">
        
        <!-- Game Header -->
        <div class="flex items-center justify-between">
          <button id="map-game-exit-btn" class="bg-surface-container hover:bg-surface-bright text-on-surface-variant font-headline text-xs font-bold px-4 py-2.5 rounded-2xl border-2 border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95">
            <span class="material-symbols-outlined text-base">arrow_back</span> Return to Quest Map
          </button>
          <div class="flex items-center gap-2">
            <span class="text-xs font-black uppercase text-secondary">${activeGame.subject}</span>
            <span class="bg-surface-container-high px-3 py-1 rounded-full text-xs font-bold text-primary border border-primary/30">
              Challenge ${currentChallengeIdx + 1} / ${challenges.length}
            </span>
          </div>
        </div>

        <!-- Easy Mode Voice Guide Banner -->
        ${
          isEasyMode
            ? `
          <div class="bg-secondary/15 border-2 border-secondary/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div class="flex items-center gap-2 text-secondary font-black">
              <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">record_voice_over</span>
              <span>Toddler Easy Voice Guide: Listen and follow along!</span>
            </div>
            <button id="map-voice-replay-btn" class="bg-secondary text-on-secondary font-headline text-[11px] font-black px-3.5 py-1.5 rounded-xl chunky-btn-sm flex items-center gap-1 hover:brightness-110 active:scale-95 shadow">
              <span class="material-symbols-outlined text-sm">volume_up</span> Hear Aloud
            </button>
          </div>
        `
            : ''
        }

        <!-- Mini Game Play Arena Card -->
        <div class="bg-surface-container rounded-4xl p-6 sm:p-8 border-4 border-surface-container-highest card-shadow flex flex-col gap-6 text-center relative overflow-hidden">
          
          <!-- Decorative Glow -->
          <div class="absolute -top-12 -left-12 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-12 -right-12 w-48 h-48 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>

          <!-- Title & Icon -->
          <div class="flex items-center justify-center gap-3">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border-2 border-surface-bright" style="background-color: ${activeGame.color}25; color: ${activeGame.color};">
              <span class="material-symbols-outlined text-3xl" style="font-variation-settings: 'FILL' 1;">${activeGame.icon}</span>
            </div>
            <div class="flex flex-col text-left">
              <div class="flex items-center gap-2">
                <h2 class="font-headline text-xl sm:text-2xl font-black text-inverse-surface">${activeGame.title}</h2>
                <span class="text-[10px] font-black px-2 py-0.5 rounded-md ${isEasyMode ? 'bg-primary/20 text-primary' : kidDifficulty === 'hard' ? 'bg-error/20 text-error' : 'bg-secondary/20 text-secondary'}">
                  ${isEasyMode ? 'Toddler 3-4' : kidDifficulty === 'hard' ? 'Big Kid 7-9' : 'Kids 5-6'}
                </span>
              </div>
              <p class="text-xs text-on-surface-variant font-bold">${activeGame.desc}</p>
            </div>
          </div>

          <!-- Question Box -->
          <div class="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border-3 border-surface-container-highest shadow-inner flex flex-col items-center justify-center min-h-[140px] relative">
            <span class="text-[11px] font-black uppercase text-secondary mb-2 tracking-wider">Question ${currentChallengeIdx + 1}</span>
            <p class="font-headline text-xl sm:text-2xl font-black text-primary leading-snug">
              ${challenge.question}
            </p>
            
            ${
              isEasyMode
                ? `
              <button id="map-speak-question-btn" class="mt-3 bg-secondary/20 hover:bg-secondary/30 text-secondary font-headline text-xs font-black px-3.5 py-1.5 rounded-xl border border-secondary/40 flex items-center gap-1.5 active:scale-95">
                <span class="material-symbols-outlined text-sm">volume_up</span> Read to Me
              </button>
            `
                : ''
            }
          </div>

          <!-- Multiple Choice Options -->
          <div class="grid grid-cols-1 gap-3.5">
            ${challenge.options
              .map((opt, idx) => {
                return `
                <button data-map-opt-idx="${idx}" class="map-game-opt-btn bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-base sm:text-lg font-black py-4 px-6 rounded-2xl border-2 border-surface-container-highest chunky-btn flex items-center justify-between active:scale-98 transition-all hover:border-primary/60">
                  <span>${opt}</span>
                  <div class="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant font-black text-xs border border-surface-container-highest">
                    ${String.fromCharCode(65 + idx)}
                  </div>
                </button>
              `;
              })
              .join('')}
          </div>

          <!-- Companion Mascot Cheer Box -->
          <div class="flex items-center justify-center gap-3 pt-2 border-t border-surface-container-highest text-xs font-bold text-on-surface-variant">
            <img src="${activePet.avatar}" class="w-8 h-8 rounded-full border-2 border-primary object-cover" />
            <span>${activePet.name} is cheering for ${hero.name}! Tap your choice!</span>
          </div>

        </div>

      </div>
    `;
  }

  // Define the 6 map stops mapped directly to the 6 learning games
  const mapStops = [
    {
      stopNumber: 1,
      gameId: 'phonics_forest',
      title: 'Phonics Forest Grove',
      biome: 'Whispering Woods',
      subject: 'Phonics & Reading',
      icon: 'volume_up',
      color: '#2ecc71',
      align: 'start',
      stars: 3,
      yPos: '85%'
    },
    {
      stopNumber: 2,
      gameId: 'counting_castle',
      title: 'Counting Castle Keep',
      biome: 'Golden Ramparts',
      subject: 'Math & Numbers',
      icon: 'calculate',
      color: '#f1c40f',
      align: 'end',
      stars: 3,
      yPos: '70%'
    },
    {
      stopNumber: 3,
      gameId: 'color_cavern',
      title: 'Color Cavern Chasm',
      biome: 'Glowstone Caves',
      subject: 'Colors & Visuals',
      icon: 'palette',
      color: '#3498db',
      align: 'start',
      stars: 3,
      yPos: '55%'
    },
    {
      stopNumber: 4,
      gameId: 'shape_shifter',
      title: 'Shape Shifter Ruins',
      biome: 'Totem Highlands',
      subject: 'Geometry & Shapes',
      icon: 'category',
      color: '#e89300',
      align: 'end',
      stars: 2,
      yPos: '40%'
    },
    {
      stopNumber: 5,
      gameId: 'memory_meadow',
      title: 'Memory Meadow Bloom',
      biome: 'Emerald Hills',
      subject: 'Focus & Memory',
      icon: 'psychology',
      color: '#00d67d',
      align: 'start',
      stars: 2,
      yPos: '25%'
    },
    {
      stopNumber: 6,
      gameId: 'word_wizard',
      title: 'Word Wizard Citadel',
      biome: 'Sky Spire',
      subject: 'Vocabulary & Words',
      icon: 'spellcheck',
      color: '#ffb961',
      align: 'end',
      stars: 1,
      yPos: '12%'
    }
  ];

  return `
    <div class="max-w-4xl mx-auto px-4 pt-4 pb-32 flex flex-col gap-6 animate-fade-in select-none">
      
      <!-- Top Title Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">explore</span>
              Hero Quest Map
            </h1>
            <span class="text-xs font-black uppercase px-2.5 py-1 rounded-full border ${kidDifficulty === 'easy' ? 'bg-primary/20 text-primary border-primary/40' : kidDifficulty === 'hard' ? 'bg-error/20 text-error border-error/40' : 'bg-secondary/20 text-secondary border-secondary/40'}">
              Level: ${kidDifficulty === 'easy' ? 'Easy (Toddler 3-4)' : kidDifficulty === 'hard' ? 'Hard (Kids 7-9)' : 'Medium (Kids 5-6)'}
            </span>
          </div>
          <p class="text-xs font-bold text-on-surface-variant">Conquer all 6 Pet Adventure stops along the realm road to defeat the Sugar Boss!</p>
        </div>

        <div class="flex items-center gap-3 self-end sm:self-auto">
          <!-- Active Companion Pet Vitals -->
          <div class="bg-surface-container-high px-4 py-2 rounded-2xl border-2 border-secondary-container flex items-center gap-2.5 card-shadow">
            <img src="${activePet.avatar}" class="w-8 h-8 rounded-full border-2 border-primary object-cover" />
            <div class="flex flex-col">
              <span class="text-[9px] font-black uppercase text-on-surface-variant">${activePet.name}</span>
              <span class="font-headline text-xs font-black text-secondary flex items-center gap-1">
                <span class="material-symbols-outlined text-xs" style="font-variation-settings: 'FILL' 1;">bolt</span>
                ${activePet.energy}% Energy
              </span>
            </div>
          </div>

          <!-- Total Quest Stars Counter -->
          <div class="bg-surface-container-high px-4 py-2 rounded-2xl border-2 border-surface-container-highest flex items-center gap-2 card-shadow">
            <span class="material-symbols-outlined text-secondary text-xl" style="font-variation-settings: 'FILL' 1;">stars</span>
            <div class="flex flex-col">
              <span class="text-[9px] font-black uppercase text-on-surface-variant">Realm Stars</span>
              <span class="font-headline text-xs font-black text-secondary">14 / 18 ★</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN QUEST MAP CANVAS CONTAINER WITH DETAILED BACKGROUND ILLUSTRATION -->
      <div class="relative bg-[#06121d] rounded-4xl p-6 sm:p-10 border-4 border-surface-container-highest shadow-[0_16px_0_0_#030910] min-h-[920px] overflow-hidden flex flex-col justify-between">
        
        <!-- DETAILED ADVENTURE REALM VECTOR BACKGROUND GRAPHIC -->
        <div class="absolute inset-0 pointer-events-none z-0">
          <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 800 1200">
            <defs>
              <linearGradient id="mapSkyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#050e17" />
                <stop offset="30%" stop-color="#0c2333" />
                <stop offset="70%" stop-color="#081824" />
                <stop offset="100%" stop-color="#040c13" />
              </linearGradient>

              <!-- Forest Biome Pattern -->
              <radialGradient id="forestGlow" cx="20%" cy="85%" r="35%">
                <stop offset="0%" stop-color="#2ecc71" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#2ecc71" stop-opacity="0" />
              </radialGradient>

              <!-- Castle Biome Glow -->
              <radialGradient id="castleGlow" cx="80%" cy="70%" r="35%">
                <stop offset="0%" stop-color="#f1c40f" stop-opacity="0.2" />
                <stop offset="100%" stop-color="#f1c40f" stop-opacity="0" />
              </radialGradient>

              <!-- Cavern Glow -->
              <radialGradient id="cavernGlow" cx="25%" cy="55%" r="35%">
                <stop offset="0%" stop-color="#3498db" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#3498db" stop-opacity="0" />
              </radialGradient>

              <!-- Highlands Glow -->
              <radialGradient id="highlandGlow" cx="75%" cy="40%" r="35%">
                <stop offset="0%" stop-color="#e89300" stop-opacity="0.2" />
                <stop offset="100%" stop-color="#e89300" stop-opacity="0" />
              </radialGradient>

              <!-- Spire Glow -->
              <radialGradient id="spireGlow" cx="80%" cy="12%" r="35%">
                <stop offset="0%" stop-color="#ffb961" stop-opacity="0.2" />
                <stop offset="100%" stop-color="#ffb961" stop-opacity="0" />
              </radialGradient>

              <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.9" />
              </filter>
            </defs>

            <!-- Sky Background Base -->
            <rect width="800" height="1200" fill="url(#mapSkyGrad)" />

            <!-- Biome Atmosphere Ambient Lighting -->
            <rect width="800" height="1200" fill="url(#forestGlow)" />
            <rect width="800" height="1200" fill="url(#castleGlow)" />
            <rect width="800" height="1200" fill="url(#cavernGlow)" />
            <rect width="800" height="1200" fill="url(#highlandGlow)" />
            <rect width="800" height="1200" fill="url(#spireGlow)" />

            <!-- Winding Cobblestone Road Trail Through All 6 Stops -->
            <path d="M 180 1020 C 350 980, 520 920, 600 840 C 690 750, 480 680, 220 650 C 90 630, 160 520, 320 480 C 500 440, 680 410, 620 330 C 560 250, 380 260, 220 220 C 140 200, 280 110, 400 60"
                  fill="none" stroke="#0b1e2c" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" />
            
            <path d="M 180 1020 C 350 980, 520 920, 600 840 C 690 750, 480 680, 220 650 C 90 630, 160 520, 320 480 C 500 440, 680 410, 620 330 C 560 250, 380 260, 220 220 C 140 200, 280 110, 400 60"
                  fill="none" stroke="#1c3b52" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" filter="url(#roadShadow)" />

            <path d="M 180 1020 C 350 980, 520 920, 600 840 C 690 750, 480 680, 220 650 C 90 630, 160 520, 320 480 C 500 440, 680 410, 620 330 C 560 250, 380 260, 220 220 C 140 200, 280 110, 400 60"
                  fill="none" stroke="#54e98a" stroke-width="6" stroke-linecap="round" stroke-dasharray="14 16" opacity="0.85" />

            <!-- Stop 1 Biome: Pine Trees & Ancient Grove -->
            <g fill="#1b4332" opacity="0.8">
              <polygon points="100,1050 120,1010 140,1050" />
              <polygon points="130,1060 150,1020 170,1060" />
              <polygon points="70,1040 90,1000 110,1040" />
              <polygon points="260,980 280,940 300,980" />
              <polygon points="280,990 300,950 320,990" />
            </g>

            <!-- Stop 2 Biome: Castle Ramparts & Stone Bridges -->
            <g fill="#4a3b00" opacity="0.75">
              <rect x="660" y="800" width="30" height="50" rx="4" />
              <polygon points="655,800 675,770 695,800" />
              <rect x="710" y="810" width="30" height="40" rx="4" />
              <polygon points="705,810 725,780 745,810" />
            </g>

            <!-- Stop 3 Biome: Glowing Crystals & Cave Rocks -->
            <g fill="#004b73" opacity="0.75">
              <polygon points="100,600 115,560 130,600" />
              <polygon points="120,610 135,550 150,610" />
              <polygon points="80,590 90,560 100,590" />
            </g>

            <!-- Stop 4 Biome: Ancient Totem Pillars -->
            <g fill="#5c3a00" opacity="0.75">
              <rect x="680" y="440" width="18" height="45" rx="3" />
              <rect x="710" y="430" width="22" height="55" rx="3" />
            </g>

            <!-- Stop 5 Biome: Emerald Rolling Hills -->
            <path d="M 40 340 Q 140 300 240 340 T 440 340" fill="none" stroke="#00522e" stroke-width="12" opacity="0.6" />

            <!-- Summit: Sugar Boss Fortress Turrets at Top -->
            <g fill="#5c1d24" opacity="0.85">
              <rect x="360" y="20" width="80" height="60" rx="8" />
              <polygon points="350,20 400,-10 450,20" />
              <polygon points="340,30 360,0 380,30" />
              <polygon points="420,30 440,0 460,30" />
            </g>
          </svg>
        </div>

        <!-- LOCATION BUTTONS PLACED DIRECTLY ALONG THE QUEST MAP PATH -->
        <div class="relative z-10 flex flex-col gap-10 sm:gap-14 py-4">

          <!-- TOP SUMMIT STOP: Sugar Boss Fortress / AR Toothbrush Battle -->
          <div class="flex justify-center">
            <button id="map-sugar-boss-btn" class="bg-error text-on-error rounded-3xl p-4 sm:p-5 border-4 border-error-container shadow-[0_8px_0_0_#4a0008] flex items-center gap-3.5 active:scale-95 animate-pulse-glow hover:brightness-110">
              <div class="w-12 h-12 rounded-2xl bg-error-container/30 flex items-center justify-center text-3xl font-black">
                <span class="material-symbols-outlined text-3xl">skull</span>
              </div>
              <div class="flex flex-col text-left">
                <span class="text-[10px] font-black uppercase text-error-container">Final Summit Boss</span>
                <span class="font-headline text-base sm:text-lg font-black text-white">Sugar Fortress AR Battle</span>
                <span class="text-[11px] font-bold text-white/80">Daily 2-Min Toothbrushing Showdown</span>
              </div>
              <span class="material-symbols-outlined text-2xl font-black text-white ml-2">swords</span>
            </button>
          </div>

          <!-- THE 6 PET ADVENTURE MINI GAME STOPS -->
          ${mapStops
            .slice()
            .reverse()
            .map((stop) => {
              const game = ADVENTURE_GAMES.find((g) => g.id === stop.gameId);
              const isLeft = stop.align === 'start';

              return `
              <div class="flex ${isLeft ? 'justify-start pl-2 sm:pl-8' : 'justify-end pr-2 sm:pr-8'}">
                
                <button data-map-game-id="${stop.gameId}" class="map-game-stop-btn group bg-surface-container/95 hover:bg-surface-container-high rounded-3xl p-4 sm:p-5 border-3 card-shadow flex items-center gap-4 active:scale-95 transition-all text-left max-w-sm sm:max-w-md w-full" style="border-color: ${stop.color}80; box-shadow: 0 8px 0 0 ${stop.color}40;">
                  
                  <!-- Stop Number Badge & Game Icon -->
                  <div class="relative flex-shrink-0">
                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner border-2 border-surface-bright transition-transform group-hover:scale-105" style="background-color: ${stop.color}25; color: ${stop.color};">
                      <span class="material-symbols-outlined text-3xl sm:text-4xl" style="font-variation-settings: 'FILL' 1;">${stop.icon}</span>
                    </div>
                    <span class="absolute -top-2 -left-2 bg-secondary text-on-secondary font-headline text-[10px] font-black px-2 py-0.5 rounded-full border border-secondary-container shadow">
                      Stop ${stop.stopNumber}
                    </span>
                  </div>

                  <!-- Stop Details -->
                  <div class="flex flex-col flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-[10px] font-black uppercase text-secondary truncate">${stop.subject}</span>
                      <div class="flex text-secondary text-xs">
                        ${'★'.repeat(stop.stars)}${'☆'.repeat(3 - stop.stars)}
                      </div>
                    </div>

                    <h3 class="font-headline text-base sm:text-lg font-black text-inverse-surface truncate group-hover:text-primary transition-colors">
                      ${stop.title}
                    </h3>
                    
                    <p class="text-[11px] text-on-surface-variant font-medium line-clamp-1">
                      ${stop.biome} • ${game?.desc || ''}
                    </p>

                    <!-- Payout & Energy Cost Tag -->
                    <div class="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-surface-container-highest/60 text-[11px] font-black">
                      <span class="text-secondary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-xs">bolt</span> ${game?.energyCost || 15} Energy
                      </span>
                      <span class="text-primary flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-xs">monetization_on</span> +${game?.rewardCoins || 25} Tokens
                      </span>
                    </div>
                  </div>

                  <div class="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors border border-primary/40">
                    <span class="material-symbols-outlined text-xl">play_arrow</span>
                  </div>

                </button>

              </div>
            `;
            })
            .join('')}

        </div>

        <!-- Map Bottom Starting Camp -->
        <div class="relative z-10 bg-surface-container/90 rounded-3xl p-4 border-2 border-surface-container-highest flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center text-xl shadow">
              <span class="material-symbols-outlined">flag</span>
            </div>
            <div class="flex flex-col">
              <span class="font-headline font-black text-inverse-surface">Adventure Trailhead (Stop 1 - 6)</span>
              <span class="text-on-surface-variant font-bold">Adjusted for ${hero.name}'s level: ${kidDifficulty === 'easy' ? 'Easy Toddler (Audio Guided)' : kidDifficulty === 'hard' ? 'Hard Level (Ages 7-9)' : 'Medium Level (Ages 5-6)'}</span>
            </div>
          </div>
          <button id="map-to-pet-pen-btn" class="bg-surface-container-high hover:bg-surface-bright text-inverse-surface font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-surface-container-highest flex items-center gap-1.5 chunky-btn-sm active:scale-95 self-end sm:self-auto">
            <span class="material-symbols-outlined text-sm">pets</span> Visit Pet Pen
          </button>
        </div>

      </div>

    </div>
  `;
}

export function attachQuestMapListeners() {
  const exitBtn = document.getElementById('map-game-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      voicePrompts.stop();
      activeGame = null;
      currentChallengeIdx = 0;
      store.notify();
    });
  }

  const toPenBtn = document.getElementById('map-to-pet-pen-btn');
  if (toPenBtn) {
    toPenBtn.addEventListener('click', () => {
      store.navigate('pet_pen');
    });
  }

  const sugarBossBtn = document.getElementById('map-sugar-boss-btn');
  if (sugarBossBtn) {
    sugarBossBtn.addEventListener('click', () => {
      Sound.click();
      store.navigate('ar_battle');
    });
  }

  // Voice replay buttons in easy mode (both the banner button and the question card button)
  const replayVoiceBtns = [
    document.getElementById('map-voice-replay-btn'),
    document.getElementById('map-speak-question-btn')
  ].filter(Boolean);

  replayVoiceBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!activeGame) return;
      Sound.chirp();
      const kidDiff = store.getState().selectedHero.gameDifficulty || 'medium';
      const challenges = getGameChallenges(activeGame, kidDiff);
      const challenge = challenges[currentChallengeIdx] || challenges[0];
      voicePrompts.speakGuidance(activeGame.title, challenge.question);
    });
  });

  // Open any of the 6 mini games directly from the Quest Map stops
  document.querySelectorAll('.map-game-stop-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.getAttribute('data-map-game-id');
      const game = ADVENTURE_GAMES.find((g) => g.id === gId);
      if (game) {
        const activePet = store.getActivePet();
        if (activePet.energy < game.energyCost) {
          Sound.hit();
          store.showReward(
            'Pet Needs Energy!',
            `Your companion needs ${game.energyCost}% energy to adventure! Feed snacks in the Pet Pen or let them rest!`,
            0,
            0,
            activePet.avatar,
            'battery_low'
          );
          return;
        }

        activeGame = game;
        currentChallengeIdx = 0;
        Sound.click();
        store.notify();

        // If toddler easy mode is active, trigger realistic spoken voice guidance
        const kidDiff = store.getState().selectedHero.gameDifficulty || 'medium';
        if (kidDiff === 'easy') {
          const challenges = getGameChallenges(game, 'easy');
          const challenge = challenges[0];
          setTimeout(() => {
            voicePrompts.speakGuidance(game.title, challenge.question);
          }, 300);
        }
      }
    });
  });

  // Multiple choice answer selection inside the mini game arena
  document.querySelectorAll('.map-game-opt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosenIdx = parseInt(btn.getAttribute('data-map-opt-idx'));
      const kidDiff = store.getState().selectedHero.gameDifficulty || 'medium';
      const challenges = getGameChallenges(activeGame, kidDiff);
      const challenge = challenges[currentChallengeIdx] || challenges[0];

      if (chosenIdx === challenge.answer) {
        Sound.fanfare();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

        if (kidDiff === 'easy') {
          voicePrompts.speakSuccess();
        }

        if (currentChallengeIdx + 1 < challenges.length) {
          currentChallengeIdx++;
          store.notify();

          // Read the next question in easy mode
          if (kidDiff === 'easy') {
            const nextChallenge = challenges[currentChallengeIdx];
            setTimeout(() => {
              voicePrompts.speakGuidance(activeGame.title, nextChallenge.question);
            }, 500);
          }
        } else {
          // Finished all questions for this realm stop!
          const g = activeGame;
          activeGame = null;
          currentChallengeIdx = 0;
          store.playAdventureGame(g.id, true);
        }
      } else {
        Sound.hit();
        if (kidDiff === 'easy') {
          voicePrompts.speakTryAgain();
        }
        btn.classList.add('border-error', 'text-error');
        setTimeout(() => btn.classList.remove('border-error', 'text-error'), 450);
      }
    });
  });
}
