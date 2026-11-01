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

export const DEFAULT_HERO_LOOK = 'in cozy pajamas';

/** Look phrase for a built-in avatar id; '' for anything else (custom avatars, unknown ids). */
export function lookForAvatarId(id) {
  return Object.prototype.hasOwnProperty.call(AVATAR_LOOKS, id) ? AVATAR_LOOKS[id] : '';
}
