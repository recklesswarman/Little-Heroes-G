import { defineConfig } from 'vite';

function geminiServerPlugin() {
  return {
    name: 'gemini-server-plugin',
    async configureServer(server) {
      let geminiService = null;
      try {
        geminiService = await import('./server/geminiService.js');
      } catch (err) {
        console.warn('Gemini server middleware notice (dev mode):', err.message);
      }
      if (!geminiService) return;

      const { handleTTSRequest, handleChatRequest, attachGeminiLiveWebSocket } = geminiService;

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
            return await handleTTSRequest(req, res);
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
            return await handleChatRequest(req, res);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        next();
      });

      if (server.httpServer) {
        attachGeminiLiveWebSocket(server.httpServer);
      }
    }
  };
}

export default defineConfig({
  plugins: [geminiServerPlugin()],
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    open: false
  }
});

