// Grade-level skill quests aligned to the Common Core (Multi-State) standards,
// pulled from Learning Commons (learningcommons.org) on 2026-11-21.
//
// The family's two heroes:
//   - 4-year-old, starting kindergarten in the spring -> "easy" (Pre-K / K)
//   - 7-year-old in 2nd grade                          -> "hard" (Grade 2)
// "medium" is end-of-kindergarten stretch work, so the younger hero has a
// next step once the easy set is mastered.
//
// Every challenge carries the `standard` code it practises, so the parent
// portal (and Rex) can say exactly which skill a quest is building.
// Hints were written to steer around common mistakes Learning Commons flags
// for these standards (e.g. mixing up tens and ones, reading "34" digit by
// digit as "three four", or adding every number in a word problem).

import { READ_ALONG_CHALLENGES } from './readAlongData.js';
import { WORD_WALL_CHALLENGES } from './wordWallData.js';
import { MATH_FACT_CHALLENGES } from './mathFactsData.js';

export const GRADE_LEVEL_LABELS = {
  easy: 'Pre-K & Kindergarten',
  medium: 'Kindergarten Stretch',
  hard: '2nd Grade'
};

export const STANDARD_DESCRIPTIONS = {
  // Kindergarten reading foundations
  'RF.K.1.d': 'Recognize and name upper- and lowercase letters',
  'RF.K.2.a': 'Recognize and produce rhyming words',
  'RF.K.2.b': 'Count and blend syllables in spoken words',
  'RF.K.2.c': 'Blend the first sound with the rest of a word',
  'RF.K.2.d': 'Hear the first, middle, and last sounds in CVC words',
  'RF.K.2.e': 'Swap one sound to make a new word',
  'RF.K.3.a': 'Match consonants to their sounds',
  'RF.K.3.b': 'Long and short sounds of the five vowels',
  'RF.K.3.c': 'Read common sight words (the, of, to, you, she, my, is, are, do, does)',
  'RF.K.3.d': 'Tell apart similarly spelled words by the letters that differ',
  'RF.K.4': 'Read emergent-reader sentences out loud with purpose and understanding',
  'RF.1.3.a': 'Know the sounds of common consonant digraphs (sh, ch, th, wh, ck, ng)',
  // Grade 2 reading foundations
  'RF.2.3.a': 'Long vs. short vowels in one-syllable words',
  'RF.2.3.b': 'Common vowel teams (ai, ay, ee, ea, oa, ow, oo)',
  'RF.2.3.c': 'Decode two-syllable words with long vowels',
  'RF.2.3.d': 'Decode words with common prefixes and suffixes',
  'RF.2.3.e': 'Words with tricky-but-common spellings',
  'RF.2.3.f': 'Read grade-level irregular words',
  'RF.2.4.b': 'Read grade-level sentences out loud with accuracy and expression',
  // Kindergarten operations
  'K.OA.A.5': 'Add and subtract within 5 (and within 10) from memory',
  // Kindergarten counting & cardinality
  'K.CC.A.1': 'Count to 100 by ones and by tens',
  'K.CC.A.2': 'Count forward from any number',
  'K.CC.A.3': 'Match a numeral 0-20 to a group of objects',
  'K.CC.B.4.c': 'Each next number is one more',
  'K.CC.B.5': 'Count to answer "how many?" up to 20',
  'K.CC.C.6': 'Compare groups: more, fewer, or the same',
  'K.CC.C.7': 'Compare two written numbers from 1 to 10',
  // Grade 2 operations & place value
  '2.OA.A.1': 'Solve add/subtract word problems within 100',
  '2.OA.B.2': 'Add and subtract within 20 from memory',
  '2.OA.C.3': 'Odd or even (up to 20)',
  '2.OA.C.4': 'Add rows in an array (up to 5 x 5)',
  '2.NBT.A.1': 'Hundreds, tens, and ones place value',
  '2.NBT.A.2': 'Skip-count by 5s, 10s, and 100s',
  '2.NBT.A.3': 'Read numbers in expanded form',
  '2.NBT.A.4': 'Compare three-digit numbers with >, =, <'
};

