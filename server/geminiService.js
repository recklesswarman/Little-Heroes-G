import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';

// Voice mapping for pet champions: warm, expressive, kid-friendly
export const PET_VOICE_MAP = {
  rex: 'Puck',        // Upbeat, energetic, friendly young voice
  bella: 'Aoede',     // Sweet, gentle, nurturing voice
  barnaby: 'Fenrir',  // Warm, deep, friendly gentle giant
  pip: 'Zephyr',      // Playful, cheerful, sprightly voice
  aqua: 'Charon',     // Calm, heroic, cool water drake
  aqua_drake: 'Charon'
};

export const PET_PERSONAS = {
  rex: {
    name: 'Rex the Dino',
    role: 'Enthusiastic cartoon dinosaur superhero companion and healthy habit champion',
    greeting: "ROAR! I'm Rex! Ready for super hero adventures, Little Hero?",
    prompt: `You are Rex the Dino, an adorable, enthusiastic dinosaur superhero and kid champion in Little Hero Adventures!
- Speak in warm, joyful, kid-friendly sentences (1-3 sentences maximum).
- Cheer kids on for brushing teeth, picking up toys, drinking water, eating healthy fruits/veggies, and bedtime routines.
- Frequently use playful dinosaur energy, gentle roars ("Roar!"), and superhero high fives.
- When asked for hints or help with learning quests (letters, numbers, shapes), give playful clues without giving away the answer.
- Always be gentle, positive, encouraging, and celebrate every small achievement.`
  },
  bella: {
    name: 'Bella the Bunny',
    role: 'Sweet, hopping bunny guide encouraging kindness, tidy spaces, and reading',
    greeting: "Hop hop hooray! I'm Bella! What fun adventure are we doing today?",
    prompt: `You are Bella the Bunny, a sweet, joyful cartoon bunny champion in Little Hero Adventures!
- Speak in a gentle, warm, playful, and cheerful tone (1-3 sentences).
- Encourage kids to be kind, share, read books, and hop happily through their daily habits.
- Celebrate every effort with sparkly encouragement and bunny hops!`
  },
  barnaby: {
    name: 'Barnaby the Bear',
    role: 'Cozy, strong bear companion encouraging good sleep, deep breathing, and hearty meals',
    greeting: "Big warm bear hug! I'm Barnaby! Let's conquer the day together!",
    prompt: `You are Barnaby the Bear, a gentle giant, cozy protector, and encouraging friend in Little Hero Adventures!
- Speak in a warm, comforting, cheerful tone with bear hugs and cozy calm.
- Encourage good sleep, bedtime relaxation, deep breaths, and healthy nutrition.`
  },
  pip: {
    name: 'Pip the Phoenix',
    role: 'Sprightly, glowing bird companion encouraging curiosity, creativity, and resilience',
    greeting: "Chirp chirp! Sparkle power! I'm Pip! Let's ignite our imagination!",
    prompt: `You are Pip the Phoenix, a radiant, lively magical chick in Little Hero Adventures!
- Speak with spark, wonder, and lively enthusiasm.
- Encourage curiosity, creativity, drawing, and trying again if something feels tricky.`
  },
  aqua: {
    name: 'Aqua Drake',
    role: 'Friendly water dragon encouraging bath time, swimming, hydration, and tooth brushing bubbles',
    greeting: "Splash splash! I'm Aqua! Let's make a tidal wave of super hero fun!",
    prompt: `You are Aqua Drake, a friendly bubbly water dragon in Little Hero Adventures!
- Speak with watery excitement, bubble jokes, and splashy cheers.
- Encourage drinking water, washing hands, bath time fun, and brushing teeth with bubbly foam blasts!`
  }
};

let cachedAiClient = null;

export function getGeminiClient() {
  if (!cachedAiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured in server environment.');
    }
    cachedAiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return cachedAiClient;
}

/**
 * Handle HTTP POST /api/gemini/tts
 * Generates realistic human kid-friendly voice audio using gemini-3.1-flash-tts-preview
 */
export async function handleTTSRequest(req, res) {
  try {
    const { text, petId, voice } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    const cleanText = text
      .replace(/\*.*?\*/g, ' ')
      .replace(/\[.*?\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'No readable speech text found.' });
    }

    const normalizedPetId = String(petId || 'rex').toLowerCase();
    const selectedVoice = voice || PET_VOICE_MAP[normalizedPetId] || 'Puck';
    const persona = PET_PERSONAS[normalizedPetId] || PET_PERSONAS.rex;

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{
        parts: [{
          text: `Read cheerfully and warmly in a kid-friendly companion tone for ${persona.name}: "${cleanText}"`
        }]
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice }
          }
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || 'audio/pcm;rate=24000';

    if (!audioData) {
      return res.status(502).json({ error: 'No audio generated by Gemini TTS' });
    }

    return res.json({
      success: true,
      audio: audioData,
      mimeType,
      voice: selectedVoice,
      sampleRate: 24000,
      petId: normalizedPetId
    });
  } catch (error) {
    console.error('Server TTS generation error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate voice speech'
    });
  }
}

/**
 * Handle HTTP POST /api/gemini/chat
 * Multi-turn Gemini chatbot with conversation history & pet champion persona
 */
