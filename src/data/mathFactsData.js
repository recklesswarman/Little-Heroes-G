// Challenges for "Rex's Number Dash": add and subtract facts from memory.
//   easy   = Kindergarten start: within 5    (K.OA.A.5)
//   medium = Kindergarten stretch: within 10 (K.OA.A.5)
//   hard   = 2nd grade: within 20, with missing-number puzzles (2.OA.B.2)
// Questions are written as words ("What is 7 plus 6?") so Rex can read them aloud.

const OPTION_ORDER = [2, 0, 1, 1, 2, 0];

function arrange(value, i) {
  const wrong = [];
  for (const d of [1, -1, 2, -2, 3]) {
    const v = value + d;
    if (v >= 0 && v !== value && !wrong.includes(v)) wrong.push(v);
    if (wrong.length === 2) break;
  }
  const at = OPTION_ORDER[i % OPTION_ORDER.length];
  const options = wrong.slice();
  options.splice(at, 0, value);
  return { options: options.map(String), answer: at };
}

const add = (a, b, std, i) => ({
  standard: std,
  question: `What is ${a} plus ${b}?`,
  hint: a >= b ? `Start at ${a} and count up ${b} more.` : `Start at ${b} and count up ${a} more.`,
  ...arrange(a + b, i)
});
const sub = (a, b, std, i) => ({
  standard: std,
  question: `What is ${a} minus ${b}?`,
  hint: `Start at ${a} and count back ${b}.`,
  ...arrange(a - b, i)
});
const missing = (a, total, std, i) => ({
  standard: std,
  question: `${a} plus what equals ${total}?`,
  hint: `Think: how many more than ${a} makes ${total}? Count up from ${a}.`,
  ...arrange(total - a, i)
});

const EASY_ADD = [[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [1, 3], [2, 3], [4, 1]];
const EASY_SUB = [[3, 1], [4, 2], [5, 2], [5, 3], [4, 1], [5, 1], [3, 2], [5, 4]];
const MED_ADD = [[4, 3], [5, 2], [6, 3], [5, 5], [7, 2], [4, 4], [6, 4], [3, 6]];
const MED_SUB = [[8, 3], [9, 4], [10, 5], [7, 2], [10, 7], [9, 6], [8, 5], [6, 4]];
const HARD_ADD = [[7, 6], [8, 5], [9, 4], [6, 6], [7, 8], [9, 9]];
const HARD_SUB = [[15, 7], [13, 6], [18, 9], [12, 5], [16, 8], [14, 9]];
const HARD_MISSING = [[8, 15], [6, 13], [9, 17], [7, 14]];

function build(difficulty) {
  let i = 0;
  if (difficulty === 'easy') {
    return [...EASY_ADD.map(([a, b]) => add(a, b, 'K.OA.A.5', i++)), ...EASY_SUB.map(([a, b]) => sub(a, b, 'K.OA.A.5', i++))];
  }
  if (difficulty === 'medium') {
    return [...MED_ADD.map(([a, b]) => add(a, b, 'K.OA.A.5', i++)), ...MED_SUB.map(([a, b]) => sub(a, b, 'K.OA.A.5', i++))];
  }
  return [
    ...HARD_ADD.map(([a, b]) => add(a, b, '2.OA.B.2', i++)),
    ...HARD_SUB.map(([a, b]) => sub(a, b, '2.OA.B.2', i++)),
    ...HARD_MISSING.map(([a, t]) => missing(a, t, '2.OA.B.2', i++))
  ];
}

export const MATH_FACT_CHALLENGES = Object.freeze({
  easy: build('easy'),
  medium: build('medium'),
  hard: build('hard')
});
