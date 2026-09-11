// Pet Companion 3D Engine & Spline Runtime Service
// Manages 3D models, WebGL feature detection, tactile micro-interaction triggers,
// and procedural real-time 3D canvas rendering for all 5 companion pets.

import { Sound } from '../audio/sfx.js';
import { speakRex } from './voiceService.js';
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

export const PETS_3D_CATALOG = {
  rex: {
    id: 'rex',
    name: 'Rex the Dino',
    species: 'Tyrannosaurus Spark',
    baseColor: '#2ecc71',
    bellyColor: '#f1c40f',
    eyeColor: '#16a085',
    accentColor: '#e67e22',
    stages: {
      1: {
        title: 'Baby Dino Hatchling',
        scale: 1.0,
        headSize: 1.2,
        horns: 0,
        tailLength: 1.0,
        specialFeature: 'Cute eggshell cap & tiny green claws',
        lore: 'A curious little dino who loves splashing in puddles and crunching healthy snacks!'
      },
      2: {
        title: 'Armored Guardian Raptor',
        scale: 1.25,
        headSize: 1.1,
        horns: 2,
        tailLength: 1.3,
        specialFeature: 'Emerald armor plates & dual horn ridges',
        lore: 'A brave protector powered by brushing streaks and completed chore quests!'
      },
      3: {
        title: 'Apex Titan T-Rex',
        scale: 1.5,
        headSize: 1.3,
        horns: 4,
        tailLength: 1.6,
        specialFeature: 'Golden lightning crest & fiery back spikes',
        lore: 'The legendary champion of Little Heroes League, feared by Sugar Bugs across the galaxy!'
      }
    }
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua Drake',
    species: 'Tide Dragon',
    baseColor: '#00d2d3',
    bellyColor: '#54a0ff',
    eyeColor: '#0abde3',
    accentColor: '#10ac84',
    stages: {
      1: {
        title: 'Bubble Tadpole Drake',
        scale: 0.95,
        headSize: 1.15,
        horns: 0,
        tailLength: 1.1,
        specialFeature: 'Translucent finlet ears & water bubbles',
        lore: 'Swims gracefully in the Bubble Bath Lagoon and purrs when scrubbed with warm water.'
      },
      2: {
        title: 'Tide Crest Dragon',
        scale: 1.2,
        headSize: 1.05,
        horns: 2,
        tailLength: 1.4,
        specialFeature: 'Iridescent pearl scales & dorsal water wings',
        lore: 'Master of water currents who blasts high-pressure toothpaste foam cannons!'
      },
      3: {
        title: 'Leviathan Ocean King',
        scale: 1.55,
        headSize: 1.25,
        horns: 4,
        tailLength: 1.7,
        specialFeature: 'Crown of coral crystals & glowing aqua tentacles',
        lore: 'Ancient guardian of the Starlight Coral Grotto with shimmering tide energy.'
      }
    }
  },
  bella: {
    id: 'bella',
    name: 'Bella Bunny',
    species: 'Mystic Leporid',
    baseColor: '#e056fd',
    bellyColor: '#f8a5c2',
    eyeColor: '#686de0',
    accentColor: '#ffbe76',
    stages: {
      1: {
        title: 'Cotton Fluff Bunny',
        scale: 0.9,
        headSize: 1.3,
        horns: 0,
        tailLength: 0.6,
        specialFeature: 'Long floppy ears & twitched pink nose',
        lore: 'Loves tidy bedrooms, organized toy bins, and bouncing on mini trampolines!'
      },
      2: {
        title: 'Mystic Swift Hare',
        scale: 1.15,
        headSize: 1.1,
        horns: 0,
        tailLength: 0.8,
        specialFeature: 'Star dust whiskers & speed ribbons',
        lore: 'Can hop over entire chore piles in a single bound with energetic giggles!'
      },
      3: {
        title: 'Celestial Lunar Guardian',
        scale: 1.45,
        headSize: 1.2,
        horns: 2,
        tailLength: 1.0,
        specialFeature: 'Golden crescent crown & floating starlight rings',
        lore: 'Emits a soothing nightlight glow that guides heroes to peaceful bedtime slumber.'
      }
    }
  },
  barnaby: {
    id: 'barnaby',
    name: 'Barnaby Bear',
    species: 'Ursus Sapiens',
    baseColor: '#e17055',
    bellyColor: '#ffeaa7',
    eyeColor: '#d63031',
    accentColor: '#fdcb6e',
    stages: {
      1: {
        title: 'Honey Cub',
        scale: 1.05,
        headSize: 1.2,
        horns: 0,
        tailLength: 0.5,
        specialFeature: 'Round fuzzy ears & cute honey paw prints',
        lore: 'Gives the warmest bedtime hugs and loves taking deep afternoon power naps.'
      },
      2: {
        title: 'Forest Ursine Scout',
        scale: 1.3,
        headSize: 1.15,
        horns: 0,
        tailLength: 0.7,
        specialFeature: 'Carved pine bracers & strong hiking stride',
        lore: 'Cleans up heavy toy boxes with ease and forages for shiny expedition artifacts!'
      },
      3: {
        title: 'Mountain Ancient King',
        scale: 1.6,
        headSize: 1.3,
        horns: 2,
        tailLength: 0.9,
        specialFeature: 'Titan stone pauldron & golden honeycomb shield',
        lore: 'An unbreakable fortress of hero discipline who stands strong against all cavity monsters.'
      }
    }
  },
  pip: {
    id: 'pip',
    name: 'Pip Phoenix',
    species: 'Pyre Avis',
    baseColor: '#ff7675',
    bellyColor: '#ffeaa7',
    eyeColor: '#e17055',
    accentColor: '#fdcb6e',
    stages: {
      1: {
        title: 'Ember Hatchling',
        scale: 0.85,
        headSize: 1.35,
        horns: 0,
        tailLength: 0.9,
        specialFeature: 'Glowing down feathers & chirpy beak',
        lore: 'Sparks bright morning wake-up energy and cheers children on during tooth brushing!'
      },
      2: {
        title: 'Solar Flare Bird',
        scale: 1.15,
        headSize: 1.15,
        horns: 0,
        tailLength: 1.3,
        specialFeature: 'Flaming wingtips & golden crest plume',
        lore: 'Dances with blazing rhythm in the Movement Arena and sets dance party high scores!'
      },
      3: {
        title: 'Sol Apex Phoenix',
        scale: 1.5,
        headSize: 1.25,
        horns: 2,
        tailLength: 1.8,
        specialFeature: 'Blinding sun aura & iridescent tail ribbons',
        lore: 'Rises from routine consistency to bestow golden streak multipliers upon heroic kids.'
      }
    }
  }
};

