// The Read-Along arena panel used inside the Quest Map (QuestMapView.js).
//
// The child reads a sentence out loud. Rex listens with Whisper on the family Pi (through
// /api/local/stt, which App Hosting relays on hosted sites), or the browser's own speech
// recognition if the Pi is unreachable, or, as a last resort, the child taps each word as they
// read it. Words turn green when Rex heard them and orange when they need practice; tapping
// any word makes Rex say it.
import { escapeHtml } from '../utils/escapeHtml.js';
import { Sound } from '../audio/sfx.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import { speakCompanion, stopCompanionAudio } from '../services/voiceService.js';
import { getLocalAiStatus, recordAndTranscribe } from '../services/localVoiceService.js';
import { scoreReading, listenWithBrowserSpeech } from '../services/readAlongService.js';
import confetti from 'canvas-confetti';

const RECORD_SECONDS = { easy: 6, medium: 8, hard: 10 };
const WORD_BASE = 'ra-word font-headline font-black rounded-2xl px-3 py-2 border-2 transition-colors active:scale-95';
const WORD_IDLE = 'bg-surface-container-high text-inverse-surface border-surface-container-highest';
const WORD_GOOD = 'bg-primary/25 text-primary border-primary';
const WORD_MISS = 'bg-secondary/25 text-secondary border-secondary';

let current = null; // the running session, so leaving the screen can stop the microphone

export function renderReadAlongPanel(challenge, difficulty = 'medium') {
  const words = String(challenge?.sentence || '').split(/\s+/).filter(Boolean);
  const size = difficulty === 'easy' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl';
  return `
    <div id="ra-panel" class="flex flex-col items-center gap-5" data-ra-difficulty="${escapeHtml(difficulty)}">
      <div class="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 ${size}" id="ra-words">
        ${words.map((w, i) => `<button type="button" data-ra-idx="${i}" class="${WORD_BASE} ${WORD_IDLE}">${escapeHtml(w)}</button>`).join('')}
      </div>
      <p id="ra-status" class="text-sm font-bold text-on-surface-variant min-h-[1.5rem]" role="status" aria-live="polite">
        Tap the big button and read the sentence out loud!
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button type="button" id="ra-hear" class="bg-secondary text-on-secondary font-headline text-sm font-black px-4 py-3 rounded-2xl chunky-btn-sm flex items-center gap-1.5 active:scale-95">
          <span class="material-symbols-outlined text-base">volume_up</span> Hear Rex read it
        </button>
        <button type="button" id="ra-record" class="bg-primary text-on-primary font-headline text-lg font-black px-6 py-4 rounded-2xl chunky-btn flex items-center gap-2 active:scale-95">
          <span class="material-symbols-outlined text-2xl">mic</span> <span id="ra-record-label">Read it!</span>
        </button>
        <button type="button" id="ra-next" class="hidden bg-primary text-on-primary font-headline text-lg font-black px-6 py-4 rounded-2xl chunky-btn flex items-center gap-2 active:scale-95">
          Next <span class="material-symbols-outlined text-2xl">arrow_forward</span>
        </button>
      </div>
    </div>`;
}

/** Stops any listening in progress (called when the child leaves the activity). */
export function stopReadAlong() {
  if (current) {
    current.cancelled = true;
    try { current.stopListening?.(); } catch {}
    current = null;
  }
}

/**
 * Wires up the panel that renderReadAlongPanel produced.
 * `onPass` runs when the child taps Next after a good read.
 */
export function attachReadAlongPanel({ challenge, difficulty = 'medium', onPass }) {
  stopReadAlong();
  const panel = document.getElementById('ra-panel');
  if (!panel || !challenge?.sentence) return;
  const session = { cancelled: false, stopListening: null };
  current = session;

  const status = document.getElementById('ra-status');
  const recordBtn = document.getElementById('ra-record');
  const recordLabel = document.getElementById('ra-record-label');
  const nextBtn = document.getElementById('ra-next');
  const wordEls = Array.from(panel.querySelectorAll('.ra-word'));
  const sentence = challenge.sentence;
  let tapMode = false;
  let recording = false;
  let passed = false;

  const alive = () => !session.cancelled && document.body.contains(panel);
  const say = (text) => { if (status) status.textContent = text; };
  const paint = (el, cls) => { el.className = `${WORD_BASE} ${cls}`; };

  function finishPass() {
    if (passed) return;
    passed = true;
    Sound.correctAnswer();
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    voicePrompts.speak('Great reading! You read that all by yourself!', null, 'rex');
    say('Great reading!');
    nextBtn.classList.remove('hidden');
    recordBtn.classList.add('hidden');
  }

  function showResult(result) {
    result.words.forEach((w, i) => { if (wordEls[i]) paint(wordEls[i], w.status === 'correct' ? WORD_GOOD : WORD_MISS); });
    if (result.passed) return finishPass();
    Sound.wrongAnswer();
    say(result.heardAnything
      ? 'Nice try! Tap the orange words to hear them, then read it again.'
      : "I didn't hear anything. Tap Read it! and try again.");
    voicePrompts.speakTryAgain();
  }

  function enterTapMode(reason) {
    tapMode = true;
    wordEls.forEach((el) => paint(el, WORD_IDLE));
    say(`${reason} Tap each word as you read it!`);
    recordLabel.textContent = 'Start over';
  }

  async function listen() {
    stopCompanionAudio();
    recording = true;
    recordLabel.textContent = "I'm done!";
    say('Rex is listening... read the sentence out loud!');
    wordEls.forEach((el) => paint(el, WORD_IDLE));

    const maxMs = (RECORD_SECONDS[difficulty] || 8) * 1000;
    let listener;
    let usedPi = false;
    const piStatus = await getLocalAiStatus().catch(() => ({ stt: false }));
    if (!alive()) return;
    if (piStatus.stt) {
      usedPi = true;
      listener = recordAndTranscribe({ maxMs });
    } else {
      listener = listenWithBrowserSpeech({ maxMs });
    }
    session.stopListening = listener.stop;
    const transcript = await listener.result;
    recording = false;
    session.stopListening = null;
    if (!alive()) return;
    recordLabel.textContent = 'Read it again';

    if (transcript === null) {
      return enterTapMode(usedPi ? "Rex's ears are resting right now." : "Rex can't listen on this device.");
    }
    showResult(scoreReading(sentence, transcript));
  }

  recordBtn.addEventListener('click', () => {
    if (recording) { session.stopListening?.(); return; }
    if (tapMode) return enterTapMode('Starting over.');
    listen().catch(() => { recording = false; if (alive()) enterTapMode("I couldn't use the microphone."); });
  });

  document.getElementById('ra-hear')?.addEventListener('click', () => {
    Sound.click();
    speakCompanion(sentence, { petId: 'rex' });
  });

  wordEls.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (passed) return;
      if (tapMode) {
        paint(el, WORD_GOOD);
        if (wordEls.every((w) => w.className.includes('text-primary'))) finishPass();
        return;
      }
      const word = sentence.split(/\s+/).filter(Boolean)[i];
      speakCompanion(word.replace(/[^\w']/g, ''), { petId: 'rex' });
    });
  });

  nextBtn.addEventListener('click', () => {
    Sound.click();
    stopReadAlong();
    onPass?.();
  });
}
