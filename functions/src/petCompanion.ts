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

    // Toddler-Tuned Persona for 3-4 year olds
    const REX_TODDLER_PROMPT = `
You are Rex the Dino, a cheerful, loving green dinosaur buddy talking to a 3-to-4-year-old child named ${childName}.
RULES FOR TODDLER MODE:
1. Max length: 1 to 2 very short sentences (under 15 words total).
2. Sound effects: Always include cute sounds like "*Happy Dino Giggle!*" or "*Gently Stomps!*".
3. Toddler Phrasing: Kids this age say fragments (e.g. "I brush", "Dino look", "toy gone"). Understand their intent and praise them excitedly!
4. Focus on their positive habits: Tidying toys, eating veggies, brushing teeth, drinking water.
`;

    const REX_KID_PROMPT = `
You are Rex the Dino, the loyal, high-energy companion in Little Heroes talking to ${childName}.
- Voice & Tone: Enthusiastic, warm, encouraging, and adventurous. Use playful sound effects in brackets like *ROAR!*, *tail wag*, or *happy stomps*.
- Core Mission: Help child heroes build positive daily habits. Keep sentences short and easy to follow.
`;

    let injectedSystemInstruction = ageTier === "kid" ? REX_KID_PROMPT : REX_TODDLER_PROMPT;

    // Optional Parental Controls from Firestore (bedtime and topic filters)
    try {
      if (heroId && heroId !== "Little Hero") {
        const settingsDoc = await db.collection("heroes").doc(heroId).collection("settings").doc("aiCompanion").get();
        if (settingsDoc.exists) {
          const parentRules = (settingsDoc.data() as any) || {};
          const currentHour = new Date().getHours();
          if (parentRules.companionEnabled === false || currentHour >= (parentRules.bedtimeHour ?? 20)) {
            return { reply: `*Yawn...* Rex is sleeping in his dino cave for the night! See you in the morning, ${childName}!` };
          }
          if (parentRules.focusAreas && Array.isArray(parentRules.focusAreas) && parentRules.focusAreas.length > 0) {
            injectedSystemInstruction += `\nPriority Habits: ${parentRules.focusAreas.join(", ")}`;
          }
          if (parentRules.restrictedTopics && Array.isArray(parentRules.restrictedTopics) && parentRules.restrictedTopics.length > 0) {
            injectedSystemInstruction += `\nFORBIDDEN TOPICS (Never discuss): ${parentRules.restrictedTopics.join(", ")}`;
          }
        }
      }
    } catch (parentErr) {
      console.warn("Parent rules retrieval notice:", parentErr);
    }

    // Fetch recent chat history if available
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

    // Query Gemini with toddler prompt & short token limit
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: injectedSystemInstruction,
        temperature: 0.7,
        maxOutputTokens: 60,
      },
    });

    const replyText = response.text || `*Happy Roar!* Great job, ${childName}! Let's play!`;

    // Save conversation turn to Firestore asynchronously in background
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
          petId: petId || "rex",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (saveErr) {
      console.warn("Could not save chat history to Firestore:", saveErr);
    }

    return { reply: replyText };
  }
);


