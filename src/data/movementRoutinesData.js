// -------------------------------------------------------------
// Pediatric Gross Motor Movement & Dance Routines
// Designed for ages 3-9: Sensory regulation, bilateral coordination,
// vestibular balance, and soothing bedtime transitions.
// -------------------------------------------------------------

export const MOVEMENT_ROUTINES = [
  {
    id: "morning_wake_up",
    title: "Morning Wake-Up Shakeout",
    category: "Morning Activation",
    badge: "☀️ Morning Wake-Up",
    icon: "wb_sunny",
    color: "#f39c12",
    accentBg: "bg-amber-500/20 border-amber-500/50",
    gradient: "from-amber-500/20 via-orange-500/10 to-yellow-500/5",
    buttonClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    bpm: 112,
    musicTheme: "sunshine_funk",
    durationSec: 90,
    pediatricMarker: "Bilateral Coordination & Morning Arousal",
    pediatricDesc: "Activates vestibular, visual, and proprioceptive neural pathways with symmetrical extensions and cross-body motor planning.",
    rewardCoins: 40,
    rewardXP: 60,
    rewardSparks: 10,
    poses: [
      {
        id: "sun_reach",
        name: "Sun Salutation Reach",
        emoji: "☀️",
        targetPillar: "Proprioception",
        instruction: "Reach both arms high to the sky and rise up on your tiptoes!",
        coachSpeech: "Reach up high to the sky, Little Hero! Touch the golden morning clouds with Rex!",
        duration: 18,
        actionType: "stretch",
        companionAction: "stretches both wings upwards with sparkling morning sunbeams"
      },
      {
        id: "silly_tail_shake",
        name: "Silly Tail Shakeout",
        emoji: "🦖",
        targetPillar: "Sensory Activation",
        instruction: "Wiggle your hips and shake out all your sleepy morning sillies!",
        coachSpeech: "Time to shake your silly dinosaur tail! Shake shake shake those morning wiggles out!",
        duration: 18,
        actionType: "bounce",
        companionAction: "wiggles its tail and giggles with floating music notes"
      },
      {
        id: "star_jacks",
        name: "Superhero Star Jumps",
        emoji: "⭐",
        targetPillar: "Bilateral Coordination",
        instruction: "Jump your feet apart and spread your arms like a giant glowing star!",
        coachSpeech: "Jump out wide into a glowing star! 1, 2, 3, jump! Look at you shine!",
        duration: 20,
        actionType: "bounce",
        companionAction: "does mini star leaps in sync with bursts of starlight"
      },
      {
        id: "dino_march",
        name: "Rex Titan March",
        emoji: "🦕",
        targetPillar: "Core & Balance",
        instruction: "Lift your knees up high and march proudly like a friendly dinosaur!",
        coachSpeech: "High knees! March with Rex! Stomp, stomp, stomp into a super fun day!",
        duration: 20,
        actionType: "rhythm",
        companionAction: "stomps along with playful rhythmic ground quakes"
      }
    ]
  },
  {
    id: "afternoon_wiggle",
    title: "Afternoon Wiggle Buster",
    category: "Energy Burn",
    badge: "⚡ Wiggle Buster",
    icon: "bolt",
    color: "#e74c3c",
    accentBg: "bg-rose-500/20 border-rose-500/50",
    gradient: "from-rose-500/20 via-red-500/10 to-orange-500/5",
    buttonClass: "bg-gradient-to-r from-rose-500 to-red-600 text-white",
    bpm: 128,
    musicTheme: "jungle_bop",
    durationSec: 90,
    pediatricMarker: "Sensory Energy Release & Impulse Control",
    pediatricDesc: "Discharges pent-up afternoon energy and trains executive inhibitory control through alternating high-movement bursts and Freeze Dance holds.",
    rewardCoins: 40,
    rewardXP: 60,
    rewardSparks: 10,
    poses: [
      {
        id: "knee_cross_bounce",
        name: "Cross-Body Knee Tap",
        emoji: "🏃",
        targetPillar: "Hemispheric Integration",
        instruction: "Tap your right elbow to your left knee, then left elbow to right knee!",
        coachSpeech: "Cross the superhero line! Tap opposite elbow to knee! Build that super brain power!",
        duration: 20,
        actionType: "rhythm",
        companionAction: "hops side to side crossing paws with electric sparks"
      },
      {
        id: "freeze_statue",
        name: "Freeze Dance Statue",
        emoji: "🧊",
        targetPillar: "Inhibitory Control",
        instruction: "Dance crazy fast... and when Rex says FREEZE, turn into ice!",
        coachSpeech: "Dance and groove... and now... FREEZE! Hold totally still like an ice statue!",
        duration: 18,
        actionType: "freeze",
        companionAction: "freezes in a comical mid-air pose with icy frost crystals"
      },
      {
        id: "cheetah_sprint",
        name: "Cheetah Speed Sprint",
        emoji: "🐆",
        targetPillar: "Cardiovascular Stamina",
        instruction: "Run super fast in place with quick, quiet superhero feet!",
        coachSpeech: "Speed burst! Run fast in place like a jungle cheetah! Zoom zoom zoom!",
        duration: 20,
        actionType: "bounce",
        companionAction: "dashes in place with a dust cloud and motion blur trail"
      },
      {
        id: "flying_hero_balance",
        name: "Sky Soar Balance",
        emoji: "🦸",
        targetPillar: "Vestibular Balance",
        instruction: "Stand on one leg, spread your arms, and lean forward like soaring through clouds!",
        coachSpeech: "Spread your hero wings! Balance on one strong foot! You are soaring so gracefully!",
        duration: 20,
        actionType: "stretch",
        companionAction: "hovers mid-air with gentle wing beats and wind ribbons"
      }
    ]
  },
  {
    id: "bedtime_wind_down",
    title: "Bedtime Wind-Down Stretches",
    category: "Calming & Sleep",
    badge: "🌙 Bedtime Wind-Down",
    icon: "nightlight",
    color: "#8e44ad",
    accentBg: "bg-purple-500/20 border-purple-500/50",
    gradient: "from-purple-500/20 via-indigo-500/10 to-blue-500/5",
    buttonClass: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white",
    bpm: 68,
    musicTheme: "bedtime_lullaby",
    durationSec: 90,
    pediatricMarker: "Somatic Calming & Parasympathetic Sleep Transition",
    pediatricDesc: "Slows heart rate, activates vagal nerve tone, and down-regulates sensory arousal for seamless, meltdown-free bedtime transitions.",
    rewardCoins: 40,
    rewardXP: 60,
    rewardSparks: 10,
    poses: [
      {
        id: "butterfly_flutter",
        name: "Gentle Butterfly Pose",
        emoji: "🦋",
        targetPillar: "Pelvic & Lower Body Calm",
        instruction: "Sit on the floor, bring the soles of your feet together, and flutter your knees gently.",
        coachSpeech: "Sit gently, Little Hero. Press your feet together and let your butterfly wings flutter so softly.",
        duration: 22,
        actionType: "stretch",
        companionAction: "curls gently on a soft cloud cushion with floating moon dust"
      },
      {
        id: "crescent_moon",
        name: "Sleepy Moon Arch",
        emoji: "🌙",
        targetPillar: "Intercostal Expansion",
        instruction: "Reach one arm up and gently curve to the side like a glowing crescent moon.",
        coachSpeech: "Curve like the gentle crescent moon shining in the night sky. Breathe in peace.",
        duration: 20,
        actionType: "stretch",
        companionAction: "curves gently emitting a warm twilight glow"
      },
      {
        id: "calm_turtle",
        name: "Cozy Turtle Shell",
        emoji: "🐢",
        targetPillar: "Flexion & Safe Space",
        instruction: "Tuck your knees to your chest and hug them tight in your warm, cozy shell.",
        coachSpeech: "Tuck into your cozy shell. Everything is peaceful and safe. You did amazing today.",
        duration: 20,
        actionType: "stretch",
        companionAction: "tucks in comfortably with glowing dream orbs"
      },
      {
        id: "whispered_lion_breath",
        name: "Whispered Star Breath",
        emoji: "✨",
        targetPillar: "Vagal Down-Regulation",
        instruction: "Take a deep breath of calm air in through your nose... and softly sigh it out.",
        coachSpeech: "Breathe in sweet starry dreams through your nose... and softly whisper 'ahhhh' into your pillow.",
        duration: 22,
        actionType: "breath",
        companionAction: "closes its eyes and breathes softly with slow rhythmic heartbeats"
      }
    ]
  },
  {
    id: "freestyle_disco",
    title: "Freestyle Pet Disco Arena",
    category: "Creativity & Rhythm",
    badge: "🪩 Freestyle Groove",
    icon: "celebration",
    color: "#00bcd4",
    accentBg: "bg-cyan-500/20 border-cyan-500/50",
    gradient: "from-cyan-500/20 via-blue-500/10 to-teal-500/5",
    buttonClass: "bg-gradient-to-r from-cyan-500 to-teal-500 text-white",
    bpm: 122,
    musicTheme: "cosmic_disco",
    durationSec: 90,
    pediatricMarker: "Expressive Motor Creativity & Rhythm Synchrony",
    pediatricDesc: "Promotes joyful bodily self-expression, rhythm entrainment, and parent-child social bonding through free-form music play.",
    rewardCoins: 40,
    rewardXP: 60,
    rewardSparks: 10,
    poses: [
      {
        id: "disco_jump",
        name: "Rocket Star Jump",
        emoji: "🟢",
        targetPillar: "Explosive Gross Motor",
        instruction: "Tap the green pad and jump into outer space!",
        coachSpeech: "Blast off! Green pad jump! Show off those superhero rocket legs!",
        duration: 18,
        actionType: "rhythm",
        companionAction: "does a 360 rocket flip with green neon trails"
      },
      {
        id: "disco_spin",
        name: "Hero Tornado Spin",
        emoji: "🔵",
        targetPillar: "Rotational Balance",
        instruction: "Tap the blue pad and twirl around like a friendly tornado!",
        coachSpeech: "Blue pad spin! Twirl around with your superhero cape flying!",
        duration: 18,
        actionType: "rhythm",
        companionAction: "spins like a breakdancer spinning on its tail"
      },
      {
        id: "disco_shine",
        name: "Sparkle Starlight Pose",
        emoji: "🟡",
        targetPillar: "Dynamic Balance",
        instruction: "Tap the yellow pad and strike your favorite hero pose!",
        coachSpeech: "Yellow pad strike a pose! Hold that hero stance and let your sparkle shine!",
        duration: 20,
        actionType: "rhythm",
        companionAction: "strikes a golden champion pose with glittering confetti"
      },
      {
        id: "disco_groove",
        name: "Freestyle Beat Shake",
        emoji: "🟣",
        targetPillar: "Rhythm Entrainment",
        instruction: "Tap the purple pad and show us your own unique victory dance!",
        coachSpeech: "Freestyle groove! Any move you want! You are the champion dancer!",
        duration: 20,
        actionType: "rhythm",
        companionAction: "does an enthusiastic happy wiggle with heart emojis"
      }
    ]
  }
];

export function getMovementRoutine(routineId) {
  return MOVEMENT_ROUTINES.find(r => r.id === routineId) || MOVEMENT_ROUTINES[0];
}
