import * as admin from "firebase-admin";

admin.initializeApp();

export { chatWithPet } from "./petCompanion";
export { verifyChoreSubmission } from "./subagents";
export { getParentInsights, updateCompanionSettings } from "./parentPortal";

