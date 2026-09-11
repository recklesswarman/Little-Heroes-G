// Dance 3D Interactive Engine & Spline Runtime Service
// Renders dynamic 3D Pet Dance Coaches on a glowing neon disco turntable with 6 distinct
// pediatric motor choreographies, real-time BPM tempo locking, Freeze Dance ice statue
// transformations, and spinning 3D disco ball Rainbow Fever Mode.

import { Sound } from '../audio/sfx.js';
import { getPet3DProfile, isWebGLSupported } from './pet3DService.js';
import confetti from 'canvas-confetti';

export { isWebGLSupported };

export const DANCE_MOVES = {
  dino_march: {
    id: 'dino_march',
    name: 'Dino March Stomp',
    emoji: '🦖',
    description: 'High knee stomps with alternating left/right foot ground quakes'
  },
  star_jump: {
    id: 'star_jump',
    name: 'Star Jump Leap',
    emoji: '⭐',
    description: 'Squat and high leap spreading arms & legs into a glowing star'
  },
  tail_shake: {
    id: 'tail_shake',
    name: 'Tail & Hip Shakeout',
    emoji: '💃',
    description: 'Rapid rhythmic hip swaying and tail wiggles with floating music notes'
  },
  freeze_statue: {
    id: 'freeze_statue',
    name: 'Freeze Ice Statue',
    emoji: '🧊',
    description: 'Sudden rock-solid freeze with frost crystal shaders and breath puffs'
  },
  superhero_flight: {
    id: 'superhero_flight',
    name: 'Superhero Flight Pose',
    emoji: '🦸',
    description: 'Leaning forward on one leg with arms outstretched flying through clouds'
  },
  slumber_sway: {
    id: 'slumber_sway',
    name: 'Bedtime Slumber Sway',
    emoji: '🌙',
    description: 'Gentle slow rhythmic swaying with deep breathing chest rise and sleepy stars'
  }
};

/**
 * Dance3DInteractiveCanvas
 * Procedural 3D WebGL/Canvas Dance Coach that animates the child's pet companion
 * in real-time beat sync on an illuminated disco stage.
 */
