// Parent Admin Portal > Meal Planner tab.
//
// A week at a time: the school's breakfast and lunch (Canterbury Street Magnet by default, from
// MealViewer) plus the family's own meals (dinners, packed lunches, weekend breakfasts).
// Settings: show the school menu, show all school items (not just main dishes) on the fridge
// and here, the "Tomorrow's lunch" line in the 6:30 PM alert, and which school.
// Other apps (a recipe vault) can read and change the same planner through /api/meals/v1
// (docs/meal-planner-api.md). Everything from storage or the network is escaped.
import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { buildMealDays, MEAL_TYPES, MEAL_LABELS, MEAL_EMOJI } from '../../shared/mealPlan.js';
import { addDays, schoolSlugFrom, EXTRA_GROUP_LABELS } from '../../shared/schoolMenu.js';
import { loadSchoolMenu, localDayKey, weekStart } from '../services/schoolMenuService.js';

let weekOffset = 0;
const schoolCache = new Map(); // `${slug}|${from}` -> { menu, at } (menu null = could not load)
const loading = new Set();
const RETRY_MS = 5 * 60 * 1000;

function currentWeek() {
  return addDays(weekStart(localDayKey()), weekOffset * 7);
}

function dayTitle(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const toggle = (id, checked, title, hint) => `
  <label class="flex items-start gap-3 cursor-pointer">
    <input id="${id}" type="checkbox" class="mt-1 w-5 h-5" ${checked ? 'checked' : ''} />
    <span class="text-sm"><strong>${title}</strong><br/><span class="text-xs text-on-surface-variant">${hint}</span></span>
  </label>`;

function renderExtras(extras) {
  if (!extras?.length) return '';
  const groups = new Map();
  for (const e of extras) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group).push(e.name);
  }
  return `<div class="text-[11px] text-on-surface-variant">${[...groups].map(([g, n]) => `<strong>${escapeHtml(EXTRA_GROUP_LABELS[g] || 'More')}:</strong> ${escapeHtml(n.join(', '))}`).join(' · ')}</div>`;
}

function renderMeal(type, meal) {
  const fam = meal.family.map((e) => `
    <div class="flex items-center gap-2 bg-secondary/10 border border-secondary/30 rounded-xl px-2 py-1" data-meal-entry="${escapeHtml(e.id)}">
      <span>${escapeHtml(e.emoji)}</span>
      <span class="flex-1 text-sm font-bold">${escapeHtml(e.title)}${e.replacesSchool ? ' <span class="text-[10px] font-black uppercase text-secondary">instead of school</span>' : ''}${e.source && e.source !== 'app' ? ` <span class="text-[10px] text-on-surface-variant">from ${escapeHtml(e.source)}</span>` : ''}
        ${e.notes ? `<span class="block text-[11px] font-medium text-on-surface-variant">${escapeHtml(e.notes)}</span>` : ''}
        ${e.recipeUrl ? `<a class="block text-[11px] text-secondary underline" href="${escapeHtml(e.recipeUrl)}" target="_blank" rel="noopener noreferrer">Recipe</a>` : ''}</span>
      <button type="button" data-meal-delete="${escapeHtml(e.id)}" class="w-9 h-9 rounded-full hover:bg-error/15 text-error flex items-center justify-center" aria-label="Remove ${escapeHtml(e.title)}">
        <span class="material-symbols-outlined text-base">delete</span></button>
    </div>`).join('');
  const school = meal.school?.main?.length
    ? `<div class="text-sm"><span class="text-[10px] font-black uppercase text-on-surface-variant">School:</span> ${meal.school.main.map((m) => `${escapeHtml(m.emoji)} ${escapeHtml(m.name)}`).join(' <span class="text-on-surface-variant">or</span> ')}</div>${renderExtras(meal.school.extras)}`
    : '';
  return `
    <div class="flex gap-2 items-start" data-meal-type="${type}">
      <span class="text-lg" aria-hidden="true">${MEAL_EMOJI[type]}</span>
      <div class="flex-1 min-w-0 flex flex-col gap-1">
        <div class="text-[11px] font-black uppercase text-secondary">${MEAL_LABELS[type]}</div>
        ${fam}${school}
      </div>
    </div>`;
}

