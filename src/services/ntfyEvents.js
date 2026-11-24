// Parent alert events shared by the server (server/ntfyService.js) and the browser
// (src/services/parentNotifyService.js, for static hosts that post straight to ntfy).
// Messages are built only from this whitelist, so neither path can send arbitrary text.

export const NTFY_EVENTS = {
  task_submitted: {
    title: 'Chore ready to approve',
    tags: 'white_check_mark',
    priority: '3',
    link: '#/approvals',
    message: d => `${d.kidName} finished "${d.title}" and is waiting for your approval.`
  },
  reward_requested: {
    title: 'Reward request',
    tags: 'gift',
    priority: '4',
    link: '#/approvals',
    message: d => `${d.kidName} asked to redeem "${d.title}".`
  },
  boss_defeated: {
    title: 'Boss defeated!',
    tags: 'trophy',
    priority: '2',
    message: d => `${d.kidName} beat ${d.title || 'a boss'} in the brushing battle.`
  },
  // Tablet internet (Pi-hole, server/netGuardService.js). kidName = the tablet's name, title = why.
  tablet_internet_off: {
    title: 'Tablet internet off',
    tags: 'crescent_moon',
    priority: '2',
    message: d => `${d.kidName}'s internet is off${d.title ? ` (${d.title})` : ''}. The Little Heroes app still works.`
  },
  tablet_internet_on: {
    title: 'Tablet internet on',
    tags: 'sunny',
    priority: '2',
    message: d => `${d.kidName}'s internet is back on${d.title ? ` (${d.title})` : ''}.`
  }
};

export const NTFY_EVENT_KINDS = Object.keys(NTFY_EVENTS);

// Tapping an approval alert (or its "Open Action Inbox" button) opens the app at the parent
// Action Inbox. The parent PIN still gates it, so a kid holding the phone can't approve.
// Household data syncs through Firestore, so any host works; the main public site is the default.
// Override with NTFY_APP_URL on the server or VITE_APP_URL in a build ('' turns the link off).
export const DEFAULT_APP_URL = 'https://little-heroes-quest-8842.web.app/';

function approvalLink(appUrl, link) {
  const base = String(appUrl ?? '').trim();
  if (!link || !/^https:\/\/[^\s,]+$/i.test(base)) return '';
  return `${base.replace(/\/?$/, '/')}${link}`;
}

function cleanField(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Build the ntfy request for an event, or null if the event is unknown. */
export function buildNtfyRequest(kind, data = {}, config = {}) {
  const event = typeof kind === 'string' && Object.prototype.hasOwnProperty.call(NTFY_EVENTS, kind) ? NTFY_EVENTS[kind] : null;
  if (!event) return null;
  const fields = { kidName: cleanField(data.kidName, 40) || 'Your hero', title: cleanField(data.title, 80) };
  const headers = { Title: event.title, Tags: event.tags, Priority: event.priority, 'Content-Type': 'text/plain; charset=utf-8' };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  const open = approvalLink(config.appUrl === undefined ? DEFAULT_APP_URL : config.appUrl, event.link);
  if (open) {
    headers.Click = open;
    headers.Actions = `view, Open Action Inbox, ${open}`;
  }
  const url = String(config.url || '').replace(/\/+$/, '');
  return { url: `${url}/${config.topic}`, init: { method: 'POST', headers, body: event.message(fields) } };
}
