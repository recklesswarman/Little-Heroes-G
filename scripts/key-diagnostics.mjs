// Describes why an API key value is not usable WITHOUT ever returning or printing the value or any character of it.
// Only counts, lengths and category names come out. A pasted secret often has a stray line break, space,
// quote, "NAME=" prefix or an invisible/smart character, and those are all visible as categories.

const PLAIN_KEY = /^[A-Za-z0-9_-]{20,}$/;

/** The key as the script uses it: surrounding whitespace and one pair of surrounding quotes removed. */
export function cleanApiKey(raw) {
  return String(raw ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

export function isPlainApiKey(key) {
  return PLAIN_KEY.test(String(key ?? ''));
}

// [singular, plural, pattern]
const CATEGORIES = [
  ['line break', 'line breaks', /[\r\n]/g],
  ['space or tab', 'spaces or tabs', /[ \t]/g],
  ['quote mark', 'quote marks', /["'`\u2018\u2019\u201c\u201d]/g],
  ['equals sign', 'equals signs', /=/g],
  ['dot', 'dots', /\./g],
  ['slash or backslash', 'slashes or backslashes', /[\\/]/g],
  ['colon, comma or semicolon', 'colons, commas or semicolons', /[:,;]/g],
  ['bracket or brace', 'brackets or braces', /[()[\]{}<>]/g]
];

/** Returns { ok, lines[] }: lines are safe to print (counts and category names only). */
export function describeApiKeyProblems(raw) {
  const value = String(raw ?? '');
  const cleaned = cleanApiKey(value);
  const lines = [];
  lines.push(`length as stored: ${value.length} characters; after trimming spaces and outer quotes: ${cleaned.length} (a normal Gemini key is about 39)`);

  let accounted = 0;
  const found = [];
  for (const [one, many, re] of CATEGORIES) {
    const n = (cleaned.match(re) || []).length;
    if (n) { found.push(`${n} ${n > 1 ? many : one}`); accounted += n; }
  }
  const nonAscii = (cleaned.match(/[^\x00-\x7f]/g) || []).length;
  if (nonAscii) { found.push(`${nonAscii} non-English or invisible character${nonAscii > 1 ? 's' : ''} (for example a smart quote or a zero-width space)`); accounted += nonAscii; }
  const allBad = (cleaned.match(/[^A-Za-z0-9_-]/g) || []).length;
  const other = allBad - accounted;
  if (other > 0) found.push(`${other} other symbol${other > 1 ? 's' : ''}`);
  if (found.length) lines.push(`inside the trimmed value: ${found.join(', ')}`);
  else if (cleaned.length < 20) lines.push('the trimmed value is too short to be an API key');
  else lines.push('no unexpected characters found');

  const hints = [];
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(cleaned) || /GEMINI_API_KEY/i.test(cleaned)) hints.push('the variable name looks pasted along with the key: paste only the key');
  if (/^bearer\s/i.test(cleaned)) hints.push('it starts with "Bearer": paste only the key');
  if (/^\s*[\[{]/.test(cleaned)) hints.push('it looks like JSON (a service-account file?): the API needs a plain API key from Google AI Studio');
  if (/\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(cleaned)) hints.push('it has the shape of a token with dots, not an API key');
  if (/^AIza/.test(cleaned)) hints.push('it starts with the usual "AIza" prefix');
  else if (cleaned.length) hints.push('it does not start with the usual "AIza" prefix');
  lines.push(...hints.map(h => `hint: ${h}`));
  return { ok: isPlainApiKey(cleaned), lines };
}
