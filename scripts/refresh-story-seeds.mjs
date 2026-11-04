// Weekly seed refresh: reads a few allow-listed pages, asks Gemini to distill them into abstract
// one-line story sparks, validates every spark with cleanSeed(), and rewrites
// shared/storyEngine/seedPoolReviewed.js. The workflow then opens a PR so a human reviews each new
// seed before it ships. Nothing here runs while a child is waiting for a story.
//
//   GEMINI_API_KEY=... node scripts/refresh-story-seeds.mjs
// Without a key it prints a notice and exits 0 (the shipped pool keeps working).
import { cleanApiKey, isPlainApiKey, describeApiKeyProblems } from './key-diagnostics.mjs';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { GoogleGenAI } from '@google/genai';
import { makeGeminiGenerate } from '../shared/storyEngine/gemini.js';
import { CLEAN_SEED_POOL, seasonOf, SEED_KINDS, SEASONS } from '../shared/storyEngine/seeds.js';
import { REVIEWED_SEEDS } from '../shared/storyEngine/seedPoolReviewed.js';
import {
  SOURCES, USER_AGENT, MAX_PAGE_BYTES, isAllowedUrl, parseRobots, isPathAllowed, htmlToText,
  textWindow, buildDistillPrompt, parseCandidates, mergeCandidates, serializeReviewed
} from '../shared/storyEngine/seedRefresh.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEWED_FILE = join(root, 'shared', 'storyEngine', 'seedPoolReviewed.js');
const MANUAL_FILE = join(root, 'scripts', 'manual-seeds.txt');
const MAX_REVIEWED = 300;
const PAGES_PER_SOURCE = 2;
const TIMEOUT_MS = 15000;

const log = (...a) => console.log('[seeds]', ...a);
const summary = [];
const note = (line) => { log(line); summary.push(line); };

// A pasted secret often carries a trailing newline, spaces or quotes; those break the request headers
// ("Headers.append" errors) and used to make the whole run look like a quiet success with nothing added.
const API_KEY = cleanApiKey(process.env.GEMINI_API_KEY);
if (!API_KEY) {
  log('GEMINI_API_KEY is not set: skipping the refresh. The shipped seed pool keeps working.');
  process.exit(0);
}
if (!isPlainApiKey(API_KEY)) {
  console.error('[seeds] GEMINI_API_KEY is set but is not a plain API key (it should be one line of letters, digits, "-", "_" and at most one "." with no spaces, quotes or line breaks). Re-create the secret in Settings > Secrets > Actions and paste only the key.');
  // Counts and category names only: the value itself, and every character of it, stays out of the log.
  for (const line of describeApiKeyProblems(process.env.GEMINI_API_KEY).lines) console.error(`[seeds]   ${line}`);
  process.exit(1);
}
if (REVIEWED_SEEDS.length >= MAX_REVIEWED) {
  log(`Reviewed pool already has ${REVIEWED_SEEDS.length} seeds (limit ${MAX_REVIEWED}): nothing to do.`);
  process.exit(0);
}

const rawGenerate = makeGeminiGenerate(new GoogleGenAI({ apiKey: API_KEY }), { model: process.env.GEMINI_STORY_MODEL || undefined });
let modelCalls = 0;
let modelFailures = 0;
const generate = async (...args) => {
  modelCalls++;
  try { return await rawGenerate(...args); } catch (err) { modelFailures++; throw err; }
};
const week = Math.floor(Date.now() / 604_800_000);

async function fetchLimited(url, accept) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedUrl(current)) throw new Error(`refusing ${current}: not on the allow-list`);
    const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/^text\//i.test(type)) throw new Error(`unexpected content type ${type}`);
    // Read at most MAX_PAGE_BYTES.
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); size += value.length;
    }
    await reader.cancel().catch(() => {});
    return Buffer.concat(chunks).subarray(0, MAX_PAGE_BYTES).toString('utf8');
  }
  throw new Error('too many redirects');
}

const robotsCache = new Map();
async function robotsFor(host) {
  if (!robotsCache.has(host)) {
    try { robotsCache.set(host, parseRobots(await fetchLimited(`https://${host}/robots.txt`, 'text/plain'))); }
    catch (err) { robotsCache.set(host, null); note(`- ${host}: robots.txt unreadable (${err.message}); skipped (fail closed)`); }
  }
  return robotsCache.get(host);
}

