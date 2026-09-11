// Boss 3D Interactive WebGL & Canvas Engine
// Renders dynamic 3D Boss Monsters (Sugar Bandit King, Plaque Kraken, Cavity Goblin)
// with real-time 3D perspective, lunges toward mirror quadrants, foam knockback recoil,
// shield barriers, dizzy stun spins, and defeat explosions.

import { Sound } from '../audio/sfx.js';
import confetti from 'canvas-confetti';

export function isWebGLSupported() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

export const BOSSES_3D_CATALOG = {
  sugar_bandit: {
    id: 'sugar_bandit',
    name: 'Sugar Bandit King',
    title: 'Sticky Caramel Mastermind',
    bodyColor: '#d97706',
    coreColor: '#f59e0b',
    crownColor: '#fbbf24',
    eyeColor: '#ef4444',
    slimeColor: '#b45309',
    auraColor: 'rgba(245, 158, 11, 0.45)',
    lungeSpeed: 1.2,
    attackName: 'CARAMEL SLIME LUNGE',
    quote: 'Sticky candy power will coat your enamel forever! Mwahaha!'
  },
  plaque_kraken: {
    id: 'plaque_kraken',
    name: 'Plaque Kraken',
    title: 'Deep Biofilm Terror',
    bodyColor: '#059669',
    coreColor: '#10b981',
    suctionColor: '#a7f3d0',
    eyeColor: '#facc15',
    slimeColor: '#047857',
    auraColor: 'rgba(16, 185, 129, 0.45)',
    lungeSpeed: 0.95,
    attackName: 'BIOFILM TENTACLE CRUSH',
    quote: 'Gurgle... your toothbrush cannot stop the sticky biofilm tide!'
  },
  cavity_goblin: {
    id: 'cavity_goblin',
    name: 'Cavity Goblin',
    title: 'Acid Drill Saboteur',
    bodyColor: '#7c3aed',
    coreColor: '#a855f7',
    drillColor: '#cbd5e1',
    eyeColor: '#f43f5e',
    slimeColor: '#581c87',
    auraColor: 'rgba(168, 85, 247, 0.45)',
    lungeSpeed: 1.35,
    attackName: 'ACID DRILL STRIKE',
    quote: 'Whirrr! My diamond-tip acid drill will crack your defenses!'
  }
};

export function getBoss3DProfile(bossId) {
  const norm = String(bossId || 'sugar_bandit').toLowerCase();
  if (norm.includes('kraken') || norm.includes('plaque')) return BOSSES_3D_CATALOG.plaque_kraken;
  if (norm.includes('goblin') || norm.includes('cavity')) return BOSSES_3D_CATALOG.cavity_goblin;
  return BOSSES_3D_CATALOG.sugar_bandit;
}

/**
 * Boss3DInteractiveCanvas
 * High-performance 3D canvas controller that renders real-time shaded 3D boss meshes,
 * forward lunges with projectile ejections, knockback recoil, and particles.
 */
