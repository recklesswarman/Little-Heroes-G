// Parent Portal > Reports: preview of the Sunday family report and a "Send to my phone now"
// button. Numbers come from shared/familyInsights.js (the same code the Pi's Sunday 6 PM
// job uses); the server rebuilds the text and publishes it to the ntfy little-heroes topic.
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { buildWeeklyReport } from '../../shared/familyInsights.js';
import { serverApiUrl } from '../services/serverApi.js';

let status = { state: 'idle', text: '' };

export function renderWeeklyReportCard() {
  let report;
  try {
    report = buildWeeklyReport(store.getState?.() || {});
  } catch {
    return '';
  }
  const rows = report.heroes.map((h) => `
    <div class="rounded-2xl bg-surface-container-high/60 border border-surface-container-highest p-3">
      <div class="font-headline font-black text-sm text-inverse-surface">${escapeHtml(h.name)}</div>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2 text-center">
        ${[
          ['Chores', h.choresDone], ['Days', h.activeDays], ['Reading', h.readingSessions],
          ['Brushing', h.brushSessions], ['Workouts', h.workouts], ['Points', h.pointsEarned]
        ].map(([label, value]) => `<div><div class="font-headline font-black text-base text-primary">${Number(value) || 0}</div><div class="text-[10px] font-bold text-on-surface-variant uppercase">${label}</div></div>`).join('')}
      </div>
      ${h.pendingChores || h.pendingRewards.length ? `<div class="text-[11px] font-bold text-amber-400 mt-2">Waiting for you: ${h.pendingChores} chore(s)${h.pendingRewards.length ? `, reward: ${escapeHtml(h.pendingRewards.join(', '))}` : ''}</div>` : ''}
    </div>`).join('');
  const statusColor = status.state === 'error' ? 'text-red-400' : 'text-emerald-400';
  return `
    <div id="weekly-report-card" class="bg-surface-container rounded-3xl p-5 border-2 border-secondary/30 card-shadow flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 class="font-headline font-black text-base text-inverse-surface flex items-center gap-2"><span class="material-symbols-outlined text-secondary">calendar_month</span>Sunday family report</h3>
          <p class="text-xs text-on-surface-variant font-bold">Last 7 days. Sent to the ntfy app every Sunday at 6 PM. Picture books don't count as reading sessions.</p>
        </div>
        <button id="weekly-report-send-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn-sm flex items-center justify-center gap-1.5 active:scale-95 ${status.state === 'sending' ? 'opacity-60' : ''}" ${status.state === 'sending' || !report.heroes.length ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-sm">send_to_mobile</span>
          <span>${status.state === 'sending' ? 'Sending...' : 'Send to my phone now'}</span>
        </button>
      </div>
      ${rows || '<p class="text-xs text-on-surface-variant">No hero profiles yet.</p>'}
      ${status.text ? `<p class="text-xs font-bold ${statusColor}" role="status">${escapeHtml(status.text)}</p>` : ''}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-surface-container-highest">
        <p class="text-xs text-on-surface-variant font-bold">Fridge Display: a big family board of today's chores, streaks and calendar. The Pi's desktop has a "Fridge Display" shortcut. Calendar chores show up the evening before (📅).</p>
        <button id="open-fridge-display-btn" class="bg-surface-container-high text-inverse-surface font-headline text-xs font-black px-4 py-2.5 rounded-xl border border-surface-container-highest flex items-center justify-center gap-1.5 active:scale-95 shrink-0">
          <span class="material-symbols-outlined text-sm">kitchen</span>
          <span>Open Fridge Display</span>
        </button>
      </div>
    </div>`;
}

export async function sendWeeklyReportNow({ fetchImpl = globalThis.fetch, state = store.getState?.() || {} } = {}) {
  const report = buildWeeklyReport(state);
  const res = await fetchImpl(serverApiUrl('/api/report/weekly'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heroes: report.heroes })
  });
  const type = res.headers?.get?.('content-type') || '';
  const data = type.includes('json') ? await res.json().catch(() => null) : null;
  return { ok: Boolean(res.ok && data?.ok && data?.sent), data };
}

export function bindWeeklyReportCard() {
  document.getElementById('open-fridge-display-btn')?.addEventListener('click', () => {
    store.navigate('fridge');
  });
  const btn = document.getElementById('weekly-report-send-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    status = { state: 'sending', text: '' };
    store.notify?.();
    try {
      const { ok, data } = await sendWeeklyReportNow();
      status = ok
        ? { state: 'done', text: 'Sent! Check the ntfy app on your phone.' }
        : { state: 'error', text: data?.error || 'Could not reach the notification server. Is the Pi online?' };
    } catch {
      status = { state: 'error', text: 'Could not reach the notification server. Is the Pi online?' };
    }
    store.notify?.();
  });
}
