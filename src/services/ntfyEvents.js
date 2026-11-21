// Parent alert events shared by the server (server/ntfyService.js) and the browser
// (src/services/parentNotifyService.js, for static hosts that post straight to ntfy).
// Messages are built only from this whitelist, so neither path can send arbitrary text.

export const NTFY_EVENTS = {
  task_submitted: {
    title: 'Chore ready to approve',
    tags: 'white_check_mark',
    priority: '3',
    message: d => `${d.kidName} finished "${d.title}" and is waiting for your approval.`
  },
  reward_requested: {
    title: 'Reward request',
    tags: 'gift',
    priority: '4',
    message: d => `${d.kidName} asked to redeem "${d.title}".`
  },
  boss_defeated: {
    title: 'Boss defeated!',
    tags: 'trophy',
    priority: '2',
    message: d => `${d.kidName} beat ${d.title || 'a boss'} in the brushing battle.`
  }
};

export const NTFY_EVENT_KINDS = Object.keys(NTFY_EVENTS);

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
  const url = String(config.url || '').replace(/\/+$/, '');
  return { url: `${url}/${config.topic}`, init: { method: 'POST', headers, body: event.message(fields) } };
}
