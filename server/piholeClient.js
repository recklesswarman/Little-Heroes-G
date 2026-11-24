// Small client for the Pi-hole v6 REST API (http://127.0.0.1/api on the family Pi).
// Used by server/netGuardService.js and scripts/pi/netguard-undo.mjs.
//
// Password, first one found:
//   PIHOLE_PASSWORD     an app password (Pi-hole > Settings > Web interface / API)
//   PIHOLE_CLI_PW_FILE  Pi-hole's own CLI password file (default /etc/pihole/cli_pw). It is
//                       readable by the "pihole" group (scripts/pi/setup-netguard.sh adds the
//                       app's user) and changes when Pi-hole restarts, so it is re-read on 401.
//                       Sessions made with it can manage groups, clients and lists, which is
//                       all this needs.
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';

const TIMEOUT_MS = 8000;

export function getPiholeConfig(env = process.env) {
  return {
    url: String(env.PIHOLE_URL || 'http://127.0.0.1').trim().replace(/\/+$/, ''),
    password: String(env.PIHOLE_PASSWORD || ''),
    cliPwFile: String(env.PIHOLE_CLI_PW_FILE || '/etc/pihole/cli_pw')
  };
}

function sudoCat(file) {
  return new Promise((resolve) => {
    execFile('sudo', ['-n', 'cat', file], { timeout: 4000 }, (err, stdout) => resolve(err ? '' : String(stdout || '').trim()));
  });
}

export async function readPiholePassword(config) {
  if (config.password) return config.password;
  try {
    const text = (await readFile(config.cliPwFile, 'utf8')).trim();
    if (text) return text;
  } catch {
    // Not in the pihole group yet (takes effect after the Pi restarts): fall back to sudo.
  }
  return sudoCat(config.cliPwFile);
}

export class PiholeError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export function createPiholeClient({ config = getPiholeConfig(), fetchImpl = globalThis.fetch, getPassword = () => readPiholePassword(config) } = {}) {
  let sid = '';
  let sidExpires = 0;

  async function login() {
    const password = await getPassword();
    if (!password) throw new PiholeError('No Pi-hole password available to the app', 401);
    const res = await call('POST', '/api/auth', { password }, false);
    const session = res?.session;
    if (!session?.valid) throw new PiholeError('Pi-hole refused the app password', 401);
    sid = session.sid || '';
    sidExpires = Date.now() + Math.max(30, Number(session.validity) || 300) * 1000 - 15000;
  }

  async function call(method, path, body, authed = true, retried = false) {
    if (authed && (!sid || Date.now() > sidExpires)) await login();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (authed && sid) headers['X-FTL-SID'] = sid;
      res = await fetchImpl(`${config.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    } catch (err) {
      throw new PiholeError(err?.name === 'AbortError' ? 'Pi-hole did not answer in time' : 'Could not reach Pi-hole');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 && authed && !retried) {
      sid = '';
      return call(method, path, body, authed, true);
    }
    const text = await res.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      if (res.status === 404 && method === 'DELETE') return data;
      throw new PiholeError(data?.error?.message || `Pi-hole answered ${res.status}`, res.status);
    }
    const errors = data?.processed?.errors;
    if (Array.isArray(errors) && errors.length) {
      throw new PiholeError(errors.map((e) => e?.error || e?.message || String(e?.item || '')).join('; ') || 'Pi-hole rejected the change', 400);
    }
    return data;
  }

  const enc = encodeURIComponent;
  return {
    async logout() {
      if (!sid) return;
      try { await call('DELETE', '/api/auth'); } catch { /* session ends on its own */ }
      sid = '';
    },
    groups: async () => (await call('GET', '/api/groups'))?.groups || [],
    addGroup: (name, comment) => call('POST', '/api/groups', { name, comment, enabled: true }),
    deleteGroup: (name) => call('DELETE', `/api/groups/${enc(name)}`),
    domains: async () => (await call('GET', '/api/domains'))?.domains || [],
    addDomain: (d) => call('POST', `/api/domains/${d.type}/${d.kind}`, { domain: d.domain, comment: d.comment, groups: d.groups, enabled: true }),
    updateDomain: (d) => call('PUT', `/api/domains/${d.type}/${d.kind}/${enc(d.domain)}`, { type: d.type, kind: d.kind, comment: d.comment, groups: d.groups, enabled: true }),
    deleteDomain: (d) => call('DELETE', `/api/domains/${d.type}/${d.kind}/${enc(d.domain)}`),
    clients: async () => (await call('GET', '/api/clients'))?.clients || [],
    addClient: (client, comment, groups) => call('POST', '/api/clients', { client, comment, groups }),
    updateClient: (client, comment, groups) => call('PUT', `/api/clients/${enc(client)}`, { comment, groups }),
    deleteClient: (client) => call('DELETE', `/api/clients/${enc(client)}`),
    devices: async () => (await call('GET', '/api/network/devices?max_devices=40&max_addresses=3'))?.devices || []
  };
}
