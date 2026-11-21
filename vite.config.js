import 'dotenv/config';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Build version is now generated automatically (package version + git commit),
// replacing the hand-bumped APP_BUILD_VERSION / CACHE_NAME pair. index.html reads
// it through Vite's %VITE_APP_BUILD_VERSION% HTML env replacement, and
// vite-plugin-pwa's precache manifest hashes every file, so the service worker
// updates itself whenever anything in the build changes.
function computeBuildVersion() {
  if (process.env.VITE_APP_BUILD_VERSION) return process.env.VITE_APP_BUILD_VERSION;
  let pkgVersion = '0.0.0';
  try {
    pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version || pkgVersion;
  } catch { /* keep default */ }
  let sha = '';
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { /* not a git checkout */ }
  return `v${pkgVersion}-${sha || Date.now().toString(36)}`;
}
process.env.VITE_APP_BUILD_VERSION = computeBuildVersion();

async function setupGeminiMiddleware(server) {
  let geminiService = null;
  let imageGenService = null;
  try {
    geminiService = await import('./server/geminiService.js');
  } catch (err) {
    console.warn('Gemini server middleware notice:', err.message);
  }
  try {
    imageGenService = await import('./server/imageGenService.js');
  } catch (err) {
    console.warn('ImageGen server middleware notice:', err.message);
  }
  if (!geminiService && !imageGenService) return;

  const { handleChatRequest, handleBedtimeStoryRequest, attachGeminiLiveWebSocket } = geminiService || {};
  const { handleStoryIllustrationRequest } = imageGenService || {};

  const parseJsonBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });

  server.middlewares.use(async (req, res, next) => {
    const url = req.url ? req.url.split('?')[0] : '';
    // Voice narration is handled on the client via the Web Speech API in src/services/voiceService.js.

    if (url === '/api/gemini/chat' && req.method === 'POST') {
      try {
        req.body = await parseJsonBody(req);
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        if (typeof handleChatRequest === 'function') {
          return await handleChatRequest(req, res);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Gemini Chat handler not available' }));
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if ((url === '/api/rex/bedtime-story' || url === '/api/gemini/bedtime-story') && req.method === 'POST') {
      try {
        req.body = await parseJsonBody(req);
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        if (typeof handleBedtimeStoryRequest === 'function') {
          return await handleBedtimeStoryRequest(req, res);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Bedtime story handler not available' }));
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if ((url === '/api/story/illustration' || url === '/api/ai/image') && req.method === 'POST') {
      try {
        req.body = await parseJsonBody(req);
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        if (typeof handleStoryIllustrationRequest === 'function') {
          return await handleStoryIllustrationRequest(req, res);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Story illustration handler not available' }));
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    next();
  });

  if (server.httpServer && typeof attachGeminiLiveWebSocket === 'function') {
    attachGeminiLiveWebSocket(server.httpServer);
  }
}

// Same /api/storyweaver, /api/notify and /api/voice routes server.js exposes, for `npm run dev` / `vite preview`.
async function setupFamilyApiMiddleware(server) {
  let storyweaver = null;
  let voiceLab = null;
  let ntfy = null;
  try {
    ntfy = await import('./server/ntfyService.js');
  } catch (err) {
    console.warn('ntfy middleware notice:', err.message);
  }
  try {
    storyweaver = await import('./server/storyweaverService.js');
  } catch (err) {
    console.warn('StoryWeaver middleware notice:', err.message);
  }
  try {
    voiceLab = await import('./server/voiceLabService.js');
  } catch (err) {
    console.warn('Voice lab middleware notice:', err.message);
  }

  const readRawBody = (req, limit) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const shim = (res) => {
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  };

  server.middlewares.use(async (req, res, next) => {
    const [url, qs = ''] = (req.url || '').split('?');
    try {
      if (storyweaver && url === '/api/storyweaver/books' && req.method === 'GET') {
        shim(res);
        req.query = Object.fromEntries(new URLSearchParams(qs));
        return await storyweaver.handleStoryWeaverBooksRequest(req, res);
      }
      if (ntfy && url === '/api/notify' && req.method === 'POST') {
        shim(res);
        const raw = await readRawBody(req, 8 * 1024);
        req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
        return await ntfy.handleNotifyRequest(req, res);
      }
      if (voiceLab && url === '/api/voice/status' && req.method === 'GET') {
        shim(res);
        return await voiceLab.handleVoiceStatusRequest(req, res);
      }
      if (voiceLab && url === '/api/voice/stt' && req.method === 'POST') {
        shim(res);
        req.body = await readRawBody(req, voiceLab.MAX_AUDIO_BYTES);
        return await voiceLab.handleVoiceSttRequest(req, res);
      }
      if (voiceLab && url === '/api/voice/tts' && req.method === 'POST') {
        shim(res);
        const raw = await readRawBody(req, 64 * 1024);
        req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
        return await voiceLab.handleVoiceTtsRequest(req, res);
      }
    } catch (err) {
      res.statusCode = err.status || 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    next();
  });
}

function geminiServerPlugin() {
  return {
    name: 'gemini-server-plugin',
    async configureServer(server) {
      await setupFamilyApiMiddleware(server);
      await setupGeminiMiddleware(server);
    },
    async configurePreviewServer(server) {
      await setupFamilyApiMiddleware(server);
      await setupGeminiMiddleware(server);
    }
  };
}

// Offline support via vite-plugin-pwa (Workbox generateSW). The app shell (JS,
// CSS, HTML, icons) is precached with content hashes; the large public/ media
// (3D models, audio, images, ~45 MB) is cached on first use instead so the
// first install stays small. Old precaches are removed on activate
// (cleanupOutdatedCaches) and the new worker takes over open tabs at once
// (skipWaiting + clientsClaim).
function pwaPlugin() {
  return VitePWA({
    registerType: 'autoUpdate',
    injectRegister: false, // registered from src/pwa/registerServiceWorker.js
    filename: 'sw.js',
    manifest: false, // keep the hand-written public/manifest.json
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,woff2}', 'icon-*.png', 'manifest.json', 'lottie/*.json'],
      globIgnores: ['**/node_modules/**', 'assets/3d/**'],
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/^\/api\//, /\/voice-lab\.html$/],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      runtimeCaching: [
        {
          // 3D models, sounds and images under public/ -- cache-first so the
          // bathroom / bedtime screens work offline after one online visit.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(?:splinecode|glb|gltf|mp3|wav|ogg|png|jpg|jpeg|webp|svg|gif)$/i.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'lh-media',
            expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: ({ url }) => url.hostname.endsWith('spline.design'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'lh-spline',
            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          // StoryWeaver book covers (CC BY 4.0) so the picture-book shelf shows offline.
          urlPattern: ({ url }) => url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/static.storyweaver.org.in/'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'lh-storyweaver-covers',
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('/api/storyweaver/books'),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'lh-storyweaver-api',
            expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 }
          }
        },
        {
          urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'lh-google-fonts',
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }
      ]
    },
    devOptions: { enabled: false }
  });
}

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const base = process.env.VITE_BASE_PATH || (process.env.TARGET_HOST === 'firebase' ? '/' : (isGitHubActions ? '/Little-Heroes-G/' : '/'));

export default defineConfig({
  plugins: [geminiServerPlugin(), pwaPlugin()],
  base,
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        voiceLab: fileURLToPath(new URL('./voice-lab.html', import.meta.url))
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    open: false
  }
});
