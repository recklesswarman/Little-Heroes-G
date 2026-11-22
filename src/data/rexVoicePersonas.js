// Rex's selectable voice personas.
//
// `id` is the Gemini Live prebuilt voice name used by the Live Rex bridge
// (server/geminiService.js, App Hosting and the Pi). `webSpeech` is the
// closest match on the device's built-in Web Speech voices, used everywhere
// else (GitHub Pages, Firebase static hosting) and for previews. `null`
// means "keep Rex's normal voice profile" (voiceService COMPANION_VOICE_PROFILES.rex).
export const REX_VOICE_PERSONAS = [
  { id: 'Puck', label: 'Puck', desc: 'Playful & high energy (Default)', icon: 'sentiment_very_satisfied', webSpeech: null },
  { id: 'Aoede', label: 'Aoede', desc: 'Nurturing & clear teacher tone', icon: 'school', webSpeech: { pitch: 1.10, rate: 0.95, preferred: ['samantha', 'serena', 'aria', 'jenny', 'google us english'] } },
  { id: 'Charon', label: 'Charon', desc: 'Deep & calm dino elder', icon: 'elderly', webSpeech: { pitch: 0.85, rate: 0.88, preferred: ['arthur', 'guy', 'christopher', 'google uk english male', 'daniel'] } },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Fast, bold & adventurous', icon: 'speed', webSpeech: { pitch: 1.05, rate: 1.10, preferred: ['oliver', 'liam', 'ryan', 'daniel', 'google us english'] } },
  { id: 'Kore', label: 'Kore', desc: 'Gentle, soft & soothing', icon: 'spa', webSpeech: { pitch: 1.05, rate: 0.88, preferred: ['samantha', 'siri', 'karen', 'sonia', 'google uk english female'] } }
];

export const REX_VOICE_IDS = REX_VOICE_PERSONAS.map((p) => p.id);

/** Persona for an id (case-insensitive); unknown or empty ids fall back to Puck. */
export function getRexVoicePersona(id) {
  const key = String(id || '').toLowerCase();
  return REX_VOICE_PERSONAS.find((p) => p.id.toLowerCase() === key) || REX_VOICE_PERSONAS[0];
}
