/**
 * hanaBattle3DService.js
 * 
 * Unified Pure 3D WebGL & Spline Runtime Arena Service for Interactive AR Toothbrush Battle
 * 
 * Features:
 * 1. Spline 3D Runtime Application integration (@splinetool/runtime) with variable bindings:
 *    - BossHP (0-100), ShieldActive (bool), ActiveQuadrant (1-5), LaserEquipped (bool).
 * 2. High-performance procedural 3D WebGL / Canvas Fallback:
 *    - 3D Sugar Boss with breathing, wobbles, and visual reactivity.
 *    - Breakable 3D Candy Armor Deconstruction: 4 quadrant candy plates that fracture and fly off.
 *    - Floating 3D Hero Mirror: Live video texture rendered in 3D perspective with neon holographic chassis.
 *    - Interactive 3D Mouth Hologram HUD: Dental arch transforming plaque from amber to gleaming diamond white.
 *    - Dynamic 3D Foam & Laser Particle Streams: Physics-driven particle arcs from nozzle to boss.
 *    - 3D Enamel Shield Dome & Caramel Bomb Deflection: Deflect flurry ricochets attacks back at boss.
 *    - 3D Cleanse Victory Sequence: Boss purifies into friendly companion with starburst particles.
 */

import { Application } from '@splinetool/runtime';
import { Sound } from '../audio/sfx.js';

