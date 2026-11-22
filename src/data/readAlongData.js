// Sentences for "Rex's Read-Along": the child reads one sentence out loud and Rex
// listens (Whisper on the family Pi, or the browser's own speech recognition).
// Written for this app. Word choice follows the common early sight-word lists and the
// phonics patterns each grade works on, so every sentence is decodable at its level.
//   easy   = Pre-K / Kindergarten start (2 to 4 words, sight words + CVC words)
//   medium = end-of-Kindergarten stretch (4 to 6 words)
//   hard   = 2nd grade (6 to 10 words, vowel teams, digraphs, prefixes and suffixes)

const entry = (standard, sentence, hint) => ({
  standard,
  sentence,
  question: 'Read this sentence out loud to Rex!',
  options: [],
  answer: -1,
  hint
});

const EASY = [
  'I see a cat.',
  'The dog can run.',
  'I am big.',
  'We go up.',
  'My hat is red.',
  'A pig can dig.',
  'I can see you.',
  'The sun is hot.',
  'Look at me!',
  'Do you like it?',
  'She has a box.',
  'We like to play.'
].map((s) => entry('RF.K.4', s, 'Point to each word and say it. Tap a word to hear Rex say it!'));

const MEDIUM = [
  'The cat sat on the mat.',
  'We can go to the park.',
  'Rex likes to run and jump.',
  'My dog is big and brown.',
  'I will get the red ball.',
  'She ran down the hill.',
  'We see a pig in the mud.',
  'The bug is on the rug.',
  'Can you help me find it?',
  'He has a new blue hat.',
  'They went into the shop.',
  'Our fish swims in the pond.'
].map((s) => entry('RF.K.4', s, 'Sound out the tricky words. Tap any word to hear it.'));

const HARD = [
  'The rain made the road wet and shiny.',
  'My little brother loves to play outside.',
  'We found a green turtle near the stream.',
  'After lunch, we planted seeds in the garden.',
  'The brave knight rode across the bridge.',
  'Please keep your voice quiet in the library.',
  'A rainbow appeared when the clouds went away.',
  'My grandmother bakes the best chocolate cookies.',
  'The shy puppy hid behind the old wooden chair.',
  'Every morning, the birds sing outside my window.',
  'We can learn so much from reading books.',
  'The dinosaur stomped through the thick, green forest.'
].map((s) => entry('RF.2.4.b', s, 'Read it smoothly, like you are telling a story. Tap a word if you get stuck.'));

export const READ_ALONG_CHALLENGES = Object.freeze({ easy: EASY, medium: MEDIUM, hard: HARD });
