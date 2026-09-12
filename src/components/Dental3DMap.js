// =========================================================================
// Dental3DMap: Interactive 3D Mouth Arch & Plaque Dissolve Engine 2.0
// Renders upper and lower dental arches with 4 interactive quadrants + tongue,
// dynamic biofilm plaque layers that dissolve in real-time, foaming bubble
// physics, pulsing target arrows, and sparkling clean enamel shaders.
// =========================================================================

export const DENTAL_ZONES = [
  {
    id: 'q1',
    name: 'Top Left Molars',
    shortName: 'Top Left',
    color: '#06b6d4',
    bgLight: 'rgba(6, 182, 212, 0.15)',
    border: 'border-cyan-400',
    text: 'text-cyan-300',
    icon: '🦷',
    arrowAngle: -45,
    instruction: 'Brush in small circles on upper left teeth!'
  },
  {
    id: 'q2',
    name: 'Top Right Molars',
    shortName: 'Top Right',
    color: '#10b981',
    bgLight: 'rgba(16, 185, 129, 0.15)',
    border: 'border-emerald-400',
    text: 'text-emerald-300',
    icon: '🦷',
    arrowAngle: 45,
    instruction: 'Clean the biting surfaces on top right!'
  },
  {
    id: 'q3',
    name: 'Bottom Left Molars',
    shortName: 'Bottom Left',
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.15)',
    border: 'border-amber-400',
    text: 'text-amber-300',
    icon: '🦷',
    arrowAngle: -135,
    instruction: 'Sweep along the lower left gumline!'
  },
  {
    id: 'q4',
    name: 'Bottom Right Molars',
    shortName: 'Bottom Right',
    color: '#8b5cf6',
    bgLight: 'rgba(139, 92, 246, 0.15)',
    border: 'border-purple-400',
    text: 'text-purple-300',
    icon: '🦷',
    arrowAngle: 135,
    instruction: 'Scrub all sides of the bottom right teeth!'
  },
  {
    id: 'q5',
    name: 'Tongue & Front Polish',
    shortName: 'Front & Tongue',
    color: '#ec4899',
    bgLight: 'rgba(236, 72, 153, 0.15)',
    border: 'border-pink-400',
    text: 'text-pink-300',
    icon: '👅',
    arrowAngle: 0,
    instruction: 'Gentle front scrub & tongue polish for super fresh breath!'
  }
];

