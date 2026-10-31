// Formatter: turns a written chapter into the structured response the app already understands
// (chapterText/text/whisperLine/... plus sceneDescriptor) and adds `blocks` for rich rendering.
// Blocks carry plain text only -- the view must still escape them when rendering.

const MOODS = ['tranquil', 'mystical', 'gentle', 'deep_slumber'];
const TIME_OF_NIGHT = ['twilight_arrival', 'starlit_journey', 'starlit_journey', 'deep_slumber_sanctuary'];
const CAMERA = ['orbit_pan', 'follow_walk', 'follow_walk', 'crane_descend_nest'];
const HERO_ACTION = ['walking_with_lantern', 'discovering_landmark', 'helping_obstacle', 'curled_asleep'];
const PET_ACTION = ['trotting_beside', 'sniffing_clue', 'glowing_magic', 'sleeping_curled'];
const PARTICLES = ['fireflies', 'aurora_ribbons', 'fireflies', 'starlight_snow'];

const DEFAULT_WHISPER = [
  'The evening is soft and welcoming.',
  'Every little step feels easier.',
  'Kindness lights the way home.',
  'Goodnight, little hero. Sweet dreams.'
];
const DEFAULT_CUE = [
  'Let your shoulders drop and soften.',
  'Take one slow, deep breath.',
  'Let your arms and legs feel warm and heavy.',
  'Breathe in for four, out for four.'
];

export function splitIntoBlocks(text, { sleepyCue = '', whisperLine = '', isLast = false } = {}) {
  const body = String(text || '').trim();
  const paragraphs = body.includes('\n\n')
    ? body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    : groupSentences(body, 3);
  const blocks = paragraphs.map(p => ({
    type: /^["“]/.test(p) ? 'dialogue' : 'paragraph',
    text: p
  }));
  if (isLast && sleepyCue) blocks.push({ type: 'breathCue', text: sleepyCue });
  if (whisperLine) blocks.push({ type: 'whisper', text: whisperLine });
  return blocks;
}

function groupSentences(text, perGroup) {
  const sentences = text.split(/(?<=[.!])\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < sentences.length; i += perGroup) out.push(sentences.slice(i, i + perGroup).join(' '));
  return out;
}

export function buildSceneDescriptor(chapterIndex, request, extras = {}) {
  const realm = request.realm || {};
  const biomes = realm.subBiomes && realm.subBiomes.length ? realm.subBiomes : [realm.name || 'Moonlit Meadow'];
  const idx = Math.max(0, Math.min(3, chapterIndex));
  return {
    environmentBiome: biomes[idx % biomes.length],
    timeOfNight: TIME_OF_NIGHT[idx],
    weatherParticles: extras.weatherParticles || PARTICLES[idx],
    cameraWork: CAMERA[idx],
    heroAction: HERO_ACTION[idx],
    petAction: PET_ACTION[idx],
    keyProps: extras.keyProps && extras.keyProps.length ? extras.keyProps : ['Starlight Lantern', realm.name || 'Moonlit Meadow'],
    lightingPalette: {
      ambient: '#09141e',
      directional: idx === 3 ? '#09141e' : (realm.accentColor || '#00d2d3'),
      accent: '#ffb961'
    }
  };
}

function firstSentence(text, max = 200) {
  return (String(text || '').split(/(?<=[.!])\s+/)[0] || '').slice(0, max);
}

/**
 * `chapter` comes from writeChapter (source 'llm') or from the procedural weaver (source 'procedural').
 */
export function formatChapter({ chapter, bible, request, chapterIndex, source }) {
  const idx = Math.max(0, Math.min(3, chapterIndex));
  const text = chapter.chapterText || chapter.text || '';
  const whisperLine = chapter.whisperLine || DEFAULT_WHISPER[idx];
  const sleepyCue = chapter.sleepyCue || DEFAULT_CUE[idx];
  const isLast = idx === 3;
  const baseTitle = (chapter.title || '').replace(/^chapter\s*\d+\s*[:.-]\s*/i, '').trim();
  const title = `Chapter ${idx + 1}: ${baseTitle || (isLast ? 'The Slumber Sanctuary' : bible.title)}`;
  const closing = isLast ? 'Sleep tight, brave hero. Sweet dreams.' : '';

  return {
    chapterIndex: idx,
    chapterNumber: idx + 1,
    title,
    text,
    chapterText: text,
    summary: chapter.summary || firstSentence(text),
    whisperLine,
    sleepyCue,
    moralReflection: chapter.moralReflection || request.moral?.slumberResolution || '',
    choices: [],
    sceneMood: MOODS.includes(chapter.sceneMood) ? chapter.sceneMood : (chapter.sceneMood || MOODS[idx]),
    sceneDescriptor: chapter.sceneDescriptor || buildSceneDescriptor(idx, request, chapter),
    blocks: splitIntoBlocks(text, { sleepyCue, whisperLine, isLast }),
    prompt: closing,
    promptQuestion: closing,
    defaultChips: [],
    suggestionChips: [],
    isSleepingEnd: isLast,
    archetypeId: bible.archetypeId,
    source
  };
}
