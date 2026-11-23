// Screen checks: the Fridge Display and the kids' main screens, pictured on the Pi after each
// deploy and compared with the last good pictures. Data is fixed (two made-up heroes, a fixed
// clock, no outside network), so a changed picture means the layout changed, not the day's news.
import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'little_heroes_adventure_master_v10';
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const FIXED_TIME = new Date('2026-11-24T16:30:00-05:00'); // a Tuesday afternoon

function hero(id, name, extra = {}) {
  return {
    id, name, role: 'Brave Adventurer', avatar: '', level: 3, xp: 60, xpNext: 150, points: 120, coins: 40, tokens: 40,
    sparks: 15, evolutionSparks: 15, petSparkMap: {}, activePetId: '1', unlockedPetIds: ['1'],
    hasChosenStarterPet: true, streak: 4, completionRate: 90, gameDifficulty: 'medium',
    inventory: ['laser_toothbrush', 'cowl_hero'], equippedWeapon: 'laser_toothbrush', ...extra
  };
}

export function seededState(activeView) {
  const heroes = [hero('hero_1', 'Sky', { age: 7, gradeLevel: '2' }), hero('hero_2', 'River', { age: 4, gradeLevel: 'K' })];
  return {
    isAuthenticated: true,
    isAuthReady: true,
    isHouseholdConfigured: true,
    householdSetupStep: 'ready',
    household: { syncCode: 'SCREEN1' },
    activeView,
    previousView: 'dashboard',
    parentSettings: { voicePromptsEnabled: false },
    heroes,
    selectedHero: { ...heroes[0] }
  };
}

// Each screen: the view to open, an optional address, and something that shows it is drawn.
export const SCREENS = [
  { name: 'fridge', view: 'dashboard', url: '/#fridge', ready: '#fridge-display-root [data-fridge-body]' },
  { name: 'dashboard', view: 'dashboard', ready: '#app *' },
  { name: 'learn-map', view: 'adventures_map', ready: '#app *' },
  { name: 'math-lab', view: 'math_lab', ready: '#app *' },
  { name: 'bedtime', view: 'bedtime_sanctuary', ready: '#app *' },
  { name: 'profile', view: 'profile', ready: '#app *' }
];

async function openScreen(page, screen, errors, baseURL) {
  page.on('pageerror', (err) => errors.push(String(err?.message || err)));
  // Only the app itself and its icon fonts: no weather, pictures or Firebase from outside, and
  // no Pi data, so every run sees the same thing.
  const origin = new URL(baseURL || 'http://127.0.0.1:3000').origin;
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (FONT_HOSTS.test(url)) return route.continue();
    if (!url.startsWith(origin)) return route.abort();
    if (/\/api\//.test(new URL(url).pathname)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    return route.continue();
  });
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(([key, state]) => {
    try { localStorage.setItem(key, state); } catch {}
    try { window.speechSynthesis && (window.speechSynthesis.speak = () => {}); } catch {}
  }, [STORAGE_KEY, JSON.stringify(seededState(screen.view))]);
  await page.goto(screen.url || '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(screen.ready, { timeout: 20_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
}

for (const screen of SCREENS) {
  test(screen.name, async ({ page, baseURL }) => {
    const errors = [];
    await openScreen(page, screen, errors, baseURL);
    // A real break: the app crashed or drew nothing.
    const text = (await page.locator('#app').innerText().catch(() => '')).trim();
    expect(text.length, `${screen.name} drew no words`).toBeGreaterThan(20);
    expect(await page.locator('text=/Something went wrong|Uncaught|is not defined/i').count(), `${screen.name} shows an error`).toBe(0);
    expect(errors, `${screen.name} script errors`).toEqual([]);
    // A layout change: compared with the last good picture.
    await expect(page).toHaveScreenshot(`${screen.name}-${test.info().project.name}.png`, { fullPage: false });
  });
}
