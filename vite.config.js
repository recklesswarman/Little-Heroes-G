import 'dotenv/config';
import { defineConfig } from 'vite';

async function setupGeminiMiddleware(server) {
  let geminiService = null;
  let elevenLabsService = null;
  let imageGenService = null;
  try {
    geminiService = await import('./server/geminiService.js');
  } catch (err) {
    console.warn('Gemini server middleware notice:', err.message);
  }
  try {
    elevenLabsService = await import('./server/elevenLabsService.js');
  } catch (err) {
    console.warn('ElevenLabs server middleware notice:', err.message);
  }
  try {
    imageGenService = await import('./server/imageGenService.js');
  } catch (err) {
    console.warn('ImageGen server middleware notice:', err.message);
  }
  if (!geminiService && !elevenLabsService && !imageGenService) return;

  const { handleTTSRequest, handleChatRequest, handleBedtimeStoryRequest, attachGeminiLiveWebSocket } = geminiService || {};
  const { handleElevenLabsTTSRequest } = elevenLabsService || {};
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
    if (url === '/api/gemini/tts' && req.method === 'POST') {
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
        if (typeof handleTTSRequest === 'function') {
          return await handleTTSRequest(req, res);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Gemini TTS handler not available' }));
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (url === '/api/elevenlabs/tts' && req.method === 'POST') {
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
        if (typeof handleElevenLabsTTSRequest === 'function') {
          return await handleElevenLabsTTSRequest(req, res);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'ElevenLabs service not loaded' }));
        }
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

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

function geminiServerPlugin() {
  return {
    name: 'gemini-server-plugin',
    async configureServer(server) {
      await setupGeminiMiddleware(server);
    },
    async configurePreviewServer(server) {
      await setupGeminiMiddleware(server);
    }
  };
}

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const base = process.env.VITE_BASE_PATH || (process.env.TARGET_HOST === 'firebase' ? '/' : (isGitHubActions ? '/Little-Heroes-G/' : '/'));

export default defineConfig({
  plugins: [geminiServerPlugin()],
  base,
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    open: false
  }
});
