import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// Ensure all Cloud Functions v2 deploy to us-central1
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10
});

export { chatWithPet } from "./petCompanion";
export { verifyChoreSubmission, generateDailyMicroQuests } from "./subagents";
export { getParentInsights, updateCompanionSettings } from "./parentPortal";