let allSeeds = [...CLEAN_SEED_POOL];
const added = [];
const add = (fresh, label) => {
  allSeeds = [...allSeeds, ...fresh];
  added.push(...fresh);
  note(`- ${label}: ${fresh.length} new seed(s)`);
};
const kindsFed = new Set();

// 1) Allow-listed pages.
for (const source of SOURCES) {
  const robots = await robotsFor(source.host);
  if (!robots) continue;
  for (let i = 0; i < PAGES_PER_SOURCE; i++) {
    const url = source.pages[(week * PAGES_PER_SOURCE + i) % source.pages.length];
    try {
      if (!isPathAllowed(robots, new URL(url).pathname)) { note(`- ${url}: disallowed by robots.txt; skipped`); continue; }
      const text = textWindow(htmlToText(await fetchLimited(url, 'text/html,text/plain')), week + i);
      const fresh = mergeCandidates(allSeeds, parseCandidates(await generate(buildDistillPrompt(source.kind, text), { json: true, temperature: 0.9, maxOutputTokens: 800 })),
        { kind: source.kind, source: source.name });
      add(fresh, url);
      if (fresh.length) kindsFed.add(source.kind);
    } catch (err) { note(`- ${url}: ${err.message}`); }
  }
}

// 2) Backup: Gemini Google Search grounding, only for kinds the allow-list added nothing for.
for (const kind of SEED_KINDS) {
  if (kindsFed.has(kind)) continue;
  const season = kind === 'seasonal' ? seasonOf(new Date()) : 'any';
  const ask = {
    nature: 'gentle nature or science wonders that could spark a calm bedtime story',
    folk: 'old folk-tale story shapes (patterns only) that could spark a calm bedtime story',
    seasonal: `calm, cozy ${season} moments that could spark a bedtime story`,
    shape: 'classic plot shapes from well-loved children\'s picture books and shows (the pattern only, never names, characters or wording)'
  }[kind];
  try {
    const prompt = `Use Google Search to research ${ask} for children aged 3-8.\nThen invent up to 5 NEW story sparks inspired by what you found. Each spark: exactly one plain sentence of at most 100 characters; abstract (no character, place, brand or show names, no quotes, numbers or web addresses); only the first word capitalized; gentle and safe; original wording.\nReturn ONLY a JSON array of strings.`;
    const fresh = mergeCandidates(allSeeds, parseCandidates(await generate(prompt, { grounded: true, temperature: 0.9, maxOutputTokens: 800 })), { kind, season, source: 'search' });
    add(fresh, `search (${kind})`);
  } catch (err) { note(`- search (${kind}): ${err.message}`); }
}

// 3) Manual seeds a person typed: one per line, "kind|season|sentence"; # starts a comment.
if (existsSync(MANUAL_FILE)) {
  const byKind = new Map();
  for (const raw of readFileSync(MANUAL_FILE, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [kind, season, ...rest] = line.split('|');
    if (!SEED_KINDS.includes(kind?.trim()) || !SEASONS.includes(season?.trim())) { note(`- manual: ignored malformed line "${line.slice(0, 40)}"`); continue; }
    const key = `${kind.trim()}|${season.trim()}`;
    byKind.set(key, [...(byKind.get(key) || []), rest.join('|')]);
  }
  for (const [key, lines] of byKind) {
    const [kind, season] = key.split('|');
    add(mergeCandidates(allSeeds, lines, { kind, season, source: 'manual' }), `manual (${kind}/${season})`);
  }
}

// Every model call failing means the key, model name or network is broken, not that there was nothing new:
// fail the run so it shows red instead of looking like a quiet week.
if (modelCalls > 0 && modelFailures === modelCalls) {
  console.error(`[seeds] All ${modelCalls} model calls failed (see the run notes above). Check the GEMINI_API_KEY secret and the model name.`);
  process.exit(1);
}
if (!added.length) { log('No new seeds this week.'); process.exit(0); }

writeFileSync(REVIEWED_FILE, serializeReviewed([...REVIEWED_SEEDS, ...added]));
execFileSync('node', [join(root, 'scripts', 'sync-story-engine.mjs')], { stdio: 'inherit' });

const report = [`### ${added.length} new story seed(s) to review`, '', ...added.map(s => `- \`${s.id}\` (${s.kind}/${s.season}, ${s.source}): ${s.text}`), '', '### Run notes', ...summary].join('\n');
if (process.env.SEED_REPORT_FILE) writeFileSync(process.env.SEED_REPORT_FILE, report + '\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
log(`Wrote ${added.length} new seed(s).`);
