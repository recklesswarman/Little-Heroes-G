// Weekly parent report: POST /api/report/weekly
//
// The Parent Portal's "Send weekly report now" button posts the per-kid numbers it
// computed with shared/familyInsights.js. The text is rebuilt here from those numbers only
// (names and titles are cleaned and capped), so the route can't be used to push arbitrary
// messages, then published to the family ntfy topic with the server-side token.
// The automatic Sunday report runs on the Pi (scripts/pi/weekly-report.mjs) and uses the
// same builder and sender.
import { getRequestIp, isRateLimited } from './geminiService.js';
import { getNtfyConfig } from './ntfyService.js';
import { formatHeroWeek, DEFAULT_TIME_ZONE } from '../shared/familyInsights.js';

function clip(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
const n = (v) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.max(0, Math.min(x, 100000)) : 0;
};

export function sanitizeHeroSummary(raw = {}) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    name: clip(s.name, 30) || 'Little Hero',
    choresDone: n(s.choresDone),
    activeDays: Math.min(7, n(s.activeDays)),
    readingSessions: n(s.readingSessions),
    brushSessions: n(s.brushSessions),
    workouts: n(s.workouts),
    workoutMinutes: n(s.workoutMinutes),
    pointsEarned: n(s.pointsEarned),
    pointsBalance: n(s.pointsBalance),
    streak: n(s.streak),
    pendingChores: n(s.pendingChores),
    pendingRewards: (Array.isArray(s.pendingRewards) ? s.pendingRewards : []).slice(0, 5).map((t) => clip(t, 40)).filter(Boolean),
    topChores: (Array.isArray(s.topChores) ? s.topChores : []).slice(0, 3).map((c) => ({ title: clip(c?.title, 40), count: n(c?.count) })).filter((c) => c.title)
  };
}

export function buildReportFromSummaries(heroes = [], { now = Date.now(), timeZone = DEFAULT_TIME_ZONE } = {}) {
  const list = (Array.isArray(heroes) ? heroes : []).slice(0, 8).map(sanitizeHeroSummary);
  const date = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(now));
  const title = `Little Heroes weekly report (week ending ${date})`;
  if (!list.length) return { title, message: 'No hero profiles found for this household yet.' };
  const total = list.reduce((sum, h) => sum + h.choresDone, 0);
  const footer = total === 0
    ? 'A quiet week. Rex is ready when they are!'
    : `${total} chore${total === 1 ? '' : 's'} done as a family this week. (Picture books are not counted as reading sessions.)`;
  return { title, message: `${list.map(formatHeroWeek).join('\n\n')}\n\n${footer}`.slice(0, 3800) };
}

/** Publish a { title, message } report to the family ntfy topic. */
export async function sendReportToNtfy(report, { config = getNtfyConfig(), fetchImpl = globalThis.fetch } = {}) {
  if (!config.enabled) return { sent: false, reason: 'disabled' };
  const headers = {
    Title: clip(report.title, 120) || 'Little Heroes weekly report',
    Tags: 'bar_chart,t-rex',
    Priority: '3',
    'Content-Type': 'text/plain; charset=utf-8'
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetchImpl(`${config.url}/${config.topic}`, { method: 'POST', headers, body: String(report.message || ''), signal: controller.signal });
    return { sent: resp.ok, status: resp.status };
  } finally {
    clearTimeout(timer);
  }
}

export function createWeeklyReportHandler({ send = sendReportToNtfy } = {}) {
  return async function handleWeeklyReportRequest(req, res) {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (!Array.isArray(body.heroes)) return res.status(400).json({ ok: false, error: 'heroes is required.' });
    if (isRateLimited(`weekly-report:${getRequestIp(req)}`, 3, 60_000)) {
      return res.status(429).json({ ok: false, error: 'Too many reports, try again in a minute.' });
    }
    const report = buildReportFromSummaries(body.heroes);
    if (body.preview === true) return res.json({ ok: true, sent: false, ...report });
    try {
      const result = await send(report);
      return res.status(200).json({ ok: true, ...result, title: report.title });
    } catch {
      return res.status(502).json({ ok: false, error: 'ntfy is unreachable.' });
    }
  };
}

export const handleWeeklyReportRequest = createWeeklyReportHandler();
