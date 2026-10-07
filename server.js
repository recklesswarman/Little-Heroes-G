import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleTTSRequest, handleChatRequest, attachGeminiLiveWebSocket } from './server/geminiService.js';
import { handleElevenLabsTTSRequest } from './server/elevenLabsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// Health check endpoint for Cloud Run / App Hosting
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Gemini API Endpoints
app.post('/api/gemini/tts', handleTTSRequest);
app.post('/api/gemini/chat', handleChatRequest);

// ElevenLabs voice endpoint (primary companion voice tier; see voiceService.js)
app.post('/api/elevenlabs/tts', handleElevenLabsTTSRequest);

const distPath = path.join(__dirname, 'dist');

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
