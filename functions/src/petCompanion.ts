// Pet Companion Cloud Function powered by Google Gemini SDK (@google/genai)

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { buildPetSystemInstruction, DEFAULT_PET_PROMPTS, PetStats } from "./prompts/petPrompts";

export interface ChatWithPetRequest {
  petId?: string;
  petName?: string;
  message: string;
  petStats?: PetStats;
  childAge?: number;
  personality?: string;
}

export const chatWithPet = onCall({ cors: true }, async (request) => {
  const data = request.data as ChatWithPetRequest;

  if (!data || !data.message || typeof data.message !== "string") {
    throw new HttpsError("invalid-argument", "A valid 'message' string is required.");
  }

  const petKey = (data.petId || "rex").toLowerCase();
  const defaultMeta = DEFAULT_PET_PROMPTS[petKey] || DEFAULT_PET_PROMPTS.rex;
  const petName = data.petName || (petKey.charAt(0).toUpperCase() + petKey.slice(1));
  const species = defaultMeta.species;
  const personality = data.personality || defaultMeta.personality;

  const systemInstruction = buildPetSystemInstruction(
    petName,
    species,
    personality,
    data.petStats,
    data.childAge
  );

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || undefined });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: data.message,
      config: {
        systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL
        }
      }
    });

    const reply = response.text || `*${petName} jumps up and down happily!*`;

    return {
      reply,
      petName,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error in chatWithPet function:", error);
    throw new HttpsError("internal", error.message || "Failed to generate pet response.");
  }
});
