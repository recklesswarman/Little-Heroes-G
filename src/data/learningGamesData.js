// 6 Pet Adventure Mini Learning Games (Phonics, Counting, Colors, Shapes, Memory, Words)
// Costs Energy to play, awards Habit Coins & Hero XP!

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
    challenges: [
      { question: "Which word starts with the 'D' sound?", options: ["🐉 Dragon", "🍎 Apple", "🌳 Tree"], answer: 0 },
      { question: "Which animal starts with 'B'?", options: ["🐱 Cat", "🐻 Bear", "🐸 Frog"], answer: 1 },
      { question: "Which letter makes the 'S' sound in Sparky?", options: ["Letter S", "Letter M", "Letter T"], answer: 0 }
    ]
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
    challenges: [
      { question: "If Sparky has 3 coins and finds 4 more, how many does he have?", options: ["6 Coins", "7 Coins", "8 Coins"], answer: 1 },
      { question: "Count the stars: ⭐ ⭐ ⭐ ⭐ ⭐", options: ["4 Stars", "5 Stars", "6 Stars"], answer: 1 },
      { question: "What is 10 minus 2 gems?", options: ["8 Gems", "7 Gems", "9 Gems"], answer: 0 }
    ]
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
    challenges: [
      { question: "What color do you get if you mix Blue and Yellow?", options: ["Green 🟢", "Orange 🟠", "Red 🔴"], answer: 0 },
      { question: "Which crystal is the color of the sunny morning sky?", options: ["Deep Sky Blue 🔵", "Midnight Navy ⚫", "Forest Green 🟢"], answer: 0 },
      { question: "Which color is Rex the Dino?", options: ["Emerald Green 🟢", "Charcoal Slate ⚫", "Sunny Yellow 🟡"], answer: 0 }
    ]
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
    challenges: [
      { question: "How many sides does a triangle have?", options: ["3 Sides", "4 Sides", "5 Sides"], answer: 0 },
      { question: "Which shape has 4 equal straight sides?", options: ["Circle", "Square", "Oval"], answer: 1 },
      { question: "What shape is a shiny habit coin?", options: ["Circle", "Triangle", "Star"], answer: 0 }
    ]
  },
  {
    id: "memory_meadow",
    title: "Memory Meadow Match",
    subject: "Memory & Focus",
    energyCost: 15,
    icon: "psychology",
    color: "#54e98a",
    rewardCoins: 25,
    rewardXP: 30,
    desc: "Find hidden matching pairs of hero badges under clover tiles!",
    challenges: [
      { question: "Which pet is known as 'The Azure Ember'?", options: ["Sparky the Dragon", "Rex the Dino", "Barnaby the Bear"], answer: 0 },
      { question: "Where does Archie the Scholar Owl read books?", options: ["Library of Hero Mountain", "Under the Ocean", "In the Volcano"], answer: 0 },
      { question: "What tool cleans teeth in AR Battle?", options: ["Toothbrush Laser", "Spoon", "Feather"], answer: 0 }
    ]
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
    challenges: [
      { question: "Spell the word for the bright shining star in the sky:", options: ["S-U-N", "S-O-N", "S-A-N"], answer: 0 },
      { question: "Spell Sparky’s favorite healthy drink:", options: ["W-A-T-E-R", "W-A-T-T-E-R", "W-O-T-E-R"], answer: 0 },
      { question: "What word describes someone brave and helpful?", options: ["H-E-R-O", "Z-E-R-O", "B-A-L-L"], answer: 0 }
    ]
  }
];
