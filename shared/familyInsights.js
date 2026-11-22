// Family progress summaries shared by the browser, server.js and the Pi's weekly-report job.
//
// Everything here is pure: it takes the app state (the same shape as the store and the
// Firestore households/{code} document) and returns plain data, so the Rex agent tools
// (server/rexAgentService.js), the Parent Portal "Send weekly report" button and the Sunday
// report on the Pi (scripts/pi/weekly-report.mjs) all count things the same way.
//
// Counting rules:
//  - A chore counts once it is submitted (pending) or approved; rejected ones never count.
//  - Reading sessions are the reading/homework chore only. Finishing a picture book in the
//    Picture Book Library is NOT a reading session (Dj's rule), so any log that looks like
//    a picture book is skipped even if it carries a reading task id.

export const READING_TASK_IDS = ['homework', 'homework_reading', 'wp_homework', 'reading'];
export const BRUSH_TASK_IDS = [
  'morning_brush', 'brush_teeth_am', 'wp_morning_teeth', 'brush_teeth', 'teeth_am',
  'bedtime_brush', 'brush_teeth_pm', 'wp_night_teeth', 'sugar_fortress_night_showdown',
  'toothbrush_adventure_battle', 'teeth_pm'
];
export const DEFAULT_TIME_ZONE = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;

const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function cleanText(value, max = 60) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Milliseconds timestamp of a log/history record, or NaN. */
export function recordTime(rec) {
  if (!rec || typeof rec !== 'object') return NaN;
  if (Number.isFinite(rec.timestamp) && rec.timestamp > 1e11) return rec.timestamp;
  for (const key of ['completedAt', 'dateIso', 'approvedAt', 'timestamp', 'date']) {
    const v = rec[key];
    if (typeof v === 'string' && v) {
      const t = Date.parse(v);
      if (Number.isFinite(t)) return t;
    }
  }
  return NaN;
}

/** YYYY-MM-DD for a time in the given time zone. */
export function dayKey(ms, timeZone = DEFAULT_TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export function isPictureBookLog(log) {
  if (!log || typeof log !== 'object') return false;
  if (log.source === 'storyweaver' || log.source === 'picture_book' || log.kind === 'picture_book') return true;
  const text = `${log.zone || ''} ${log.taskTitle || log.title || ''} ${log.taskId || ''}`.toLowerCase();
  return /picture[\s_-]?book|storyweaver|story_library/.test(text);
}

export function isReadingLog(log) {
  return Boolean(log) && READING_TASK_IDS.includes(log.taskId) && !isPictureBookLog(log);
}

export function isCountedLog(log) {
  return Boolean(log) && log.status !== 'rejected';
}

/** The kids in the household (parents and tombstoned heroes left out). */
export function listHeroes(state = {}) {
  const deleted = new Set(arr(state.deletedHeroIds));
  const fromMap = state.heroesMap && typeof state.heroesMap === 'object' ? Object.values(state.heroesMap) : [];
  const source = arr(state.heroes).length ? arr(state.heroes) : fromMap;
  const seen = new Set();
  const kids = source.filter((h) => {
    if (!h || !h.id || deleted.has(h.id) || seen.has(h.id)) return false;
    if (h.role === 'parent' || h.isParent) return false;
    seen.add(h.id);
    return true;
  });
  // The starter "Little Hero" profile (hero_1) is left out once real kids exist.
  const isPlaceholder = (h) => h.id === 'hero_1' && /^little hero$/i.test(String(h.name || '').trim());
  return kids.length > 1 ? kids.filter((h) => !isPlaceholder(h)) : kids;
}

/** One kid's week (default: the 7 days ending at `now`). */
export function summarizeHeroWeek(state = {}, hero = {}, { now = Date.now(), days = 7, timeZone = DEFAULT_TIME_ZONE } = {}) {
  const since = now - days * DAY_MS;
  const inRange = (rec) => {
    const t = recordTime(rec);
    return Number.isFinite(t) && t > since && t <= now;
  };
  const logs = arr(state.taskCompletionLogs).filter((l) => l && l.heroId === hero.id && isCountedLog(l) && inRange(l));

  const choreTitles = new Map();
  const activeDays = new Set();
  let pointsEarned = 0;
  let readingSessions = 0;
  let brushLogs = 0;
  for (const log of logs) {
    activeDays.add(dayKey(recordTime(log), timeZone));
    if (log.status === 'approved') pointsEarned += num(log.pointsAwarded);
    if (isReadingLog(log)) readingSessions += 1;
    if (BRUSH_TASK_IDS.includes(log.taskId)) brushLogs += 1;
    const title = cleanText(log.taskTitle || log.title || log.taskId, 40);
    if (title) choreTitles.set(title, (choreTitles.get(title) || 0) + 1);
  }

  const battles = arr(hero.dentalBattleHistory).filter(inRange);
  const brushSessions = Math.max(brushLogs, battles.length);
  const workouts = arr(state.movementSessionHistory).filter((m) => m && m.heroId === hero.id && inRange(m));
  const workoutMinutes = workouts.reduce((sum, m) => sum + num(m.durationMinutes), 0);

  const pending = arr(state.pendingApprovals).filter((r) => r && r.kidId === hero.id && (r.status || 'pending') === 'pending');
  const topChores = [...choreTitles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, count]) => ({ title, count }));

  return {
    heroId: hero.id,
    name: cleanText(hero.name, 30) || 'Little Hero',
    choresDone: logs.length,
    activeDays: activeDays.size,
    readingSessions,
    brushSessions,
    workouts: workouts.length,
    workoutMinutes,
    pointsEarned,
    pointsBalance: num(hero.points),
    coinsBalance: num(hero.coins),
    streak: num(hero.streak),
    pendingChores: pending.filter((r) => r.type !== 'reward').length,
    pendingRewards: pending.filter((r) => r.type === 'reward').map((r) => cleanText(r.title, 40)).filter(Boolean),
    topChores
  };
}

