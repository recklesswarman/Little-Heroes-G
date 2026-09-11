/**
 * PetExpeditionCanvas.js
 * 
 * Interactive 3D On-Rails Scenic Cruise Canvas for Little Hero Adventures.
 * Features:
 * - 6 Floating Island Biomes along a 3D Spline Track
 * - 3D Companion Pet Follow Camera (On-Rails Chase View)
 * - 360° Touch/Drag Look-Around & Orbit Tilt
 * - Streak-powered Golden Flame Aura & Particle Jet
 * - 3-Speed Throttle Control (Stroll, Cruise, Hyper Glider)
 * - Interactive 3D Spotter Reticles & Floating Chest Tap Detection
 */

import { store } from '../state/store.js';

export const EXPEDITION_BIOMES = [
  {
    idx: 0,
    id: 'phonics_forest',
    title: 'Phonics Forest',
    subtitle: 'Whispering Woods',
    color: '#2ecc71',
    glowColor: 'rgba(46, 204, 113, 0.4)',
    landmark: 'Ancient Word Arch',
    secretId: 'secret_phonics_tome',
    secretTitle: 'Floating Phonics Tome',
    secretIcon: 'menu_book',
    tokens: 20,
    energy: 10
  },
  {
    idx: 1,
    id: 'counting_castle',
    title: 'Counting Castle',
    subtitle: 'Golden Ramparts',
    color: '#f1c40f',
    glowColor: 'rgba(241, 196, 15, 0.4)',
    landmark: 'Solar Number Keep',
    secretId: 'secret_castle_chalice',
    secretTitle: 'Golden Math Chalice',
    secretIcon: 'emoji_events',
    tokens: 25,
    energy: 15
  },
  {
    idx: 2,
    id: 'glow_cavern',
    title: 'Glow Cavern',
    subtitle: 'Glowstone Caves',
    color: '#3498db',
    glowColor: 'rgba(52, 152, 219, 0.4)',
    landmark: 'Bioluminescent Grotto',
    secretId: 'secret_glow_crystal',
    secretTitle: 'Bioluminescent Cluster',
    secretIcon: 'diamond',
    tokens: 30,
    energy: 15
  },
  {
    idx: 3,
    id: 'totem_highlands',
    title: 'Totem Highlands',
    subtitle: 'Ancient Monoliths',
    color: '#e89300',
    glowColor: 'rgba(232, 147, 0, 0.4)',
    landmark: 'Echo Totem Shrine',
    secretId: 'secret_totem_chest',
    secretTitle: 'Floating Star Crystal Chest',
    secretIcon: 'package_2',
    tokens: 35,
    energy: 20
  },
  {
    idx: 4,
    id: 'emerald_hills',
    title: 'Emerald Hills',
    subtitle: 'Rolling Sky Knolls',
    color: '#00d67d',
    glowColor: 'rgba(0, 214, 125, 0.4)',
    landmark: 'Windmill Spire',
    secretId: 'secret_emerald_seed',
    secretTitle: 'Emerald Star Fruit',
    secretIcon: 'psychology',
    tokens: 40,
    energy: 25
  },
  {
    idx: 5,
    id: 'sky_spire',
    title: 'Sky Spire',
    subtitle: 'Solar Pinnacle',
    color: '#ffb961',
    glowColor: 'rgba(255, 185, 97, 0.4)',
    landmark: 'Celestial Sun Altar',
    secretId: 'secret_sky_relic',
    secretTitle: 'Sky Spire Solar Crest',
    secretIcon: 'military_tech',
    tokens: 50,
    energy: 30
  }
];