export function getPet3DProfile(petId) {
  const normId = String(petId || 'rex').toLowerCase();
  if (normId.includes('aqua') || normId.includes('drake')) return PETS_3D_CATALOG.aqua;
  if (normId.includes('bella') || normId.includes('bunny')) return PETS_3D_CATALOG.bella;
  if (normId.includes('barnaby') || normId.includes('bear')) return PETS_3D_CATALOG.barnaby;
  if (normId.includes('pip') || normId.includes('phoenix')) return PETS_3D_CATALOG.pip;
  return PETS_3D_CATALOG.rex;
}

/**
 * Procedural 3D Canvas Controller
 * Renders an interactive 3D companion model on a canvas with real-time perspective,
 * touch rotation, head scratches, tummy tickles, snack catching, and soap lathers.
 */
export class Pet3DInteractiveCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.petId = options.petId || 'rex';
    this.stage = options.stage || 1;
    this.mode = options.mode || 'sanctuary'; // 'sanctuary', 'bath', 'evolution', 'hq'
    this.onAction = options.onAction || (() => {});

    this.profile = getPet3DProfile(this.petId);
    this.stageData = this.profile.stages[this.stage] || this.profile.stages[1];

    // 3D Transform & Physics State
    this.rotationY = 0; // Horizontal orbit angle (radians)
    this.rotationX = 0.15; // Vertical tilt angle (radians)
    this.targetRotationY = 0;
    this.targetRotationX = 0.15;
    this.bounceY = 0;
    this.flipAngle = 0; // Backflip rotation (radians)
    this.earWiggle = 0;
    this.tailWag = 0;
    this.eyeBlink = 0;
    this.mouthOpen = 0;
    this.isBackflipping = false;
    this.isNapping = false;
    this.isSpeaking = false;
    this.isScratching = false;

    // Interactive Particle Arrays
    this.hearts = [];
    this.bubbles = [];
    this.snacks = [];
    this.sparks = [];

    // Drag tracking
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.animFrameId = null;

    this.bindEvents();
    this.startLoop();
  }

  setStage(newStage) {
    this.stage = Math.max(1, Math.min(3, newStage));
    this.stageData = this.profile.stages[this.stage] || this.profile.stages[1];
  }

  setPetId(petId) {
    this.petId = petId;
    this.profile = getPet3DProfile(this.petId);
    this.stageData = this.profile.stages[this.stage] || this.profile.stages[1];
  }

  bindEvents() {
    const el = this.canvas;

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.handlePointerTap(e);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      this.targetRotationY += dx * 0.015;
      this.targetRotationX = Math.max(-0.4, Math.min(0.4, this.targetRotationX + dy * 0.01));
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    window.addEventListener('pointercancel', () => {
      this.isDragging = false;
    });
  }

  handlePointerTap(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    // Check hit areas:
    // Top 35% -> Head Scratch zone
    if (y < h * 0.38) {
      this.triggerHeadScratch(x, y);
    }
    // Middle 35% -> Belly Tickle zone
    else if (y < h * 0.75) {
      this.triggerBellyTickle(x, y);
    }
    // Bottom -> Playful Hop
    else {
      this.triggerHop();
    }
  }

  triggerHeadScratch(x = null, y = null) {
    this.isScratching = true;
    this.earWiggle = 1.0;
    this.eyeBlink = 1.0;
    Sound.sparkle();
    Sound.snore();

    const spawnX = x !== null ? x : this.canvas.width / 2;
    const spawnY = y !== null ? y : this.canvas.height * 0.3;

    for (let i = 0; i < 4; i++) {
      this.hearts.push({
        x: spawnX + (Math.random() - 0.5) * 40,
        y: spawnY,
        vx: (Math.random() - 0.5) * 2,
        vy: -2 - Math.random() * 2,
        opacity: 1.0,
        scale: 14 + Math.random() * 10
      });
    }

    setTimeout(() => {
      this.isScratching = false;
    }, 1200);

    this.onAction('scratch', { petName: this.profile.name });
  }

  triggerBellyTickle() {
    if (this.isBackflipping) return;
    this.isBackflipping = true;
    Sound.boing();
    this.flipAngle = 0;
    this.onAction('tickle', { petName: this.profile.name });
  }

  triggerHop() {
    this.bounceY = -35;
    Sound.pop();
    this.onAction('hop', { petName: this.profile.name });
  }

  triggerFeedSnack(snackType = 'apple') {
    Sound.pop();
    const w = this.canvas.width;
    this.snacks.push({
      x: w / 2 + (Math.random() - 0.5) * 30,
      y: -20,
      vy: 4.5,
      type: snackType,
      rotation: 0
    });
  }

  triggerBathScrub(x, y) {
    Sound.foamSploosh();
    for (let i = 0; i < 5; i++) {
      this.bubbles.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1.2 - Math.random() * 1.5,
        radius: 6 + Math.random() * 12,
        opacity: 0.9
      });
    }
  }

  triggerRinseBubbles() {
    Sound.foamSploosh();
    Sound.sparkle();
    this.bubbles.forEach(b => {
      b.vy = 8;
      b.vx += (Math.random() - 0.5) * 4;
    });
  }

  triggerEvolutionMorph(newStage) {
    Sound.fanfare();
    Sound.placeFurniture();
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Generate swirling radiant spark vortex
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      this.sparks.push({
        x: w / 2,
        y: h / 2,
        angle: angle,
        speed: 3 + Math.random() * 4,
        radius: 3 + Math.random() * 5,
        life: 1.0,
        color: ['#f1c40f', '#e67e22', '#2ecc71', '#00d2d3'][i % 4]
      });
    }

    this.bounceY = -50;
    this.isBackflipping = true;
    this.setStage(newStage);

    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }

  startLoop() {
    const req = typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb) => setTimeout(cb, 16);
    const render = () => {
      this.updatePhysics();
      this.draw();
      this.animFrameId = req(render);
    };
    this.animFrameId = req(render);
  }

  destroy() {
    if (this.animFrameId) {
      const cancel = typeof window !== 'undefined' && window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout;
      cancel(this.animFrameId);
      this.animFrameId = null;
    }
  }

  updatePhysics() {
    // Smooth orbit dampening
    this.rotationY += (this.targetRotationY - this.rotationY) * 0.12;
    this.rotationX += (this.targetRotationX - this.rotationX) * 0.12;

    // Idle natural breathing & tail wag
    const time = performance.now() * 0.003;
    this.tailWag = Math.sin(time * 3) * 0.25;
    this.earWiggle *= 0.92;
    this.eyeBlink *= 0.95;

    // Bounce physics
    if (this.bounceY < 0) {
      this.bounceY += 2.2;
      if (this.bounceY > 0) this.bounceY = 0;
    }

    // Backflip physics
    if (this.isBackflipping) {
      this.flipAngle += 0.24;
      this.bounceY = -Math.sin(this.flipAngle) * 45;
      if (this.flipAngle >= Math.PI * 2) {
        this.flipAngle = 0;
        this.bounceY = 0;
        this.isBackflipping = false;
        Sound.thud();
      }
    }

    // Update floating heart particles
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.x += h.vx;
      h.y += h.vy;
      h.opacity -= 0.02;
      if (h.opacity <= 0) this.hearts.splice(i, 1);
    }

    // Update bath bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.opacity -= 0.01;
      if (b.opacity <= 0 || b.y > this.canvas.height + 20) this.bubbles.splice(i, 1);
    }

    // Update snacks falling into mouth
    for (let i = this.snacks.length - 1; i >= 0; i--) {
      const s = this.snacks[i];
      s.y += s.vy;
      s.rotation += 0.1;
      const mouthY = this.canvas.height * 0.48;
      if (s.y >= mouthY) {
        // Chomp!
        Sound.crunch();
        this.mouthOpen = 1.0;
        this.snacks.splice(i, 1);
        this.triggerHop();
      }
    }
    this.mouthOpen *= 0.88;

    // Update evolution sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += Math.cos(sp.angle) * sp.speed;
      sp.y += Math.sin(sp.angle) * sp.speed;
      sp.life -= 0.025;
      if (sp.life <= 0) this.sparks.splice(i, 1);
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    // Center point for 3D perspective
    const cx = w / 2;
    const cy = h / 2 + 10 + this.bounceY;

    // 1. Soft Character Ground Shadow
    const shadowScale = Math.max(0.4, 1 - Math.abs(this.bounceY) * 0.012);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.88, 55 * shadowScale, 18 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
    ctx.restore();

    // 2. Apply Backflip & 3D Tilt Transform
    ctx.translate(cx, cy);
    if (this.flipAngle > 0) {
      ctx.rotate(-this.flipAngle);
    }
    ctx.scale(this.stageData.scale, this.stageData.scale);

    // 3. Render Procedural 3D Cartoon Companion Pet Mesh
    this.renderCompanionMesh(ctx);

    ctx.restore();

    // 4. Render Particle Overlays (Hearts, Bubbles, Snacks, Sparks)
    this.renderParticles(ctx);
  }

  renderCompanionMesh(ctx) {
    const rotY = this.rotationY;
    const rotX = this.rotationX;
    const p = this.profile;
    const s = this.stageData;

    // Pseudo-3D Depth Offset
    const depthOffset = Math.sin(rotY) * 18;
    const tiltOffset = Math.sin(rotX) * 14;

    // --- A. TAIL ---
    ctx.save();
    ctx.beginPath();
    const tailBaseX = -depthOffset * 1.2;
    const tailBaseY = 30 + tiltOffset;
    const tailTipX = tailBaseX - (Math.sin(rotY + Math.PI / 2) * 50 * s.tailLength) + Math.sin(this.tailWag) * 15;
    const tailTipY = tailBaseY - 20;

    ctx.moveTo(tailBaseX, tailBaseY);
    ctx.quadraticCurveTo(tailBaseX - 25, tailBaseY + 10, tailTipX, tailTipY);
    ctx.lineWidth = 16 * s.tailLength;
    ctx.strokeStyle = p.baseColor;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Tail tip accent
    ctx.beginPath();
    ctx.arc(tailTipX, tailTipY, 9, 0, Math.PI * 2);
    ctx.fillStyle = p.accentColor;
    ctx.fill();
    ctx.restore();

    // --- B. MAIN BODY (Plush 3D Egg Form) ---
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(depthOffset * 0.4, 25 + tiltOffset, 42, 50, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(
      depthOffset * 0.4 - 10, 15 + tiltOffset, 8,
      depthOffset * 0.4, 25 + tiltOffset, 55
    );
    bodyGrad.addColorStop(0, p.baseColor);
    bodyGrad.addColorStop(0.85, p.baseColor);
    bodyGrad.addColorStop(1, '#1b262c');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Belly Patch
    ctx.beginPath();
    ctx.ellipse(depthOffset * 0.8, 30 + tiltOffset, 24, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.bellyColor;
    ctx.fill();
    ctx.restore();

    // --- C. HEAD ---
    ctx.save();
    const headX = depthOffset * 0.9;
    const headY = -35 + tiltOffset;
    const headRadius = 40 * s.headSize;

    ctx.beginPath();
    ctx.ellipse(headX, headY, headRadius, headRadius * 0.95, 0, 0, Math.PI * 2);
    const headGrad = ctx.createRadialGradient(
      headX - 10, headY - 12, 6,
      headX, headY, headRadius * 1.1
    );
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.3, p.baseColor);
    headGrad.addColorStop(1, '#0e161a');
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // --- D. HORNS & EARS (Dynamic per Species & Stage) ---
    if (s.horns > 0) {
      // Powerful Dragon/Titan Horns
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        ctx.beginPath();
        const hornBaseX = headX + side * (headRadius * 0.65);
        const hornBaseY = headY - headRadius * 0.6;
        ctx.moveTo(hornBaseX, hornBaseY);
        ctx.quadraticCurveTo(
          hornBaseX + side * 25, hornBaseY - 35,
          hornBaseX + side * 35, hornBaseY - 25
        );
        ctx.lineWidth = 8;
        ctx.strokeStyle = p.accentColor;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Floppy / Playful Ears (with ear wiggle!)
      for (let side = -1; side <= 1; side += 2) {
        ctx.save();
        const earBaseX = headX + side * (headRadius * 0.75);
        const earBaseY = headY - headRadius * 0.3;
        const wiggleAngle = Math.sin(this.earWiggle * Math.PI * 4) * 0.3 * side;
        ctx.translate(earBaseX, earBaseY);
        ctx.rotate(wiggleAngle);
        ctx.beginPath();
        ctx.ellipse(0, -18, 12, 22, side * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = p.baseColor;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Inner ear pink
        ctx.beginPath();
        ctx.ellipse(0, -18, 6, 14, side * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = p.bellyColor;
        ctx.fill();
        ctx.restore();
      }
    }

    // --- E. EYES & CUTE EXPRESSIONS ---
    const eyeSpacing = 16 * s.headSize;
    const eyeY = headY - 4;

    for (let side = -1; side <= 1; side += 2) {
      const eyeX = headX + side * eyeSpacing + depthOffset * 0.3;
      ctx.save();

      if (this.eyeBlink > 0.4 || this.isScratching) {
        // Joyful Crescent Eye ^^
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 8, Math.PI * 1.1, Math.PI * 1.9);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#2d3436';
        ctx.stroke();
      } else {
        // Big Shimmering Anime / Cartoon Eye
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, 8.5, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2d3436';
        ctx.fill();

        // Eye Color Iris Ring
        ctx.beginPath();
        ctx.arc(eyeX, eyeY + 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = p.eyeColor;
        ctx.fill();

        // Sparkle Catchlights
        ctx.beginPath();
        ctx.arc(eyeX - 2.5, eyeY - 3, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(eyeX + 2, eyeY + 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.restore();
    }

    // --- F. SNOUT, NOSE & MOUTH ---
    const snoutY = headY + 14;
    ctx.save();
    // Rosy Cheeks
    ctx.beginPath();
    ctx.ellipse(headX - 25, snoutY, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(headX + 25, snoutY, 7, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 107, 129, 0.45)';
    ctx.fill();

    // Cute Nose
    ctx.beginPath();
    ctx.ellipse(headX, snoutY - 4, 4, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3436';
    ctx.fill();

    // Mouth / Chomp
    ctx.beginPath();
    if (this.mouthOpen > 0.3) {
      ctx.ellipse(headX, snoutY + 8, 8, 10 * this.mouthOpen, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#eb4d4b';
      ctx.fill();
    } else {
      ctx.arc(headX - 4, snoutY + 3, 5, 0.2, Math.PI * 0.9);
      ctx.arc(headX + 4, snoutY + 3, 5, 0.1, Math.PI * 0.8);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2d3436';
      ctx.stroke();
    }
    ctx.restore();

    // --- G. FEET / PAWS ---
    ctx.save();
    for (let side = -1; side <= 1; side += 2) {
      const footX = depthOffset * 0.4 + side * 26;
      const footY = 65 + tiltOffset;
      ctx.beginPath();
      ctx.ellipse(footX, footY, 14, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.baseColor;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  renderParticles(ctx) {
    // 1. Floating Hearts ❤️
    this.hearts.forEach(h => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, h.opacity);
      ctx.font = `${h.scale}px sans-serif`;
      ctx.fillText('❤️', h.x - 10, h.y);
      ctx.restore();
    });

    // 2. Soap Foam Bubbles 🫧
    this.bubbles.forEach(b => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.opacity);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.stroke();

      // Bubble highlight shine
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    });

    // 3. Falling Picnic Snacks 🍎🍪
    this.snacks.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.font = '24px sans-serif';
      const icon = s.type === 'cookie' ? '🍪' : s.type === 'berry' ? '🍓' : '🍎';
      ctx.fillText(icon, -12, 12);
      ctx.restore();
    });

    // 4. Evolution Spark Vortex ✨
    this.sparks.forEach(sp => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fillStyle = sp.color;
      ctx.shadowColor = sp.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    });
  }
}
