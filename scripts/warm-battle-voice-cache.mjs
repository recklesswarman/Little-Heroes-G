#!/usr/bin/env node
// One-off, safe-to-re-run helper that pre-populates the toothbrush battle's
// coaching lines in the ElevenLabs TTS server-side cache (see
// server/elevenLabsService.js) by asking a running server to generate each
// one, exactly as a kid's browser would during a real battle. Purely an
// optimization: the cache also warms up organically from real gameplay (the
// battle's lines are a small, repeating set), so running this is optional --
// it just means the FIRST kid to hit each line after a deploy/restart
// doesn't get the one-time cold-cache delay.
//
// Usage:
//   BATTLE_VOICE_CACHE_BASE_URL=https://your-deployed-app.example node scripts/warm-battle-voice-cache.mjs
// Defaults to http://localhost:3000 if the env var isn't set.
//
// Requires network access to the target server (and, on a cache miss, from
// that server out to api.elevenlabs.io) -- run this from an environment
// that actually has it, such as your own machine or CI, not a sandboxed one.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const { HYGIENE_BOSSES, SUGAR_ATTACK_HAZARDS, DENTAL_QUADRANTS } = await import(
  path.join(repoRoot, 'src/data/hygieneBossesData.js')
);

const BASE_URL = process.env.BATTLE_VOICE_CACHE_BASE_URL || 'http://localhost:3000';

// Plain double-quoted literals passed straight to voicePrompts.speak(...) or
// assigned to the battle's coach-text variable -- these are the static
// coaching lines. Pulled straight from the source files rather than
// hand-copied here, so this stays accurate as BattleView.js's wording
// changes; a line that becomes a template literal (backtick, with ${...})
// won't match and simply won't get pre-warmed (it'll still cache correctly
// the first time it's organically spoken in a real battle).
const STATIC_LINE_SOURCE_FILES = [
  'src/views/BattleView.js',
  'src/views/WorldAdventureMapView.js',
  'src/views/QuestMapView.js'
];
const STATIC_LINE_PATTERNS = [
  /currentRexCoachText\s*=\s*"([^"]+)"/g,
  /const\s+question\s*=\s*"([^"]+)"/g,
  // Only calls actually marked { instant: true } -- these three files also
  // contain non-battle voicePrompts.speak(...) calls (e.g. a bedtime-mode
  // announcement in WorldAdventureMapView.js) that go through the normal
  // ElevenLabs/Gemini tiers already and have no need for this cache.
  /voicePrompts\.speak\(\s*"([^"]+)"[^)]*instant:\s*true[^)]*\)/g
];

function extractStaticLines() {
  const lines = new Set();
  for (const relPath of STATIC_LINE_SOURCE_FILES) {
    const source = readFileSync(path.join(repoRoot, relPath), 'utf8');
    for (const pattern of STATIC_LINE_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        lines.add(match[1]);
      }
    }
  }
  return lines;
}

function buildLineSet() {
  const lines = new Set(extractStaticLines());

  for (const quad of DENTAL_QUADRANTS) {
    if (quad.coachMessage) lines.add(quad.coachMessage);
  }
  for (const hazard of SUGAR_ATTACK_HAZARDS) {
    if (hazard.rexWarning) lines.add(hazard.rexWarning);
  }

  // Two known template lines built at runtime (backtick literals, so the
  // static-string extraction above can't see them) -- enumerated by hand
  // across every boss/hazard combination they can actually produce. Keep
  // these in sync with BattleView.js's triggerDeflectSuccess() and
  // voicePrompts.js's speakBossDefeated() if their wording ever changes.
  for (const hazard of SUGAR_ATTACK_HAZARDS) {
    for (const boss of HYGIENE_BOSSES) {
      lines.add(`Awesome deflect! The ${hazard.shortName.toLowerCase()} bounced right back at ${boss.name}!`);
    }
  }
  for (const boss of HYGIENE_BOSSES) {
    lines.add(`Incredible job! We washed away ${boss.name}! Your teeth are sparkling clean!`);
  }

  return Array.from(lines);
}

async function warmLine(text) {
  const res = await fetch(`${BASE_URL}/api/elevenlabs/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, petId: 'rex' })
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, cached: Boolean(body?.cached), status: res.status, error: body?.error };
}

const lines = buildLineSet();
console.log(`Warming ${lines.length} battle voice lines against ${BASE_URL} ...`);

let warmed = 0;
let alreadyCached = 0;
let failed = 0;
for (const text of lines) {
  try {
    const result = await warmLine(text);
    if (!result.ok) {
      failed++;
      console.warn(`FAILED (${result.status}): "${text.slice(0, 60)}..." -- ${result.error || 'unknown error'}`);
    } else if (result.cached) {
      alreadyCached++;
    } else {
      warmed++;
      console.log(`Warmed: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);
    }
  } catch (err) {
    failed++;
    console.warn(`FAILED (network error): "${text.slice(0, 60)}..." -- ${err.message}`);
  }
}

console.log(`\nDone. ${warmed} newly cached, ${alreadyCached} already warm, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
