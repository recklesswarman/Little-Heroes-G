const STATIC_FILE_HOST_DOMAINS = ['github.io', 'web.app', 'firebaseapp.com'];
const STATIC_HOST_DOMAINS = [...STATIC_FILE_HOST_DOMAINS, 'hosted.app'];

function matchesDomain(hostname, domains) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function isStaticHostingHostname(hostname = '') {
  return matchesDomain(hostname, STATIC_HOST_DOMAINS);
}

// App Hosting (*.hosted.app) runs server.js, which serves /api/gemini/live, so
// only the plain file hosts lack a WebSocket bridge.
export function lacksLiveWebSocketBridge(hostname = '') {
  return matchesDomain(hostname, STATIC_FILE_HOST_DOMAINS);
}
