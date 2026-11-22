import 'dotenv/config';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChatRequest, handleBedtimeStoryRequest, attachGeminiLiveWebSocket, getRequestIp } from './server/geminiService.js';
import { handleStoryIllustrationRequest } from './server/imageGenService.js';
import { createLocalAiHandlers } from './server/localAiService.js';
import { createApiCors } from './server/corsPolicy.js';
import { createPiRelayHandlers, getPiRelayConfig, RELAY_MAX_AUDIO_BYTES } from './server/piRelayService.js';
import { handleStoryWeaverBooksRequest } from './server/storyweaverService.js';
import { handleNotifyRequest } from './server/ntfyService.js';
import { handleRexAgentRequest } from './server/rexAgentService.js';
import { handleWeeklyReportRequest } from './server/weeklyReportService.js';
import { createRexRelay } from './server/rexAgyRelay.js';
import { calendarService } from './server/calendarService.js';
import { handleFridgeSnapshot } from './server/fridgeService.js';
import { handleVoiceSttRequest, handleVoiceTtsRequest, handleVoiceStatusRequest, MAX_AUDIO_BYTES } from './server/voiceLabService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const staticRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getRequestIp(req)),
  validate: { xForwardedForHeader: false }
});

// Cross-origin access for the family's static sites only (see server/corsPolicy.js).
app.use('/api', createApiCors());

// AI hero agent routes (/api/rex/chat, audio, battle-coach, quest-guide, parent-report,
// proactive) relay to the AGY Cloud Run service (server/rexAgyRelay.js). Mounted before
// express.json() so audio uploads pass through as-is; other /api/rex paths fall through.
const rexLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getRequestIp(req)),
  validate: { xForwardedForHeader: false }
});
app.use('/api/rex', rexLimiter, createRexRelay());

app.use(express.json({ limit: '2mb' }));

// Health check endpoint for Cloud Run / App Hosting
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Gemini API Endpoints
app.post('/api/gemini/chat', handleChatRequest);
app.post('/api/gemini/bedtime-story', handleBedtimeStoryRequest);
app.post('/api/rex/bedtime-story', handleBedtimeStoryRequest);
// Rex with Gemini function calling over the kid's app snapshot (server/rexAgentService.js)
app.post('/api/rex/agent', handleRexAgentRequest);

// Voice narration is handled on the client via the Web Speech API in src/services/voiceService.js.

// Bedtime storybook illustration endpoint (Cloudflare Workers AI free image generator)
app.post('/api/story/illustration', handleStoryIllustrationRequest);
app.post('/api/ai/image', handleStoryIllustrationRequest);

// StoryWeaver picture-book search proxy (CC BY 4.0 books, attribution kept in the view)
app.get('/api/storyweaver/books', handleStoryWeaverBooksRequest);

// Parent alerts via the Pi's ntfy server (NTFY_URL / NTFY_TOPIC, see server/ntfyService.js)
app.post('/api/notify', handleNotifyRequest);
// Parent Portal "Send weekly report now" (the Sunday one runs on the Pi: scripts/pi/weekly-report.mjs)
app.post('/api/report/weekly', handleWeeklyReportRequest);

// Offline voice on the family Pi: Piper text-to-speech + whisper.cpp speech-to-text.
//  - On the Pi itself (PIPER_URL / WHISPER_CPP_URL) the routes call the Pi services directly.
//  - On a hosted server with PI_RELAY_URL + PI_RELAY_TOKEN (Firebase App Hosting), the same
//    routes relay to the Pi over Tailscale Funnel; the token stays on the server.
//  - Otherwise they answer 503 and the client keeps using the browser's Web Speech voice.
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getRequestIp(req)),
  validate: { xForwardedForHeader: false }
});
const rawAudio = (limit) => express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit });

if (getPiRelayConfig()) {
  const relay = createPiRelayHandlers();
  app.get('/api/voice/status', voiceLimiter, relay.handleVoiceStatus);
  app.post('/api/voice/stt', voiceLimiter, rawAudio(RELAY_MAX_AUDIO_BYTES), relay.handleVoiceStt);
  app.post('/api/voice/tts', voiceLimiter, relay.handleVoiceTts);
  app.get('/api/local/status', voiceLimiter, relay.handleLocalStatus);
  app.post('/api/local/tts', voiceLimiter, relay.handleLocalTts);
  app.post('/api/local/stt', voiceLimiter, rawAudio(RELAY_MAX_AUDIO_BYTES), relay.handleLocalStt);
} else {
  // Voice lab page (server/voiceLabService.js)
  app.get('/api/voice/status', handleVoiceStatusRequest);
  app.post('/api/voice/stt', express.raw({ type: ['audio/wav', 'audio/x-wav', 'application/octet-stream'], limit: MAX_AUDIO_BYTES }), handleVoiceSttRequest);
  app.post('/api/voice/tts', handleVoiceTtsRequest);
  // Rex's everyday voice (server/localAiService.js): family network, or the relay token from App Hosting
  const localAi = createLocalAiHandlers();
  app.get('/api/local/status', voiceLimiter, localAi.handleStatus);
  app.post('/api/local/tts', voiceLimiter, localAi.handleTts);
  app.post('/api/local/stt', voiceLimiter, rawAudio(localAi.STT_MAX_BYTES), localAi.handleStt);
}

// Family Google Calendar -> tonight's "get ready" chores (server/calendarService.js). On the Pi
// it reads GOOGLE_CALENDAR_ICS_URL; elsewhere it relays to the Pi. /api/local/calendar is the
// Pi end of that relay (same Tailscale Funnel path as Rex's voice).
app.post('/api/calendar/plan', voiceLimiter, calendarService.handlePlanRequest);
app.post('/api/local/calendar', voiceLimiter, calendarService.handlePlanRequest);
// Fridge Display data for the Pi's kiosk screen (server/fridgeService.js, family network only)
app.get('/api/fridge/snapshot', voiceLimiter, handleFridgeSnapshot);

const distPath = path.join(__dirname, 'dist');

app.use(staticRequestLimiter);

// Route any nested /assets requests to dist/assets (handles relative path requests from deep URLs)
app.use((req, res, next) => {
  const assetsIdx = req.path.indexOf('/assets/');
  if (assetsIdx > 0) {
    const cleanAssetPath = req.path.substring(assetsIdx);
    return res.sendFile(path.join(distPath, cleanAssetPath), (err) => {
      if (err) {
        res.status(404).json({ error: 'Asset not found' });
      }
    });
  }
  next();
});

// Serve static build in production with cache headers
app.use(express.static(distPath, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.includes(path.sep + 'assets' + path.sep)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html') || filePath.endsWith('.json') || path.basename(filePath) === 'sw.js') {
      // The vite-plugin-pwa service worker must never be HTTP-cached, or updates stall.
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Prevent SPA fallback from serving index.html for missing static assets or stale chunks
app.use(['/assets', '/images', '/icons', '/audio', '/hazards', '/bosses', '/pets'], (req, res) => {
  res.status(404).json({ error: 'Asset not found' });
});

app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = http.createServer(app);
attachGeminiLiveWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on port ${PORT}`);
});
