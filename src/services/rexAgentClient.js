// Browser side of Rex's function calling (server/rexAgentService.js, POST /api/rex/agent).
//
// Sends the kid's message with a compact snapshot of their chores, points/rewards and week
// (shared/familyInsights.js), then applies the actions Rex asked for through the normal
// store methods: a chore goes to the Parent Portal for approval, a reward becomes a parent
// request, and navigation only reaches kid screens (never the Parent Portal).
import { store } from '../state/store.js';
import { serverApiUrl } from './serverApi.js';
import { buildRexAgentContext } from '../../shared/familyInsights.js';

const ALLOWED_VIEWS = new Set(['dashboard', 'shop', 'pet_sanctuary', 'quest_map', 'bedtime_story', 'story_library', 'battle', 'dino_workout']);
const HISTORY_LIMIT = 8;
const history = [];

function readFlag() {
  try {
    return String(import.meta.env?.VITE_REX_AGENT ?? '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export function isRexAgentEnabled() {
  return readFlag() !== 'false';
}

export function resetRexAgentHistory() {
  history.length = 0;
}

/** Ask the function-calling Rex. Resolves to the server's JSON, or null if unavailable. */
export async function askRexAgent({ message, hero, petId = 'rex', childName, appState = null, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  if (!isRexAgentEnabled() || typeof fetchImpl !== 'function' || !message) return null;
  const state = store.getState?.() || {};
  const targetHero = hero || store.getSelectedHero?.() || state.selectedHero || {};
  let agentContext;
  try {
    agentContext = buildRexAgentContext(state, targetHero);
  } catch {
    agentContext = {};
  }
  let parentRules = null;
  try {
    const rules = store.getCompanionRules?.();
    if (rules) parentRules = { tone: rules.tone, focusAreas: rules.focusAreas };
  } catch {
    parentRules = null;
  }
  try {
    const res = await fetchImpl(serverApiUrl('/api/rex/agent'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        petId,
        childName: childName || targetHero.name || 'Little Hero',
        history: history.slice(-HISTORY_LIMIT),
        appState: appState ? { hero: appState.hero, activePet: appState.activePet } : { hero: { gameDifficulty: targetHero.gameDifficulty || 'medium' } },
        agentContext,
        parentRules
      }),
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined
    });
    if (!res.ok) return null;
    const type = res.headers?.get?.('content-type') || '';
    if (!type.includes('json')) return null; // a static host answered with index.html
    const data = await res.json();
    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) return null;
    history.push({ role: 'user', text: String(message).slice(0, 500) }, { role: 'model', text: data.reply.slice(0, 500) });
    while (history.length > HISTORY_LIMIT) history.shift();
    return data;
  } catch {
    return null;
  }
}

/** Apply Rex's validated actions on this device. Returns the actions that ran. */
export function applyRexActions(actions = [], s = store) {
  const applied = [];
  const state = s.getState?.() || {};
  const heroId = state.selectedHero?.id;
  for (const action of (Array.isArray(actions) ? actions : []).slice(0, 2)) {
    try {
      if (action?.type === 'submit_chore' && action.choreId) {
        const id = String(action.choreId);
        const alreadyWaiting = s.isTaskPendingApproval?.(id, heroId);
        const doneToday = (s.getTaskCompletionsToday?.(id, heroId) || []).length > 0;
        if (alreadyWaiting || doneToday) continue;
        if ((state.taskForest || []).some((t) => t.id === id && !t.isAR)) {
          s.toggleTaskForest(id);
          applied.push(action);
        } else if ((state.habitIslands || []).some((h) => h.id === id)) {
          s.toggleHabitIsland(id);
          applied.push(action);
        }
      } else if (action?.type === 'request_reward' && action.rewardId) {
        if ((state.realLifeRewards || []).some((r) => r.id === action.rewardId)) {
          s.redeemRealLifeReward(action.rewardId);
          applied.push(action);
        }
      } else if (action?.type === 'navigate' && ALLOWED_VIEWS.has(action.view)) {
        s.navigate?.(action.view);
        applied.push(action);
      }
    } catch (err) {
      console.warn('[rexAgent] action skipped:', err?.message || err);
    }
  }
  return applied;
}
