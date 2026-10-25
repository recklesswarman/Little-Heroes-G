import {
  getBedtimeRealm,
  BEDTIME_MORALS,
  generateFullBedtimeStory,
  generateProceduralBedtimeStory
} from '../src/data/bedtimeStoryData.js';

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

/**
 * Handle HTTP POST /api/rex/bedtime-story and /api/gemini/bedtime-story
 * Generates structured 3-chapter bedtime story with plot-coherent sceneDescriptor.
 */
export async function handleBedtimeStoryRequest(req, res) {
  try {
    if (isRateLimited(`bedtime:${getRequestIp(req)}`, 20, 60_000)) {
      return res.status(429).json({ error: 'Too many requests, please slow down.' });
    }

    const {
      heroName = 'Little Hero',
      heroId = 'hero_1',
      petId = 'rex',
      petName = 'Rex',
      realmId = 'space',
      moralId = 'brave_dark',
      magicItem = '',
      gentleObstacle = '',
      customWish = '',
      chapterIndex,
      actNumber,
      userChoices = [],
      recentTitles = [],
      recentArchetypes = [],
      recentOpenings = []
    } = req.body || {};

    const realm = getBedtimeRealm(realmId);
    const moral = BEDTIME_MORALS.find(m => m.id === moralId) || BEDTIME_MORALS[0];
    const ai = getGeminiClient(req.body?.apiKey);

    // If Gemini client is available, attempt generative AI story synthesis
    if (ai) {
      try {
        const prompt = `You are an expert children's bedtime author and soothing cartoon companion creating a deeply personalized, 4-chapter bedtime story for a young child (ages 3-7).
Child's Name: "${heroName}"
Companion Pet: "${petName}" (Species/Archetype: ${petId})
Bedtime Realm: "${realm.name}" (${realm.subtitle})
Moral Theme: "${moral.name}" - ${moral.moralGuidance}
Slumber Resolution: "${moral.slumberResolution}"
${magicItem ? `Magic Item chosen by child: "${magicItem}". Include this special item in the story!` : ''}
${gentleObstacle ? `Gentle hurdle: "${gentleObstacle}". Resolve this hurdle through kindness and the moral!` : ''}
${customWish ? `Parent Bedtime Wish: "${customWish}". Weave this gently into Chapter 1!` : ''}
${userChoices.length > 0 ? `Child's choices: ${JSON.stringify(userChoices)}` : ''}

ANTI-REPETITION MANDATE:
1. NEVER copy or repeat any of these recently generated titles: ${JSON.stringify(recentTitles.slice(0, 15))}.
2. NEVER reuse these plot archetypes: ${JSON.stringify(recentArchetypes.slice(0, 10))}.
3. NEVER repeat any of these recent chapter openings: ${JSON.stringify(recentOpenings.slice(0, 15))}.
4. BANNED CLICHÉS: Strictly NEVER use stock phrases such as "smiled happily beside", "looked up at the starry sky", "gazed with wonder", "twinkled like cheerful fireflies", "golden sun had dipped peacefully", "all was quiet now", "gazed at the quiet, starry night", or "flew across the starry sky". Craft fresh, vivid, soothing prose!

COLOR & PALETTE RULE:
Strict Explorer Palette only: Midnight Slate (#09141e), Emerald Green (#2ecc71), Electric Cyan (#00d2d3), Solar Orange (#f39c12), and Warm Amber (#ffb961).
STRICTLY NEVER mention or use pink or purple!

STRUCTURE:
Generate exactly 4 chapters (~180-220 words per chapter, ~750-850 words total across 4 chapters, lasting 7-8 minutes of calm bedtime storytelling):
- Chapter 1 (Departure & Gentle Curiosity): ~180-220 words. Packing hero gear/magic item, entering ${realm.subBiomes[0]}, celebrating daytime achievements.
- Chapter 2 (Whimsical Encounter & Gentle Mystery): ~180-220 words. Entering ${realm.subBiomes[1] || realm.subBiomes[0]}, discovering a sleepy creature or gentle obstacle with ${petName}'s help.
- Chapter 3 (Calming Cooperative Resolution): ~180-220 words. In ${realm.subBiomes[2] || realm.subBiomes[0]}, resolving the hurdle with ${moral.name} and calm cooperation.
- Chapter 4 (Cozy Starlight Slumber Sanctuary): ~180-220 words. In ${realm.subBiomes[3] || realm.subBiomes[0]}, tucking into the cozy nest, 4s inhale / 4s exhale breathing, sleepy yawns, whispered goodnight.

NO QUESTIONS: Do NOT ask questions like "What should we do next?". Tell a calm, continuous, soothing narrative.

Return ONLY a valid JSON object matching this schema (no markdown, no backticks, just raw JSON):
{
  "title": "A soothing creative title (max 5 words)",
  "theme": "${moral.id}",
  "realm": "${realm.id}",
  "chapters": [
    {
      "chapterIndex": 0,
      "chapterNumber": 1,
      "title": "Chapter 1: Short Chapter Title",
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "A comforting whisper line for bedtime",
      "sleepyCue": "A physical relaxation prompt (e.g. relaxing shoulders)",
      "moralReflection": "A sweet sentence celebrating courage or kindness",
      "choices": [],
      "sceneMood": "tranquil",
      "sceneDescriptor": {
        "environmentBiome": "${realm.subBiomes[0]}",
        "timeOfNight": "twilight_arrival",
        "weatherParticles": "fireflies",
        "cameraWork": "orbit_pan",
        "heroAction": "walking_with_lantern",
        "petAction": "trotting_beside",
        "keyProps": ["Starlight Lantern", "${realm.subBiomes[0]}"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "${realm.accentColor || '#00d2d3'}",
          "accent": "#ffb961"
        }
      }
    },
    {
      "chapterIndex": 1,
      "chapterNumber": 2,
      "title": "Chapter 2: Short Chapter Title",
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "A comforting whisper line",
      "sleepyCue": "A slow deep breath prompt",
      "moralReflection": "A sweet reflection on ${moral.name}",
      "choices": [],
      "sceneMood": "mystical",
      "sceneDescriptor": {
        "environmentBiome": "${realm.subBiomes[1] || realm.subBiomes[0]}",
        "timeOfNight": "starlit_journey",
        "weatherParticles": "aurora_ribbons",
        "cameraWork": "follow_walk",
        "heroAction": "discovering_landmark",
        "petAction": "sniffing_clue",
        "keyProps": ["Sleeping Friend", "Amber Beacon"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "${realm.accentColor || '#00d2d3'}",
          "accent": "#ffb961"
        }
      }
    },
    {
      "chapterIndex": 2,
      "chapterNumber": 3,
      "title": "Chapter 3: Short Chapter Title",
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "Kindness and patience always light the way home",
      "sleepyCue": "A muscle relaxation cue",
      "moralReflection": "${moral.slumberResolution}",
      "choices": [],
      "sceneMood": "gentle",
      "sceneDescriptor": {
        "environmentBiome": "${realm.subBiomes[2] || realm.subBiomes[0]}",
        "timeOfNight": "starlit_journey",
        "weatherParticles": "fireflies",
        "cameraWork": "follow_walk",
        "heroAction": "helping_obstacle",
        "petAction": "glowing_magic",
        "keyProps": ["Sleeping Friend", "Amber Beacon"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "${realm.accentColor || '#00d2d3'}",
          "accent": "#ffb961"
        }
      }
    },
    {
      "chapterIndex": 3,
      "chapterNumber": 4,
      "title": "Chapter 4: The Slumber Sanctuary",
      "chapterText": "Soothing narrative text (~180-220 words)",
      "whisperLine": "Goodnight little hero, sweet dreams",
      "sleepyCue": "4s inhale, 4s exhale breathing pacer",
      "moralReflection": "${moral.slumberResolution}",
      "choices": [],
      "sceneMood": "deep_slumber",
      "sceneDescriptor": {
        "environmentBiome": "${realm.subBiomes[3] || realm.subBiomes[0]}",
        "timeOfNight": "deep_slumber_sanctuary",
        "weatherParticles": "starlight_snow",
        "cameraWork": "crane_descend_nest",
        "heroAction": "curled_asleep",
        "petAction": "sleeping_curled",
        "keyProps": ["Cozy Slumber Nest", "Velvet Blankets"],
        "lightingPalette": {
          "ambient": "#09141e",
          "directional": "#09141e",
          "accent": "#ffb961"
        }
      }
    }
  ]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        });

        const rawText = response.text || '';
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length >= 4) {
          const normalizedChapters = parsed.chapters.slice(0, 4).map((ch, idx) => ({
            ...ch,
            chapterIndex: idx,
            chapterNumber: idx + 1,
            text: ch.chapterText || ch.text || '',
            chapterText: ch.chapterText || ch.text || '',
            choices: Array.isArray(ch.choices) ? ch.choices : [],
            sceneDescriptor: {
              environmentBiome: ch.sceneDescriptor?.environmentBiome || realm.subBiomes[idx % realm.subBiomes.length],
              timeOfNight: idx === 0 ? 'twilight_arrival' : (idx === 1 || idx === 2) ? 'starlit_journey' : 'deep_slumber_sanctuary',
              weatherParticles: ch.sceneDescriptor?.weatherParticles || (idx === 1 ? 'aurora_ribbons' : idx === 3 ? 'starlight_snow' : 'fireflies'),
              cameraWork: idx === 0 ? 'orbit_pan' : (idx === 1 || idx === 2) ? 'follow_walk' : 'crane_descend_nest',
              heroAction: idx === 0 ? 'walking_with_lantern' : idx === 1 ? 'discovering_landmark' : idx === 2 ? 'helping_obstacle' : 'curled_asleep',
              petAction: idx === 0 ? 'trotting_beside' : idx === 1 ? 'sniffing_clue' : idx === 2 ? 'glowing_magic' : 'sleeping_curled',
              keyProps: Array.isArray(ch.sceneDescriptor?.keyProps) ? ch.sceneDescriptor.keyProps : ['Starlight Lantern', realm.name],
              lightingPalette: {
                ambient: '#09141e',
                directional: realm.accentColor || '#00d2d3',
                accent: '#ffb961'
              }
            }
          }));

          const storyPayload = {
            success: true,
            storyId: `story_${Date.now()}`,
            title: parsed.title || `${heroName}'s Adventure in ${realm.name}`,
            theme: moral.id,
            realm: realm.id,
            realmId: realm.id,
            realmName: realm.name,
            moralId: moral.id,
            heroName,
            petName,
            seed: Date.now(),
            archetypeId: parsed.archetypeId || 'gemini_generative',
            chapters: normalizedChapters
          };

          const reqIdx = actNumber !== undefined ? actNumber - 1 : (chapterIndex !== undefined ? Number(chapterIndex) : undefined);
          if (reqIdx !== undefined && normalizedChapters[reqIdx]) {
            const ch = normalizedChapters[reqIdx];
            return res.json({
              ...storyPayload,
              ...ch,
              text: ch.text,
              title: ch.title,
              prompt: reqIdx >= 3 ? 'Sleep tight, brave hero. Sweet dreams.' : 'The evening trail is quiet and welcoming.',
              promptQuestion: reqIdx >= 3 ? 'Sleep tight, brave hero. Sweet dreams.' : 'The evening trail is quiet and welcoming.',
              defaultChips: ch.choices.map(c => ({ text: c, icon: 'stars' })),
              suggestionChips: ch.choices.map(c => ({ text: c, icon: 'stars' })),
              isSleepingEnd: reqIdx >= 3
            });
          }

          return res.json(storyPayload);
        }
      } catch (geminiErr) {
        console.warn('Gemini bedtime story generation fell back to procedural weaver:', geminiErr?.message || geminiErr);
      }
    }

    // Fallback: Combinatorial Dynamic Story Weaver
    const proceduralPayload = generateFullBedtimeStory(
      realm.id,
      moral.id,
      heroName,
      petName,
      customWish,
      userChoices
    );

    const reqIdx = actNumber !== undefined ? actNumber - 1 : (chapterIndex !== undefined ? Number(chapterIndex) : undefined);
    if (reqIdx !== undefined) {
      const ch = generateProceduralBedtimeStory(
        realm.id,
        moral.id,
        heroName,
        petName,
        customWish,
        reqIdx,
        userChoices
      );
      return res.json({
        ...proceduralPayload,
        ...ch,
        success: true
      });
    }

    return res.json(proceduralPayload);
  } catch (error) {
    console.error('Server Bedtime Story error:', error);
    const fallback = generateFullBedtimeStory('space', 'brave_dark', 'Little Hero', 'Rex');
    return res.json(fallback);
  }
}

