// Little Heroes Multi-Subagent Coordination & Autonomous Quest Generation
// Powered by Google Gemini 2.5 Flash SDK (@google/genai)
// Implements specialized subagent delegation:
//   1. Safety & Topic Moderation Subagent
//   2. Habit Verification Subagent
//   3. Progression & Reward Subagent
//   4. Autonomous Micro-Quest Generator Subagent

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
  petId?: string;
}

// -------------------------------------------------------------------------
// SUBAGENT 1: Safety & Topic Moderation Subagent
// -------------------------------------------------------------------------
async function moderateSubmission(
  ai: GoogleGenAI,
  notes: string,
  photo?: string
): Promise<{ isSafe: boolean; feedback: string }> {
  try {
    const contents: any[] = [
      {
        text: `Evaluate this child chore submission note for child-safety issues, inappropriate language, or dangerous activities: "${notes}". Respond in JSON with isSafe boolean and gentle feedback.`
      }
    ];

    if (photo) {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: photo.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: "You are the Little Heroes Safety Guardian subagent. Ensure content is 100% wholesome, safe, and family-friendly for toddlers and young children.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["isSafe", "feedback"]
        },
        maxOutputTokens: 80
      }
    });

    if (res.text) {
      const parsed = JSON.parse(res.text);
      return { isSafe: Boolean(parsed.isSafe), feedback: parsed.feedback || "Content checked." };
    }
  } catch (err) {
    console.warn("Safety subagent notice, defaulting to safe:", err);
  }
  return { isSafe: true, feedback: "Safe" };
}

// -------------------------------------------------------------------------
// SUBAGENT 2: Habit Verification Subagent
// -------------------------------------------------------------------------
async function evaluateHabitProof(
  ai: GoogleGenAI,
  title: string,
  hero: string,
  notes: string,
  photo?: string
): Promise<{ verified: boolean; confidenceScore: number; reasoning: string }> {
  try {
    const contents: any[] = [
      {
        text: `Task: "${title}". Child "${hero}" reports: "${notes}". Evaluate whether this daily habit was earnestly attempted or completed. Be lenient and encouraging with young kids.`
      }
    ];

    if (photo) {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: photo.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: "You are the Little Heroes Habit Verification Subagent. Assess honesty and effort with warm positive reinforcement.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verified: { type: Type.BOOLEAN },
            confidenceScore: { type: Type.INTEGER, description: "Between 50 and 99" },
            reasoning: { type: Type.STRING }
          },
          required: ["verified", "confidenceScore", "reasoning"]
        },
        maxOutputTokens: 100
      }
    });

    if (res.text) {
      const parsed = JSON.parse(res.text);
      return {
        verified: Boolean(parsed.verified ?? true),
        confidenceScore: Number(parsed.confidenceScore) || 92,
        reasoning: parsed.reasoning || `Great effort on ${title}!`
      };
    }
  } catch (err) {
    console.warn("Habit verification subagent notice:", err);
  }
  return { verified: true, confidenceScore: 88, reasoning: `Great job on ${title}!` };
}

