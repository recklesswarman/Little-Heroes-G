// Parent alerts through the family Pi's ntfy server (https://ntfy.sh, self-hosted).
// The app calls POST /api/notify with a fixed event kind; the message text is
// built here from a whitelist, so the endpoint can't be used to send arbitrary
// notifications. Parents subscribe to NTFY_TOPIC in the ntfy phone app.
//   NTFY_URL    ntfy base URL       (default http://127.0.0.1:8090, the Pi)
//   NTFY_TOPIC  topic to publish to (default little-heroes; "pi-alerts" is the Pi's own)
//   NTFY_TOKEN  optional access token if the topic is protected
//   NTFY_ENABLED set to "false" to turn alerts off
import { isRateLimited, getRequestIp } from './geminiService.js';

const EVENTS = {
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

export const NTFY_EVENT_KINDS = Object.keys(EVENTS);

export function getNtfyConfig(env = process.env) {
  const topic = String(env.NTFY_TOPIC || 'little-heroes').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'little-heroes';
  return {
    enabled: String(env.NTFY_ENABLED ?? 'true').toLowerCase() !== 'false',
    url: String(env.NTFY_URL || 'http://127.0.0.1:8090').replace(/\/+$/, ''),
    topic,
    token: env.NTFY_TOKEN ? String(env.NTFY_TOKEN) : ''
  };
}

function cleanField(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Build the ntfy request for an event, or null if the event is unknown. */
export function buildNtfyRequest(kind, data = {}, config = getNtfyConfig()) {
  const event = typeof kind === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, kind) ? EVENTS[kind] : null;
  if (!event) return null;
  const fields = { kidName: cleanField(data.kidName, 40) || 'Your hero', title: cleanField(data.title, 80) };
  const headers = { Title: event.title, Tags: event.tags, Priority: event.priority, 'Content-Type': 'text/plain; charset=utf-8' };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  return { url: `${config.url}/${config.topic}`, init: { method: 'POST', headers, body: event.message(fields) } };
}

export async function sendNtfy(kind, data, { config = getNtfyConfig(), fetchImpl = globalThis.fetch } = {}) {
  if (!config.enabled) return { sent: false, reason: 'disabled' };
  const req = buildNtfyRequest(kind, data, config);
  if (!req) return { sent: false, reason: 'unknown-kind' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetchImpl(req.url, { ...req.init, signal: controller.signal });
    return { sent: resp.ok, status: resp.status };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleNotifyRequest(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (typeof body.kind !== 'string' || !NTFY_EVENT_KINDS.includes(body.kind)) {
    return res.status(400).json({ ok: false, error: 'Unknown notification kind.' });
  }
  if (isRateLimited(`ntfy:${getRequestIp(req)}`, 20, 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many notifications.' });
  }
  try {
    const result = await sendNtfy(body.kind, body);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'ntfy is unreachable.' });
  }
}