class HanaBattle3DService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.splineApp = null;
    this.isSplineActive = false;
    this.isDestroyed = false;
    this.animId = null;

    // Viewport dimensions
    this.width = 600;
    this.height = 420;
    this.dpr = 1;

    // Connected media
    this.videoElement = null;

    // Boss Data & State
    this.bossData = {
      id: 'sugar_bandit',
      name: 'The Sugar Bandit King',
      color: '#f39c12',
      bodyColor: '#d97706',
      armorColor: '#f59e0b',
      bombColor: '#f39c12'
    };

    this.bossHp = 100;
    this.maxHp = 100;
    this.isShieldActive = false;
    this.activeQuadrant = 'q1';
    this.hasLaserEquipped = false;
    this.cadenceScore = 0;
    this.isScrubbing = false;
    this.isDeflectActive = false;
    this.deflectTimer = 0;
    this.isVictory = false;

    // 3D Simulation Clock & Math
    this.clock = 0;
    this.lastTime = 0;

    // 3D Particles & Geometry Entities
    this.foamParticles = [];
    this.candyShards = [];
    this.caramelBombs = [];
    this.sparkles = [];
    this.shockwaves = [];

    // Breakable Armor State (quadrants q1, q2, q3, q4)
    this.armorPlates = {
      q1: { id: 'q1', name: 'Upper Right', intact: true, cracks: 0, color: '#f59e0b', offset: { x: 35, y: -25, z: 20 } },
      q2: { id: 'q2', name: 'Upper Left', intact: true, cracks: 0, color: '#f59e0b', offset: { x: -35, y: -25, z: 20 } },
      q3: { id: 'q3', name: 'Lower Right', intact: true, cracks: 0, color: '#e89300', offset: { x: 32, y: 22, z: 20 } },
      q4: { id: 'q4', name: 'Lower Left', intact: true, cracks: 0, color: '#e89300', offset: { x: -32, y: 22, z: 20 } }
    };

    // Dental Hologram Teeth Nodes (q1..q5)
    this.dentalTeeth = [
      { id: 'q1', x: 26, y: -16, z: 10, cleanPct: 0, label: 'UR' },
      { id: 'q1', x: 40, y: -8, z: 5, cleanPct: 0, label: 'UR-M' },
      { id: 'q2', x: -26, y: -16, z: 10, cleanPct: 0, label: 'UL' },
      { id: 'q2', x: -40, y: -8, z: 5, cleanPct: 0, label: 'UL-M' },
      { id: 'q3', x: 26, y: 16, z: 10, cleanPct: 0, label: 'LR' },
      { id: 'q3', x: 40, y: 8, z: 5, cleanPct: 0, label: 'LR-M' },
      { id: 'q4', x: -26, y: 16, z: 10, cleanPct: 0, label: 'LL' },
      { id: 'q4', x: -40, y: 8, z: 5, cleanPct: 0, label: 'LL-M' },
      { id: 'q5', x: 0, y: 2, z: 8, cleanPct: 0, label: 'Tongue' }
    ];

    // Bomb timer
    this.nextBombTimer = 5.0;

    // Initialization guard
    this.isInitialized = false;

    // Bind loop
    this.renderLoop = this.renderLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Initialize on canvas element
   */
  async init(canvasElement, options = {}) {
    if (!canvasElement) return false;

    // If already initialized on this exact canvas, update dynamic references without wiping battle progress
    if (this.canvas === canvasElement && !this.isDestroyed && this.isInitialized) {
      if (options.videoElement) this.setVideoElement(options.videoElement);
      if (options.hasLaserEquipped !== undefined) this.hasLaserEquipped = Boolean(options.hasLaserEquipped);
      return true;
    }

    this.canvas = canvasElement;
    this.isDestroyed = false;
    this.isInitialized = true;

    if (options.bossData) {
      this.setBoss(options.bossData);
    }
    if (options.videoElement) {
      this.setVideoElement(options.videoElement);
    }

    this.hasLaserEquipped = Boolean(options.hasLaserEquipped);
    this.dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);

    this.handleResize();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
      window.addEventListener('resize', this.handleResize);
    }

    // Attempt Spline 3D Scene load if URL provided
    if (options.splineUrl) {
      try {
        await this.loadSplineScene(options.splineUrl);
      } catch (err) {
        console.warn('[HanaBattle3D] Spline runtime scene failed to load, using procedural 3D WebGL fallback:', err);
        this.initProceduralFallback();
      }
    } else {
      this.initProceduralFallback();
    }

    return true;
  }

  handleResize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: 600, height: 420 };
    this.width = Math.max(320, rect.width || 600);
    this.height = Math.max(260, rect.height || 420);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    if (this.ctx) {
      if (typeof this.ctx.setTransform === 'function') {
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      } else if (typeof this.ctx.resetTransform === 'function') {
        this.ctx.resetTransform();
        this.ctx.scale(this.dpr, this.dpr);
      }
    }
  }

  /**
   * Spline Runtime Scene Loader
   */
  async loadSplineScene(url) {
    if (!this.canvas) return;
    try {
      this.splineApp = new Application(this.canvas, { renderer: 'webgl' });
      await this.splineApp.load(url, {
        BossHP: this.bossHp,
        ShieldActive: this.isShieldActive,
        ActiveQuadrant: 1,
        LaserEquipped: this.hasLaserEquipped
      });
      this.isSplineActive = true;
    } catch (e) {
      this.isSplineActive = false;
      throw e;
    }
  }

  /**
   * Procedural 3D Engine Fallback Initialization
   */
  initProceduralFallback() {
    this.isSplineActive = false;
    this.ctx = typeof this.canvas.getContext === 'function'
      ? (this.canvas.getContext('2d') || null)
      : null;

    // If canvas already had WebGL context acquired by Spline load attempt,
    // getContext('2d') returns null per HTML5 Canvas spec.
    // Replace with a fresh canvas element to cleanly obtain a 2D rendering context.
    if (!this.ctx && this.canvas && this.canvas.parentElement) {
      try {
        const newCanvas = document.createElement('canvas');
        newCanvas.id = this.canvas.id;
        newCanvas.className = this.canvas.className;
        newCanvas.width = this.canvas.width;
        newCanvas.height = this.canvas.height;
        this.canvas.parentElement.replaceChild(newCanvas, this.canvas);
        this.canvas = newCanvas;
        this.ctx = typeof this.canvas.getContext === 'function' ? this.canvas.getContext('2d') : null;
      } catch (e) {}
    }

    if (this.ctx) {
      if (typeof this.ctx.setTransform === 'function') {
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      } else if (typeof this.ctx.resetTransform === 'function') {
        this.ctx.resetTransform();
        this.ctx.scale(this.dpr, this.dpr);
      }
    }

    this.lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this.renderLoop);
  }

  setVideoElement(videoEl) {
    this.videoElement = videoEl;
  }

  setBoss(bossData) {
    if (!bossData) return;
    this.bossData = {
      ...this.bossData,
      ...bossData,
      color: bossData.color || '#f39c12',
      bodyColor: bossData.color || '#d97706',
      armorColor: bossData.accentBorder ? '#f59e0b' : '#f39c12'
    };

    // Set colors for armor plates based on boss
    Object.values(this.armorPlates).forEach(p => {
      p.color = this.bossData.armorColor;
      p.intact = true;
      p.cracks = 0;
    });
  }

  updateState({
    bossHp = 100,
    maxHp = 100,
    shieldActive = false,
    activeQuadrant = 'q1',
    hasLaser = false,
    cadenceScore = 0,
    isScrubbing = false,
    quadrantCleanliness = null
  } = {}) {
    this.bossHp = bossHp;
    this.maxHp = maxHp;
    this.isShieldActive = shieldActive;
    this.activeQuadrant = activeQuadrant;
    this.hasLaserEquipped = hasLaser;
    this.cadenceScore = cadenceScore;
    this.isScrubbing = isScrubbing;

    // Sync dental teeth hologram progress
    if (quadrantCleanliness) {
      this.dentalTeeth.forEach(t => {
        if (quadrantCleanliness[t.id] !== undefined) {
          t.cleanPct = quadrantCleanliness[t.id];
        }
      });
    }

    // Sync Spline Runtime variables if active
    if (this.isSplineActive && this.splineApp) {
      try {
        if (typeof this.splineApp.setVariable === 'function') {
          this.splineApp.setVariable('BossHP', Math.max(0, Math.min(100, (bossHp / maxHp) * 100)));
          this.splineApp.setVariable('ShieldActive', shieldActive);
          const qNum = parseInt(activeQuadrant.replace('q', ''), 10) || 1;
          this.splineApp.setVariable('ActiveQuadrant', qNum);
          this.splineApp.setVariable('LaserEquipped', hasLaser);
        }
      } catch (e) {}
    }
  }

  /**
   * Breakable 3D Candy Armor Deconstruction
   * When a quadrant reaches 100% or is cleansed, candy plates fracture into 3D shards
   */
  onArmorFracture(quadrantId = 'q1') {
    // 1. Boss Shield Barrier Shatter
    if (quadrantId === 'shield') {
      const bx = this.width * 0.5;
      const by = this.height * 0.35;
      for (let i = 0; i < 22; i++) {
        const angle = (i / 22) * Math.PI * 2;
        const speed = 3.5 + Math.random() * 4.0;
        this.candyShards.push({
          x: bx + Math.cos(angle) * 45,
          y: by + Math.sin(angle) * 45,
          z: 20 + Math.random() * 30,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: Math.random() * 4 - 2,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
          rotZ: Math.random() * Math.PI,
          vRotX: (Math.random() - 0.5) * 0.3,
          vRotY: (Math.random() - 0.5) * 0.3,
          vRotZ: (Math.random() - 0.5) * 0.3,
          size: 7 + Math.random() * 7,
          color: '#fbbf24',
          alpha: 1.0,
          gravity: 0.12
        });
      }
      this.shockwaves.push({
        x: bx,
        y: by,
        radius: 30,
        maxRadius: 200,
        color: '#fbbf24',
        alpha: 1.0
      });
      if (typeof Sound?.fanfare === 'function') Sound.fanfare();
      return;
    }

    // 2. Tongue Polish Sparkle
    if (quadrantId === 'q5') {
      const bx = this.width * 0.5;
      const by = this.height * 0.35;
      for (let j = 0; j < 16; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.0 + Math.random() * 4.0;
        this.sparkles.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ec4899',
          size: 4 + Math.random() * 4,
          alpha: 1.0,
          life: 1.2
        });
      }
      if (typeof Sound?.sparkle === 'function') Sound.sparkle();
      return;
    }

    const plate = this.armorPlates[quadrantId];
    if (plate && plate.intact) {
      plate.intact = false;
      plate.cracks = 3;

      // Spawn 14 3D candy shards bursting outward
      const bx = this.width * 0.5 + (plate.offset.x * (this.width / 400));
      const by = this.height * 0.35 + (plate.offset.y * (this.height / 300));

      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 5.0;
        this.candyShards.push({
          x: bx,
          y: by,
          z: 20 + Math.random() * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.5,
          vz: Math.random() * 4 - 2,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
          rotZ: Math.random() * Math.PI,
          vRotX: (Math.random() - 0.5) * 0.25,
          vRotY: (Math.random() - 0.5) * 0.25,
          vRotZ: (Math.random() - 0.5) * 0.25,
          size: 6 + Math.random() * 10,
          color: plate.color,
          alpha: 1.0,
          gravity: 0.18
        });
      }

      // Sparkle burst
      for (let j = 0; j < 12; j++) {
        this.sparkles.push({
          x: bx + (Math.random() - 0.5) * 30,
          y: by + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          color: '#ffffff',
          size: 3 + Math.random() * 3,
          alpha: 1.0,
          life: 0.8
        });
      }

      if (typeof Sound?.fanfare === 'function') Sound.fanfare();
    }
  }

  /**
   * Dynamic 3D Foam / Laser Particle Streams
   */
  onFoamStream(intensity = 1.0, hasLaser = false, damageBoost = 0) {
    const streamCount = Math.round((3 + Math.round(intensity * 4)) * (1 + (damageBoost / 100)));
    const originX = this.width * 0.5;
    const originY = this.height * 0.95;
    const targetX = this.width * 0.5 + (Math.sin(this.clock * 4) * 30);
    const targetY = this.height * 0.35;

    for (let i = 0; i < streamCount; i++) {
      const spreadX = (Math.random() - 0.5) * 16;
      const vx = (targetX - originX) * 0.05 + spreadX;
      const vy = (targetY - originY) * 0.05 - 1.5;

      this.foamParticles.push({
        x: originX + spreadX,
        y: originY,
        z: -20,
        vx: vx + (Math.random() - 0.5) * 1.5,
        vy: vy + (Math.random() - 0.5) * 1.5,
        vz: 1.5 + Math.random() * 2,
        radius: (hasLaser ? 7 : 6) + Math.random() * 6,
        alpha: 0.95,
        isLaser: hasLaser,
        color: hasLaser ? '#22d3ee' : '#ffffff',
        glowColor: hasLaser ? '#06b6d4' : '#bae6fd',
        life: 1.0
      });
    }

    if (this.foamParticles.length > 90) {
      this.foamParticles.splice(0, this.foamParticles.length - 90);
    }
  }

  /**
   * Deploy 3D Enamel Shield Dome
   */
  setDeflectActive(active = true) {
    this.isDeflectActive = active;
    this.deflectTimer = active ? 1.4 : 0;
    if (active) {
      this.shockwaves.push({
        x: this.width * 0.5,
        y: this.height * 0.7,
        radius: 20,
        maxRadius: 180,
        color: '#10b981',
        alpha: 0.8
      });
    }
  }

  /**
   * Deflect Flurry: Ricochets caramel sugar bomb back at the boss
   */
  onDeflectRicochet() {
    this.setDeflectActive(true);
    this.deflectTimer = 1.4;
    // Find active bomb heading toward player and reverse its direction
    this.caramelBombs.forEach(bomb => {
      if (bomb.vz < 0) { // moving toward player
        bomb.vz = Math.abs(bomb.vz) * 1.6;
        bomb.vy = -Math.abs(bomb.vy) * 1.2;
        bomb.deflected = true;
      }
    });

    // Spawn massive reflective shockwave
    this.shockwaves.push({
      x: this.width * 0.5,
      y: this.height * 0.65,
      radius: 30,
      maxRadius: 220,
      color: '#34d399',
      alpha: 1.0
    });

    if (typeof Sound?.sparkle === 'function') Sound.sparkle();
  }

  /**
   * Chore Supernova Screen-Clearing Mega Bubble
   */
  triggerSupernova() {
    this.shockwaves.push({
      x: this.width * 0.5,
      y: this.height * 0.4,
      radius: 10,
      maxRadius: 360,
      color: '#fbbf24',
      alpha: 1.0
    });

    // Clear all incoming bombs
    this.caramelBombs.forEach(b => {
      b.vz = 8;
      b.deflected = true;
    });

    // Fracture all remaining armor
    Object.keys(this.armorPlates).forEach(k => this.onArmorFracture(k));
  }

  /**
   * 3D Cleanse Victory Sequence
   */
  onCleanseVictory() {
    this.isVictory = true;
    this.bossHp = 0;
    // Shatter any remaining armor
    Object.keys(this.armorPlates).forEach(k => this.onArmorFracture(k));

    // Starburst victory particles
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 6.0;
      this.sparkles.push({
        x: this.width * 0.5,
        y: this.height * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#54e98a', '#ffb961', '#38bdf8', '#f1c40f', '#ec4899'][i % 5],
        size: 5 + Math.random() * 5,
        alpha: 1.0,
        life: 2.0
      });
    }
  }

  /**
   * Main 3D Render Loop (RAF at 60 FPS)
   */
  renderLoop(timestamp) {
    if (this.isDestroyed) return;

    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000 || 0.016);
    this.lastTime = timestamp;
    this.clock += dt;

    if (!this.isSplineActive && this.ctx) {
      this.renderProceduralScene(dt);
    }

    this.animId = requestAnimationFrame(this.renderLoop);
  }

  renderProceduralScene(dt) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Clear Arena Viewport with high-contrast gradient
    ctx.clearRect(0, 0, w, h);

    // Deep space/bathroom arena background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#040911');
    bgGrad.addColorStop(0.5, '#071322');
    bgGrad.addColorStop(1, '#050b14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. 3D Perspective Grid Floor (Sugar Kingdom Ruins)
    this.render3DGridFloor(ctx, w, h);

    // 3. Shockwave Rings
    this.renderShockwaves(ctx, dt);

    // 4. Floating 3D Hero Mirror (Live Webcam Feed Video Texture)
    this.renderFloatingHeroMirror(ctx, w, h);

    // 5. Interactive 3D Mouth Hologram HUD (Dental Arch transforming plaque)
    this.render3DMouthHologram(ctx, w, h);

    // 6. 3D Boss & Breakable Candy Armor Deconstruction
    this.render3DBossAndArmor(ctx, w, h, dt);

    // 7. 3D Caramel Bomb Projectiles
    this.renderCaramelBombs(ctx, w, h, dt);

    // 8. 3D Foam / Laser Particle Streams
    this.renderFoamParticles(ctx, dt);

    // 9. Fractured Candy Shards Physics
    this.renderCandyShards(ctx, dt);

    // 10. Sparkles & Stars
    this.renderSparkles(ctx, dt);

    // 11. 3D Enamel Shield Dome
    if (this.deflectTimer > 0) {
      this.deflectTimer -= dt;
      if (this.deflectTimer <= 0) {
        this.isDeflectActive = false;
      }
    }

    if (this.isDeflectActive) {
      this.renderEnamelShieldDome(ctx, w, h);
    }
  }

  /**
   * 3D Perspective Grid Floor
   */
  render3DGridFloor(ctx, w, h) {
    const horizonY = h * 0.45;
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.lineWidth = 1;

    // Perspective lines
    const fovX = w * 0.5;
    for (let x = -w * 0.8; x <= w * 1.8; x += 40) {
      ctx.beginPath();
      ctx.moveTo(fovX + (x - fovX) * 0.05, horizonY);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Horizontal depth rungs
    for (let d = 0; d < 8; d++) {
      const ratio = Math.pow(d / 8, 2.2);
      const y = horizonY + (h - horizonY) * ratio;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Floating 3D Hero Mirror (Live Video Texture)
   * Top-Left floating portal rendered in 3D perspective
   */
  renderFloatingHeroMirror(ctx, w, h) {
    const mirrorW = Math.min(130, w * 0.28);
    const mirrorH = mirrorW * 1.25;
    const mx = w * 0.18;
    const my = h * 0.22 + Math.sin(this.clock * 2) * 5; // gentle 3D bobbing

    ctx.save();
    ctx.translate(mx, my);

    // Holographic shadow & glow
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 16;

    // Frame chassis
    ctx.fillStyle = 'rgba(5, 14, 26, 0.9)';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-mirrorW * 0.5, -mirrorH * 0.5, mirrorW, mirrorH, 16);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner Clip for video texture
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-mirrorW * 0.5 + 4, -mirrorH * 0.5 + 4, mirrorW - 8, mirrorH - 8, 12);
    ctx.clip();

    if (this.videoElement && this.videoElement.readyState >= 2 && !this.videoElement.paused) {
      // Mirrored video texture (selfie perspective)
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoElement, -mirrorW * 0.5 + 4, -mirrorH * 0.5 + 4, mirrorW - 8, mirrorH - 8);
    } else {
      // Animated Hero hologram avatar fallback
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-mirrorW * 0.5, -mirrorH * 0.5, mirrorW, mirrorH);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧑‍🚀', 0, -6);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('HERO CAM', 0, 22);
    }
    ctx.restore();

    // Futuristic corner brackets
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    const cSize = 10;
    const hw = mirrorW * 0.5;
    const hh = mirrorH * 0.5;

    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(-hw, -hh + cSize);
    ctx.lineTo(-hw, -hh);
    ctx.lineTo(-hw + cSize, -hh);
    ctx.stroke();

    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(hw - cSize, -hh);
    ctx.lineTo(hw, -hh);
    ctx.lineTo(hw, -hh + cSize);
    ctx.stroke();

    // Hologram scanner line
    const scanY = (-hh + 6) + (((this.clock * 60) % (mirrorH - 12)));
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-hw + 6, scanY);
    ctx.lineTo(hw - 6, scanY);
    ctx.stroke();

    // Badge Title
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3D HERO MIRROR', 0, hh + 12);

    ctx.restore();
  }

  /**
   * Interactive 3D Mouth Hologram HUD
   * Displays teeth arc; plaque turns from amber to gleaming diamond white as brushed!
   */
  render3DMouthHologram(ctx, w, h) {
    const hudW = Math.min(110, w * 0.24);
    const hudH = hudW * 0.95;
    const hx = w * 0.82;
    const hy = h * 0.22 + Math.cos(this.clock * 1.8) * 4;

    ctx.save();
    ctx.translate(hx, hy);

    // HUD frame
    ctx.fillStyle = 'rgba(5, 14, 26, 0.88)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-hudW * 0.5, -hudH * 0.5, hudW, hudH, 14);
    ctx.fill();
    ctx.stroke();

    // Arch Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3D DENTAL ARCH', 0, -hudH * 0.5 + 12);

    // Render teeth nodes
    const scale = hudW * 0.01;
    this.dentalTeeth.forEach(tooth => {
      const tx = tooth.x * scale;
      const ty = tooth.y * scale + 2;
      const isDone = tooth.cleanPct >= 100;
      const isActive = this.activeQuadrant === tooth.id;

      // Outer active ring
      if (isActive) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 6.5 + Math.sin(this.clock * 8) * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tooth Base Enamel (Diamond white when clean, amber when plaque)
      ctx.beginPath();
      ctx.arc(tx, ty, 4.5, 0, Math.PI * 2);

      if (isDone) {
        // Gleaming diamond white
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
      } else {
        // Plaque amber gradient depending on cleanPct
        const dirtyRatio = 1 - (tooth.cleanPct / 100);
        ctx.fillStyle = dirtyRatio > 0.5 ? '#d97706' : '#fef08a';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Active Quadrant Text
    const qUpper = this.activeQuadrant.toUpperCase();
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(`ZONE: ${qUpper}`, 0, hudH * 0.5 - 6);

    ctx.restore();
  }

  /**
   * 3D Boss Entity & Breakable Candy Armor Deconstruction
   */
  render3DBossAndArmor(ctx, w, h, dt) {
    const bx = w * 0.5;
    const by = h * 0.35 + Math.sin(this.clock * 2.5) * 8;
    const wobble = Math.sin(this.clock * 4) * 0.06;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(wobble);

    // Boss Core Body (Candy Monster)
    const baseRadius = Math.min(54, w * 0.12);

    // Boss Aura Glow
    const auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, baseRadius * 1.6);
    auraGrad.addColorStop(0, this.isVictory ? 'rgba(74, 222, 128, 0.6)' : 'rgba(245, 158, 11, 0.4)');
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Body Mesh
    ctx.fillStyle = this.isVictory ? '#4ade80' : this.bossData.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, baseRadius, baseRadius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.isVictory ? '#22c55e' : '#b45309';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Monster Eyes
    const eyeOffsetX = baseRadius * 0.35;
    const eyeOffsetY = -baseRadius * 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-eyeOffsetX, eyeOffsetY, 9, 12, -0.1, 0, Math.PI * 2);
    ctx.ellipse(eyeOffsetX, eyeOffsetY, 9, 12, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (Focus on player)
    ctx.fillStyle = this.isVictory ? '#166534' : '#1c1917';
    ctx.beginPath();
    ctx.arc(-eyeOffsetX + 1, eyeOffsetY + 1, 4.5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX - 1, eyeOffsetY + 1, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Crown / Monster Antenna
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-baseRadius * 0.4, -baseRadius * 0.85);
    ctx.lineTo(0, -baseRadius * 1.35);
    ctx.lineTo(baseRadius * 0.4, -baseRadius * 0.85);
    ctx.fill();

    // 4 Breakable 3D Candy Armor Plates (q1, q2, q3, q4)
    Object.values(this.armorPlates).forEach(plate => {
      if (!plate.intact) return;

      const px = plate.offset.x * (baseRadius / 45);
      const py = plate.offset.y * (baseRadius / 45);
      const pw = baseRadius * 0.55;
      const ph = baseRadius * 0.45;

      ctx.save();
      ctx.translate(px, py);

      // Plate 3D Candy Armor
      ctx.fillStyle = plate.color;
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.roundRect(-pw * 0.5, -ph * 0.5, pw, ph, 8);
      ctx.fill();
      ctx.stroke();

      // Candy gloss highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(-pw * 0.5 + 2, -ph * 0.5 + 2, pw - 4, ph * 0.3, 4);
      ctx.fill();

      // Plate Zone Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plate.id.toUpperCase(), 0, 0);

      ctx.restore();
    });

    // Boss Shield Barrier Sphere (if shieldActive)
    if (this.isShieldActive) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.35 + Math.sin(this.clock * 6) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Spawn a 3D Caramel Bomb targeted at the player
   */
  spawnCaramelBomb() {
    if (this.isVictory) return;
    this.caramelBombs.push({
      x: this.width * 0.5 + (Math.random() - 0.5) * 40,
      y: this.height * 0.35,
      z: 80, // far away
      vz: -32, // traveling toward player
      vx: (Math.random() - 0.5) * 8,
      vy: 6,
      radius: 16,
      color: this.bossData.bombColor || '#f39c12',
      deflected: false
    });
  }

  /**
   * 3D Caramel Bomb Projectiles
   */
  renderCaramelBombs(ctx, w, h, dt) {
    for (let i = this.caramelBombs.length - 1; i >= 0; i--) {
      const b = this.caramelBombs[i];
      b.z += b.vz * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 3D scale based on depth
      const depthScale = Math.max(0.4, (120 - b.z) / 70);
      const drawRadius = b.radius * depthScale;

      ctx.save();
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(b.x, b.y, drawRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Deflected bomb impacts the boss!
      if (b.deflected && b.z >= 75) {
        for (let s = 0; s < 14; s++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2.5 + Math.random() * 4.5;
          this.candyShards.push({
            x: b.x,
            y: b.y,
            z: 75,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: -2,
            rotX: 0, rotY: 0, rotZ: Math.random() * Math.PI,
            vRotX: 0, vRotY: 0, vRotZ: 0.2,
            size: 6 + Math.random() * 6,
            color: b.color,
            alpha: 1.0,
            gravity: 0.15
          });
        }
        this.shockwaves.push({
          x: b.x,
          y: b.y,
          radius: 20,
          maxRadius: 160,
          color: '#34d399',
          alpha: 1.0
        });
        if (typeof Sound?.hit === 'function') Sound.hit();
        this.caramelBombs.splice(i, 1);
        continue;
      }

      // Near player collision (splash at camera if not deflected)
      if (b.z <= 0) {
        if (!b.deflected) {
          // Splashes harmlessly into bubbles
          for (let s = 0; s < 8; s++) {
            this.foamParticles.push({
              x: b.x,
              y: b.y,
              z: 5,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              vz: 1,
              radius: 5 + Math.random() * 4,
              alpha: 0.8,
              isLaser: false,
              color: '#fed7aa',
              glowColor: '#f97316',
              life: 0.6
            });
          }
        }
        this.caramelBombs.splice(i, 1);
      }
    }
  }

  /**
   * 3D Foam & Neon Laser Particles
   */
  renderFoamParticles(ctx, dt) {
    for (let i = this.foamParticles.length - 1; i >= 0; i--) {
      const p = this.foamParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.life -= dt * 1.4;
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0) {
        this.foamParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.isLaser) {
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Laser core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Minty foam bubble with specular highlight
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Fractured Candy Shards
   */
  renderCandyShards(ctx, dt) {
    for (let i = this.candyShards.length - 1; i >= 0; i--) {
      const s = this.candyShards[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += s.gravity;
      s.rotZ += s.vRotZ;
      s.alpha -= dt * 0.8;

      if (s.alpha <= 0 || s.y > this.height + 40) {
        this.candyShards.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotZ);

      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(-s.size, -s.size);
      ctx.lineTo(s.size * 0.8, -s.size * 0.5);
      ctx.lineTo(s.size * 0.5, s.size);
      ctx.lineTo(-s.size * 0.5, s.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Sparkles & Stars
   */
  renderSparkles(ctx, dt) {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life -= dt * 1.2;
      sp.alpha = Math.max(0, sp.life);

      if (sp.life <= 0) {
        this.sparkles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = sp.alpha;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Shockwave Rings
   */
  renderShockwaves(ctx, dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += dt * 320;
      sw.alpha -= dt * 1.5;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Shimmering Geodesic 3D Enamel Shield Dome
   */
  renderEnamelShieldDome(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.85;
    const r = Math.min(180, w * 0.38);

    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 18;

    // Arc dome
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Shimmering geodesic lines
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.6)';
    for (let a = Math.PI * 1.15; a <= Math.PI * 1.85; a += 0.15) {
      const x1 = cx + Math.cos(a) * r;
      const y1 = cy + Math.sin(a) * r;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy + 20);
      ctx.stroke();
    }

    ctx.restore();
  }

  destroy() {
    this.isDestroyed = true;
    this.isInitialized = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (this.splineApp && typeof this.splineApp.dispose === 'function') {
      try { this.splineApp.dispose(); } catch (e) {}
      this.splineApp = null;
    }
    this.foamParticles = [];
    this.candyShards = [];
    this.caramelBombs = [];
    this.sparkles = [];
    this.shockwaves = [];
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
  }
}

export const hanaBattle3DService = new HanaBattle3DService();
export { HanaBattle3DService };
