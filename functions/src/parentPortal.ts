// Parent Portal Insights & Controls Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export interface ParentSettings {
  companionEnabled: boolean;
  maxDailyTurns: number;
  bedtimeHour: number; // e.g. 20 for 8 PM
  restrictedTopics: string[];
  focusAreas: string[]; // e.g. ["homework", "cleaning"]
  tone: "gentle" | "energetic" | "focused";
}

export const updateCompanionSettings = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only parents can update settings.");
  }

  const { heroId, settings } = (request.data || {}) as { heroId: string; settings: Partial<ParentSettings> };
  if (!heroId) {
    throw new HttpsError("invalid-argument", "Missing heroId.");
  }

  // Verify caller has parental permission over this hero doc
  const heroRef = db.collection("heroes").doc(heroId);
  const heroSnap = await heroRef.get();

  if (!heroSnap.exists) {
    await heroRef.set({ parentUid: request.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } else if (heroSnap.data()?.parentUid && heroSnap.data()?.parentUid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Unauthorized parent account.");
  } else if (!heroSnap.data()?.parentUid) {
    await heroRef.set({ parentUid: request.auth.uid }, { merge: true });
  }

  await heroRef.collection("settings").doc("aiCompanion").set(settings, { merge: true });
  return { status: "success", updated: settings };
});

export interface ParentInsightsRequest {
  householdName?: string;
  heroes?: Array<{
    name: string;
    level: number;
    points: number;
    coins: number;
    streak: number;
    difficulty?: string;
  }>;
  completedHabitsCount?: number;
  pendingApprovalsCount?: number;
}

export const getParentInsights = onCall({ secrets: ["GEMINI_API_KEY"], cors: true }, async (request) => {
  const data = request.data as ParentInsightsRequest;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || undefined });

  const household = data.householdName || "The Hero Family";
  const heroesSummary = data.heroes
    ? data.heroes.map((h) => `${h.name} (Level ${h.level}, ${h.points} ⭐ Points, ${h.coins} 🪙 Tokens, ${h.streak}-day streak)`).join("; ")
    : "Active heroes in household";

  const prompt = `You are an expert pediatric psychologist and positive reinforcement parenting advisor in Little Hero Adventures.
Analyze the following household progress:
Household: "${household}"
Children Overview: ${heroesSummary}
Total Completed Habits: ${data.completedHabitsCount ?? 5}
Pending Approvals: ${data.pendingApprovalsCount ?? 0}

Generate a concise, uplifting Parent Insight report in valid JSON:
{
  "executiveSummary": "Brief overview of family momentum",
  "praiseHighlights": ["Highlight 1", "Highlight 2"],
  "parentTips": ["Tip 1", "Tip 2"],
  "recommendedReward": "Suggested bonding activity or real-life reward"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL
        }
      }
    });

    let insights: any = null;
    try {
      insights = JSON.parse(response.text || "{}");
    } catch {
      insights = {
        executiveSummary: "Your little heroes are building strong daily habits and demonstrating great consistency!",
        praiseHighlights: ["Consistent daily routine completion", "Great enthusiasm for learning quests"],
        parentTips: ["Praise effort rather than perfection", "Celebrate small milestones together"],
        recommendedReward: "Family movie night or special park outing"
      };
    }

    return {
      household,
      insights,
      generatedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error in getParentInsights:", error);
    throw new HttpsError("internal", error.message || "Failed to generate parent insights.");
  }
});