export class Boss3DInteractiveCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.bossId = options.bossId || 'sugar_bandit';
    this.profile = getBoss3DProfile(this.bossId);
    this.width = canvasElement.width || 320;
    this.height = canvasElement.height || 320;

    // 3D Perspective & Transform State
    this.z = 0; // -120 (far knockback) to +140 (extreme close lunge)
    this.targetZ = 0;
    this.y = 0;
    this.targetY = 0;
    this.x = 0;
    this.targetX = 0;
    this.rotY = 0;
    this.rotX = 0;
    this.rotZ = 0;
    this.scale = 1.0;

    // Combat States
    this.state = 'idle'; // 'idle', 'lunge', 'knockback', 'dizzy', 'defeat'
    this.isLunging = false;
    this.lungeTimer = 0;
    this.targetQuadrant = 'q1';
    this.hurtFlash = 0;
    this.isDizzy = false;
    this.dizzyAngle = 0;
    this.dizzyTimer = 0;
    this.isShieldActive = false;
    this.shieldRotation = 0;
    this.shieldHp = 100;
    this.screenShake = 0;
    this.isDefeated = false;
    this.defeatProgress = 0;

    // Boss Animation Clock
    this.time = 0;
    this.tentaclePhase = 0;
    this.drillAngle = 0;

    // Particle Systems
    this.slimeProjectiles = [];
    this.foamHitParticles = [];
    this.dizzyStars = [];
    this.shieldShards = [];
    this.defeatBursts = [];

    // Safe RequestAnimationFrame loop
    this.rafId = null;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop = this.loop.bind(this);

    this.start();
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
    this.slimeProjectiles = [];
    this.foamHitParticles = [];
    this.dizzyStars = [];
    this.shieldShards = [];
    this.defeatBursts = [];
  }

  setBoss(bossId) {
    this.bossId = bossId;
    this.profile = getBoss3DProfile(bossId);
  }

  // -------------------------------------------------------------------------
  // COMBAT ACTIONS
  // -------------------------------------------------------------------------

  triggerLunge(quadrantId = 'q1') {
    if (this.isDefeated) return;
    this.state = 'lunge';
    this.isLunging = true;
    this.lungeTimer = 0;
    this.targetQuadrant = quadrantId;
    this.targetZ = 135; // Lunge forward into the child's perspective
    this.targetY = 15;
    this.screenShake = 12;

    // Play lunge roar/screech
    if (typeof Sound.bossLunge === 'function') {
      Sound.bossLunge();
    } else if (typeof Sound.whoosh === 'function') {
      Sound.whoosh();
    }

    // Launch 3D slime projectiles toward the targeted quadrant
    this.spawnSlimeProjectiles(quadrantId);
  }

  triggerKnockback(strength = 40) {
    if (this.isDefeated) return;
    this.isLunging = false;
    this.state = 'knockback';
    this.targetZ = Math.max(-110, this.z - strength);
    this.targetY = -10;
    this.hurtFlash = 1.0;
    this.screenShake = 6;

    // Spawn 12 frothy toothpaste foam hit particles
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    for (let i = 0; i < 12; i++) {
      this.foamHitParticles.push({
        x: centerX + (Math.random() - 0.5) * 60,
        y: centerY + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7 - 2,
        size: Math.random() * 12 + 6,
        life: 1.0,
        color: ['#ffffff', '#67e8f9', '#a5f3fc', '#e0f2fe'][Math.floor(Math.random() * 4)]
      });
    }

    if (typeof Sound.foamHit === 'function') {
      Sound.foamHit();
    } else if (typeof Sound.hit === 'function') {
      Sound.hit();
    }
  }

  triggerDizzy(durationMs = 2600) {
    if (this.isDefeated) return;
    this.isDizzy = true;
    this.state = 'dizzy';
    this.dizzyTimer = durationMs;
    this.targetZ = -40;

    // Spawn orbiting cartoon dizzy stars
    this.dizzyStars = [];
    const starChars = ['⭐', '💫', '✨', '⭐', '💫'];
    for (let i = 0; i < 5; i++) {
      this.dizzyStars.push({
        angle: (i / 5) * Math.PI * 2,
        radius: 65,
        speed: 0.08,
        char: starChars[i],
        yOff: (i % 2 === 0 ? -12 : 8)
      });
    }

    if (typeof Sound.dizzyStars === 'function') {
      Sound.dizzyStars();
    } else if (typeof Sound.chirp === 'function') {
      Sound.chirp();
    }
  }

  setShield(active) {
    if (this.isShieldActive && !active) {
      // Shield was broken! Shatter into crystalline shards
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      for (let i = 0; i < 22; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * 6 + 3;
        this.shieldShards.push({
          x: centerX + Math.cos(ang) * 55,
          y: centerY + Math.sin(ang) * 55,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 12 + 6,
          color: ['#38bdf8', '#818cf8', '#ffffff', '#c084fc'][Math.floor(Math.random() * 4)],
          life: 1.0
        });
      }

      if (typeof Sound.shieldShatter === 'function') {
        Sound.shieldShatter();
      } else if (typeof Sound.laser === 'function') {
        Sound.laser();
      }
    }

    this.isShieldActive = active;
  }

  triggerDefeat() {
    this.isDefeated = true;
    this.state = 'defeat';
    this.defeatProgress = 0;
    this.isShieldActive = false;
    this.isLunging = false;

    // Massive clean bubble and golden star explosion
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    for (let i = 0; i < 45; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 9 + 4;
      this.defeatBursts.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 3,
        size: Math.random() * 20 + 8,
        color: ['#fbbf24', '#ffffff', '#38bdf8', '#4ade80', '#f472b6'][Math.floor(Math.random() * 5)],
        char: ['✨', '⭐', '🦷', '🫧', '👑'][Math.floor(Math.random() * 5)],
        life: 1.0,
        maxLife: 1.0
      });
    }

    if (typeof confetti === 'function' && typeof document !== 'undefined' && document.body) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.5 },
          colors: ['#38bdf8', '#fbbf24', '#4ade80', '#ffffff']
        });
      } catch (e) {}
    }

    if (typeof Sound.fanfare === 'function') {
      Sound.fanfare();
    }
  }

  spawnSlimeProjectiles(quadrantId) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const targetMap = {
      q1: { x: this.width * 0.75, y: this.height * 0.25 },
      q2: { x: this.width * 0.25, y: this.height * 0.25 },
      q3: { x: this.width * 0.25, y: this.height * 0.75 },
      q4: { x: this.width * 0.75, y: this.height * 0.75 },
      q5: { x: this.width * 0.5, y: this.height * 0.5 }
    };
    const dest = targetMap[quadrantId] || targetMap.q1;

    for (let i = 0; i < 5; i++) {
      this.slimeProjectiles.push({
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 40,
        destX: dest.x + (Math.random() - 0.5) * 35,
        destY: dest.y + (Math.random() - 0.5) * 35,
        z: 0,
        progress: 0,
        speed: 0.035 + Math.random() * 0.015,
        size: Math.random() * 16 + 12,
        color: this.profile.slimeColor
      });
    }
  }

  // -------------------------------------------------------------------------
  // MAIN ANIMATION LOOP
  // -------------------------------------------------------------------------

  loop(timestamp) {
    if (!this.isRunning) return;
    const dt = Math.min(32, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.time += dt * 0.003;

    this.update(dt);
    this.render();

    if (this.isRunning && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  update(dt) {
    // 1. Z-depth spring interpolation
    this.z += (this.targetZ - this.z) * 0.12;
    this.y += (this.targetY - this.y) * 0.12;
    this.x += (this.targetX - this.x) * 0.12;

    // Reset idle spring back
    if (!this.isLunging && this.state !== 'dizzy' && !this.isDefeated) {
      this.targetZ += (0 - this.targetZ) * 0.06;
      this.targetY += (0 - this.targetY) * 0.06;
      this.targetX += (0 - this.targetX) * 0.06;
      if (Math.abs(this.targetZ) < 2) this.state = 'idle';
    }

    // 2. Lunge duration timer
    if (this.isLunging) {
      this.lungeTimer += dt;
      if (this.lungeTimer > 950) {
        this.isLunging = false;
        this.targetZ = -15; // spring back slightly
        if (typeof Sound.bossSplat === 'function') {
          Sound.bossSplat();
        }
      }
    }

    // 3. Dizzy timer
    if (this.isDizzy) {
      this.dizzyTimer -= dt;
      this.dizzyAngle += 0.12;
      this.rotZ = Math.sin(this.dizzyAngle) * 0.35;
      if (this.dizzyTimer <= 0) {
        this.isDizzy = false;
        this.rotZ = 0;
        this.dizzyStars = [];
        this.state = 'idle';
      }
    }

    // 4. Defeat sequence
    if (this.isDefeated) {
      this.defeatProgress += dt * 0.001;
      this.targetY -= 2;
      this.dizzyAngle += 0.25;
      this.rotY += 0.15;
    }

    // 5. Shield rotation & pulse
    if (this.isShieldActive) {
      this.shieldRotation += 0.035;
    }

    // 6. Hurt flash decay
    if (this.hurtFlash > 0) {
      this.hurtFlash = Math.max(0, this.hurtFlash - 0.06);
    }

    // 7. Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 0.8);
    }

    // 8. Tentacles / Drill rotation clock
    this.tentaclePhase += 0.05;
    this.drillAngle += 0.25;

    // 9. Particle Updates
    // Slime projectiles
    for (let i = this.slimeProjectiles.length - 1; i >= 0; i--) {
      const p = this.slimeProjectiles[i];
      p.progress += p.speed;
      p.x = (1 - p.progress) * (this.width / 2) + p.progress * p.destX;
      p.y = (1 - p.progress) * (this.height / 2) + p.progress * p.destY;
      p.z = p.progress * 150; // closer in perspective
      if (p.progress >= 1.0) {
        this.slimeProjectiles.splice(i, 1);
      }
    }

    // Foam hit bubbles
    for (let i = this.foamHitParticles.length - 1; i >= 0; i--) {
      const p = this.foamHitParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.045;
      p.size = Math.max(0, p.size - 0.2);
      if (p.life <= 0) {
        this.foamHitParticles.splice(i, 1);
      }
    }

    // Shield shards
    for (let i = this.shieldShards.length - 1; i >= 0; i--) {
      const s = this.shieldShards[i];
      s.x += s.vx;
      s.y += s.vy;
      s.rot += s.vrot;
      s.life -= 0.03;
      if (s.life <= 0) {
        this.shieldShards.splice(i, 1);
      }
    }

    // Defeat bursts
    for (let i = this.defeatBursts.length - 1; i >= 0; i--) {
      const b = this.defeatBursts[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.15; // gravity
      b.life -= 0.02;
      if (b.life <= 0) {
        this.defeatBursts.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3D CANVAS RENDERING PIPELINE
  // -------------------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    // 1. Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    const centerX = this.width / 2 + this.x;
    const centerY = this.height / 2 + this.y;

    // 3D Perspective Scale (Z depth calculation)
    // z = 0 -> scale 1.0, z = +140 -> scale 1.6 (huge lunge), z = -110 -> scale 0.65 (recoil)
    const perspectiveScale = Math.max(0.4, 1.0 + (this.z / 220));

    // Ambient floating hover bob
    const hoverY = Math.sin(this.time * 2.5) * 8;

    ctx.translate(centerX, centerY + hoverY);
    ctx.scale(perspectiveScale, perspectiveScale);

    if (this.isDizzy) {
      ctx.rotate(this.rotZ);
    }

    // 2. Drop Shadow on Mirror Surface
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 85 - this.z * 0.15, 65, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.filter = 'blur(6px)';
    ctx.fill();
    ctx.restore();

    // 3. Elemental Aura Glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.fillStyle = this.profile.auraColor;
    ctx.filter = 'blur(16px)';
    ctx.fill();
    ctx.restore();

    // 4. Render Boss 3D Geometry based on Catalog Profile
    if (this.bossId === 'plaque_kraken') {
      this.renderPlaqueKraken(ctx);
    } else if (this.bossId === 'cavity_goblin') {
      this.renderCavityGoblin(ctx);
    } else {
      this.renderSugarBandit(ctx);
    }

    // 5. 3D Crystal Shield Sphere
    if (this.isShieldActive) {
      this.renderShieldBarrier(ctx);
    }

    // 6. Dizzy Orbiting Stars
    if (this.isDizzy && this.dizzyStars.length > 0) {
      this.renderDizzyStars(ctx);
    }

    ctx.restore(); // Exit boss transform

    // 7. Slime Projectiles in Flying Perspective
    this.renderSlimeProjectiles(ctx);

    // 8. Foam Hit Splashes
    this.renderFoamParticles(ctx);

    // 9. Shield Shards
    this.renderShieldShards(ctx);

    // 10. Defeat Bursts
    this.renderDefeatBursts(ctx);
  }

  // -------------------------------------------------------------------------
  // PROCEDURAL 3D BOSS GEOMETRY
  // -------------------------------------------------------------------------

  renderSugarBandit(ctx) {
    const p = this.profile;

    // Body: Shaded Honey Sphere with 3D Radial Highlight
    ctx.save();
    const grad = ctx.createRadialGradient(-18, -22, 10, 0, 0, 60);
    grad.addColorStop(0, this.hurtFlash > 0 ? '#ffffff' : '#fef08a');
    grad.addColorStop(0.3, p.coreColor);
    grad.addColorStop(0.85, p.bodyColor);
    grad.addColorStop(1, p.slimeColor);

    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(180, 83, 9, 0.6)';
    ctx.shadowBlur = 20;
    ctx.fill();

    // Caramel Spikes around rim
    ctx.fillStyle = p.slimeColor;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + this.time * 0.3;
      const sx = Math.cos(ang) * 58;
      const sy = Math.sin(ang) * 58;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sticky Bandit Mask
    ctx.beginPath();
    ctx.ellipse(0, -6, 44, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // Eyes: Glowing or Dizzy
    if (this.isDizzy) {
      // Swirling spiral eyes
      this.renderSpiralEye(ctx, -18, -6, 9);
      this.renderSpiralEye(ctx, 18, -6, 9);
    } else {
      // Fiery Red Mischievous Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-18, -6, 10, 11, 0, 0, Math.PI * 2);
      ctx.ellipse(18, -6, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.eyeColor;
      ctx.beginPath();
      ctx.arc(-18, -6, 5.5, 0, Math.PI * 2);
      ctx.arc(18, -6, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Gleams
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-16, -8, 2.5, 0, Math.PI * 2);
      ctx.arc(20, -8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth with Sharp Candy Teeth
    ctx.beginPath();
    if (this.isLunging) {
      // Wide open roaring mouth
      ctx.ellipse(0, 22, 24, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#451a03';
      ctx.fill();
      // Sharp Teeth
      ctx.fillStyle = '#ffffff';
      for (let tx = -16; tx <= 16; tx += 8) {
        ctx.fillRect(tx - 2, 8, 4, 7);
        ctx.fillRect(tx - 2, 28, 4, 7);
      }
    } else {
      // Mischievous smirk
      ctx.arc(0, 14, 18, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Golden Floating Crown
    ctx.save();
    ctx.translate(0, -60 + Math.sin(this.time * 4) * 3);
    ctx.beginPath();
    ctx.moveTo(-28, 12);
    ctx.lineTo(-24, -8);
    ctx.lineTo(-10, 4);
    ctx.lineTo(0, -18);
    ctx.lineTo(10, 4);
    ctx.lineTo(24, -8);
    ctx.lineTo(28, 12);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Crown Jewels
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -18, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(-24, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(24, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  renderPlaqueKraken(ctx) {
    const p = this.profile;

    ctx.save();

    // 6 Undulating 3D Tentacles behind and around body
    for (let i = 0; i < 6; i++) {
      const baseAng = (i / 6) * Math.PI * 2;
      const wave = Math.sin(this.tentaclePhase + i * 1.2) * 18;
      ctx.save();
      ctx.rotate(baseAng);
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.bezierCurveTo(25 + wave, 60, 40 - wave, 90, 20 + wave * 0.5, 110);
      ctx.strokeStyle = p.bodyColor;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Suction nodes
      ctx.fillStyle = p.suctionColor;
      ctx.beginPath();
      ctx.arc(25 + wave * 0.8, 80, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Biofilm Core Sphere
    const grad = ctx.createRadialGradient(-16, -18, 8, 0, 0, 55);
    grad.addColorStop(0, this.hurtFlash > 0 ? '#ffffff' : '#6ee7b7');
    grad.addColorStop(0.35, p.coreColor);
    grad.addColorStop(0.85, p.bodyColor);
    grad.addColorStop(1, p.slimeColor);

    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
    ctx.shadowBlur = 24;
    ctx.fill();

    // Bioluminescent Biofilm Spots
    ctx.fillStyle = p.suctionColor;
    ctx.beginPath();
    ctx.arc(-22, 20, 6, 0, Math.PI * 2);
    ctx.arc(24, 18, 7, 0, Math.PI * 2);
    ctx.arc(4, 32, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes: Kraken Glowing Yellow
    if (this.isDizzy) {
      this.renderSpiralEye(ctx, -16, -10, 8);
      this.renderSpiralEye(ctx, 16, -10, 8);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-16, -10, 9, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(16, -10, 9, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.eyeColor;
      ctx.beginPath();
      ctx.ellipse(-16, -10, 5, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(16, -10, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beak / Mouth
    ctx.beginPath();
    ctx.arc(0, 8, 14, 0, Math.PI);
    ctx.fillStyle = '#064e3b';
    ctx.fill();

    ctx.restore();
  }

  renderCavityGoblin(ctx) {
    const p = this.profile;

    ctx.save();

    // Jagged Crystal Boulder Body
    ctx.beginPath();
    const points = [
      [-38, -42], [-8, -52], [28, -44], [48, -14],
      [42, 28], [14, 52], [-22, 48], [-46, 22], [-48, -18]
    ];
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(-14, -16, 8, 0, 0, 60);
    grad.addColorStop(0, this.hurtFlash > 0 ? '#ffffff' : '#e9d5ff');
    grad.addColorStop(0.4, p.coreColor);
    grad.addColorStop(0.85, p.bodyColor);
    grad.addColorStop(1, p.slimeColor);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(168, 85, 247, 0.7)';
    ctx.shadowBlur = 20;
    ctx.fill();

    // Rotating 3D Acid Drill Arm on Right Side
    ctx.save();
    ctx.translate(46, 12);
    ctx.rotate(this.drillAngle);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(34, 0);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fillStyle = p.drillColor;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fill();

    // Drill spirals
    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.lineTo(12, 7);
    ctx.moveTo(18, -5);
    ctx.lineTo(22, 5);
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
    ctx.restore();

    // Pointy Crystal Ears
    ctx.fillStyle = p.coreColor;
    ctx.beginPath();
    ctx.moveTo(-36, -30);
    ctx.lineTo(-64, -45);
    ctx.lineTo(-44, -12);
    ctx.fill();

    // Eyes: Glowing Pink
    if (this.isDizzy) {
      this.renderSpiralEye(ctx, -14, -8, 8);
      this.renderSpiralEye(ctx, 14, -8, 8);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-14, -8, 8, 0, Math.PI * 2);
      ctx.arc(14, -8, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.eyeColor;
      ctx.beginPath();
      ctx.arc(-14, -8, 4.5, 0, Math.PI * 2);
      ctx.arc(14, -8, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Jagged Tooth Grin
    ctx.beginPath();
    ctx.moveTo(-22, 16);
    ctx.lineTo(-14, 22);
    ctx.lineTo(-6, 16);
    ctx.lineTo(2, 22);
    ctx.lineTo(10, 16);
    ctx.lineTo(18, 22);
    ctx.strokeStyle = '#3b0764';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.restore();
  }

  renderSpiralEye(ctx, x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const rad = (a / (Math.PI * 4)) * (r - 1.5);
      const px = x + Math.cos(a + this.dizzyAngle * 3) * rad;
      const py = y + Math.sin(a + this.dizzyAngle * 3) * rad;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 3D SHIELD BARRIER
  // -------------------------------------------------------------------------

  renderShieldBarrier(ctx) {
    ctx.save();
    ctx.rotate(this.shieldRotation);

    // Glowing outer polygon shell
    const sides = 8;
    const radius = 78;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      const sx = Math.cos(ang) * radius;
      const sy = Math.sin(ang) * radius;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Semi-transparent hexagonal hex-mesh pattern
    ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
    ctx.fill();

    // Shield Nodes
    for (let i = 0; i < sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * radius, Math.sin(ang) * radius, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // DIZZY STARS & PARTICLES
  // -------------------------------------------------------------------------

  renderDizzyStars(ctx) {
    ctx.save();
    ctx.font = '22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const star of this.dizzyStars) {
      star.angle += star.speed;
      const sx = Math.cos(star.angle) * star.radius;
      const sy = Math.sin(star.angle) * (star.radius * 0.45) - 65 + star.yOff;
      ctx.fillText(star.char, sx, sy);
    }
    ctx.restore();
  }

  renderSlimeProjectiles(ctx) {
    for (const p of this.slimeProjectiles) {
      ctx.save();
      const pScale = Math.max(0.5, 1.0 + p.z / 100);
      ctx.translate(p.x, p.y);
      ctx.scale(pScale, pScale);

      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fill();

      // Core Highlight
      ctx.beginPath();
      ctx.arc(-p.size * 0.25, -p.size * 0.25, p.size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();

      ctx.restore();
    }
  }

  renderFoamParticles(ctx) {
    for (const p of this.foamHitParticles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.shadowColor = '#bae6fd';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }
  }

  renderShieldShards(ctx) {
    for (const s of this.shieldShards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.life;
      ctx.beginPath();
      ctx.moveTo(-s.size / 2, -s.size / 2);
      ctx.lineTo(s.size / 2, 0);
      ctx.lineTo(-s.size / 3, s.size / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  renderDefeatBursts(ctx) {
    for (const b of this.defeatBursts) {
      ctx.save();
      ctx.font = `${b.size}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = b.life;
      ctx.fillText(b.char, b.x, b.y);
      ctx.restore();
    }
  }
}
