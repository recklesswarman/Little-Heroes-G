// Generates the three bundled reward animations in public/lottie/ as plain Lottie
// (Bodymovin) JSON: confetti.json, trophy.json, coins.json.
// They're drawn from simple shapes here so they ship with no license strings
// attached and work offline. To use a LottieFiles animation instead, download
// its "Lottie JSON" and save it over the matching file (or point
// VITE_LOTTIE_<KIND>_URL at it -- see src/services/rewardAnimationService.js).
//   node scripts/generate_reward_lottie.mjs
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('public/lottie');
const FR = 30;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const st = v => ({ a: 0, k: v });
const ease = { o: { x: [0.33], y: [0] }, i: { x: [0.67], y: [1] } };
const anim = frames => ({
  a: 1,
  k: frames.map(([t, v], idx) => (idx < frames.length - 1 ? { t, s: Array.isArray(v) ? v : [v], ...ease } : { t, s: Array.isArray(v) ? v : [v] }))
});
const rgb = hex => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};
const fill = hex => ({ ty: 'fl', c: st(rgb(hex)), o: st(100), r: 1, nm: 'Fill' });
const stroke = (hex, w) => ({ ty: 'st', c: st(rgb(hex)), o: st(100), w: st(w), lc: 2, lj: 2, nm: 'Stroke' });
const tr = (extra = {}) => ({ ty: 'tr', p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), ...extra });
const group = (items, extra) => ({ ty: 'gr', it: [...items, tr(extra)], nm: 'Group' });
const rect = (w, h, r = 0, p = [0, 0]) => ({ ty: 'rc', p: st(p), s: st([w, h]), r: st(r), d: 1, nm: 'Rect' });
const ellipse = (w, h, p = [0, 0]) => ({ ty: 'el', p: st(p), s: st([w, h]), d: 1, nm: 'Ellipse' });
const star = (outer, inner, points = 5, p = [0, 0]) => ({
  ty: 'sr', sy: 1, d: 1, pt: st(points), p: st(p), r: st(0), ir: st(inner), is: st(0), or: st(outer), os: st(0), nm: 'Star'
});

function layer(ind, nm, shapes, ks, ip, op) {
  return {
    ddd: 0, ind, ty: 4, nm, sr: 1, ao: 0, ip, op, st: 0, bm: 0,
    ks: { o: st(100), r: st(0), p: st([200, 200, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]), ...ks },
    shapes
  };
}

function comp(nm, op, layers) {
  return { v: '5.7.4', fr: FR, ip: 0, op, w: 400, h: 400, nm, ddd: 0, assets: [], layers };
}

const PALETTE = ['#fbbf24', '#34d399', '#38bdf8', '#f97316', '#a3e635', '#ffffff', '#facc15', '#22d3ee'];

function confetti() {
  const op = 75;
  const layers = [];
  for (let i = 0; i < 36; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 90 + rand() * 110;
    const bx = 200 + Math.cos(angle) * dist;
    const by = 190 + Math.sin(angle) * dist * 0.8 - 40;
    const fall = 90 + rand() * 90;
    const color = PALETTE[i % PALETTE.length];
    const isCircle = i % 3 === 0;
    const shape = isCircle ? ellipse(12, 12) : rect(9 + rand() * 6, 16 + rand() * 8, 2);
    const start = Math.floor(rand() * 6);
    layers.push(layer(i + 1, `piece${i}`, [group([shape, fill(color)])], {
      p: anim([[start, [200, 210, 0]], [start + 18, [bx, by, 0]], [op, [bx + (rand() - 0.5) * 40, by + fall, 0]]]),
      r: anim([[start, 0], [op, (rand() - 0.5) * 900]]),
      s: anim([[start, [30, 30, 100]], [start + 10, [100, 100, 100]], [op, [100, isCircle ? 100 : 35, 100]]]),
      o: anim([[start, 100], [op - 15, 100], [op, 0]])
    }, 0, op));
  }
  return comp('confetti', op, layers);
}

