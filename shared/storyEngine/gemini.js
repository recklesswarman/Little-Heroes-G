// Adapter: wraps a @google/genai client as the engine's generate(prompt, opts) -> text function.
// Kept free of imports so it works from Express and from Cloud Functions alike.

const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT'
].map(category => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

// Same general-purpose model the chat route uses (see server/geminiService.js). Override per
// deployment with GEMINI_STORY_MODEL (set by the callers) when a model is retired or renamed.
export const DEFAULT_STORY_MODEL = 'gemini-3.7-flash';

export function makeGeminiGenerate(ai, { model = DEFAULT_STORY_MODEL } = {}) {
  if (!ai) return null;
  return async function generate(prompt, { json = false, temperature = 0.8, maxOutputTokens = 1400 } = {}) {
    const base = { temperature, maxOutputTokens, safetySettings: SAFETY_SETTINGS };
    const call = async (config) => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config
      });
      return response.text || '';
    };
    try {
      return await call({
        ...base,
        // Thinking tokens count against maxOutputTokens and truncate long JSON; story text needs none.
        thinkingConfig: { thinkingBudget: 0 },
        ...(json ? { responseMimeType: 'application/json' } : {})
      });
    } catch (err) {
      // If the API rejected an optional setting, retry once with plain options (safety settings stay).
      console.warn(`Story model call failed (${model}); retrying with plain options:`, err?.message || err);
      try {
        return await call(base);
      } catch (err2) {
        console.warn(`Story model call failed again (${model}):`, err2?.message || err2);
        throw err2;
      }
    }
  };
}
