// Chore Verification Subagent Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export interface VerifyChoreRequest {
  taskId: string;
  taskTitle: string;
  heroName?: string;
  childAge?: number;
  evidenceText?: string;
  evidenceImageBase64?: string; // base64 encoded photo of completed chore
  imageMimeType?: string;
}

export const verifyChoreSubmission = onCall({ cors: true }, async (request) => {
  const data = request.data as VerifyChoreRequest;

  if (!data || !data.taskTitle) {
    throw new HttpsError("invalid-argument", "'taskTitle' is required.");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || undefined });

  const heroName = data.heroName || "Little Hero";
  const childAge = data.childAge || 5;

  const prompt = `You are a supportive, encouraging AI Chore Supervisor & Subagent for parents in Little Hero Adventures.
Evaluate the following completed chore submission for ${heroName} (Age: ${childAge}):
Chore Title: "${data.taskTitle}"
Evidence provided: "${data.evidenceText || "Task marked as completed by the child."}"

Respond in pure valid JSON format with the following fields:
{
  "verified": true,
  "confidenceScore": 95,
  "feedbackForKid": "Outstanding job making your hero bed, ${heroName}! The pillows look super neat!",
  "parentRecommendation": "Approve",
  "badgeEarned": "Tidy Room Champion"
}`;

  const contents: any[] = [];
  if (data.evidenceImageBase64) {
    contents.push({
      inlineData: {
        data: data.evidenceImageBase64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: data.imageMimeType || "image/jpeg"
      }
    });
  }
  contents.push(prompt);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL
        }
      }
    });

    let resultJson: any = null;
    try {
      resultJson = JSON.parse(response.text || "{}");
    } catch {
      resultJson = {
        verified: true,
        confidenceScore: 90,
        feedbackForKid: `Awesome effort on ${data.taskTitle}, ${heroName}!`,
        parentRecommendation: "Approve",
        badgeEarned: "Hero Star"
      };
    }

    return {
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      heroName,
      evaluation: resultJson,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error in verifyChoreSubmission subagent:", error);
    throw new HttpsError("internal", error.message || "Failed to verify chore submission.");
  }
});