function trophy() {
  const op = 90;
  const gold = '#fbbf24';
  const goldDark = '#d97706';
  // Lottie draws the first shape on top, so the list runs front-to-back.
  const cup = [
    group([star(22, 10, 5, [0, -32]), fill('#fff7ed')]),
    group([rect(110, 14, 7, [0, -80]), fill('#fde68a')]),
    group([rect(130, 90, 14, [0, -40]), fill(gold)]),
    group([ellipse(130, 70, [0, 2]), fill(gold)]),
    group([ellipse(56, 64, [-78, -36]), stroke(goldDark, 12)]),
    group([ellipse(56, 64, [78, -36]), stroke(goldDark, 12)]),
    group([rect(26, 46, 4, [0, 58]), fill(goldDark)]),
    group([rect(96, 22, 8, [0, 88]), fill(goldDark)]),
    group([rect(120, 18, 8, [0, 106]), fill('#92400e')])
  ];
  const layers = [
    layer(1, 'trophy', cup, {
      p: st([200, 215, 0]),
      s: anim([[0, [0, 0, 100]], [12, [118, 118, 100]], [20, [94, 94, 100]], [28, [104, 104, 100]], [36, [100, 100, 100]]]),
      r: anim([[0, -25], [14, 6], [24, -3], [34, 0]])
    }, 0, op),
    layer(2, 'glow', [group([ellipse(260, 260), fill('#fde68a')])], {
      p: st([200, 200, 0]),
      s: anim([[6, [40, 40, 100]], [30, [110, 110, 100]], [op, [120, 120, 100]]]),
      o: anim([[6, 0], [24, 35], [op, 0]])
    }, 0, op)
  ];
  const sparkSpots = [[95, 95], [310, 90], [70, 250], [330, 260], [200, 45], [130, 330], [280, 335]];
  sparkSpots.forEach(([x, y], i) => {
    const t0 = 14 + i * 6;
    layers.unshift(layer(10 + i, `spark${i}`, [group([star(16, 5, 4), fill(i % 2 ? '#ffffff' : '#fde047')])], {
      p: st([x, y, 0]),
      s: anim([[t0, [0, 0, 100]], [t0 + 8, [120, 120, 100]], [t0 + 18, [0, 0, 100]], [t0 + 30, [90, 90, 100]], [t0 + 40, [0, 0, 100]]]),
      r: anim([[t0, 0], [t0 + 40, 180]])
    }, 0, op));
  });
  return comp('trophy', op, layers);
}

function coins() {
  const op = 80;
  const layers = [];
  const xs = [110, 160, 200, 240, 290, 135, 265];
  xs.forEach((x, i) => {
    const t0 = i * 5;
    const landY = 300 - (i % 3) * 18;
    const coin = [
      group([ellipse(30, 30), fill('#fde68a')]),
      group([ellipse(46, 46), fill('#d97706')]),
      group([ellipse(56, 56), fill('#fbbf24')])
    ];
    layers.push(layer(i + 1, `coin${i}`, coin, {
      p: anim([[t0, [x, -40, 0]], [t0 + 22, [x, landY, 0]], [t0 + 30, [x, landY - 40, 0]], [t0 + 38, [x, landY, 0]], [op, [x, landY, 0]]]),
      // squash the x scale back and forth so each coin looks like it's spinning
      s: anim([[t0, [100, 100, 100]], [t0 + 6, [15, 100, 100]], [t0 + 12, [100, 100, 100]], [t0 + 18, [15, 100, 100]], [t0 + 24, [100, 100, 100]], [t0 + 38, [100, 100, 100]]]),
      o: anim([[t0, 100], [op - 12, 100], [op, 0]])
    }, 0, op));
  });
  layers.push(layer(20, 'shine', [group([star(30, 10, 4), fill('#ffffff')])], {
    p: st([200, 210, 0]),
    s: anim([[30, [0, 0, 100]], [40, [140, 140, 100]], [52, [0, 0, 100]]]),
    r: anim([[30, 0], [52, 90]])
  }, 0, op));
  return comp('coins', op, layers);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, data] of Object.entries({ confetti: confetti(), trophy: trophy(), coins: coins() })) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data));
  console.log(`wrote public/lottie/${name}.json`);
}
