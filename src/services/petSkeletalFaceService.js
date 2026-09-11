// Pet Companion Skeletal Face Rig & Phoneme Lip-Sync Service
// Provides real-time procedural bone-and-mesh facial animation for all 5 companion pets
// (Rex the Dino, Aqua Drake, Bella Bunny, Barnaby Bear, Pip Phoenix).
// Features syllable-synchronized mouth phonemes, expressive eye blinks, emotional eyebrow tilts,
// ear/crest spring physics, and tactile touch gestures.

import { Sound } from '../audio/sfx.js';
import { getPet3DProfile, isWebGLSupported } from './pet3DService.js';

export { isWebGLSupported };

export const PET_FACE_PROFILES = {
  rex: {
    id: 'rex',
    name: 'Rex the Dino',
    species: 'Tyrannosaurus Spark',
    baseColor: '#2ecc71',
    snoutColor: '#34d399',
    bellyColor: '#f1c40f',
    eyeColor: '#16a085',
    crestColor: '#e67e22',
    earType: 'crest_spikes',
    hasSnout: true,
    hasBeak: false
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua Drake',
    species: 'Tide Dragon',
    baseColor: '#00d2d3',
    snoutColor: '#48dbfb',
    bellyColor: '#54a0ff',
    eyeColor: '#0abde3',
    crestColor: '#10ac84',
    earType: 'finlets',
    hasSnout: true,
    hasBeak: false
  },
  bella: {
    id: 'bella',
    name: 'Bella Bunny',
    species: 'Moonlight Lop',
    baseColor: '#ff9ff3',
    snoutColor: '#f368e0',
    bellyColor: '#ffeaa7',
    eyeColor: '#9b59b6',
    crestColor: '#ff6b81',
    earType: 'bunny_ears',
    hasSnout: false,
    hasBeak: false
  },
  barnaby: {
    id: 'barnaby',
    name: 'Barnaby Bear',
    species: 'Honey Grizzly',
    baseColor: '#e17055',
    snoutColor: '#fab1a0',
    bellyColor: '#fdcb6e',
    eyeColor: '#d63031',
    crestColor: '#e17055',
    earType: 'bear_ears',
    hasSnout: true,
    hasBeak: false
  },
  pip: {
    id: 'pip',
    name: 'Pip Phoenix',
    species: 'Sunfire Chick',
    baseColor: '#feca57',
    snoutColor: '#ff9f43',
    bellyColor: '#ffeaa7',
    eyeColor: '#e17055',
    crestColor: '#ff6b6b',
    earType: 'feather_crest',
    hasSnout: false,
    hasBeak: true
  }
};

export function getPetFaceProfile(petId) {
  const norm = String(petId || 'rex').toLowerCase();
  if (norm.includes('aqua') || norm.includes('drake') || norm.includes('hydro') || norm.includes('water') || norm === '4') return PET_FACE_PROFILES.aqua;
  if (norm.includes('bella') || norm.includes('bunny') || norm.includes('flipper')) return PET_FACE_PROFILES.bella;
  if (norm.includes('barnaby') || norm.includes('bear') || norm === '3') return PET_FACE_PROFILES.barnaby;
  if (norm.includes('pip') || norm.includes('phoenix') || norm.includes('owl') || norm.includes('archie') || norm === '7') return PET_FACE_PROFILES.pip;
  return PET_FACE_PROFILES.rex;
}

/**
 * PetSkeletalFaceCanvas
 * 2D Canvas Procedural Bone-Rigged Face Mesh Controller
 */
