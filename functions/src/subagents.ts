// Quest Evaluation Subagent Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, Type } from "@google/genai";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export interface VerifyChoreData {
  heroId: string;
  questId?: string;
  questTitle: string;
  childNotes?: string;
  photoBase64?: string;
}

export const verifyChoreSubmission = onCall(
  { secrets: ["GEMINI_API_KEY"], cors: true },
  async (request) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const db = admin.firestore();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    const { heroId, questId, questTitle, childNotes, photoBase64 } = (request.data || {}) as VerifyChoreData;
    if (!heroId || !questTitle) {
      throw new HttpsError("invalid-argument", "Missing required quest details.");
    }

  // Build evaluation payload (supports text description + optional photo proof)
  const contents: any[] = [
    { text: `Quest: "${questTitle}". Child's report: "${childNotes || "Done!"}". Evaluate if the child honestly completed this daily habit.` }
  ];

  if (photoBase64) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: photoBase64.replace(/^data:image\/\w+;base64,/, "")
      }
    });
  }

  // Step 1: Subagent verifies completion & determines fair reward
  const evalResult = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: "You are the Little Heroes Quest Arbiter. Be lenient and encouraging with young kids, but flag obviously blank or irrelevant submissions. Return structured data.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          approved: { type: Type.BOOLEAN },
          reasoning: { type: Type.STRING },
          xpEarned: { type: Type.INTEGER, description: "Between 10 and 50 XP" },
          coinsEarned: { type: Type.INTEGER, description: "Between 5 and 20 coins" },
          petReaction: { type: Type.STRING, description: "Rex the Dino celebratory cheer" }
        },
        required: ["approved", "xpEarned", "coinsEarned", "petReaction"]
      }
    }
  });

  const verdict = JSON.parse(evalResult.text!);

  // Step 2: Atomic transaction updating hero balance & quest logs
  const heroRef = db.collection("heroes").doc(heroId);

  if (verdict.approved) {
    await db.runTransaction(async (t) => {
      const heroDoc = await t.get(heroRef);
      if (!heroDoc.exists) {
        t.set(heroRef, {
          xp: verdict.xpEarned,
          coins: verdict.coinsEarned,
          streak: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        t.update(heroRef, {
          xp: admin.firestore.FieldValue.increment(verdict.xpEarned),
          coins: admin.firestore.FieldValue.increment(verdict.coinsEarned),
          streak: admin.firestore.FieldValue.increment(1)
        });
      }

      const logRef = heroRef.collection("questHistory").doc();
      t.set(logRef, {
        questId: questId || "custom_quest",
        questTitle,
        approved: true,
        xpEarned: verdict.xpEarned,
        coinsEarned: verdict.coinsEarned,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }

  return verdict;
});

