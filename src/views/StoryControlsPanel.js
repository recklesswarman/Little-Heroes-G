// Parent Admin Portal > Story Controls tab.
// Per child: reading level, tone, the child's pronouns, the pet's pronouns.
// Household: topics to avoid, web research on/off, the parent's own story ideas, and the safety log.
// All text that comes from storage is escaped; the controls themselves are validated by
// shared/storyEngine/controls.js (the same code the server-side request builder trusts nothing past).

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { TONES } from '../../shared/storyEngine/bible.js';
import {
  AGE_BANDS, PRONOUN_CHOICES, PET_PRONOUN_CHOICES, AVOID_MAX, IDEAS_MAX, SAFETY_LOG_MAX, cleanTopic, checkParentIdea
} from '../../shared/storyEngine/controls.js';

const AGE_LABELS = { '3-4': 'Ages 3-4 (very simple)', '5-6': 'Ages 5-6 (simple)', '7-8': 'Ages 7-8 (richer)' };
const TONE_LABELS = { calm: 'Calm and sleepy', cozy: 'Cozy and warm', silly: 'Gently silly', adventurous: 'Gentle adventure' };
const PRONOUN_LABELS = { they: 'they/them (no guessing)', she: 'she/her', he: 'he/him', it: 'it/its' };
const KIND_LABELS = {
  'wish-blocked': 'A bedtime wish was not used',
  'chapter-fallback': 'A chapter used the offline backup text',
  'plan-fallback': 'The story plan used the offline backup'
};