export function renderDental3DMap({
  quadrantProgress = { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 },
  activeQuadrant = 'q1',
  containerId = 'dental-3d-map-container'
} = {}) {
  return `
    <div id="${containerId}" class="relative w-full max-w-[420px] mx-auto select-none">
      <!-- Glow Underlay -->
      <div class="absolute -inset-2 bg-gradient-to-r from-cyan-500/10 via-emerald-500/15 to-purple-500/10 rounded-3xl blur-xl pointer-events-none"></div>

      <!-- Main Dental Stage Container -->
      <div class="relative bg-slate-900/90 backdrop-blur-md rounded-3xl p-3.5 sm:p-4 border border-white/10 shadow-2xl flex flex-col items-center">
        
        <!-- Header Info Bar -->
        <div class="w-full flex items-center justify-between mb-2.5 px-1">
          <div class="flex items-center gap-1.5">
            <span class="text-base sm:text-lg animate-pulse">✨</span>
            <span class="text-xs sm:text-sm font-black text-slate-200 uppercase tracking-wide">Dental Arch Map</span>
          </div>
          <div id="dental-active-zone-badge" class="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
            Active: Top Left
          </div>
        </div>

        <!-- Interactive Dental Arch SVG Stage -->
        <div class="relative w-full aspect-[4/3] max-h-[240px] flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800">
          
          <!-- Foaming Bubble Layer Canvas -->
          <canvas id="dental-foam-canvas" class="absolute inset-0 w-full h-full pointer-events-none z-20"></canvas>

          <!-- Laser Toothbrush Beam Overlay (when laser sword equipped) -->
          <div id="dental-laser-beam-overlay" class="absolute inset-0 pointer-events-none z-25 opacity-0 transition-opacity duration-300">
            <div class="w-full h-full bg-cyan-400/10 mix-blend-screen animate-pulse"></div>
          </div>

          <!-- Dental Arch SVG Vector -->
          <svg id="dental-arch-svg" class="w-full h-full p-2" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- Plaque Biofilm Gradients -->
              <radialGradient id="plaqueGradQ1" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9" />
                <stop offset="60%" stop-color="#b45309" stop-opacity="0.75" />
                <stop offset="100%" stop-color="#78350f" stop-opacity="0.85" />
              </radialGradient>
              <radialGradient id="plaqueGradQ2" cx="65%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9" />
                <stop offset="60%" stop-color="#b45309" stop-opacity="0.75" />
                <stop offset="100%" stop-color="#78350f" stop-opacity="0.85" />
              </radialGradient>
              <radialGradient id="plaqueGradQ3" cx="35%" cy="70%" r="65%">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9" />
                <stop offset="60%" stop-color="#b45309" stop-opacity="0.75" />
                <stop offset="100%" stop-color="#78350f" stop-opacity="0.85" />
              </radialGradient>
              <radialGradient id="plaqueGradQ4" cx="65%" cy="70%" r="65%">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9" />
                <stop offset="60%" stop-color="#b45309" stop-opacity="0.75" />
                <stop offset="100%" stop-color="#78350f" stop-opacity="0.85" />
              </radialGradient>

              <!-- Enamel Clean Shader Gradient -->
              <linearGradient id="cleanEnamelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="70%" stop-color="#f8fafc" />
                <stop offset="100%" stop-color="#e2e8f0" />
              </linearGradient>

              <!-- Gum Arch Gradient -->
              <linearGradient id="gumGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.85" />
                <stop offset="100%" stop-color="#be123c" stop-opacity="0.95" />
              </linearGradient>

              <!-- Active Target Glow Filter -->
              <filter id="activeZoneGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Mouth Interior / Gum Cavity Background -->
            <path d="M 60 50 C 60 10, 340 10, 340 50 C 355 150, 355 210, 340 260 C 340 290, 60 290, 60 260 C 45 210, 45 150, 60 50 Z" 
                  fill="#1e1022" stroke="#4a154b" stroke-width="4" />

            <!-- Upper Gum Arch -->
            <path d="M 75 80 C 100 35, 300 35, 325 80 C 300 65, 100 65, 75 80 Z" 
                  fill="url(#gumGradient)" stroke="#be123c" stroke-width="2" />

            <!-- Lower Gum Arch -->
            <path d="M 75 220 C 100 265, 300 265, 325 220 C 300 235, 100 235, 75 220 Z" 
                  fill="url(#gumGradient)" stroke="#be123c" stroke-width="2" />

            <!-- ============================================== -->
            <!-- QUADRANT 1: UPPER LEFT TEETH (User's View Left) -->
            <!-- ============================================== -->
            <g id="dental-quadrant-q1" class="cursor-pointer transition-all duration-300">
              <!-- Active Highlight Halo -->
              <path id="q1-halo" d="M 75 80 C 85 48, 175 42, 195 52 L 195 95 C 165 85, 95 90, 75 80 Z" 
                    fill="none" stroke="#06b6d4" stroke-width="6" opacity="0.6" filter="url(#activeZoneGlow)" class="animate-pulse" />
              
              <!-- Upper Left Teeth Arch -->
              <!-- Molar 1 -->
              <rect x="78" y="72" width="22" height="26" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Molar 2 -->
              <rect x="104" y="62" width="20" height="25" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 1 -->
              <rect x="128" y="54" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 2 -->
              <rect x="150" y="48" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Canine/Incisor Left -->
              <rect x="172" y="45" width="20" height="26" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />

              <!-- Plaque Biofilm Layer Q1 (Dissolves as progress reaches 100%) -->
              <path id="plaque-layer-q1" d="M 76 70 C 95 48, 170 42, 194 44 C 196 68, 170 70, 76 96 Z" 
                    fill="url(#plaqueGradQ1)" opacity="0.85" class="transition-opacity duration-300" />
            </g>

            <!-- ============================================== -->
            <!-- QUADRANT 2: UPPER RIGHT TEETH (User's View Right) -->
            <!-- ============================================== -->
            <g id="dental-quadrant-q2" class="cursor-pointer transition-all duration-300">
              <!-- Active Highlight Halo -->
              <path id="q2-halo" d="M 205 52 C 225 42, 315 48, 325 80 L 325 80 C 305 90, 235 85, 205 95 Z" 
                    fill="none" stroke="#10b981" stroke-width="6" opacity="0" filter="url(#activeZoneGlow)" />

              <!-- Upper Right Teeth Arch -->
              <!-- Canine/Incisor Right -->
              <rect x="208" y="45" width="20" height="26" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 2 -->
              <rect x="232" y="48" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 1 -->
              <rect x="254" y="54" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Molar 2 -->
              <rect x="276" y="62" width="20" height="25" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Molar 1 -->
              <rect x="300" y="72" width="22" height="26" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />

              <!-- Plaque Biofilm Layer Q2 -->
              <path id="plaque-layer-q2" d="M 206 44 C 230 42, 305 48, 324 70 C 324 96, 230 70, 206 68 Z" 
                    fill="url(#plaqueGradQ2)" opacity="0.85" class="transition-opacity duration-300" />
            </g>

            <!-- ============================================== -->
            <!-- QUADRANT 3: LOWER LEFT TEETH (User's View Left) -->
            <!-- ============================================== -->
            <g id="dental-quadrant-q3" class="cursor-pointer transition-all duration-300">
              <!-- Active Highlight Halo -->
              <path id="q3-halo" d="M 75 220 C 85 252, 175 258, 195 248 L 195 205 C 165 215, 95 210, 75 220 Z" 
                    fill="none" stroke="#f59e0b" stroke-width="6" opacity="0" filter="url(#activeZoneGlow)" />

              <!-- Lower Left Teeth Arch -->
              <!-- Molar 1 -->
              <rect x="78" y="202" width="22" height="26" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Molar 2 -->
              <rect x="104" y="213" width="20" height="25" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 1 -->
              <rect x="128" y="222" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 2 -->
              <rect x="150" y="228" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Canine/Incisor Left -->
              <rect x="172" y="229" width="20" height="26" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />

              <!-- Plaque Biofilm Layer Q3 -->
              <path id="plaque-layer-q3" d="M 76 230 C 95 252, 170 258, 194 256 C 196 232, 170 230, 76 204 Z" 
                    fill="url(#plaqueGradQ3)" opacity="0.85" class="transition-opacity duration-300" />
            </g>

            <!-- ============================================== -->
            <!-- QUADRANT 4: LOWER RIGHT TEETH (User's View Right) -->
            <!-- ============================================== -->
            <g id="dental-quadrant-q4" class="cursor-pointer transition-all duration-300">
              <!-- Active Highlight Halo -->
              <path id="q4-halo" d="M 205 248 C 225 258, 315 252, 325 220 L 325 220 C 305 210, 235 215, 205 205 Z" 
                    fill="none" stroke="#8b5cf6" stroke-width="6" opacity="0" filter="url(#activeZoneGlow)" />

              <!-- Lower Right Teeth Arch -->
              <!-- Canine/Incisor Right -->
              <rect x="208" y="229" width="20" height="26" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 2 -->
              <rect x="232" y="228" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Premolar 1 -->
              <rect x="254" y="222" width="18" height="24" rx="5" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Molar 2 -->
              <rect x="276" y="213" width="20" height="25" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />
              <!-- Molar 1 -->
              <rect x="300" y="202" width="22" height="26" rx="6" fill="url(#cleanEnamelGrad)" stroke="#94a3b8" stroke-width="1.5" />

              <!-- Plaque Biofilm Layer Q4 -->
              <path id="plaque-layer-q4" d="M 206 256 C 230 258, 305 252, 324 230 C 324 204, 230 230, 206 232 Z" 
                    fill="url(#plaqueGradQ4)" opacity="0.85" class="transition-opacity duration-300" />
            </g>

            <!-- ============================================== -->
            <!-- QUADRANT 5: TONGUE & CENTER POLISH             -->
            <!-- ============================================== -->
            <g id="dental-quadrant-q5" class="cursor-pointer transition-all duration-300">
              <!-- Tongue Organ Shape -->
              <path d="M 155 125 C 140 160, 150 190, 200 195 C 250 190, 260 160, 245 125 C 220 110, 180 110, 155 125 Z" 
                    fill="#f43f5e" stroke="#e11d48" stroke-width="2.5" />
              <!-- Tongue Tastebud Texture Dots -->
              <circle cx="185" cy="140" r="2.5" fill="#fecdd3" opacity="0.7" />
              <circle cx="200" cy="148" r="2.5" fill="#fecdd3" opacity="0.7" />
              <circle cx="215" cy="140" r="2.5" fill="#fecdd3" opacity="0.7" />
              <circle cx="190" cy="165" r="2.5" fill="#fecdd3" opacity="0.7" />
              <circle cx="210" cy="165" r="2.5" fill="#fecdd3" opacity="0.7" />
              <circle cx="200" cy="178" r="2" fill="#fecdd3" opacity="0.7" />

              <!-- Tongue Plaque / Coating Layer -->
              <ellipse id="plaque-layer-q5" cx="200" cy="155" rx="35" ry="28" 
                       fill="#d97706" opacity="0.65" class="transition-opacity duration-300" />
            </g>

            <!-- Animated Brushing Guidance Arrow Pointer -->
            <g id="dental-guidance-arrow" class="transition-transform duration-500 origin-center" transform="translate(135, 75)">
              <circle cx="0" cy="0" r="14" fill="#06b6d4" opacity="0.85" class="animate-ping" />
              <circle cx="0" cy="0" r="10" fill="#0891b2" stroke="#ffffff" stroke-width="2" />
              <path d="M -4 -2 L 4 -2 L 0 5 Z" fill="#ffffff" />
            </g>
          </svg>

        </div>

        <!-- 4 Quadrant Progress Badges Strip -->
        <div class="w-full grid grid-cols-5 gap-1 sm:gap-1.5 mt-3">
          ${DENTAL_ZONES.map(zone => {
            const pct = Math.min(100, Math.max(0, quadrantProgress[zone.id] || 0));
            const isDone = pct >= 100;
            const isActive = activeQuadrant === zone.id;

            return `
              <div id="zone-card-${zone.id}" 
                   class="dental-zone-card flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all duration-300 cursor-pointer
                          ${isActive ? `${zone.border} ${zone.bgLight} scale-105 shadow-md shadow-${zone.id}/30` : 'border-white/5 bg-slate-800/60 opacity-80'}">
                <div class="flex items-center gap-1">
                  <span class="text-xs">${isDone ? '✨' : zone.icon}</span>
                  <span class="text-[9px] sm:text-[10px] font-black ${isActive ? zone.text : 'text-slate-400'} uppercase leading-none">${zone.id.toUpperCase()}</span>
                </div>
                <!-- Mini Progress Ring / Bar -->
                <div class="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden mt-1 border border-white/5">
                  <div id="zone-bar-${zone.id}" 
                       class="h-full rounded-full transition-all duration-300"
                       style="width: ${pct}%; background-color: ${isDone ? '#10b981' : zone.color};"></div>
                </div>
                <span id="zone-pct-${zone.id}" class="text-[8px] sm:text-[9px] font-bold ${isDone ? 'text-emerald-400' : 'text-slate-300'} mt-0.5">${pct}%</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Real-Time Coaching Instruction Box -->
        <div id="dental-coach-instruction" class="w-full mt-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center gap-2 text-center">
          <span class="text-sm animate-bounce">🦖</span>
          <span id="dental-coach-text" class="text-[11px] sm:text-xs font-bold text-slate-200">
            ${DENTAL_ZONES.find(z => z.id === activeQuadrant)?.instruction || 'Brush in gentle circles on this zone!'}
          </span>
        </div>

      </div>
    </div>
  `;
}

// Particle system controller for dynamic foaming bubble lather
class DentalFoamEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
    this.particles = [];
    this.animationFrame = null;
    this.isRunning = false;
    this.hasLaserBuff = false;
  }

  init() {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    this.isRunning = true;
    this.loop();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width || 400;
    this.canvas.height = rect.height || 240;
  }

  spawnBubbles(quadrantId = 'q1', count = 3, hasLaser = false) {
    if (!this.canvas) return;
    this.hasLaserBuff = hasLaser;

    // Center coordinates according to quadrant
    let cx = this.canvas.width * 0.35;
    let cy = this.canvas.height * 0.35;

    if (quadrantId === 'q2') { cx = this.canvas.width * 0.65; cy = this.canvas.height * 0.35; }
    else if (quadrantId === 'q3') { cx = this.canvas.width * 0.35; cy = this.canvas.height * 0.75; }
    else if (quadrantId === 'q4') { cx = this.canvas.width * 0.65; cy = this.canvas.height * 0.75; }
    else if (quadrantId === 'q5') { cx = this.canvas.width * 0.5; cy = this.canvas.height * 0.55; }

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 0.5,
        radius: Math.random() * 6 + 4,
        alpha: 0.9,
        color: hasLaser ? '#22d3ee' : '#ffffff',
        sparkle: Math.random() > 0.4
      });
    }

    if (this.particles.length > 80) {
      this.particles.splice(0, this.particles.length - 80);
    }
  }

  loop() {
    if (!this.isRunning || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.015;
      p.radius *= 0.99;

      if (p.alpha <= 0.05 || p.radius <= 1) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();

      // Shiny bubble highlight
      this.ctx.beginPath();
      this.ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.35, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();

      if (p.sparkle) {
        this.ctx.fillStyle = this.hasLaserBuff ? '#67e8f9' : '#fef08a';
        this.ctx.fillRect(p.x + p.radius * 0.8, p.y - p.radius * 0.8, 2, 2);
      }
      this.ctx.restore();
    }

    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  destroy() {
    this.isRunning = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.particles = [];
  }
}

let activeFoamEngine = null;

export function initDental3DMap(options = {}) {
  const canvas = document.getElementById('dental-foam-canvas');
  if (activeFoamEngine) {
    activeFoamEngine.destroy();
    activeFoamEngine = null;
  }
  if (canvas) {
    activeFoamEngine = new DentalFoamEngine(canvas);
    activeFoamEngine.init();
  }
  return activeFoamEngine;
}

export function updateDental3DMapProgress(quadrantProgress, activeQuadrant, isScrubbing = false, hasLaserSword = false) {
  // 1. Update Plaque Layer Opacities (100% clean = 0% plaque opacity)
  DENTAL_ZONES.forEach(zone => {
    const pct = Math.min(100, Math.max(0, quadrantProgress[zone.id] || 0));
    const isDone = pct >= 100;
    const plaqueEl = document.getElementById(`plaque-layer-${zone.id}`);
    if (plaqueEl) {
      // 0.85 opacity down to 0
      plaqueEl.style.opacity = isDone ? '0' : String(Math.max(0, 0.85 * (1 - pct / 100)));
    }

    // Update Badges & Progress Bars
    const barEl = document.getElementById(`zone-bar-${zone.id}`);
    if (barEl) {
      barEl.style.width = `${pct}%`;
      barEl.style.backgroundColor = isDone ? '#10b981' : zone.color;
    }
    const pctEl = document.getElementById(`zone-pct-${zone.id}`);
    if (pctEl) {
      pctEl.textContent = `${pct}%`;
      if (isDone) pctEl.className = 'text-[8px] sm:text-[9px] font-bold text-emerald-400 mt-0.5';
    }

    // Update Halos
    const haloEl = document.getElementById(`${zone.id}-halo`);
    const cardEl = document.getElementById(`zone-card-${zone.id}`);
    const isActive = activeQuadrant === zone.id;

    if (haloEl) {
      haloEl.setAttribute('opacity', isActive ? '0.75' : '0');
    }
    if (cardEl) {
      if (isActive) {
        cardEl.className = `dental-zone-card flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all duration-300 cursor-pointer ${zone.border} ${zone.bgLight} scale-105 shadow-md shadow-${zone.id}/30`;
      } else {
        cardEl.className = 'dental-zone-card flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all duration-300 cursor-pointer border-white/5 bg-slate-800/60 opacity-80';
      }
    }
  });

  // 2. Update Active Zone Badge & Instruction Text
  const currentZone = DENTAL_ZONES.find(z => z.id === activeQuadrant) || DENTAL_ZONES[0];
  const badgeEl = document.getElementById('dental-active-zone-badge');
  if (badgeEl) {
    badgeEl.textContent = `Active: ${currentZone.shortName}`;
    badgeEl.style.backgroundColor = `${currentZone.color}25`;
    badgeEl.style.borderColor = `${currentZone.color}60`;
    badgeEl.style.color = currentZone.color;
  }

  const coachEl = document.getElementById('dental-coach-text');
  if (coachEl) {
    coachEl.textContent = currentZone.instruction;
  }

  // 3. Guidance Arrow Movement
  const arrowEl = document.getElementById('dental-guidance-arrow');
  if (arrowEl) {
    let tx = 135, ty = 65;
    if (activeQuadrant === 'q2') { tx = 265; ty = 65; }
    else if (activeQuadrant === 'q3') { tx = 135; ty = 230; }
    else if (activeQuadrant === 'q4') { tx = 265; ty = 230; }
    else if (activeQuadrant === 'q5') { tx = 200; ty = 150; }
    arrowEl.setAttribute('transform', `translate(${tx}, ${ty})`);
  }

  // 4. Foam Particles
  if (isScrubbing && activeFoamEngine) {
    activeFoamEngine.spawnBubbles(activeQuadrant, hasLaserSword ? 4 : 2, hasLaserSword);
  }

  // 5. Laser Toothbrush Sword Glow
  const laserEl = document.getElementById('dental-laser-beam-overlay');
  if (laserEl) {
    laserEl.style.opacity = (hasLaserSword && isScrubbing) ? '0.85' : '0';
  }
}

export function destroyDental3DMap() {
  if (activeFoamEngine) {
    activeFoamEngine.destroy();
    activeFoamEngine = null;
  }
}
