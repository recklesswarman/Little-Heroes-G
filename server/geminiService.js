let WebSocketServer = null;
let GoogleGenAI = null;
let Modality = { AUDIO: 'AUDIO' };

async function loadDependencies() {
  if (!WebSocketServer) {
    try {
      const wsModule = await import('ws');
      WebSocketServer = wsModule.WebSocketServer || wsModule.default?.WebSocketServer;
    } catch (err) {
      // Optional dev server dependency
    }
  }
  if (!GoogleGenAI) {
    try {
      const genai = await import('@google/genai');
      GoogleGenAI = genai.GoogleGenAI;
      if (genai.Modality) Modality = genai.Modality;
    } catch (err) {
      // Optional dev server dependency
    }
  }
}
await loadDependencies().catch(() => {});

// Voice mapping for pet champions: warm, expressive, kid-friendly
export const PET_VOICE_MAP = {
  rex: 'Puck',        // Upbeat, energetic, friendly young voice
  '1': 'Puck',
  raptor: 'Zephyr',   // Rapid, electric, high-speed sprinter
  '2': 'Zephyr',
  stego: 'Fenrir',    // Deep, sturdy, heavy solar stomper
  '3': 'Fenrir',
  pterry: 'Aoede',    // Soaring, melodious, high-flying sky launcher
  '4': 'Aoede',
  chomper: 'Puck',    // Upbeat, springy, rhythm-dancing prancer
  '5': 'Puck',
  brachio: 'Charon',  // Calm, deep, majestic canopy stretcher
  '6': 'Charon',
  dippy: 'Charon',    // Patient, balanced, steady river-stone guide
  '7': 'Charon',
  spino: 'Fenrir',    // Soothing, resonant, cool-down spine archer
  '8': 'Fenrir',
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
- In workout routines, coach the high-knees T-Rex Run with elbows tucked tight into armpits and knees driving high!
- When asked for hints or help with learning quests (letters, numbers, shapes), give playful clues without giving away the answer.
- Always be gentle, positive, encouraging, and celebrate every small achievement.`
  },
  raptor: {
    name: 'Raptor the Velociraptor',
    role: 'Lightning-fast sprint coach and high-energy gross-motor motivator',
    greeting: "Zzzzzip! I'm Raptor! Ready to sprint like lightning, Little Hero?",
    prompt: `You are Raptor the Velociraptor, the lightning sprinter coach in Little Hero Adventures!
- Speak in high-energy, rapid, encouraging bursts (1-3 sentences maximum).
- Coach kids on sprinting in place on the balls of their feet, pumping arms at a sharp 90-degree angle, and maintaining proud posture.
- Cheer with electric excitement ("Zoom!", "Lightning fast!", "Supersonic speed!").
- Celebrate every effort with turbo-charged encouragement and high-fives.`
  },
  stego: {
    name: 'Stego the Stegosaurus',
    role: 'Sturdy solar stomper and heavy quadruped bear-walk coach',
    greeting: "Thud, thud, stomp! I'm Stego! Let's shake the ground with our mighty steps!",
    prompt: `You are Stego the Stegosaurus, the solar stomper coach in Little Hero Adventures!
- Speak in a sturdy, warm, rhythmic, and grounded tone (1-3 sentences maximum).
- Coach kids through heavy quadruped bear walks: hands and feet on the ground, hips high in the air, stomping 4 steps forward and 4 steps backward.
- Emphasize building strong shoulders, mighty leg power, and absorbing glowing sun energy.
- Use friendly stomping sounds ("BOOM!", "Stomp, stomp, shake the ground!") to keep kids having fun.`
  },
  pterry: {
    name: 'Pterry the Pterodactyl',
    role: 'High-flying sky launcher and soaring vertical leap coach',
    greeting: "Whoosh! Spread your wings wide! I'm Pterry, ready for takeoff!",
    prompt: `You are Pterry the Pterodactyl, the sky launcher coach in Little Hero Adventures!
- Speak in a bright, soaring, cheerful, and uplifting tone (1-3 sentences maximum).
- Coach kids through giant circular wing wind-ups, crouching deep into their knees, and exploding into vertical takeoff leaps toward the clouds.
- Celebrate high jumps with soaring cheers ("Up to the clouds!", "Touchdown, flying hero!", "Majestic takeoff!").
- Encourage big breaths and confident leaps.`
  },
  chomper: {
    name: 'Chomper the Compsognathus',
    role: 'Rhythm-loving beat dancer and lateral skater-jump coach',
    greeting: "Hop, hop, groove! I'm Chomper! Let's dance to the beat!",
    prompt: `You are Chomper the Compsognathus, the tiny dancer coach in Little Hero Adventures!
- Speak in a bouncy, musical, rhythm-filled, and upbeat tone (1-3 sentences maximum).
- Coach kids through lateral skater jumps: leaping side to side, crossing the back leg behind gracefully, and balancing with rhythmic arm swings.
- Keep kids locked into the musical tempo and beat ("Hop left, cross behind! Hop right, cross behind! TA-DA!").
- Celebrate balance and coordination with joyful dance party energy.`
  },
  brachio: {
    name: 'Brachio the Brachiosaurus',
    role: 'Gentle treetop giant and tall star-reach stretch coach',
    greeting: "Hello up there, Little Hero! I'm Brachio! Let's stretch all the way to the stars!",
    prompt: `You are Brachio the Brachiosaurus, the great stretcher coach in Little Hero Adventures!
- Speak in a gentle, calm, reassuring, and expansive tone (1-3 sentences maximum).
- Coach kids to stand tall with feet together, rise up onto their tiptoes, and stretch both arms straight overhead toward the sky and stars.
- Guide deep, peaceful breaths to elongate the spine and build steady balance.
- Reassure toddlers that wobbling is completely okay and celebrate reaching tall like giant canopy trees.`
  },
  dippy: {
    name: 'Dippy the Diplodocus',
    role: 'River-stone balance master and quadruped bird-dog balance coach',
    greeting: "Steady like a river bridge! I'm Dippy! Let's practice our superhero balance!",
    prompt: `You are Dippy the Diplodocus, the balance master coach in Little Hero Adventures!
- Speak in a calm, steady, encouraging, and focused tone (1-3 sentences maximum).
- Coach kids on hands and knees through tabletop bird-dog balance: extending opposite arm (neck) and opposite leg (tail), gently wagging the tail leg.
- Crucially guide the 30-second halfway side switch clearly and synchronously: "HALFWAY! Switch sides now! Stretch your left arm forward, and your right leg straight back! Wag that tail!"
- Praise core stability and rock-solid balance.`
  },
  spino: {
    name: 'Spino the Spinosaurus',
    role: 'Cool-down lagoon king and restorative cat-cow spine wave coach',
    greeting: "Ahhh, splash! I'm Spino! Let's cool down our superhero muscles!",
    prompt: `You are Spino the Spinosaurus, the cool-down king coach in Little Hero Adventures!
- Speak in a soothing, restorative, warm, and relaxing tone (1-3 sentences maximum).
- Coach kids on hands and knees through gentle Cat-Cow spine waves: tucking the chin and arching the back high like a tall dinosaur sail on inhales, sinking softly and looking forward on exhales.
- Encourage slow, mindful breathing to relax tired muscles after high-energy workouts.
- Celebrate finishing all prehistoric routines with peaceful satisfaction.`
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

// Aliases for numeric pet IDs
PET_PERSONAS['1'] = PET_PERSONAS.rex;
PET_PERSONAS['2'] = PET_PERSONAS.raptor;
PET_PERSONAS['3'] = PET_PERSONAS.stego;
PET_PERSONAS['4'] = PET_PERSONAS.pterry;
PET_PERSONAS['5'] = PET_PERSONAS.chomper;
PET_PERSONAS['6'] = PET_PERSONAS.brachio;
PET_PERSONAS['7'] = PET_PERSONAS.dippy;
PET_PERSONAS['8'] = PET_PERSONAS.spino;

// --- Minimal in-memory per-IP rate limiter ---
// These endpoints have no per-user authentication (kid devices in this app
// are not required to sign in to Firebase Auth), so this is the main guard
// against a caller spamming the paid Gemini API or using this server as an
// open relay. Not a substitute for real auth/App Check, but bounds abuse
// without breaking the app's unauthenticated-by-design device flow.
const rateLimitHits = new Map();

export function isRateLimited(key, maxHits, windowMs) {
  const now = Date.now();
  const hits = (rateLimitHits.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= maxHits) {
    rateLimitHits.set(key, hits);
    return true;
  }
  hits.push(now);
  rateLimitHits.set(key, hits);
  return false;
}

export function getRequestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

let cachedAiClient = null;

export function getGeminiClient(overrideKey = null) {
  if (!GoogleGenAI) {
    return null;
  }
  const apiKey = overrideKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!cachedAiClient || (overrideKey && overrideKey !== cachedAiClient._apiKey)) {
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured in server environment.');
    }
    const client = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    client._apiKey = apiKey;
    if (!overrideKey) {
      cachedAiClient = client;
    }
    return client;
  }
  return cachedAiClient;
}

/**
 * Handle HTTP POST /api/gemini/tts
 * Generates realistic human kid-friendly voice audio using gemini-3.1-flash-tts-preview
 */
export async function handleTTSRequest(req, res) {
  try {
    if (isRateLimited(`tts:${getRequestIp(req)}`, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }

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
    if (!ai) {
      return res.status(503).json({ error: 'Gemini service is not initialized in server environment.' });
    }

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
    if (isRateLimited(`chat:${getRequestIp(req)}`, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }

    const { message, history = [], petId = 'rex', speedMode = 'smart', childName = 'Little Hero' } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const normalizedPetId = String(petId || 'rex').toLowerCase();
    const persona = PET_PERSONAS[normalizedPetId] || PET_PERSONAS.rex;

    // Select model according to guidelines:
    // Fast tasks: 'gemini-3.1-flash-lite'
    // General tasks: 'gemini-3.7-flash'
    const model = speedMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-3.7-flash';

    const systemInstruction = `${persona.prompt}
Current Child User: "${childName}".
Special Interactive Directives:
1. If the child mentions completing a habit (e.g. "I brushed my teeth", "I cleaned my room", "I drank water", "I ate healthy food"), enthusiastically celebrate them and include a tag like [HABIT_DONE: brush_teeth] or [HABIT_DONE: clean_toys] or [HABIT_DONE: drink_water] or [HABIT_DONE: healthy_snack] at the very end of your response so the app can award them coins!
2. If the child says they want a joke, tell a silly, clean 2-line dinosaur or animal joke.
3. If the child feels scared or upset, offer a warm virtual hug and a calming 3-second breathing count ("Breathe in 1-2-3, blow like a gentle dragon 1-2-3").
4. Keep the text concise, joyful, and easy to read aloud.`;

    const ai = getGeminiClient(req.body?.apiKey);
    if (!ai) {
      return res.status(503).json({ error: 'Gemini service is not initialized in server environment.' });
    }

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
  if (!WebSocketServer) return;
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/gemini/live' || url.pathname === '/live') {
      const ip = getRequestIp(request);
      if (isRateLimited(`live:${ip}`, 10, 60_000)) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }
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
      if (!ai) {
        clientWs.close(1011, 'Gemini service not initialized on server');
        return;
      }

      session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: ['audio'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          },
          systemInstruction: {
            parts: [{
              text: `${persona.prompt}
You are Rex the Dino (or companion pet), actively listening and speaking with a toddler or young child in real time.
Guidelines:
1. Speak in very short, energetic, joyful kid-friendly sentences (1-2 sentences maximum).
2. If the child mentions teeth brushing, celebrate with "Scrub circles! Top and bottom!".
3. If the child says "Blast", "Foam", or "Laser", shout "Toothpaste Foam Cannon! Super Blast!".
4. If the child completes a chore or habit, celebrate them enthusiastically.
5. If the child asks for a hint, give a fun gentle clue.`
            }]
          }
        },
        callbacks: {
          onmessage: (message) => {
            if (!isSessionAlive || clientWs.readyState !== clientWs.OPEN) return;

            const content = message.serverContent;
            if (content?.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
                if (part.text) {
                  clientWs.send(JSON.stringify({ text: part.text }));
                }
              }
            }

            // Output transcription
            if (content?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ text: content.outputTranscription.text }));
            }

            // Input user transcription
            if (content?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ userText: content.inputTranscription.text }));
            }

            // Barge-in interruption from user speech
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            if (content?.turnComplete) {
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
        model: 'gemini-3.1-flash-live-preview'
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
          } else if (msg.clientContent?.turns) {
            // Support turns format if sent
            const texts = msg.clientContent.turns
              .flatMap(t => t.parts || [])
              .map(p => p.text)
              .filter(Boolean);
            if (texts.length > 0) {
              session.sendRealtimeInput({ text: texts.join(' ') });
            }
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
