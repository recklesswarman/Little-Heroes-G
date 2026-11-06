const STATIC_HOST_DOMAINS = ['github.io', 'web.app', 'firebaseapp.com', 'hosted.app'];

export function isStaticHostingHostname(hostname = '') {
  return STATIC_HOST_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
