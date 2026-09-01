// 3D Graphic & Icon Generator for Little Heroes
// Produces chunky, high-contrast, tactile 3D SVG icons matching the dark green, blue, yellow, and orange theme (strict: NO pink/purple).

export function generate3DIcon(iconName, bgTheme = 'green', label = '') {
  const themes = {
    green: {
      primary: '#2ecc71',
      dark: '#006d37',
      light: '#54e98a',
      bgGradStart: '#1b4332',
      bgGradEnd: '#081c15',
      glow: '#2ecc71'
    },
    blue: {
      primary: '#3498db',
      dark: '#004b73',
      light: '#a3d3ff',
      bgGradStart: '#0f2b48',
      bgGradEnd: '#061320',
      glow: '#3498db'
    },
    yellow: {
      primary: '#f1c40f',
      dark: '#7d5700',
      light: '#ffec85',
      bgGradStart: '#4a3800',
      bgGradEnd: '#1a1400',
      glow: '#f1c40f'
    },
    orange: {
      primary: '#e89300',
      dark: '#5c3a00',
      light: '#ffb961',
      bgGradStart: '#422400',
      bgGradEnd: '#170d00',
      glow: '#e89300'
    },
    teal: {
      primary: '#00d67d',
      dark: '#00522e',
      light: '#72fbbb',
      bgGradStart: '#043420',
      bgGradEnd: '#02160d',
      glow: '#00d67d'
    }
  };

  const t = themes[bgTheme] || themes.green;
  const gradId = 'grad_' + Math.random().toString(36).substr(2, 9);
  const glowId = 'glow_' + Math.random().toString(36).substr(2, 9);

  // Map icon names to material symbols or stylized symbols
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
    <defs>
      <radialGradient id="${gradId}" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${t.light}" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="${t.primary}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${t.bgGradEnd}" stop-opacity="0.98"/>
      </radialGradient>
      
      <linearGradient id="edge_${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${t.light}"/>
        <stop offset="100%" stop-color="${t.dark}"/>
      </linearGradient>

      <filter id="${glowId}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="${t.glow}" flood-opacity="0.5"/>
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
      </filter>
    </defs>

    <!-- Outer Chunky 3D Base -->
    <rect x="14" y="22" width="132" height="124" rx="32" fill="${t.dark}" />
    <rect x="14" y="14" width="132" height="124" rx="32" fill="url(#${gradId})" stroke="url(#edge_${gradId})" stroke-width="4" filter="url(#${glowId})" />
    
    <!-- Tactile Inner Bevel -->
    <rect x="22" y="22" width="116" height="108" rx="24" fill="#0d1f2d" fill-opacity="0.75" stroke="${t.light}" stroke-opacity="0.3" stroke-width="2" />
    
    <!-- Top Specular Highlight Pill -->
    <ellipse cx="80" cy="30" rx="38" ry="8" fill="#ffffff" fill-opacity="0.25" />

    <!-- Center Icon Symbol (Material Symbol / Emoji) -->
    <text x="80" y="92" font-family="'Material Symbols Outlined', 'Segoe UI Emoji', sans-serif" font-size="48" fill="${t.light}" text-anchor="middle" font-weight="900" filter="drop-shadow(0 4px 6px ${t.dark})">
      ${iconName}
    </text>

    ${label ? `<text x="80" y="118" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${label}</text>` : ''}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
