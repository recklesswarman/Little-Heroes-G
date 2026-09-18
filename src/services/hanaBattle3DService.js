/**
 * hanaBattle3DService.js
 * 
 * Unified Pure 3D WebGL & Spline Runtime Arena Service for Interactive AR Toothbrush Battle
 * 
 * Features:
 * 1. Spline 3D Runtime Application integration (@splinetool/runtime) with variable bindings:
 *    - BossHP (0-100), ShieldActive (bool), ActiveQuadrant (1-5), LaserEquipped (bool).
 * 2. Vibrant Cartoon 3D WebGL / Canvas Engine:
 *    - Whimsical pastel bubble sky with floating candy clouds and twinkling stars.
 *    - Pearly floating tooth platform with golden rim, enamel sheen, and ambient lighting.
 *    - Animated 3D Cartoon Boss (Sugar Bandit, Plaque Kraken, Tartar Titan):
 *      * Bouncy breathing animations, expressive cartoon eyes that blink and track brushing.
 *      * 4 Breakable 3D Candy Armor Plates (Q1-Q4) fracturing into 3D physics shards when quadrants hit 100%.
 *    - Real-time fizzy rainbow soap particle foam cannons driven by toothbrush audio FFT.
 *    - Translucent 3D enamel shield dome deflecting incoming caramel sugar bombs.
 *    - 3D Hero Magic Mirror portal with heroic golden frame and sparkles.
 *    - Interactive 3D Mouth Hologram HUD transforming plaque into gleaming diamond white.
 *    - 3D Purification Transformation: Boss turns into a radiant, sparkling happy companion at 00:00!
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
      color: '#f59e0b',
      bodyColor: '#d97706',
      armorColor: '#f59e0b',
      bombColor: '#f59e0b'
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
    this.bgClouds = [];
    this.bgBubbles = [];

    // Initialize background floating ambient elements
    for (let i = 0; i < 16; i++) {
      this.bgBubbles.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: 4 + Math.random() * 12,
        speed: 15 + Math.random() * 25,
        wobbleSpeed: 1 + Math.random() * 2,
        wobbleOffset: Math.random() * Math.PI * 2,
        hue: Math.floor(Math.random() * 360),
        alpha: 0.2 + Math.random() * 0.4
      });
    }

    // Breakable Armor State (quadrants q1, q2, q3, q4)
    this.armorPlates = {
      q1: { id: 'q1', name: 'Upper Right', intact: true, cracks: 0, color: '#f59e0b', offset: { x: 38, y: -26, z: 22 } },
      q2: { id: 'q2', name: 'Upper Left', intact: true, cracks: 0, color: '#f59e0b', offset: { x: -38, y: -26, z: 22 } },
      q3: { id: 'q3', name: 'Lower Right', intact: true, cracks: 0, color: '#e89300', offset: { x: 34, y: 24, z: 22 } },
      q4: { id: 'q4', name: 'Lower Left', intact: true, cracks: 0, color: '#e89300', offset: { x: -34, y: 24, z: 22 } }
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
    const bId = bossData.id || 'sugar_bandit';
    let bodyColor = '#d97706';
    let armorColor = '#f59e0b';
    let bombColor = '#f59e0b';

    if (bId === 'plaque_kraken') {
      bodyColor = '#0891b2';
      armorColor = '#06b6d4';
      bombColor = '#06b6d4';
    } else if (bId === 'tartar_titan') {
      bodyColor = '#7c3aed';
      armorColor = '#8b5cf6';
      bombColor = '#a855f7';
    } else if (bossData.color) {
      bodyColor = bossData.color;
      armorColor = bossData.color;
      bombColor = bossData.color;
    }

    this.bossData = {
      ...this.bossData,
      ...bossData,
      id: bId,
      bodyColor,
      armorColor,
      bombColor
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
   */
  onArmorFracture(quadrantId = 'q1') {
    // 1. Boss Shield Barrier Shatter
    if (quadrantId === 'shield') {
      const bx = this.width * 0.5;
      const by = this.height * 0.38;
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const speed = 4.0 + Math.random() * 4.5;
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
          size: 8 + Math.random() * 8,
          color: '#fbbf24',
          alpha: 1.0,
          gravity: 0.12
        });
      }
      this.shockwaves.push({
        x: bx,
        y: by,
        radius: 30,
        maxRadius: 220,
        color: '#fbbf24',
        alpha: 1.0
      });
      if (typeof Sound?.fanfare === 'function') Sound.fanfare();
      return;
    }

    // 2. Tongue Polish Sparkle
    if (quadrantId === 'q5') {
      const bx = this.width * 0.5;
      const by = this.height * 0.38;
      for (let j = 0; j < 20; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 4.5;
        this.sparkles.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ec4899',
          size: 5 + Math.random() * 5,
          alpha: 1.0,
          life: 1.4
        });
      }
      if (typeof Sound?.sparkle === 'function') Sound.sparkle();
      return;
    }

    const plate = this.armorPlates[quadrantId];
    if (plate && plate.intact) {
      plate.intact = false;
      plate.cracks = 3;

      const bx = this.width * 0.5 + (plate.offset.x * (this.width / 400));
      const by = this.height * 0.38 + (plate.offset.y * (this.height / 300));

      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3.0 + Math.random() * 5.5;
        this.candyShards.push({
          x: bx,
          y: by,
          z: 20 + Math.random() * 40,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.8,
          vz: Math.random() * 4 - 2,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
          rotZ: Math.random() * Math.PI,
          vRotX: (Math.random() - 0.5) * 0.3,
          vRotY: (Math.random() - 0.5) * 0.3,
          vRotZ: (Math.random() - 0.5) * 0.3,
          size: 7 + Math.random() * 11,
          color: plate.color,
          alpha: 1.0,
          gravity: 0.18
        });
      }

      for (let j = 0; j < 14; j++) {
        this.sparkles.push({
          x: bx + (Math.random() - 0.5) * 32,
          y: by + (Math.random() - 0.5) * 32,
          vx: (Math.random() - 0.5) * 3.5,
          vy: (Math.random() - 0.5) * 3.5,
          color: '#ffffff',
          size: 4 + Math.random() * 4,
          alpha: 1.0,
          life: 0.9
        });
      }

      if (typeof Sound?.fanfare === 'function') Sound.fanfare();
    }
  }

  /**
   * Real-Time Fizzy Rainbow Soap Particle Foam Cannons
   */
  onFoamStream(intensity = 1.0, hasLaser = false, damageBoost = 0) {
    const streamCount = Math.round((4 + Math.round(intensity * 4)) * (1 + (damageBoost / 100)));
    const originX = this.width * 0.5;
    const originY = this.height * 0.96;
    const targetX = this.width * 0.5 + (Math.sin(this.clock * 4) * 32);
    const targetY = this.height * 0.38;

    const rainbowColors = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#ffffff'];

    for (let i = 0; i < streamCount; i++) {
      const spreadX = (Math.random() - 0.5) * 22;
      const vx = (targetX - originX) * 0.05 + spreadX;
      const vy = (targetY - originY) * 0.05 - 1.8;
      const randColor = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];

      this.foamParticles.push({
        x: originX + spreadX,
        y: originY,
        z: -20,
        vx: vx + (Math.random() - 0.5) * 1.6,
        vy: vy + (Math.random() - 0.5) * 1.6,
        vz: 1.8 + Math.random() * 2.2,
        radius: (hasLaser ? 8 : 7) + Math.random() * 6,
        alpha: 0.95,
        isLaser: hasLaser,
        color: hasLaser ? '#22d3ee' : randColor,
        glowColor: hasLaser ? '#06b6d4' : '#bae6fd',
        life: 1.0
      });
    }

    if (this.foamParticles.length > 100) {
      this.foamParticles.splice(0, this.foamParticles.length - 100);
    }
  }

  setDeflectActive(active = true) {
    this.isDeflectActive = active;
    this.deflectTimer = active ? 1.5 : 0;
    if (active) {
      this.shockwaves.push({
        x: this.width * 0.5,
        y: this.height * 0.72,
        radius: 24,
        maxRadius: 200,
        color: '#10b981',
        alpha: 0.85
      });
    }
  }

  /**
   * Deflect Flurry: Ricochets caramel sugar bomb back at the boss
   */
  onDeflectRicochet() {
    this.setDeflectActive(true);
    this.deflectTimer = 1.5;

    this.caramelBombs.forEach(bomb => {
      if (bomb.vz < 0) {
        bomb.vz = Math.abs(bomb.vz) * 1.6;
        bomb.vy = -Math.abs(bomb.vy) * 1.3;
        bomb.deflected = true;
      }
    });

    this.shockwaves.push({
      x: this.width * 0.5,
      y: this.height * 0.68,
      radius: 35,
      maxRadius: 240,
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
      y: this.height * 0.42,
      radius: 12,
      maxRadius: 380,
      color: '#fbbf24',
      alpha: 1.0
    });

    this.caramelBombs.forEach(b => {
      b.vz = 8;
      b.deflected = true;
    });

    Object.keys(this.armorPlates).forEach(k => this.onArmorFracture(k));
  }

  /**
   * 3D Cleanse Victory Sequence
   */
  onCleanseVictory() {
    this.isVictory = true;
    this.bossHp = 0;
    Object.keys(this.armorPlates).forEach(k => this.onArmorFracture(k));

    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.5;
      this.sparkles.push({
        x: this.width * 0.5,
        y: this.height * 0.38,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#54e98a', '#ffb961', '#38bdf8', '#f1c40f', '#ec4899', '#a78bfa'][i % 6],
        size: 6 + Math.random() * 6,
        alpha: 1.0,
        life: 2.2
      });
    }
  }

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

    // 1. Whimsical Cartoon Pastel Arena Skybox & Clouds
    this.renderCartoonSkybox(ctx, w, h, dt);

    // 2. Shockwave Rings
    this.renderShockwaves(ctx, dt);

    // 3. Pearly Floating Tooth Platform
    this.renderFloatingToothPlatform(ctx, w, h);

    // 4. Floating 3D Hero Mirror
    this.renderFloatingHeroMirror(ctx, w, h);

    // 5. Interactive 3D Mouth Hologram HUD
    this.render3DMouthHologram(ctx, w, h);

    // 6. 3D Boss & Breakable Candy Armor
    this.render3DBossAndArmor(ctx, w, h, dt);

    // 7. 3D Caramel Bomb Projectiles
    this.renderCaramelBombs(ctx, w, h, dt);

    // 8. Fizzy Rainbow Soap Particle Foam Cannons
    this.renderFoamParticles(ctx, dt);

    // 9. Fractured Candy Shards
    this.renderCandyShards(ctx, dt);

    // 10. Sparkles & Stars
    this.renderSparkles(ctx, dt);

    // 11. Translucent 3D Enamel Shield Dome
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
   * 1. Whimsical Cartoon Pastel Arena Skybox & Clouds
   */
  renderCartoonSkybox(ctx, w, h, dt) {
    ctx.clearRect(0, 0, w, h);

    // Whimsical starry bubble sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.isVictory) {
      skyGrad.addColorStop(0, '#064e3b');
      skyGrad.addColorStop(0.5, '#047857');
      skyGrad.addColorStop(1, '#065f46');
    } else {
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.4, '#1e1b4b');
      skyGrad.addColorStop(0.8, '#0f2b48');
      skyGrad.addColorStop(1, '#081a2e');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Twinkling stars in sky
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const sx = ((i * 73 + this.clock * 2) % w);
      const sy = ((i * 47) % (h * 0.65));
      const twinkle = (Math.sin(this.clock * 3 + i) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 + twinkle * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floating background ambient rainbow soap bubbles
    ctx.save();
    this.bgBubbles.forEach(b => {
      b.y -= b.speed * dt;
      if (b.y < -20) {
        b.y = h + 20;
        b.x = Math.random() * w;
      }
      const bx = b.x + Math.sin(this.clock * b.wobbleSpeed + b.wobbleOffset) * 12;

      ctx.save();
      ctx.strokeStyle = `hsla(${b.hue + this.clock * 20}, 85%, 75%, ${b.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bx, b.y, b.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(bx - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Soft floating candy clouds
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    const cloud1X = ((this.clock * 12) % (w + 200)) - 100;
    this.drawCartoonCloud(ctx, cloud1X, h * 0.22, 90);
    const cloud2X = (((this.clock * 8) + 260) % (w + 200)) - 100;
    this.drawCartoonCloud(ctx, cloud2X, h * 0.45, 120);
    ctx.restore();
  }

  drawCartoonCloud(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.6, y, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 3. Pearly Floating Tooth Platform
   * Renders an animated pearly white molar platform floating in 3D perspective beneath the boss
   */
  renderFloatingToothPlatform(ctx, w, h) {
    const px = w * 0.5;
    const py = h * 0.58 + Math.sin(this.clock * 2) * 5;
    const pw = Math.min(220, w * 0.52);
    const ph = pw * 0.44;

    ctx.save();
    ctx.translate(px, py);

    // Ambient floating shadow beneath platform
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, ph * 0.9, pw * 0.7, ph * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform Root / Molar Base (Depth)
    const baseGrad = ctx.createLinearGradient(0, 0, 0, ph * 0.7);
    baseGrad.addColorStop(0, '#e0f2fe');
    baseGrad.addColorStop(0.6, '#93c5fd');
    baseGrad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.moveTo(-pw * 0.5, 0);
    ctx.bezierCurveTo(-pw * 0.5, ph * 0.6, -pw * 0.2, ph * 0.75, 0, ph * 0.65);
    ctx.bezierCurveTo(pw * 0.2, ph * 0.75, pw * 0.5, ph * 0.6, pw * 0.5, 0);
    ctx.closePath();
    ctx.fill();

    // Golden decorative rim
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, pw * 0.5, ph * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Pearly Enamel Top Surface
    const topGrad = ctx.createRadialGradient(0, -ph * 0.1, 10, 0, 0, pw * 0.5);
    topGrad.addColorStop(0, '#ffffff');
    topGrad.addColorStop(0.7, '#f0f9ff');
    topGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, pw * 0.5 - 2, ph * 0.32 - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Celestial Tooth Rune / Sparkle in center
    ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
    ctx.font = `${Math.round(pw * 0.18)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦷', 0, 0);

    ctx.restore();
  }

  /**
   * Floating 3D Hero Mirror (Live Webcam Feed Video Texture)
   */
  renderFloatingHeroMirror(ctx, w, h) {
    const mirrorW = Math.min(130, w * 0.28);
    const mirrorH = mirrorW * 1.25;
    const mx = w * 0.18;
    const my = h * 0.22 + Math.sin(this.clock * 2) * 5;

    ctx.save();
    ctx.translate(mx, my);

    // Heroic Golden Frame with sparkles
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(-mirrorW * 0.5, -mirrorH * 0.5, mirrorW, mirrorH, 18);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Crown Star Crest on top
    ctx.fillStyle = '#fbbf24';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 0, -mirrorH * 0.5);

    // Inner Clip for video texture
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-mirrorW * 0.5 + 4, -mirrorH * 0.5 + 4, mirrorW - 8, mirrorH - 8, 14);
    ctx.clip();

    if (this.videoElement && this.videoElement.readyState >= 2 && !this.videoElement.paused) {
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoElement, -mirrorW * 0.5 + 4, -mirrorH * 0.5 + 4, mirrorW - 8, mirrorH - 8);
    } else {
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

    // Badge Title
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MAGIC MIRROR', 0, mirrorH * 0.5 + 13);

    ctx.restore();
  }

  /**
   * Interactive 3D Mouth Hologram HUD
   */
  render3DMouthHologram(ctx, w, h) {
    const hudW = Math.min(115, w * 0.25);
    const hudH = hudW * 0.95;
    const hx = w * 0.82;
    const hy = h * 0.22 + Math.cos(this.clock * 1.8) * 4;

    ctx.save();
    ctx.translate(hx, hy);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-hudW * 0.5, -hudH * 0.5, hudW, hudH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3D DENTAL ARCH', 0, -hudH * 0.5 + 12);

    const scale = hudW * 0.01;
    this.dentalTeeth.forEach(tooth => {
      const tx = tooth.x * scale;
      const ty = tooth.y * scale + 2;
      const isDone = tooth.cleanPct >= 100;
      const isActive = this.activeQuadrant === tooth.id;

      if (isActive) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(tx, ty, 7 + Math.sin(this.clock * 8) * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(tx, ty, 4.5, 0, Math.PI * 2);

      if (isDone) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
      } else {
        const dirtyRatio = 1 - (tooth.cleanPct / 100);
        ctx.fillStyle = dirtyRatio > 0.5 ? '#d97706' : '#fef08a';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });

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
    const by = h * 0.40 + Math.sin(this.clock * 2.5) * 8;
    const wobble = Math.sin(this.clock * 3.5) * 0.05;
    const breatheScaleY = 1 + Math.sin(this.clock * 3.5) * 0.04;
    const breatheScaleX = 1 - Math.sin(this.clock * 3.5) * 0.02;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(wobble);
    ctx.scale(breatheScaleX, breatheScaleY);

    const baseRadius = Math.min(58, w * 0.13);

    // Aura Glow
    const auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, baseRadius * 1.7);
    auraGrad.addColorStop(0, this.isVictory ? 'rgba(74, 222, 128, 0.7)' : 'rgba(245, 158, 11, 0.4)');
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 1.7, 0, Math.PI * 2);
    ctx.fill();

    // 1. Specific Boss Geometry & Accessories
    const bId = this.bossData.id;

    if (bId === 'plaque_kraken') {
      // Plaque Kraken wavy tentacles
      ctx.fillStyle = this.bossData.bodyColor;
      for (let t = 0; t < 5; t++) {
        const tx = (t - 2) * (baseRadius * 0.4);
        const wave = Math.sin(this.clock * 4 + t) * 8;
        ctx.beginPath();
        ctx.arc(tx + wave, baseRadius * 0.75, baseRadius * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (bId === 'tartar_titan') {
      // Tartar Titan Crystal Horns
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(-baseRadius * 0.6, -baseRadius * 0.6);
      ctx.lineTo(-baseRadius * 0.9, -baseRadius * 1.3);
      ctx.lineTo(-baseRadius * 0.3, -baseRadius * 0.8);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(baseRadius * 0.6, -baseRadius * 0.6);
      ctx.lineTo(baseRadius * 0.9, -baseRadius * 1.3);
      ctx.lineTo(baseRadius * 0.3, -baseRadius * 0.8);
      ctx.closePath();
      ctx.fill();
    } else {
      // Sugar Bandit Golden Candy Crown
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-baseRadius * 0.45, -baseRadius * 0.85);
      ctx.lineTo(-baseRadius * 0.3, -baseRadius * 1.35);
      ctx.lineTo(0, -baseRadius * 1.05);
      ctx.lineTo(baseRadius * 0.3, -baseRadius * 1.35);
      ctx.lineTo(baseRadius * 0.45, -baseRadius * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Boss Core Body Mesh
    ctx.fillStyle = this.isVictory ? '#fef08a' : this.bossData.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, baseRadius, baseRadius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.isVictory ? '#fbbf24' : '#b45309';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Expressive Cartoon Eyes
    const eyeOffsetX = baseRadius * 0.35;
    const eyeOffsetY = -baseRadius * 0.12;
    const isBlinking = (Math.floor(this.clock * 0.4) % 3 === 0) && ((this.clock * 3) % 1 < 0.25);

    if (this.isVictory) {
      // Happy curved upside-down eyes (^ ^)
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeOffsetX, eyeOffsetY, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Blushing cute cheeks
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX - 8, eyeOffsetY + 16, 7, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + 8, eyeOffsetY + 16, 7, 0, Math.PI * 2);
      ctx.fill();

      // Sweet beaming smile
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 8, 14, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Sparkling Halo
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -baseRadius * 1.15, baseRadius * 0.45, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isBlinking) {
      // Closed cartoon blink lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-eyeOffsetX - 8, eyeOffsetY);
      ctx.lineTo(-eyeOffsetX + 8, eyeOffsetY);
      ctx.moveTo(eyeOffsetX - 8, eyeOffsetY);
      ctx.lineTo(eyeOffsetX + 8, eyeOffsetY);
      ctx.stroke();
    } else {
      // Big expressive cartoon whites
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-eyeOffsetX, eyeOffsetY, 11, 14, -0.08, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX, eyeOffsetY, 11, 14, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Big pupils tracking player
      const lookX = Math.sin(this.clock * 2) * 2;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + lookX, eyeOffsetY + 1, 5.5, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + lookX, eyeOffsetY + 1, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Double specular sparkle highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + lookX - 2, eyeOffsetY - 1, 2.2, 0, Math.PI * 2);
      ctx.arc(-eyeOffsetX + lookX + 1.5, eyeOffsetY + 2.5, 1.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + lookX - 2, eyeOffsetY - 1, 2.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + lookX + 1.5, eyeOffsetY + 2.5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Grumpy cartoon teeth mouth
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-14, 10, 28, 8);
      ctx.fill();
      ctx.stroke();
    }

    // 4 Breakable 3D Candy Armor Plates (q1, q2, q3, q4)
    Object.values(this.armorPlates).forEach(plate => {
      if (!plate.intact) return;

      const px = plate.offset.x * (baseRadius / 45);
      const py = plate.offset.y * (baseRadius / 45);
      const pw = baseRadius * 0.58;
      const ph = baseRadius * 0.46;

      ctx.save();
      ctx.translate(px, py);

      // Plate 3D Candy Armor
      ctx.fillStyle = plate.color;
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.roundRect(-pw * 0.5, -ph * 0.5, pw, ph, 9);
      ctx.fill();
      ctx.stroke();

      // Candy gloss highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.roundRect(-pw * 0.5 + 2, -ph * 0.5 + 2, pw - 4, ph * 0.32, 5);
      ctx.fill();

      // Plate Zone Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plate.id.toUpperCase(), 0, 0);

      ctx.restore();
    });

    // Boss Shield Barrier Sphere
    if (this.isShieldActive) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.38 + Math.sin(this.clock * 6) * 3, 0, Math.PI * 2);
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
      y: this.height * 0.38,
      z: 80,
      vz: -32,
      vx: (Math.random() - 0.5) * 8,
      vy: 6,
      radius: 16,
      color: this.bossData.bombColor || '#f59e0b',
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

      const depthScale = Math.max(0.4, (120 - b.z) / 70);
      const drawRadius = b.radius * depthScale;

      ctx.save();
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(b.x, b.y, drawRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Deflected bomb impacts the boss!
      if (b.deflected && b.z >= 75) {
        for (let s = 0; s < 16; s++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2.5 + Math.random() * 5.0;
          this.candyShards.push({
            x: b.x,
            y: b.y,
            z: 75,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: -2,
            rotX: 0, rotY: 0, rotZ: Math.random() * Math.PI,
            vRotX: 0, vRotY: 0, vRotZ: 0.2,
            size: 6 + Math.random() * 7,
            color: b.color,
            alpha: 1.0,
            gravity: 0.15
          });
        }
        this.shockwaves.push({
          x: b.x,
          y: b.y,
          radius: 20,
          maxRadius: 180,
          color: '#34d399',
          alpha: 1.0
        });
        if (typeof Sound?.hit === 'function') Sound.hit();
        this.caramelBombs.splice(i, 1);
        continue;
      }

      // Near player collision
      if (b.z <= 0) {
        if (!b.deflected) {
          for (let s = 0; s < 8; s++) {
            this.foamParticles.push({
              x: b.x,
              y: b.y,
              z: 5,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              vz: 1,
              radius: 6 + Math.random() * 4,
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
      p.life -= dt * 1.3;
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
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Shiny rainbow bubble highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
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
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 20;

    // Arc dome
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Shimmering geodesic lines
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(167, 243, 208, 0.65)';
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
