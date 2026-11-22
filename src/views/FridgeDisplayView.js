// Fridge Display: a big, read-only family screen for the monitor on the Pi (#fridge).
//
// Shows each kid's chores for today (done / waiting for a parent / to do), streaks and stars,
// this week's family challenge and what is coming up on the family calendar. It refreshes
// itself every minute, keeps the screen awake, and dims overnight (8:30 PM to 6 AM).
//
// Data: on the Pi it reads GET /api/fridge/snapshot (server/fridgeService.js), which works
// without anyone signing in on the kiosk browser. On any other device that has joined the
// household it builds the same snapshot from its own store (shared/fridgeSnapshot.js).
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { serverApiUrl } from '../services/serverApi.js';
import { buildFridgeSnapshot } from '../../shared/fridgeSnapshot.js';
import { getCurrentWeeklyChallenge } from '../data/hygieneBossesData.js';
import { getLastCalendarPlan, refreshFamilyCalendar } from '../services/familyCalendarService.js';

const REFRESH_MS = 60 * 1000;
const CLOCK_MS = 15 * 1000;
const NIGHT_START = 20 * 60 + 30; // 8:30 PM
const NIGHT_END = 6 * 60; // 6:00 AM

let refreshTimer = null;
let clockTimer = null;
let wakeLock = null;
let lastSnapshot = null;
let lastSource = '';

const CAL_VIEW_KEY = 'lh-fridge-calendar-view';
/** 'week' or 'month', remembered on this screen. */
export function getCalendarView() {
  try {
    return globalThis.localStorage?.getItem(CAL_VIEW_KEY) === 'month' ? 'month' : 'week';
  } catch {
    return 'week';
  }
}
export function setCalendarView(view) {
  try {
    globalThis.localStorage?.setItem(CAL_VIEW_KEY, view === 'month' ? 'month' : 'week');
  } catch {}
}

export const FRIDGE_VIEW_NAMES = ['fridge', 'fridge_display', 'fridge-display', 'kiosk'];

export function isNightTime(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= NIGHT_START || minutes < NIGHT_END;
}