const select = (heroId, field, value, options, labels) => `
  <select data-story-hero="${escapeHtml(heroId)}" data-story-field="${field}" class="bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm font-bold min-h-[44px] w-full">
    ${options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(labels[o] || o)}</option>`).join('')}
  </select>`;

const field = (label, control) => `
  <label class="flex flex-col gap-1 text-xs font-bold text-on-surface-variant">${label}${control}</label>`;

function renderChild(hero) {
  const p = store.getStoryProfile(hero.id);
  return `
  <div class="bg-surface rounded-2xl border-2 border-secondary-container/60 p-4 flex flex-col gap-3" data-story-child="${escapeHtml(hero.id)}">
    <div class="font-headline font-black text-secondary">${escapeHtml(hero.name || 'Hero')}</div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${field('Reading level', select(hero.id, 'ageBand', p.ageBand, AGE_BANDS, AGE_LABELS))}
      ${field('Story tone', select(hero.id, 'tone', p.tone, TONES, TONE_LABELS))}
      ${field(`${escapeHtml(hero.name || 'Hero')}'s pronouns`, select(hero.id, 'pronouns', p.pronouns, PRONOUN_CHOICES, PRONOUN_LABELS))}
      ${field('Pet companion pronouns', select(hero.id, 'petPronouns', p.petPronouns, PET_PRONOUN_CHOICES, PRONOUN_LABELS))}
    </div>
  </div>`;
}

function chip(text, attr) {
  return `<span class="inline-flex items-center gap-1 bg-secondary/15 text-secondary border border-secondary/30 rounded-full pl-3 pr-1 py-1 text-xs font-bold">
    ${escapeHtml(text)}
    <button type="button" ${attr}="${escapeHtml(text)}" class="w-8 h-8 rounded-full hover:bg-secondary/20 flex items-center justify-center" aria-label="Remove ${escapeHtml(text)}">
      <span class="material-symbols-outlined text-base">close</span></button>
  </span>`;
}

export function renderStoryControlsTab() {
  const heroes = store.getState().heroes || [];
  const controls = store.getStoryControls();
  const log = store.getStorySafetyLog();
  const nameOf = (id) => heroes.find(h => h.id === id)?.name || '';
  return `
  <section id="story-controls-tab" class="flex flex-col gap-6 animate-fade-in">
    <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
      <div>
        <h2 class="font-headline text-xl font-black text-secondary">Story Controls: each child</h2>
        <p class="text-xs text-on-surface-variant font-medium">Changes apply to the next bedtime story. A child's name is always in their story.</p>
      </div>
      ${heroes.length ? heroes.map(renderChild).join('') : '<p class="text-sm text-on-surface-variant">Add a child first.</p>'}
    </div>

    <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-5">
      <h2 class="font-headline text-xl font-black text-secondary">Story Controls: whole household</h2>

      <div class="flex flex-col gap-2">
        <div class="font-headline font-black text-sm">Topics to avoid</div>
        <p class="text-xs text-on-surface-variant">Stories and bedtime wishes will not use these words (up to ${AVOID_MAX}).</p>
        <div id="story-avoid-chips" class="flex flex-wrap gap-2">${controls.avoidTopics.map(t => chip(t, 'data-story-remove-topic')).join('') || '<span class="text-xs text-on-surface-variant">None yet.</span>'}</div>
        <div class="flex gap-2">
          <input id="story-avoid-input" type="text" maxlength="30" placeholder="e.g. spiders" class="flex-1 bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm min-h-[44px]" />
          <button id="story-avoid-add" type="button" class="bg-secondary text-on-secondary font-headline font-black text-xs px-4 rounded-xl min-h-[44px]">Add</button>
        </div>
      </div>

      <label class="flex items-start gap-3 cursor-pointer">
        <input id="story-research-toggle" type="checkbox" class="mt-1 w-5 h-5" ${controls.researchEnabled ? 'checked' : ''} />
        <span class="text-sm"><strong>Fresh ideas from our reviewed story-idea list</strong><br/>
          <span class="text-xs text-on-surface-variant">Stories may use short, gentle idea sparks (nature wonders, folk-tale shapes, seasons) that were reviewed before being added. Turn off to use only your child's own wish and your ideas below.</span></span>
      </label>

      <div class="flex flex-col gap-2">
        <div class="font-headline font-black text-sm">Your own story ideas</div>
        <p class="text-xs text-on-surface-variant">One short, gentle sentence each, up to ${IDEAS_MAX}. Stories may use them as inspiration. Names, numbers, links and quotes are not allowed; we tidy the capital letters for you.</p>
        <div id="story-idea-chips" class="flex flex-wrap gap-2">${controls.parentIdeas.map(t => chip(t, 'data-story-remove-idea')).join('') || '<span class="text-xs text-on-surface-variant">None yet.</span>'}</div>
        <div class="flex gap-2">
          <input id="story-idea-input" type="text" maxlength="200" placeholder="e.g. a dragon who collects lullabies" class="flex-1 bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm min-h-[44px]" />
          <button id="story-idea-add" type="button" class="bg-secondary text-on-secondary font-headline font-black text-xs px-4 rounded-xl min-h-[44px]">Add</button>
        </div>
        <p id="story-idea-msg" class="text-xs text-error font-bold" role="status" aria-live="polite"></p>
        <p class="text-[11px] text-on-surface-variant">Adding your own websites is not available: stories never read outside web pages while a child waits. Type the idea instead.</p>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <div class="font-headline font-black text-sm">Story safety log</div>
          ${log.length ? '<button id="story-log-clear" type="button" class="text-xs font-black text-error border-2 border-error/40 rounded-xl px-3 min-h-[44px]">Clear log</button>' : ''}
        </div>
        <p class="text-xs text-on-surface-variant">Shows when a safety filter changed a story. It never stores the words that were blocked. Last ${SAFETY_LOG_MAX} events.</p>
        <ul id="story-safety-log" class="flex flex-col gap-1 text-xs">
          ${log.map(e => `<li class="bg-surface rounded-xl border border-secondary-container/50 px-3 py-2">
              <strong>${escapeHtml(KIND_LABELS[e.kind] || e.kind)}</strong>
              ${nameOf(e.heroId) ? ` for ${escapeHtml(nameOf(e.heroId))}` : ''}
              <span class="text-on-surface-variant"> · ${escapeHtml(new Date(e.t).toLocaleString())} · ${escapeHtml(e.reason)}</span></li>`).join('') || '<li class="text-on-surface-variant">Nothing to show. All stories passed the filters.</li>'}
        </ul>
      </div>
    </div>
  </section>`;
}

/** Wire the tab's controls. Safe to call when the tab is not on screen (it finds nothing). */
export function bindStoryControlsTab(root = document) {
  const q = (sel) => root.querySelector(sel);
  const refresh = () => store.notify();

  root.querySelectorAll('[data-story-field]').forEach((el) => {
    el.addEventListener('change', () => {
      store.setStoryProfile(el.getAttribute('data-story-hero'), { [el.getAttribute('data-story-field')]: el.value });
      Sound.click();
      refresh();
    });
  });

  const addTopic = () => {
    const input = q('#story-avoid-input');
    const topic = cleanTopic(input?.value || '');
    if (!topic) return;
    const c = store.getStoryControls();
    store.updateStoryControls({ avoidTopics: [...c.avoidTopics, topic] });
    Sound.click();
    refresh();
  };
  q('#story-avoid-add')?.addEventListener('click', addTopic);
  q('#story-avoid-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } });
  root.querySelectorAll('[data-story-remove-topic]').forEach((btn) => btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-story-remove-topic');
    store.updateStoryControls({ avoidTopics: store.getStoryControls().avoidTopics.filter(x => x !== t) });
    refresh();
  }));

  q('#story-research-toggle')?.addEventListener('change', (e) => {
    store.updateStoryControls({ researchEnabled: !!e.target.checked });
    Sound.click();
    refresh();
  });

  const addIdea = () => {
    const input = q('#story-idea-input');
    const msg = q('#story-idea-msg');
    const result = checkParentIdea(input?.value || '');
    if (!result.ok) { if (msg) msg.textContent = result.reason; return; }
    const c = store.getStoryControls();
    if (c.parentIdeas.length >= IDEAS_MAX) { if (msg) msg.textContent = `You can keep up to ${IDEAS_MAX} ideas. Remove one first.`; return; }
    store.updateStoryControls({ parentIdeas: [...c.parentIdeas, result.text] });
    Sound.click();
    refresh();
  };
  q('#story-idea-add')?.addEventListener('click', addIdea);
  q('#story-idea-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIdea(); } });
  root.querySelectorAll('[data-story-remove-idea]').forEach((btn) => btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-story-remove-idea');
    store.updateStoryControls({ parentIdeas: store.getStoryControls().parentIdeas.filter(x => x !== t) });
    refresh();
  }));

  q('#story-log-clear')?.addEventListener('click', () => { store.clearStorySafetyLog(); refresh(); });
}
