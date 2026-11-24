// Browser side of the kids' tablet internet guard (server/netGuardService.js, shared/netGuard.js).
// Every call carries the household sync code; the Pi checks it against HOUSEHOLD_CODES.
import { serverApiUrl } from './serverApi.js';
import { store } from '../state/store.js';

function householdCode(state) {
  return String(state?.household?.syncCode || '').trim().toUpperCase();
}

export async function netGuardRequest(action, payload = {}, { fetchImpl = globalThis.fetch, state = store.getState?.() || {} } = {}) {
  const code = householdCode(state);
  if (!code) return { configured: false, error: 'Link this device to your household first (Settings > Household sync).' };
  if (typeof fetchImpl !== 'function') return { configured: false, error: 'No network' };
  try {
    const res = await fetchImpl(serverApiUrl('/api/netguard'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action, householdCode: code })
    });
    const type = res.headers?.get?.('content-type') || '';
    const data = type.includes('json') ? await res.json().catch(() => null) : null;
    return data || { configured: false, error: 'The family Pi did not answer' };
  } catch {
    return { configured: false, error: 'The family Pi did not answer' };
  }
}

function todayKey(nowMs) {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * The kid opened the Bedtime Sanctuary: ask the Pi to start bedtime for that kid's tablet(s).
 * Sent at most once per kid per evening (after 3 PM); the Pi decides whether it is late enough.
 */
export function noteBedtimeStarted(heroId, { nowMs = Date.now(), storage = globalThis.localStorage, request = netGuardRequest } = {}) {
  if (!heroId) return false;
  const now = new Date(nowMs);
  if (now.getHours() < 15) return false;
  const key = `lh-netguard-bedtime-${heroId}`;
  try {
    if (storage?.getItem(key) === todayKey(nowMs)) return false;
    storage?.setItem(key, todayKey(nowMs));
  } catch {
    // Private mode: just send it.
  }
  Promise.resolve(request('bedtime', { heroId: String(heroId) })).catch(() => {});
  return true;
}
