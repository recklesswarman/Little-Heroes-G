import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();

// Ensure all Cloud Functions v2 deploy to us-central1
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10
});

export { chatWithPet } from "./petCompanion";
export { verifyChoreSubmission, generateDailyMicroQuests } from "./subagents";
export { getParentInsights, updateCompanionSettings } from "./parentPortal";

