// PhET math sims for the Math Lab (Number Dash). PhET Interactive Simulations, University of
// Colorado Boulder, https://phet.colorado.edu, free under CC BY 4.0 (credited on the screen).
// Each sim is one HTML file. The Pi keeps copies (scripts/pi/phet-sims.mjs, served at /phet/ by
// server/phetService.js) so they work without the internet; other devices open phet.colorado.edu.
// Pure, no I/O.

export const PHET_CREDIT = 'PhET Interactive Simulations, University of Colorado Boulder (CC BY 4.0)';

export const PHET_SIMS = Object.freeze([
  { id: 'number-play', title: 'Number Play', emoji: '🔢', grade: 'K', blurb: 'Count, see and say numbers to 20 with ten frames and pictures.' },
  { id: 'make-a-ten', title: 'Make a Ten', emoji: '🔟', grade: 'K-2', blurb: 'Snap numbers together to make 10 and add bigger numbers.' },
  { id: 'number-compare', title: 'Number Compare', emoji: '⚖️', grade: 'K-1', blurb: 'Which group has more? Compare numbers side by side.' },
  { id: 'fractions-intro', title: 'Fractions Intro', emoji: '🍕', grade: '2-3', blurb: 'Cut pizzas and cakes into equal parts.' }
]);

const isSimId = (id) => PHET_SIMS.some((s) => s.id === id);

/** File name of a sim's single-page build, e.g. "make-a-ten_all.html". */
export function phetFileName(id) {
  return isSimId(id) ? `${id}_all.html` : '';
}

/** phet.colorado.edu address of a sim (latest English build). */
export function phetOnlineUrl(id) {
  return isSimId(id) ? `https://phet.colorado.edu/sims/html/${id}/latest/${phetFileName(id)}` : '';
}

/** Where a sim opens: the Pi's copy when `localIds` has it (with the server base), else PhET online. */
export function phetSimUrl(id, { localIds = [], base = '' } = {}) {
  if (!isSimId(id)) return '';
  return localIds.includes(id) ? `${base}/phet/${phetFileName(id)}` : phetOnlineUrl(id);
}
