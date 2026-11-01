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
import {
  REPEAT_THRESHOLD, buildAvoidList, cleanLedgerDigest, cleanRecurring,
  buildRecentTypes, closestMatch, findNearDuplicate, fingerprintFromBible
} from './ledger.js';
import { CLEAN_SEED_POOL, pickSeeds, hashString, SEEDS_PER_STORY } from './seeds.js';
import { compressLook } from './scenes.js';
import { PET_PRONOUN_CHOICES, normalizeStoryControls, cleanReason } from './controls.js';

const MAX_PLAN_ATTEMPTS = 3;
const round2 = (n) => Math.round(n * 100) / 100;

const AGE_BANDS = ['3-4', '5-6', '7-8'];
const PRONOUNS = ['they', 'she', 'he'];

/** "Rex the T-Rex" -> "T-Rex". The pet catalog stores the species inside the pet's full name. */
export function petSpeciesFromName(fullName) {
  const m = String(fullName || '').match(/\bthe\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/**
 * Build the normalized request. Only the hero name is required; everything else is a suggestion
 * the planner may use or skip. `realm`/`moral` are catalog objects resolved by the caller.
 */
export function buildRequest(body = {}, { realm, moral } = {}) {
  const avoidTopics = Array.isArray(body.avoidTopics)
    ? body.avoidTopics.map(t => cleanName(String(t), '', 30).toLowerCase()).filter(t => t.length > 1).slice(0, 20)
    : [];
  const customWish = sanitizeWish(body.customWish, { avoidTopics });
  return {
    heroName: cleanName(body.heroName, 'Little Hero'),
    petName: body.petName ? cleanName(body.petName, '', 30) : '',
    // Species of the companion (e.g. "T-Rex", "Dragon"): lets the story describe the pet correctly.
    petSpecies: body.petSpecies ? cleanName(body.petSpecies, '', 30) : '',
    // How the child's chosen avatar looks, in a few words (from a fixed table in the app). Used only
    // for the pictures; never a photo and never the child's name.
    heroLook: compressLook(body.heroLook),
    // Never guessed from the child's name. Neutral unless a parent chose otherwise.
    pronouns: PRONOUNS.includes(body.pronouns) ? body.pronouns : 'they',
    // The pet is a living companion; neutral unless a parent chose otherwise.
    petPronouns: PET_PRONOUN_CHOICES.includes(body.petPronouns) ? body.petPronouns : 'they',
    // Parent switches: web-derived story sparks on/off, and the parent's own checked story ideas.
    researchEnabled: body.researchEnabled !== false,
    parentIdeas: normalizeStoryControls({ parentIdeas: body.parentIdeas }).parentIdeas,
    realm: realm || null,
    moral: moral || null,
    customWish,
    // True when a wish was given but could not be used (filtered or against an avoid-topic): for the safety log.
    wishDropped: typeof body.customWish === 'string' && body.customWish.trim().length > 0 && !customWish,
    magicItem: cleanField(body.magicItem, 40) || '',
    tone: TONES.includes(body.tone) ? body.tone : 'calm',
    ageBand: AGE_BANDS.includes(body.ageBand) ? body.ageBand : '5-6',
    avoidTopics,
    userChoices: (Array.isArray(body.userChoices) ? body.userChoices : [])
      .map(c => cleanField(typeof c === 'string' ? c : '', 60)).slice(0, 4),
    // Plot fingerprints of this child's earlier stories, and friends they have met (untrusted input).
    ledgerDigest: cleanLedgerDigest(body.ledgerDigest),
    recurringCharacters: cleanRecurring(body.recurringCharacters)
  };
}

function cleanSummaries(list) {
  return (Array.isArray(list) ? list : [])
    .map(s => cleanField(typeof s === 'string' ? s : (s && s.summary) || '', 240))
    .filter(Boolean).slice(0, 3);
}

function checkAgainstLedger(bible, ledger) {
  const best = closestMatch(fingerprintFromBible(bible), ledger);
  return { closestScore: round2(best.score), repeated: best.score >= REPEAT_THRESHOLD };
}

// `planned`: the model's plan was used (false = the offline plan was). `typed`: it carried valid
// theme labels, which the ledger needs to see repeated themes.
const typedOf = (bible) => !!(bible?.plotDNA?.problemType && bible?.plotDNA?.twistType);

/**
 * Plan the story. If the plot is too close to one the child already had, plan again with the
 * colliding ideas on an avoid list (up to MAX_PLAN_ATTEMPTS). If every attempt collides, keep the
 * least similar one: a slightly familiar story beats failing or falling back to offline text.
 * `ledgerCheck` is numbers and flags only, safe to return to the client.
 */
export async function planBible({ generate, request, recentTitles = [], recentArchetypes = [], research = [], seedPool = CLEAN_SEED_POOL, now = new Date() }) {
  const ledger = request.ledgerDigest || [];
  // Fresh story sparks: caller-supplied ideas win. Otherwise the parent's own ideas come first (up to 2),
  // then reviewed seeds fill the rest unless the parent turned research off. Only suggestions.
  const key = `${request.heroName}|${ledger.length}|${request.realm?.id || ''}`;
  let ideas = [];
  let seeds = [];
  if (!research.length) {
    ideas = (request.parentIdeas || [])
      .map(text => ({ text, order: hashString(`${key}|${text}`) }))
      .sort((a, b) => a.order - b.order).slice(0, 2).map(x => x.text);
    const want = SEEDS_PER_STORY - ideas.length;
    if (request.researchEnabled !== false && want > 0) seeds = pickSeeds(seedPool, { ledger, date: now, key, n: want });
    research = [...ideas, ...seeds.map(s => s.text)];
  }
  const researchUsed = [...ideas.map(() => 'parent'), ...seeds.map(s => s.id)];
  if (!generate) {
    const bible = fallbackBible(request);
    return { bible, planned: false, researchUsed: [], ledgerCheck: { attempts: 0, planned: false, typed: typedOf(bible), ...checkAgainstLedger(bible, ledger) } };
  }

  let avoid = buildAvoidList(ledger);
  let recentTypes = buildRecentTypes(ledger);
  let best = null;
  let attempts = 0;
  while (attempts < MAX_PLAN_ATTEMPTS) {
    attempts++;
    let bible = null;
    try {
      const text = await generate(
        buildBiblePrompt(request, { recentTitles, recentArchetypes, research, avoid, recentTypes }),
        { json: true, temperature: 0.9, maxOutputTokens: 3000 }
      );
      const raw = parseJsonLoose(text);
      if (raw && Array.isArray(raw.characters) && raw.plotDNA) bible = normalizeBible(raw, request);
    } catch (err) {
      console.warn('Story bible planning failed:', err?.message || err);
      break;
    }
    if (!bible) break;

    const entry = fingerprintFromBible(bible);
    const match = findNearDuplicate(entry, ledger);
    const score = match ? match.score : closestMatch(entry, ledger).score;
    if (!best || score < best.score) best = { bible, score };
    if (!match) {
      return { bible, planned: true, researchUsed, ledgerCheck: { attempts, planned: true, typed: typedOf(bible), closestScore: round2(score), repeated: false } };
    }
    avoid = [...avoid, [entry.fp.conflict, entry.fp.twist, entry.fp.centralObject].filter(Boolean).join(' / ')];
    recentTypes = {
      problemTypes: [...new Set([entry.pt, ...recentTypes.problemTypes].filter(Boolean))],
      twistTypes: [...new Set([entry.tt, ...recentTypes.twistTypes].filter(Boolean))]
    };
  }

  if (best) {
    return {
      bible: best.bible,
      planned: true,
      researchUsed,
      ledgerCheck: { attempts, planned: true, typed: typedOf(best.bible), closestScore: round2(best.score), repeated: best.score >= REPEAT_THRESHOLD }
    };
  }
  console.warn('Story bible planning produced no usable plan, using deterministic bible');
  const bible = fallbackBible(request);
  return { bible, planned: false, researchUsed: [], ledgerCheck: { attempts, planned: false, typed: typedOf(bible), ...checkAgainstLedger(bible, ledger) } };
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
  let ledgerCheck;
  let researchUsed = [];
  const safetyEvents = [];
  if (!bible) {
    if (request.wishDropped) safetyEvents.push({ kind: 'wish-blocked', reason: 'wish-filtered' });
    ({ bible, ledgerCheck, researchUsed } = await planBible({ generate, request, recentTitles, recentArchetypes, research }));
  }
  const previous = cleanSummaries(previousSummaries);

  if (generate) {
    // The model's plan was unusable and the offline plan was used (only known when this call planned).
    if (ledgerCheck && ledgerCheck.planned === false) safetyEvents.push({ kind: 'plan-fallback', reason: 'plan-unusable' });
    const result = await writeChapter({ generate, request, bible, chapterIndex: idx, previous });
    if (result.ok) {
      return {
        bible,
        ledgerCheck,
        researchUsed,
        safetyEvents,
        source: 'llm',
        attempts: result.attempts,
        issues: [],
        chapter: formatChapter({ chapter: result.chapter, bible, request, chapterIndex: idx, source: 'llm' })
      };
    }
    const failure = result.issues;
    // Reason codes only (never the rejected text): what kind of check the chapter failed.
    safetyEvents.push({ kind: 'chapter-fallback', reason: cleanReason(Array.isArray(failure) ? failure[0] : failure) });
    const fallback = proceduralChapter ? proceduralChapter(idx) : { chapterText: '' };
    return {
      bible,
      ledgerCheck,
      researchUsed,
      safetyEvents,
      source: 'procedural',
      attempts: result.attempts,
      issues: failure,
      chapter: formatChapter({ chapter: fallback, bible, request, chapterIndex: idx, source: 'procedural' })
    };
  }

  const offline = proceduralChapter ? proceduralChapter(idx) : { chapterText: '' };
  return {
    bible,
    ledgerCheck,
    researchUsed,
    safetyEvents,
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
  let ledgerCheck;
  let researchUsed = [];
  const safetyEvents = [];
  for (let i = 0; i < 4; i++) {
    const out = await generateBedtimeChapter({ ...args, bible, chapterIndex: i, previousSummaries: summaries });
    bible = out.bible;
    if (out.ledgerCheck) ledgerCheck = out.ledgerCheck;
    if (out.researchUsed?.length) researchUsed = out.researchUsed;
    for (const e of out.safetyEvents || []) safetyEvents.push(e);
    chapters.push(out.chapter);
    summaries.push(out.chapter.summary);
    sources.push(out.source);
  }
  return { bible, chapters, sources, ledgerCheck, researchUsed, safetyEvents };
}
