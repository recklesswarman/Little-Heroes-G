// What each built-in child avatar looks like, as a short picture-prompt phrase. The picture model
// never receives the avatar image or any photo, only these fixed words, so a custom or uploaded
// avatar simply falls back to a plain default look. No pink or purple (the app's palette rule).

export const AVATAR_LOOKS = {
  avatar_dragon: 'in a green dragon-hood explorer outfit',
  avatar_cyber: 'in a sleek cyan scout suit and visor',
  avatar_superpup: 'in a puppy-ear hood and small blue cape',
  avatar_space: 'in a small silver knight helmet and tunic',
  avatar_ninja: 'in a soft dark-blue ninja hood and scarf',
  avatar_wizard: 'in a starry midnight-blue wizard hat and robe',
  avatar_robot: 'in a friendly silver robot costume',
  avatar_lion: 'in a golden lion-mane hood',
  avatar_falcon: 'in a brown falcon-feather cape'
};

// Longer versions of the same looks, for models that read long prompts (FLUX). Keyed by the short phrase so
// the wire format does not change: the client still sends only the short look.
export const AVATAR_LOOKS_DETAILED = {
  'in a green dragon-hood explorer outfit': 'wearing a soft green dragon-hood with small cream horns and a rounded scaly tail, a cozy green explorer jacket and little brown boots',
  'in a sleek cyan scout suit and visor': 'wearing a sleek cyan scout suit with glowing teal trim, a clear friendly visor pushed up on the forehead and small silver boots',
  'in a puppy-ear hood and small blue cape': 'wearing a soft cream puppy-ear hood with floppy ears, a small royal-blue cape with a gold clasp and little blue boots',
  'in a small silver knight helmet and tunic': 'wearing a small shiny silver knight helmet with a short golden plume, a soft blue tunic with a silver star and tiny armored boots',
  'in a soft dark-blue ninja hood and scarf': 'wearing a soft dark-blue ninja hood showing only the cheerful eyes, a long flowing scarf and quiet little slippers',
  'in a starry midnight-blue wizard hat and robe': 'wearing a tall floppy midnight-blue wizard hat dotted with tiny gold stars and a matching long robe with wide sleeves',
  'in a friendly silver robot costume': 'wearing a friendly rounded silver robot costume with a glowing cyan chest light, two small antennae and chunky boots',
  'in a golden lion-mane hood': 'wearing a fluffy golden lion-mane hood with small round ears, a warm orange tunic and soft brown paws for mittens',
  'in a brown falcon-feather cape': 'wearing a layered brown falcon-feather cape with cream tips, a soft tan tunic and a small feathered cap'
};

export const DEFAULT_HERO_LOOK = 'in cozy pajamas';
export const DEFAULT_HERO_LOOK_DETAILED = 'wearing soft cozy pajamas with tiny stars and a small heroic cape';

/** Longer look for a short look phrase; the short phrase itself when there is no longer version. */
export function detailedLook(shortLook) {
  const key = String(shortLook || '').trim();
  return Object.prototype.hasOwnProperty.call(AVATAR_LOOKS_DETAILED, key) ? AVATAR_LOOKS_DETAILED[key] : '';
}

/** Look phrase for a built-in avatar id; '' for anything else (custom avatars, unknown ids). */
export function lookForAvatarId(id) {
  return Object.prototype.hasOwnProperty.call(AVATAR_LOOKS, id) ? AVATAR_LOOKS[id] : '';
}