export function renderMealPlannerTab() {
  const plan = store.getMealPlan();
  const s = plan.settings;
  const from = currentWeek();
  const cached = schoolCache.get(`${s.schoolSlug}|${from}`);
  const school = cached?.menu || null;
  const days = buildMealDays({ plan, school, from, days: 7 });
  const dayOptions = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(from, i));
  const status = !s.showSchoolMenu
    ? 'School menu is turned off.'
    : cached ? (school ? `School menu from ${escapeHtml(school.school || s.schoolName)}.` : 'Could not load the school menu. Showing your own meals only.') : 'Loading the school menu…';

  return `
  <section id="meal-planner-tab" class="flex flex-col gap-6 animate-fade-in">
    <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-headline text-xl font-black text-secondary">Meal Planner</h2>
          <p class="text-xs text-on-surface-variant font-medium" id="meal-school-status">${status}</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" data-meal-week="-1" class="bg-surface rounded-xl border-2 border-secondary-container w-11 h-11 flex items-center justify-center" aria-label="Previous week"><span class="material-symbols-outlined">chevron_left</span></button>
          <span class="text-sm font-black min-w-[9rem] text-center">Week of ${escapeHtml(new Date(`${from}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))}</span>
          <button type="button" data-meal-week="1" class="bg-surface rounded-xl border-2 border-secondary-container w-11 h-11 flex items-center justify-center" aria-label="Next week"><span class="material-symbols-outlined">chevron_right</span></button>
          ${weekOffset ? '<button type="button" data-meal-week="0" class="text-xs font-black text-secondary px-3 min-h-[44px]">This week</button>' : ''}
        </div>
      </div>

      <form id="meal-add-form" class="grid grid-cols-1 sm:grid-cols-6 gap-2 bg-surface rounded-2xl border-2 border-secondary-container/60 p-3">
        <select id="meal-add-date" class="sm:col-span-2 bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm font-bold min-h-[44px]" aria-label="Day">
          ${dayOptions.map((d) => `<option value="${d}">${escapeHtml(dayTitle(d))}</option>`).join('')}
        </select>
        <select id="meal-add-type" class="bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm font-bold min-h-[44px]" aria-label="Meal">
          ${MEAL_TYPES.map((t) => `<option value="${t}" ${t === 'dinner' ? 'selected' : ''}>${MEAL_LABELS[t]}</option>`).join('')}
        </select>
        <input id="meal-add-title" type="text" maxlength="80" required placeholder="e.g. Tacos" class="sm:col-span-3 bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm min-h-[44px]" aria-label="What's for this meal" />
        <input id="meal-add-notes" type="text" maxlength="300" placeholder="Notes (optional)" class="sm:col-span-4 bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm min-h-[44px]" aria-label="Notes" />
        <label class="sm:col-span-1 flex items-center gap-2 text-xs font-bold"><input id="meal-add-replaces" type="checkbox" class="w-5 h-5" /> Instead of school</label>
        <button type="submit" class="sm:col-span-1 bg-secondary text-on-secondary font-headline font-black text-xs px-4 rounded-xl min-h-[44px]">Add meal</button>
        <p id="meal-add-msg" class="sm:col-span-6 text-xs font-bold text-error" role="status" aria-live="polite"></p>
      </form>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${days.map((d) => `
          <div class="bg-surface rounded-2xl border-2 ${d.date === localDayKey() ? 'border-secondary' : 'border-secondary-container/60'} p-3 flex flex-col gap-2" data-meal-day="${d.date}">
            <div class="font-headline font-black text-sm">${escapeHtml(dayTitle(d.date))}</div>
            ${Object.keys(d.meals).length
              ? Object.entries(d.meals).map(([t, m]) => renderMeal(t, m)).join('')
              : `<p class="text-xs text-on-surface-variant">${d.noSchool ? '🏠 No school. ' : ''}Nothing planned.</p>`}
          </div>`).join('')}
      </div>
    </div>

    <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-4">
      <h2 class="font-headline text-lg font-black text-secondary">Meal settings</h2>
      ${toggle('meal-show-school', s.showSchoolMenu, 'Show the school menu', 'School breakfast and lunch on the fridge, here and in the evening alert.')}
      ${toggle('meal-show-all', s.showAllSchoolItems, 'Show all school items', 'Off: only the main dishes. On: also sides, veggies, fruit, milk and sauces, on the fridge card and here.')}
      ${toggle('meal-lunch-alert', s.tomorrowLunchAlert, "Tomorrow's lunch in the 6:30 PM alert", `Adds tomorrow's school lunch (or your packed lunch) to the "Get ready for tomorrow" notification.`)}
      <div class="flex flex-col gap-2">
        <div class="font-headline font-black text-sm">School</div>
        <p class="text-xs text-on-surface-variant">Paste the school's MealViewer link (schools.mealviewer.com/school/…). Now: <strong>${escapeHtml(s.schoolName)}</strong></p>
        <div class="flex gap-2">
          <input id="meal-school-input" type="text" maxlength="200" placeholder="https://schools.mealviewer.com/school/CanterburyStreetMagnet" class="flex-1 bg-surface rounded-xl border-2 border-secondary-container px-3 py-2 text-sm min-h-[44px]" />
          <button id="meal-school-save" type="button" class="bg-secondary text-on-secondary font-headline font-black text-xs px-4 rounded-xl min-h-[44px]">Save</button>
        </div>
        <p id="meal-school-msg" class="text-xs font-bold text-error" role="status" aria-live="polite"></p>
      </div>
    </div>

    <div class="bg-surface-container rounded-3xl p-6 border-2 border-secondary-container card-shadow flex flex-col gap-2">
      <h2 class="font-headline text-lg font-black text-secondary">Connect a recipe or meal app</h2>
      <p class="text-xs text-on-surface-variant">Another app can read and change this planner through the Meal Planner API at <code>/api/meals/v1</code> on the Pi (or App Hosting). It needs the API token saved on the server as <code>MEALS_API_TOKEN</code>. Meals it adds show up here and on the fridge, marked with the app's name.</p>
    </div>
  </section>`;
}

async function fetchWeek(slug, from) {
  const key = `${slug}|${from}`;
  if (loading.has(key)) return;
  const hit = schoolCache.get(key);
  if (hit && (hit.menu || Date.now() - hit.at < RETRY_MS)) return;
  loading.add(key);
  try {
    const menu = await loadSchoolMenu({ slug, from, days: 7 });
    schoolCache.set(key, { menu, at: Date.now() });
  } finally {
    loading.delete(key);
  }
  if (document.getElementById('meal-planner-tab')) store.notify();
}

/** Wire the tab. Safe to call when the tab is not on screen (it finds nothing). */
export function bindMealPlannerTab(root = document) {
  const tab = root.querySelector('#meal-planner-tab');
  if (!tab) return;
  const q = (sel) => root.querySelector(sel);
  const refresh = () => store.notify();
  const s = store.getMealPlan().settings;
  if (s.showSchoolMenu) fetchWeek(s.schoolSlug, currentWeek());

  root.querySelectorAll('[data-meal-week]').forEach((btn) => btn.addEventListener('click', () => {
    const v = Number(btn.getAttribute('data-meal-week'));
    weekOffset = v === 0 ? 0 : Math.max(-8, Math.min(8, weekOffset + v));
    refresh();
  }));

  q('#meal-add-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = q('#meal-add-msg');
    try {
      store.saveMealEntry({
        date: q('#meal-add-date')?.value,
        mealType: q('#meal-add-type')?.value,
        title: q('#meal-add-title')?.value || '',
        notes: q('#meal-add-notes')?.value || '',
        replacesSchool: Boolean(q('#meal-add-replaces')?.checked)
      });
      Sound.click();
      refresh();
    } catch (err) {
      if (msg) msg.textContent = err.message === 'title is required' ? 'Type what the meal is first.' : err.message;
    }
  });

  root.querySelectorAll('[data-meal-delete]').forEach((btn) => btn.addEventListener('click', () => {
    store.deleteMealEntry(btn.getAttribute('data-meal-delete'));
    refresh();
  }));

  const bindToggle = (id, key) => q(id)?.addEventListener('change', (e) => {
    store.updateMealSettings({ [key]: Boolean(e.target.checked) });
    Sound.click();
    refresh();
  });
  bindToggle('#meal-show-school', 'showSchoolMenu');
  bindToggle('#meal-show-all', 'showAllSchoolItems');
  bindToggle('#meal-lunch-alert', 'tomorrowLunchAlert');

  q('#meal-school-save')?.addEventListener('click', () => {
    const slug = schoolSlugFrom(q('#meal-school-input')?.value);
    const msg = q('#meal-school-msg');
    if (!slug) {
      if (msg) msg.textContent = 'Paste a link like https://schools.mealviewer.com/school/CanterburyStreetMagnet';
      return;
    }
    store.updateMealSettings({ schoolSlug: slug });
    Sound.click();
    refresh();
  });
}

/** Test hook */
export function _setSchoolMenuForTest(slug, from, menu) {
  schoolCache.set(`${slug}|${from}`, { menu, at: Date.now() });
}
export function _currentWeekForTest() {
  return currentWeek();
}