export class PetSkeletalFaceCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.petId = options.petId || 'rex';
    this.profile = getPetFaceProfile(this.petId);
    this.width = canvasElement.width || 120;
    this.height = canvasElement.height || 120;
    this.isInteractive = options.isInteractive !== false;

    // Bone Hierarchy & Transform Kinematics
    this.bones = {
      // Root head center
      head: { x: 0, y: 0, scale: 1.0, tilt: 0 },
      // Jaw & mouth phoneme shape
      jaw: {
        open: 0, // 0.0 (closed) to 1.0 (wide open)
        targetOpen: 0,
        shape: 'neutral', // 'neutral', 'ah', 'oh', 'ee', 'mm'
        width: 1.0
      },
      // Eyelids
      eyelids: {
        left: 0, // 0 = open, 1 = closed blink
        right: 0,
        squint: 0
      },
      // Eyebrows
      eyebrows: {
        height: 0, // -1 (worried/lowered) to +1 (surprised/raised)
        tilt: 0 // -1 (inward slant/hero) to +1 (outward curious)
      },
      // Ears & Crest Spring Physics
      ears: {
        angleLeft: 0,
        angleRight: 0,
        targetAngleLeft: 0,
        targetAngleRight: 0,
        velocityLeft: 0,
        velocityRight: 0
      },
      // Cheeks
      cheeks: {
        squish: 0, // 0 = normal, 1 = poked
        blush: 0.65
      }
    };

    // Speech & Lip-Sync State
    this.isSpeaking = false;
    this.speechTimer = null;
    this.syllableIndex = 0;
    this.vowelSequence = ['ah', 'oh', 'ee', 'ah', 'neutral', 'oh'];

    // Tactile & Drag Physics
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.targetDragX = 0;
    this.targetDragY = 0;

    // Particle Arrays
    this.hearts = [];
    this.sparkles = [];

    // Animation Loop
    this.time = 0;
    this.rafId = null;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.loop = this.loop.bind(this);

    // Event Listeners for Voice Synchronization
    this.handleSpeechStart = this.handleSpeechStart.bind(this);
    this.handleSpeechSyllable = this.handleSpeechSyllable.bind(this);
    this.handleSpeechEnd = this.handleSpeechEnd.bind(this);

    this.bindSpeechEvents();
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
    this.unbindSpeechEvents();
    if (this.speechTimer) {
      clearInterval(this.speechTimer);
      this.speechTimer = null;
    }
    this.hearts = [];
    this.sparkles = [];
  }

  setPet(petId) {
    this.petId = petId;
    this.profile = getPetFaceProfile(petId);
  }

  // -------------------------------------------------------------------------
  // SPEECH & PHONEME LIP-SYNC SYNCHRONIZATION
  // -------------------------------------------------------------------------

  bindSpeechEvents() {
    if (typeof window === 'undefined') return;
    window.addEventListener('companion-speech-start', this.handleSpeechStart);
    window.addEventListener('companion-speech-syllable', this.handleSpeechSyllable);
    window.addEventListener('companion-speech-end', this.handleSpeechEnd);
  }

  unbindSpeechEvents() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('companion-speech-start', this.handleSpeechStart);
    window.removeEventListener('companion-speech-syllable', this.handleSpeechSyllable);
    window.removeEventListener('companion-speech-end', this.handleSpeechEnd);
  }

  handleSpeechStart(e) {
    this.isSpeaking = true;
    this.bones.eyebrows.height = 0.35; // alert, expressive raised eyebrows
    this.bones.eyebrows.tilt = -0.15;

    // Start rhythmic syllable lip flap (8-10 Hz)
    if (this.speechTimer) clearInterval(this.speechTimer);
    this.speechTimer = setInterval(() => {
      if (!this.isSpeaking) return;
      this.advanceSpeechSyllable();
    }, 115);
  }

  handleSpeechSyllable(e) {
    this.advanceSpeechSyllable();
  }

  handleSpeechEnd() {
    this.isSpeaking = false;
    if (this.speechTimer) {
      clearInterval(this.speechTimer);
      this.speechTimer = null;
    }
    this.bones.jaw.targetOpen = 0;
    this.bones.jaw.shape = 'neutral';
    this.bones.eyebrows.height = 0;
    this.bones.eyebrows.tilt = 0;
  }

  advanceSpeechSyllable() {
    this.syllableIndex++;
    const nextShape = this.vowelSequence[this.syllableIndex % this.vowelSequence.length];
    this.bones.jaw.shape = nextShape;

    if (nextShape === 'neutral' || nextShape === 'mm') {
      this.bones.jaw.targetOpen = 0.15;
    } else if (nextShape === 'oh') {
      this.bones.jaw.targetOpen = 0.75;
      this.bones.jaw.width = 0.65;
    } else if (nextShape === 'ah') {
      this.bones.jaw.targetOpen = 0.95;
      this.bones.jaw.width = 1.0;
    } else { // 'ee'
      this.bones.jaw.targetOpen = 0.55;
      this.bones.jaw.width = 1.25;
    }

    // Subtle ear twitch on stressed syllables
    if (this.syllableIndex % 3 === 0) {
      this.bones.ears.velocityLeft += (Math.random() - 0.5) * 0.15;
      this.bones.ears.velocityRight += (Math.random() - 0.5) * 0.15;
    }
  }

  // -------------------------------------------------------------------------
  // TACTILE TOUCH GESTURES
  // -------------------------------------------------------------------------

  triggerForeheadPat() {
    // Happy squinting eyes, raised wiggling ears, and floating heart sparkles
    this.bones.eyelids.squint = 1.0;
    this.bones.eyebrows.height = 0.5;
    this.bones.eyebrows.tilt = 0.3;
    this.bones.ears.velocityLeft += 0.35;
    this.bones.ears.velocityRight -= 0.35;

    // Spawn 4 heart sparkles
    const cx = this.width / 2;
    for (let i = 0; i < 4; i++) {
      this.hearts.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: this.height * 0.35,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2.5 - 1.5,
        size: Math.random() * 8 + 14,
        char: ['❤️', '💖', '✨'][Math.floor(Math.random() * 3)],
        life: 1.0
      });
    }

    if (typeof Sound.chirp === 'function') {
      Sound.chirp();
    }

    setTimeout(() => {
      this.bones.eyelids.squint = 0;
      this.bones.eyebrows.height = 0;
      this.bones.eyebrows.tilt = 0;
    }, 900);
  }

  triggerCheekPoke() {
    // Blushing squish, cheeky O-mouth, and squeak
    this.bones.cheeks.squish = 0.8;
    this.bones.cheeks.blush = 1.0;
    this.bones.jaw.targetOpen = 0.6;
    this.bones.jaw.shape = 'oh';

    if (typeof Sound.rubberPop === 'function') {
      Sound.rubberPop();
    }

    setTimeout(() => {
      this.bones.cheeks.squish = 0;
      this.bones.cheeks.blush = 0.65;
      this.bones.jaw.targetOpen = 0;
      this.bones.jaw.shape = 'neutral';
    }, 750);
  }

  applyDragOffset(dx, dy) {
    this.targetDragX = dx * 0.35;
    this.targetDragY = dy * 0.35;
    // Aerodynamic tilt
    this.bones.head.tilt = (dx / 50) * 0.25;
    this.bones.ears.targetAngleLeft = (dx / 50) * 0.4;
    this.bones.ears.targetAngleRight = (dx / 50) * 0.4;
  }

  releaseDrag() {
    this.targetDragX = 0;
    this.targetDragY = 0;
    this.bones.head.tilt = 0;
    this.bones.ears.targetAngleLeft = 0;
    this.bones.ears.targetAngleRight = 0;
    if (typeof Sound.boing === 'function') {
      Sound.boing();
    }
  }

  // -------------------------------------------------------------------------
  // MAIN ANIMATION LOOP
  // -------------------------------------------------------------------------

  loop(timestamp) {
    if (!this.isRunning) return;
    const dt = Math.min(32, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.time += dt * 0.002;

    this.update(dt);
    this.render();

    if (this.isRunning && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  update(dt) {
    // 1. Natural Breathing Bob
    this.bones.head.y = Math.sin(this.time * 2) * 2.5;

    // 2. Jaw Interpolation
    this.bones.jaw.open += (this.bones.jaw.targetOpen - this.bones.jaw.open) * 0.35;

    // 3. Natural Eye Blinking Clock (Blinks every 3-4 seconds)
    const blinkCycle = Math.sin(this.time * 1.6);
    if (blinkCycle > 0.95 && this.bones.eyelids.squint === 0) {
      this.bones.eyelids.left = 1.0;
      this.bones.eyelids.right = 1.0;
    } else if (this.bones.eyelids.squint > 0) {
      this.bones.eyelids.left = this.bones.eyelids.squint;
      this.bones.eyelids.right = this.bones.eyelids.squint;
    } else {
      this.bones.eyelids.left = 0;
      this.bones.eyelids.right = 0;
    }

    // 4. Spring Damped Ear Physics
    const earSpring = 0.15;
    const earDamping = 0.82;

    // Left Ear
    const forceLeft = (this.bones.ears.targetAngleLeft - this.bones.ears.angleLeft) * earSpring;
    this.bones.ears.velocityLeft = (this.bones.ears.velocityLeft + forceLeft) * earDamping;
    this.bones.ears.angleLeft += this.bones.ears.velocityLeft;

    // Right Ear
    const forceRight = (this.bones.ears.targetAngleRight - this.bones.ears.angleRight) * earSpring;
    this.bones.ears.velocityRight = (this.bones.ears.velocityRight + forceRight) * earDamping;
    this.bones.ears.angleRight += this.bones.ears.velocityRight;

    // 5. Drag Elastic Spring
    this.dragOffsetX += (this.targetDragX - this.dragOffsetX) * 0.2;
    this.dragOffsetY += (this.targetDragY - this.dragOffsetY) * 0.2;

    // 6. Update Particles
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.x += h.vx;
      h.y += h.vy;
      h.life -= 0.03;
      if (h.life <= 0) this.hearts.splice(i, 1);
    }
  }

  // -------------------------------------------------------------------------
  // PROCEDURAL SKELETAL RENDERING PIPELINE
  // -------------------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    const cx = this.width / 2 + this.dragOffsetX;
    const cy = this.height / 2 + this.dragOffsetY + this.bones.head.y;

    ctx.translate(cx, cy);
    if (this.bones.head.tilt !== 0) ctx.rotate(this.bones.head.tilt);

    const p = this.profile;
    const radius = Math.min(this.width, this.height) * 0.44;

    // 1. Ears / Crest Spring Bones (Drawn behind head)
    this.renderEars(ctx, p, radius);

    // 2. Base Head Sphere with Shaded 3D Gradient
    const headGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius);
    headGrad.addColorStop(0, '#ffffff');
    headGrad.addColorStop(0.25, p.baseColor);
    headGrad.addColorStop(0.85, p.baseColor);
    headGrad.addColorStop(1, '#0f172a');

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.shadowColor = p.baseColor;
    ctx.shadowBlur = 12;
    ctx.fill();

    // 3. Snout or Beak
    if (p.hasSnout) {
      ctx.beginPath();
      ctx.ellipse(0, radius * 0.22, radius * 0.55, radius * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.snoutColor;
      ctx.fill();

      // Nostrils
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.arc(-radius * 0.12, radius * 0.12, radius * 0.05, 0, Math.PI * 2);
      ctx.arc(radius * 0.12, radius * 0.12, radius * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.hasBeak) {
      // Golden Phoenix Beak
      ctx.beginPath();
      ctx.moveTo(-radius * 0.18, radius * 0.14);
      ctx.lineTo(0, radius * 0.42);
      ctx.lineTo(radius * 0.18, radius * 0.14);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }

    // 4. Cheeks (Interactive Squish)
    const cheekY = radius * 0.18;
    const cheekSquishScale = 1.0 - this.bones.cheeks.squish * 0.3;
    ctx.fillStyle = `rgba(248, 113, 113, ${this.bones.cheeks.blush})`;

    ctx.beginPath();
    ctx.ellipse(-radius * 0.52, cheekY, radius * 0.14 * cheekSquishScale, radius * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.52, cheekY, radius * 0.14 * cheekSquishScale, radius * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Eyebrow Bones (Expressive Tilts & Heights)
    this.renderEyebrows(ctx, p, radius);

    // 6. Eyes & Eyelids (Blinking & Squints)
    this.renderEyes(ctx, p, radius);

    // 7. Jaw & Mouth Phoneme Shape
    this.renderMouth(ctx, p, radius);

    ctx.restore(); // Exit pet transform

    // 8. Floating Heart Particles
    this.renderHeartParticles(ctx);
  }

  // -------------------------------------------------------------------------
  // SKELETAL FEATURE COMPONENTS
  // -------------------------------------------------------------------------

  renderEars(ctx, p, radius) {
    if (p.earType === 'bunny_ears') {
      // Bella: Long floppy bunny ears with spring rotation
      // Left Ear
      ctx.save();
      ctx.translate(-radius * 0.38, -radius * 0.7);
      ctx.rotate(-0.15 + this.bones.ears.angleLeft);
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.65, radius * 0.2, radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.baseColor;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.65, radius * 0.11, radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.bellyColor;
      ctx.fill();
      ctx.restore();

      // Right Ear
      ctx.save();
      ctx.translate(radius * 0.38, -radius * 0.7);
      ctx.rotate(0.15 + this.bones.ears.angleRight);
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.65, radius * 0.2, radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.baseColor;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.65, radius * 0.11, radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.bellyColor;
      ctx.fill();
      ctx.restore();

    } else if (p.earType === 'crest_spikes') {
      // Rex: 3 Golden Dino Crest Spikes on Top
      ctx.fillStyle = p.crestColor;
      // Center Spike
      ctx.save();
      ctx.rotate(this.bones.ears.angleLeft * 0.5);
      ctx.beginPath();
      ctx.moveTo(-radius * 0.12, -radius * 0.9);
      ctx.lineTo(0, -radius * 1.3);
      ctx.lineTo(radius * 0.12, -radius * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Left Spike
      ctx.beginPath();
      ctx.moveTo(-radius * 0.44, -radius * 0.75);
      ctx.lineTo(-radius * 0.34, -radius * 1.15);
      ctx.lineTo(-radius * 0.22, -radius * 0.85);
      ctx.closePath();
      ctx.fill();

      // Right Spike
      ctx.beginPath();
      ctx.moveTo(radius * 0.22, -radius * 0.85);
      ctx.lineTo(radius * 0.34, -radius * 1.15);
      ctx.lineTo(radius * 0.44, -radius * 0.75);
      ctx.closePath();
      ctx.fill();

    } else if (p.earType === 'finlets') {
      // Aqua: Wavy Aquatic Finlet Ears
      ctx.save();
      ctx.translate(-radius * 0.75, -radius * 0.2);
      ctx.rotate(this.bones.ears.angleLeft);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.35, radius * 0.18, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = p.crestColor;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(radius * 0.75, -radius * 0.2);
      ctx.rotate(this.bones.ears.angleRight);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.35, radius * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = p.crestColor;
      ctx.fill();
      ctx.restore();

    } else if (p.earType === 'bear_ears') {
      // Barnaby: Round Teddy Ears
      ctx.fillStyle = p.baseColor;
      ctx.beginPath();
      ctx.arc(-radius * 0.65, -radius * 0.65, radius * 0.28, 0, Math.PI * 2);
      ctx.arc(radius * 0.65, -radius * 0.65, radius * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.bellyColor;
      ctx.beginPath();
      ctx.arc(-radius * 0.65, -radius * 0.65, radius * 0.16, 0, Math.PI * 2);
      ctx.arc(radius * 0.65, -radius * 0.65, radius * 0.16, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Pip: Feather Crest Tuft
      ctx.fillStyle = p.crestColor;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.15, -radius * 0.85);
      ctx.lineTo(0, -radius * 1.35);
      ctx.lineTo(radius * 0.15, -radius * 0.85);
      ctx.closePath();
      ctx.fill();
    }
  }

  renderEyebrows(ctx, p, radius) {
    const browY = -radius * 0.38 + this.bones.eyebrows.height * (-radius * 0.12);
    const browTilt = this.bones.eyebrows.tilt;

    ctx.strokeStyle = '#065f46';
    ctx.lineWidth = radius * 0.08;
    ctx.lineCap = 'round';

    // Left Brow
    ctx.save();
    ctx.translate(-radius * 0.28, browY);
    ctx.rotate(browTilt);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.14, 0);
    ctx.lineTo(radius * 0.14, 0);
    ctx.stroke();
    ctx.restore();

    // Right Brow
    ctx.save();
    ctx.translate(radius * 0.28, browY);
    ctx.rotate(-browTilt);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.14, 0);
    ctx.lineTo(radius * 0.14, 0);
    ctx.stroke();
    ctx.restore();
  }

  renderEyes(ctx, p, radius) {
    const eyeY = -radius * 0.18;
    const eyeR = radius * 0.18;

    // Left Eye
    ctx.save();
    ctx.translate(-radius * 0.28, eyeY);

    if (this.bones.eyelids.left >= 0.8) {
      // Closed Eye Arc (Blink or happy squint)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = radius * 0.09;
      ctx.beginPath();
      ctx.arc(0, 0, eyeR * 0.8, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else {
      // Open Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Iris
      ctx.fillStyle = p.eyeColor;
      ctx.beginPath();
      ctx.arc(0, 0, eyeR * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Gleam Highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-eyeR * 0.25, -eyeR * 0.25, eyeR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Right Eye
    ctx.save();
    ctx.translate(radius * 0.28, eyeY);

    if (this.bones.eyelids.right >= 0.8) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = radius * 0.09;
      ctx.beginPath();
      ctx.arc(0, 0, eyeR * 0.8, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else {
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
      ctx.arc(-eyeR * 0.25, -eyeR * 0.25, eyeR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderMouth(ctx, p, radius) {
    const mouthY = radius * 0.34;
    const mouthOpen = this.bones.jaw.open;
    const shape = this.bones.jaw.shape;
    const shapeWidth = this.bones.jaw.width;

    ctx.save();
    ctx.translate(0, mouthY);

    if (mouthOpen > 0.25) {
      // Dynamic Open Mouth for Phonemes
      const openHeight = radius * (0.1 + mouthOpen * 0.32);
      const openWidth = radius * 0.26 * shapeWidth;

      ctx.beginPath();
      if (shape === 'oh') {
        // Round O-mouth for 'oh' / 'oo'
        ctx.ellipse(0, 0, openWidth * 0.7, openHeight * 0.9, 0, 0, Math.PI * 2);
      } else if (shape === 'ee') {
        // Wide smiling mouth for 'ee'
        ctx.ellipse(0, 0, openWidth * 1.25, openHeight * 0.5, 0, 0, Math.PI * 2);
      } else {
        // Wide drop for 'ah'
        ctx.ellipse(0, 0, openWidth, openHeight, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#065f46';
      ctx.fill();

      // Cute pink tongue
      ctx.beginPath();
      ctx.arc(0, openHeight * 0.35, openWidth * 0.55, 0, Math.PI);
      ctx.fillStyle = '#f472b6';
      ctx.fill();

      // Sharp cute little top dino tooth if Rex
      if (p.id === 'rex') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-radius * 0.08, -openHeight * 0.65);
        ctx.lineTo(0, -openHeight * 0.25);
        ctx.lineTo(radius * 0.08, -openHeight * 0.65);
        ctx.closePath();
        ctx.fill();
      }

    } else {
      // Closed Happy Smile
      ctx.beginPath();
      ctx.arc(0, -radius * 0.05, radius * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = '#065f46';
      ctx.lineWidth = radius * 0.08;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  renderHeartParticles(ctx) {
    for (const h of this.hearts) {
      ctx.font = `${h.size}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = h.life;
      ctx.fillText(h.char, h.x, h.y);
    }
  }
}
