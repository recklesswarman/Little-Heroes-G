import 'dotenv/config';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChatRequest, handleBedtimeStoryRequest, attachGeminiLiveWebSocket, getRequestIp } from './server/geminiService.js';
import { handleStoryIllustrationRequest } from './server/imageGenService.js';

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

app.use(express.json({ limit: '2mb' }));

// Health check endpoint for Cloud Run / App Hosting
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Gemini API Endpoints
app.post('/api/gemini/chat', handleChatRequest);
app.post('/api/gemini/bedtime-story', handleBedtimeStoryRequest);
app.post('/api/rex/bedtime-story', handleBedtimeStoryRequest);

// Voice narration is handled on the client via the Web Speech API in src/services/voiceService.js.

// Bedtime storybook illustration endpoint (Cloudflare Workers AI free image generator)
app.post('/api/story/illustration', handleStoryIllustrationRequest);
app.post('/api/ai/image', handleStoryIllustrationRequest);

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
    } else if (filePath.endsWith('.html')) {
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
