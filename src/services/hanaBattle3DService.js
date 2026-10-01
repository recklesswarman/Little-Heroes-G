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
import { HYGIENE_BOSSES, SUGAR_ATTACK_HAZARDS } from '../data/hygieneBossesData.js';

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

    // Equipped Weapon Synergy & Stat Multiplier
    this.equippedWeapon = null;
    this.weaponMultiplier = 1.0;

    // Warrior Teeth Army in 3D Arena (Arched Front Line Defense)
    this.warriorTeeth = [
      { id: 'q2', name: 'Upper Left', label: 'Q2', angle: -0.28, xRatio: 0.16, yRatio: 0.83, cleanPct: 0, cheerTimer: 0, shieldWobble: 0, shieldRaised: false, isCaptain: false, recoil: 0, fireFlash: 0 },
      { id: 'q4', name: 'Lower Left', label: 'Q4', angle: -0.14, xRatio: 0.33, yRatio: 0.86, cleanPct: 0, cheerTimer: 0, shieldWobble: 0, shieldRaised: false, isCaptain: false, recoil: 0, fireFlash: 0 },
      { id: 'q5', name: 'Commander', label: 'Captain', angle: 0, xRatio: 0.50, yRatio: 0.88, cleanPct: 0, cheerTimer: 0, shieldWobble: 0, shieldRaised: false, isCaptain: true, recoil: 0, fireFlash: 0 },
      { id: 'q3', name: 'Lower Right', label: 'Q3', angle: 0.14, xRatio: 0.67, yRatio: 0.86, cleanPct: 0, cheerTimer: 0, shieldWobble: 0, shieldRaised: false, isCaptain: false, recoil: 0, fireFlash: 0 },
      { id: 'q1', name: 'Upper Right', label: 'Q1', angle: 0.28, xRatio: 0.84, yRatio: 0.83, cleanPct: 0, cheerTimer: 0, shieldWobble: 0, shieldRaised: false, isCaptain: false, recoil: 0, fireFlash: 0 }
    ];

    // Illustrated Asset Cache & Sweet Hazard State
    this.imageCache = {};
    this.currentHazard = null;
    this.damageWobble = 0;

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
    this.counterAttackProjectiles = [];
    this.hazardImpactParticles = [];
    this.warriorCheerParticles = [];

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
    this.showCanvasHud = false;

    // Bind loop
    this.renderLoop = this.renderLoop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Reset simulation state for a clean new battle
   */
  resetBattleState() {
    this.isVictory = false;
    this.bossHp = this.maxHp || 100;
    this.isShieldActive = false;
    this.isScrubbing = false;
    this.isDeflectActive = false;
    this.deflectTimer = 0;
    this.caramelBombs = [];
    this.candyShards = [];
    this.foamParticles = [];
    this.sparkles = [];
    this.shockwaves = [];
    this.counterAttackProjectiles = [];
    this.hazardImpactParticles = [];
    this.warriorCheerParticles = [];
    this.warriorTeeth.forEach(t => {
      t.cleanPct = 0;
      t.cheerTimer = 0;
      t.shieldWobble = 0;
      t.shieldRaised = false;
      t.recoil = 0;
      t.fireFlash = 0;
    });
    Object.values(this.armorPlates).forEach(p => {
      p.intact = true;
      p.cracks = 0;
    });
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
      if (options.bossData) this.setBoss(options.bossData, options.quadrantCleanliness);
      if (options.hazard) this.setHazard(options.hazard);
      if (options.combatWeapon) {
        this.setEquippedWeapon(options.combatWeapon);
      } else {
        if (options.equippedWeapon !== undefined) this.equippedWeapon = options.equippedWeapon;
        if (options.weaponMultiplier !== undefined) this.weaponMultiplier = options.weaponMultiplier;
      }
      return true;
    }

    this.canvas = canvasElement;
    this.isDestroyed = false;
    this.isInitialized = true;
    if (options.isVictory || (options.preserveBattleState && this.isVictory)) {
      this.isVictory = true;
      this.bossHp = 0;
      this.caramelBombs = [];
      Object.values(this.armorPlates).forEach(p => {
        p.intact = false;
        p.cracks = 3;
      });
      this.warriorTeeth.forEach(t => {
        t.cleanPct = 100;
        t.cheerTimer = 999;
      });
    } else if (!options.preserveBattleState) {
      this.resetBattleState();
    }

    if (options.bossData) {
      this.setBoss(options.bossData, options.quadrantCleanliness);
    }
    if (options.hazard) {
      this.setHazard(options.hazard);
    }
    if (options.videoElement) {
      this.setVideoElement(options.videoElement);
    }
    if (options.combatWeapon) {
      this.setEquippedWeapon(options.combatWeapon);
    } else {
      if (options.equippedWeapon !== undefined) this.equippedWeapon = options.equippedWeapon;
      if (options.weaponMultiplier !== undefined) this.weaponMultiplier = options.weaponMultiplier;
    }

    // Preload boss illustrations and all 7 high-res hazard attack textures
    try {
      if (Array.isArray(HYGIENE_BOSSES)) {
        HYGIENE_BOSSES.forEach(b => {
          if (b.image) this.loadImage(b.image);
          if (b.cleansedImage) this.loadImage(b.cleansedImage);
        });
      }
      const hazardAssets = [
        '/assets/hazards/cookies.jpg',
        '/assets/hazards/lava_cake.jpg',
        '/assets/hazards/mint_icecream.jpg',
        '/assets/hazards/soda.jpg',
        '/assets/hazards/smarties.jpg',
        '/assets/hazards/gummy_bears.svg',
        '/assets/hazards/lollipops.svg'
      ];
      hazardAssets.forEach(p => this.loadImage(p));
      if (Array.isArray(SUGAR_ATTACK_HAZARDS)) {
        SUGAR_ATTACK_HAZARDS.forEach(h => {
          if (h.image) this.loadImage(h.image);
        });
      }
    } catch (e) {
      // Non-blocking asset preload
    }

    this.hasLaserEquipped = Boolean(options.hasLaserEquipped || this.equippedWeapon);
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
    const rect = (parent && typeof parent.getBoundingClientRect === 'function') ? parent.getBoundingClientRect() : { width: 600, height: 420 };
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
    const raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (cb => setTimeout(cb, 16));
    const caf = (typeof cancelAnimationFrame !== 'undefined') ? cancelAnimationFrame : clearTimeout;
    if (this.animId) caf(this.animId);
    this.animId = raf(this.renderLoop);
  }

  setEquippedWeapon(combatWeapon) {
    if (!combatWeapon) {
      this.equippedWeapon = null;
      this.weaponMultiplier = 1.0;
      return;
    }
    this.equippedWeapon = combatWeapon.weapon || combatWeapon;
    this.weaponMultiplier = combatWeapon.multiplier || 1.0;
    if (combatWeapon.hasWeapon || this.equippedWeapon) {
      this.hasLaserEquipped = true;
    }
  }

  loadImage(src) {
    if (!src || typeof Image === 'undefined') return null;
    if (this.imageCache[src]) return this.imageCache[src];
    try {
      const img = new Image();
      img.onerror = () => {
        if (typeof src === 'string' && !img._retried) {
          img._retried = true;
          if (src.startsWith('/')) {
            img.src = '.' + src;
          } else if (src.startsWith('./')) {
            img.src = src.substring(1);
          } else {
            img.src = '/' + src;
          }
        }
      };
      img.src = src;
      this.imageCache[src] = img;
      if (typeof src === 'string' && src.startsWith('/')) {
        this.imageCache['.' + src] = img;
      }
      return img;
    } catch (e) {
      return null;
    }
  }

  setHazard(hazard) {
    this.currentHazard = hazard;
    if (hazard && hazard.image) {
      this.loadImage(hazard.image);
    }
  }

  setVideoElement(videoEl) {
    this.videoElement = videoEl;
  }

  setBoss(bossData, quadrantCleanliness = null) {
    if (!bossData) return;
    const bId = (bossData.id === 'sugar_boss' || bossData.meshType === 'sugar_bandit') ? 'sugar_bandit' : (bossData.id || 'sugar_bandit');
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
    } else if (bId === 'cavity_knight') {
      bodyColor = '#dc2626';
      armorColor = '#ef4444';
      bombColor = '#ef4444';
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

    if (bossData.image) this.loadImage(bossData.image);
    if (bossData.cleansedImage) this.loadImage(bossData.cleansedImage);

    // Set colors for armor plates based on boss, preserving completed quadrants
    Object.values(this.armorPlates).forEach(p => {
      p.color = this.bossData.armorColor;
      const isAlreadyClean = quadrantCleanliness && quadrantCleanliness[p.id] >= 100;
      if (isAlreadyClean) {
        p.intact = false;
        p.cracks = 3;
      } else if (!quadrantCleanliness) {
        p.intact = true;
        p.cracks = 0;
      }
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
    quadrantCleanliness = null,
    combatWeapon = null,
    equippedWeapon = null,
    weaponMultiplier = null,
    combo = 1
  } = {}) {
    this.bossHp = bossHp;
    this.maxHp = maxHp;
    this.isShieldActive = shieldActive;
    this.activeQuadrant = activeQuadrant;
    this.currentCombo = combo || 1;
    if (combatWeapon) {
      this.setEquippedWeapon(combatWeapon);
    } else {
      if (hasLaser !== undefined) this.hasLaserEquipped = hasLaser;
      if (equippedWeapon !== undefined) this.equippedWeapon = equippedWeapon;
      if (weaponMultiplier !== undefined) this.weaponMultiplier = weaponMultiplier;
    }
    this.cadenceScore = cadenceScore;
    this.isScrubbing = isScrubbing;

    // Sync warrior teeth army and dental hologram progress
    if (quadrantCleanliness) {
      let sumPct = 0;
      let count = 0;
      this.warriorTeeth.forEach(t => {
        if (t.id === 'q5') {
          const prev = t.cleanPct;
          if (quadrantCleanliness.q5 !== undefined) {
            t.cleanPct = quadrantCleanliness.q5;
          }
          if (prev < 100 && t.cleanPct >= 100) {
            t.cheerTimer = 3.5;
            this.spawnWarriorCheerParticles(t);
          }
        } else if (quadrantCleanliness[t.id] !== undefined) {
          const prev = t.cleanPct;
          t.cleanPct = quadrantCleanliness[t.id];
          if (prev < 100 && t.cleanPct >= 100) {
            t.cheerTimer = 3.5;
            this.spawnWarriorCheerParticles(t);
          }
          sumPct += t.cleanPct;
          count++;
        }
      });
      const captain = this.warriorTeeth.find(t => t.isCaptain);
      if (captain && quadrantCleanliness.q5 === undefined && count > 0) {
        const prevCap = captain.cleanPct;
        captain.cleanPct = Math.round(sumPct / count);
        if (prevCap < 100 && captain.cleanPct >= 100) {
          captain.cheerTimer = 3.5;
          this.spawnWarriorCheerParticles(captain);
        }
      }

      this.dentalTeeth.forEach(t => {
        if (quadrantCleanliness[t.id] !== undefined) {
          t.cleanPct = quadrantCleanliness[t.id];
        }
      });
    }

    // Trigger counter-attack if cadence is high, combo rising, or scrubbing
    if (this.isScrubbing && (this.cadenceScore > 40 || (this.currentCombo && this.currentCombo > 5) || Math.random() < 0.25)) {
      this.triggerWarriorCounterAttack(this.currentCombo || 1);
    }

    // Sync Spline Runtime variables if active
    if (this.isSplineActive && this.splineApp) {
      try {
        if (typeof this.splineApp.setVariable === 'function') {
          this.splineApp.setVariable('BossHP', Math.max(0, Math.min(100, (bossHp / maxHp) * 100)));
          this.splineApp.setVariable('ShieldActive', shieldActive);
          const qNum = parseInt(activeQuadrant.replace('q', ''), 10) || 1;
          this.splineApp.setVariable('ActiveQuadrant', qNum);
          this.splineApp.setVariable('LaserEquipped', Boolean(this.hasLaserEquipped || this.equippedWeapon));
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

    // Raise all warrior teeth shields in defensive phalanx
    this.warriorTeeth.forEach(t => {
      t.shieldRaised = true;
      t.shieldWobble = 0.6;
    });

    const multiplier = this.weaponMultiplier || 1.0;
    this.caramelBombs.forEach(bomb => {
      if (bomb.vz < 0) {
        bomb.vz = Math.abs(bomb.vz) * (1.6 * multiplier);
        bomb.vy = -Math.abs(bomb.vy) * 1.3;
        bomb.deflected = true;
      }
    });

    this.shockwaves.push({
      x: this.width * 0.5,
      y: this.height * 0.82,
      radius: 35,
      maxRadius: 280,
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
    this.warriorTeeth.forEach(t => {
      t.cleanPct = 100;
      t.cheerTimer = 4.0;
    });
  }

  /**
   * 3D Cleanse Victory Sequence
   */
  onCleanseVictory() {
    this.isVictory = true;
    this.bossHp = 0;
    this.caramelBombs = []; // Clear active hazard projectiles on victory
    this.counterAttackProjectiles = [];
    Object.keys(this.armorPlates).forEach(k => this.onArmorFracture(k));

    // Polish all 5 Warrior Teeth to gleaming diamond armor and start celebration cheering
    this.warriorTeeth.forEach(t => {
      t.cleanPct = 100;
      t.cheerTimer = 999;
      t.shieldRaised = true;
    });

    // Spawn celebratory cleanse shockwave ring
    this.shockwaves.push({
      x: this.width * 0.5,
      y: this.height * 0.38,
      radius: 20,
      maxRadius: 320,
      color: '#34d399',
      alpha: 1.0
    });

    for (let i = 0; i < 65; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 8.0;
      this.sparkles.push({
        x: this.width * 0.5,
        y: this.height * 0.38,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#54e98a', '#ffb961', '#38bdf8', '#f1c40f', '#ec4899', '#a78bfa', '#ffffff'][i % 7],
        size: 6 + Math.random() * 8,
        alpha: 1.0,
        life: 2.6
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

    const raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (cb => setTimeout(cb, 16));
    this.animId = raf(this.renderLoop);
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

    // 4 & 5. Optional Canvas Mirror & Mouth HUD (used only if DOM HUD is not present)
    if (this.showCanvasHud) {
      this.renderFloatingHeroMirror(ctx, w, h);
      this.render3DMouthHologram(ctx, w, h);
    }

    // 6. 3D Boss & Breakable Candy Armor
    this.render3DBossAndArmor(ctx, w, h, dt);

    // 7. Counter Attack Projectiles (Warrior Teeth vs Boss)
    this.renderCounterAttackProjectiles(ctx, dt);

    // 8. Arched Front Line of Animated 3D Enamel Warrior Teeth Army
    this.renderWarriorTeethArmy(ctx, w, h, dt);

    // 9. 3D Caramel Bomb Projectiles (With Neon Motion Trails & Themed Shatters)
    // -- drawn AFTER the Warrior Teeth Army so an incoming hazard's high-quality
    // graphic is visible in front of the teeth it's flying toward, not hidden
    // behind them (both occupy the same screen band at a similar size).
    this.renderCaramelBombs(ctx, w, h, dt);

    // 10. Fizzy Rainbow Soap Particle Foam Cannons
    this.renderFoamParticles(ctx, dt);

    // 11. Fractured Candy Shards, Themed Hazard Impacts & Cheer Stars
    this.renderCandyShards(ctx, dt);
    this.renderHazardImpactParticles(ctx, dt);
    this.renderWarriorCheerParticles(ctx, dt);

    // 12. Sparkles & Stars
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
    if (this.damageWobble > 0) {
      this.damageWobble = Math.max(0, this.damageWobble - dt * 2.5);
    }
    const wobble = Math.sin(this.clock * 3.5) * 0.05 + Math.sin(this.clock * 26) * this.damageWobble;
    const breatheScaleY = 1 + Math.sin(this.clock * 3.5) * 0.04;
    const breatheScaleX = 1 - Math.sin(this.clock * 3.5) * 0.02;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(wobble);
    ctx.scale(breatheScaleX, breatheScaleY);

    const baseRadius = Math.min(68, w * 0.15);

    // Dynamic Rainbow Cleanse Aura (during victory) or Boss Theme Aura (during battle)
    if (this.isVictory) {
      const rainbowHue = Math.floor((this.clock * 75) % 360);
      const auraPulse = 1 + Math.sin(this.clock * 4.5) * 0.12;
      const auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, baseRadius * 2.3 * auraPulse);
      auraGrad.addColorStop(0, `hsla(${rainbowHue}, 90%, 65%, 0.85)`);
      auraGrad.addColorStop(0.35, `hsla(${(rainbowHue + 60) % 360}, 90%, 60%, 0.6)`);
      auraGrad.addColorStop(0.7, `hsla(${(rainbowHue + 120) % 360}, 85%, 55%, 0.3)`);
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 2.3 * auraPulse, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const auraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, baseRadius * 1.6);
      auraGrad.addColorStop(0, this.bossData.color ? `${this.bossData.color}66` : 'rgba(245, 158, 11, 0.4)');
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Check for high-res illustrated boss art
    const bossImgSrc = this.isVictory ? this.bossData.cleansedImage : this.bossData.image;
    const bossImg = bossImgSrc ? (this.imageCache[bossImgSrc] || this.loadImage(bossImgSrc)) : null;

    if (bossImg && bossImg.complete && bossImg.naturalWidth > 0) {
      ctx.save();
      // Drop shadow on platform
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(bossImg, -baseRadius, -baseRadius, baseRadius * 2, baseRadius * 2);
      ctx.restore();

      // Outer glowing rim
      if (this.isVictory) {
        const rimHue = Math.floor((this.clock * 90) % 360);
        ctx.strokeStyle = `hsl(${rimHue}, 95%, 65%)`;
        ctx.lineWidth = 4.5;
      } else {
        ctx.strokeStyle = this.bossData.color || '#fbbf24';
        ctx.lineWidth = 3.5;
      }
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (this.isVictory) {
        // Sparkling Victory Halo with celestial gold shimmer
        ctx.save();
        ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(0, -baseRadius * 1.18, baseRadius * 0.5, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      this.renderProceduralBossFallback(ctx, baseRadius);
    }

    // 4 Breakable 3D Candy Armor Plates (q1, q2, q3, q4) - completely cleansed on victory
    if (!this.isVictory) {
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
    }

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

  renderProceduralBossFallback(ctx, baseRadius) {
    const bId = (this.bossData.id === 'sugar_boss' || this.bossData.meshType === 'sugar_bandit') ? 'sugar_bandit' : this.bossData.id;

    if (bId === 'plaque_kraken') {
      ctx.fillStyle = this.bossData.bodyColor || '#0891b2';
      for (let t = 0; t < 5; t++) {
        const tx = (t - 2) * (baseRadius * 0.4);
        const wave = Math.sin(this.clock * 4 + t) * 8;
        ctx.beginPath();
        ctx.arc(tx + wave, baseRadius * 0.75, baseRadius * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (bId === 'tartar_titan') {
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
    } else if (bId === 'cavity_knight') {
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(-baseRadius * 0.5, -baseRadius * 0.7);
      ctx.lineTo(0, -baseRadius * 1.4);
      ctx.lineTo(baseRadius * 0.5, -baseRadius * 0.7);
      ctx.closePath();
      ctx.fill();
    } else {
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
    ctx.fillStyle = this.isVictory ? '#fef08a' : (this.bossData.bodyColor || '#d97706');
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
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeOffsetX, eyeOffsetY, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX - 8, eyeOffsetY + 16, 7, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + 8, eyeOffsetY + 16, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 8, 14, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -baseRadius * 1.15, baseRadius * 0.45, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isBlinking) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-eyeOffsetX - 8, eyeOffsetY);
      ctx.lineTo(-eyeOffsetX + 8, eyeOffsetY);
      ctx.moveTo(eyeOffsetX - 8, eyeOffsetY);
      ctx.lineTo(eyeOffsetX + 8, eyeOffsetY);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-eyeOffsetX, eyeOffsetY, 11, 14, -0.08, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX, eyeOffsetY, 11, 14, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const lookX = Math.sin(this.clock * 2) * 2;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + lookX, eyeOffsetY + 1, 5.5, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + lookX, eyeOffsetY + 1, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + lookX - 2, eyeOffsetY - 1, 2.2, 0, Math.PI * 2);
      ctx.arc(-eyeOffsetX + lookX + 1.5, eyeOffsetY + 2.5, 1.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + lookX - 2, eyeOffsetY - 1, 2.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + lookX + 1.5, eyeOffsetY + 2.5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-14, 10, 28, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * Spawn a 3D Sugar Attack Hazard targeted at the player
   */
  spawnCaramelBomb(hazard = null) {
    if (this.isVictory) return;
    const haz = hazard || this.currentHazard || {
      id: 'cookies',
      name: 'Cookies',
      color: '#d97706',
      shatterType: 'cookie_crumbs',
      shatterColors: ['#d97706', '#92400e', '#451a03'],
      image: '/assets/hazards/cookies.jpg'
    };
    if (haz.image) this.loadImage(haz.image);

    // Compute dynamic trajectory: fly from boss toward the player at arena bottom
    const startY = this.height * 0.38;
    const targetY = this.height * 0.82;
    const vz = -32;
    const flightTime = 80 / Math.abs(vz); // ~2.5 seconds
    const vy = (targetY - startY) / flightTime;
    const spreadX = (Math.random() - 0.5) * 44;

    this.caramelBombs.push({
      x: this.width * 0.5 + (Math.random() - 0.5) * 30,
      y: startY,
      z: 80,
      vz: vz,
      vx: spreadX,
      vy: vy,
      radius: 26,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 3,
      color: haz.color || this.bossData.bombColor || '#f59e0b',
      hazard: haz,
      deflected: false
    });
  }

  /**
   * 3D Sugar Attack Hazard Projectiles (With Neon Motion Trails & Themed Shatters)
   */
  renderCaramelBombs(ctx, w, h, dt) {
    for (let i = this.caramelBombs.length - 1; i >= 0; i--) {
      const b = this.caramelBombs[i];
      b.z += b.vz * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot = (b.rot || 0) + (b.vRot || 2) * dt;

      const depthScale = Math.max(0.4, (120 - b.z) / 70);
      const drawRadius = b.radius * depthScale;
      const haz = b.hazard || this.currentHazard;

      // Track neon motion trail
      if (!b.trail) b.trail = [];
      b.trail.push({ x: b.x, y: b.y, radius: drawRadius });
      if (b.trail.length > 7) b.trail.shift();

      // Render neon motion trail behind projectile
      if (b.trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const trailColor = haz?.color || b.color || '#fbbf24';
        for (let t = 0; t < b.trail.length - 1; t++) {
          const pt1 = b.trail[t];
          const pt2 = b.trail[t + 1];
          const trailAlpha = ((t + 1) / b.trail.length) * 0.45;
          ctx.strokeStyle = trailColor;
          ctx.globalAlpha = trailAlpha;
          ctx.lineWidth = pt2.radius * 0.75;
          ctx.shadowColor = trailColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);

      // 3D Drop Shadow on Platform
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12 * depthScale;
      ctx.shadowOffsetY = 6 * depthScale;

      const img = haz?.image ? (this.imageCache[haz.image] || this.loadImage(haz.image)) : null;
      if (img && img.complete && img.naturalWidth > 0) {
        const size = drawRadius * 2.2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -size * 0.5, -size * 0.5, size, size);
        ctx.restore();

        // Glowing outer candy rim
        ctx.strokeStyle = haz?.color || '#fbbf24';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Specular shimmer highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius - 2, -Math.PI * 0.75, -Math.PI * 0.25);
        ctx.stroke();
      } else {
        this.renderProceduralHazardItem(ctx, haz?.id, drawRadius, b.color);
      }
      ctx.restore();

      // Threat detection: Nearest Warrior Tooth raises shield when bomb approaches (scaled by weapon defense boost)
      const threatDist = 25 * Math.min(1.4, Math.max(1.0, this.weaponMultiplier || 1.0));
      if (b.z <= threatDist && !b.deflected) {
        let nearestTooth = null;
        let minDx = Infinity;
        this.warriorTeeth.forEach(tooth => {
          const toothX = tooth.xRatio * w;
          const dx = Math.abs(toothX - b.x);
          if (dx < minDx) {
            minDx = dx;
            nearestTooth = tooth;
          }
        });
        if (nearestTooth) {
          nearestTooth.shieldRaised = true;
          nearestTooth.shieldWobble = 0.35;
        }
      }

      // Deflected bomb impacts the boss!
      if (b.deflected && b.z >= 75) {
        this.damageWobble = 0.35;
        this.spawnThemedHazardImpact(haz, b.x, b.y);
        const colors = (haz && haz.shatterColors) || [b.color, '#fbbf24', '#ffffff'];
        for (let s = 0; s < 20; s++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2.8 + Math.random() * 6.0;
          this.candyShards.push({
            x: b.x,
            y: b.y,
            z: 75,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: -2,
            rotX: 0, rotY: 0, rotZ: Math.random() * Math.PI,
            vRotX: 0, vRotY: 0, vRotZ: 0.2,
            size: 6 + Math.random() * 8,
            color: colors[s % colors.length],
            alpha: 1.0,
            gravity: 0.16
          });
        }
        this.shockwaves.push({
          x: b.x,
          y: b.y,
          radius: 20,
          maxRadius: 200,
          color: haz?.color || '#34d399',
          alpha: 1.0
        });
        if (typeof Sound?.hit === 'function') Sound.hit();
        this.caramelBombs.splice(i, 1);
        continue;
      }

      // Near player collision: Shield impact & spark deflection
      if (b.z <= 0) {
        let nearestTooth = null;
        let minDx = Infinity;
        this.warriorTeeth.forEach(tooth => {
          const toothX = tooth.xRatio * w;
          const dx = Math.abs(toothX - b.x);
          if (dx < minDx) {
            minDx = dx;
            nearestTooth = tooth;
          }
        });

        if (nearestTooth) {
          nearestTooth.shieldWobble = 0.6;
          this.spawnShieldSparks(b.x, b.y, '#34d399');
        }

        this.spawnThemedHazardImpact(haz, b.x, b.y);
        if (typeof Sound?.hit === 'function') Sound.hit();
        this.caramelBombs.splice(i, 1);
      }
    }
  }

  /**
   * Unleash Warrior Teeth counter-attack projectile at boss
   */
  triggerWarriorCounterAttack(combo = 1) {
    if (this.isVictory) return;
    const firingTooth = this.warriorTeeth[Math.floor(Math.random() * this.warriorTeeth.length)];
    if (!firingTooth) return;

    firingTooth.recoil = 0.35;
    firingTooth.fireFlash = 0.45;

    const w = this.width;
    const h = this.height;
    const sx = firingTooth.xRatio * w;
    const sy = firingTooth.yRatio * h - 25;
    const tx = w * 0.5 + (Math.random() - 0.5) * 44;
    const ty = h * 0.38 + (Math.random() - 0.5) * 28;

    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 500;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    const mult = this.weaponMultiplier || 1.0;
    const comboMultiplier = 1.0 + Math.min(2.0, (combo || 1) * 0.05);
    const weaponTitle = (this.equippedWeapon?.title || '').toLowerCase();

    let pType = 'laser_beam';
    let pColor = '#22d3ee';
    let pGlow = '#06b6d4';

    if (weaponTitle.includes('sonic')) {
      pType = 'sonic_blast';
      pColor = '#fbbf24';
      pGlow = '#f59e0b';
    } else if (weaponTitle.includes('wand') || weaponTitle.includes('star')) {
      pType = 'star_sparkle';
      pColor = '#ec4899';
      pGlow = '#f472b6';
    } else if (weaponTitle.includes('bubble') || weaponTitle.includes('foam')) {
      pType = 'bubble_burst';
      pColor = '#38bdf8';
      pGlow = '#60a5fa';
    } else if (weaponTitle.includes('emerald') || weaponTitle.includes('mint')) {
      pType = 'mint_crystal';
      pColor = '#10b981';
      pGlow = '#34d399';
    }

    this.counterAttackProjectiles.push({
      x: sx,
      y: sy,
      vx: vx,
      vy: vy,
      targetX: tx,
      targetY: ty,
      type: pType,
      color: pColor,
      glow: pGlow,
      damage: 3.5 * mult * comboMultiplier,
      radius: 7 * Math.min(1.5, mult) * Math.min(1.4, Math.sqrt(comboMultiplier)),
      trail: [],
      life: dist / speed
    });

    // If combo is high (>= 15), unleash simultaneous Captain support blast
    if (combo >= 15 && !firingTooth.isCaptain) {
      const captain = this.warriorTeeth.find(t => t.isCaptain);
      if (captain) {
        captain.recoil = 0.3;
        captain.fireFlash = 0.4;
        const csx = captain.xRatio * w;
        const csy = captain.yRatio * h - 25;
        const cdx = tx - csx;
        const cdy = ty - csy;
        const cdist = Math.hypot(cdx, cdy) || 1;
        this.counterAttackProjectiles.push({
          x: csx,
          y: csy,
          vx: (cdx / cdist) * speed,
          vy: (cdy / cdist) * speed,
          targetX: tx,
          targetY: ty,
          type: pType,
          color: pColor,
          glow: pGlow,
          damage: 2.5 * mult * comboMultiplier,
          radius: 6 * Math.min(1.5, mult),
          trail: [],
          life: cdist / speed
        });
      }
    }

    if (typeof Sound?.laser === 'function') Sound.laser();
    else if (typeof Sound?.sparkle === 'function') Sound.sparkle();
  }

  /**
   * Render Themed Counter Attack Projectiles (Warrior Teeth vs Boss)
   */
  renderCounterAttackProjectiles(ctx, dt) {
    for (let i = this.counterAttackProjectiles.length - 1; i >= 0; i--) {
      const p = this.counterAttackProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (!p.trail) p.trail = [];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();

      // Render projectile trail
      if (p.trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let t = 0; t < p.trail.length - 1; t++) {
          const pt1 = p.trail[t];
          const pt2 = p.trail[t + 1];
          ctx.strokeStyle = p.glow;
          ctx.globalAlpha = ((t + 1) / p.trail.length) * 0.55;
          ctx.lineWidth = p.radius * 0.8;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = 14;

      if (p.type === 'laser_beam') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.rotate(angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-p.radius * 1.8, -p.radius * 0.5, p.radius * 3.6, p.radius, 4);
        } else {
          ctx.rect(-p.radius * 1.8, -p.radius * 0.5, p.radius * 3.6, p.radius);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-p.radius * 1.2, -p.radius * 0.25, p.radius * 2.4, p.radius * 0.5, 2);
        } else {
          ctx.rect(-p.radius * 1.2, -p.radius * 0.25, p.radius * 2.4, p.radius * 0.5);
        }
        ctx.fill();
      } else if (p.type === 'sonic_blast') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star_sparkle') {
        ctx.fillStyle = p.color;
        const spikes = 5;
        const outer = p.radius * 1.4;
        const inner = p.radius * 0.6;
        ctx.beginPath();
        for (let s = 0; s < spikes * 2; s++) {
          const r = (s % 2 === 0) ? outer : inner;
          const a = (s * Math.PI) / spikes + this.clock * 8;
          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Enamel Crystal / Bubble Burst
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-p.radius * 0.3, -p.radius * 0.3, p.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Hit boss when lifetime expires or proximity reached
      if (p.life <= 0) {
        this.damageWobble = 0.25;
        this.bossHp = Math.max(0, this.bossHp - p.damage);
        this.shockwaves.push({
          x: p.targetX || p.x,
          y: p.targetY || p.y,
          radius: 10,
          maxRadius: 80,
          color: p.color,
          alpha: 0.9
        });
        for (let s = 0; s < 6; s++) {
          const a = Math.random() * Math.PI * 2;
          this.sparkles.push({
            x: p.targetX || p.x,
            y: p.targetY || p.y,
            vx: Math.cos(a) * 3,
            vy: Math.sin(a) * 3,
            color: p.color,
            size: 3 + Math.random() * 3,
            alpha: 1.0,
            life: 0.5
          });
        }
        this.counterAttackProjectiles.splice(i, 1);
      }
    }
  }

  /**
   * Arched Front Line of 5 Animated 3D Enamel Warrior Teeth Army
   */
  renderWarriorTeethArmy(ctx, w, h, dt) {
    // Arched Enamel Defense Line connecting beam
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = this.isVictory ? 'rgba(52, 211, 153, 0.55)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.isVictory ? '#34d399' : '#38bdf8';
    ctx.shadowBlur = 8;
    this.warriorTeeth.forEach((t, i) => {
      const px = t.xRatio * w;
      const py = t.yRatio * h + Math.sin(this.clock * 3 + i) * 3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    this.warriorTeeth.forEach((tooth, idx) => {
      if (tooth.cheerTimer > 0 && !this.isVictory) {
        tooth.cheerTimer = Math.max(0, tooth.cheerTimer - dt);
      }
      if (tooth.shieldWobble > 0) {
        tooth.shieldWobble = Math.max(0, tooth.shieldWobble - dt * 2.5);
      }
      if (tooth.recoil > 0) {
        tooth.recoil = Math.max(0, tooth.recoil - dt * 3.0);
      }
      if (tooth.fireFlash > 0) {
        tooth.fireFlash = Math.max(0, tooth.fireFlash - dt * 3.5);
      }
      if (!this.isDeflectActive && tooth.shieldRaised && !this.isVictory) {
        const anyThreat = this.caramelBombs.some(b => b.z <= 30 && !b.deflected);
        if (!anyThreat) {
          tooth.shieldRaised = false;
        }
      }

      const tx = tooth.xRatio * w;
      let ty = tooth.yRatio * h;

      const isCheering = tooth.cheerTimer > 0 || this.isVictory;
      if (isCheering) {
        const bounce = Math.abs(Math.sin(this.clock * 10 + idx)) * 14;
        ty -= bounce;
      } else {
        ty += Math.sin(this.clock * 3 + idx) * 3;
      }
      ty += tooth.recoil * 10;

      const baseSize = Math.min(34, w * 0.075);
      const tw = tooth.isCaptain ? baseSize * 1.25 : baseSize;
      const th = tw * 1.25;

      ctx.save();
      ctx.translate(tx, ty);

      // Gleaming pearly aura when 100% clean
      const isPearly = tooth.cleanPct >= 100;
      if (isPearly) {
        ctx.save();
        const auraPulse = 1 + Math.sin(this.clock * 5 + idx) * 0.15;
        const auraGrad = ctx.createRadialGradient(0, -th * 0.2, 5, 0, -th * 0.2, tw * 1.6 * auraPulse);
        auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        auraGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.25)');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, -th * 0.2, tw * 1.6 * auraPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Ground Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, th * 0.5 + 4, tw * 0.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tooth Body (Molar shape with roots)
      ctx.save();
      ctx.beginPath();
      const hw = tw * 0.5;
      const hh = th * 0.5;
      ctx.moveTo(-hw * 0.8, -hh);
      ctx.bezierCurveTo(-hw * 0.4, -hh * 1.15, 0, -hh * 0.9, 0, -hh * 0.9);
      ctx.bezierCurveTo(0, -hh * 0.9, hw * 0.4, -hh * 1.15, hw * 0.8, -hh);
      ctx.bezierCurveTo(hw * 1.05, -hh * 0.4, hw * 0.95, hh * 0.3, hw * 0.65, hh);
      ctx.bezierCurveTo(hw * 0.45, hh * 1.05, hw * 0.2, hh * 0.5, 0, hh * 0.4);
      ctx.bezierCurveTo(-hw * 0.2, hh * 0.5, -hw * 0.45, hh * 1.05, -hw * 0.65, hh);
      ctx.bezierCurveTo(-hw * 0.95, hh * 0.3, -hw * 1.05, -hh * 0.4, -hw * 0.8, -hh);
      ctx.closePath();

      if (isPearly) {
        const pearlyGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
        pearlyGrad.addColorStop(0, '#ffffff');
        pearlyGrad.addColorStop(0.5, '#f0f9ff');
        pearlyGrad.addColorStop(1, '#bae6fd');
        ctx.fillStyle = pearlyGrad;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
      } else {
        const dirtyRatio = Math.max(0, 1 - (tooth.cleanPct / 100));
        const stainGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
        if (dirtyRatio > 0.5) {
          stainGrad.addColorStop(0, '#fef3c7');
          stainGrad.addColorStop(0.6, '#fde68a');
          stainGrad.addColorStop(1, '#d97706');
        } else {
          stainGrad.addColorStop(0, '#ffffff');
          stainGrad.addColorStop(0.7, '#fef9c3');
          stainGrad.addColorStop(1, '#fde047');
        }
        ctx.fillStyle = stainGrad;
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.strokeStyle = isPearly ? '#38bdf8' : '#d97706';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();

      // Enamel Specular Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.ellipse(-tw * 0.22, -th * 0.28, tw * 0.16, th * 0.12, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Expressive Cartoon Eyes
      const eyeY = -th * 0.15;
      const eyeDist = tw * 0.22;
      if (isCheering) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-eyeDist, eyeY, 4.5, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(eyeDist, eyeY, 4.5, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(-eyeDist, eyeY, 3.2, 0, Math.PI * 2);
        ctx.arc(eyeDist, eyeY, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-eyeDist - 1, eyeY - 1, 1.2, 0, Math.PI * 2);
        ctx.arc(eyeDist - 1, eyeY - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rosy Cheeks
      ctx.fillStyle = 'rgba(244, 114, 182, 0.65)';
      ctx.beginPath();
      ctx.arc(-eyeDist - 4, eyeY + 6, 2.8, 0, Math.PI * 2);
      ctx.arc(eyeDist + 4, eyeY + 6, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Smiling Mouth
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      if (isCheering) {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, eyeY + 5, 5, 0.1, Math.PI - 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, eyeY + 4, 4, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }

      // Helmet / Crown Headgear
      if (tooth.isCaptain) {
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-tw * 0.4, -th * 0.45);
        ctx.lineTo(-tw * 0.35, -th * 0.75);
        ctx.lineTo(-tw * 0.15, -th * 0.55);
        ctx.lineTo(0, -th * 0.85);
        ctx.lineTo(tw * 0.15, -th * 0.55);
        ctx.lineTo(tw * 0.35, -th * 0.75);
        ctx.lineTo(tw * 0.4, -th * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -th * 0.55, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const qColor = tooth.id === 'q1' ? '#38bdf8' : tooth.id === 'q2' ? '#a78bfa' : tooth.id === 'q3' ? '#fbbf24' : '#34d399';
        ctx.strokeStyle = qColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -th * 0.2, tw * 0.48, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.fillStyle = qColor;
        ctx.beginPath();
        ctx.arc(0, -th * 0.48, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bubble Shield (Raised on threat, sparks on impact)
      const shieldRaised = tooth.shieldRaised || this.isDeflectActive;
      const shieldWobble = Math.sin(this.clock * 20) * (tooth.shieldWobble || 0) * 6;
      const shieldX = shieldRaised ? 0 : tw * 0.45;
      const shieldY = shieldRaised ? -th * 0.15 + shieldWobble : th * 0.1 + shieldWobble;
      const weaponDefBoost = Math.min(1.45, Math.max(1.0, this.weaponMultiplier || 1.0));
      const shieldR = (shieldRaised ? tw * 0.95 : tw * 0.55) * weaponDefBoost;

      ctx.save();
      ctx.translate(shieldX, shieldY);

      const shieldGrad = ctx.createRadialGradient(-shieldR * 0.2, -shieldR * 0.2, 2, 0, 0, shieldR);
      if (shieldRaised) {
        shieldGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        shieldGrad.addColorStop(0.4, 'rgba(52, 211, 153, 0.45)');
        shieldGrad.addColorStop(0.85, 'rgba(34, 211, 238, 0.35)');
        shieldGrad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
        ctx.lineWidth = 2.8;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 12;
      } else {
        shieldGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        shieldGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.25)');
        shieldGrad.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = shieldGrad;
      ctx.beginPath();
      ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, shieldR * 0.8, -Math.PI * 0.7, -Math.PI * 0.2);
      ctx.stroke();

      ctx.fillStyle = shieldRaised ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
      ctx.font = `bold ${Math.round(shieldR * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', 0, 0);

      ctx.restore();

      // Weapon Wielded by Captain & Integrated Weapon Title Badge
      if (this.equippedWeapon && (tooth.isCaptain || tooth.id === 'q5')) {
        const fullTitle = this.equippedWeapon?.title || 'Laser Toothbrush Saber';
        const wepLower = fullTitle.toLowerCase();
        const wepIcon = this.equippedWeapon?.icon || (wepLower.includes('sonic') ? '🔊' : wepLower.includes('wand') ? '⭐' : '⚔️');

        ctx.save();
        ctx.translate(-tw * 0.48, th * 0.05);
        if (tooth.fireFlash > 0) {
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 18;
        }
        ctx.font = `${Math.round(tw * 0.65)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wepIcon, 0, 0);
        ctx.restore();

        // Integrated Weapon Title & Synergy Boost Banner above Captain
        ctx.save();
        ctx.translate(0, -th * 0.88);
        const boostVal = Math.round(((this.weaponMultiplier || 1.0) - 1.0) * 100);
        const badgeText = boostVal > 0 ? `${wepIcon} ${fullTitle} (+${boostVal}%)` : `${wepIcon} ${fullTitle}`;
        ctx.font = 'bold 9px sans-serif';
        const tWidth = ctx.measureText(badgeText).width + 14;
        const tHeight = 15;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-tWidth * 0.5, -tHeight * 0.5, tWidth, tHeight, 7);
        } else {
          ctx.rect(-tWidth * 0.5, -tHeight * 0.5, tWidth, tHeight);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(badgeText, 0, 0);
        ctx.restore();
      }

      // Zone Label Pill
      ctx.save();
      ctx.translate(0, th * 0.65);
      const pillW = tw * 1.35;
      const pillH = 15;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = isPearly ? '#34d399' : '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-pillW * 0.5, -pillH * 0.5, pillW, pillH, 8);
      } else {
        ctx.rect(-pillW * 0.5, -pillH * 0.5, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isPearly ? '#34d399' : '#f1f5f9';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${tooth.label} ${tooth.cleanPct}%`, 0, 0);
      ctx.restore();

      ctx.restore();
    });
  }

  /**
   * Spawn Cheer Stars when Tooth Hits 100%
   */
  spawnWarriorCheerParticles(tooth) {
    const tx = tooth.xRatio * this.width;
    const ty = tooth.yRatio * this.height - 20;
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.0;
      this.warriorCheerParticles.push({
        x: tx,
        y: ty,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        color: ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#ffffff'][i % 5],
        size: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 4,
        alpha: 1.0,
        life: 1.5
      });
    }
  }

  /**
   * Spawn Shield Spark Flares on Impact
   */
  spawnShieldSparks(x, y, color = '#34d399') {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 5.0;
      this.sparkles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: color,
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        life: 0.8
      });
    }
  }

  /**
   * Themed Particle Impacts (Fudge splatters, Crumbs, Foam spray, Candy tablets, Gummy bounce)
   */
  spawnThemedHazardImpact(haz, x, y) {
    const hazId = haz?.id || 'cookies';
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.0;
      let color = '#fbbf24';
      let type = 'crumb';
      let size = 5 + Math.random() * 5;
      let bounce = 0.5;

      if (hazId === 'lava_cake') {
        color = ['#451a03', '#78350f', '#92400e', '#b45309'][i % 4];
        type = 'fudge';
        size = 6 + Math.random() * 6;
      } else if (hazId === 'cookies') {
        color = ['#d97706', '#b45309', '#92400e', '#451a03'][i % 4];
        type = 'crumb';
        size = 4 + Math.random() * 5;
      } else if (hazId === 'soda') {
        color = ['#ef4444', '#f87171', '#60a5fa', '#ffffff'][i % 4];
        type = 'foam_bubble';
        size = 5 + Math.random() * 7;
      } else if (hazId === 'smarties') {
        color = ['#f472b6', '#38bdf8', '#facc15', '#a78bfa', '#34d399'][i % 5];
        type = 'tablet';
        size = 6 + Math.random() * 4;
      } else if (hazId === 'gummy_bears') {
        color = ['#ec4899', '#10b981', '#f59e0b', '#8b5cf6'][i % 4];
        type = 'gummy';
        size = 7 + Math.random() * 5;
        bounce = 0.75;
      } else if (hazId === 'mint_icecream') {
        color = ['#6ee7b7', '#059669', '#a7f3d0', '#3b2014'][i % 4];
        type = 'mint_drop';
        size = 5 + Math.random() * 5;
      } else if (hazId === 'lollipops') {
        color = ['#f43f5e', '#facc15', '#38bdf8', '#fb7185'][i % 4];
        type = 'candy_shard';
        size = 6 + Math.random() * 5;
      }

      this.hazardImpactParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.0,
        gravity: type === 'foam_bubble' ? -0.05 : 0.18,
        bounce: bounce,
        color: color,
        type: type,
        size: size,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 6,
        alpha: 1.0,
        life: 1.2
      });
    }
  }

  /**
   * Render Themed Hazard Impact Particles
   */
  renderHazardImpactParticles(ctx, dt) {
    for (let i = this.hazardImpactParticles.length - 1; i >= 0; i--) {
      const p = this.hazardImpactParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.vRot * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / 1.2);

      if (p.y > this.height * 0.95) {
        p.y = this.height * 0.95;
        p.vy = -Math.abs(p.vy) * (p.bounce || 0.4);
      }

      if (p.life <= 0) {
        this.hazardImpactParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;

      if (p.type === 'tablet') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (p.type === 'foam_bubble') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'gummy') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, p.size * 0.2, p.size * 0.4, p.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Crumb / fudge / shard
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.8, -p.size * 0.6);
        ctx.lineTo(p.size * 0.7, -p.size * 0.4);
        ctx.lineTo(p.size * 0.5, p.size * 0.7);
        ctx.lineTo(-p.size * 0.6, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Render Cheering Stars for Warrior Teeth Army
   */
  renderWarriorCheerParticles(ctx, dt) {
    for (let i = this.warriorCheerParticles.length - 1; i >= 0; i--) {
      const p = this.warriorCheerParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rot += p.vRot * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / 1.5);

      if (p.life <= 0) {
        this.warriorCheerParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;

      // 5-point star
      const spikes = 5;
      const outer = p.size;
      const inner = p.size * 0.45;
      ctx.beginPath();
      for (let s = 0; s < spikes * 2; s++) {
        const r = (s % 2 === 0) ? outer : inner;
        const a = (s * Math.PI) / spikes;
        const sx = Math.cos(a) * r;
        const sy = Math.sin(a) * r;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  renderProceduralHazardItem(ctx, hazardId, drawRadius, defaultColor) {
    switch (hazardId) {
      case 'cookies': {
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#451a03';
        const chips = [
          { x: -0.3, y: -0.3, r: 0.22 },
          { x: 0.35, y: -0.25, r: 0.2 },
          { x: -0.1, y: 0.2, r: 0.25 },
          { x: 0.4, y: 0.3, r: 0.18 },
          { x: -0.4, y: 0.15, r: 0.16 }
        ];
        chips.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.x * drawRadius, c.y * drawRadius, c.r * drawRadius, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      case 'lava_cake': {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 0.4, drawRadius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'mint_icecream': {
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(-drawRadius * 0.6, 0);
        ctx.lineTo(drawRadius * 0.6, 0);
        ctx.lineTo(0, drawRadius);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6ee7b7';
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 0.35, drawRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#3b2014';
        ctx.fillRect(-drawRadius * 0.25, -drawRadius * 0.4, drawRadius * 0.15, drawRadius * 0.15);
        ctx.fillRect(drawRadius * 0.15, -drawRadius * 0.2, drawRadius * 0.12, drawRadius * 0.12);
        ctx.fillRect(-drawRadius * 0.05, -drawRadius * 0.6, drawRadius * 0.14, drawRadius * 0.14);
        break;
      }
      case 'soda': {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-drawRadius * 0.6, -drawRadius * 0.9, drawRadius * 1.2, drawRadius * 1.8, 6);
        } else {
          ctx.rect(-drawRadius * 0.6, -drawRadius * 0.9, drawRadius * 1.2, drawRadius * 1.8);
        }
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(0, -drawRadius * 0.85, drawRadius * 0.55, drawRadius * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 1.1, drawRadius * 0.2, 0, Math.PI * 2);
        ctx.arc(drawRadius * 0.3, -drawRadius * 1.25, drawRadius * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'smarties': {
        const colors = ['#f472b6', '#38bdf8', '#facc15'];
        colors.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, (i - 1) * drawRadius * 0.45, drawRadius * 0.85, drawRadius * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
        break;
      }
      case 'gummy_bears': {
        ctx.fillStyle = defaultColor || '#ec4899';
        ctx.beginPath();
        ctx.arc(-drawRadius * 0.45, -drawRadius * 0.55, drawRadius * 0.3, 0, Math.PI * 2);
        ctx.arc(drawRadius * 0.45, -drawRadius * 0.55, drawRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 0.2, drawRadius * 0.55, 0, Math.PI * 2);
        ctx.arc(0, drawRadius * 0.35, drawRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, drawRadius * 0.3, drawRadius * 0.35, drawRadius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'lollipops': {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-drawRadius * 0.1, 0, drawRadius * 0.2, drawRadius * 1.2);
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 0.1, drawRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 0.1, drawRadius * 0.45, 0, Math.PI);
        ctx.stroke();
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -drawRadius * 0.1, drawRadius * 0.25, Math.PI, Math.PI * 2);
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = defaultColor || '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.5;
        ctx.stroke();
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
      const caf = (typeof cancelAnimationFrame !== 'undefined') ? cancelAnimationFrame : clearTimeout;
      caf(this.animId);
      this.animId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (this.splineApp && typeof this.splineApp.dispose === 'function') {
      try { this.splineApp.dispose(); } catch (e) {}
      this.splineApp = null;
    }
    this.resetBattleState();
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
  }
}

export const hanaBattle3DService = new HanaBattle3DService();
export { HanaBattle3DService };
