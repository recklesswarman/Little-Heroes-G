// Browser-side child-safety checks for companion text (Rex and the pet companions, the quest guide,
// the battle coach). The same checks the Cloud Function runs (shared/storyEngine/companionGuard.js),
// applied to whatever comes back, whichever service produced it, before a child sees or hears it.
// A blocked reply becomes a kind fixed line and a reason-code-only entry in the parent safety log.

import { store } from '../state/store.js';
import { guardChildMessage, guardCompanionReply, safeCompanionLine, cleanTopics, TECHNICAL_REASONS } from '../../shared/storyEngine/companionGuard.js';

/** The household's topics to avoid (Story Controls + the Rex Restricted Topics rule). Never throws. */
export function householdAvoidTopics() {
  let story = [];
  let rex = [];
  try { story = store.getStoryControls().avoidTopics || []; } catch { story = []; }
  try { rex = store.getCompanionRules?.().restrictedTopics || []; } catch { rex = []; }
  try { return cleanTopics([...story, ...rex]); } catch { return []; }
}

/**
 * The parent's Rex rules (Safety tab: Parental Rules & Screen-Time Guardrails),
 * checked before any child message is sent to any Rex service.
 * {ok:false, reply, reason} = answer with `reply` and send nothing.
 * Call countCompanionTurn() only after this returns ok.
 */
export function checkCompanionRules({ heroId = null, petName = 'Rex', childName = 'Little Hero', now = new Date() } = {}) {
  let rules;
  try { rules = store.getCompanionRules(); } catch { return { ok: true, rules: null }; }
  if (!rules.companionEnabled) {
    return { ok: false, reason: 'companion_off', reply: `*Shhh...* ${petName} is resting! Ask a grown-up to wake them up!` };
  }
  const hour = now.getHours();
  if (hour >= rules.bedtimeHour || hour < 6) {
    return { ok: false, reason: 'bedtime', reply: `*Yawn...* ${petName} is fast asleep for the night! See you in the morning, ${childName}!` };
  }
  if (rules.maxDailyTurns < 999 && heroId && store.getCompanionTurnsToday(heroId) >= rules.maxDailyTurns) {
    return { ok: false, reason: 'daily_turns', reply: `*Happy wave!* We had so much fun chatting today! Let's rest our screens and play in the real world, ${childName}!` };
  }
  return { ok: true, rules };
}

/** Gate + count one child turn. Returns the checkCompanionRules result. */
export function admitCompanionTurn(ctx = {}) {
  const gate = checkCompanionRules(ctx);
  if (gate.ok && ctx.heroId) {
    try { store.countCompanionTurn(ctx.heroId); } catch { /* counting is best effort */ }
  }
  return gate;
}

function logEvent(kind, reason, heroId) {
  try { store.logStorySafetyEvent({ kind, reason, heroId }); } catch { /* the log is best effort */ }
}

/** Events a server reported (reason codes only) go into the parent's safety log. */
export function logServerSafetyEvents(events, heroId) {
  for (const e of Array.isArray(events) ? events : []) logEvent(e?.kind, e?.reason, heroId);
}

/** Check the child's message before it leaves the app. {ok:false, reply} = answer with `reply` instead. */
export function guardOutgoingMessage(message, { petName, childName, heroId } = {}) {
  const check = guardChildMessage(message, { avoidTopics: householdAvoidTopics() });
  if (check.ok) return { ok: true };
  logEvent('chat-message-blocked', check.reason, heroId);
  return { ok: false, reply: safeCompanionLine({ petName, childName, seed: Date.now() }) };
}

/** Check a reply. Returns {text, blocked}; `text` is safe to show and speak. */
export function guardReplyText(text, { petName, childName, heroId } = {}) {
  const check = guardCompanionReply(text, { avoidTopics: householdAvoidTopics() });
  if (check.ok) return { text: check.text, blocked: false };
  if (!TECHNICAL_REASONS.includes(check.reason)) logEvent('chat-reply-blocked', check.reason, heroId);
  return { text: safeCompanionLine({ petName, childName, seed: Date.now() }), blocked: true };
}

/**
 * A structured Rex response ({reply, emotion, habitAwarded, suggestedAction, ...}). A blocked reply is
 * replaced and its actions (habit award, navigation) and any pre-made audio are dropped with it.
 */
export function guardRexData(data, ctx = {}) {
  if (!data || typeof data !== 'object') return data;
  const checked = guardReplyText(data.reply, ctx);
  if (!checked.blocked) return { ...data, reply: checked.text };
  const rest = { ...data };
  for (const key of ['habitAwarded', 'suggestedAction', 'audio', 'audioBase64', 'audio_base64', 'audioUrl']) delete rest[key];
  return { ...rest, reply: checked.text, emotion: 'calm', voiceTone: 'gentle' };
}

/** One text field of a coach/guide response (for example coach_text). Replaced when it fails. */
export function guardTextField(obj, field, ctx = {}) {
  if (!obj || typeof obj !== 'object' || typeof obj[field] !== 'string') return obj;
  const checked = guardReplyText(obj[field], ctx);
  return { ...obj, [field]: checked.text };
}
