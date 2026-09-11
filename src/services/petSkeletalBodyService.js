// Pet Companion Full-Body Skeletal Rig & Gear Studio Physics Engine
// Provides real-time procedural bone-and-mesh deformation for all 5 companion pets
// (Rex the Dino, Aqua Drake, Bella Bunny, Barnaby Bear, Pip Phoenix).
// Features dynamic multi-joint spring cloth cape simulation, rigid gear sockets,
// 6 heroic runway poses, elemental particle aura emitters, and real-time color dye tinting.

import { Sound } from '../audio/sfx.js';
import { getPetFaceProfile } from './petSkeletalFaceService.js';
import { getGearItem, COLOR_DYES } from '../data/petGearStudioData.js';

export const RUNWAY_POSES = {
  IDLE: 'idle',
  RUNWAY_WALK: 'runway_walk',
  HERO_LANDING: 'hero_landing',
  WING_FLARE: 'wing_flare',
  SPIN_360: 'spin_360',
  HERO_SALUTE: 'hero_salute'
};

export class PetSkeletalBodyCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.petId = options.petId || 'rex';
    this.profile = getPetFaceProfile(this.petId);
    this.width = canvasElement.width || 320;
    this.height = canvasElement.height || 320;

    // Equipped Gear Items & Custom Color Dyes
    this.equippedGear = {
      head: options.equippedGear?.head || 'crown_golden_horn',
      back: options.equippedGear?.back || 'cape_classic',
      chest: options.equippedGear?.chest || 'collar_titan',
      feet: options.equippedGear?.feet || 'boots_speed_neon'
    };

    this.gearColors = {
      head: options.gearColors?.head || '#f59e0b',
      back: options.gearColors?.back || '#ef4444',
      chest: options.gearColors?.chest || '#475569',
      feet: options.gearColors?.feet || '#10b981'
    };

    // Full-Body Procedural Bone Hierarchy
    this.bones = {
      root: { x: this.width / 2, y: this.height * 0.58, scale: 1.0, rotation: 0 },
      pelvis: { x: 0, y: 0, rotation: 0 },
      spine: [
        { x: 0, y: -18, rotation: 0 }, // Lower torso
        { x: 0, y: -36, rotation: 0 }, // Mid torso
        { x: 0, y: -54, rotation: 0 }  // Chest
      ],
      neck: { x: 0, y: -68, rotation: 0 },
      head: { x: 0, y: -88, rotation: 0, scale: 1.0 },
      jaw: { open: 0, shape: 'neutral' },
      eyelids: { blink: 0, squint: 0 },
      limbs: {
        frontLeft: { hip: { angle: 0 }, knee: { angle: 0 }, foot: { x: -24, y: 0 } },
        frontRight: { hip: { angle: 0 }, knee: { angle: 0 }, foot: { x: 24, y: 0 } },
        backLeft: { hip: { angle: 0 }, knee: { angle: 0 }, foot: { x: -32, y: 15 } },
        backRight: { hip: { angle: 0 }, knee: { angle: 0 }, foot: { x: 32, y: 15 } }
      },
      tail: [
        { x: 0, y: 5, angle: 0 },
        { x: 0, y: 18, angle: 0 },
        { x: 0, y: 32, angle: 0 },
        { x: 0, y: 46, angle: 0 }
      ]
    };

    // Verlet Spring Cloth Simulation for Fluttering Cape (5 Nodes)
    this.capeCloth = [];
    this.initCapeCloth();

    // Wind Machine Settings
    this.wind = { x: -1.5, y: -0.3, targetX: -1.5, targetY: -0.3, power: 1.0 };

    // Active Pose & Locomotion Animation
    this.currentPose = options.pose || RUNWAY_POSES.IDLE;
    this.poseTime = 0;
    this.walkCycle = 0;
    this.spinAngle = 0;

    // Elemental Aura & Ground Dust Particles
    this.particles = [];
    this.shockwaves = [];

    // Animation Loop
    this.isRunning = true;
    this.rafId = null;
    this.lastTimestamp = performance.now();
    this.loop = this.loop.bind(this);

    this.start();
  }

  initCapeCloth() {
    this.capeCloth = [];
    const nodeCount = 6;
    const startY = -50;
    for (let i = 0; i < nodeCount; i++) {
      this.capeCloth.push({
        x: (this.width / 2) + (i * 4),
        y: (this.height * 0.58) + startY + (i * 14),
        oldX: (this.width / 2) + (i * 4),
        oldY: (this.height * 0.58) + startY + (i * 14),
        pinned: i === 0 // Top node pinned to chest bone
      });
    }
  }

  start() {
    this.isRunning = true;
    if (typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.stop();
    this.particles = [];
    this.shockwaves = [];
  }

  setPet(petId) {
    this.petId = petId;
    this.profile = getPetFaceProfile(petId);
  }

  setPose(poseName) {
    this.currentPose = poseName;
    this.poseTime = 0;
    this.spinAngle = 0;

    if (poseName === RUNWAY_POSES.HERO_LANDING) {
      this.triggerHeroLandingFX();
    } else if (poseName === RUNWAY_POSES.WING_FLARE) {
      this.triggerWingFlareFX();
    } else if (poseName === RUNWAY_POSES.SPIN_360) {
      if (typeof Sound.capeWhoosh === 'function') Sound.capeWhoosh();
    } else if (poseName === RUNWAY_POSES.HERO_SALUTE) {
      if (typeof Sound.fanfare === 'function') Sound.fanfare();
    }
  }

  setWind(power, directionX = -2.0) {
    this.wind.power = power;
    this.wind.targetX = directionX * power;
    this.wind.targetY = -0.5 * power;
  }

  setGear(socket, gearId) {
    this.equippedGear[socket] = gearId;
    if (typeof Sound.gearSnap === 'function') {
      Sound.gearSnap();
    }
  }

  setGearColor(socket, colorHex) {
    this.gearColors[socket] = colorHex;
  }

  triggerHeroLandingFX() {
    if (typeof Sound.stompHeavy === 'function') Sound.stompHeavy();
    if (typeof Sound.capeWhoosh === 'function') Sound.capeWhoosh();

    // Spawn ground dust shockwaves
    const rootX = this.bones.root.x;
    const groundY = this.bones.root.y + 20;

    this.shockwaves.push({
      x: rootX,
      y: groundY,
      radius: 5,
      maxRadius: 75,
      alpha: 1.0,
      color: '#f59e0b'
    });

    // Dust particles
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 1.5;
      this.particles.push({
        x: rootX,
        y: groundY,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.4 - 1.5,
        size: Math.random() * 6 + 4,
        alpha: 1.0,
        color: '#d1d5db',
        char: '💨'
      });
    }
  }

  triggerWingFlareFX() {
    if (typeof Sound.feverHorn === 'function') Sound.feverHorn();
    const rootX = this.bones.root.x;
    const chestY = this.bones.root.y - 45;

    // Burst of glowing hero stars and sparks
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      this.particles.push({
        x: rootX,
        y: chestY,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 1,
        size: Math.random() * 10 + 8,
        alpha: 1.0,
        color: '#fbbf24',
        char: ['✨', '⭐', '🔥', '⚡'][Math.floor(Math.random() * 4)]
      });
    }
  }

  // -------------------------------------------------------------------------
  // KINEMATICS & CLOTH SIMULATION UPDATE
  // -------------------------------------------------------------------------

  update(dt) {
    this.poseTime += dt;

    // Smooth wind transition
    this.wind.x += (this.wind.targetX - this.wind.x) * 0.1;
    this.wind.y += (this.wind.targetY - this.wind.y) * 0.1;

    // Natural Eyelid Blink Cycle
    const blinkCycle = (this.poseTime * 0.75) % 4.5;
    this.bones.eyelids.blink = (blinkCycle > 4.25) ? 1 : 0;

    // Pose Specific Kinematics
    this.updatePoseKinematics(dt);

    // Verlet Cape Cloth Physics
    this.updateCapeCloth(dt);

    // Update Particle Systems
    this.updateParticles(dt);
  }

  updatePoseKinematics(dt) {
    const t = this.poseTime;

    switch (this.currentPose) {
      case RUNWAY_POSES.RUNWAY_WALK: {
        this.walkCycle += dt * 4.5;
        const bob = Math.abs(Math.sin(this.walkCycle)) * 10;
        this.bones.root.y = (this.height * 0.58) - bob;

        // Alternating limb swing
        this.bones.limbs.frontLeft.hip.angle = Math.sin(this.walkCycle) * 0.65;
        this.bones.limbs.frontRight.hip.angle = -Math.sin(this.walkCycle) * 0.65;
        this.bones.limbs.backLeft.hip.angle = -Math.sin(this.walkCycle) * 0.55;
        this.bones.limbs.backRight.hip.angle = Math.sin(this.walkCycle) * 0.55;

        // Tail counter-balance
        this.bones.tail[0].angle = Math.cos(this.walkCycle) * 0.4;
        this.bones.tail[1].angle = Math.cos(this.walkCycle - 0.5) * 0.5;
        this.bones.tail[2].angle = Math.cos(this.walkCycle - 1.0) * 0.6;
        break;
      }

      case RUNWAY_POSES.HERO_LANDING: {
        // Deep superhero crouch
        this.bones.root.y = (this.height * 0.58) + 16;
        this.bones.spine[0].rotation = 0.35;
        this.bones.spine[1].rotation = 0.45;
        this.bones.neck.rotation = -0.3; // head looks up proudly
        this.bones.head.rotation = -0.2;

        // Wide stance
        this.bones.limbs.frontLeft.hip.angle = -0.7;
        this.bones.limbs.frontRight.hip.angle = 0.85;
        this.bones.limbs.backLeft.hip.angle = -0.9;
        this.bones.limbs.backRight.hip.angle = 0.9;
        break;
      }

      case RUNWAY_POSES.WING_FLARE: {
        // Standing tall, arched back, chest puffed
        this.bones.root.y = (this.height * 0.58) - 12;
        this.bones.spine[0].rotation = -0.15;
        this.bones.spine[1].rotation = -0.2;
        this.bones.neck.rotation = -0.1;
        this.bones.head.rotation = 0.05;

        // Spread limbs wide
        this.bones.limbs.frontLeft.hip.angle = -0.95;
        this.bones.limbs.frontRight.hip.angle = 0.95;
        this.bones.limbs.backLeft.hip.angle = -0.3;
        this.bones.limbs.backRight.hip.angle = 0.3;

        // Tail upright flare
        this.bones.tail[0].angle = -0.6;
        this.bones.tail[1].angle = -0.8;
        this.bones.tail[2].angle = -1.0;
        break;
      }

      case RUNWAY_POSES.SPIN_360: {
        // Continuous horizontal rotation
        this.spinAngle += dt * 7.5;
        this.bones.root.rotation = Math.sin(this.spinAngle) * 0.2;
        this.bones.root.scale = 0.85 + Math.abs(Math.cos(this.spinAngle)) * 0.25;

        // Floating jump
        this.bones.root.y = (this.height * 0.58) - 25 - Math.abs(Math.sin(this.spinAngle)) * 15;
        break;
      }

      case RUNWAY_POSES.HERO_SALUTE: {
        // Proud upright posture, right paw raised
        this.bones.root.y = (this.height * 0.58) - 5;
        this.bones.spine[0].rotation = -0.05;
        this.bones.neck.rotation = 0.05;
        this.bones.limbs.frontLeft.hip.angle = 0.1;
        this.bones.limbs.frontRight.hip.angle = -1.2; // Right arm up in salute
        this.bones.tail[0].angle = 0.35 * Math.sin(t * 5);
        this.bones.tail[1].angle = 0.45 * Math.sin(t * 5 - 0.5);
        break;
      }

      case RUNWAY_POSES.IDLE:
      default: {
        // Subtle rhythmic breathing & tail wag
        const breath = Math.sin(t * 2.8) * 3;
        this.bones.root.y = (this.height * 0.58) + breath;
        this.bones.spine[0].rotation = Math.sin(t * 2.8) * 0.04;
        this.bones.limbs.frontLeft.hip.angle = Math.sin(t * 2.8) * 0.05;
        this.bones.limbs.frontRight.hip.angle = -Math.sin(t * 2.8) * 0.05;

        // Tail wagging
        this.bones.tail[0].angle = Math.sin(t * 3.5) * 0.25;
        this.bones.tail[1].angle = Math.sin(t * 3.5 - 0.4) * 0.35;
        this.bones.tail[2].angle = Math.sin(t * 3.5 - 0.8) * 0.45;
        this.bones.tail[3].angle = Math.sin(t * 3.5 - 1.2) * 0.55;
        break;
      }
    }
  }

  updateCapeCloth(dt) {
    if (!this.capeCloth || this.capeCloth.length === 0) return;

    // Anchor node 0 to chest socket position
    const anchorX = this.bones.root.x - 12;
    const anchorY = this.bones.root.y - 50;
    this.capeCloth[0].x = anchorX;
    this.capeCloth[0].y = anchorY;

    const gravity = 0.45;
    const windGustX = this.wind.x * (1.0 + Math.sin(this.poseTime * 6) * 0.4);
    const windGustY = this.wind.y + Math.cos(this.poseTime * 4) * 0.3;

    // Verlet integration for remaining nodes
    for (let i = 1; i < this.capeCloth.length; i++) {
      const p = this.capeCloth[i];
      const vx = (p.x - p.oldX) * 0.92;
      const vy = (p.y - p.oldY) * 0.92;

      p.oldX = p.x;
      p.oldY = p.y;

      p.x += vx + windGustX;
      p.y += vy + gravity + windGustY;
    }

    // Distance constraint relaxation (5 iterations)
    const targetDist = 18;
    for (let iter = 0; iter < 5; iter++) {
      for (let i = 0; i < this.capeCloth.length - 1; i++) {
        const p1 = this.capeCloth[i];
        const p2 = this.capeCloth[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const diff = (dist - targetDist) / dist;

        if (!p1.pinned) {
          p1.x += dx * 0.5 * diff;
          p1.y += dy * 0.5 * diff;
        }
        if (!p2.pinned) {
          p2.x -= dx * 0.5 * diff;
          p2.y -= dy * 0.5 * diff;
        }
      }
    }
  }

  updateParticles(dt) {
    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += dt * 90;
      sw.alpha -= dt * 1.6;
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= dt * 1.2;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Ambient Elemental Aura Particle Generation based on equipped gear
    const backItem = getGearItem('back', this.equippedGear.back);
    const headItem = getGearItem('head', this.equippedGear.head);
    const chestItem = getGearItem('chest', this.equippedGear.chest);
    const feetItem = getGearItem('feet', this.equippedGear.feet);
    
    const activeAura = (backItem?.aura && backItem.aura !== 'none') ? backItem.aura
      : (headItem?.aura && headItem.aura !== 'none') ? headItem.aura
      : (chestItem?.aura && chestItem.aura !== 'none') ? chestItem.aura
      : (feetItem?.aura && feetItem.aura !== 'none') ? feetItem.aura
      : 'none';

    if (activeAura !== 'none' && Math.random() < 0.4) {
      const rootX = this.bones.root.x;
      const rootY = this.bones.root.y - 35;
      let auraColor = '#fbbf24';
      let auraChar = '✨';

      if (activeAura === 'fire') {
        auraColor = '#f97316';
        auraChar = '🔥';
      } else if (activeAura === 'electric') {
        auraColor = '#06b6d4';
        auraChar = '⚡';
      } else if (activeAura === 'cosmic') {
        auraColor = '#8b5cf6';
        auraChar = '🌟';
      } else if (activeAura === 'wind') {
        auraColor = '#38bdf8';
        auraChar = '💨';
      } else if (activeAura === 'stardust') {
        auraColor = '#facc15';
        auraChar = '✨';
      }

      this.particles.push({
        x: rootX + (Math.random() - 0.5) * 44,
        y: rootY + (Math.random() - 0.5) * 36,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -Math.random() * 2.2 - 0.6,
        size: Math.random() * 8 + 8,
        alpha: 0.9,
        color: auraColor,
        char: auraChar
      });
    }
  }

  // -------------------------------------------------------------------------
  // CANVAS RENDERING
  // -------------------------------------------------------------------------

  loop(timestamp) {
    if (!this.isRunning) return;
    const dt = Math.min(0.032, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    if (this.isRunning && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Runway Floor Shockwaves & Pedestal
    this.renderFloorPedestal(ctx);

    ctx.save();
    ctx.translate(this.bones.root.x, this.bones.root.y);
    ctx.scale(this.bones.root.scale, this.bones.root.scale);
    ctx.rotate(this.bones.root.rotation);

    // 2. Render Cape (Back Layer)
    this.renderCape(ctx);

    // 3. Render Tail
    this.renderTail(ctx);

    // 4. Render Hind Limbs
    this.renderHindLimbs(ctx);

    // 5. Render Torso & Chest Armor
    this.renderTorsoAndChest(ctx);

    // 6. Render Fore Limbs & Boots
    this.renderForeLimbs(ctx);

    // 7. Render Head & Headgear Socket
    this.renderHeadAndHeadgear(ctx);

    ctx.restore();

    // 8. Render Floating Aura & Shockwave Particles
    this.renderParticles(ctx);
  }

  renderFloorPedestal(ctx) {
    const cx = this.width / 2;
    const cy = this.height * 0.86;

    // Glowing Neon Runway Oval Pedestal
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 95);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.45)');
    grad.addColorStop(0.6, 'rgba(16, 185, 129, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 95, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Floor Runway Border Ring
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Render Shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderCape(ctx) {
    if (!this.equippedGear.back) return;
    const backItem = getGearItem('back', this.equippedGear.back);
    const archetype = backItem?.meshArchetype || this.equippedGear.back;
    const backColor = this.gearColors.back || backItem?.defaultColor || '#ef4444';
    const accentColor = backItem?.secondaryColor || '#fbbf24';

    // Rigid Back Gear: Aero Glider Wings
    if (archetype === 'wings' || archetype === 'wings_meteor' || (backItem && backItem.id === 'wings_meteor')) {
      this.renderAeroWings(ctx, backColor, accentColor);
      return;
    }

    // Rigid Back Gear: Turbo Jetpack Boosters
    if (archetype === 'jetpack' || archetype === 'jetpack_boosters' || (backItem && backItem.id === 'jetpack_boosters')) {
      this.renderTurboJetpack(ctx, backColor, accentColor);
      return;
    }

    // Cloth Physics Cape & Star Cloak
    if (!this.capeCloth || this.capeCloth.length < 2) return;

    ctx.save();
    // Transform back to canvas absolute space for cloth points
    ctx.restore();
    ctx.save();

    const capeColor = backColor;

    ctx.beginPath();
    ctx.moveTo(this.capeCloth[0].x - 8, this.capeCloth[0].y);

    // Flowing left edge
    for (let i = 1; i < this.capeCloth.length; i++) {
      const p = this.capeCloth[i];
      const spread = i * 4.5;
      ctx.lineTo(p.x - spread, p.y);
    }

    // Bottom edge
    const last = this.capeCloth[this.capeCloth.length - 1];
    ctx.quadraticCurveTo(last.x, last.y + 10, last.x + 24, last.y);

    // Flowing right edge back up
    for (let i = this.capeCloth.length - 2; i >= 0; i--) {
      const p = this.capeCloth[i];
      const spread = i * 3.5;
      ctx.lineTo(p.x + spread + 8, p.y);
    }

    ctx.closePath();
    ctx.fillStyle = capeColor;
    ctx.fill();

    // Cape golden trim border
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
    ctx.save();
    ctx.translate(this.bones.root.x, this.bones.root.y);
    ctx.scale(this.bones.root.scale, this.bones.root.scale);
    ctx.rotate(this.bones.root.rotation);
  }

  renderAeroWings(ctx, wingColor, accentColor) {
    ctx.save();
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.translate(14, -36);
      ctx.rotate(Math.sin(this.poseTime * 3) * 0.08 - 0.2);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(28, -25, 52, -18);
      ctx.quadraticCurveTo(45, 8, 20, 14);
      ctx.quadraticCurveTo(8, 8, 0, 0);
      ctx.closePath();
      ctx.fillStyle = wingColor;
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(48, -14, 4, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  renderTurboJetpack(ctx, mainColor, accentColor) {
    ctx.save();
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 18, -36);

      ctx.fillStyle = mainColor;
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-7, -10, 14, 26, 4);
      } else {
        ctx.rect(-7, -10, 14, 26);
      }
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(0, -10, 6, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-5, 16);
      ctx.lineTo(5, 16);
      ctx.lineTo(7, 21);
      ctx.lineTo(-7, 21);
      ctx.closePath();
      ctx.fill();

      const flameH = 6 + Math.sin(this.poseTime * 15 + side) * 4;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-4, 21);
      ctx.lineTo(4, 21);
      ctx.lineTo(0, 21 + flameH);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  renderTail(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);

    let currX = 0;
    let currY = 0;

    for (let i = 0; i < this.bones.tail.length; i++) {
      const link = this.bones.tail[i];
      currX += Math.sin(link.angle) * 16;
      currY += Math.cos(link.angle) * 16;
      ctx.lineTo(currX, currY);
    }

    ctx.strokeStyle = this.profile.baseColor;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Tip crest spike
    ctx.beginPath();
    ctx.arc(currX, currY, 9, 0, Math.PI * 2);
    ctx.fillStyle = this.profile.crestColor;
    ctx.fill();

    ctx.restore();
  }

  renderHindLimbs(ctx) {
    const p = this.profile;
    const limb = this.bones.limbs;

    // Back Left Leg
    ctx.save();
    ctx.translate(-26, 8);
    ctx.rotate(limb.backLeft.hip.angle);
    ctx.fillStyle = p.baseColor;
    ctx.fillRect(-8, 0, 16, 26);
    ctx.restore();

    // Back Right Leg
    ctx.save();
    ctx.translate(26, 8);
    ctx.rotate(limb.backRight.hip.angle);
    ctx.fillStyle = p.baseColor;
    ctx.fillRect(-8, 0, 16, 26);
    ctx.restore();
  }

  renderTorsoAndChest(ctx) {
    const p = this.profile;

    ctx.save();
    // Torso rounded body
    ctx.fillStyle = p.baseColor;
    ctx.beginPath();
    ctx.ellipse(0, -32, 28, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly patch
    ctx.fillStyle = p.bellyColor;
    ctx.beginPath();
    ctx.ellipse(0, -28, 18, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render Equipped Chest Armor
    if (this.equippedGear.chest) {
      const chestItem = getGearItem('chest', this.equippedGear.chest);
      const archetype = chestItem?.meshArchetype || this.equippedGear.chest;
      const chestColor = this.gearColors.chest || chestItem?.defaultColor || '#475569';
      const accent = chestItem?.secondaryColor || '#fbbf24';

      if (archetype === 'collar' || archetype === 'collar_titan' || this.equippedGear.chest === 'collar_titan') {
        // Spiked / Studded heavy collar
        ctx.fillStyle = chestColor;
        ctx.beginPath();
        ctx.ellipse(0, -50, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Metallic spikes/studs
        ctx.fillStyle = accent;
        [-10, 0, 10].forEach(sx => {
          ctx.beginPath();
          ctx.arc(sx, -50, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (archetype === 'harness' || archetype === 'harness_power_gem' || this.equippedGear.chest === 'harness_power_gem') {
        // Crossed Energy Harness
        ctx.strokeStyle = chestColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-16, -52);
        ctx.lineTo(16, -32);
        ctx.moveTo(16, -52);
        ctx.lineTo(-16, -32);
        ctx.stroke();

        // Glowing center jewel
        ctx.fillStyle = accent || '#10b981';
        ctx.beginPath();
        ctx.arc(0, -42, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Golden Crest / Plate armor plate
        ctx.fillStyle = chestColor;
        ctx.beginPath();
        ctx.ellipse(0, -42, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Hero Crest Star in center
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(0, -42, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  renderForeLimbs(ctx) {
    const p = this.profile;
    const limb = this.bones.limbs;
    const feetItem = getGearItem('feet', this.equippedGear.feet);
    const archetype = feetItem?.meshArchetype || this.equippedGear.feet;
    const bootColor = this.gearColors.feet || feetItem?.defaultColor || '#10b981';
    const accent = feetItem?.secondaryColor || '#f59e0b';

    for (const [hipAngle, posX] of [
      [limb.frontLeft.hip.angle, -18],
      [limb.frontRight.hip.angle, 18]
    ]) {
      ctx.save();
      ctx.translate(posX, -25);
      ctx.rotate(hipAngle);
      ctx.fillStyle = p.baseColor;
      ctx.fillRect(-6, 0, 12, 32);

      // Foot gear socket
      if (this.equippedGear.feet) {
        if (archetype === 'bands_sparkle_ankle' || archetype === 'starlight_bands' || this.equippedGear.feet === 'bands_sparkle_ankle') {
          // Starlight Ankle Bands
          ctx.fillStyle = bootColor;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(-8, 20, 16, 8, 4);
          } else {
            ctx.rect(-8, 20, 16, 8);
          }
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Star stud
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 24, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (archetype === 'pads_lava_stomp' || archetype === 'lava_greaves' || this.equippedGear.feet === 'pads_lava_stomp') {
          // Molten Lava Greaves
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(-9, 19, 18, 16, 5);
          } else {
            ctx.rect(-9, 19, 18, 16);
          }
          ctx.fill();
          ctx.strokeStyle = bootColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Lava vein dot
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(0, 27, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Speed Boots / Neon Speed Boots
          ctx.fillStyle = bootColor;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(-8, 22, 16, 14, 5);
          } else {
            ctx.rect(-8, 22, 16, 14);
          }
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Side speed winglet
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.moveTo(posX < 0 ? -8 : 8, 24);
          ctx.lineTo(posX < 0 ? -12 : 12, 21);
          ctx.lineTo(posX < 0 ? -8 : 8, 28);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  renderHeadAndHeadgear(ctx) {
    const p = this.profile;
    ctx.save();
    ctx.translate(this.bones.head.x, this.bones.head.y);
    ctx.rotate(this.bones.head.rotation);

    // Main head ball
    const headRadius = 24;
    ctx.fillStyle = p.baseColor;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Snout / Beak
    if (p.hasSnout) {
      ctx.fillStyle = p.snoutColor;
      ctx.beginPath();
      ctx.ellipse(0, 6, headRadius * 0.65, headRadius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.hasBeak) {
      ctx.fillStyle = p.snoutColor;
      ctx.beginPath();
      ctx.moveTo(-headRadius * 0.35, 2);
      ctx.lineTo(0, headRadius * 0.65);
      ctx.lineTo(headRadius * 0.35, 2);
      ctx.closePath();
      ctx.fill();
    }

    // Big expressive eyes
    const eyeR = headRadius * 0.35;
    const eyeOffsetX = headRadius * 0.48;
    const eyeOffsetY = -headRadius * 0.15;

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * eyeOffsetX, eyeOffsetY);

      if (this.bones.eyelids.blink > 0.5) {
        // Blink line
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, eyeR * 0.8, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else {
        // Wide eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = p.eyeColor;
        ctx.beginPath();
        ctx.arc(0, 0, eyeR * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, eyeR * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-eyeR * 0.25, -eyeR * 0.25, eyeR * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Rosie cheeks
    ctx.fillStyle = '#f87171';
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(-headRadius * 0.6, 5, 4, 0, Math.PI * 2);
    ctx.arc(headRadius * 0.6, 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Render Equipped Headgear
    if (this.equippedGear.head) {
      const headItem = getGearItem('head', this.equippedGear.head);
      const archetype = headItem?.meshArchetype || this.equippedGear.head;
      const headColor = this.gearColors.head || headItem?.defaultColor || '#f59e0b';
      const accent = headItem?.secondaryColor || '#ffffff';

      if (archetype === 'crown' || archetype === 'crown_golden_horn' || this.equippedGear.head === 'crown_golden_horn') {
        // Regal golden horn crown
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.moveTo(-16, -headRadius);
        ctx.lineTo(-22, -headRadius - 16);
        ctx.lineTo(-8, -headRadius - 8);
        ctx.lineTo(0, -headRadius - 22);
        ctx.lineTo(8, -headRadius - 8);
        ctx.lineTo(22, -headRadius - 16);
        ctx.lineTo(16, -headRadius);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (archetype === 'cowl' || archetype === 'cowl_hero' || this.equippedGear.head === 'cowl_hero') {
        // Sleek hero cowl
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(0, -4, headRadius * 1.05, Math.PI, Math.PI * 2);
        ctx.lineTo(headRadius * 1.05, 4);
        ctx.lineTo(0, 10);
        ctx.lineTo(-headRadius * 1.05, 4);
        ctx.closePath();
        ctx.fill();
      } else if (archetype === 'goggles' || archetype === 'goggles_aviator' || this.equippedGear.head === 'goggles_aviator') {
        // Aviator steampunk goggles on brow
        ctx.strokeStyle = '#78350f'; // leather strap
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, -headRadius * 0.3, headRadius * 1.05, 0.9 * Math.PI, 0.1 * Math.PI, true);
        ctx.stroke();

        [-headRadius * 0.38, headRadius * 0.38].forEach(gx => {
          ctx.fillStyle = headColor; // brass rim
          ctx.beginPath();
          ctx.arc(gx, -headRadius * 0.45, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8'; // tinted glass
          ctx.beginPath();
          ctx.arc(gx, -headRadius * 0.45, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff'; // glass reflection
          ctx.beginPath();
          ctx.arc(gx - 2, -headRadius * 0.45 - 2, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (archetype === 'tiara' || archetype === 'tiara_phoenix' || this.equippedGear.head === 'tiara_phoenix') {
        // Phoenix fire crest tiara
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.moveTo(-18, -headRadius + 2);
        ctx.quadraticCurveTo(-10, -headRadius - 18, 0, -headRadius - 26);
        ctx.quadraticCurveTo(10, -headRadius - 18, 18, -headRadius + 2);
        ctx.quadraticCurveTo(0, -headRadius - 6, -18, -headRadius + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center ruby jewel
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(0, -headRadius - 10, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (archetype === 'visor' || archetype === 'visor_cyber_tech' || this.equippedGear.head === 'visor_cyber_tech') {
        // Cyber neon holographic HUD visor
        ctx.fillStyle = headColor;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(-headRadius * 0.85, -headRadius * 0.25, headRadius * 1.7, 10, 4);
        } else {
          ctx.rect(-headRadius * 0.85, -headRadius * 0.25, headRadius * 1.7, 10);
        }
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        // HUD digital scanline
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-headRadius * 0.5, -headRadius * 0.25 + 4, headRadius, 2);
      } else {
        // General Headgear Cap
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(0, -headRadius * 0.75, headRadius * 0.8, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.font = `${p.size}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillText(p.char, p.x, p.y);
      ctx.restore();
    }
  }
}
