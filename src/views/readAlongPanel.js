// The Read-Along arena panel used inside the World Adventure Map (WorldAdventureMapView.js).
//
// The child reads a sentence out loud. Rex listens with Moonshine (or Whisper) on the family Pi (through
// /api/local/stt, which App Hosting relays on hosted sites), or the browser's own speech
// recognition, or, as a last resort, the child taps each word as they read it. Words turn
// green when Rex heard them and orange when they need practice; tapping any word makes Rex
// say it.
//
// The app re-renders whole views whenever any state changes, which replaces this panel's DOM.
// So the progress lives in a controller object, not in the DOM: attachReadAlongPanel() on the
// same sentence re-binds the controller to the fresh DOM and redraws its state, and a take in
// progress carries on. If the child leaves the activity (the panel is gone for good), the
// microphone is released and nothing is uploaded.
import { escapeHtml } from '../utils/escapeHtml.js';
import { Sound } from '../audio/sfx.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import { speakCompanion, stopCompanionAudio } from '../services/voiceService.js';
import { getLocalAiStatus, recordAndTranscribe } from '../services/localVoiceService.js';
import { scoreReading, listenWithBrowserSpeech } from '../services/readAlongService.js';
import confetti from 'canvas-confetti';

const RECORD_SECONDS = { easy: 6, medium: 8, hard: 10 };
const WORD_BASE = 'ra-word font-headline font-black rounded-2xl px-3 py-2 border-2 transition-colors active:scale-95';
const WORD_CLASS = {
  idle: 'bg-surface-container-high text-inverse-surface border-surface-container-highest',
  correct: 'bg-primary/25 text-primary border-primary',
  missed: 'bg-secondary/25 text-secondary border-secondary'
};
const PROMPT = 'Tap the big button and read the sentence out loud!';
const GONE_CHECK_MS = 700;

let current = null; // the running controller, so leaving the screen can stop the microphone

