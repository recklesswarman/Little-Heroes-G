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
        { question: "Which word starts with 'S' like Sun?", options: ["☀️ Sun", "🌙 Moon", "☁️ Cloud"], answer: 0, hint: "S-S-Sun in the sunny blue sky!" },
        { question: "Which animal says 'Woof' and starts with 'D' for Dog?", options: ["🐶 Dog", "🐱 Cat", "🐟 Fish"], answer: 0, hint: "Woof woof! D-D-Dog!" },
        { question: "Can you find the letter 'B' for Ball?", options: ["🅱️ Letter B", "🅰️ Letter A", "©️ Letter C"], answer: 0, hint: "B-B-Ball bounces!" },
        { question: "Which word starts with 'F' like Fish?", options: ["🐟 Fish", "🐱 Cat", "🐦 Bird"], answer: 0, hint: "F-F-Fish swims in water!" },
        { question: "Which animal starts with 'T' for Turtle?", options: ["🐢 Turtle", "🐘 Elephant", "🦁 Lion"], answer: 0, hint: "T-T-Turtle is slow and steady!" },
        { question: "Find the letter 'O' for Octopus!", options: ["Letter O", "Letter I", "Letter U"], answer: 0, hint: "O is round like an octopus's head!" },
        { question: "Which word starts with 'P' like Puppy?", options: ["🐶 Puppy", "🐢 Turtle", "🦆 Duck"], answer: 0, hint: "P-P-Puppy wags its tail!" },
        { question: "Which animal starts with 'L' for Lion?", options: ["🦁 Lion", "🐸 Frog", "🐦 Bird"], answer: 0, hint: "L-L-Lion roars loud!" }
      ],
      medium: [
        { question: "Which word starts with the 'D' sound like Dragon?", options: ["🐉 Dragon", "🍎 Apple", "🌳 Tree"], answer: 0, hint: "D-D-Dragon!" },
        { question: "Which animal starts with the letter 'B'?", options: ["🐱 Cat", "🐻 Bear", "🐸 Frog"], answer: 1, hint: "B-B-Bear loves honey!" },
        { question: "Which letter makes the 'S' sound in Sparky?", options: ["Letter S", "Letter M", "Letter T"], answer: 0, hint: "Sssss like a snake or Sparky!" },
        { question: "Which two words rhyme?", options: ["Cat & Hat 🎩", "Dog & Sun ☀️", "Tree & Rock 🪨"], answer: 0, hint: "They both end with the '-at' sound!" },
        { question: "What is the ending sound in the word 'BED'?", options: ["'D' Sound", "'B' Sound", "'T' Sound"], answer: 0, hint: "Be-d... listen to the last letter!" },
        { question: "Which pair of words rhymes with each other?", options: ["Sun & Fun ☀️", "Dog & Tree 🌳", "Star & Moon 🌙"], answer: 0, hint: "They both end with the '-un' sound!" },
        { question: "What is the beginning sound in the word 'Castle'?", options: ["'C' Sound", "'T' Sound", "'L' Sound"], answer: 0, hint: "Cas-tle... listen to the first letter!" },
        { question: "Which word has the same ending sound as 'Night'?", options: ["Light", "Moon", "Star"], answer: 0, hint: "Night and Light both end in '-ight'!" },
        { question: "Which letters blend to make the 'Ch' sound like in 'Chomp'?", options: ["C + H", "S + H", "T + H"], answer: 0, hint: "Ch-ch-chomp like a dinosaur bite!" },
        { question: "Which word starts with a blend like 'Tr' in Tree?", options: ["Train 🚂", "Sun ☀️", "Bear 🐻"], answer: 0, hint: "Tr-Tr-Train chugs down the track!" },
        { question: "What sound do the two L's make in the word 'Hill'?", options: ["'L' Sound", "'H' Sound", "'I' Sound"], answer: 0, hint: "Hi-LL... listen to the end!" },
        { question: "Which word rhymes with 'King'?", options: ["Ring", "Castle", "Crown"], answer: 0, hint: "King and Ring both end with '-ing'!" }
      ],
      hard: [
        { question: "Which word has the short 'a' vowel sound like in 'Cat'?", options: ["Map", "Cake", "Car"], answer: 0, hint: "Short 'a' says 'aaah' like apple or map." },
        { question: "How many syllables are in the word 'Ad-ven-ture'?", options: ["2 Syllables", "3 Syllables", "4 Syllables"], answer: 1, hint: "Clap it out: Ad (1) - ven (2) - ture (3)!" },
        { question: "Which word rhymes with 'Knight'?", options: ["Flight", "Shield", "Dragon"], answer: 0, hint: "Knight and Flight both share the '-ight' sound!" },
        { question: "Which word contains a silent letter?", options: ["Knee", "Jump", "Hero"], answer: 0, hint: "The 'K' in knee makes no sound!" },
        { question: "What is the root word in 'Unbreakable'?", options: ["Break", "Able", "Un"], answer: 0, hint: "Remove 'un-' prefix and '-able' suffix to find the core word." },
        { question: "Which word has a long 'e' vowel sound like in 'Bee'?", options: ["Tree", "Bed", "Big"], answer: 0, hint: "Long 'e' says 'eee' like tree or bee!" },
        { question: "What is the suffix in the word 'Fearless'?", options: ["-less", "Fear", "-ful"], answer: 0, hint: "'-less' means 'without' at the end of the word." },
        { question: "How many syllables are in the word 'Dinosaur'?", options: ["2 Syllables", "3 Syllables", "4 Syllables"], answer: 1, hint: "Di (1) - no (2) - saur (3)!" },
        { question: "Which word rhymes with 'Brave'?", options: ["Cave", "Shield", "Quest"], answer: 0, hint: "Brave and Cave both share the '-ave' sound!" },
        { question: "What is the prefix in the word 'Replay'?", options: ["Re-", "Play", "-ay"], answer: 0, hint: "'Re-' means 'again' at the start of the word." },
        { question: "Which word contains a silent 'B'?", options: ["Climb", "Jump", "Run"], answer: 0, hint: "The 'B' in climb makes no sound!" },
        { question: "What is the compound word made from 'Rain' and 'Bow'?", options: ["Rainbow", "Sunbow", "Snowbow"], answer: 0, hint: "Two small words joined to make one big word!" }
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
        { question: "What number comes after 1? (1, __)", options: ["Number 2", "Number 4", "Number 0"], answer: 0, hint: "1, 2, 3, blast off!" },
        { question: "Can you tap the number 3?", options: ["3️⃣ Number 3", "1️⃣ Number 1", "7️⃣ Number 7"], answer: 0, hint: "Three twinkling stars!" },
        { question: "Count the moons: 🌙 🌙 🌙 🌙", options: ["3 Moons", "4 Moons", "5 Moons"], answer: 1, hint: "One, two, three, four glowing moons!" },
        { question: "Which group has FEWER planets? 🪐 vs 🪐 🪐 🪐", options: ["1 Planet 🪐", "3 Planets", "They are equal"], answer: 0, hint: "One planet is fewer than three!" },
        { question: "What number comes before 5? (__, 5)", options: ["Number 4", "Number 6", "Number 3"], answer: 0, hint: "Count backwards: 5, 4!" },
        { question: "Can you tap the number 0?", options: ["0️⃣ Number 0", "1️⃣ Number 1", "2️⃣ Number 2"], answer: 0, hint: "Zero means none at all!" },
        { question: "Count the shooting stars: ⭐ ⭐ ⭐", options: ["2 Stars", "3 Stars", "5 Stars"], answer: 1, hint: "One, two, three shooting stars!" },
        { question: "Which number is bigger, 3 or 7?", options: ["7", "3", "They are equal"], answer: 0, hint: "7 comes after 3 when you count!" }
      ],
      medium: [
        { question: "If Sparky has 3 coins and finds 4 more, how many does he have?", options: ["6 Coins", "7 Coins", "8 Coins"], answer: 1, hint: "3 + 4 = 7 shiny coins!" },
        { question: "Count the cosmic stars: ⭐ ⭐ ⭐ ⭐ ⭐", options: ["4 Stars", "5 Stars", "6 Stars"], answer: 1, hint: "Count each star: 1, 2, 3, 4, 5!" },
        { question: "What is 10 minus 2 space gems?", options: ["8 Gems", "7 Gems", "9 Gems"], answer: 0, hint: "Start at 10 and count backwards by 2!" },
        { question: "Which number is an EVEN number?", options: ["6", "7", "9"], answer: 0, hint: "Even numbers can be split into two equal teams!" },
        { question: "What number comes next: 2, 4, 6, __?", options: ["8", "7", "10"], answer: 0, hint: "Skip count by 2s!" },
        { question: "If a rocket has 5 crew and 2 more join, how many crew now?", options: ["6 Crew", "7 Crew", "8 Crew"], answer: 1, hint: "5 + 2 = 7 brave astronauts!" },
        { question: "What is 9 minus 3 moon rocks?", options: ["5 Rocks", "6 Rocks", "7 Rocks"], answer: 1, hint: "Start at 9 and count back 3!" },
        { question: "Which number is an ODD number?", options: ["7", "8", "10"], answer: 0, hint: "Odd numbers can't split into two equal teams!" },
        { question: "What number comes next: 5, 10, 15, __?", options: ["18", "20", "25"], answer: 1, hint: "Skip count by 5s!" },
        { question: "Sparky counted 12 stars, then 6 flew away. How many are left?", options: ["5 Stars", "6 Stars", "7 Stars"], answer: 1, hint: "12 - 6 = 6 stars!" },
        { question: "What is 6 plus 6 cosmic coins?", options: ["11 Coins", "12 Coins", "13 Coins"], answer: 1, hint: "6 + 6 = 12 shiny coins!" },
        { question: "Which group of numbers is in the correct counting order?", options: ["3, 4, 5, 6", "6, 4, 3, 5", "5, 3, 6, 4"], answer: 0, hint: "Counting order always goes up one at a time!" }
      ],
      hard: [
        { question: "Sparky has 14 coins and buys an apple for 6 coins. How many are left?", options: ["8 Coins", "7 Coins", "9 Coins"], answer: 0, hint: "14 - 6 = 8 coins." },
        { question: "What is 5 multiplied by 4?", options: ["20", "25", "15"], answer: 0, hint: "Five groups of four equal twenty!" },
        { question: "What number comes next in the sequence: 4, 8, 12, __?", options: ["14", "16", "18"], answer: 1, hint: "Add 4 each step: 12 + 4 = 16!" },
        { question: "What is half of 50 space tokens?", options: ["25", "20", "30"], answer: 0, hint: "25 + 25 = 50!" },
        { question: "If a spaceship travels 15 miles in 3 minutes, how fast is it per minute?", options: ["5 Miles", "3 Miles", "6 Miles"], answer: 0, hint: "Divide 15 by 3!" },
        { question: "What is 7 multiplied by 3?", options: ["21", "24", "18"], answer: 0, hint: "Seven groups of three equal twenty-one!" },
        { question: "If 18 space crystals are shared equally between 3 astronauts, how many does each get?", options: ["5 Crystals", "6 Crystals", "7 Crystals"], answer: 1, hint: "18 divided by 3 equals 6!" },
        { question: "What is one half of 30 star tokens?", options: ["15", "10", "20"], answer: 0, hint: "15 + 15 = 30!" },
        { question: "A spaceship launches at 2:00 and lands at 2:45. How many minutes did the flight take?", options: ["45 Minutes", "30 Minutes", "60 Minutes"], answer: 0, hint: "Count the minutes from 2:00 to 2:45!" },
        { question: "What number comes next in the sequence: 100, 90, 80, __?", options: ["75", "70", "60"], answer: 1, hint: "Subtract 10 each step!" },
        { question: "What is 9 divided by 3?", options: ["3", "2", "6"], answer: 0, hint: "Nine split into 3 equal groups makes 3 each!" },
        { question: "If a comet travels 40 miles in 5 minutes, how fast is it per minute?", options: ["8 Miles", "5 Miles", "10 Miles"], answer: 0, hint: "Divide 40 by 5!" }
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
        { question: "Find the shining Star shape!", options: ["⭐ Star", "🔷 Diamond", "🟣 Oval"], answer: 0, hint: "Twinkle twinkle little star!" },
        { question: "Which shape is shaped like an egg, longer than a circle?", options: ["🟣 Oval", "🔴 Circle", "⏹️ Square"], answer: 0, hint: "An oval is stretched out like an egg!" },
        { question: "Find the shape with 4 sides that aren't all equal, like a door!", options: ["▭ Rectangle", "🔺 Triangle", "⭐ Star"], answer: 0, hint: "A rectangle has 2 long sides and 2 short sides!" },
        { question: "Which shape has 4 sides and looks tilted like a kite?", options: ["🔷 Diamond", "🔴 Circle", "🔺 Triangle"], answer: 0, hint: "A diamond shape looks like a kite in the sky!" },
        { question: "Which shape is round like the sun with no corners?", options: ["🔴 Circle", "⏹️ Square", "🔺 Triangle"], answer: 0, hint: "Round and round, just like the sun!" },
        { question: "Find the shape that looks like a crescent moon!", options: ["🌙 Crescent", "🔴 Circle", "⭐ Star"], answer: 0, hint: "A crescent is curved like a smile in the sky!" },
        { question: "Which shape has the most points: a Triangle or a Star?", options: ["⭐ Star", "🔺 Triangle", "They have the same points"], answer: 0, hint: "A star has 5 points, a triangle has only 3!" },
        { question: "Which shape is a heart made of?", options: ["❤️ Heart", "⏹️ Square", "🔺 Triangle"], answer: 0, hint: "A heart has two curvy bumps on top!" }
      ],
      medium: [
        { question: "How many sides does a triangle have?", options: ["3 Sides", "4 Sides", "5 Sides"], answer: 0, hint: "Tri- means three, like a tricycle!" },
        { question: "Which shape has 4 equal straight sides?", options: ["Circle", "Square", "Oval"], answer: 1, hint: "A square has 4 equal sides and 4 square corners." },
        { question: "What shape is a shiny habit coin?", options: ["Circle", "Triangle", "Star"], answer: 0, hint: "Coins roll easily because they are circles!" },
        { question: "Which 3D shape looks like an ice cream cone?", options: ["Cone 🍦", "Cube 🧊", "Sphere ⚽"], answer: 0, hint: "Pointy at the bottom, round on top!" },
        { question: "How many sides does a rectangle have?", options: ["4 Sides", "3 Sides", "6 Sides"], answer: 0, hint: "2 long sides and 2 short sides make 4 sides!" },
        { question: "How many corners does a square have?", options: ["4 Corners", "3 Corners", "5 Corners"], answer: 0, hint: "A square has 4 equal corners, just like its 4 sides!" },
        { question: "Which 3D shape is perfectly round like a ball?", options: ["Sphere ⚽", "Cube 🧊", "Cylinder"], answer: 0, hint: "A sphere is round all the way around, like a ball!" },
        { question: "How many sides does a pentagon have?", options: ["5 Sides", "4 Sides", "6 Sides"], answer: 0, hint: "Penta- means five!" },
        { question: "Which 3D shape has 6 flat square faces?", options: ["Cube 🧊", "Sphere ⚽", "Cone"], answer: 0, hint: "A cube looks like a dice with 6 equal sides!" },
        { question: "Which shape has NO straight sides at all?", options: ["Circle", "Square", "Hexagon"], answer: 0, hint: "A circle is just one smooth curved line!" },
        { question: "How many sides does a hexagon have?", options: ["6 Sides", "5 Sides", "7 Sides"], answer: 0, hint: "Hexa- means six, just like a honeycomb cell!" },
        { question: "Which flat shape makes up the base of a pyramid toy?", options: ["Square", "Circle", "Oval"], answer: 0, hint: "A pyramid's bottom is usually a square!" }
      ],
      hard: [
        { question: "A shape with 5 straight sides is called a:", options: ["Pentagon", "Hexagon", "Octagon"], answer: 0, hint: "Penta- means 5 sides!" },
        { question: "How many corners (vertices) does a solid 3D cube have?", options: ["6", "8", "12"], answer: 1, hint: "4 corners on the top face + 4 on the bottom = 8 vertices!" },
        { question: "Which 3D shape looks like a soda can or water pipe?", options: ["Cylinder", "Cone", "Sphere"], answer: 0, hint: "A cylinder has 2 circular bases and 1 curved surface." },
        { question: "A stop sign on the street is which polygon shape?", options: ["Octagon (8 sides)", "Hexagon (6 sides)", "Decagon (10 sides)"], answer: 0, hint: "Stop signs have 8 sides!" },
        { question: "What is the name of a triangle where all 3 sides are equal length?", options: ["Equilateral", "Isosceles", "Scalene"], answer: 0, hint: "Equi- means equal!" },
        { question: "What is the name for a triangle with 2 equal sides?", options: ["Isosceles", "Equilateral", "Scalene"], answer: 0, hint: "Isosceles triangles have exactly two matching sides!" },
        { question: "How many edges does a cube have?", options: ["12", "8", "6"], answer: 0, hint: "Count the lines where each square face meets another!" },
        { question: "A shape with 10 straight sides is called a:", options: ["Decagon", "Octagon", "Nonagon"], answer: 0, hint: "Deca- means 10 sides!" },
        { question: "Which 3D shape has a circular base and a pointy top, like a party hat?", options: ["Cone", "Cylinder", "Sphere"], answer: 0, hint: "A cone narrows to a single point at the top!" },
        { question: "What do we call lines that never meet, like train tracks?", options: ["Parallel lines", "Perpendicular lines", "Curved lines"], answer: 0, hint: "Parallel lines always stay the same distance apart!" },
        { question: "What is the name for an angle that forms a perfect corner, like a square's?", options: ["Right angle", "Acute angle", "Obtuse angle"], answer: 0, hint: "A right angle is exactly 90 degrees!" },
        { question: "How many faces does a triangular pyramid (tetrahedron) have?", options: ["4", "5", "6"], answer: 0, hint: "Three triangle sides plus one triangle base equal four faces!" }
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
        { question: "Which face shows feeling Surprised?", options: ["😲 Surprised", "😴 Tired", "😋 Hungry"], answer: 0, hint: "Wide eyes and an open round mouth!" },
        { question: "Which face shows feeling Scared?", options: ["😨 Scared", "😊 Happy", "😋 Hungry"], answer: 0, hint: "Wide eyes and a worried mouth!" },
        { question: "What should you say when a friend shares their toy with you?", options: ["'Thank you!'", "'Give me more!'", "Say nothing"], answer: 0, hint: "Saying thank you shows gratitude!" },
        { question: "Which face looks Sleepy and Tired?", options: ["😴 Sleepy", "😠 Grumpy", "😲 Surprised"], answer: 0, hint: "Droopy eyes and a big yawn!" },
        { question: "How can you help a friend who fell down?", options: ["🤗 Ask if they're okay and help them up", "😆 Laugh at them", "🚶 Walk away"], answer: 0, hint: "A caring hero always checks on their friends!" },
        { question: "Which face shows feeling Proud of a job well done?", options: ["😊 Proud", "😢 Sad", "😨 Scared"], answer: 0, hint: "A big smile and standing tall like a hero!" },
        { question: "What can you do to calm down when you feel worried?", options: ["🧸 Hug a stuffed animal and breathe slowly", "🏃 Run around fast", "📢 Yell loudly"], answer: 0, hint: "Slow breaths and a cozy hug help big feelings feel smaller." },
        { question: "Which face shows someone feeling Silly and Giggly?", options: ["😄 Giggly", "😴 Tired", "😢 Sad"], answer: 0, hint: "A giggly face has a huge open laugh!" }
      ],
      medium: [
        { question: "Your friend's tower of blocks fell over. What is an empathetic response?", options: ["'I can help you build it back up!'", "'Haha, that fell fast!'", "'You shouldn't play with blocks.'"], answer: 0, hint: "Empathy means understanding how your friend feels and helping them." },
        { question: "What body cue tells you someone is feeling anxious or nervous?", options: ["Fast heartbeat & fidgeting hands", "Yawning and stretching", "Laughing at a cartoon"], answer: 0, hint: "Nervous butterflies in the tummy can make hands fidget." },
        { question: "When sharing toys on the playground, what rule helps everyone have fun?", options: ["Take turns with a friendly timer", "Keep all the toys to yourself", "Hide the toys"], answer: 0, hint: "Taking turns ensures all heroes get a turn!" },
        { question: "What is 'Self-Regulation'?", options: ["Recognizing big feelings and calming your body", "Never feeling sad", "Winning every game"], answer: 0, hint: "It is learning how to calm your body when big feelings happen." },
        { question: "If you accidentally bump into someone, what are the magic words?", options: ["'I'm so sorry, are you okay?'", "'Move out of the way!'", "Say nothing"], answer: 0, hint: "Saying sorry and asking if they are okay shows respect and care." },
        { question: "What is a good way to ask to join a game you want to play?", options: ["'Can I please play too?'", "Grab the toy without asking", "Walk away sadly"], answer: 0, hint: "Asking politely helps everyone understand what you want." },
        { question: "If you feel jealous that a friend got a new toy, what's a healthy thing to do?", options: ["Tell them 'That's so cool!' and feel happy for them", "Take their toy away", "Ignore them all day"], answer: 0, hint: "Celebrating a friend's good news is a true hero quality!" },
        { question: "What does it mean to be 'Patient'?", options: ["Waiting calmly without getting upset", "Getting your turn first always", "Rushing everyone else"], answer: 0, hint: "Patience means waiting calmly, even when it's hard!" },
        { question: "Your friend seems quiet and sad today. What's a kind first step?", options: ["Gently ask 'Are you okay? Want to talk?'", "Ignore them and play alone", "Tell them to cheer up immediately"], answer: 0, hint: "Checking in with kindness opens the door to helping." },
        { question: "What is a healthy way to show you're proud of yourself?", options: ["Celebrate quietly without bragging", "Tell everyone you're the best", "Make fun of others who didn't win"], answer: 0, hint: "True pride doesn't need to put others down." },
        { question: "If two friends both want the same toy, what's a fair solution?", options: ["Take turns with a timer", "Whoever grabs it first keeps it", "Nobody gets to play with it"], answer: 0, hint: "Taking turns fairly keeps everyone happy!" },
        { question: "What should you do if you make a mistake that hurts a friend's feelings?", options: ["Apologize sincerely and ask how to make it better", "Pretend it didn't happen", "Blame someone else"], answer: 0, hint: "A sincere apology helps friendships heal and grow stronger." }
      ],
      hard: [
        { question: "Which strategy is best when resolving a disagreement with a sibling or classmate?", options: ["Use 'I-statements' and listen respectfully", "Interrupt loudly to prove your point", "Give the silent treatment"], answer: 0, hint: "Saying 'I feel sad when...' helps others understand without blame." },
        { question: "What does having 'Gratitude' mean?", options: ["Appreciating and thanking others for positive things", "Expecting rewards for everything", "Feeling jealous of others' toys"], answer: 0, hint: "Gratitude is feeling thankful in your heart!" },
        { question: "How does the '4-7-8' breathing technique help the nervous system?", options: ["Slows heart rate and calms the stress response", "Makes you run faster", "Increases adrenaline"], answer: 0, hint: "Deep breaths activate the body's natural relaxation system." },
        { question: "What is an example of an internal emotion vs an external reaction?", options: ["Feeling disappointed inside vs crossing your arms", "Crying vs yelling", "Smiling vs dancing"], answer: 0, hint: "Feelings happen inside our minds and bodies first!" },
        { question: "How can you support a friend who is experiencing a tough day?", options: ["Listen without judgment and offer a quiet companion presence", "Tell them their problems aren't a big deal", "Change the subject quickly"], answer: 0, hint: "Just being there to listen is the superpower of a true hero." },
        { question: "How is 'Empathy' different from 'Sympathy'?", options: ["Empathy means feeling WITH someone, sympathy means feeling sorry FOR them", "They mean the exact same thing", "Empathy means ignoring feelings"], answer: 0, hint: "Empathy is imagining yourself in their shoes." },
        { question: "Why is it healthy to name your feelings out loud, like 'I feel frustrated'?", options: ["It helps your brain and others understand what you need", "It makes the feeling worse", "It is impolite to talk about feelings"], answer: 0, hint: "Naming feelings is the first step to managing them well." },
        { question: "What is a 'Growth Mindset'?", options: ["Believing you can improve with practice, even after mistakes", "Believing talent never changes", "Giving up when something is hard"], answer: 0, hint: "A growth mindset turns 'I can't' into 'I can't YET'!" },
        { question: "How can taking a friend's perspective help solve an argument?", options: ["It helps you understand why they feel that way", "It proves you are always right", "It ends the friendship faster"], answer: 0, hint: "Seeing both sides makes finding fair solutions easier." },
        { question: "What is a healthy boundary you can set with a friend?", options: ["'I don't like it when you take my things without asking.'", "Never speaking to them again", "Yelling instead of explaining"], answer: 0, hint: "Boundaries are calm, clear statements about what feels okay." },
        { question: "Why might someone act grumpy even when nothing seems wrong?", options: ["They might be hungry, tired, or dealing with a feeling they haven't named yet", "They are always a mean person", "They want to ruin everyone's day"], answer: 0, hint: "Big feelings often hide behind behavior -- curiosity helps us understand." },
        { question: "What's a resilient way to respond after losing a game?", options: ["'Good game! I'll practice and try again.'", "Refuse to ever play again", "Say the game was unfair and storm off"], answer: 0, hint: "Resilience means bouncing back and trying again with a positive attitude." }
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
        { question: "What season has snow, ice, and snowman building?", options: ["❄️ Winter", "☀️ Summer", "🍂 Fall"], answer: 0, hint: "Cold winter with cozy mittens!" },
        { question: "What do baby chicks hatch out of?", options: ["🥚 An Egg", "🍎 An Apple", "🌙 The Moon"], answer: 0, hint: "Crack crack! A fuzzy chick comes out!" },
        { question: "Which animal lives in a cozy underground hole?", options: ["🐰 Rabbit", "🐬 Dolphin", "🦅 Eagle"], answer: 0, hint: "Hop hop into a burrow!" },
        { question: "What do bees make that is sweet and sticky?", options: ["🍯 Honey", "🥛 Milk", "🧃 Juice"], answer: 0, hint: "Buzz buzz, bees make this golden treat!" },
        { question: "What do you see in the sky at night that twinkles?", options: ["⭐ Stars", "☀️ The Sun", "🌈 Rainbow"], answer: 0, hint: "Twinkle twinkle, little star!" },
        { question: "Which season comes after Winter, with flowers blooming?", options: ["🌸 Spring", "🍂 Fall", "☀️ Summer"], answer: 0, hint: "Flowers and baby animals appear in spring!" },
        { question: "What do caterpillars turn into?", options: ["🦋 Butterfly", "🐸 Frog", "🐝 Bee"], answer: 0, hint: "A wiggly caterpillar becomes a beautiful flying friend!" },
        { question: "What color is the sky on a clear sunny day?", options: ["🔵 Blue", "🟢 Green", "🟣 Purple"], answer: 0, hint: "Look up on a sunny day!" }
      ],
      medium: [
        { question: "What is the first stage in the life cycle of a butterfly?", options: ["🥚 Tiny Egg", "🐛 Caterpillar", "🦋 Winged Butterfly"], answer: 0, hint: "First comes the tiny egg on a leaf!" },
        { question: "What is the closest star to planet Earth that gives us warmth?", options: ["The Sun ☀️", "The Moon 🌙", "Mars 🔴"], answer: 0, hint: "The Sun is our very own glowing star!" },
        { question: "Which animal is a Mammal that feeds milk to its babies?", options: ["🐬 Dolphin", "🦎 Lizard", "🐸 Frog"], answer: 0, hint: "Dolphins and bears are mammals!" },
        { question: "What turns water from liquid into solid ice?", options: ["Freezing cold temperatures ❄️", "Hot boiling sun ☀️", "Wind blowing 💨"], answer: 0, hint: "When it gets below 32°F (0°C), water freezes solid!" },
        { question: "Why do trees have roots deep in the soil?", options: ["To drink water and anchor the tree", "To catch butterflies", "To make flowers smell nice"], answer: 0, hint: "Roots drink up rain water from underground!" },
        { question: "What do we call animals that only eat plants?", options: ["Herbivores", "Carnivores", "Omnivores"], answer: 0, hint: "Herbi- relates to plants, like 'herb'!" },
        { question: "Which part of a plant absorbs water from the soil?", options: ["Roots", "Leaves", "Flower petals"], answer: 0, hint: "Roots grow deep underground to drink!" },
        { question: "What is the name for frozen precipitation that falls in winter?", options: ["Snow", "Rain", "Fog"], answer: 0, hint: "Soft, white, and cold -- perfect for snowmen!" },
        { question: "Which animal is known for changing its skin color to hide?", options: ["Chameleon 🦎", "Elephant 🐘", "Penguin 🐧"], answer: 0, hint: "This lizard blends into leaves and branches!" },
        { question: "What do we call the path the Earth takes around the Sun?", options: ["Orbit", "Rotation", "Eclipse"], answer: 0, hint: "Earth travels in a big loop around the Sun each year!" },
        { question: "What happens to ice when it gets warm?", options: ["It melts into liquid water", "It turns into a cloud instantly", "It gets colder"], answer: 0, hint: "Heat turns solid ice back into liquid water!" },
        { question: "Which gas do humans breathe in that plants help produce?", options: ["Oxygen", "Carbon Dioxide", "Helium"], answer: 0, hint: "Plants release this gas that we need to breathe!" }
      ],
      hard: [
        { question: "What process do green plants use to create food from sunlight?", options: ["Photosynthesis", "Metamorphosis", "Evaporation"], answer: 0, hint: "Photo- means light, and synthesis means putting together!" },
        { question: "Which layer of the Earth is the hottest center core?", options: ["Inner Core", "Crust", "Mantle"], answer: 0, hint: "Deep in the center of Earth lies the blazing solid iron core!" },
        { question: "What force pulls objects toward the center of the Earth?", options: ["Gravity", "Magnetism", "Friction"], answer: 0, hint: "Gravity keeps our feet on the ground and dropped apples falling!" },
        { question: "What is the third planet from the Sun in our Solar System?", options: ["Earth 🌍", "Mars 🔴", "Venus 🟡"], answer: 0, hint: "Mercury, Venus, then Earth!" },
        { question: "What is the water cycle step where liquid water turns into rising water vapor?", options: ["Evaporation", "Precipitation", "Condensation"], answer: 0, hint: "Warm sun evaporates water into invisible vapor clouds!" },
        { question: "What is the name for the force that keeps planets orbiting the Sun?", options: ["Gravity", "Magnetism", "Momentum"], answer: 0, hint: "The same force that pulls apples down to Earth also holds planets in orbit!" },
        { question: "What are the three states of matter?", options: ["Solid, Liquid, Gas", "Hot, Cold, Warm", "Big, Medium, Small"], answer: 0, hint: "Ice (solid), water (liquid), and steam (gas) are the same substance!" },
        { question: "What is an ecosystem?", options: ["A community of living things and their environment working together", "A single type of rock", "A man-made machine"], answer: 0, hint: "Think of a forest: plants, animals, soil, and weather all connected!" },
        { question: "Which organ in the human body pumps blood?", options: ["The Heart", "The Lungs", "The Brain"], answer: 0, hint: "You can feel it beating in your chest!" },
        { question: "What causes the different phases of the Moon we see?", options: ["The Moon's position relative to the Sun and Earth", "The Moon changing size", "Clouds covering the Moon"], answer: 0, hint: "We see different amounts of the Moon's sunlit side as it orbits Earth!" },
        { question: "What is the term for an animal that is active mostly at night?", options: ["Nocturnal", "Diurnal", "Hibernating"], answer: 0, hint: "Owls and bats are both active after dark!" },
        { question: "What natural event happens when tectonic plates shift suddenly?", options: ["Earthquake", "Rainbow", "Eclipse"], answer: 0, hint: "The ground shakes when giant rock plates deep underground move!" }
      ]
    }
  }
];

// Backwards-compatibility aliases for QuestMapView & existing links -- these
// share the SAME challenge arrays as their parent realm by reference (not a
// copy) so expanding/fixing the parent's question bank never risks the two
// silently drifting out of sync again.
const numberGalaxyGame = ADVENTURE_GAMES.find(g => g.id === 'number_galaxy');
const shapeKingdomGame = ADVENTURE_GAMES.find(g => g.id === 'shape_kingdom');

ADVENTURE_GAMES.push(
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
    challengesByDifficulty: numberGalaxyGame.challengesByDifficulty
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
    challengesByDifficulty: shapeKingdomGame.challengesByDifficulty
  }
);

export function getGameChallenges(game, difficulty = 'medium') {
  const diffKey = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  return game.challengesByDifficulty?.[diffKey] || game.challenges || [];
}

// Fisher-Yates shuffle, used to vary question order across replays of the
// same realm/tier (the quiz still walks every question each session -- this
// just stops it being the identical order every single time). Returns a new
// array; never mutates the source data.
export function shuffleChallenges(challenges) {
  const shuffled = [...challenges];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