// -------------------------------------------------------------------------
// SUBAGENT 3: Progression & Reward Subagent
// -------------------------------------------------------------------------
async function calculateRewardsAndProgression(
  ai: GoogleGenAI,
  title: string,
  hero: string,
  verified: boolean,
  petId: string = "rex"
): Promise<{ xpEarned: number; coinsEarned: number; petReaction: string; parentRecommendation: string }> {
  if (!verified) {
    return {
      xpEarned: 5,
      coinsEarned: 2,
      petReaction: "*Warm hug!* Nice try, Little Hero! Let's do it together!",
      parentRecommendation: "Needs Review"
    };
  }

  try {
    const prompt = `Calculate fair gamified rewards for completing daily habit "${title}" by "${hero}". Companion pet: "${petId}". Return structured JSON with fair XP (15-50), coins (10-25), pet reaction, and parent recommendation.`;
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the Little Heroes Progression & Reward Subagent. Calculate positive reinforcement currency and companion cheers.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            xpEarned: { type: Type.INTEGER },
            coinsEarned: { type: Type.INTEGER },
            petReaction: { type: Type.STRING },
            parentRecommendation: { type: Type.STRING }
          },
          required: ["xpEarned", "coinsEarned", "petReaction", "parentRecommendation"]
        },
        maxOutputTokens: 120
      }
    });

    if (res.text) {
      const parsed = JSON.parse(res.text);
      return {
        xpEarned: Number(parsed.xpEarned) || 30,
        coinsEarned: Number(parsed.coinsEarned) || 15,
        petReaction: parsed.petReaction || `*ROAR!* Super job on ${title}, ${hero}!`,
        parentRecommendation: parsed.parentRecommendation || "Approve"
      };
    }
  } catch (err) {
    console.warn("Reward subagent notice:", err);
  }
  return {
    xpEarned: 25,
    coinsEarned: 10,
    petReaction: `*ROAR!* Fantastic job, ${hero}!`,
    parentRecommendation: "Approve"
  };
}

