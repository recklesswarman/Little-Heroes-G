import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleTTSRequest, handleChatRequest, attachGeminiLiveWebSocket } from './server/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint for Cloud Run / App Hosting
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Gemini API Endpoints
app.post('/api/gemini/tts', handleTTSRequest);
app.post('/api/gemini/chat', handleChatRequest);

// Serve static build in production with SPA fallback
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
attachGeminiLiveWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on port ${PORT}`);
});