function plural(n, word, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

/** Text for one kid's section of the weekly report. */
export function formatHeroWeek(s) {
  const lines = [`${s.name}: ${plural(s.choresDone, 'chore')} on ${plural(s.activeDays, 'day')}`];
  lines.push(`  Reading sessions: ${s.readingSessions}  |  Brushing: ${s.brushSessions}  |  Workouts: ${s.workouts}${s.workoutMinutes ? ` (${s.workoutMinutes} min)` : ''}`);
  lines.push(`  Points earned: ${s.pointsEarned} (balance ${s.pointsBalance})${s.streak > 1 ? `  |  Streak: ${s.streak} days` : ''}`);
  if (s.topChores.length) lines.push(`  Most done: ${s.topChores.map((c) => `${c.title} x${c.count}`).join(', ')}`);
  if (s.pendingChores || s.pendingRewards.length) {
    const bits = [];
    if (s.pendingChores) bits.push(plural(s.pendingChores, 'chore'));
    if (s.pendingRewards.length) bits.push(`reward: ${s.pendingRewards.join(', ')}`);
    lines.push(`  Waiting for you: ${bits.join('; ')}`);
  }
  return lines.join('\n');
}

/** The whole Sunday report: { title, message, heroes }. */
export function buildWeeklyReport(state = {}, { now = Date.now(), days = 7, timeZone = DEFAULT_TIME_ZONE } = {}) {
  const heroes = listHeroes(state).map((h) => summarizeHeroWeek(state, h, { now, days, timeZone }));
  const fmt = (ms) => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(ms));
    } catch {
      return new Date(ms).toISOString().slice(5, 10);
    }
  };
  const title = `Little Heroes weekly report (${fmt(now - (days - 1) * DAY_MS)} - ${fmt(now)})`;
  if (!heroes.length) {
    return { title, message: 'No hero profiles found for this household yet.', heroes };
  }
  const total = heroes.reduce((sum, h) => sum + h.choresDone, 0);
  const sections = heroes.map(formatHeroWeek);
  const footer = total === 0
    ? 'A quiet week. Rex is ready when they are!'
    : `${plural(total, 'chore')} done as a family this week. (Picture books are not counted as reading sessions.)`;
  return { title, message: `${sections.join('\n\n')}\n\n${footer}`.slice(0, 3800), heroes };
}

// ── Snapshots for Rex's tools ──────────────────────────────────────────────

/**
 * Is chore `c` on this kid's list today? Chores with `heroIds` are only for those kids,
 * and calendar "get ready" chores (`calendarShowOn`, see shared/calendarPrep.js) only show
 * on their evening.
 */
export function isChoreForHeroToday(c, heroId, today) {
  if (!c) return false;
  if (Array.isArray(c.heroIds) && c.heroIds.length && heroId && !c.heroIds.includes(heroId)) return false;
  if (c.calendarShowOn && today && c.calendarShowOn !== today) return false;
  return true;
}

/** Today's chores for one kid: what is done, waiting for a parent, or still to do. */
export function buildChoreSnapshot(state = {}, heroId, { now = Date.now(), timeZone = DEFAULT_TIME_ZONE } = {}) {
  const today = dayKey(now, timeZone);
  const logs = arr(state.taskCompletionLogs).filter((l) => l && l.heroId === heroId && isCountedLog(l) && dayKey(recordTime(l), timeZone) === today);
  const pending = arr(state.pendingApprovals).filter((r) => r && r.kidId === heroId && (r.status || 'pending') === 'pending');
  const chores = [...arr(state.taskForest), ...arr(state.habitIslands)];
  const seen = new Set();
  return chores
    .filter((c) => c && c.id && !seen.has(c.id) && seen.add(c.id))
    .filter((c) => isChoreForHeroToday(c, heroId, today))
    .slice(0, 30)
    .map((c) => {
      const log = logs.find((l) => l.taskId === c.id);
      const waiting = pending.some((r) => r.taskId === c.id) || log?.status === 'pending';
      return {
        id: String(c.id).slice(0, 60),
        title: cleanText(c.title, 50),
        when: cleanText(c.timeWindow || '', 30),
        points: num(c.points),
        coins: num(c.coins),
        status: waiting ? 'waiting_for_parent' : (log ? 'done' : 'to_do'),
        needsGame: Boolean(c.isAR),
        fromCalendar: Boolean(c.calendarShowOn)
      };
    });
}

/** Points, coins and the parent-set real-life rewards, with what is affordable now. */
export function buildRewardSnapshot(state = {}, hero = {}) {
  const points = num(hero.points);
  const pendingIds = new Set(arr(state.pendingApprovals).filter((r) => r && r.type === 'reward' && r.kidId === hero.id).map((r) => r.rewardId));
  return {
    points,
    coins: num(hero.coins),
    rewards: arr(state.realLifeRewards).filter((r) => r && r.id).slice(0, 30).map((r) => ({
      id: String(r.id).slice(0, 60),
      title: cleanText(r.title, 50),
      costPoints: num(r.costPoints),
      affordable: points >= num(r.costPoints),
      pointsNeeded: Math.max(0, num(r.costPoints) - points),
      alreadyRequested: pendingIds.has(r.id)
    }))
  };
}

/** Compact, size-capped context the client sends to /api/rex/agent. */
export function buildRexAgentContext(state = {}, hero = {}, opts = {}) {
  return {
    chores: buildChoreSnapshot(state, hero.id, opts),
    rewards: buildRewardSnapshot(state, hero),
    week: summarizeHeroWeek(state, hero, opts)
  };
}
