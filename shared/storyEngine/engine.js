// Story engine orchestrator: request -> bible (planned once) -> chapter (written, validated,
// repaired) -> formatted response. The model call and the offline weaver are injected, so this
// module has no SDK/DOM dependencies and runs unchanged in Express, Cloud Functions and tests.
//
//   generate(prompt, { json, temperature, maxOutputTokens }) -> Promise<string>
//   proceduralChapter(chapterIndex)                          -> chapter-shaped object (offline weaver)

import { cleanName, cleanField, sanitizeWish } from './safety.js';
import { parseJsonLoose } from './json.js';
import { TONES, buildBiblePrompt, fallbackBible, normalizeBible } from './bible.js';
import { writeChapter } from './writer.js';
import { formatChapter } from './formatter.js';

const AGE_BANDS = ['3-4', '5-6', '7-8'];

/**
 * Build the normalized request. Only the hero name is required; everything else is a suggestion
 * the planner may use or skip. `realm`/`moral` are catalog objects resolved by the caller.
 */
export function buildRequest(body = {}, { realm, moral } = {}) {
  const avoidTopics = Array.isArray(body.avoidTopics)
    ? body.avoidTopics.map(t => cleanName(String(t), '', 30).toLowerCase()).filter(t => t.length > 1).slice(0, 20)
    : [];
  return {
    heroName: cleanName(body.heroName, 'Little Hero'),
    petName: body.petName ? cleanName(body.petName, '', 30) : '',
    realm: realm || null,
    moral: moral || null,
    customWish: sanitizeWish(body.customWish, { avoidTopics }),
    magicItem: cleanField(body.magicItem, 40) || '',
    tone: TONES.includes(body.tone) ? body.tone : 'calm',
    ageBand: AGE_BANDS.includes(body.ageBand) ? body.ageBand : '5-6',
    avoidTopics,
    userChoices: (Array.isArray(body.userChoices) ? body.userChoices : [])
      .map(c => cleanField(typeof c === 'string' ? c : '', 60)).slice(0, 4)
  };
}

function cleanSummaries(list) {
  return (Array.isArray(list) ? list : [])
    .map(s => cleanField(typeof s === 'string' ? s : (s && s.summary) || '', 240))
    .filter(Boolean).slice(0, 3);
}

export async function planBible({ generate, request, recentTitles = [], recentArchetypes = [], research = [] }) {
  if (!generate) return { bible: fallbackBible(request), planned: false };
  try {
    const text = await generate(
      buildBiblePrompt(request, { recentTitles, recentArchetypes, research }),
      { json: true, temperature: 0.9, maxOutputTokens: 1800 }
    );
    const raw = parseJsonLoose(text);
    if (raw && Array.isArray(raw.characters) && raw.plotDNA) {
      return { bible: normalizeBible(raw, request), planned: true };
    }
  } catch (err) {
    // fall through to the deterministic bible
  }
  return { bible: fallbackBible(request), planned: false };
}

/**
 * Generate one chapter. `bible` and `previousSummaries` come back from the client for chapters 2-4
 * (the server is stateless); both are re-normalized because they are untrusted.
 */
export async function generateBedtimeChapter({
  generate,
  request,
  chapterIndex,
  bible: suppliedBible = null,
  previousSummaries = [],
  recentTitles = [],
  recentArchetypes = [],
  research = [],
  proceduralChapter
}) {
  const idx = Math.max(0, Math.min(3, Number(chapterIndex) || 0));
  let bible = suppliedBible ? normalizeBible(suppliedBible, request) : null;
  if (!bible) {
    ({ bible } = await planBible({ generate, request, recentTitles, recentArchetypes, research }));
  }
  const previous = cleanSummaries(previousSummaries);

  if (generate) {
    const result = await writeChapter({ generate, request, bible, chapterIndex: idx, previous });
    if (result.ok) {
      return {
        bible,
        source: 'llm',
        attempts: result.attempts,
        issues: [],
        chapter: formatChapter({ chapter: result.chapter, bible, request, chapterIndex: idx, source: 'llm' })
      };
    }
    const failure = result.issues;
    const fallback = proceduralChapter ? proceduralChapter(idx) : { chapterText: '' };
    return {
      bible,
      source: 'procedural',
      attempts: result.attempts,
      issues: failure,
      chapter: formatChapter({ chapter: fallback, bible, request, chapterIndex: idx, source: 'procedural' })
    };
  }

  const offline = proceduralChapter ? proceduralChapter(idx) : { chapterText: '' };
  return {
    bible,
    source: 'procedural',
    attempts: 0,
    issues: [],
    chapter: formatChapter({ chapter: offline, bible, request, chapterIndex: idx, source: 'procedural' })
  };
}

/** One-shot: all four chapters in sequence, each seeing the summaries of the ones before it. */
export async function generateBedtimeStory(args) {
  const summaries = [];
  const chapters = [];
  let bible = args.bible || null;
  const sources = [];
  for (let i = 0; i < 4; i++) {
    const out = await generateBedtimeChapter({ ...args, bible, chapterIndex: i, previousSummaries: summaries });
    bible = out.bible;
    chapters.push(out.chapter);
    summaries.push(out.chapter.summary);
    sources.push(out.source);
  }
  return { bible, chapters, sources };
}
