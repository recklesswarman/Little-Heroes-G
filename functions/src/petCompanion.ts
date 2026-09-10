// Pet Companion Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

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

export const chatWithPet = onCall(
  { secrets: ["GEMINI_API_KEY"], cors: true },
  async (request) => {
    // Initialize Gemini using the secret from process.env inside the request
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const db = admin.firestore();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated to talk with pet.");
    }

    const { heroId, message, currentHabit, petId } = (request.data || {}) as ChatWithPetData;
    if (!heroId || !message) {
      throw new HttpsError("invalid-argument", "Missing heroId or message.");
    }

  // Enforce Parental Controls from Firestore
  const settingsDoc = await db.collection("heroes").doc(heroId).collection("settings").doc("aiCompanion").get();
  const parentRules = (settingsDoc.data() as any) || {
    companionEnabled: true,
    maxDailyTurns: 30,
    bedtimeHour: 20,
    restrictedTopics: [],
    focusAreas: ["habits"],
    tone: "energetic"
  };

  // 1. Bedtime & Availability check
  const currentHour = new Date().getHours();
  if (parentRules.companionEnabled === false || currentHour >= (parentRules.bedtimeHour ?? 20)) {
    return { reply: "*Yawn...* Rex is sleeping in his dino cave for the night! See you in the morning, Little Hero!" };
  }

  // 2. Inject Parent Directives into Rex's System Instruction
  const injectedSystemInstruction = `
${REX_SYSTEM_INSTRUCTION}
PARENTAL RESTRICTIONS:
- Current Tone Style: ${parentRules.tone || "energetic"}
- Priority Habit Topics to Encourage: ${(parentRules.focusAreas || ["habits"]).join(", ")}
- FORBIDDEN TOPICS (Never discuss): ${(parentRules.restrictedTopics || []).join(", ")}
`;

  // 3. Fetch recent chat history (last 6 interactions)
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

  // 4. Query Gemini with Rex's persona & parent directives
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: injectedSystemInstruction,
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

