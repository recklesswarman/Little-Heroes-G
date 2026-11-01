// Browser-side child-safety checks for companion text (Rex and the pet companions, the quest guide,
// the battle coach). The same checks the Cloud Function runs (shared/storyEngine/companionGuard.js),
// applied to whatever comes back, whichever service produced it, before a child sees or hears it.
// A blocked reply becomes a kind fixed line and a reason-code-only entry in the parent safety log.

import { store } from '../state/store.js';
import { guardChildMessage, guardCompanionReply, safeCompanionLine, cleanTopics } from '../../shared/storyEngine/companionGuard.js';

/** The household's topics to avoid (Story Controls). Never throws. */
export function householdAvoidTopics() {
  try { return cleanTopics(store.getStoryControls().avoidTopics); } catch { return []; }
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
  logEvent('chat-reply-blocked', check.reason, heroId);
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