export const GRADE_LEVEL_GAMES = [
  {
    id: 'rex_reading_rocket',
    title: "Rex's Reading Rocket",
    realm: 'Reading Rocket Launchpad',
    subject: 'Reading Skills (Grade Level)',
    gradeAligned: true,
    energyCost: 10,
    icon: 'auto_stories',
    color: '#00d2ff',
    rewardCoins: 30,
    rewardXP: 35,
    desc: 'Power up the rocket with letters, rhymes, and real reading skills from school!',
    challengesByDifficulty: {
      easy: [
        { standard: 'RF.K.1.d', question: "Which one is the letter 'M'?", options: ['N', 'M', 'W'], answer: 1, hint: 'M has two tall mountains in the middle!' },
        { standard: 'RF.K.1.d', question: "Find the small letter that matches big 'B'.", options: ['d', 'p', 'b'], answer: 2, hint: 'Little b has a tall stick and a round belly on the right.' },
        { standard: 'RF.K.3.a', question: "Which picture starts with the 'sss' sound?", options: ['🐍 Snake', '🐶 Dog', '🐟 Fish'], answer: 0, hint: 'Ssssnake! Like a hiss!' },
        { standard: 'RF.K.3.a', question: "Which picture starts with the 'mmm' sound?", options: ['🌙 Moon', '☀️ Sun', '⭐ Star'], answer: 0, hint: 'Mmm-moon! Hum it with your lips together.' },
        { standard: 'RF.K.2.a', question: 'Which word rhymes with CAT?', options: ['🐶 Dog', '🎩 Hat', '🐟 Fish'], answer: 1, hint: 'Cat... hat! They end the same: -at.' },
        { standard: 'RF.K.2.a', question: 'Which word rhymes with BUG?', options: ['Rug', '🐝 Bee', '🦋 Wing'], answer: 0, hint: 'Bug, rug, hug! They all end in -ug.' },
        { standard: 'RF.K.2.b', question: 'Clap it out! How many claps in "DI-NO-SAUR"?', options: ['1 clap', '2 claps', '3 claps'], answer: 2, hint: 'Di (clap) - no (clap) - saur (clap)!' },
        { standard: 'RF.K.2.b', question: 'How many claps in "SUN"?', options: ['1 clap', '2 claps', '3 claps'], answer: 0, hint: 'Sun is one quick clap!' },
        { standard: 'RF.K.2.d', question: 'What is the FIRST sound in "PIG"?', options: ["'g' sound", "'p' sound", "'i' sound"], answer: 1, hint: 'P-p-pig! Your lips pop open.' },
        { standard: 'RF.K.2.d', question: 'What is the LAST sound in "DOG"?', options: ["'g' sound", "'d' sound", "'o' sound"], answer: 0, hint: 'Do-g... listen to the very end!' },
        { standard: 'RF.K.3.c', question: "Find the word 'the'.", options: ['to', 'the', 'she'], answer: 1, hint: 'T-H-E, like "the big red rocket"!' },
        { standard: 'RF.K.3.c', question: "Find the word 'my'.", options: ['my', 'me', 'is'], answer: 0, hint: 'M-Y, like "my pet dragon"!' }
      ],
      medium: [
        { standard: 'RF.K.2.d', question: 'What is the MIDDLE sound in "CAT"?', options: ["short 'a'", "short 'o'", "short 'i'"], answer: 0, hint: 'C-a-t. The middle says "aaa" like apple.' },
        { standard: 'RF.K.2.e', question: 'Change the C in CAT to an H. What word do you get?', options: ['Hot', 'Hat', 'Hit'], answer: 1, hint: 'Keep -at, start with h: h-at!' },
        { standard: 'RF.K.2.e', question: 'Change the P in PIG to a W. What word do you get?', options: ['Wag', 'Wig', 'Win'], answer: 1, hint: 'Keep -ig, start with w: w-ig!' },
        { standard: 'RF.K.2.c', question: 'Put the sounds together: /s/ ... /un/', options: ['Sun', 'Sit', 'Run'], answer: 0, hint: 'Ssss + un = sun!' },
        { standard: 'RF.K.3.b', question: 'Which word has the LONG a sound, like it says its name?', options: ['Cap', 'Cake', 'Cat'], answer: 1, hint: 'Long a says "ay" like in cake!' },
        { standard: 'RF.K.3.b', question: 'Which word has the SHORT o sound?', options: ['Hot', 'Home', 'Rope'], answer: 0, hint: 'Short o says "ah" like in hot and pop.' },
        { standard: 'RF.K.3.d', question: 'Which word is "PAN"? (Look at the middle letter!)', options: ['pin', 'pen', 'pan'], answer: 2, hint: 'P-A-N has an "a" in the middle.' },
        { standard: 'RF.K.3.d', question: 'Which word is "BIG"?', options: ['bag', 'big', 'bug'], answer: 1, hint: 'B-I-G has an "i" in the middle.' },
        { standard: 'RF.K.3.c', question: "Find the word 'are'.", options: ['are', 'ear', 'era'], answer: 0, hint: 'A-R-E, like "we are heroes"!' },
        { standard: 'RF.K.3.c', question: "Find the word 'does'.", options: ['does', 'dose', 'goes'], answer: 0, hint: 'D-O-E-S, like "Rex does a dance"!' },
        { standard: 'RF.K.2.a', question: 'Which word does NOT rhyme with BED?', options: ['Red', 'Sled', 'Bat'], answer: 2, hint: 'Bed, red, sled end in -ed. Which one does not?' },
        { standard: 'RF.K.2.b', question: 'How many claps in "BUT-TER-FLY"?', options: ['2 claps', '3 claps', '4 claps'], answer: 1, hint: 'But (clap) - ter (clap) - fly (clap)!' }
      ],
      hard: [
        { standard: 'RF.2.3.a', question: 'Which word has a LONG i sound?', options: ['Kit', 'Kite', 'Kick'], answer: 1, hint: 'The silent e at the end makes the i say its name: kite!' },
        { standard: 'RF.2.3.a', question: 'Which word has a SHORT u sound?', options: ['Cute', 'Cub', 'Tube'], answer: 1, hint: 'Short u says "uh" like in cub and sun.' },
        { standard: 'RF.2.3.b', question: "Which word has the vowel team 'ai' saying long a?", options: ['Rain', 'Ran', 'Rin'], answer: 0, hint: 'When two vowels go walking, the first one does the talking: r-AI-n.' },
        { standard: 'RF.2.3.b', question: "Which word has 'oa' like in BOAT?", options: ['Bot', 'Coat', 'Cot'], answer: 1, hint: 'O-A says long o: c-OA-t.' },
        { standard: 'RF.2.3.b', question: "Which word uses 'ee' to say long e?", options: ['Bed', 'Bead', 'Seed'], answer: 2, hint: 'Double e says "eee": s-EE-d. (Bead uses the "ea" team instead!)' },
        { standard: 'RF.2.3.c', question: 'Which two-syllable word has two long vowel sounds?', options: ['Rainbow', 'Rabbit', 'Kitten'], answer: 0, hint: 'Rain (long a) + bow (long o) = rainbow!' },
        { standard: 'RF.2.3.d', question: 'What does the prefix "re-" in "REPLAY" mean?', options: ['Not', 'Again', 'Before'], answer: 1, hint: 'Replay means play again!' },
        { standard: 'RF.2.3.d', question: 'Which word means "without fear"?', options: ['Fearful', 'Fearless', 'Unfear'], answer: 1, hint: 'The suffix -less means "without".' },
        { standard: 'RF.2.3.d', question: 'What is the base word in "UNHAPPY"?', options: ['Un', 'Happy', 'Hap'], answer: 1, hint: 'Take off the prefix un- and see what is left.' },
        { standard: 'RF.2.3.e', question: 'Which word has the "ow" sound like in COW?', options: ['Snow', 'Grow', 'Owl'], answer: 2, hint: '"ow" can say long o (snow) OR "ow!" like owl. Read each one out loud.' },
        { standard: 'RF.2.3.f', question: "Which is the correct spelling of the word that means 'also'?", options: ['Two', 'Too', 'To'], answer: 1, hint: '"I want to come TOO!" T-O-O means also.' },
        { standard: 'RF.2.3.f', question: 'Pick the correctly spelled word: "I ___ my homework."', options: ['Wuz', 'Was', 'Woz'], answer: 1, hint: '"Was" is a tricky word. It sounds like "wuz" but is spelled W-A-S.' }
      ]
    }
  },
  {
    id: 'rex_math_mountain',
    title: "Rex's Math Mountain",
    realm: 'Math Mountain Trail',
    subject: 'Math Skills (Grade Level)',
    gradeAligned: true,
    energyCost: 10,
    icon: 'landscape',
    color: '#ffb300',
    rewardCoins: 30,
    rewardXP: 35,
    desc: 'Climb the mountain with counting, adding, and place-value powers from school!',
    challengesByDifficulty: {
      easy: [
        { standard: 'K.CC.B.5', question: 'How many dinos? 🦖 🦖 🦖 🦖', options: ['3', '4', '5'], answer: 1, hint: 'Touch each dino once as you count: 1, 2, 3, 4!' },
        { standard: 'K.CC.B.5', question: 'How many stars? ⭐ ⭐ ⭐ ⭐ ⭐ ⭐', options: ['6', '5', '7'], answer: 0, hint: 'Point to each star one time. The last number you say is how many!' },
        { standard: 'K.CC.A.3', question: 'Which number shows this many apples? 🍎 🍎', options: ['2', '3', '1'], answer: 0, hint: 'One apple, two apples. The number is 2!' },
        { standard: 'K.CC.A.3', question: 'How many cookies? (none!) 🍽️', options: ['1', '0', '10'], answer: 1, hint: 'An empty plate has zero cookies. Zero means none!' },
        { standard: 'K.CC.C.6', question: 'Which side has MORE? 🐸🐸🐸 or 🐸', options: ['3 frogs', '1 frog', 'The same'], answer: 0, hint: 'Match them up. Which side has frogs left over?' },
        { standard: 'K.CC.C.6', question: 'Are these the same? 🍌🍌 and 🍌🍌', options: ['Yes, the same', 'No, more bananas on the left', 'No, more on the right'], answer: 0, hint: 'Count each side: 2 and 2. Same!' },
        { standard: 'K.CC.B.4.c', question: 'What number comes right after 3?', options: ['2', '5', '4'], answer: 2, hint: 'Count up: 1, 2, 3... then comes 4! One more each time.' },
        { standard: 'K.CC.B.4.c', question: 'What number comes right after 6?', options: ['7', '5', '8'], answer: 0, hint: '5, 6, and then 7!' },
        { standard: 'K.CC.A.2', question: 'Start at 5 and count on: 5, 6, __', options: ['8', '7', '4'], answer: 1, hint: 'Keep counting from 6. The next number is 7!' },
        { standard: 'K.CC.C.7', question: 'Which number is BIGGER?', options: ['2', '8'], answer: 1, hint: 'When you count, 8 comes way after 2, so 8 is bigger!' },
        { standard: 'K.CC.A.1', question: 'Count to 10! 7, 8, 9, __', options: ['10', '11', '6'], answer: 0, hint: '7, 8, 9, TEN! Ten fingers!' },
        { standard: 'K.CC.B.5', question: 'How many balloons? 🎈 🎈 🎈', options: ['2', '3', '4'], answer: 1, hint: 'Count slowly, one balloon at a time.' }
      ],
      medium: [
        { standard: 'K.CC.A.1', question: 'Count by tens: 10, 20, 30, __', options: ['31', '40', '50'], answer: 1, hint: 'Counting by tens adds a whole ten each time: 40!' },
        { standard: 'K.CC.A.1', question: 'Count by tens: 50, 60, 70, __', options: ['80', '71', '90'], answer: 0, hint: 'Seventy, then eighty!' },
        { standard: 'K.CC.A.1', question: 'What number comes after 29?', options: ['20', '30', '40'], answer: 1, hint: 'After 29 we start a new ten: 30!' },
        { standard: 'K.CC.A.2', question: 'Start at 14 and count on: 14, 15, __', options: ['16', '13', '17'], answer: 0, hint: 'One more than 15 is 16.' },
        { standard: 'K.CC.A.2', question: 'Start at 17 and count on: 17, 18, 19, __', options: ['21', '20', '10'], answer: 1, hint: 'After 19 comes 20!' },
        { standard: 'K.CC.B.5', question: 'How many? 🪙🪙🪙🪙🪙 🪙🪙🪙🪙🪙 🪙🪙', options: ['11', '12', '13'], answer: 1, hint: 'There are two groups of 5, plus 2 more. 5, 10, then 11, 12!' },
        { standard: 'K.CC.B.5', question: 'How many? 🐞🐞🐞🐞🐞🐞🐞🐞🐞', options: ['8', '9', '10'], answer: 1, hint: 'Touch each ladybug exactly once.' },
        { standard: 'K.CC.C.7', question: 'Which number is SMALLER?', options: ['9', '6'], answer: 1, hint: 'Count to 9. You say 6 first, so 6 is smaller.' },
        { standard: 'K.CC.C.7', question: 'Which number is BIGGER: 7 or 5?', options: ['7', '5'], answer: 0, hint: '5, 6, 7... 7 comes later, so it is bigger.' },
        { standard: 'K.CC.C.6', question: 'Which group has FEWER? 🍓🍓🍓🍓 or 🍓🍓🍓🍓🍓🍓', options: ['4 berries', '6 berries', 'The same'], answer: 0, hint: 'Fewer means less. 4 is less than 6.' },
        { standard: 'K.CC.A.3', question: 'Which numeral is "fifteen"?', options: ['51', '15', '50'], answer: 1, hint: 'Fifteen is one ten and five ones: 1 then 5.' },
        { standard: 'K.CC.B.4.c', question: 'What number is one MORE than 12?', options: ['11', '13', '22'], answer: 1, hint: 'One more means count up one: 13!' }
      ],
      hard: [
        { standard: '2.OA.B.2', question: 'Quick! 8 + 7 = ?', options: ['14', '15', '16'], answer: 1, hint: 'Make a ten: 8 + 2 = 10, then 5 more is 15.' },
        { standard: '2.OA.B.2', question: 'Quick! 13 - 6 = ?', options: ['7', '8', '6'], answer: 0, hint: 'Think addition: 6 + 7 = 13, so 13 - 6 = 7.' },
        { standard: '2.OA.B.2', question: 'Quick! 9 + 9 = ?', options: ['17', '18', '19'], answer: 1, hint: 'Doubles! 9 + 9 is one less than 10 + 10.' },
        { standard: '2.OA.A.1', question: 'Rex had 24 stickers and got 15 more. How many now?', options: ['39', '9', '29'], answer: 0, hint: '"Got more" means add: 24 + 15. Add the tens, then the ones.' },
        { standard: '2.OA.A.1', question: 'There were 45 coins. Rex spent 20. How many are left?', options: ['65', '25', '20'], answer: 1, hint: '"Spent" means some went away, so subtract: 45 - 20.' },
        { standard: '2.OA.A.1', question: 'Mia has 12 shells. Leo has 8 more than Mia. How many does Leo have?', options: ['4', '20', '12'], answer: 1, hint: 'Leo has MORE than Mia, so start at 12 and add 8.' },
        { standard: '2.OA.C.3', question: 'Is 14 odd or even?', options: ['Odd', 'Even'], answer: 1, hint: 'Make pairs: 7 + 7 = 14 with nobody left over, so it is even!' },
        { standard: '2.OA.C.3', question: 'Is 9 odd or even?', options: ['Odd', 'Even'], answer: 0, hint: 'Pair them up: 4 pairs and 1 left over. Odd!' },
        { standard: '2.OA.C.4', question: '3 rows of 4 gems: 💎💎💎💎 / 💎💎💎💎 / 💎💎💎💎. How many?', options: ['7', '12', '10'], answer: 1, hint: 'Add each row: 4 + 4 + 4 = 12.' },
        { standard: '2.NBT.A.1', question: 'In 352, what does the 5 stand for?', options: ['5 ones', '5 tens (50)', '5 hundreds'], answer: 1, hint: 'Hundreds | Tens | Ones. The 5 is in the middle, the tens place!' },
        { standard: '2.NBT.A.1', question: 'How many tens are in 100?', options: ['1', '10', '100'], answer: 1, hint: 'A hundred is a bundle of ten tens!' },
        { standard: '2.NBT.A.3', question: 'Which is 400 + 60 + 7?', options: ['4,607', '467', '476'], answer: 1, hint: '4 hundreds, 6 tens, 7 ones: 467. Not "four, six, seven" read one digit at a time!' },
        { standard: '2.NBT.A.2', question: 'Skip-count by 5s: 35, 40, 45, __', options: ['46', '50', '55'], answer: 1, hint: 'Add 5 each time: 45 + 5 = 50.' },
        { standard: '2.NBT.A.2', question: 'Skip-count by 100s: 300, 400, 500, __', options: ['600', '501', '510'], answer: 0, hint: 'Add one hundred each time!' },
        { standard: '2.NBT.A.4', question: 'Which is true?', options: ['428 > 482', '428 < 482', '428 = 482'], answer: 1, hint: 'Same hundreds (4), so compare the tens: 2 tens is less than 8 tens.' }
      ]
    }
  },
  {
    id: 'rex_read_along',
    title: "Rex's Read-Along",
    realm: 'Read-Along Campfire',
    subject: 'Reading Out Loud (Grade Level)',
    gradeAligned: true,
    mode: 'read-along',
    energyCost: 10,
    icon: 'record_voice_over',
    color: '#ff7eb6',
    rewardCoins: 30,
    rewardXP: 35,
    desc: 'Read sentences out loud while Rex listens. Words turn green when he hears you!',
    challengesByDifficulty: READ_ALONG_CHALLENGES
  },
  {
    id: 'rex_word_wall',
    title: "Rex's Word Wall",
    realm: 'Word Wall Workshop',
    subject: 'Sight Words & Phonics (Grade Level)',
    gradeAligned: true,
    energyCost: 10,
    icon: 'spellcheck',
    color: '#a78bfa',
    rewardCoins: 30,
    rewardXP: 35,
    desc: 'Find sight words, sound out words, and spot vowel teams and digraphs!',
    challengesByDifficulty: WORD_WALL_CHALLENGES
  },
  {
    id: 'rex_number_dash',
    title: "Rex's Number Dash",
    realm: 'Number Dash Racetrack',
    subject: 'Math Facts (Grade Level)',
    gradeAligned: true,
    energyCost: 10,
    icon: 'speed',
    color: '#34d399',
    rewardCoins: 30,
    rewardXP: 35,
    desc: 'Race through add and subtract facts. How fast can your brain zoom?',
    challengesByDifficulty: MATH_FACT_CHALLENGES
  }
];

export function getStandardsForGame(game, difficulty) {
  const set = game?.challengesByDifficulty?.[difficulty] || [];
  return [...new Set(set.map((c) => c.standard).filter(Boolean))];
}