export class PetExpeditionCanvas {
  constructor(containerElement, onSecretDiscovered = null, onWaypointChanged = null) {
    this.container = containerElement;
    this.onSecretDiscovered = onSecretDiscovered;
    this.onWaypointChanged = onWaypointChanged;

    this.canvas = null;
    this.ctx = null;
    this.animId = null;

    // Simulation & Rail Progress (0.0 to 1.0 continuously looping across 6 biomes)
    this.progress = 0.0;
    this.lastTime = performance.now();
    this.currentWaypoint = 0;

    // Camera look-around angles (user swipe / drag offsets relative to follow cam)
    this.yaw = 0;   // horizontal rotation (-PI to PI)
    this.pitch = 0; // vertical tilt (-0.4 to 0.4 rad)
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Particles (stars, clouds, speed lines, streak sparks)
    this.particles = [];
    this.speedLines = [];
    this.initParticles();

    // Floating Interactive Reticles in screen space
    this.activeReticles = [];

    this.initCanvas();
    this.bindEvents();
    this.startLoop();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing select-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width || 800;
    this.height = rect.height || 500;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx) {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 70; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 600 - 50,
        z: Math.random() * 1000 + 100,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.7 + 0.3,
        color: ['#54e98a', '#ffb961', '#3498db', '#ffffff'][Math.floor(Math.random() * 4)],
        pulseSpeed: Math.random() * 0.05 + 0.02
      });
    }

    // Speed lines for Hyper Glider mode
    this.speedLines = [];
    for (let i = 0; i < 25; i++) {
      this.speedLines.push({
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 500,
        z: Math.random() * 500 + 50,
        len: Math.random() * 80 + 40
      });
    }
  }

  bindEvents() {
    this._resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this._resizeHandler);

    // Touch and mouse drag for 360 look-around
    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragStartY = clientY;
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      this.dragStartX = clientX;
      this.dragStartY = clientY;

      this.yaw += dx * 0.006;
      this.pitch = Math.max(-0.45, Math.min(0.35, this.pitch + dy * 0.004));
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    this._mouseMoveHandler = (e) => onMove(e.clientX, e.clientY);
    this._mouseUpHandler = onEnd;
    window.addEventListener('mousemove', this._mouseMoveHandler);
    window.addEventListener('mouseup', this._mouseUpHandler);

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this._touchMoveHandler = (e) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.addEventListener('touchmove', this._touchMoveHandler, { passive: true });
    window.addEventListener('touchend', onEnd);

    // Canvas click to interact with 3D Reticles
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      for (const reticle of this.activeReticles) {
        const dist = Math.hypot(clickX - reticle.screenX, clickY - reticle.screenY);
        if (dist <= reticle.radius + 15) {
          if (this.onSecretDiscovered) {
            this.onSecretDiscovered(reticle.biome);
          }
          break;
        }
      }
    });
  }

  // 3D Spline position along track (0.0 to 1.0)
  getSplinePoint(t) {
    const totalBiomes = EXPEDITION_BIOMES.length;
    const scaledT = (t % 1) * totalBiomes;
    const biomeIdx = Math.floor(scaledT);
    const localT = scaledT - biomeIdx;

    // Radius of the grand floating archipelago rail circuit
    const R = 380;
    const angle = ((biomeIdx + localT) / totalBiomes) * Math.PI * 2;

    // Altitude waves & bank curves
    const altitude = Math.sin(angle * 3) * 60 + Math.cos(angle * 2) * 40;
    const wobbleR = R + Math.sin(angle * 4) * 45;

    const x = Math.cos(angle) * wobbleR;
    const z = Math.sin(angle) * wobbleR + 300;
    const y = altitude;

    return { x, y, z, angle, biomeIdx };
  }

  // 3D Projection to 2D Screen Space
  project3D(x, y, z, camX, camY, camZ, yaw, pitch) {
    // Relative coordinates to camera
    let dx = x - camX;
    let dy = y - camY;
    let dz = z - camZ;

    // Apply camera yaw rotation (Y-axis)
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const x1 = dx * cosY - dz * sinY;
    const z1 = dx * sinY + dz * cosY;

    // Apply camera pitch rotation (X-axis)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const y2 = dy * cosP - z1 * sinP;
    const z2 = dy * sinP + z1 * cosP;

    if (z2 <= 20) return null; // Behind camera clipping

    const fov = 420;
    const scale = fov / z2;
    const screenX = this.width / 2 + x1 * scale;
    const screenY = this.height / 2 + y2 * scale;

    return { screenX, screenY, scale, zDepth: z2 };
  }

  startLoop() {
    const loop = (time) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      this.update(dt);
      this.render();

      if (typeof requestAnimationFrame === 'function') {
        this.animId = requestAnimationFrame(loop);
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      this.animId = requestAnimationFrame(loop);
    }
  }

  stopLoop() {
    if (this.animId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  update(dt) {
    const cruise = store.getExpeditionCruiseState();
    if (!cruise.isCruising) return;

    // Speed multiplier from throttle
    let speedMult = 1.0;
    if (cruise.speedMode === 'stroll') speedMult = 0.5;
    else if (cruise.speedMode === 'cruise') speedMult = 1.0;
    else if (cruise.speedMode === 'hyper') speedMult = 2.5;

    // Out of fuel penalty: slows down to 0.25x
    if (cruise.starlightFuel <= 0) {
      speedMult *= 0.25;
    }

    // Base circuit duration: 60 seconds for full loop at 1.0x
    const speed = (0.016 * speedMult) * dt;
    this.progress = (this.progress + speed) % 1.0;

    // Update current active biome waypoint
    const currentPoint = this.getSplinePoint(this.progress);
    if (currentPoint.biomeIdx !== this.currentWaypoint) {
      this.currentWaypoint = currentPoint.biomeIdx;
      store.setExpeditionWaypoint(this.currentWaypoint);
      if (this.onWaypointChanged) {
        this.onWaypointChanged(EXPEDITION_BIOMES[this.currentWaypoint]);
      }
    }

    // Consume fuel slowly while cruising
    if (cruise.speedMode === 'hyper') {
      store.consumeStarlightFuel(dt * 0.4);
    } else if (cruise.speedMode === 'cruise') {
      store.consumeStarlightFuel(dt * 0.15);
    }

    // Slowly damp look-around yaw/pitch back towards front when not actively dragging
    if (!this.isDragging) {
      this.yaw *= 0.985;
      this.pitch *= 0.985;
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.width;
    const h = this.height;
    const cruise = store.getExpeditionCruiseState();
    const hero = store.getState().selectedHero;
    const activePet = store.getActivePet();
    const isStreakHero = (hero?.streak || 1) >= 3;
    const isHyperMode = cruise.speedMode === 'hyper';

    // 1. SKY & ATMOSPHERE GRADIENT
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#050f18');
    skyGrad.addColorStop(0.4, '#091827');
    skyGrad.addColorStop(0.7, '#0d2235');
    skyGrad.addColorStop(1, '#06111a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. SUN / HORIZON CELESTIAL GLOW
    const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.35, w * 0.6);
    sunGrad.addColorStop(0, 'rgba(84, 233, 138, 0.25)');
    sunGrad.addColorStop(0.3, 'rgba(0, 210, 211, 0.15)');
    sunGrad.addColorStop(0.7, 'rgba(243, 156, 18, 0.08)');
    sunGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);

    // Compute Pet 3D Position on Rails
    const petPos = this.getSplinePoint(this.progress);

    // Look slightly ahead on rail for camera tangent
    const aheadPos = this.getSplinePoint(this.progress + 0.02);
    const tangentX = aheadPos.x - petPos.x;
    const tangentY = aheadPos.y - petPos.y;
    const tangentZ = aheadPos.z - petPos.z;
    const tangentLen = Math.hypot(tangentX, tangentZ) || 1;
    const dirX = tangentX / tangentLen;
    const dirZ = tangentZ / tangentLen;

    // Camera Chase Position: directly behind and slightly above the pet
    const camDist = 110;
    const camHeight = 35;
    const camX = petPos.x - dirX * camDist;
    const camY = petPos.y + camHeight;
    const camZ = petPos.z - dirZ * camDist;

    // Follow rotation angle + user swipe yaw
    const forwardAngle = Math.atan2(dirX, dirZ);
    const totalYaw = forwardAngle + this.yaw;
    const totalPitch = this.pitch;

    // 3. BACKGROUND STARS & FLOATING PARTICLES
    for (const p of this.particles) {
      const proj = this.project3D(p.x, p.y, p.z, camX, camY, camZ, totalYaw, totalPitch);
      if (proj) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(proj.screenX, proj.screenY, Math.max(1, p.size * proj.scale * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // 4. HYPER GLIDER SPEED LINES
    if (isHyperMode) {
      ctx.strokeStyle = 'rgba(84, 233, 138, 0.6)';
      ctx.lineWidth = 1.8;
      for (const sl of this.speedLines) {
        sl.z -= 18;
        if (sl.z < 20) sl.z += 500;
        const p1 = this.project3D(sl.x, sl.y, sl.z, camX, camY, camZ, totalYaw, totalPitch);
        const p2 = this.project3D(sl.x, sl.y, sl.z + sl.len, camX, camY, camZ, totalYaw, totalPitch);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.screenX, p1.screenY);
          ctx.lineTo(p2.screenX, p2.screenY);
          ctx.stroke();
        }
      }
    }

    // 5. RENDER FLOATING ISLAND BIOMES
    this.activeReticles = [];
    const discoveredList = cruise.discoveredSecrets || [];

    EXPEDITION_BIOMES.forEach((biome, bIdx) => {
      const biomePos = this.getSplinePoint(bIdx / EXPEDITION_BIOMES.length);
      const islandX = biomePos.x * 1.08;
      const islandY = biomePos.y + 45;
      const islandZ = biomePos.z * 1.08;

      const projIsland = this.project3D(islandX, islandY, islandZ, camX, camY, camZ, totalYaw, totalPitch);
      if (projIsland) {
        const islandRad = Math.max(18, 55 * projIsland.scale);

        // Floating Island Base Rock
        const rockGrad = ctx.createLinearGradient(
          projIsland.screenX,
          projIsland.screenY,
          projIsland.screenX,
          projIsland.screenY + islandRad * 1.2
        );
        rockGrad.addColorStop(0, biome.color);
        rockGrad.addColorStop(0.3, '#1a2733');
        rockGrad.addColorStop(1, '#0b131a');

        ctx.fillStyle = rockGrad;
        ctx.beginPath();
        ctx.ellipse(projIsland.screenX, projIsland.screenY, islandRad * 1.3, islandRad * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Under-island Stalactite Core
        ctx.beginPath();
        ctx.moveTo(projIsland.screenX - islandRad * 0.9, projIsland.screenY);
        ctx.lineTo(projIsland.screenX + islandRad * 0.9, projIsland.screenY);
        ctx.lineTo(projIsland.screenX, projIsland.screenY + islandRad * 1.4);
        ctx.closePath();
        ctx.fill();

        // Biome Landmark Structure (Castle tower / Word spire)
        ctx.fillStyle = biome.color;
        ctx.fillRect(projIsland.screenX - islandRad * 0.25, projIsland.screenY - islandRad * 0.9, islandRad * 0.5, islandRad * 0.85);

        // Biome Aura Ring
        ctx.strokeStyle = biome.color;
        ctx.lineWidth = 2 * projIsland.scale;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(projIsland.screenX, projIsland.screenY - islandRad * 0.4, islandRad * 1.6, islandRad * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Landmark Label in Sky
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10, Math.round(13 * projIsland.scale))}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(biome.title, projIsland.screenX, projIsland.screenY - islandRad * 1.15);

        // 6. INTERACTIVE 3D SECRET CHEST & RETICLE
        const isDiscovered = discoveredList.includes(biome.secretId);
        const chestX = islandX + Math.cos(bIdx) * 35;
        const chestY = islandY - 20;
        const chestZ = islandZ + Math.sin(bIdx) * 35;

        const projChest = this.project3D(chestX, chestY, chestZ, camX, camY, camZ, totalYaw, totalPitch);
        if (projChest && projChest.scale > 0.15) {
          const reticleRadius = Math.max(16, 26 * projChest.scale);

          // Pulsing Target Ring
          const pulse = Math.sin(performance.now() * 0.005 + bIdx) * 3;
          ctx.strokeStyle = isDiscovered ? '#54e98a' : '#f39c12';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(projChest.screenX, projChest.screenY, reticleRadius + pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Chest icon badge
          ctx.fillStyle = isDiscovered ? '#1b7a43' : '#b86a04';
          ctx.beginPath();
          ctx.arc(projChest.screenX, projChest.screenY, reticleRadius * 0.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px "Material Symbols Outlined"';
          ctx.fillText(isDiscovered ? 'check' : 'package_2', projChest.screenX, projChest.screenY + 4);

          // Tag label
          ctx.font = 'bold 9px "Quicksand", sans-serif';
          ctx.fillStyle = isDiscovered ? '#54e98a' : '#ffddb9';
          ctx.fillText(isDiscovered ? 'CLAIMED' : 'TAP TO SCAN', projChest.screenX, projChest.screenY + reticleRadius + 14);

          // Save reticle for click handling
          this.activeReticles.push({
            screenX: projChest.screenX,
            screenY: projChest.screenY,
            radius: reticleRadius,
            biome: biome
          });
        }
      }
    });

    // 7. RENDER 3D RAIL TRACK (Curved glowing crystal rails)
    const trackSamples = 45;
    let prevLeftProj = null;
    let prevRightProj = null;

    ctx.lineWidth = isHyperMode ? 3.5 : 2.5;
    for (let i = 0; i <= trackSamples; i++) {
      const sampleT = (this.progress - 0.05 + (i / trackSamples) * 0.35 + 1.0) % 1.0;
      const pt = this.getSplinePoint(sampleT);

      // Width of track
      const railWidth = 9;
      const leftX = pt.x - railWidth;
      const rightX = pt.x + railWidth;

      const pL = this.project3D(leftX, pt.y, pt.z, camX, camY, camZ, totalYaw, totalPitch);
      const pR = this.project3D(rightX, pt.y, pt.z, camX, camY, camZ, totalYaw, totalPitch);

      if (pL && pR && prevLeftProj && prevRightProj) {
        // Rail Beams (Cyan/Emerald crystal glow)
        ctx.strokeStyle = isHyperMode ? '#ffb961' : '#00d2d3';
        ctx.globalAlpha = Math.min(1.0, Math.max(0.2, (trackSamples - i) / 20));

        ctx.beginPath();
        ctx.moveTo(prevLeftProj.screenX, prevLeftProj.screenY);
        ctx.lineTo(pL.screenX, pL.screenY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(prevRightProj.screenX, prevRightProj.screenY);
        ctx.lineTo(pR.screenX, pR.screenY);
        ctx.stroke();

        // Rail Sleepers / Ties every 3rd sample
        if (i % 3 === 0) {
          ctx.strokeStyle = '#54e98a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pL.screenX, pL.screenY);
          ctx.lineTo(pR.screenX, pR.screenY);
          ctx.stroke();
        }
      }
      prevLeftProj = pL;
      prevRightProj = pR;
    }
    ctx.globalAlpha = 1.0;

    // 8. RENDER 3D PET & HOVERBOARD (Mounted at petPos on rails)
    const petProj = this.project3D(petPos.x, petPos.y - 12, petPos.z, camX, camY, camZ, totalYaw, totalPitch);
    if (petProj) {
      const scale = petProj.scale;
      const pX = petProj.screenX;
      const pY = petProj.screenY;

      // Hoverboard bounce wave
      const hoverWave = Math.sin(performance.now() * 0.008) * 4;

      // Streak Aura / Golden Flame Trail behind pet
      if (isStreakHero || isHyperMode) {
        const auraGrad = ctx.createRadialGradient(pX, pY + 20, 5, pX, pY + 20, 65 * scale);
        auraGrad.addColorStop(0, 'rgba(255, 185, 97, 0.85)');
        auraGrad.addColorStop(0.5, 'rgba(243, 156, 18, 0.45)');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(pX, pY + 20, 65 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3D Hoverboard Deck
      const boardWidth = 48 * scale;
      const boardHeight = 12 * scale;
      ctx.fillStyle = '#16212b';
      ctx.strokeStyle = '#54e98a';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.ellipse(pX, pY + 26 + hoverWave, boardWidth, boardHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hover Thruster Plumes
      const plumeGrad = ctx.createLinearGradient(pX, pY + 26, pX, pY + 50 + hoverWave);
      plumeGrad.addColorStop(0, isHyperMode ? '#f39c12' : '#00d2d3');
      plumeGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(pX - 20 * scale, pY + 26 + hoverWave);
      ctx.lineTo(pX + 20 * scale, pY + 26 + hoverWave);
      ctx.lineTo(pX, pY + 48 * scale + hoverWave);
      ctx.closePath();
      ctx.fill();

      // 3D Companion Pet Silhouette / Avatar
      const petRadius = 24 * scale;
      const petColor = activePet?.color || '#2ecc71';

      // Pet Body
      ctx.fillStyle = petColor;
      ctx.beginPath();
      ctx.arc(pX, pY + hoverWave, petRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5 * scale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Pet Aviator Cap / Goggles
      ctx.fillStyle = '#b86a04';
      ctx.beginPath();
      ctx.arc(pX, pY - 10 * scale + hoverWave, petRadius * 0.9, Math.PI, Math.PI * 2);
      ctx.fill();

      // Golden Goggles
      ctx.fillStyle = '#f1c40f';
      ctx.strokeStyle = '#2b3640';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pX - 7 * scale, pY - 6 * scale + hoverWave, 6 * scale, 0, Math.PI * 2);
      ctx.arc(pX + 7 * scale, pY - 6 * scale + hoverWave, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pet Name Tag Banner
      ctx.fillStyle = 'rgba(9, 20, 30, 0.85)';
      ctx.strokeStyle = '#54e98a';
      ctx.lineWidth = 1.5;
      const tagW = 70 * scale;
      const tagH = 18 * scale;
      ctx.roundRect(pX - tagW / 2, pY - 34 * scale + hoverWave, tagW, tagH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#54e98a';
      ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(activePet?.name || 'Pet Companion', pX, pY - 21 * scale + hoverWave);
    }
  }

  destroy() {
    this.stopLoop();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._mouseMoveHandler) window.removeEventListener('mousemove', this._mouseMoveHandler);
    if (this._mouseUpHandler) window.removeEventListener('mouseup', this._mouseUpHandler);
    if (this._touchMoveHandler) window.removeEventListener('touchmove', this._touchMoveHandler);
  }
}
