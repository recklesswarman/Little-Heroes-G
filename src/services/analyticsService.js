// Cookie-free page-view analytics with the family's self-hosted Umami on the Pi.
// Only Umami's tracker script and its /api/send endpoint are reachable from the
// internet (Tailscale Funnel paths); the dashboard and login stay private.
//   VITE_UMAMI_HOST        e.g. https://meshlink.tail9d175a.ts.net/umami
//   VITE_UMAMI_WEBSITE_ID  the website's id from the Umami dashboard (not a secret)
// Nothing loads when either is missing, or when the browser sends Do Not Track.
const TRACKED_DOMAINS = [
  'recklesswarman.github.io',
  'little-heroes-quest-8842.web.app',
  'little-heroes-quest-8842.firebaseapp.com',
  'littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app'
];

export function getUmamiConfig(env = null) {
  const read = (name) => {
    if (env) return String(env[name] ?? '').trim();
    try { return String(import.meta.env?.[name] ?? '').trim(); } catch { return ''; }
  };
  const host = read('VITE_UMAMI_HOST').replace(/\/+$/, '');
  const websiteId = read('VITE_UMAMI_WEBSITE_ID');
  if (!/^https:\/\//i.test(host) || !/^[0-9a-f-]{36}$/i.test(websiteId)) return null;
  // Extra hostnames (e.g. the Pi's own name) come from the Pi's build env, not the repo.
  const extraDomains = read('VITE_UMAMI_EXTRA_DOMAINS').split(',').map((d) => d.trim()).filter((d) => /^[a-z0-9.-]+$/i.test(d));
  return { host, websiteId, extraDomains };
}

export function initAnalytics(config = getUmamiConfig(), doc = (typeof document !== 'undefined' ? document : null)) {
  if (!config || !doc?.head || doc.getElementById('lh-umami')) return false;
  const script = doc.createElement('script');
  script.id = 'lh-umami';
  script.defer = true;
  script.src = `${config.host}/script.js`;
  script.setAttribute('data-website-id', config.websiteId);
  script.setAttribute('data-host-url', config.host);
  script.setAttribute('data-domains', [...TRACKED_DOMAINS, ...(config.extraDomains || [])].join(','));
  script.setAttribute('data-do-not-track', 'true');
  doc.head.appendChild(script);
  return true;
}
