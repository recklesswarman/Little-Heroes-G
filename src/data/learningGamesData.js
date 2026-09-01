// 6 Pet Adventure Mini Learning Games
// Supports 3 Difficulty Levels configured per child:
// - Easy: Toddler Level (Ages 3-4) with high-contrast emojis & realistic voice prompts
// - Medium: Kids Level (Ages 5-6)
// - Hard: Big Kids Level (Ages 7-9)

export const ADVENTURE_GAMES = [
  {
    id: "phonics_forest",
    title: "Phonics Forest Sound Match",
    subject: "Phonics & Reading",
    energyCost: 15,
    icon: "volume_up",
    color: "#2ecc71",
    rewardCoins: 25,
    rewardXP: 30,
    desc: "Match letters with their beginning animal sounds to awaken the ancient grove!",
    challengesByDifficulty: {
      easy: [
        { question: "Which animal starts with the 'D' sound for Duck?", options: ["🦆 Duck", "🐱 Kitty", "🐸 Frog"], answer: 0 },
        { question: "Can you find the big letter 'A'?", options: ["Letter A", "Letter B", "Letter C"], answer: 0 },
        { question: "Which one is Sparky the Dragon?", options: ["🐉 Dragon", "🍎 Apple", "⭐ Star"], answer: 0 }
      ],
      medium: [
        { question: "Which word starts with the 'D' sound?", options: ["🐉 Dragon", "🍎 Apple", "🌳 Tree"], answer: 0 },
        { question: "Which animal starts with 'B'?", options: ["🐱 Cat", "🐻 Bear", "🐸 Frog"], answer: 1 },
        { question: "Which letter makes the 'S' sound in Sparky?", options: ["Letter S", "Letter M", "Letter T"], answer: 0 }
      ],
      hard: [
        { question: "Which word has the short 'a' vowel sound like in 'Cat'?", options: ["Map", "Cake", "Car"], answer: 0 },
        { question: "How many syllables are in the word 'Adventure'?", options: ["2 Syllables", "3 Syllables", "4 Syllables"], answer: 1 },
        { question: "Which word rhymes with 'Knight'?", options: ["Flight", "Shield", "Dragon"], answer: 0 }
      ]
    }
  },
  {
    id: "counting_castle",
    title: "Counting Castle Treasure",
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
    id: "color_cavern",
    title: "Color Cavern Crystal Sorter",
    subject: "Color & Visual Arts",
    energyCost: 10,
    icon: "palette",
    color: "#3498db",
    rewardCoins: 20,
    rewardXP: 25,
    desc: "Sort magical glowing crystals into matching color energy beacons!",
    challengesByDifficulty: {
      easy: [
        { question: "Find the sunny Yellow crystal!", options: ["🟡 Yellow", "🔵 Blue", "🔴 Red"], answer: 0 },
        { question: "What color is the healthy Green grass?", options: ["🟢 Green", "🟠 Orange", "🟣 Purple"], answer: 0 },
        { question: "Tap the Bright Blue sky color!", options: ["🔵 Blue", "🟡 Yellow", "🟢 Green"], answer: 0 }
      ],
      medium: [
        { question: "What color do you get if you mix Blue and Yellow?", options: ["Green 🟢", "Orange 🟠", "Red 🔴"], answer: 0 },
        { question: "Which crystal is the color of the sunny morning sky?", options: ["Deep Sky Blue 🔵", "Midnight Navy ⚫", "Forest Green 🟢"], answer: 0 },
        { question: "Which color is Rex the Dino?", options: ["Emerald Green 🟢", "Charcoal Slate ⚫", "Sunny Yellow 🟡"], answer: 0 }
      ],
      hard: [
        { question: "What are the three Primary Colors?", options: ["Red, Blue, Yellow", "Orange, Green, Purple", "Black, White, Gray"], answer: 0 },
        { question: "What color is created by mixing Red and Yellow?", options: ["Orange", "Green", "Brown"], answer: 0 },
        { question: "Which color is opposite to Blue on the color wheel?", options: ["Orange", "Green", "Yellow"], answer: 0 }
      ]
    }
  },
  {
    id: "shape_shifter",
    title: "Shape Shifter Temple",
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
  },
  {
    id: "memory_meadow",
    title: "Memory Meadow Match",
    subject: "Memory & Focus",
    energyCost: 15,
    icon: "psychology",
    color: "#00d67d",
    rewardCoins: 25,
    rewardXP: 30,
    desc: "Find hidden matching pairs of hero badges under clover tiles!",
    challengesByDifficulty: {
      easy: [
        { question: "Who is your dragon pet?", options: ["Sparky the Dragon 🐉", "Barnaby the Bear 🐻"], answer: 0 },
        { question: "What do we use to brush teeth?", options: ["Toothbrush 🪥", "Shoe 👟"], answer: 0 },
        { question: "What gives pets energy when hungry?", options: ["Yummy Snack 🍎", "Rock 🪨"], answer: 0 }
      ],
      medium: [
        { question: "Which pet is known as 'The Azure Ember'?", options: ["Sparky the Dragon", "Rex the Dino", "Barnaby the Bear"], answer: 0 },
        { question: "Where does Archie the Scholar Owl read books?", options: ["Library of Hero Mountain", "Under the Ocean", "In the Volcano"], answer: 0 },
        { question: "What tool cleans teeth in AR Battle?", options: ["Toothbrush Laser", "Spoon", "Feather"], answer: 0 }
      ],
      hard: [
        { question: "Which pet element opposes the Fire Dragon in creature duels?", options: ["Aqua / Water", "Wind", "Flora"], answer: 0 },
        { question: "How many stages can a companion pet evolve through?", options: ["4 Stages", "3 Stages", "5 Stages"], answer: 0 },
        { question: "What special machine combines two pets into an Ascendant Titan?", options: ["Master Fusion Chamber", "Reward Shop", "Bath Tub"], answer: 0 }
      ]
    }
  },
  {
    id: "word_wizard",
    title: "Word Wizard Academy",
    subject: "Spelling & Vocabulary",
    energyCost: 15,
    icon: "spellcheck",
    color: "#ffb961",
    rewardCoins: 30,
    rewardXP: 40,
    desc: "Cast spelling spells to help your pet cast powerful quest shields!",
    challengesByDifficulty: {
      easy: [
        { question: "Which word says 'CAT'?", options: ["CAT", "DOG", "SUN"], answer: 0 },
        { question: "Can you tap the word 'GO'?", options: ["GO", "NO", "STOP"], answer: 0 },
        { question: "Which word says 'YES'?", options: ["YES", "BYE", "HI"], answer: 0 }
      ],
      medium: [
        { question: "Spell the word for the bright shining star in the sky:", options: ["S-U-N", "S-O-N", "S-A-N"], answer: 0 },
        { question: "Spell Sparky’s favorite healthy drink:", options: ["W-A-T-E-R", "W-A-T-T-E-R", "W-O-T-E-R"], answer: 0 },
        { question: "What word describes someone brave and helpful?", options: ["H-E-R-O", "Z-E-R-O", "B-A-L-L"], answer: 0 }
      ],
      hard: [
        { question: "Choose the correct spelling for a brave fighter:", options: ["WARRIOR", "WARYOR", "WARIER"], answer: 0 },
        { question: "What is the opposite (antonym) of 'Courageous'?", options: ["Timid / Fearful", "Strong", "Fast"], answer: 0 },
        { question: "Which prefix means 'before'?", options: ["Pre-", "Post-", "Anti-"], answer: 0 }
      ]
    }
  }
];

// Backward compatibility helper
export function getGameChallenges(game, difficulty = 'medium') {
  const diffKey = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  return game.challengesByDifficulty?.[diffKey] || game.challenges || [];
}
