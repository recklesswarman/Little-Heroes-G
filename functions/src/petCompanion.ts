// Pet Companion Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || undefined });
const db = admin.firestore();

const REX_SYSTEM_INSTRUCTION = `
You are Rex the Dino, the loyal, high-energy companion in Little Heroes.
- Target Audience: Children (ages 4–9).
- Voice & Tone: Enthusiastic, warm, encouraging, and adventurous. Use playful sound effects in brackets like *ROAR!*, *tail wag*, or *happy stomps*.
- Core Mission: Help child heroes build positive daily habits (brushing teeth, tidying up, drinking water, homework, reading).
- Safety Guardrail: Never give medical advice, scary scenarios, or encourage unsafe real-world physical activities. Keep sentences short and easy to follow.
`;

export interface ChatWithPetData {
  heroId: string;
  message: string;
  currentHabit?: string;
  petId?: string;
}

export const chatWithPet = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated to talk with pet.");
  }

  const { heroId, message, currentHabit, petId } = (request.data || {}) as ChatWithPetData;
  if (!heroId || !message) {
    throw new HttpsError("invalid-argument", "Missing heroId or message.");
  }

  // 1. Fetch recent chat history (last 6 interactions)
  const historyRef = db
    .collection("heroes")
    .doc(heroId)
    .collection("chatHistory")
    .orderBy("createdAt", "desc")
    .limit(6);

  const historySnap = await historyRef.get();
  const contents = historySnap.docs.reverse().map((doc) => ({
    role: doc.data().role as "user" | "model",
    parts: [{ text: (doc.data().text || "") as string }],
  }));

  // Contextual prompt injection if a specific habit quest is active
  const promptContext = currentHabit
    ? `[Active Quest: ${currentHabit}] Child says: "${message}"`
    : message;

  contents.push({ role: "user", parts: [{ text: promptContext }] });

  // 2. Query Gemini with Rex's persona
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: REX_SYSTEM_INSTRUCTION,
      temperature: 0.8,
      maxOutputTokens: 180,
    },
  });

  const replyText = response.text || "*ROAR!* Super job today, Little Hero! Let's keep exploring!";

  // 3. Save conversation turn to Firestore
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

  return { reply: replyText };
});

