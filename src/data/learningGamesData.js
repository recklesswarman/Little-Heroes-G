// 5 Comprehensive Educational Adventure Realms (+ Backwards Compatibility Aliases)
// Supports 3 Difficulty Levels configured per child:
// - Easy: Toddler Level (Ages 3-4) with high-contrast emojis & realistic voice prompts
// - Medium: Kids Level (Ages 5-6) Early elementary foundational mastery
// - Hard: Big Kids Level (Ages 7-9) Advanced critical thinking & multi-step challenges

export const ADVENTURE_GAMES = [
  {
    id: "phonics_forest",
    title: "Phonics Forest Sound Match",
    realm: "Phonics Forest",
    subject: "Phonics & Reading",
    energyCost: 15,
    icon: "volume_up",
    color: "#2ecc71",
    rewardCoins: 25,
    rewardXP: 30,
    desc: "Match letters with beginning animal sounds, rhyming patterns, and syllables to awaken the ancient forest grove!",
    challengesByDifficulty: {
      easy: [
        { question: "Which animal starts with the 'D' sound for Duck?", options: ["🦆 Duck", "🐱 Kitty", "🐸 Frog"], answer: 0, hint: "Listen to the 'D-D' quacking sound!" },
        { question: "Can you find the big letter 'A' for Apple?", options: ["🅰️ Letter A", "🅱️ Letter B", "©️ Letter C"], answer: 0, hint: "Look for the pointy letter that looks like a tent!" },
        { question: "Which animal says 'Moo' and starts with 'M'?", options: ["🐮 Cow", "🐶 Puppy", "🐷 Piggy"], answer: 0, hint: "Mmm-moo! The cow in the barn!" },
        { question: "Which one is Sparky the Dragon?", options: ["🐉 Dragon", "🍎 Apple", "⭐ Star"], answer: 0, hint: "The friendly blue dragon with wings!" },
        { question: "Which word starts with 'S' like Sun?", options: ["☀️ Sun", "🌙 Moon", "☁️ Cloud"], answer: 0, hint: "S-S-Sun in the sunny blue sky!" }
      ],
      medium: [
        { question: "Which word starts with the 'D' sound like Dragon?", options: ["🐉 Dragon", "🍎 Apple", "🌳 Tree"], answer: 0, hint: "D-D-Dragon!" },
        { question: "Which animal starts with the letter 'B'?", options: ["🐱 Cat", "🐻 Bear", "🐸 Frog"], answer: 1, hint: "B-B-Bear loves honey!" },
        { question: "Which letter makes the 'S' sound in Sparky?", options: ["Letter S", "Letter M", "Letter T"], answer: 0, hint: "Sssss like a snake or Sparky!" },
        { question: "Which two words rhyme?", options: ["Cat & Hat 🎩", "Dog & Sun ☀️", "Tree & Rock 🪨"], answer: 0, hint: "They both end with the '-at' sound!" },
        { question: "What is the ending sound in the word 'BED'?", options: ["'D' Sound", "'B' Sound", "'T' Sound"], answer: 0, hint: "Be-d... listen to the last letter!" }
      ],
      hard: [
        { question: "Which word has the short 'a' vowel sound like in 'Cat'?", options: ["Map", "Cake", "Car"], answer: 0, hint: "Short 'a' says 'aaah' like apple or map." },
        { question: "How many syllables are in the word 'Ad-ven-ture'?", options: ["2 Syllables", "3 Syllables", "4 Syllables"], answer: 1, hint: "Clap it out: Ad (1) - ven (2) - ture (3)!" },
        { question: "Which word rhymes with 'Knight'?", options: ["Flight", "Shield", "Dragon"], answer: 0, hint: "Knight and Flight both share the '-ight' sound!" },
        { question: "Which word contains a silent letter?", options: ["Knee", "Jump", "Hero"], answer: 0, hint: "The 'K' in knee makes no sound!" },
        { question: "What is the root word in 'Unbreakable'?", options: ["Break", "Able", "Un"], answer: 0, hint: "Remove 'un-' prefix and '-able' suffix to find the core word." }
      ]
    }
  },
  {
    id: "number_galaxy",
    title: "Number Galaxy Cosmic Quest",
    realm: "Number Galaxy",
    subject: "Math & Numbers",
    energyCost: 15,
    icon: "calculate",
    color: "#f1c40f",
    rewardCoins: 30,
    rewardXP: 35,
    desc: "Count cosmic star constellations, solve asteroid addition, and unlock stellar warp gates!",
    challengesByDifficulty: {
      easy: [
        { question: "Can you tap the number 2?", options: ["2️⃣ Number 2", "5️⃣ Number 5", "9️⃣ Number 9"], answer: 0, hint: "Two little space ducks!" },
        { question: "Count the shiny apples: 🍎 🍎 🍎", options: ["2 Apples", "3 Apples", "5 Apples"], answer: 1, hint: "One, two, three sweet apples!" },
        { question: "How many golden stars are here? ⭐ ⭐", options: ["1 Star", "2 Stars", "4 Stars"], answer: 1, hint: "Point with your finger: one, two!" },
        { question: "Which group has MORE rockets? 🚀 🚀 vs 🚀", options: ["2 Rockets 🚀🚀", "1 Rocket 🚀", "They are equal"], answer: 0, hint: "Two rockets is more than one rocket!" },
        { question: "What number comes after 1? (1, __)", options: ["Number 2", "Number 4", "Number 0"], answer: 0, hint: "1, 2, 3, blast off!" }
      ],
      medium: [
        { question: "If Sparky has 3 coins and finds 4 more, how many does he have?", options: ["6 Coins", "7 Coins", "8 Coins"], answer: 1, hint: "3 + 4 = 7 shiny coins!" },
        { question: "Count the cosmic stars: ⭐ ⭐ ⭐ ⭐ ⭐", options: ["4 Stars", "5 Stars", "6 Stars"], answer: 1, hint: "Count each star: 1, 2, 3, 4, 5!" },
        { question: "What is 10 minus 2 space gems?", options: ["8 Gems", "7 Gems", "9 Gems"], answer: 0, hint: "Start at 10 and count backwards by 2!" },
        { question: "Which number is an EVEN number?", options: ["6", "7", "9"], answer: 0, hint: "Even numbers can be split into two equal teams!" },
        { question: "What number comes next: 2, 4, 6, __?", options: ["8", "7", "10"], answer: 0, hint: "Skip count by 2s!" }
      ],
      hard: [
        { question: "Sparky has 14 coins and buys an apple for 6 coins. How many are left?", options: ["8 Coins", "7 Coins", "9 Coins"], answer: 0, hint: "14 - 6 = 8 coins." },
        { question: "What is 5 multiplied by 4?", options: ["20", "25", "15"], answer: 0, hint: "Five groups of four equal twenty!" },
        { question: "What number comes next in the sequence: 4, 8, 12, __?", options: ["14", "16", "18"], answer: 1, hint: "Add 4 each step: 12 + 4 = 16!" },
        { question: "What is half of 50 space tokens?", options: ["25", "20", "30"], answer: 0, hint: "25 + 25 = 50!" },
        { question: "If a spaceship travels 15 miles in 3 minutes, how fast is it per minute?", options: ["5 Miles", "3 Miles", "6 Miles"], answer: 0, hint: "Divide 15 by 3!" }
      ]
    }
  },
  {
    id: "shape_kingdom",
    title: "Shape Kingdom Totem Builder",
    realm: "Shape Kingdom",
    subject: "Geometry & Shapes",
    energyCost: 10,
    icon: "category",
    color: "#e89300",
    rewardCoins: 20,
    rewardXP: 25,
    desc: "Assemble ancient geometric totems, identify 2D & 3D forms, and fit sacred key stones into palace doors!",
    challengesByDifficulty: {
      easy: [
        { question: "Find the round Circle like a ball!", options: ["🔴 Circle", "⏹️ Square", "🔺 Triangle"], answer: 0, hint: "Round and round with no corners!" },
        { question: "Which shape has 3 pointy corners?", options: ["🔺 Triangle", "⏹️ Square", "⭕ Circle"], answer: 0, hint: "Three sides and three points like a party hat!" },
        { question: "What shape is a slice of pizza?", options: ["🔺 Triangle", "⏹️ Square", "⭐ Star"], answer: 0, hint: "Pointy triangle slice!" },
        { question: "Which shape looks like a picture frame or window?", options: ["⏹️ Square", "🔴 Circle", "🔺 Triangle"], answer: 0, hint: "Four straight sides that are all the same!" },
        { question: "Find the shining Star shape!", options: ["⭐ Star", "🔷 Diamond", "🟣 Oval"], answer: 0, hint: "Twinkle twinkle little star!" }
      ],
      medium: [
        { question: "How many sides does a triangle have?", options: ["3 Sides", "4 Sides", "5 Sides"], answer: 0, hint: "Tri- means three, like a tricycle!" },
        { question: "Which shape has 4 equal straight sides?", options: ["Circle", "Square", "Oval"], answer: 1, hint: "A square has 4 equal sides and 4 square corners." },
        { question: "What shape is a shiny habit coin?", options: ["Circle", "Triangle", "Star"], answer: 0, hint: "Coins roll easily because they are circles!" },
        { question: "Which 3D shape looks like an ice cream cone?", options: ["Cone 🍦", "Cube 🧊", "Sphere ⚽"], answer: 0, hint: "Pointy at the bottom, round on top!" },
        { question: "How many sides does a rectangle have?", options: ["4 Sides", "3 Sides", "6 Sides"], answer: 0, hint: "2 long sides and 2 short sides make 4 sides!" }
      ],
      hard: [
        { question: "A shape with 5 straight sides is called a:", options: ["Pentagon", "Hexagon", "Octagon"], answer: 0, hint: "Penta- means 5 sides!" },
        { question: "How many corners (vertices) does a solid 3D cube have?", options: ["6", "8", "12"], answer: 1, hint: "4 corners on the top face + 4 on the bottom = 8 vertices!" },
        { question: "Which 3D shape looks like a soda can or water pipe?", options: ["Cylinder", "Cone", "Sphere"], answer: 0, hint: "A cylinder has 2 circular bases and 1 curved surface." },
        { question: "A stop sign on the street is which polygon shape?", options: ["Octagon (8 sides)", "Hexagon (6 sides)", "Decagon (10 sides)"], answer: 0, hint: "Stop signs have 8 sides!" },
        { question: "What is the name of a triangle where all 3 sides are equal length?", options: ["Equilateral", "Isosceles", "Scalene"], answer: 0, hint: "Equi- means equal!" }
      ]
    }
  },
  {
    id: "emotion_safari",
    title: "Emotion Safari Feeling Match",
    realm: "Emotion Safari",
    subject: "Social-Emotional & Feelings",
    energyCost: 10,
    icon: "sentiment_very_satisfied",
    color: "#9b59b6",
    rewardCoins: 25,
    rewardXP: 30,
    desc: "Navigate the emotional jungle by recognizing facial cues, practicing empathy, and taking deep calming dinosaur breaths!",
    challengesByDifficulty: {
      easy: [
        { question: "Which face looks Super Happy & Smiling?", options: ["😊 Happy", "😢 Crying", "😠 Grumpy"], answer: 0, hint: "Big bright smile from ear to ear!" },
        { question: "When Barnaby the Bear drops his ice cream, how does he feel?", options: ["😢 Sad", "🥳 Excited", "😴 Sleepy"], answer: 0, hint: "It is okay to feel sad when accidents happen." },
        { question: "What can you do when you feel angry or frustrated?", options: ["🧘 Take 3 Deep Breaths", "💥 Throw a Toy", "🗣️ Scream loudly"], answer: 0, hint: "Breathe in like smelling flowers, breathe out like blowing bubbles!" },
        { question: "How can you show kindness to a friend who is lonely?", options: ["🤗 Invite them to play", "🏃 Run away", "🙈 Ignore them"], answer: 0, hint: "A friendly smile and inviting them to play makes everyone happy!" },
        { question: "Which face shows feeling Surprised?", options: ["😲 Surprised", "😴 Tired", "😋 Hungry"], answer: 0, hint: "Wide eyes and an open round mouth!" }
      ],
      medium: [
        { question: "Your friend's tower of blocks fell over. What is an empathetic response?", options: ["'I can help you build it back up!'", "'Haha, that fell fast!'", "'You shouldn't play with blocks.'"], answer: 0, hint: "Empathy means understanding how your friend feels and helping them." },
        { question: "What body cue tells you someone is feeling anxious or nervous?", options: ["Fast heartbeat & fidgeting hands", "Yawning and stretching", "Laughing at a cartoon"], answer: 0, hint: "Nervous butterflies in the tummy can make hands fidget." },
        { question: "When sharing toys on the playground, what rule helps everyone have fun?", options: ["Take turns with a friendly timer", "Keep all the toys to yourself", "Hide the toys"], answer: 0, hint: "Taking turns ensures all heroes get a turn!" },
        { question: "What is 'Self-Regulation'?", options: ["Recognizing big feelings and calming your body", "Never feeling sad", "Winning every game"], answer: 0, hint: "It is learning how to calm your body when big feelings happen." },
        { question: "If you accidentally bump into someone, what are the magic words?", options: ["'I'm so sorry, are you okay?'", "'Move out of the way!'", "Say nothing"], answer: 0, hint: "Saying sorry and asking if they are okay shows respect and care." }
      ],
      hard: [
        { question: "Which strategy is best when resolving a disagreement with a sibling or classmate?", options: ["Use 'I-statements' and listen respectfully", "Interrupt loudly to prove your point", "Give the silent treatment"], answer: 0, hint: "Saying 'I feel sad when...' helps others understand without blame." },
        { question: "What does having 'Gratitude' mean?", options: ["Appreciating and thanking others for positive things", "Expecting rewards for everything", "Feeling jealous of others' toys"], answer: 0, hint: "Gratitude is feeling thankful in your heart!" },
        { question: "How does the '4-7-8' breathing technique help the nervous system?", options: ["Slows heart rate and calms the stress response", "Makes you run faster", "Increases adrenaline"], answer: 0, hint: "Deep breaths activate the body's natural relaxation system." },
        { question: "What is an example of an internal emotion vs an external reaction?", options: ["Feeling disappointed inside vs crossing your arms", "Crying vs yelling", "Smiling vs dancing"], answer: 0, hint: "Feelings happen inside our minds and bodies first!" },
        { question: "How can you support a friend who is experiencing a tough day?", options: ["Listen without judgment and offer a quiet companion presence", "Tell them their problems aren't a big deal", "Change the subject quickly"], answer: 0, hint: "Just being there to listen is the superpower of a true hero." }
      ]
    }
  },
  {
    id: "science_lab",
    title: "Science & Nature Lab Explorer",
    realm: "Science & Nature Lab",
    subject: "Science & Nature",
    energyCost: 10,
    icon: "science",
    color: "#00d2d3",
    rewardCoins: 25,
    rewardXP: 30,
    desc: "Discover animal habitats, plant growth life cycles, weather patterns, and the wonders of planet Earth!",
    challengesByDifficulty: {
      easy: [
        { question: "What do green plants need to grow big and strong?", options: ["☀️ Sunlight & Water 💧", "🍕 Pizza", "🍫 Candy"], answer: 0, hint: "Warm sun from above and cool water from the soil!" },
        { question: "Where does a friendly fish live?", options: ["🌊 Ocean Water", "🌳 In a tree", "☁️ In the clouds"], answer: 0, hint: "Splish splash with fins and gills!" },
        { question: "What falls from the sky when it rains?", options: ["💧 Water Drops", "🍎 Apples", "🪙 Gold Coins"], answer: 0, hint: "Raindrops fall from rainclouds!" },
        { question: "Which animal has big wings and can fly in the sky?", options: ["🦅 Eagle Bird", "🐘 Elephant", "🐢 Turtle"], answer: 0, hint: "Flap flap high in the treetops!" },
        { question: "What season has snow, ice, and snowman building?", options: ["❄️ Winter", "☀️ Summer", "🍂 Fall"], answer: 0, hint: "Cold winter with cozy mittens!" }
      ],
      medium: [
        { question: "What is the first stage in the life cycle of a butterfly?", options: ["🥚 Tiny Egg", "🐛 Caterpillar", "🦋 Winged Butterfly"], answer: 0, hint: "First comes the tiny egg on a leaf!" },
        { question: "What is the closest star to planet Earth that gives us warmth?", options: ["The Sun ☀️", "The Moon 🌙", "Mars 🔴"], answer: 0, hint: "The Sun is our very own glowing star!" },
        { question: "Which animal is a Mammal that feeds milk to its babies?", options: ["🐬 Dolphin", "🦎 Lizard", "🐸 Frog"], answer: 0, hint: "Dolphins and bears are mammals!" },
        { question: "What turns water from liquid into solid ice?", options: ["Freezing cold temperatures ❄️", "Hot boiling sun ☀️", "Wind blowing 💨"], answer: 0, hint: "When it gets below 32°F (0°C), water freezes solid!" },
        { question: "Why do trees have roots deep in the soil?", options: ["To drink water and anchor the tree", "To catch butterflies", "To make flowers smell nice"], answer: 0, hint: "Roots drink up rain water from underground!" }
      ],
      hard: [
        { question: "What process do green plants use to create food from sunlight?", options: ["Photosynthesis", "Metamorphosis", "Evaporation"], answer: 0, hint: "Photo- means light, and synthesis means putting together!" },
        { question: "Which layer of the Earth is the hottest center core?", options: ["Inner Core", "Crust", "Mantle"], answer: 0, hint: "Deep in the center of Earth lies the blazing solid iron core!" },
        { question: "What force pulls objects toward the center of the Earth?", options: ["Gravity", "Magnetism", "Friction"], answer: 0, hint: "Gravity keeps our feet on the ground and dropped apples falling!" },
        { question: "What is the third planet from the Sun in our Solar System?", options: ["Earth 🌍", "Mars 🔴", "Venus 🟡"], answer: 0, hint: "Mercury, Venus, then Earth!" },
        { question: "What is the water cycle step where liquid water turns into rising water vapor?", options: ["Evaporation", "Precipitation", "Condensation"], answer: 0, hint: "Warm sun evaporates water into invisible vapor clouds!" }
      ]
    }
  },

  // Backwards compatibility aliases for QuestMapView & existing links:
  {
    id: "counting_castle",
    title: "Counting Castle Treasure",
    realm: "Number Galaxy",
    subject: "Math & Numbers",
    energyCost: 15,
    icon: "calculate",
    color: "#f1c40f",
    rewardCoins: 30,
    rewardXP: 35,
    desc: "Count the shiny gold coins and gems to unlock castle mystery gates!",
    challengesByDifficulty: {
      easy: [
        { question: "Can you tap the number 2?", options: ["Number 2", "Number 5", "Number 9"], answer: 0 },
        { question: "Count the apples: 🍎 🍎 🍎", options: ["2 Apples", "3 Apples", "5 Apples"], answer: 1 },
        { question: "How many stars are here? ⭐ ⭐", options: ["1 Star", "2 Stars", "4 Stars"], answer: 1 }
      ],
      medium: [
        { question: "If Sparky has 3 coins and finds 4 more, how many does he have?", options: ["6 Coins", "7 Coins", "8 Coins"], answer: 1 },
        { question: "Count the stars: ⭐ ⭐ ⭐ ⭐ ⭐", options: ["4 Stars", "5 Stars", "6 Stars"], answer: 1 },
        { question: "What is 10 minus 2 gems?", options: ["8 Gems", "7 Gems", "9 Gems"], answer: 0 }
      ],
      hard: [
        { question: "Sparky has 14 coins and buys an apple for 6 coins. How many are left?", options: ["8 Coins", "7 Coins", "9 Coins"], answer: 0 },
        { question: "What is 5 multiplied by 4?", options: ["20", "25", "15"], answer: 0 },
        { question: "What number comes next in the sequence: 4, 8, 12, __?", options: ["14", "16", "18"], answer: 1 }
      ]
    }
  },
  {
    id: "shape_shifter",
    title: "Shape Shifter Temple",
    realm: "Shape Kingdom",
    subject: "Geometry & Shapes",
    energyCost: 10,
    icon: "category",
    color: "#e89300",
    rewardCoins: 20,
    rewardXP: 25,
    desc: "Fit triangles, squares, and circles into temple totem slots!",
    challengesByDifficulty: {
      easy: [
        { question: "Find the round Circle like a ball!", options: ["🔴 Circle", "⏹️ Square", "🔺 Triangle"], answer: 0 },
        { question: "Which shape has 3 pointy corners?", options: ["🔺 Triangle", "⏹️ Square", "⭕ Circle"], answer: 0 },
        { question: "What shape is a slice of pizza?", options: ["🔺 Triangle", "⏹️ Square", "⭐ Star"], answer: 0 }
      ],
      medium: [
        { question: "How many sides does a triangle have?", options: ["3 Sides", "4 Sides", "5 Sides"], answer: 0 },
        { question: "Which shape has 4 equal straight sides?", options: ["Circle", "Square", "Oval"], answer: 1 },
        { question: "What shape is a shiny habit coin?", options: ["Circle", "Triangle", "Star"], answer: 0 }
      ],
      hard: [
        { question: "A shape with 5 straight sides is called a:", options: ["Pentagon", "Hexagon", "Octagon"], answer: 0 },
        { question: "How many corners (vertices) does a cube have?", options: ["6", "8", "12"], answer: 1 },
        { question: "Which 3D shape looks like a soda can?", options: ["Cylinder", "Cone", "Sphere"], answer: 0 }
      ]
    }
  }
];

export function getGameChallenges(game, difficulty = 'medium') {
  const diffKey = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  return game.challengesByDifficulty?.[diffKey] || game.challenges || [];
}
