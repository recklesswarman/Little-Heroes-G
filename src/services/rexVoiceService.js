import { talkToRex } from "./heroAgentService.js";
import { speakCompanion } from "./voiceService.js";
import { store } from "../state/store.js";

/**
 * Legacy wrapper: sends a message to Rex or active pet companion and speaks response aloud
 */
export async function askRex(heroId, message, currentHabit = null, petId = null) {
  const effectivePetId = petId || store.getActivePet?.()?.id || "rex";
  const reply = await talkToRex(message, heroId, currentHabit, effectivePetId);
  speakCompanion(reply, effectivePetId);
  return reply;
}

/**
 * Legacy wrapper: speaks dialogue using the authoritative Spoken Voice Service
 */
export function speakAsRex(text, petId = null) {
  const effectivePetId = petId || store.getActivePet?.()?.id || "rex";
  speakCompanion(text, effectivePetId);
}