export class Dance3DInteractiveCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.petId = options.petId || 'rex';
    this.stage = options.stage || 1;
    this.profile = getPet3DProfile(this.petId);
    this.width = canvasElement.width || 320;
    this.height = canvasElement.height || 320;

    // Movement & Choreography State
    this.currentMove = options.currentMove || 'dino_march';
    this.bpm = options.bpm || 118;
    this.isFrozen = false;
    this.isFeverActive = false;
    this.groovePercent = 0;

    // Dance Transforms & Kinematics
    this.time = 0;
    this.beatPhase = 0; // 0 to 1 loop matching BPM
    this.stepFoot = 0; // 0 = left, 1 = right
    this.turntableAngle = 0;
    this.bounceY = 0;
    this.bodyTiltX = 0;
    this.bodyTiltZ = 0;
    this.limbAngleLeft = 0;
    this.limbAngleRight = 0;
    this.tailAngle = 0;
    this.eyeBlink = 0;

    // Freeze Statue Frost Effect
    this.frostAlpha = 0;
    this.frostCrystals = [];

    // Disco Ball & Fever Particle Systems
    this.discoBallAngle = 0;
    this.starlightBeams = [];
    this.musicNotes = [];
    this.starbursts = [];
    this.stompRipples = [];

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
    this.frostCrystals = [];
    this.starlightBeams = [];
    this.musicNotes = [];
    this.starbursts = [];
    this.stompRipples = [];
  }

  setMove(moveName) {
    if (DANCE_MOVES[moveName]) {
      this.currentMove = moveName;
      // Trigger special move entry bursts
      if (moveName === 'star_jump') {
        this.spawnStarBurst();
      } else if (moveName === 'tail_shake') {
        this.spawnMusicNotes();
      }
    }
  }

  setBpm(bpm) {
    if (bpm && bpm > 40 && bpm < 220) {
      this.bpm = bpm;
    }
  }

  triggerFreeze(isFrozen = true) {
    this.isFrozen = isFrozen;
    if (isFrozen) {
      this.currentMove = 'freeze_statue';
      this.frostAlpha = 1.0;
      // Spawn frost crystal shards
      this.frostCrystals = [];
      for (let i = 0; i < 14; i++) {
        this.frostCrystals.push({
          x: (Math.random() - 0.5) * 110,
          y: (Math.random() - 0.5) * 110,
          size: Math.random() * 12 + 6,
          char: ['❄️', '🧊', '✨'][Math.floor(Math.random() * 3)],
          rot: Math.random() * Math.PI * 2
        });
      }
      if (typeof Sound.freezeChime === 'function') {
        Sound.freezeChime();
      }
    } else {
      this.frostAlpha = 0;
      this.frostCrystals = [];
      if (typeof Sound.shieldShatter === 'function') {
        Sound.shieldShatter();
      }
    }
  }

  setFeverMode(active = true) {
    this.isFeverActive = active;
    if (active) {
      this.spawnStarBurst(35);
      if (typeof Sound.feverHorn === 'function') {
        Sound.feverHorn();
      }
      if (typeof confetti === 'function' && typeof document !== 'undefined' && document.body) {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#a855f7']
          });
        } catch (e) {}
      }
    }
  }

  spawnMusicNotes() {
    for (let i = 0; i < 4; i++) {
      this.musicNotes.push({
        x: (Math.random() - 0.5) * 60,
        y: -30 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2.5 - 1.5,
        char: ['🎵', '🎶', '✨'][Math.floor(Math.random() * 3)],
        size: Math.random() * 10 + 14,
        life: 1.0
      });
    }
  }

  spawnStarBurst(count = 15) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5 + 2;
      this.starbursts.push({
        x: 0,
        y: -10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: Math.random() * 12 + 8,
        color: ['#fde047', '#f472b6', '#38bdf8', '#4ade80'][Math.floor(Math.random() * 4)],
        life: 1.0
      });
    }
  }

  spawnStompRipple() {
    this.stompRipples.push({
      radius: 12,
      maxRadius: 75,
      alpha: 0.9,
      color: this.profile.baseColor
    });
  }

  // -------------------------------------------------------------------------
  // ANIMATION LOOP & PHYSICS UPDATE
  // -------------------------------------------------------------------------

  loop(timestamp) {
    if (!this.isRunning) return;
    const dt = Math.min(32, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.time += dt * 0.001;

    this.update(dt);
    this.render();

    if (this.isRunning && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  update(dt) {
    if (this.isFrozen) {
      // Completely motionless in ice statue state
      return;
    }

    // BPM Beat Phase Clock
    // Beats per second = BPM / 60
    const beatsPerSec = this.bpm / 60;
    const beatCycleDuration = 1000 / beatsPerSec;
    this.beatPhase = (this.time * beatsPerSec) % 1; // 0 to 1

    // Rotating Neon Turntable
    this.turntableAngle += 0.015;

    // Disco Ball Rotation during Fever Mode
    if (this.isFeverActive) {
      this.discoBallAngle += 0.04;
    }

    // Choreography Kinematics Calculation based on currentMove
    switch (this.currentMove) {
      case 'dino_march': {
        // Alternating high knees & stomps
        const cycle = Math.sin(this.time * beatsPerSec * Math.PI * 2);
        this.bounceY = -Math.abs(Math.sin(this.time * beatsPerSec * Math.PI)) * 26;
        this.bodyTiltZ = cycle * 0.15;
        this.limbAngleLeft = cycle * 0.5;
        this.limbAngleRight = -cycle * 0.5;
        this.tailAngle = -cycle * 0.4;

        // Trigger stomp ripple on bottom of foot impact
        if (Math.abs(this.bounceY) < 3 && Math.random() < 0.1) {
          this.spawnStompRipple();
        }
        break;
      }

      case 'star_jump': {
        // Deep squat -> explosive leap spreading limbs wide
        const leapPhase = Math.sin(this.time * beatsPerSec * Math.PI);
        if (leapPhase > 0) {
          // In the air
          this.bounceY = -Math.pow(leapPhase, 0.7) * 45;
          this.limbAngleLeft = 0.65; // arms/legs spread wide
          this.limbAngleRight = 0.65;
          this.bodyTiltX = -0.1;
        } else {
          // Squat prep
          this.bounceY = Math.abs(leapPhase) * 12;
          this.limbAngleLeft = -0.3;
          this.limbAngleRight = -0.3;
          this.bodyTiltX = 0.2;
        }
        break;
      }

      case 'tail_shake': {
        // Fast horizontal hip wiggles & tail wagging
        const wiggle = Math.sin(this.time * beatsPerSec * Math.PI * 4);
        this.bounceY = -Math.abs(Math.sin(this.time * beatsPerSec * Math.PI * 2)) * 10;
        this.bodyTiltZ = wiggle * 0.22;
        this.tailAngle = wiggle * 0.75;
        this.limbAngleLeft = Math.cos(this.time * 6) * 0.3;
        this.limbAngleRight = -Math.cos(this.time * 6) * 0.3;

        if (Math.random() < 0.05) {
          this.spawnMusicNotes();
        }
        break;
      }

      case 'superhero_flight': {
        // Leaning forward on one leg with arms outstretched
        this.bodyTiltX = 0.45;
        this.bounceY = Math.sin(this.time * 4) * 8 - 14;
        this.bodyTiltZ = Math.sin(this.time * 2.5) * 0.12;
        this.limbAngleLeft = 0.8;
        this.limbAngleRight = 0.8;
        this.tailAngle = Math.sin(this.time * 3) * 0.25;
        break;
      }

      case 'slumber_sway': {
        // Gentle slow rhythmic swaying with deep breathing chest rise
        const slowSway = Math.sin(this.time * 1.8);
        this.bounceY = Math.sin(this.time * 2) * 5;
        this.bodyTiltZ = slowSway * 0.18;
        this.tailAngle = slowSway * 0.3;
        this.limbAngleLeft = slowSway * 0.15;
        this.limbAngleRight = -slowSway * 0.15;
        break;
      }

      default: {
        // Standard rhythmic idle bounce
        this.bounceY = -Math.abs(Math.sin(this.time * beatsPerSec * Math.PI)) * 14;
        this.tailAngle = Math.sin(this.time * 3) * 0.25;
        break;
      }
    }

    // Eye blinking
    if (Math.sin(this.time * 1.5) > 0.96) {
      this.eyeBlink = 1.0;
    } else {
      this.eyeBlink = 0;
    }

    // Update Particles
    // 1. Music Notes
    for (let i = this.musicNotes.length - 1; i >= 0; i--) {
      const n = this.musicNotes[i];
      n.x += n.vx;
      n.y += n.vy;
      n.life -= 0.025;
      if (n.life <= 0) this.musicNotes.splice(i, 1);
    }

    // 2. Starbursts
    for (let i = this.starbursts.length - 1; i >= 0; i--) {
      const s = this.starbursts[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.035;
      s.size = Math.max(0, s.size - 0.2);
      if (s.life <= 0) this.starbursts.splice(i, 1);
    }

    // 3. Stomp Ripples
    for (let i = this.stompRipples.length - 1; i >= 0; i--) {
      const r = this.stompRipples[i];
      r.radius += 2.5;
      r.alpha = Math.max(0, 1 - (r.radius / r.maxRadius));
      if (r.radius >= r.maxRadius) this.stompRipples.splice(i, 1);
    }
  }

  // -------------------------------------------------------------------------
  // RENDERING PIPELINE
  // -------------------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    const centerX = this.width / 2;
    const centerY = this.height / 2 + 15;

    // 1. Glowing Neon Disco Turntable Platform
    this.renderDiscoTurntable(ctx, centerX, centerY + 65);

    // 2. Stomp Shockwave Ripples on Floor
    this.renderStompRipples(ctx, centerX, centerY + 65);

    // 3. Spinning 3D Disco Ball & Starlight Beams (Fever Mode)
    if (this.isFeverActive) {
      this.renderFeverDiscoBall(ctx, centerX, 30);
    }

    // 4. Transform to 3D Pet Center
    ctx.save();
    ctx.translate(centerX, centerY + this.bounceY);

    if (this.bodyTiltZ !== 0) ctx.rotate(this.bodyTiltZ);

    // Render 3D Companion Mesh
    this.renderPetCompanionMesh(ctx);

    // 5. Freeze Ice Statue Overlay
    if (this.isFrozen) {
      this.renderFreezeStatueOverlay(ctx);
    }

    ctx.restore(); // Exit pet transform

    // 6. Floating Music Notes & Starlight Particles
    this.renderParticles(ctx, centerX, centerY);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // DISCO TURNTABLE STAGE
  // -------------------------------------------------------------------------

  renderDiscoTurntable(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    // Ambient Floor Shadow & Glow
    ctx.beginPath();
    ctx.ellipse(0, 0, 85, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.isFeverActive ? 'rgba(236, 72, 153, 0.45)' : 'rgba(56, 189, 248, 0.3)';
    ctx.filter = 'blur(12px)';
    ctx.fill();
    ctx.filter = 'none';

    // Turntable Rim
    ctx.beginPath();
    ctx.ellipse(0, 0, 78, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = this.isFeverActive ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = this.isFeverActive ? '#ec4899' : '#0284c7';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.stroke();

    // Rotating Neon Radial Segments (Disco Floor Tiles)
    ctx.save();
    ctx.rotate(this.turntableAngle);
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      const tileColor = this.isFeverActive
        ? ['#f43f5e', '#eab308', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#f97316'][i]
        : ['#0284c7', '#0369a1', '#075985', '#0c4a6e'][i % 4];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 72, ang, ang + (Math.PI * 2) / segments);
      ctx.closePath();
      ctx.fillStyle = tileColor;
      ctx.globalAlpha = 0.5;
      ctx.fill();
    }
    ctx.restore();

    // Center Gold Turntable Spindle
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    ctx.restore();
  }

  renderStompRipples(ctx, cx, cy) {
    ctx.save();
    for (const r of this.stompRipples) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r.radius, r.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // PROCEDURAL 3D PET COMPANION MESH
  // -------------------------------------------------------------------------

  renderPetCompanionMesh(ctx) {
    const p = this.profile;
    const scale = (p.stages[this.stage]?.scale || 1.0) * 0.95;

    ctx.scale(scale, scale);

    // 1. Tail (Animated)
    ctx.save();
    ctx.translate(28, 12);
    ctx.rotate(this.tailAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(25, -12, 38, -6);
    ctx.quadraticCurveTo(22, 10, 0, 12);
    ctx.fillStyle = p.baseColor;
    ctx.fill();

    // Dino Spikes or Fin on Tail
    ctx.fillStyle = p.accentColor;
    ctx.beginPath();
    ctx.arc(22, -6, 5, 0, Math.PI * 2);
    ctx.arc(34, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Body: Shaded 3D Sphere
    const bodyGrad = ctx.createRadialGradient(-14, -18, 6, 0, 0, 48);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.2, p.baseColor);
    bodyGrad.addColorStop(0.85, p.baseColor);
    bodyGrad.addColorStop(1, '#0f172a');

    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = p.baseColor;
    ctx.shadowBlur = 18;
    ctx.fill();

    // Belly Accent
    ctx.beginPath();
    ctx.ellipse(-4, 10, 24, 28, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.bellyColor;
    ctx.fill();

    // 3. Dancing Limbs (Hands / Wings)
    // Left Arm
    ctx.save();
    ctx.translate(-34, -4);
    ctx.rotate(this.limbAngleLeft);
    ctx.beginPath();
    ctx.ellipse(-10, -4, 14, 8, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = p.baseColor;
    ctx.fill();
    ctx.restore();

    // Right Arm
    ctx.save();
    ctx.translate(34, -4);
    ctx.rotate(this.limbAngleRight);
    ctx.beginPath();
    ctx.ellipse(10, -4, 14, 8, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = p.baseColor;
    ctx.fill();
    ctx.restore();

    // 4. Head & Face
    ctx.save();
    ctx.translate(0, -32);

    // Head Sphere
    const headGrad = ctx.createRadialGradient(-10, -12, 4, 0, 0, 36);
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.25, p.baseColor);
    headGrad.addColorStop(1, '#0f172a');

    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();

    // Cheeks
    ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
    ctx.beginPath();
    ctx.arc(-22, 6, 6, 0, Math.PI * 2);
    ctx.arc(22, 6, 6, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    if (this.eyeBlink > 0) {
      // Happy Closed Eyes during dance bounce
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-14, -4, 6, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.arc(14, -4, 6, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else {
      // Big cartoon sparkling eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-14, -4, 7, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(14, -4, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.eyeColor;
      ctx.beginPath();
      ctx.arc(-14, -4, 4.5, 0, Math.PI * 2);
      ctx.arc(14, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-12, -6, 2, 0, Math.PI * 2);
      ctx.arc(16, -6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Open Singing/Smiling Mouth
    ctx.beginPath();
    ctx.ellipse(0, 14, 8, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#991b1b';
    ctx.fill();

    // Little pink tongue
    ctx.beginPath();
    ctx.arc(0, 16, 4, 0, Math.PI);
    ctx.fillStyle = '#f472b6';
    ctx.fill();

    // Ears / Horns based on pet species
    if (p.id === 'bella') {
      // Bunny Ears
      ctx.fillStyle = p.baseColor;
      ctx.beginPath();
      ctx.ellipse(-14, -42, 7, 22, -0.15, 0, Math.PI * 2);
      ctx.ellipse(14, -42, 7, 22, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.bellyColor;
      ctx.beginPath();
      ctx.ellipse(-14, -42, 4, 16, -0.15, 0, Math.PI * 2);
      ctx.ellipse(14, -42, 4, 16, 0.15, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.id === 'rex') {
      // Dino Head Crest
      ctx.fillStyle = p.accentColor;
      ctx.beginPath();
      ctx.moveTo(-8, -32);
      ctx.lineTo(0, -46);
      ctx.lineTo(8, -32);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // FREEZE STATUE ICE OVERLAY
  // -------------------------------------------------------------------------

  renderFreezeStatueOverlay(ctx) {
    ctx.save();

    // Icy Blue Sheen
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.stroke();

    // Render Frost Crystals & Snowflakes
    ctx.font = '18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of this.frostCrystals) {
      ctx.fillText(c.char, c.x, c.y);
    }

    // "FROZEN STATUE" Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-52, -75, 104, 24, 12);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('🧊 FROZEN STATUE', 0, -63);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // FEVER DISCO BALL & PARTICLES
  // -------------------------------------------------------------------------

  renderFeverDiscoBall(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    // Hanging Chain
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, 0);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mirrored Disco Ball Sphere
    ctx.save();
    ctx.rotate(this.discoBallAngle);

    const ballGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, 22);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.35, '#cbd5e1');
    ballGrad.addColorStop(1, '#475569');

    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    ctx.fill();

    // Mirror facets
    ctx.fillStyle = '#ffffff';
    for (let f = 0; f < 8; f++) {
      const ang = (f / 8) * Math.PI * 2;
      ctx.fillRect(Math.cos(ang) * 12 - 2, Math.sin(ang) * 12 - 2, 4, 4);
    }
    ctx.restore();

    // Rotating Colored Light Beams
    const beamCount = 6;
    for (let b = 0; b < beamCount; b++) {
      const bAng = (b / beamCount) * Math.PI * 2 + this.discoBallAngle * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(bAng) * 220, Math.sin(bAng) * 220 + 80);
      ctx.strokeStyle = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'][b];
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
    }

    ctx.restore();
  }

  renderParticles(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);

    // 1. Music Notes
    for (const n of this.musicNotes) {
      ctx.font = `${n.size}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = n.life;
      ctx.fillText(n.char, n.x, n.y);
    }

    // 2. Starbursts
    for (const s of this.starbursts) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.life;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    ctx.restore();
  }
}
