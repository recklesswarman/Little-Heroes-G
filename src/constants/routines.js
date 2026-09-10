/**
 * Routine & Task Forest Chores configuration
 * Maps each routine to a standard Google Material Symbols font ligature.
 */
export const ROUTINES = [
  {
    id: 'morning_brush',
    title: 'Morning Toothbrush AR Battle',
    zone: 'Task Forest',
    icon: 'dentistry',
    altIcon: 'clean_hands',
    timeWindow: '6:00 AM - 9:00 AM',
    coins: 30,
    points: 15,
    xp: 50,
    completed: false,
    pointsApproved: false,
    isAR: true,
    desc: 'Hands-free 2-minute scrubbing battle against the Sugar Boss.'
  },
  {
    id: 'make_bed',
    title: 'Make Your Hero Bed',
    zone: 'Task Forest',
    icon: 'bed',
    timeWindow: 'Morning',
    coins: 20,
    points: 10,
    xp: 30,
    completed: false,
    pointsApproved: false,
    desc: 'Pull up sheets, tuck blankets, and align pillows neatly.'
  },
  {
    id: 'clean_toys',
    title: 'Clean Up Toys & Blocks',
    zone: 'Task Forest',
    icon: 'toys',
    altIcon: 'category',
    timeWindow: 'Afternoon',
    coins: 35,
    points: 15,
    xp: 45,
    completed: false,
    pointsApproved: false,
    desc: 'Stow shields, cars, and blocks into the toy chest.'
  },
  {
    id: 'homework_reading',
    title: 'Homework / 15m Reading',
    zone: 'Task Forest',
    icon: 'menu_book',
    altIcon: 'school',
    timeWindow: '3:00 PM - 6:00 PM',
    coins: 30,
    points: 20,
    xp: 40,
    completed: false,
    pointsApproved: false,
    desc: 'Level up your brain power with stories or worksheets.'
  },
  {
    id: 'night_bedtime',
    title: 'Bedtime Routine on Time',
    zone: 'Task Forest',
    icon: 'bedtime',
    altIcon: 'nights_stay',
    timeWindow: '7:30 PM - 8:30 PM',
    coins: 40,
    points: 25,
    xp: 60,
    completed: false,
    pointsApproved: false,
    desc: 'Pajamas on, lights dimmed, and ready for sleep.'
  }
];

export const HABIT_ISLANDS = [
  {
    id: 'drink_water',
    title: 'Drink 4 Cups of Water',
    zone: 'Habit Islands',
    icon: 'water_drop',
    coins: 15,
    points: 5,
    xp: 20,
    completed: false,
    pointsApproved: false,
    desc: 'Keep your hydration meter full with crystal spring water.'
  },
  {
    id: 'gentle_words',
    title: 'Use Kind & Gentle Words',
    zone: 'Habit Islands',
    icon: 'favorite',
    coins: 20,
    points: 10,
    xp: 25,
    completed: false,
    pointsApproved: false,
    desc: 'Spread kindness to siblings, parents, and friends today.'
  },
  {
    id: 'healthy_snack',
    title: 'Eat Fruit or Veggie Snack',
    zone: 'Habit Islands',
    icon: 'nutrition',
    coins: 20,
    points: 5,
    xp: 20,
    completed: false,
    pointsApproved: false,
    desc: 'Crunch on apples, carrots, or berries for instant vitality.'
  },
  {
    id: 'hand_washing',
    title: 'Wash Hands (20 Secs)',
    zone: 'Habit Islands',
    icon: 'clean_hands',
    coins: 10,
    points: 5,
    xp: 15,
    completed: false,
    pointsApproved: false,
    desc: 'Scrub all suds clean before meals and after playing outside.'
  }
];
