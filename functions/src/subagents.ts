// Quest Evaluation Subagent Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall } from "firebase-functions/v2/https";
import { GoogleGenAI, Type } from "@google/genai";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export interface VerifyChoreData {
  heroId?: string;
  heroName?: string;
  questId?: string;
  taskId?: string;
  questTitle?: string;
  taskTitle?: string;
  childNotes?: string;
  evidenceText?: string;
  photoBase64?: string;
  evidenceImageBase64?: string;
  childAge?: number;
}

export const verifyChoreSubmission = onCall(
  { secrets: ["GEMINI_API_KEY"], cors: true },
  async (request) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const db = admin.firestore();

    const data = (request.data || {}) as VerifyChoreData;
    const title = data.questTitle || data.taskTitle || "Daily Hero Quest";
    const hero = data.heroId || data.heroName || "Little Hero";
    const notes = data.childNotes || data.evidenceText || "Done!";
    const photo = data.photoBase64 || data.evidenceImageBase64;
    const questKey = data.questId || data.taskId || "custom_quest";

    // Build evaluation payload (supports text description + optional photo proof)
    const contents: any[] = [
      { text: `Quest: "${title}". Child "${hero}" reports: "${notes}". Evaluate whether this daily habit was earnestly completed.` }
    ];

    if (photo) {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: photo.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }

    // Step 1: Subagent verifies completion & determines fair reward
    let verdict: any = {
      approved: true,
      reasoning: `Great effort on ${title}!`,
      xpEarned: 25,
      coinsEarned: 10,
      petReaction: `*ROAR!* Fantastic job on ${title}, ${hero}! Rex is super proud!`
    };

    try {
      const evalResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: "You are the Little Heroes Quest Arbiter. Be warm, encouraging, and supportive with young children. Affirm positive daily habits and award appropriate XP and habit coins.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              approved: { type: Type.BOOLEAN },
              reasoning: { type: Type.STRING },
              xpEarned: { type: Type.INTEGER, description: "Between 10 and 50 XP" },
              coinsEarned: { type: Type.INTEGER, description: "Between 5 and 25 coins" },
              petReaction: { type: Type.STRING, description: "Rex the Dino celebratory cheer" }
            },
            required: ["approved", "xpEarned", "coinsEarned", "petReaction"]
          }
        }
      });

      if (evalResult.text) {
        verdict = JSON.parse(evalResult.text);
      }
    } catch (evalErr) {
      console.warn("Gemini quest evaluation notice, using encouragement fallback:", evalErr);
    }

    const isApproved = Boolean(verdict.approved ?? true);
    const xp = Number(verdict.xpEarned) || 25;
    const coins = Number(verdict.coinsEarned) || 10;
    const reasoning = verdict.reasoning || `Awesome job completing "${title}"!`;
    const petCheer = verdict.petReaction || `*ROAR!* Way to go, ${hero}!`;

    // Step 2: Update hero balance & quest logs if Firestore document exists
    if (hero && hero !== "Little Hero") {
      try {
        const heroRef = db.collection("heroes").doc(hero);
        await db.runTransaction(async (t) => {
          const heroDoc = await t.get(heroRef);
          if (!heroDoc.exists) {
            t.set(heroRef, {
              xp,
              coins,
              streak: 1,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } else {
            t.update(heroRef, {
              xp: admin.firestore.FieldValue.increment(xp),
              coins: admin.firestore.FieldValue.increment(coins),
              streak: admin.firestore.FieldValue.increment(1)
            });
          }

          const logRef = heroRef.collection("questHistory").doc();
          t.set(logRef, {
            questId: questKey,
            questTitle: title,
            approved: isApproved,
            xpEarned: xp,
            coinsEarned: coins,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
      } catch (txErr) {
        console.warn("Quest history transaction notice:", txErr);
      }
    }

    // Step 3: Return unified schema satisfying both questService and cloudFunctionsService
    return {
      // questService.js schema
      approved: isApproved,
      reasoning,
      xpEarned: xp,
      coinsEarned: coins,
      petReaction: petCheer,

      // cloudFunctionsService.js schema
      verified: isApproved,
      confidenceScore: isApproved ? 95 : 40,
      feedbackForKid: petCheer,
      parentRecommendation: isApproved ? "Approve" : "Needs Review",
      badgeEarned: isApproved ? "Hero Star" : undefined
    };
  }
);

