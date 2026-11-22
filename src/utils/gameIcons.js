// game-icons.net fallback art (CC BY 3.0, see public/assets/icons/game-icons/CREDITS.md).
import { resolvePublicAssetUrl } from './assetUrl.js';

export const GAME_ICONS = {
  swords: 'lorc-crossed-swords', axe: 'lorc-battle-axe', bow: 'lorc-bowman', crown: 'lorc-crown',
  skull_crown: 'lorc-crowned-skull', castle: 'lorc-castle', crystal: 'lorc-crystal-ball', gem: 'lorc-diamond-hard',
  gems: 'lorc-gems', dragon: 'lorc-dragon-head', fire: 'lorc-fire-bowl', shell: 'lorc-gold-shell',
  hammer: 'lorc-hammer-drop', lightning: 'lorc-lightning-helix', shield: 'lorc-magic-shield', swirl: 'lorc-magic-swirl',
  planet: 'lorc-ringed-planet', rocket: 'lorc-rocket', blade: 'lorc-sword-wound', helm: 'lorc-visored-helm',
  wings: 'lorc-wing-cloak', wolf: 'lorc-wolf-head', trophy: 'delapouite-diamond-trophy', flag: 'delapouite-pirate-flag'
};

const BY_CATEGORY = { weapons: 'swords', loot: 'gems', badges: 'shield', trophies: 'trophy', 'pet gear': 'helm', 'avatar gear': 'helm' };

/** Name of a game-icon for an explicit iconId or a Shop category, or '' when there is none. */
export function gameIconFor(iconId, category = '') {
  if (iconId && GAME_ICONS[iconId]) return iconId;
  return BY_CATEGORY[String(category).toLowerCase()] || '';
}

export function gameIconUrl(name) {
  return GAME_ICONS[name] ? resolvePublicAssetUrl(`assets/icons/game-icons/${GAME_ICONS[name]}.svg`) : '';
}