function dayLabel(dayKey, todayKey) {
  if (dayKey === todayKey) return 'Today';
  const [y, m, d] = dayKey.split('-').map(Number);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  if (diff === 1) return 'Tomorrow';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (diff > 1 && diff < 7) return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Emoji, not icon-font names, so the board still reads right if the icon font can't load.
const STATUS_STYLE = {
  done: { icon: '✅', cls: 'text-emerald-300', row: 'bg-emerald-500/15 border-emerald-400/40 line-through decoration-emerald-300/60' },
  waiting_for_parent: { icon: '⏳', cls: 'text-amber-300', row: 'bg-amber-500/15 border-amber-400/40' },
  to_do: { icon: '⬜', cls: 'text-slate-400', row: 'bg-slate-800/70 border-slate-700' }
};

function renderHero(hero) {
  const pct = hero.total ? Math.round((hero.done / hero.total) * 100) : 0;
  const avatar = hero.avatar
    ? `<img src="${escapeHtml(hero.avatar)}" alt="" class="w-16 h-16 rounded-2xl object-cover border-2 border-slate-600" referrerpolicy="no-referrer">`
    : `<div class="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center text-4xl">🦸</div>`;
  const chores = hero.chores.length
    ? hero.chores.map((c) => {
      const s = STATUS_STYLE[c.status] || STATUS_STYLE.to_do;
      return `
        <li class="flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${s.row}" data-status="${escapeHtml(c.status)}">
          <span class="text-3xl leading-none ${s.cls}" aria-hidden="true">${s.icon}</span>
          <span class="flex-1 text-xl font-bold text-white leading-tight">${escapeHtml(c.title)}${c.fromCalendar ? ' <span class="text-sm" title="From the family calendar">📅</span>' : ''}</span>
          ${c.when ? `<span class="text-xs font-black uppercase text-slate-400">${escapeHtml(c.when)}</span>` : ''}
        </li>`;
    }).join('')
    : '<li class="text-lg text-slate-400 font-bold px-2">No chores today. Free play!</li>';
  return `
    <section class="fridge-hero flex flex-col gap-3 bg-slate-900/80 rounded-3xl border-2 border-slate-700 p-4 min-w-0" data-fridge-hero="${escapeHtml(hero.id)}">
      <header class="flex items-center gap-3">
        ${avatar}
        <div class="flex-1 min-w-0">
          <h2 class="font-headline text-3xl font-black text-white truncate">${escapeHtml(hero.name)}</h2>
          <div class="flex flex-wrap gap-3 text-lg font-black">
            <span class="text-orange-300" title="Streak">🔥 ${hero.streak}</span>
            <span class="text-amber-300" title="Stars">⭐ ${hero.points}</span>
            <span class="text-yellow-200" title="Coins">🪙 ${hero.coins}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-4xl font-black text-emerald-300">${hero.done}<span class="text-2xl text-slate-400">/${hero.total}</span></div>
          ${hero.waiting ? `<div class="text-xs font-black uppercase text-amber-300">${hero.waiting} waiting</div>` : ''}
        </div>
      </header>
      <div class="h-3 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-300" style="width:${pct}%"></div></div>
      <ul class="flex flex-col gap-2">${chores}</ul>
    </section>`;
}

function renderEvents(snapshot) {
  if (!snapshot.events.length) {
    return snapshot.calendarConfigured
      ? '<p class="text-lg text-slate-400 font-bold">Nothing on the calendar this week.</p>'
      : '<p class="text-base text-slate-500 font-bold">Add your Google Calendar on the Pi to see the week here.</p>';
  }
  return `<ul class="flex flex-col gap-2">${snapshot.events.map((e) => `
    <li class="flex items-center gap-3 rounded-2xl bg-slate-800/70 border border-slate-700 px-3 py-2">
      <span class="text-3xl">${escapeHtml(e.emoji)}</span>
      <div class="flex-1 min-w-0">
        <div class="text-lg font-black text-white truncate">${escapeHtml(e.title)}</div>
        <div class="text-sm font-bold text-slate-400">${escapeHtml(dayLabel(e.day, snapshot.today))}${e.time ? ` · ${escapeHtml(e.time)}` : ''}${e.who ? ` · ${escapeHtml(e.who)}` : ''}</div>
      </div>
    </li>`).join('')}</ul>`;
}

function renderCalendarSwitch(view) {
  const btn = (v, label) => `<button type="button" data-fridge-cal-view="${v}" aria-pressed="${view === v}"
      class="px-4 py-1.5 rounded-full text-base font-black ${view === v ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}">${label}</button>`;
  return `<div class="flex rounded-full bg-slate-800 border border-slate-700 p-1" role="group" aria-label="Calendar view">${btn('week', 'Week')}${btn('month', 'Month')}</div>`;
}

const DAY_MS = 86400000;
const keyToUtc = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const utcToKey = (t) => new Date(t).toISOString().slice(0, 10);

/** Month grid: 6 weeks, Sunday first, up to 3 events a day plus "+N more". */
export function renderMonthGrid(snapshot) {
  const m = snapshot.month;
  if (!m) {
    return snapshot.calendarConfigured
      ? '<p class="text-lg text-slate-400 font-bold">The month view needs the Pi to update. Try again in a minute.</p>'
      : '<p class="text-base text-slate-500 font-bold">Add your Google Calendar on the Pi to see the month here.</p>';
  }
  const byDay = new Map();
  for (const e of m.events) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const start = keyToUtc(m.start);
  const monthName = new Date(keyToUtc(`${m.month}-01`)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const heads = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="text-center text-xs font-black uppercase text-slate-400">${d}</div>`).join('');
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const key = utcToKey(start + i * DAY_MS);
    const inMonth = key.slice(0, 7) === m.month;
    const isToday = key === snapshot.today;
    const past = key < snapshot.today;
    const list = byDay.get(key) || [];
    const chips = list.slice(0, 3).map((e) => `<div class="truncate text-[11px] leading-tight font-bold text-slate-100" title="${escapeHtml(e.title)}">${escapeHtml(e.emoji)} ${escapeHtml(e.time ? `${e.time} ` : '')}${escapeHtml(e.title)}</div>`).join('');
    const more = list.length > 3 ? `<div class="text-[11px] font-black text-cyan-300">+${list.length - 3} more</div>` : '';
    cells.push(`<div class="min-w-0 min-h-[4.5rem] rounded-lg p-1 border ${isToday ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-800 bg-slate-800/50'} ${inMonth ? '' : 'opacity-40'} ${past && !isToday ? 'opacity-60' : ''}">
      <div class="text-xs font-black ${isToday ? 'text-cyan-200' : 'text-slate-300'}">${Number(key.slice(8))}</div>${chips}${more}</div>`);
  }
  return `<div class="text-lg font-black text-slate-200 mb-2">${escapeHtml(monthName)}</div>
    <div class="grid grid-cols-7 gap-1" data-fridge-month>${heads}${cells.join('')}</div>`;
}

export function renderFridgeBody(snapshot, { now = new Date(), calendarView = getCalendarView() } = {}) {
  if (!snapshot) {
    return `
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
        <div class="text-7xl">🦖</div>
        <h1 class="font-headline text-4xl font-black text-white">Fridge Display</h1>
        <p class="text-xl text-slate-300 font-bold max-w-xl">Waiting for family data. On the Pi, set HOUSEHOLD_CODES in ~/apps/little-heroes.env. On other screens, join this device to your household first.</p>
      </div>`;
  }
  const night = isNightTime(now);
  const tomorrowEvents = snapshot.events.filter((e) => e.day > snapshot.today).slice(0, 3);
  if (night) {
    return `
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-6 p-8 opacity-80">
        <div class="text-6xl">🌙</div>
        <div class="fridge-clock font-headline text-8xl font-black text-slate-200" data-fridge-clock></div>
        <p class="text-3xl font-black text-slate-300">Goodnight, heroes! Rex is sleeping too.</p>
        ${tomorrowEvents.length ? `<div class="max-w-xl w-full text-left">${renderEvents({ ...snapshot, events: tomorrowEvents })}</div>` : ''}
      </div>`;
  }
  const cols = Math.min(Math.max(snapshot.heroes.length, 1), 3);
  const monthView = calendarView === 'month';
  return `
    <div class="flex-1 grid gap-4 p-4 min-h-0" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr)) ${monthView ? 'minmax(420px, 1.8fr)' : 'minmax(280px, 0.8fr)'};">
      ${snapshot.heroes.map(renderHero).join('') || '<p class="text-2xl text-slate-300 font-bold">No hero profiles yet.</p>'}
      <aside class="flex flex-col gap-4 min-w-0">
        <section class="bg-slate-900/80 rounded-3xl border-2 border-slate-700 p-4">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h3 class="font-headline text-2xl font-black text-white">📅 Family calendar</h3>
            ${renderCalendarSwitch(monthView ? 'month' : 'week')}
          </div>
          ${monthView ? renderMonthGrid(snapshot) : renderEvents(snapshot)}
        </section>
        ${snapshot.challenge ? `
        <section class="bg-slate-900/80 rounded-3xl border-2 border-cyan-500/40 p-4">
          <h3 class="font-headline text-2xl font-black text-cyan-200 mb-1">🛡️ ${escapeHtml(snapshot.challenge.title)}</h3>
          <p class="text-lg font-bold text-slate-300">${escapeHtml(snapshot.challenge.description)}</p>
        </section>` : ''}
        <section class="bg-slate-900/80 rounded-3xl border-2 border-emerald-500/40 p-4 text-center">
          <div class="text-lg font-black uppercase text-emerald-200">Family chores today</div>
          <div class="text-6xl font-black text-emerald-300">${snapshot.familyDone}<span class="text-3xl text-slate-400">/${snapshot.familyTotal}</span></div>
        </section>
      </aside>
    </div>`;
}

export function renderFridgeDisplayView() {
  return `
    <div id="fridge-display-root" class="fixed inset-0 z-[200] bg-slate-950 text-white flex flex-col font-body select-none overflow-hidden">
      <header class="flex items-center justify-between px-6 pt-4">
        <div class="flex items-baseline gap-4">
          <span class="fridge-clock font-headline text-5xl font-black" data-fridge-clock></span>
          <span class="text-2xl font-bold text-slate-300" data-fridge-date></span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-bold text-slate-500" data-fridge-updated></span>
          <button type="button" data-fridge-exit class="w-11 h-11 rounded-full bg-slate-800/60 text-slate-400 flex items-center justify-center" aria-label="Leave fridge display">
            <span class="text-xl font-black" aria-hidden="true">✕</span>
          </button>
        </div>
      </header>
      <div class="flex-1 flex flex-col min-h-0" data-fridge-body>${renderFridgeBody(lastSnapshot)}</div>
    </div>`;
}

function updateClock(root) {
  const now = new Date();
  root.querySelectorAll('[data-fridge-clock]').forEach((el) => {
    el.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  });
  const date = root.querySelector('[data-fridge-date]');
  if (date) date.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  root.dataset.night = String(isNightTime(now));
}

/** Snapshot from the Pi, else from this device's own household data, else null. */
export async function loadFridgeSnapshot({ fetchImpl = globalThis.fetch } = {}) {
  try {
    const res = await fetchImpl(serverApiUrl('/api/fridge/snapshot'), { cache: 'no-store' });
    if (res.ok) {
      const body = await res.json();
      if (body && Array.isArray(body.heroes)) {
        lastSource = 'pi';
        return body;
      }
    }
  } catch {}
  const state = store.getState();
  if (!state.isHouseholdConfigured && !(state.heroes || []).length) return null;
  const plan = getLastCalendarPlan() || await refreshFamilyCalendar();
  lastSource = 'device';
  return buildFridgeSnapshot(state, { calendar: plan, challenge: getCurrentWeeklyChallenge(new Date())?.challenge || null });
}

async function requestWakeLock() {
  try {
    if (navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    }
  } catch {
    wakeLock = null;
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') requestWakeLock();
}

export function stopFridgeDisplay() {
  clearInterval(refreshTimer);
  clearInterval(clockTimer);
  refreshTimer = null;
  clockTimer = null;
  try { wakeLock?.release?.(); } catch {}
  wakeLock = null;
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
}

export function attachFridgeDisplayListeners() {
  const root = document.getElementById('fridge-display-root');
  if (!root) return;
  const paint = async () => {
    const snapshot = await loadFridgeSnapshot();
    if (snapshot) lastSnapshot = snapshot;
    const body = root.querySelector('[data-fridge-body]');
    if (body) body.innerHTML = renderFridgeBody(lastSnapshot);
    const updated = root.querySelector('[data-fridge-updated]');
    if (updated && lastSnapshot) updated.textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${lastSource === 'device' ? '' : ' · Pi'}${lastSnapshot.stale ? ' (offline)' : ''}`;
    updateClock(root);
  };
  if (!root.dataset.calSwitch) {
    root.dataset.calSwitch = '1';
    root.addEventListener('click', (ev) => {
      const btn = ev.target?.closest?.('[data-fridge-cal-view]');
      if (!btn) return;
      setCalendarView(btn.dataset.fridgeCalView);
      const body = root.querySelector('[data-fridge-body]');
      if (body) body.innerHTML = renderFridgeBody(lastSnapshot);
      updateClock(root);
    });
  }
  stopFridgeDisplay();
  paint();
  updateClock(root);
  refreshTimer = setInterval(paint, REFRESH_MS);
  clockTimer = setInterval(() => {
    const wasNight = root.dataset.night;
    updateClock(root);
    if (wasNight !== root.dataset.night) {
      const body = root.querySelector('[data-fridge-body]');
      if (body) body.innerHTML = renderFridgeBody(lastSnapshot);
      updateClock(root);
    }
  }, CLOCK_MS);
  requestWakeLock();
  document.addEventListener('visibilitychange', onVisibility);
  root.querySelector('[data-fridge-exit]')?.addEventListener('click', () => {
    stopFridgeDisplay();
    try { if (location.hash.replace(/^#\/?/, '').startsWith('fridge')) history.replaceState(null, '', location.pathname + location.search); } catch {}
    store.navigate('dashboard');
  });
}
