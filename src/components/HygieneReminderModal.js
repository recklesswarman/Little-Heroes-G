import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';
import confetti from 'canvas-confetti';

const REMINDER_COPY = {
  floss: {
    badge: 'Floss Reminder',
    icon: 'health_and_safety',
    title: 'Floss Time First! 🦷',
    message: 'Before you start the Toothbrush Battle, ask a grown-up to help you floss between your teeth!',
    cta: 'Okay, I Flossed!',
    voice: "Don't forget to floss between your teeth before we brush! Ask a grown-up to help!"
  },
  mouthwash: {
    badge: 'Mouthwash Reminder',
    icon: 'water_drop',
    title: 'Great Brushing! Now Rinse! 💧',
    message: 'Ask a grown-up for your mouthwash and swish for a fresh, minty finish!',
    cta: 'Okay, I Rinsed!',
    voice: 'Awesome brushing, hero! Now swish some mouthwash for a super fresh smile!'
  }
};

let hasSpoken = false;

export function renderHygieneReminderModal() {
  const active = store.getState().activeHygieneReminder;
  if (!active || !REMINDER_COPY[active.type]) {
    hasSpoken = false;
    return '';
  }

  const isFloss = active.type === 'floss';
  const copy = REMINDER_COPY[active.type];

  if (!hasSpoken) {
    hasSpoken = true;
    setTimeout(() => speakRex(copy.voice), 200);
  }

  return `
    <div id="hygiene-reminder-backdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl animate-fade-in select-none overflow-hidden">

      <div class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div class="w-[500px] h-[500px] rounded-full ${isFloss ? 'bg-primary/20' : 'bg-secondary/20'} blur-3xl animate-pulse pointer-events-none"></div>
      </div>

      <div class="relative z-20 w-full max-w-md bg-surface-container rounded-3xl p-6 sm:p-8 border-4 ${isFloss ? 'border-primary' : 'border-secondary'} shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col items-center text-center gap-5">

        <span class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
          isFloss ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-secondary/20 text-secondary border border-secondary/40'
        }">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">${copy.icon}</span>
          ${copy.badge}
        </span>

        <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 flex items-center justify-center shadow-xl animate-bounce ${
          isFloss ? 'bg-primary/15 border-primary/50' : 'bg-secondary/15 border-secondary/50'
        }">
          <span class="material-symbols-outlined text-6xl ${isFloss ? 'text-primary' : 'text-secondary'}" style="font-variation-settings: 'FILL' 1;">${copy.icon}</span>
        </div>

        <div class="flex flex-col items-center gap-1.5">
          <h2 class="font-headline text-2xl sm:text-3xl font-black text-inverse-surface text-shadow">${copy.title}</h2>
          <p class="text-xs sm:text-sm font-bold text-on-surface-variant max-w-xs">${copy.message}</p>
        </div>

        <button id="hygiene-reminder-ack-btn" class="w-full py-4 rounded-2xl font-headline text-base sm:text-lg font-black hover:brightness-110 chunky-btn shadow-chunky flex items-center justify-center gap-2 active:scale-95 transition-all ${
          isFloss ? 'text-on-primary bg-primary' : 'text-on-secondary bg-secondary'
        }">
          <span class="material-symbols-outlined text-2xl">check_circle</span>
          ${copy.cta}
        </button>

      </div>
    </div>
  `;
}

export function attachHygieneReminderModalListeners() {
  const backdrop = document.getElementById('hygiene-reminder-backdrop');
  if (!backdrop) return;

  const ackBtn = document.getElementById('hygiene-reminder-ack-btn');
  if (ackBtn) {
    ackBtn.addEventListener('click', () => {
      Sound.sparkle();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      store.acknowledgeActiveHygieneReminder();
    });
  }
}
