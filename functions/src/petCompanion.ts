// Pet Companion Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export interface ChatWithPetData {
  heroId?: string;
  message: string;
  currentHabit?: string;
  petId?: string;
  ageTier?: string;
}

export const chatWithPet = onCall(
  { secrets: ["GEMINI_API_KEY"], cors: true },
  async (request) => {
    // Initialize Gemini using the secret from process.env inside the request
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const db = admin.firestore();

    const { heroId = "Little Hero", message, currentHabit, petId, ageTier = "toddler" } = (request.data || {}) as ChatWithPetData;
    if (!message || !message.trim()) {
      throw new HttpsError("invalid-argument", "Missing message.");
    }

    const childName = heroId || "Little Hero";
    const selectedPet = (petId || "rex").toLowerCase();

    // 1. Multi-Pet Character Persona Engine
    const PET_PROFILES: Record<string, { name: string; restingPlace: string; soundEffects: string; personality: string; favoriteHabit: string }> = {
      rex: {
        name: "Rex the Dino",
        restingPlace: "dino cave",
        soundEffects: "*Happy Dino Giggle!*, *Gently Stomps!*, *ROAR!*",
        personality: "energetic, cheerful, playful green dinosaur buddy",
        favoriteHabit: "brushing teeth and stomping away sugar bugs"
      },
      aqua_drake: {
        name: "Aqua Drake",
        restingPlace: "water grotto",
        soundEffects: "*Splish Splash!*, *Gentle Bubble Pop!*, *Happy Water Swirl!*",
        personality: "gentle, soothing, oceanic water dragon companion",
        favoriteHabit: "drinking fresh water and splashing in bath time"
      },
      aqua: {
        name: "Aqua Drake",
        restingPlace: "water grotto",
        soundEffects: "*Splish Splash!*, *Gentle Bubble Pop!*, *Happy Water Swirl!*",
        personality: "gentle, soothing, oceanic water dragon companion",
        favoriteHabit: "drinking fresh water and splashing in bath time"
      },
      bella: {
        name: "Bella the Bunny",
        restingPlace: "cozy burrow",
        soundEffects: "*Hop Hop!*, *Wiggle Nose!*, *Happy Bunny Chirp!*",
        personality: "bouncy, sweet, tidy bunny companion",
        favoriteHabit: "cleaning up toys and eating crunchy healthy veggies"
      },
      barnaby: {
        name: "Barnaby the Bear",
        restingPlace: "warm den",
        soundEffects: "*Warm Bear Hug!*, *Gentle Grumble!*, *Cozy Snuggle!*",
        personality: "strong, brave, grounding, cuddly bear companion",
        favoriteHabit: "being brave and getting good bedtime sleep"
      },
      pip: {
        name: "Pip the Phoenix",
        restingPlace: "golden nest",
        soundEffects: "*Flap Flap!*, *Sparkle Chime!*, *Golden Glow!*",
        personality: "radiant, curious, enthusiastic baby firebird",
        favoriteHabit: "reading stories, homework, and counting stars"
      }
    };

    const pet = PET_PROFILES[selectedPet] || PET_PROFILES.rex;

    // 2. Retrieve Parental Controls & Guardrails from Firestore
    let parentRules: {
      companionEnabled?: boolean;
      maxDailyTurns?: number;
      bedtimeHour?: number;
      restrictedTopics?: string[];
      focusAreas?: string[];
      tone?: string;
    } = {
      companionEnabled: true,
      maxDailyTurns: 30,
      bedtimeHour: 20,
      restrictedTopics: [],
      focusAreas: ["brushing_teeth", "cleaning_toys"],
      tone: "energetic"
    };

    try {
      if (heroId && heroId !== "Little Hero") {
        const settingsDoc = await db.collection("heroes").doc(heroId).collection("settings").doc("aiCompanion").get();
        if (settingsDoc.exists) {
          parentRules = { ...parentRules, ...(settingsDoc.data() as any) };
        }
      }
    } catch (parentErr) {
      console.warn("Parent rules retrieval notice:", parentErr);
    }

    // GUARDRAIL A: Master Companion Switch
    if (parentRules.companionEnabled === false) {
      return { reply: `*Shhh...* ${pet.name} is currently resting in the ${pet.restingPlace}! Ask Mom or Dad to wake them up!` };
    }

    // GUARDRAIL B: Bedtime Cutoff Rule
    const currentHour = new Date().getHours();
    if (currentHour >= (parentRules.bedtimeHour ?? 20) || currentHour < 6) {
      return { reply: `*Yawn...* ${pet.name} is fast asleep in the ${pet.restingPlace} for the night! See you in the morning, ${childName}!` };
    }

    // GUARDRAIL C: Restricted Topics / Topic Moderation Check
    const lowerMessage = (message || "").toLowerCase();
    const hitRestricted = (parentRules.restrictedTopics || []).find((topic) =>
      topic && topic.trim() && lowerMessage.includes(topic.trim().toLowerCase())
    );
    if (hitRestricted) {
      return {
        reply: `*Wiggle ears!* ${pet.name} wants to focus on super fun hero habits! Tell me how you're helping out today, ${childName}!`
      };
    }

    // GUARDRAIL D: Daily Screen-Time Chat Turns Limit
    if (heroId && heroId !== "Little Hero" && (parentRules.maxDailyTurns ?? 30) < 999) {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayTurnsSnap = await db
          .collection("heroes")
          .doc(heroId)
          .collection("chatHistory")
          .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
          .get();

        const userTurnsToday = todayTurnsSnap.docs.filter((d) => d.data().role === "user").length;
        if (userTurnsToday >= (parentRules.maxDailyTurns ?? 30)) {
          return {
            reply: `*Happy wave!* We had so much fun chatting today! Let's rest our screens now and go play in the real world, Little Hero!`
          };
        }
      } catch (turnsErr) {
        console.warn("Turns lookup notice:", turnsErr);
      }
    }

    // 3. Dynamic Persona System Instruction
    const isToddler = ageTier === "toddler";
    const REX_TODDLER_PROMPT = `
You are ${pet.name}, a ${pet.personality} talking to a 3-to-4-year-old child named ${childName}.
RULES FOR TODDLER MODE:
1. Max length: 1 to 2 very short sentences (under 15 words total).
2. Sound effects: Always include cute playful sounds like ${pet.soundEffects}.
3. Toddler Phrasing: Kids this age say fragments (e.g. "I brush", "Dino look", "toy gone"). Understand their intent and praise them excitedly!
4. Focus on their positive habits: ${pet.favoriteHabit}, tidying up, drinking water, eating veggies.
`;

    const REX_KID_PROMPT = `
You are ${pet.name}, a ${pet.personality} talking to ${childName} (ages 5–8).
- Voice & Tone: Enthusiastic, warm, encouraging, and adventurous. Current style: ${parentRules.tone || "energetic"}.
- Sound effects: Always use playful bracketed sound effects like ${pet.soundEffects}.
- Core Mission: Help ${childName} build positive daily habits, maintain their streak, and earn Gold Points ⭐. Keep sentences under 25 words.
`;

    let injectedSystemInstruction = isToddler ? REX_TODDLER_PROMPT : REX_KID_PROMPT;
    if (parentRules.focusAreas && parentRules.focusAreas.length > 0) {
      injectedSystemInstruction += `\nPRIORITY FOCUS HABITS: ${parentRules.focusAreas.join(", ")}.`;
    }

    // 4. Conversational Memory: Fetch recent chat history
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    try {
      if (heroId && heroId !== "Little Hero") {
        const historySnap = await db
          .collection("heroes")
          .doc(heroId)
          .collection("chatHistory")
          .orderBy("createdAt", "desc")
          .limit(4)
          .get();

        const historyTurns = historySnap.docs.reverse().map((doc) => ({
          role: doc.data().role as "user" | "model",
          parts: [{ text: (doc.data().text || "") as string }],
        }));
        contents.push(...historyTurns);
      }
    } catch (histErr) {
      console.warn("Chat history lookup notice:", histErr);
    }

    // Contextual prompt injection if a specific habit quest is active
    const promptContext = currentHabit
      ? `[Active Quest: ${currentHabit}] Child says: "${message}"`
      : message;

    contents.push({ role: "user", parts: [{ text: promptContext }] });

    // 5. Query Gemini with configured persona & token limit
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: injectedSystemInstruction,
        temperature: 0.7,
        maxOutputTokens: isToddler ? 60 : 100,
      },
    });

    const replyText = response.text || `*Happy cheer!* Great job, ${childName}! Let's play!`;

    // 6. Save conversation turn to Firestore asynchronously
    try {
      if (heroId && heroId !== "Little Hero") {
        const chatColl = db.collection("heroes").doc(heroId).collection("chatHistory");
        await chatColl.add({
          role: "user",
          text: message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await chatColl.add({
          role: "model",
          text: replyText,
          petId: selectedPet,
          petName: pet.name,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (saveErr) {
      console.warn("Could not save chat history to Firestore:", saveErr);
    }

    return { reply: replyText, petName: pet.name };
  }
);


