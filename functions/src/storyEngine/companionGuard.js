// Child-safety checks for companion chat (Rex and the pet companions, the quest guide, the battle
// coach). Pure functions shared by the Cloud Function and the browser, so a reply is checked the
// same way wherever it comes from. Uses the same blocklist as stories (safety.js).
//
// Reasons are fixed codes, never the blocked words, so the parent safety log never stores them.

import { checkChapterSafety, matchesAvoidTopic } from './safety.js';
import { cleanTopic, cleanReason } from './controls.js';

export const CHAT_REPLY_MAX = 600;
export const CHAT_TOPICS_MAX = 20;

// Strictest filter level on all four categories (the Gemini API setting for chat).
export const CHAT_SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT'
].map(category => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

const LINK_RE = /(https?:\/\/|www\.|\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b)/i;
const INSTRUCTION_RE = /(ignore (all |any |the )?(previous|prior|above)|disregard (all |any |the )?(previous|prior|above)|system prompt|jailbreak|as an ai language model)/i;

/**
 * Parent topics to avoid: cleaned, deduped, bounded. Accepts lists of anything.
 * @param {...any} lists
 * @returns {string[]}
 */
export function cleanTopics(...lists) {
  const out = [];
  for (const list of lists) {
    for (const raw of Array.isArray(list) ? list : []) {
      const t = cleanTopic(raw);
      if (t && !out.includes(t)) out.push(t);
      if (out.length >= CHAT_TOPICS_MAX) return out;
    }
  }
  return out;
}

/**
 * The child's message before it is sent to a model: only the parent's topics and instruction text stop it.
 * @param {unknown} text
 * @param {{ avoidTopics?: string[] }} [options]
 * @returns {{ ok: boolean, reason: string }}
 */
export function guardChildMessage(text, { avoidTopics = [] } = {}) {
  const body = typeof text === 'string' ? text : '';
  if (matchesAvoidTopic(body, avoidTopics)) return { ok: false, reason: 'avoid-topic' };
  if (INSTRUCTION_RE.test(body)) return { ok: false, reason: 'instruction-text' };
  return { ok: true, reason: '' };
}

/**
 * A companion reply before a child sees or hears it. Returns {ok, reason, text}; `text` is the reply
 * tidied (control characters removed, whitespace collapsed, cut at a sentence if very long).
 * @param {unknown} text
 * @param {{ avoidTopics?: string[] }} [options]
 * @returns {{ ok: boolean, reason: string, text: string }}
 */
export function guardCompanionReply(text, { avoidTopics = [] } = {}) {
  let body = typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!body) return { ok: false, reason: 'empty', text: '' };
  const safety = checkChapterSafety(body, { avoidTopics, allowQuestions: true });
  if (!safety.ok) return { ok: false, reason: cleanReason(safety.issues[0]), text: '' };
  if (LINK_RE.test(body)) return { ok: false, reason: 'link', text: '' };
  if (INSTRUCTION_RE.test(body)) return { ok: false, reason: 'instruction-text', text: '' };
  if (body.length > CHAT_REPLY_MAX) {
    const cut = body.slice(0, CHAT_REPLY_MAX);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    body = end > 80 ? cut.slice(0, end + 1) : cut.trim();
  }
  return { ok: true, reason: '', text: body };
}

const LINES = [
  (pet, child) => `*Wiggle ears!* ${pet} would love to talk about something cozy and fun, ${child}! Tell me about your day!`,
  (pet, child) => `*Happy hop!* Let's talk about something super fun instead, ${child}! What was the best part of your day?`,
  (pet, child) => `*Warm smile!* ${pet} is thinking about our next adventure, ${child}! Want to hear about it?`,
  (pet, child) => `*Gentle cheer!* ${child}, you are doing great! Let's find something fun to do together!`
];

/**
 * A kind fixed line in the pet's voice, shown instead of a reply that failed a check.
 * @param {{ petName?: string, childName?: string, seed?: number }} [options]
 * @returns {string}
 */
export function safeCompanionLine({ petName = 'Your pet', childName = 'Little Hero', seed = 0 } = {}) {
  const pick = LINES[Math.abs(Number(seed) || 0) % LINES.length];
  return pick(String(petName || 'Your pet').slice(0, 40), String(childName || 'Little Hero').slice(0, 30));
}

/**
 * Safety lines added to a companion's system instruction.
 * @param {{ avoidTopics?: string[] }} [options]
 * @returns {string}
 */
export function companionSafetyRule({ avoidTopics = [] } = {}) {
  const topics = cleanTopics(avoidTopics);
  return [
    'SAFETY: You are talking with a young child. Always be kind, gentle and calm.',
    'Never mention anything scary, violent, rude or unkind. Never ask for or repeat personal information (full name, address, school, phone number). Never share links or web addresses.',
    'If the child seems upset or says something worrying, gently suggest talking to a grown-up they trust.',
    topics.length ? `The parent asked that you never talk about: ${topics.join(', ')}. If the child brings one up, kindly change the subject.` : ''
  ].filter(Boolean).join(' ');
}
