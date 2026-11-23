// Number Dash pictures: ten frames, number lines and base-ten blocks, drawn as small inline SVGs so
// kids can see the math (designs follow the free Math Learning Center / Illustrative Math style of
// manipulatives). Pure, no I/O. Every value is a whole number clamped to a small range, so the SVG
// never contains outside text.

const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const COLORS = { a: '#38bdf8', b: '#fbbf24', crossed: '#64748b', line: '#e2e8f0', jump: '#34d399', ten: '#34d399', one: '#fbbf24', empty: '#0f2334' };

function svg(width, height, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="${label}" data-math-visual>${body}</svg>`;
}

/**
 * Ten frame (2 rows of 5). op: 'add' (a blue + b yellow), 'sub' (a dots, the last b crossed out),
 * 'count' (a dots), 'make10' (a dots, the rest empty). Two frames side by side above 10.
 */
export function tenFrameSvg({ a = 0, b = 0, op = 'add' } = {}) {
  const A = int(a, 0, 20);
  const B = op === 'add' ? int(b, 0, 20 - A) : op === 'sub' ? int(b, 0, A) : 0;
  const total = op === 'add' ? A + B : A;
  const frames = total > 10 ? 2 : 1;
  const cell = 40;
  const gap = 16;
  const width = frames * cell * 5 + (frames - 1) * gap + 8;
  const height = cell * 2 + 8;
  let body = '';
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < 10; i++) {
      const n = f * 10 + i; // dot number, 0-based
      const x = 4 + f * (cell * 5 + gap) + (i % 5) * cell;
      const y = 4 + Math.floor(i / 5) * cell;
      body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${COLORS.empty}" stroke="${COLORS.line}" stroke-width="2"/>`;
      if (n >= total) continue;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const fill = op === 'add' && n >= A ? COLORS.b : COLORS.a;
      const crossed = op === 'sub' && n >= A - B;
      body += `<circle cx="${cx}" cy="${cy}" r="14" fill="${crossed ? COLORS.crossed : fill}"/>`;
      if (crossed) body += `<path d="M${cx - 12} ${cy - 12} L${cx + 12} ${cy + 12} M${cx + 12} ${cy - 12} L${cx - 12} ${cy + 12}" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>`;
    }
  }
  const label = op === 'add' ? `Ten frame: ${A} and ${B} more` : op === 'sub' ? `Ten frame: ${A} take away ${B}` : `Ten frame with ${A} dots`;
  return svg(width, height, body, label);
}

/** Number line from `from` to `to` with a hop from `start` by `jump` (negative = back). `hideEnd` for missing-number puzzles. */
export function numberLineSvg({ from = 0, to = 20, start = 0, jump = 0, hideEnd = false } = {}) {
  const lo = int(from, 0, 100);
  const hi = int(to, lo + 1, lo + 20);
  const s = int(start, lo, hi);
  const e = int(s + Number(jump || 0), lo, hi);
  const step = 28;
  const width = (hi - lo) * step + 40;
  const height = 92;
  const x = (n) => 20 + (n - lo) * step;
  let body = `<line x1="${x(lo) - 8}" y1="62" x2="${x(hi) + 8}" y2="62" stroke="${COLORS.line}" stroke-width="3"/>`;
  for (let n = lo; n <= hi; n++) {
    const big = n % 5 === 0;
    body += `<line x1="${x(n)}" y1="${big ? 52 : 56}" x2="${x(n)}" y2="${big ? 72 : 68}" stroke="${COLORS.line}" stroke-width="${big ? 3 : 2}"/>`;
    const hidden = hideEnd && n === e;
    body += `<text x="${x(n)}" y="88" font-size="12" font-weight="700" text-anchor="middle" fill="${hidden ? COLORS.b : COLORS.line}">${hidden ? '?' : n}</text>`;
  }
  if (e !== s) {
    const mid = (x(s) + x(e)) / 2;
    body += `<path d="M${x(s)} 56 Q${mid} ${Math.max(6, 56 - Math.abs(e - s) * 6)} ${x(e)} 56" fill="none" stroke="${COLORS.jump}" stroke-width="4" stroke-linecap="round"/>`;
    body += `<circle cx="${x(e)}" cy="56" r="5" fill="${COLORS.jump}"/>`;
  }
  body += `<circle cx="${x(s)}" cy="62" r="7" fill="${COLORS.a}"/>`;
  return svg(width, height, body, `Number line: start at ${s}, ${e >= s ? 'jump up' : 'jump back'} ${Math.abs(e - s)}`);
}

/** Base-ten blocks: `tens` rods of 10 and `ones` cubes. */
export function baseTenSvg({ tens = 0, ones = 0 } = {}) {
  const T = int(tens, 0, 9);
  const O = int(ones, 0, 9);
  const u = 12;
  const rodsWidth = T * (u + 8);
  const width = Math.max(80, 8 + rodsWidth + (O ? 24 + Math.ceil(O / 5) * (u + 4) : 0));
  const height = 10 * u + 12;
  let body = '';
  for (let t = 0; t < T; t++) {
    const x = 6 + t * (u + 8);
    for (let i = 0; i < 10; i++) body += `<rect x="${x}" y="${6 + i * u}" width="${u}" height="${u}" fill="${COLORS.ten}" stroke="#065f46" stroke-width="1.5"/>`;
  }
  for (let i = 0; i < O; i++) {
    const x = 6 + rodsWidth + 18 + Math.floor(i / 5) * (u + 4);
    const y = 6 + (9 - (i % 5)) * u;
    body += `<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="${COLORS.one}" stroke="#92400e" stroke-width="1.5"/>`;
  }
  return svg(width, height, body, `${T} tens and ${O} ones`);
}

/** The picture for a challenge's `visual` field, or '' when there is none. */
export function mathVisualSvg(visual) {
  if (!visual || typeof visual !== 'object') return '';
  if (visual.kind === 'ten-frame') return tenFrameSvg(visual);
  if (visual.kind === 'number-line') return numberLineSvg(visual);
  if (visual.kind === 'base-ten') return baseTenSvg(visual);
  return '';
}