export function renderReadAlongPanel(challenge, difficulty = 'medium') {
  const words = String(challenge?.sentence || '').split(/\s+/).filter(Boolean);
  const size = difficulty === 'easy' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl';
  return `
    <div id="ra-panel" class="flex flex-col items-center gap-5" data-ra-difficulty="${escapeHtml(difficulty)}">
      <div class="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 ${size}" id="ra-words">
        ${words.map((w, i) => `<button type="button" data-ra-idx="${i}" class="${WORD_BASE} ${WORD_CLASS.idle}">${escapeHtml(w)}</button>`).join('')}
      </div>
      <p id="ra-status" class="text-sm font-bold text-on-surface-variant min-h-[1.5rem]" role="status" aria-live="polite">${PROMPT}</p>
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

/** Stops any listening in progress and forgets the sentence (called when the child leaves the activity). */
export function stopReadAlong() {
  if (!current) return;
  const controller = current;
  current = null;
  controller.destroy();
}

function hasBrowserSpeech() {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

class ReadAlongController {
  constructor({ challenge, difficulty, onPass }) {
    this.sentence = challenge.sentence;
    this.rawWords = this.sentence.split(/\s+/).filter(Boolean);
    this.difficulty = difficulty;
    this.onPass = onPass;
    this.destroyed = false;
    // State (redrawn into whatever DOM is current)
    this.wordStates = this.rawWords.map(() => 'idle');
    this.statusText = PROMPT;
    this.recordLabel = 'Read it!';
    this.recording = false;
    this.tapMode = false;
    this.passed = false;
    this.preferBrowser = false; // set after Whisper fails once, so the next try uses this device's listening
    this.listener = null;
    this.goneTimer = null;
  }

  // ---- DOM binding (runs again after every re-render) ----
  bind() {
    this.panel = document.getElementById('ra-panel');
    if (!this.panel) return;
    this.wordEls = Array.from(this.panel.querySelectorAll('.ra-word'));
    this.statusEl = document.getElementById('ra-status');
    this.recordBtn = document.getElementById('ra-record');
    this.recordLabelEl = document.getElementById('ra-record-label');
    this.nextBtn = document.getElementById('ra-next');

    this.recordBtn.addEventListener('click', () => this.onRecordClick());
    document.getElementById('ra-hear')?.addEventListener('click', () => {
      Sound.click();
      speakCompanion(this.sentence, { petId: 'rex' });
    });
    this.wordEls.forEach((el, i) => el.addEventListener('click', () => this.onWordClick(i)));
    this.nextBtn.addEventListener('click', () => {
      Sound.click();
      const onPass = this.onPass;
      stopReadAlong();
      onPass?.();
    });
    this.draw();
  }

  draw() {
    if (!this.panel) return;
    this.wordEls.forEach((el, i) => { el.className = `${WORD_BASE} ${WORD_CLASS[this.wordStates[i]]}`; });
    this.statusEl.textContent = this.statusText;
    this.recordLabelEl.textContent = this.recordLabel;
    this.nextBtn.classList.toggle('hidden', !this.passed);
    this.recordBtn.classList.toggle('hidden', this.passed);
  }

  setStatus(text) { this.statusText = text; this.draw(); }

  // ---- Behaviour ----
  onWordClick(i) {
    if (this.passed) return;
    if (this.tapMode) {
      this.wordStates[i] = 'correct';
      if (this.wordStates.every((s) => s === 'correct')) return this.finishPass();
      return this.draw();
    }
    speakCompanion(this.rawWords[i].replace(/[^\w']/g, ''), { petId: 'rex' });
  }

  onRecordClick() {
    if (this.recording) { this.listener?.stop(); return; }
    if (this.tapMode) return this.enterTapMode('Starting over.');
    this.listen().catch(() => {
      this.recording = false;
      this.enterTapMode("I couldn't use the microphone.");
    });
  }

  enterTapMode(reason) {
    this.tapMode = true;
    this.wordStates = this.rawWords.map(() => 'idle');
    this.recordLabel = 'Start over';
    this.setStatus(`${reason} Tap each word as you read it!`);
  }

  finishPass() {
    if (this.passed) return;
    this.passed = true;
    Sound.correctAnswer();
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    voicePrompts.speak('Great reading! You read that all by yourself!', null, 'rex');
    this.setStatus('Great reading!');
  }

  showResult(result) {
    this.wordStates = result.words.map((w) => w.status);
    if (result.passed) return this.finishPass();
    Sound.wrongAnswer();
    voicePrompts.speakTryAgain();
    this.setStatus(result.heardAnything
      ? 'Nice try! Tap the orange words to hear them, then read it again.'
      : "I didn't hear anything. Tap Read it! and try again.");
  }

  /** Releases the mic if the panel is gone for good (the child left the activity). */
  watchForLeaving() {
    clearInterval(this.goneTimer);
    this.goneTimer = setInterval(() => {
      if (this.destroyed) return clearInterval(this.goneTimer);
      // A re-render swaps the DOM in one step, so a missing panel here means the child went elsewhere.
      if (!document.getElementById('ra-panel')) stopReadAlong();
    }, GONE_CHECK_MS);
  }

  async listen() {
    stopCompanionAudio();
    this.recording = true;
    this.wordStates = this.rawWords.map(() => 'idle');
    this.recordLabel = "I'm done!";
    this.setStatus('Rex is listening... read the sentence out loud!');
    this.watchForLeaving();

    const maxMs = (RECORD_SECONDS[this.difficulty] || 8) * 1000;
    const piStatus = this.preferBrowser ? { stt: false } : await getLocalAiStatus().catch(() => ({ stt: false }));
    if (this.destroyed) return;
    const usedPi = Boolean(piStatus.stt);
    this.listener = usedPi ? recordAndTranscribe({ maxMs, fast: true }) : listenWithBrowserSpeech({ maxMs });
    const transcript = await this.listener.result;
    this.listener = null;
    clearInterval(this.goneTimer);
    this.recording = false;
    if (this.destroyed) return;
    this.recordLabel = 'Read it again';

    if (transcript === null) {
      if (usedPi && hasBrowserSpeech()) {
        // Whisper didn't answer. Offer another go using this device's own listening.
        this.preferBrowser = true;
        return this.setStatus("Rex's ears are resting, so we'll use this device. Tap Read it again!");
      }
      return this.enterTapMode(usedPi ? "Rex's ears are resting right now." : "Rex can't listen on this device.");
    }
    this.showResult(scoreReading(this.sentence, transcript));
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.goneTimer);
    try { this.listener?.cancel?.(); } catch {}
    try { this.listener?.stop?.(); } catch {}
    this.listener = null;
  }
}

/**
 * Wires up the panel that renderReadAlongPanel produced.
 * `onPass` runs when the child taps Next after a good read.
 * Calling this again for the same sentence (after a re-render) keeps the progress and any take in progress.
 */
export function attachReadAlongPanel({ challenge, difficulty = 'medium', onPass }) {
  if (!challenge?.sentence || !document.getElementById('ra-panel')) return;
  if (current && !current.destroyed && current.sentence === challenge.sentence) {
    current.onPass = onPass;
    current.bind();
    return;
  }
  stopReadAlong();
  current = new ReadAlongController({ challenge, difficulty, onPass });
  current.bind();
}
