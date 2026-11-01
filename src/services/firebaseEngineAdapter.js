// Adapter: wraps a Firebase AI Logic model (the browser SDK) as the story engine's
// generate(prompt, { json, temperature, maxOutputTokens }) -> Promise<string>.
// Lets the same engine that runs on the server run in the browser on hosts with no backend
// (GitHub Pages, classic Firebase Hosting). Kept free of SDK imports so it can be unit-tested
// with a mock model.

export function makeFirebaseGenerate(model) {
  if (!model || typeof model.generateContent !== 'function') return null;

  const call = async (prompt, generationConfig) => {
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig });
    // response.text() throws when the reply was blocked by the safety settings; an empty reply is unusable too.
    const text = result?.response?.text?.();
    if (!text || !String(text).trim()) throw new Error('empty or blocked model response');
    return String(text);
  };

  return async function generate(prompt, { json = false, temperature = 0.8, maxOutputTokens = 1400 } = {}) {
    const base = { temperature, maxOutputTokens, ...(json ? { responseMimeType: 'application/json' } : {}) };
    try {
      // Thinking tokens count against maxOutputTokens and truncate long JSON; story text needs none.
      return await call(prompt, { ...base, thinkingConfig: { thinkingBudget: 0 } });
    } catch (err) {
      // If the SDK or model rejected the optional thinking setting, retry once with plain options.
      console.warn('Story model call failed in the browser; retrying with plain options:', err?.message || err);
      return call(prompt, base);
    }
  };
}
