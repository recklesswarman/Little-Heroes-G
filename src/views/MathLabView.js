// Math Lab: free PhET math sims (shared/phetSims.js) to play with numbers hands-on, next to Rex's
// Number Dash quiz. On the Pi the sims open from its own copies (/phet/, works offline); other
// devices open them from phet.colorado.edu.
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { Sound } from '../audio/sfx.js';
import { serverApiUrl, getServerApiBase } from '../services/serverApi.js';
import { PHET_SIMS, PHET_CREDIT, phetSimUrl } from '../../shared/phetSims.js';

const lab = { open: '', localIds: [], checked: false };

async function checkLocalSims() {
  if (lab.checked) return;
  lab.checked = true;
  try {
    const res = await fetch(serverApiUrl('/api/phet/sims'), { signal: AbortSignal.timeout(4000) });
    const type = res.headers?.get?.('content-type') || '';
    if (!res.ok || !type.includes('json')) return;
    const data = await res.json();
    lab.localIds = Array.isArray(data?.local) ? data.local.filter((id) => PHET_SIMS.some((s) => s.id === id)) : [];
    if (lab.localIds.length) store.notify();
  } catch {
    // No Pi copies here: the sims open from PhET's site.
  }
}

/** Kindergarten sims first for a younger kid, the rest after. */
function orderedSims(hero) {
  const young = Number(hero?.age) <= 5 || hero?.difficulty === 'easy';
  return young ? [...PHET_SIMS].sort((a, b) => Number(b.grade.startsWith('K')) - Number(a.grade.startsWith('K'))) : PHET_SIMS;
}

export function renderMathLabView() {
  const hero = store.getState().selectedHero || {};
  const sim = PHET_SIMS.find((s) => s.id === lab.open);
  const url = sim ? phetSimUrl(sim.id, { localIds: lab.localIds, base: getServerApiBase() }) : '';
  return `
    <div class="p-4 sm:p-6 flex flex-col gap-4" data-math-lab>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="font-headline text-2xl sm:text-3xl font-black text-white">🧪 Math Lab</h1>
          <p class="text-sm font-bold text-slate-300">Play with numbers, then race in Rex's Number Dash!</p>
        </div>
        <button type="button" id="math-lab-back-btn" class="px-4 py-2 rounded-2xl bg-surface-container text-on-surface-variant font-black text-xs min-h-[44px] active:scale-95">${sim ? '← All games' : '← Home'}</button>
      </div>
      ${sim ? `
      <div class="rounded-3xl overflow-hidden border-3 border-[#34d399]/60 bg-black" style="height:min(75vh,720px)">
        <iframe src="${escapeHtml(url)}" title="${escapeHtml(sim.title)}" class="w-full h-full" allow="fullscreen" referrerpolicy="no-referrer" data-math-lab-frame></iframe>
      </div>` : `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${orderedSims(hero).map((s) => `
        <button type="button" data-math-lab-sim="${s.id}" class="rounded-3xl p-4 bg-[#0f2334] border-2 border-[#34d399]/50 text-left flex items-center gap-3 min-h-[84px] active:scale-[0.98] transition-transform">
          <span class="text-4xl" aria-hidden="true">${s.emoji}</span>
          <span class="flex-1">
            <span class="kid-read block font-headline text-lg font-black text-white">${escapeHtml(s.title)}</span>
            <span class="block text-xs font-bold text-slate-300">${escapeHtml(s.blurb)}</span>
          </span>
          <span class="text-[10px] font-black text-[#34d399] bg-[#34d399]/15 px-2 py-0.5 rounded-full">${escapeHtml(s.grade)}</span>
        </button>`).join('')}
      </div>
      <button type="button" id="math-lab-dash-btn" class="self-start px-4 py-3 rounded-2xl bg-[#34d399] text-slate-950 font-black text-sm min-h-[48px] active:scale-95">⚡ Race in Number Dash</button>`}
      <p class="text-[10px] font-bold text-slate-400">Games: ${escapeHtml(PHET_CREDIT)}.${lab.localIds.length ? ' Playing from the family computer.' : ''}</p>
    </div>`;
}

export function attachMathLabListeners() {
  checkLocalSims();
  document.getElementById('math-lab-back-btn')?.addEventListener('click', () => {
    Sound.click();
    if (lab.open) {
      lab.open = '';
      store.notify();
    } else {
      store.navigate('dashboard');
    }
  });
  document.querySelectorAll('[data-math-lab-sim]').forEach((btn) => btn.addEventListener('click', () => {
    Sound.bloop();
    lab.open = btn.getAttribute('data-math-lab-sim');
    store.notify();
  }));
  document.getElementById('math-lab-dash-btn')?.addEventListener('click', () => {
    Sound.bloop();
    store.navigate('world_map');
  });
}