// -------------------------------------------------------------------------
// MASTER ORCHESTRATOR: verifyChoreSubmission
// -------------------------------------------------------------------------
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
    const pet = data.petId || "rex";

    // 1. Delegate to Safety Subagent
    const safetyCheck = await moderateSubmission(ai, notes, photo);
    if (!safetyCheck.isSafe) {
      return {
        approved: false,
        verified: false,
        confidenceScore: 0,
        reasoning: safetyCheck.feedback,
        feedbackForKid: "Let's make sure our hero quests stay safe and fun! Ask a parent for help!",
        xpEarned: 0,
        coinsEarned: 0,
        petReaction: "*Gentle hug!* Let's stay safe, Little Hero!",
        parentRecommendation: "Flagged by Safety Subagent"
      };
    }

    // 2. Delegate to Habit Verification Subagent
    const verification = await evaluateHabitProof(ai, title, hero, notes, photo);

    // 3. Delegate to Progression & Reward Subagent
    const rewards = await calculateRewardsAndProgression(ai, title, hero, verification.verified, pet);

    // 4. Update Firestore progression & ledger if hero exists
    if (hero && hero !== "Little Hero") {
      try {
        const heroRef = db.collection("heroes").doc(hero);
        await db.runTransaction(async (t) => {
          const heroDoc = await t.get(heroRef);
          if (!heroDoc.exists) {
            t.set(
              heroRef,
              {
                xp: rewards.xpEarned,
                coins: rewards.coinsEarned,
                streak: 1,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              },
              { merge: true }
            );
          } else {
            t.update(heroRef, {
              xp: admin.firestore.FieldValue.increment(rewards.xpEarned),
              coins: admin.firestore.FieldValue.increment(rewards.coinsEarned),
              streak: admin.firestore.FieldValue.increment(1)
            });
          }

          const logRef = heroRef.collection("questHistory").doc();
          t.set(logRef, {
            questId: questKey,
            questTitle: title,
            approved: verification.verified,
            confidenceScore: verification.confidenceScore,
            xpEarned: rewards.xpEarned,
            coinsEarned: rewards.coinsEarned,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
      } catch (txErr) {
        console.warn("Chore submission Firestore transaction notice:", txErr);
      }
    }

    // 5. Unified dual-schema output
    return {
      // questService.js schema
      approved: verification.verified,
      reasoning: verification.reasoning,
      xpEarned: rewards.xpEarned,
      coinsEarned: rewards.coinsEarned,
      petReaction: rewards.petReaction,

      // cloudFunctionsService.js schema
      verified: verification.verified,
      confidenceScore: verification.confidenceScore,
      feedbackForKid: rewards.petReaction,
      parentRecommendation: rewards.parentRecommendation,
      badgeEarned: verification.verified ? "Hero Star" : undefined
    };
  }
);

// -------------------------------------------------------------------------
// AUTONOMOUS QUEST GENERATION SUBAGENT: generateDailyMicroQuests
// -------------------------------------------------------------------------
export interface MicroQuestRequest {
  heroId?: string;
  childName?: string;
  ageTier?: "toddler" | "kid";
  completedHabits?: string[];
  focusAreas?: string[];
  petId?: string;
}

export const generateDailyMicroQuests = onCall(
  { secrets: ["GEMINI_API_KEY"], cors: true },
  async (request) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const data = (request.data || {}) as MicroQuestRequest;

    const child = data.childName || data.heroId || "Little Hero";
    const isToddler = data.ageTier === "toddler";
    const pet = data.petId || "rex";
    const completed = (data.completedHabits || []).join(", ") || "Morning basics";
    const focus = (data.focusAreas || ["brushing_teeth", "cleaning_toys"]).join(", ");

    const prompt = `Generate 3 delightful daily micro-quests for child hero "${child}" (Age tier: ${isToddler ? "Toddler 3-4 years old" : "Kid 5-8 years old"}).
Companion: "${pet}".
Completed so far: "${completed}".
Family habit focus areas: "${focus}".
Tailor the tasks to be fun, actionable, and age-appropriate (e.g. for toddlers, 1-minute fun tasks like finding 5 red toys, drinking fresh water, or toothbrush battle; for kids, reading 15m, organizing desk, folding clothes).`;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the Little Heroes Autonomous Quest Architect. Generate creative, engaging micro-adventures with valid Material Symbols icon ligatures.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING, description: "morning | afternoon | bedtime | active | learning" },
                timeWindow: { type: Type.STRING },
                targetAction: { type: Type.STRING },
                coinReward: { type: Type.INTEGER },
                pointReward: { type: Type.INTEGER },
                xpReward: { type: Type.INTEGER },
                petCheer: { type: Type.STRING },
                icon: { type: Type.STRING, description: "Material symbol ligature name e.g. dentistry, toys, menu_book, local_drink, bed" }
              },
              required: [
                "id",
                "title",
                "description",
                "category",
                "targetAction",
                "coinReward",
                "pointReward",
                "xpReward",
                "petCheer",
                "icon"
              ]
            }
          },
          maxOutputTokens: 600
        }
      });

      let quests: any[] = [];
      if (result.text) {
        quests = JSON.parse(result.text);
      }

      return {
        success: true,
        quests,
        generatedAt: new Date().toISOString()
      };
    } catch (err: any) {
      console.warn("Autonomous quest generation notice, using fallback set:", err);
      return {
        success: true,
        quests: [
          {
            id: `ai_quest_water_${Date.now()}`,
            title: isToddler ? "Dino Water Splash!" : "Hydration Hero Checkpoint",
            description: "Drink a full fresh cup of cool water to supercharge your hero energy!",
            category: "active",
            timeWindow: "Anytime",
            targetAction: "Drink water",
            coinReward: 25,
            pointReward: 10,
            xpReward: 35,
            petCheer: "*Splish splash!* High five for drinking water!",
            icon: "local_drink"
          },
          {
            id: `ai_quest_toys_${Date.now()}`,
            title: isToddler ? "5-Toy Tidy Race!" : "Toy Chest Speed Clear",
            description: "Put away 5 toys or blocks neatly into the hero toy bin!",
            category: "afternoon",
            timeWindow: "Afternoon",
            targetAction: "Clean toys",
            coinReward: 30,
            pointReward: 15,
            xpReward: 40,
            petCheer: "*Happy stomp!* The playroom looks amazing!",
            icon: "toys"
          },
          {
            id: `ai_quest_story_${Date.now()}`,
            title: isToddler ? "Picture Book Explorer" : "Storybook Scholar",
            description: "Flip through a favorite hero book and discover 3 colorful pictures!",
            category: "learning",
            timeWindow: "Evening",
            targetAction: "Read book",
            coinReward: 35,
            pointReward: 20,
            xpReward: 45,
            petCheer: "*Flap flap!* Reading makes your brain so strong!",
            icon: "menu_book"
          }
        ],
        generatedAt: new Date().toISOString()
      };
    }
  }
);
