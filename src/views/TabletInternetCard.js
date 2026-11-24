// Parent Portal > Screen Time: the kids' tablet internet, through the family Pi's Pi-hole
// (server/netGuardService.js). Status and on/off buttons for each tablet, YouTube Restricted Mode
// and SafeSearch settings, and adding a tablet from the devices Pi-hole has seen.
// Bedtime off time = the kid's Bedtime Curfew (the setting below this card); morning time is per tablet.
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { netGuardRequest } from '../services/netGuardClient.js';
import { formatTime, REASON_TEXT, MAX_TABLETS, DEFAULT_MORNING } from '../../shared/netGuard.js';

const STALE_MS = 30 * 1000;
let view = { loading: false, loadedAt: 0, data: null, busy: '', message: '', error: '' };

function heroes() {
  return store.getState?.().heroes || [];
}

function curfewFor(heroId) {
  const hero = heroes().find((h) => h.id === heroId);
  return hero && typeof hero.bedtimeCurfew === 'string' ? hero.bedtimeCurfew : '';
}

function clockText(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function seenText(lastQuery, nowMs) {
  if (!lastQuery) return '<span class="text-amber-400">Not using the Pi-hole yet. See "Set up a tablet" below.</span>';
  const mins = Math.max(0, Math.round((nowMs / 1000 - lastQuery) / 60));
  if (mins > 24 * 60) return '<span class="text-amber-400">Hasn\'t used the Pi-hole for over a day.</span>';
  return `Last seen ${mins < 1 ? 'just now' : `${mins} min ago`}`;
}

function statusChip(t) {
  if (t.online) {
    const extra = t.reason === 'extra-time' || t.reason === 'parent-on' ? ` (${REASON_TEXT[t.reason]} until ${clockText(t.until)})` : '';
    return `<span class="text-emerald-400">🟢 Internet on${escapeHtml(extra)}</span>`;
  }
  const icon = t.reason === 'parent-off' ? '⛔' : '🌙';
  return `<span class="text-sky-300">${icon} Internet off: ${escapeHtml(REASON_TEXT[t.reason] || 'bedtime')}, back at ${escapeHtml(clockText(t.until))}</span>`;
}

function tabletRow(t, nowMs) {
  const hero = heroes().find((h) => h.id === t.heroId);
  const busy = view.busy === t.id;
  const btn = (action, icon, label) => `<button data-netguard-action="${action}" data-tablet-id="${escapeHtml(t.id)}" class="bg-surface-container-high text-inverse-surface font-headline text-[11px] font-black px-3 py-2 rounded-xl border border-surface-container-highest flex items-center gap-1 active:scale-95 min-h-[40px] ${busy ? 'opacity-60' : ''}" ${busy ? 'disabled' : ''}><span class="material-symbols-outlined text-sm">${icon}</span>${label}</button>`;
  return `
    <div class="rounded-2xl bg-surface-container-high/60 border border-surface-container-highest p-3 flex flex-col gap-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="font-headline font-black text-sm text-inverse-surface">${escapeHtml(t.name)}${hero ? ` <span class="text-on-surface-variant font-bold">· ${escapeHtml(hero.name || '')}</span>` : ''}</div>
          <div class="text-xs font-bold">${statusChip(t)}</div>
          <div class="text-[11px] text-on-surface-variant font-bold">
            Off at ${t.offAt ? escapeHtml(formatTime(t.offAt)) : 'Bedtime Sanctuary only (no curfew set)'} · on at ${escapeHtml(formatTime(t.onAt))} · ${seenText(t.lastQuery, nowMs)}
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${t.online ? btn('off', 'wifi_off', 'Turn off now') : btn('on', 'wifi', 'Turn on now')}
          ${btn('extend', 'more_time', '+15 min')}
          ${t.reason === 'parent-on' || t.reason === 'parent-off' || t.reason === 'extra-time' ? btn('auto', 'schedule', 'Back to schedule') : ''}
          <button data-netguard-remove="${escapeHtml(t.id)}" class="text-red-300 font-headline text-[11px] font-black px-2 py-2 rounded-xl min-h-[40px]" title="Stop managing this tablet">Remove</button>
        </div>
      </div>
      <label class="text-[11px] font-bold text-on-surface-variant flex items-center gap-2">
        Internet back on at
        <input type="time" data-netguard-morning="${escapeHtml(t.id)}" value="${escapeHtml(t.onAt)}" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-2 py-1 text-xs font-bold text-inverse-surface" />
      </label>
    </div>`;
}

function addTabletForm(data) {
  const used = new Set((data.tablets || []).map((t) => t.client));
  const devices = (data.devices || []).filter((d) => !used.has(d.client));
  if ((data.tablets || []).length >= MAX_TABLETS) return '';
  const options = devices.map((d) => {
    const label = [d.name || d.vendor || 'Device', d.ip, d.lastQuery ? `seen ${clockText(d.lastQuery * 1000)}` : ''].filter(Boolean).join(' · ');
    return `<option value="${escapeHtml(d.client)}">${escapeHtml(label)}</option>`;
  }).join('');
  const heroOptions = heroes().map((h) => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name || 'Hero')}</option>`).join('');
  return `
    <div class="rounded-2xl border border-dashed border-surface-container-highest p-3 flex flex-col gap-2">
      <div class="font-headline font-black text-xs text-inverse-surface">Add a kid's tablet</div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select id="netguard-add-device" class="sm:col-span-2 bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-2 py-2 text-xs font-bold text-inverse-surface">
          ${options || '<option value="">No devices yet. Open the app on the tablet, then refresh.</option>'}
        </select>
        <select id="netguard-add-hero" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-2 py-2 text-xs font-bold text-inverse-surface">${heroOptions}</select>
        <input id="netguard-add-name" maxlength="30" placeholder="Tablet name" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-2 py-2 text-xs font-bold text-inverse-surface" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input id="netguard-add-client" maxlength="17" placeholder="or type its IP / MAC" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-2 py-2 text-xs font-bold text-inverse-surface" />
        <button id="netguard-add-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-xl chunky-btn-sm active:scale-95">Add tablet</button>
        <button id="netguard-refresh-btn" class="text-on-surface-variant font-headline text-xs font-black px-3 py-2.5 rounded-xl">Refresh devices</button>
      </div>
    </div>`;
}

function settingsForm(s) {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
      <label class="text-xs font-black text-inverse-surface flex flex-col gap-1">YouTube Restricted Mode
        <select id="netguard-youtube" class="bg-surface-container-lowest border-2 border-surface-container-highest rounded-xl px-2 py-2 text-xs font-bold text-inverse-surface">
          <option value="strict" ${s.youtube === 'strict' ? 'selected' : ''}>Strict (hides the most)</option>
          <option value="moderate" ${s.youtube === 'moderate' ? 'selected' : ''}>Moderate</option>
          <option value="off" ${s.youtube === 'off' ? 'selected' : ''}>Off</option>
        </select>
      </label>
      <label class="text-xs font-black text-inverse-surface flex items-center gap-2"><input type="checkbox" id="netguard-safesearch" ${s.safeSearch ? 'checked' : ''} class="accent-sky-400" />SafeSearch on Google, Bing, DuckDuckGo</label>
      <label class="text-xs font-black text-inverse-surface flex items-center gap-2"><input type="checkbox" id="netguard-alerts" ${s.alerts ? 'checked' : ''} class="accent-sky-400" />Phone alert when it goes off / on</label>
    </div>`;
}