export async function handleChatRequest(req, res) {
  try {
    const { message, history = [], petId = 'rex', speedMode = 'smart', childName = 'Little Hero' } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const normalizedPetId = String(petId || 'rex').toLowerCase();
    const persona = PET_PERSONAS[normalizedPetId] || PET_PERSONAS.rex;

    // Select model according to guidelines:
    // Fast tasks: 'gemini-3.1-flash-lite'
    // General tasks: 'gemini-3.5-flash'
    const model = speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';

    const systemInstruction = `${persona.prompt}
Current Child User: "${childName}".
Special Interactive Directives:
1. If the child mentions completing a habit (e.g. "I brushed my teeth", "I cleaned my room", "I drank water", "I ate healthy food"), enthusiastically celebrate them and include a tag like [HABIT_DONE: brush_teeth] or [HABIT_DONE: clean_toys] or [HABIT_DONE: drink_water] or [HABIT_DONE: healthy_snack] at the very end of your response so the app can award them coins!
2. If the child says they want a joke, tell a silly, clean 2-line dinosaur or animal joke.
3. If the child feels scared or upset, offer a warm virtual hug and a calming 3-second breathing count ("Breathe in 1-2-3, blow like a gentle dragon 1-2-3").
4. Keep the text concise, joyful, and easy to read aloud.`;

    const ai = getGeminiClient();

    // Format previous history into Gemini SDK format
    const formattedHistory = Array.isArray(history)
      ? history.map(item => ({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text || item.content || '' }]
        })).filter(h => h.parts[0].text)
      : [];

    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction
      },
      history: formattedHistory
    });

    const response = await chat.sendMessage({
      message: message.trim()
    });

    const replyText = response.text || '';

    // Detect if a habit completion was declared
    let awardedHabit = null;
    if (replyText.includes('[HABIT_DONE: brush_teeth]')) awardedHabit = 'brush_teeth';
    else if (replyText.includes('[HABIT_DONE: clean_toys]')) awardedHabit = 'clean_toys';
    else if (replyText.includes('[HABIT_DONE: drink_water]')) awardedHabit = 'drink_water';
    else if (replyText.includes('[HABIT_DONE: healthy_snack]')) awardedHabit = 'eat_healthy_snack';

    const cleanReply = replyText.replace(/\[HABIT_DONE:.*?\]/g, '').trim();

    return res.json({
      success: true,
      reply: cleanReply,
      petId: normalizedPetId,
      petName: persona.name,
      model,
      awardedHabit
    });
  } catch (error) {
    console.error('Server Chat request error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate chat response'
    });
  }
}

/**
 * Attaches the Gemini Live WebSocket server to the HTTP server
 * Bridges audio between browser client and gemini-3.8-live
 */
export function attachGeminiLiveWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/gemini/live' || url.pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs, request) => {
    console.log('Gemini Live client connected');
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const petId = url.searchParams.get('pet') || 'rex';
    const normalizedPetId = String(petId).toLowerCase();
    const voiceName = PET_VOICE_MAP[normalizedPetId] || 'Puck';
    const persona = PET_PERSONAS[normalizedPetId] || PET_PERSONAS.rex;

    let session = null;
    let isSessionAlive = true;

    try {
      const ai = getGeminiClient();

      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          },
          systemInstruction: `${persona.prompt}
You are actively listening and speaking with a child in real time via microphone and audio.
Speak in short, punchy, joyful sentences.
If the child is practicing toothbrushing, shout cheerful coaching like "Scrub circles! Top and bottom!".
If the child shouts "Blast" or "Toothpaste foam", roar with excitement: "BOOM! Toothpaste Foam Cannon!".
If the child guesses a quest answer, cheer them on warmly.`
        },
        callbacks: {
          onmessage: (message) => {
            if (!isSessionAlive || clientWs.readyState !== clientWs.OPEN) return;

            // Model audio PCM chunk (24kHz little-endian)
            const audioChunk = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioChunk) {
              clientWs.send(JSON.stringify({ audio: audioChunk }));
            }

            // Barge-in interruption from user speech
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            // Transcript text if available
            const textPart = message.serverContent?.modelTurn?.parts?.find(p => p.text);
            if (textPart?.text) {
              clientWs.send(JSON.stringify({ text: textPart.text }));
            }

            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onclose: () => {
            console.log('Gemini Live upstream session closed');
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ status: 'closed' }));
              clientWs.close();
            }
          },
          onerror: (err) => {
            console.warn('Gemini Live session error:', err?.message || err);
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Live session error' }));
            }
          }
        }
      });

      // Send initial handshake success to client
      clientWs.send(JSON.stringify({
        status: 'ready',
        petId: normalizedPetId,
        voice: voiceName,
        model: 'gemini-3.8-live'
      }));

      clientWs.on('message', (data) => {
        try {
          if (!session) return;
          const msg = JSON.parse(data.toString());

          // User microphone PCM (16kHz little-endian base64)
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          } else if (msg.text) {
            session.sendRealtimeInput({
              text: msg.text
            });
          }
        } catch (msgErr) {
          console.warn('Error handling client message in Gemini Live:', msgErr);
        }
      });

      clientWs.on('close', () => {
        isSessionAlive = false;
        if (session) {
          try {
            session.close();
          } catch {}
          session = null;
        }
      });

      clientWs.on('error', (err) => {
        console.warn('Client WebSocket error:', err);
        isSessionAlive = false;
        if (session) {
          try {
            session.close();
          } catch {}
          session = null;
        }
      });

    } catch (connectError) {
      console.error('Failed to establish Gemini Live session:', connectError?.message || connectError);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({
          error: connectError?.message || 'Could not connect to Gemini Live session'
        }));
        clientWs.close();
      }
    }
  });

  return wss;
}
