// Parent Portal Insights Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

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

export const getParentInsights = onCall({ cors: true }, async (request) => {
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