export function renderTabletInternetCard() {
  const data = view.data;
  const nowMs = data?.now || Date.now();
  let body;
  if (!data) {
    body = `<p class="text-xs text-on-surface-variant font-bold">${view.loading ? 'Checking the family Pi...' : ''}</p>`;
  } else if (!data.configured) {
    body = `<p class="text-xs text-amber-400 font-bold">${escapeHtml(data.error || 'This needs the family Pi (Pi-hole). Is the Pi online?')}</p>`;
  } else {
    body = `
      ${data.error ? `<p class="text-xs text-red-400 font-bold" role="alert">Pi-hole problem: ${escapeHtml(data.error)}</p>` : ''}
      ${(data.skipped || []).length ? `<p class="text-xs text-amber-400 font-bold">Couldn't look up the safe address for: ${escapeHtml(data.skipped.join(', '))}. The Pi will try again.</p>` : ''}
      ${(data.tablets || []).map((t) => tabletRow(t, nowMs)).join('') || '<p class="text-xs text-on-surface-variant font-bold">No tablets yet. Add each kid\'s tablet below.</p>'}
      ${settingsForm(data.settings || {})}
      <div class="flex justify-end"><button id="netguard-save-btn" class="bg-secondary text-on-secondary font-headline text-xs font-black px-5 py-2.5 rounded-xl chunky-btn-sm active:scale-95 ${view.busy ? 'opacity-60' : ''}" ${view.busy ? 'disabled' : ''}>Save tablet settings</button></div>
      ${addTabletForm(data)}
      <details class="text-xs text-on-surface-variant font-bold">
        <summary class="cursor-pointer text-inverse-surface">Set up a tablet (once, on each tablet)</summary>
        <ol class="list-decimal ml-5 mt-2 flex flex-col gap-1">
          <li>Settings › Network &amp; internet › Private DNS: <strong>Off</strong>.</li>
          <li>Settings › Wi-Fi › your network › Edit › Advanced › IP settings: <strong>Static</strong>, DNS 1: <strong>192.168.1.163</strong>, DNS 2: <strong>192.168.1.163</strong>.</li>
          <li>Chrome › Settings › Privacy and security › Use secure DNS: <strong>Off</strong>.</li>
          <li>Open the Little Heroes app on the tablet, tap "Refresh devices" here and add it.</li>
        </ol>
        <p class="mt-2">Apps that are already playing can keep going for a few minutes after the internet goes off. Phone data or another Wi-Fi gets around this, so it only works on home Wi-Fi.</p>
        <button id="netguard-remove-all-btn" class="mt-2 text-red-300 font-headline text-[11px] font-black">Remove all tablet rules from the Pi-hole</button>
      </details>`;
  }
  return `
    <div id="tablet-internet-card" class="bg-surface-container rounded-3xl p-5 border-2 border-sky-500/30 card-shadow flex flex-col gap-3">
      <div>
        <h3 class="font-headline font-black text-base text-inverse-surface flex items-center gap-2"><span class="material-symbols-outlined text-sky-400">router</span>Kids' tablet internet</h3>
        <p class="text-xs text-on-surface-variant font-bold">Through the Pi-hole on the family Pi. YouTube Restricted Mode and SafeSearch all day. Internet goes off when the Bedtime Sanctuary opens in the evening, or at the Bedtime Curfew at the latest. The Little Heroes app keeps working.</p>
      </div>
      ${body}
      ${view.message ? `<p class="text-xs font-bold ${view.error ? 'text-red-400' : 'text-emerald-400'}" role="status">${escapeHtml(view.message)}</p>` : ''}
    </div>`;
}

function currentTablets() {
  return (view.data?.tablets || []).map((t) => {
    const morning = document.querySelector(`[data-netguard-morning="${CSS.escape(t.id)}"]`);
    return { id: t.id, name: t.name, heroId: t.heroId, client: t.client, offAt: curfewFor(t.heroId), onAt: morning?.value || t.onAt, bedtime: t.bedtime };
  });
}

function currentSettings() {
  const s = view.data?.settings || {};
  return {
    youtube: document.getElementById('netguard-youtube')?.value || s.youtube,
    safeSearch: document.getElementById('netguard-safesearch')?.checked ?? s.safeSearch,
    alerts: document.getElementById('netguard-alerts')?.checked ?? s.alerts
  };
}

async function run(action, payload, { busy = 'all', message = '' } = {}) {
  view.busy = busy;
  view.message = '';
  store.notify?.();
  const data = await netGuardRequest(action, payload);
  view.busy = '';
  if (data && (data.configured !== undefined || data.tablets)) {
    const devices = data.devices || view.data?.devices;
    view.data = { ...data, devices };
    view.loadedAt = Date.now();
  }
  view.error = Boolean(data?.error || data?.ok === false);
  view.message = view.error ? '' : message;
  store.notify?.();
  return data;
}

async function load(force = false) {
  if (view.loading || (!force && Date.now() - view.loadedAt < STALE_MS)) return;
  view.loading = true;
  store.notify?.();
  const data = await netGuardRequest('status', { includeDevices: true });
  view.loading = false;
  view.data = data;
  view.loadedAt = Date.now();
  store.notify?.();
  // Keep each tablet's bedtime in step with its kid's Bedtime Curfew.
  if (data?.configured && (data.tablets || []).some((t) => t.offAt !== curfewFor(t.heroId))) {
    const tablets = data.tablets.map((t) => ({ ...t, offAt: curfewFor(t.heroId) }));
    await run('save', { settings: data.settings, tablets });
  }
}

function newTabletId(heroId) {
  return `${String(heroId || 'tablet').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'tablet'}-${Date.now().toString(36).slice(-5)}`;
}

export function bindTabletInternetCard() {
  const card = document.getElementById('tablet-internet-card');
  if (!card) return;
  load();
  card.querySelectorAll('[data-netguard-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-netguard-action');
      const tabletId = btn.getAttribute('data-tablet-id');
      const msg = { off: 'Internet turned off.', on: 'Internet turned on until bedtime.', extend: '15 more minutes.', auto: 'Back to the schedule.' }[action] || '';
      run(action, { tabletId }, { busy: tabletId, message: msg });
    });
  });
  card.querySelectorAll('[data-netguard-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-netguard-remove');
      run('save', { settings: currentSettings(), tablets: currentTablets().filter((t) => t.id !== id) }, { message: 'Tablet removed.' });
    });
  });
  document.getElementById('netguard-save-btn')?.addEventListener('click', () => {
    run('save', { settings: currentSettings(), tablets: currentTablets() }, { message: 'Saved. The Pi-hole is updated.' });
  });
  document.getElementById('netguard-refresh-btn')?.addEventListener('click', () => load(true));
  document.getElementById('netguard-add-btn')?.addEventListener('click', () => {
    const typed = document.getElementById('netguard-add-client')?.value.trim();
    const client = typed || document.getElementById('netguard-add-device')?.value || '';
    const heroId = document.getElementById('netguard-add-hero')?.value || '';
    const hero = heroes().find((h) => h.id === heroId);
    const name = document.getElementById('netguard-add-name')?.value.trim() || `${hero?.name || 'Kid'}'s tablet`;
    if (!client) {
      view.error = true;
      view.message = 'Pick a device or type its IP or MAC address.';
      store.notify?.();
      return;
    }
    const tablet = { id: newTabletId(heroId), name, heroId, client, offAt: curfewFor(heroId), onAt: DEFAULT_MORNING, bedtime: true };
    run('save', { settings: currentSettings(), tablets: [...currentTablets(), tablet] }, { message: `${name} added. YouTube Restricted Mode and SafeSearch are on for it now.` });
  });
  document.getElementById('netguard-remove-all-btn')?.addEventListener('click', () => {
    run('remove-all', {}, { message: 'All tablet rules were removed from the Pi-hole.' });
  });
}

/** Re-read the Pi now (e.g. after a Bedtime Curfew change, which load() then syncs to the Pi). */
export function refreshTabletInternetCard() {
  return load(true);
}

/** Tests only. */
export function _resetTabletInternetCard(data = null) {
  view = { loading: false, loadedAt: data ? Date.now() : 0, data, busy: '', message: '', error: '' };
}
