import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';

export function renderRewardModal() {
  const state = store.getState();
  const reward = state.rewardModal;
  if (!reward) return '';

  const isEscaped = reward.title?.includes('Escaped');
  const isDeclined = reward.title?.includes('Declined') || reward.title?.includes('Rejected');
  const isNegative = isEscaped || isDeclined;

  const titleColor = isEscaped ? 'text-secondary' : isDeclined ? 'text-error' : 'text-primary';
  const cardBorder = isEscaped ? 'border-secondary/60 shadow-[0_0_30px_rgba(241,196,15,0.3)]' : isDeclined ? 'border-error/50 shadow-[0_0_30px_rgba(255,84,73,0.3)]' : 'border-primary/50 shadow-[0_0_30px_rgba(84,233,138,0.35)]';
  const circleBorder = isEscaped ? 'border-secondary/50' : isDeclined ? 'border-error/40' : 'border-primary/30';
  const btnClass = isEscaped 
    ? 'bg-secondary text-on-secondary border-secondary-container shadow-chunky-md' 
    : isDeclined 
    ? 'bg-surface-container-highest text-on-surface-variant border-surface-container' 
    : 'bg-primary text-on-primary border-primary-container shadow-chunky-md';
  const btnText = isEscaped ? 'TRY AGAIN NEXT TIME!' : isDeclined ? 'OK, GOT IT' : 'AWESOME!';

  let centerGraphicHtml = '';
  if (reward.image) {
    const isSvgDataUrl = reward.image.startsWith('data:image/svg+xml');
    if (isSvgDataUrl) {
      centerGraphicHtml = `
        <img alt="${reward.title}" class="w-28 h-28 sm:w-32 sm:h-32 object-contain relative z-10 drop-shadow-2xl animate-pulse" src="${reward.image}" />
      `;
    } else {
      // Full illustration/photo (e.g. Sugar villain running away or high-res pet avatar)
      centerGraphicHtml = `
        <img alt="${reward.title}" class="w-full h-full object-cover rounded-full relative z-10 drop-shadow-2xl transform scale-105" src="${reward.image}" />
      `;
    }
  } else if (reward.icon) {
    centerGraphicHtml = `
      <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-surface-container-high border-2 border-primary/40 flex items-center justify-center text-primary relative z-10 shadow-lg">
        <span class="material-symbols-outlined text-5xl sm:text-6xl">${reward.icon}</span>
      </div>
    `;
  } else {
    centerGraphicHtml = `
      <img alt="Reward Sticker" class="w-28 h-28 sm:w-32 sm:h-32 object-contain relative z-10 drop-shadow-2xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRc98XgkYDVOMyeI8_DdTn3brkamdypKZHAOHiWsvdNuYooda2iad8wDRiiTg9NR7rD8mcxuoBFBUSLVrLtnLcoaHCbw6GFUY2IfxfuNNEN9DPOp4_YImncAcHdrg87C8_VAKhcU1QWSn2sjlLyzlzjCEfIZxtp8wUJW0A31Lq1dR2UtL-5WrB4Kv37wm8UqStqA4r7vMt9-HC2m0J2DnH2ho2MRAB876n6T2djlx3G7-pBq9V44VbVg" />
    `;
  }

  return `
    <div id="reward-modal-backdrop" class="fixed inset-0 bg-[#09141e]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      
      <!-- Modal Overlay Card -->
      <div class="relative z-10 w-full max-w-md bg-surface-container-high rounded-4xl p-6 flex flex-col items-center justify-center shadow-[0_12px_0_0_#050f18] border-3 ${cardBorder} text-center animate-scale-up overflow-hidden">
        
        <!-- Decorative Glow Burst -->
        <div class="absolute inset-0 bg-radial ${isEscaped ? 'from-secondary/20' : 'from-primary/20'} via-transparent to-transparent pointer-events-none"></div>

        <!-- Headline -->
        <h1 class="font-headline text-2xl sm:text-3xl font-black ${titleColor} mb-3 text-center uppercase tracking-wide drop-shadow-md">
          ${reward.title}
        </h1>

        <!-- 3D Item Graphic Area (Dynamic) -->
        <div class="relative w-36 h-36 sm:w-40 sm:h-40 mb-4 animate-float rounded-full bg-surface-container flex items-center justify-center border-4 ${circleBorder} overflow-hidden p-1 shadow-2xl">
          ${centerGraphicHtml}
        </div>

        <!-- Message Body -->
        <p class="font-body text-xs sm:text-sm font-bold text-on-surface-variant mb-4 px-2 leading-relaxed whitespace-pre-line">
          ${reward.message}
        </p>

        <!-- Reward Value / Habit Coins / XP Pill -->
        ${
          reward.coins > 0 || reward.xp > 0
            ? `
          <div class="bg-surface-container-lowest rounded-full px-5 py-2 flex items-center justify-center gap-4 mb-5 border-2 border-secondary-container/50 shadow-inner">
            ${
              reward.coins > 0
                ? `
              <div class="flex items-center gap-1.5 text-secondary font-headline text-base font-black">
                <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">monetization_on</span>
                +${reward.coins} Tokens
              </div>
            `
                : ''
            }
            ${
              reward.xp > 0
                ? `
              <div class="flex items-center gap-1.5 text-primary font-headline text-base font-black">
                <span class="material-symbols-outlined text-lg">bolt</span>
                +${reward.xp} XP
              </div>
            `
                : ''
            }
          </div>
        `
            : ''
        }

        <!-- Action Button -->
        <button id="reward-modal-cool-btn" class="w-full ${btnClass} font-headline text-base font-black rounded-2xl py-3.5 chunky-btn uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
          ${btnText}
        </button>

      </div>
    </div>
  `;
}

export function attachRewardModalListeners() {
  const coolBtn = document.getElementById('reward-modal-cool-btn');
  if (coolBtn) {
    coolBtn.addEventListener('click', () => {
      Sound.click();
      store.closeReward();
    });
  }

  const backdrop = document.getElementById('reward-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        store.closeReward();
      }
    });
  }
}
