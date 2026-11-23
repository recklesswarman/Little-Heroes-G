// Letter Sounds (Pre-K): 26 big letter cards. Tap one and Rex says the letter, its sound and a
// word that starts with it ("M. M says mmm, like moon."). "Quiz me" opens Rex's Word Wall,
// whose easy level asks the same letter sounds. Data: shared/phonics.js (works offline).
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { speakCompanion } from '../services/voiceService.js';
import { Sound } from '../audio/sfx.js';
import { LETTER_SOUNDS, letterSpeech } from '../../shared/phonics.js';

const COLORS = ['#ff7eb6', '#ffd166', '#06d6a0', '#4cc9f0', '#a78bfa', '#f4a261'];
let selected = null;

export function renderLetterSoundsView() {
  const hero = store.getState().selectedHero || {};
  const card = LETTER_SOUNDS.find((c) => c.letter === selected) || null;
  return `
    <div class="p-4 sm:p-6 flex flex-col gap-4" data-letter-sounds>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="font-headline text-2xl sm:text-3xl font-black text-white">🔤 Letter Sounds</h1>
          <p class="text-sm font-bold text-slate-300">Tap a letter, ${escapeHtml(hero.name || 'hero')}! Rex will say its sound.</p>
        </div>
        <button type="button" data-letters-quiz class="px-4 py-2.5 rounded-xl bg-linear-to-r from-[#a78bfa] to-[#ff7eb6] text-slate-950 font-headline font-black text-sm shrink-0 active:scale-95">Quiz me! 🦖</button>
      </div>
      ${card ? `
      <div class="rounded-3xl bg-slate-900/80 border-2 border-amber-300/60 p-5 flex items-center gap-5" data-letter-focus="${card.letter}">
        <div class="kid-read text-7xl sm:text-8xl font-black text-white leading-none">${card.letter}${card.letter.toLowerCase()}</div>
        <div class="flex flex-col gap-1">
          <div class="text-5xl">${card.emoji}</div>
          <div class="kid-read text-2xl font-black text-amber-200">${escapeHtml(card.word)}</div>
          <div class="text-lg font-bold text-slate-300">${card.letter} says <span class="kid-read text-white">${escapeHtml(card.say)}</span></div>
        </div>
      </div>` : ''}
      <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-2.5">
        ${LETTER_SOUNDS.map((c, i) => `
        <button type="button" data-letter="${c.letter}" aria-label="Letter ${c.letter}, ${escapeHtml(c.word)}"
          class="kid-read min-h-[84px] rounded-2xl border-3 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform ${c.letter === selected ? 'ring-4 ring-white' : ''}"
          style="background:${COLORS[i % COLORS.length]}22;border-color:${COLORS[i % COLORS.length]}">
          <span class="text-4xl font-black text-white leading-none">${c.letter}<span class="text-3xl">${c.letter.toLowerCase()}</span></span>
          <span class="text-xl" aria-hidden="true">${c.emoji}</span>
        </button>`).join('')}
      </div>
    </div>`;
}

export function attachLetterSoundsListeners() {
  document.querySelectorAll('[data-letter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = LETTER_SOUNDS.find((c) => c.letter === btn.getAttribute('data-letter'));
      if (!card) return;
      Sound.click?.();
      selected = card.letter;
      speakCompanion(letterSpeech(card), { petId: 'rex' });
      store.notify();
    });
  });
  document.querySelector('[data-letters-quiz]')?.addEventListener('click', () => {
    Sound.click?.();
    store.navigate('world_map');
  });
}
