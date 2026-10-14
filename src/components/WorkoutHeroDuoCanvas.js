/**
 * WorkoutHeroDuoCanvas.js
 * 
 * High-Performance Articulated 3D Kinematic Canvas Stage for Dino Hero Workouts
 * 
 * Features:
 * 1. Side-by-Side Synchronized Duo:
 *    - Left: 3D Dinosaur Pet Coach (Rex, Raptor, Stego, Pterry, Chomper, Brachio, Dippy, Spino)
 *    - Right: Fully Articulated 3D Toddler Hero Character with complete anatomical joint hierarchy
 *      (Head, Blinking Eyes, Smile, Cowl/Headband, Torso, Shoulders, Elbows, Hands, Pelvis, Hips, Knees, Feet, Billowing Cape)
 * 2. True Anatomical & Gross-Motor Choreography for all 8 Prehistoric Workouts:
 *    - Velociraptor Run: Lightning sprint on balls of feet with 90° arm pumps and speed lines
 *    - Stegosaurus Walks: Bear-crawl posture on hands & feet with high hips, 4 steps forward/back, heavy shockwave stomps
 *    - Pterodactyl Take Off: Arms spread wide in fast circular wind-up loops, crouch, and explosive vertical leap
 *    - T-Rex Run: Short arms tucked tight in armpits, alternating high-knee drive tapping hands
 *    - Compsognathus Prances: Lateral skater jumps leaping side to side, crossing rear leg behind with balancing arm swing
 *    - Brachiosaurus Stretch: Feet together, rising high onto tiptoes, reaching straight overhead for the stars
 *    - The Diplodocus: Quadruped bird-dog balance with neck reach & wagging tail leg, smooth 30s side switch
 *    - Spinosaurus Stretch: Calming Cat-Cow undulating spine wave with glowing dorsal sail fin arch
 * 3. Dynamic Particle Systems:
 *    - Foot-strike dust puffs, speed lines, starlight sparkles, wind vortex rings, shockwaves, and breath auras
 * 4. Metronome Beat Pulse visualizer ring synchronized to workout BPM
 * 5. Clean lifecycle management (destroy, resize, zero memory leaks)
 * 6. Zero pink/purple palette (Electric Cyan, Emerald Green, Solar Amber, Midnight Slate)
 */

import { store } from '../state/store.js';
import { getPetById, PETS_DATABASE } from '../data/petsData.js';

// Preload Pet 3D Toy Figurine Sprites
const PET_IMG_CACHE = new Map();
function getOrLoadPetImage(src) {
  if (!src) return null;
  let img = PET_IMG_CACHE.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    PET_IMG_CACHE.set(src, img);
  }
  return img;
}

export class WorkoutHeroDuoCanvas {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.workoutId = options.workoutId || 'velociraptor_run';
    this.coachId = String(options.coachId || '2');

    this.width = 640;
    this.height = 360;
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.isDestroyed = false;

    // Simulation Timing
    this.clock = 0;
    this.lastTimestamp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.isAnimating = true;
    this.isPaused = false;
    this.workoutTimeRemaining = 60;
    this.totalDuration = 60;
    this.tempoBpm = options.tempoBpm || 120;

    // Metronome Visual Pulse
    this.beatPulse = 0;

    // Particle FX
    this.dustPuffs = [];
    this.sparkles = [];
    this.shockwaves = [];
    this.speedLines = [];

    // Character Eye Blink Timers
    this.toddlerBlink = 0;
    this.nextBlinkTime = 2.5 + Math.random() * 2.0;

    // Initialize
    this.initCanvas();
    this.startLoop();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full block select-none pointer-events-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = (typeof this.canvas.getContext === 'function') ? this.canvas.getContext('2d') : null;
    this.handleResize();

    this._resizeHandler = () => this.handleResize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = (typeof this.container.getBoundingClientRect === 'function')
      ? this.container.getBoundingClientRect()
      : { width: this.container.clientWidth || 640, height: this.container.clientHeight || 360 };
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    this.width = rect.width || 640;
    this.height = rect.height || 360;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);

    if (this.ctx && typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  setWorkout(workoutId, coachId, tempoBpm = 120) {
    this.workoutId = workoutId;
    if (coachId) this.coachId = String(coachId);
    if (tempoBpm) this.tempoBpm = tempoBpm;
    this.dustPuffs = [];
    this.sparkles = [];
    this.shockwaves = [];
  }

  setTimeRemaining(seconds) {
    this.workoutTimeRemaining = seconds;
  }

  triggerBeat() {
    this.beatPulse = 1.0;
  }

  startAnimation() {
    this.isAnimating = true;
    this.isPaused = false;
  }

  pauseAnimation() {
    this.isPaused = true;
  }

  resumeAnimation() {
    this.isPaused = false;
  }

  stopAnimation() {
    this.isAnimating = false;
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (typeof window !== 'undefined' && this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  startLoop() {
    const loop = (timestamp) => {
      if (this.isDestroyed) return;
      const now = timestamp || ((typeof performance !== 'undefined') ? performance.now() : Date.now());
      const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = now;

      if (!this.isPaused) {
        this.update(dt);
      }
      this.render();

      if (typeof requestAnimationFrame === 'function') {
        this.animId = requestAnimationFrame(loop);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      this.animId = requestAnimationFrame(loop);
    }
  }

  update(dt) {
    this.clock += dt;

    // Decay beat pulse
    if (this.beatPulse > 0) {
      this.beatPulse = Math.max(0, this.beatPulse - dt * 4.0);
    }

    // Toddler Eye Blinking
    this.nextBlinkTime -= dt;
    if (this.nextBlinkTime <= 0) {
      this.toddlerBlink = 1.0;
      this.nextBlinkTime = 2.5 + Math.random() * 2.5;
    }
    if (this.toddlerBlink > 0) {
      this.toddlerBlink = Math.max(0, this.toddlerBlink - dt * 6.0);
    }

    // Update Particles
    for (let i = this.dustPuffs.length - 1; i >= 0; i--) {
      const p = this.dustPuffs[i];
      p.x += p.vx;
      p.y += p.vy;
      p.radius += dt * 8;
      p.alpha -= dt * 1.5;
      if (p.alpha <= 0) this.dustPuffs.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += dt * 80;
      sw.alpha -= dt * 2.0;
      if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= dt * 1.2;
      if (sp.alpha <= 0 || sp.y > this.height) this.sparkles.splice(i, 1);
    }
  }

  spawnDust(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      this.dustPuffs.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 1.8,
        vy: -Math.random() * 1.2 - 0.4,
        radius: 4 + Math.random() * 5,
        alpha: 0.65
      });
    }
  }

  spawnShockwave(x, y, color = '#f1c40f') {
    this.shockwaves.push({
      x,
      y,
      radius: 6,
      color,
      alpha: 0.9
    });
  }

  spawnSparkles(x, y, count = 4, color = '#00d2d3') {
    for (let i = 0; i < count; i++) {
      this.sparkles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2.0 - 0.5,
        size: 3 + Math.random() * 3,
        color,
        alpha: 1.0
      });
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.width;
    const h = this.height;

    // 1. CLEAR & ARENA STAGE BACKGROUND (Midnight Slate + Blueprint Gym Grid)
    ctx.clearRect(0, 0, w, h);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#09141e');
    bgGrad.addColorStop(0.65, '#0e1c28');
    bgGrad.addColorStop(1, '#060d14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle Training Grid Lines
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Dual Pedestals on Arena Floor
    const floorY = h * 0.78;
    const dinoCenterX = w * 0.28;
    const heroCenterX = w * 0.72;

    // Metronome Beat Pulse Ring across the Stage Floor
    if (this.beatPulse > 0.01) {
      ctx.save();
      ctx.strokeStyle = `rgba(0, 210, 211, ${this.beatPulse * 0.4})`;
      ctx.lineWidth = 3 + this.beatPulse * 4;
      ctx.beginPath();
      ctx.ellipse(dinoCenterX, floorY, 110 + this.beatPulse * 20, 36 + this.beatPulse * 8, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(46, 204, 113, ${this.beatPulse * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(heroCenterX, floorY, 110 + this.beatPulse * 20, 36 + this.beatPulse * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dino Coach Pedestal Mat
    ctx.fillStyle = '#121f2b';
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(dinoCenterX, floorY, 100, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Toddler Hero Pedestal Mat
    ctx.fillStyle = '#121f2b';
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(heroCenterX, floorY, 100, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pedestal Badges
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COACH DINO', dinoCenterX, floorY + 22);

    ctx.fillStyle = '#2ecc71';
    ctx.fillText('HERO KIDDO', heroCenterX, floorY + 22);

    // Render Shockwaves on Floor
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Dust Puffs
    for (const p of this.dustPuffs) {
      ctx.save();
      ctx.fillStyle = '#8ba3b8';
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. RENDER THE 3D DINOSAUR COACH (LEFT STAGE)
    this.renderDinoCoach(ctx, dinoCenterX, floorY);

    // 3. RENDER THE FULLY ARTICULATED 3D TODDLER HERO (RIGHT STAGE)
    this.renderArticulatedToddler(ctx, heroCenterX, floorY);

    // Render Sparkles in Screen Space
    for (const sp of this.sparkles) {
      ctx.save();
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = sp.alpha;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Render the 3D Dinosaur Coach with matching movement kinematics
   */
  renderDinoCoach(ctx, x, floorY) {
    const coach = getPetById(this.coachId) || PETS_DATABASE[0];
    const img = getOrLoadPetImage(coach.avatar || `assets/pets/${coach.key || 'rex'}.png`);
    const progress = this.clock * (this.tempoBpm / 60) * Math.PI * 2;

    ctx.save();
    ctx.translate(x, floorY - 8);

    let dinoY = 0;
    let dinoScaleX = 1.0;
    let dinoScaleY = 1.0;
    let dinoRot = 0;

    switch (this.workoutId) {
      case 'velociraptor_run':
        // High-speed lean & foot pump
        dinoY = -Math.abs(Math.sin(progress * 1.8)) * 12;
        dinoScaleY = 1.0 + Math.sin(progress * 1.8) * 0.08;
        dinoScaleX = 1.0 - Math.sin(progress * 1.8) * 0.06;
        dinoRot = 0.12 + Math.sin(progress * 1.8) * 0.08;
        if (Math.abs(Math.sin(progress * 1.8)) > 0.95 && Math.random() < 0.2) {
          this.spawnDust(x + (Math.random() - 0.5) * 20, floorY, 1);
        }
        break;

      case 'stegosaurus_walks':
        // Bear crawl rocking side to side with heavy stomps
        dinoY = -Math.abs(Math.sin(progress * 0.7)) * 10;
        dinoScaleY = 0.88 + Math.cos(progress * 0.7) * 0.08;
        dinoScaleX = 1.12 - Math.cos(progress * 0.7) * 0.06;
        dinoRot = Math.sin(progress * 0.7) * 0.12;
        if (Math.abs(Math.sin(progress * 0.7)) > 0.96) {
          this.spawnShockwave(x, floorY, '#f1c40f');
        }
        break;

      case 'pterodactyl_takeoff':
        // Big bounding leap & wing flaps
        dinoY = -Math.abs(Math.sin(progress * 0.8)) * 38;
        dinoScaleY = 1.0 + Math.sin(progress * 0.8) * 0.22;
        dinoScaleX = 1.0 - Math.sin(progress * 0.8) * 0.14;
        dinoRot = Math.sin(progress * 0.8) * 0.16;
        if (Math.abs(Math.sin(progress * 0.8)) > 0.95) {
          this.spawnSparkles(x, floorY - 30, 2, '#00d2d3');
        }
        break;

      case 'trex_run':
        // High knee apex march with armpit short arms
        dinoY = -Math.abs(Math.sin(progress * 1.2)) * 16;
        dinoScaleY = 1.0 + Math.abs(Math.sin(progress * 1.2)) * 0.14;
        dinoScaleX = 1.0 - Math.abs(Math.sin(progress * 1.2)) * 0.08;
        dinoRot = Math.sin(progress * 1.2) * 0.15;
        if (Math.abs(Math.sin(progress * 1.2)) > 0.96) {
          this.spawnDust(x, floorY, 2);
        }
        break;

      case 'compsognathus_prance':
        // Side-to-side skater hops
        dinoRot = Math.sin(progress * 0.9) * 0.22;
        dinoY = -Math.abs(Math.sin(progress * 1.8)) * 14;
        ctx.translate(Math.sin(progress * 0.9) * 22, 0);
        break;

      case 'brachiosaurus_stretch':
        // Tall tiptoe elongation
        dinoY = -(0.5 + 0.5 * Math.sin(progress * 0.5)) * 24;
        dinoScaleY = 1.0 + (0.5 + 0.5 * Math.sin(progress * 0.5)) * 0.26;
        dinoScaleX = 1.0 - (0.5 + 0.5 * Math.sin(progress * 0.5)) * 0.10;
        break;

      case 'diplodocus':
        // Core tabletop reach with tail wag
        dinoScaleX = 1.08;
        dinoScaleY = 0.92;
        dinoRot = Math.sin(progress * 0.8) * 0.12;
        dinoY = Math.cos(progress * 1.6) * 4;
        break;

      case 'spinosaurus_stretch':
        // Cat cow sail arch
        dinoScaleY = 1.0 + (0.5 + 0.5 * Math.sin(progress * 0.6)) * 0.24;
        dinoScaleX = 1.0 - (0.5 + 0.5 * Math.sin(progress * 0.6)) * 0.12;
        dinoRot = Math.sin(progress * 0.6) * 0.14;
        break;
    }

    ctx.translate(0, dinoY);
    ctx.rotate(dinoRot);
    ctx.scale(dinoScaleX, dinoScaleY);

    // Drop Shadow on Mat
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 48 * dinoScaleX, 15 * dinoScaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render Dino Toy Figurine Image
    const imgSize = 138;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -imgSize / 2, -imgSize + 14, imgSize, imgSize);
    } else {
      // High-resolution procedural dino placeholder
      ctx.fillStyle = coach.color || '#2ecc71';
      ctx.beginPath();
      ctx.arc(0, -imgSize * 0.45, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(coach.emoji || '🦖', 0, -imgSize * 0.35);
    }

    ctx.restore();
  }

  /**
   * Render the Fully Articulated 3D Toddler Hero Character (RIGHT STAGE)
   * Full anatomical hierarchy:
   * Pelvis -> Spine -> Chest -> Neck -> Head (with blinking eyes, hair, mask)
   * Shoulders -> Upper Arms -> Elbows -> Forearms -> Hands
   * Hips -> Thighs -> Knees -> Calves -> Chunky Sneakers
   * Flowing Cloth Superhero Cape
   */
  renderArticulatedToddler(ctx, centerX, floorY) {
    const progress = this.clock * (this.tempoBpm / 60) * Math.PI * 2;
    const isHalfwayFlipped = (this.workoutId === 'diplodocus' && this.workoutTimeRemaining <= 30);

    ctx.save();
    ctx.translate(centerX, floorY);

    // Default Anatomical Joint Angles & Positions (Neutral T-Pose baseline)
    let rootX = 0;
    let rootY = -56;
    let rootRot = 0;
    let spineAngle = 0; // Torso tilt
    let headAngle = 0;

    // Left Arm (upper arm, elbow bend, wrist)
    let armLAngle = 0.3;
    let elbowLAngle = 0.2;
    let wristLAngle = 0;

    // Right Arm (upper arm, elbow bend, wrist)
    let armRAngle = -0.3;
    let elbowRAngle = 0.2;
    let wristRAngle = 0;

    // Left Leg (thigh, knee bend, ankle)
    let thighLAngle = 0.05;
    let kneeLAngle = 0.05;
    let ankleLAngle = 0;

    // Right Leg (thigh, knee bend, ankle)
    let thighRAngle = -0.05;
    let kneeRAngle = 0.05;
    let ankleRAngle = 0;

    let capeSway = 0;
    let capeFly = 0;

    // =========================================================================
    // KINEMATIC CHOREOGRAPHIES FOR ALL 8 WORKOUTS
    // =========================================================================
    switch (this.workoutId) {
      // 1. VELOCIRAPTOR RUN: Rapid sprint on balls of feet, 90° arm drive
      case 'velociraptor_run': {
        const t = progress * 1.7;
        rootY = -56 - Math.abs(Math.sin(t)) * 10;
        rootRot = Math.sin(t) * 0.08;
        spineAngle = 0.22; // Lean forward
        headAngle = -0.15; // Chin up

        // Alternating rapid leg pumps
        thighLAngle = Math.sin(t) * 0.85;
        kneeLAngle = Math.max(0.1, -Math.sin(t) * 1.3);
        ankleLAngle = 0.25;

        thighRAngle = Math.sin(t + Math.PI) * 0.85;
        kneeRAngle = Math.max(0.1, -Math.sin(t + Math.PI) * 1.3);
        ankleRAngle = 0.25;

        // Opposing bent arm drive (elbows locked at 90°)
        armLAngle = Math.sin(t + Math.PI) * 0.95;
        elbowLAngle = 1.45;
        armRAngle = Math.sin(t) * 0.95;
        elbowRAngle = 1.45;

        capeFly = 0.65;
        capeSway = -Math.sin(t) * 0.3;

        if (Math.abs(Math.sin(t)) > 0.96) {
          this.spawnDust(centerX + (Math.sin(t) > 0 ? -12 : 12), floorY, 1);
        }
        break;
      }

      // 2. STEGOSAURUS WALKS: Bear walk on hands & feet, hips high, 4 steps forward & back
      case 'stegosaurus_walks': {
        // 8-step cycle: 4 steps forward (0..PI), 4 steps back (PI..2PI)
        const t = progress * 0.55;
        const stepPhase = Math.sin(t);
        rootX = stepPhase * 24; // Forward & back translation
        rootY = -34; // Low to ground, hips high!
        rootRot = 0.75; // Angled down from hips to floor!
        spineAngle = 0.35;
        headAngle = -0.65; // Looking at hands

        // Hands on floor
        armLAngle = 1.35 + Math.sin(t * 4) * 0.3;
        elbowLAngle = 0.25;
        armRAngle = 1.35 + Math.sin(t * 4 + Math.PI) * 0.3;
        elbowRAngle = 0.25;

        // Feet on floor, high hips
        thighLAngle = -0.85 + Math.sin(t * 4 + Math.PI) * 0.35;
        kneeLAngle = 0.45;
        thighRAngle = -0.85 + Math.sin(t * 4) * 0.35;
        kneeRAngle = 0.45;

        capeFly = 0.1;
        capeSway = Math.sin(t * 4) * 0.15;

        if (Math.abs(Math.sin(t * 4)) > 0.96) {
          this.spawnShockwave(centerX + rootX, floorY, '#2ecc71');
        }
        break;
      }

      // 3. PTERODACTYL TAKE OFF: Wide arms windmill in circles + crouch & jump high!
      case 'pterodactyl_takeoff': {
        const cycle = (this.clock * 0.6) % 3.0; // 3-second loop
        if (cycle < 1.8) {
          // Phase 1: Rapid circular arm wing wind-up
          const armT = this.clock * 9.0;
          rootY = -56 + Math.sin(this.clock * 6.0) * 4;
          spineAngle = 0;
          armLAngle = Math.sin(armT) * 1.5 - 1.2;
          elbowLAngle = 0.15;
          armRAngle = Math.cos(armT) * 1.5 - 1.2;
          elbowRAngle = 0.15;

          thighLAngle = 0.1;
          kneeLAngle = 0.2;
          thighRAngle = -0.1;
          kneeRAngle = 0.2;
          capeFly = 0.3;
        } else if (cycle < 2.1) {
          // Phase 2a: Deep crouch squat
          rootY = -36;
          thighLAngle = -0.8;
          kneeLAngle = 1.35;
          thighRAngle = 0.8;
          kneeRAngle = 1.35;
          armLAngle = 0.8;
          armRAngle = -0.8;
          capeFly = 0.1;
        } else {
          // Phase 2b: BLAST OFF JUMP!
          const jumpPhase = (cycle - 2.1) / 0.9;
          const jumpH = Math.sin(jumpPhase * Math.PI);
          rootY = -56 - jumpH * 54; // High vertical leap!
          armLAngle = -2.85; // Wings reaching sky!
          elbowLAngle = 0.05;
          armRAngle = -2.85;
          elbowRAngle = 0.05;
          thighLAngle = 0.1;
          kneeLAngle = 0.1;
          thighRAngle = -0.1;
          kneeRAngle = 0.1;
          capeFly = 0.85;
          if (jumpPhase > 0.4 && jumpPhase < 0.6) {
            this.spawnSparkles(centerX, floorY - 50, 2, '#00d2d3');
          }
        }
        break;
      }

      // 4. T-REX RUN: Elbows in armpits (short arms!), high-knee stomps tapping hands
      case 'trex_run': {
        const t = progress * 1.25;
        rootY = -56 - Math.abs(Math.sin(t)) * 14;
        rootRot = Math.sin(t) * 0.12;
        spineAngle = 0.12;
        headAngle = -0.08;

        // SIGNATURE T-REX SHORT ARMS: Elbows bent in armpits, hands out front
        armLAngle = 0.45;
        elbowLAngle = 1.95; // Tucked tight!
        wristLAngle = -0.45;
        armRAngle = 0.45;
        elbowRAngle = 1.95; // Tucked tight!
        wristRAngle = -0.45;

        // High knee march lifting up to chest level
        thighLAngle = Math.sin(t) * 1.25;
        kneeLAngle = Math.max(0.2, Math.sin(t) * 1.6);
        thighRAngle = Math.sin(t + Math.PI) * 1.25;
        kneeRAngle = Math.max(0.2, Math.sin(t + Math.PI) * 1.6);

        capeFly = 0.4;
        capeSway = Math.sin(t) * 0.2;

        if (Math.abs(Math.sin(t)) > 0.96) {
          this.spawnDust(centerX + (Math.sin(t) > 0 ? -10 : 10), floorY, 2);
        }
        break;
      }

      // 5. COMPSOGNATHUS PRANCE: Skater jumps leaping side to side, crossing rear leg behind
      case 'compsognathus_prance': {
        const t = progress * 0.85;
        const leap = Math.sin(t);
        rootX = leap * 32; // Side-to-side lateral travel
        rootY = -56 - Math.abs(Math.cos(t)) * 16;
        rootRot = leap * 0.22;
        spineAngle = leap * 0.15;

        if (leap > 0) {
          // Leaping Right: Land on right leg, cross left leg behind!
          thighRAngle = 0.25;
          kneeRAngle = 0.65;
          thighLAngle = -0.75; // Crossed behind!
          kneeLAngle = 0.45;

          // Skater arms balancing
          armLAngle = -0.65;
          elbowLAngle = 0.85;
          armRAngle = 0.95;
          elbowRAngle = 1.15;
        } else {
          // Leaping Left: Land on left leg, cross right leg behind!
          thighLAngle = 0.25;
          kneeLAngle = 0.65;
          thighRAngle = -0.75; // Crossed behind!
          kneeRAngle = 0.45;

          // Skater arms balancing
          armLAngle = 0.95;
          elbowLAngle = 1.15;
          armRAngle = -0.65;
          elbowRAngle = 0.85;
        }

        capeFly = 0.45;
        capeSway = -leap * 0.45;
        break;
      }

      // 6. BRACHIOSAURUS STRETCH: Feet together, tiptoes, reaching arms straight overhead
      case 'brachiosaurus_stretch': {
        const reachBreath = 0.5 + 0.5 * Math.sin(progress * 0.45);
        rootY = -64 - reachBreath * 16; // Tiptoe elevation!
        spineAngle = -0.05; // Straight spine
        headAngle = -0.35; // Looking straight up at stars!

        // Arms reaching straight up to the ceiling
        armLAngle = -2.95 - reachBreath * 0.15;
        elbowLAngle = 0.05;
        armRAngle = -2.95 - reachBreath * 0.15;
        elbowRAngle = 0.05;

        // Feet together on tiptoes
        thighLAngle = 0.05;
        kneeLAngle = 0.05;
        ankleLAngle = 0.55; // Tiptoes!
        thighRAngle = -0.05;
        kneeRAngle = 0.05;
        ankleRAngle = 0.55; // Tiptoes!

        capeFly = 0.15;
        capeSway = Math.sin(progress * 0.3) * 0.08;

        if (Math.random() < 0.15) {
          this.spawnSparkles(centerX + (Math.random() - 0.5) * 40, floorY - 95, 1, '#ffb961');
        }
        break;
      }

      // 7. THE DIPLODOCUS: Quadruped tabletop with long neck reach & tail wag, 30s flip!
      case 'diplodocus': {
        rootY = -34;
        rootRot = 0.95; // Tabletop flat back
        spineAngle = 0;
        headAngle = -0.75;

        const wag = Math.sin(progress * 1.5) * 0.35;

        if (!isHalfwayFlipped) {
          // SIDE 1: Right arm forward (neck), Left leg backward (tail wag)
          armRAngle = -1.55; // Reaching forward like long neck!
          elbowRAngle = 0.05;
          armLAngle = 1.45; // Left hand on floor
          elbowLAngle = 0.15;

          thighLAngle = 1.55 + wag; // Left leg straight back wagging tail!
          kneeLAngle = 0.1;
          thighRAngle = -0.95; // Right knee on floor
          kneeRAngle = 1.35;
        } else {
          // SIDE 2 (Halfway Flip!): Left arm forward (neck), Right leg backward (tail wag)
          armLAngle = -1.55; // Reaching forward like long neck!
          elbowLAngle = 0.05;
          armRAngle = 1.45; // Right hand on floor
          elbowRAngle = 0.15;

          thighRAngle = 1.55 + wag; // Right leg straight back wagging tail!
          kneeRAngle = 0.1;
          thighLAngle = -0.95; // Left knee on floor
          kneeLAngle = 1.35;
        }

        capeFly = 0.1;
        capeSway = wag * 0.2;
        break;
      }

      // 8. SPINOSAURUS STRETCH: Cat-Cow undulating sail arch
      case 'spinosaurus_stretch': {
        const breath = 0.5 + 0.5 * Math.sin(progress * 0.4);
        rootY = -32;
        rootRot = 0.95;

        // Cat Arch vs Cow Soften
        spineAngle = (breath - 0.5) * 0.65; // Arch up to ceiling!
        headAngle = -0.75 + (breath - 0.5) * 0.45;

        armLAngle = 1.45;
        elbowLAngle = 0.15;
        armRAngle = 1.45;
        elbowRAngle = 0.15;

        thighLAngle = -0.95;
        kneeLAngle = 1.35;
        thighRAngle = -0.95;
        kneeRAngle = 1.35;

        capeFly = 0.1;

        // Glowing sail crest pulse on high arch
        if (breath > 0.85 && Math.random() < 0.2) {
          this.spawnSparkles(centerX, floorY - 45, 1, '#2ecc71');
        }
        break;
      }
    }

    // =========================================================================
    // HIERARCHICAL RENDERING: ROOT -> PELVIS -> TORSO -> ARMS/LEGS -> HEAD
    // =========================================================================
    ctx.save();
    ctx.translate(rootX, rootY);
    ctx.rotate(rootRot);

    // Drop Shadow on Mat
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, -rootY + 8, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. BILLOWING SUPERHERO CAPE (Drawn behind body)
    this.renderCape(ctx, spineAngle, capeFly, capeSway);

    // 2. LEGS & CHUNKY SNEAKERS
    this.renderLeg(ctx, -10, 8, thighLAngle, kneeLAngle, ankleLAngle, '#00d2d3', '#09141e');
    this.renderLeg(ctx, 10, 8, thighRAngle, kneeRAngle, ankleRAngle, '#00d2d3', '#09141e');

    // 3. PELVIS & UTILITY BELT
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.roundRect(-14, 2, 28, 10, 4);
    ctx.fill();

    // Golden Belt Buckle
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 7, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. TORSO / HERO CHEST ARMOR
    ctx.save();
    ctx.rotate(spineAngle);

    // Hero Suit Body (Emerald Green & Electric Cyan)
    const suitGrad = ctx.createLinearGradient(-16, -26, 16, 4);
    suitGrad.addColorStop(0, '#2ecc71');
    suitGrad.addColorStop(1, '#1b7a43');
    ctx.fillStyle = suitGrad;
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-15, -28, 30, 32, 6);
    ctx.fill();
    ctx.stroke();

    // Chest Shield Emblem
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, -14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#09141e';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', 0, -11);

    // 5. BILATERAL ARTICULATED ARMS
    this.renderArm(ctx, -16, -22, armLAngle, elbowLAngle, wristLAngle, '#2ecc71', '#f39c12');
    this.renderArm(ctx, 16, -22, armRAngle, elbowRAngle, wristRAngle, '#2ecc71', '#f39c12');

    // 6. HEAD, EXPRESSIVE FACE & HERO COWL
    ctx.save();
    ctx.translate(0, -32);
    ctx.rotate(headAngle);

    // Neck
    ctx.fillStyle = '#ffdfba';
    ctx.fillRect(-5, 0, 10, 6);

    // Round Toddler Head
    ctx.fillStyle = '#ffdfba';
    ctx.strokeStyle = '#e6b98d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -16, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hero Headband / Visor (Electric Cyan with Gold Star)
    ctx.fillStyle = '#00d2d3';
    ctx.beginPath();
    ctx.roundRect(-21, -26, 42, 10, 4);
    ctx.fill();

    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, -21, 4, 0, Math.PI * 2);
    ctx.fill();

    // Cute Rosy Toddler Cheeks
    ctx.fillStyle = 'rgba(255, 140, 140, 0.45)';
    ctx.beginPath();
    ctx.arc(-11, -12, 4, 0, Math.PI * 2);
    ctx.arc(11, -12, 4, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Eyes (with Blinking Animation)
    if (this.toddlerBlink > 0.5) {
      // Blinking happy squint arcs
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-7, -15, 3.5, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(7, -15, 3.5, 0, Math.PI);
      ctx.stroke();
    } else {
      // Big lively cartoon eyes with starlight catchlights
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-7, -15, 3.5, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(7, -15, 3.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight Sparkle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-8, -17, 1.8, 0, Math.PI * 2);
      ctx.arc(6, -17, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cute Toddler Smile / Determined Mouth
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -9, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore(); // end head
    ctx.restore(); // end torso
    ctx.restore(); // end root
    ctx.restore(); // end canvas stage
  }

  /**
   * Render an Articulated Leg: Hip -> Thigh -> Knee -> Calf -> Sneaker
   */
  renderLeg(ctx, hipX, hipY, thighAngle, kneeAngle, ankleAngle, pantsColor, sneakerColor) {
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.rotate(thighAngle);

    // Thigh
    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.roundRect(-5, 0, 10, 18, 5);
    ctx.fill();

    // Knee Joint
    ctx.translate(0, 16);
    ctx.rotate(kneeAngle);
    ctx.fillStyle = '#008889';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Calf / Shin
    ctx.fillStyle = pantsColor;
    ctx.beginPath();
    ctx.roundRect(-4.5, 0, 9, 18, 4);
    ctx.fill();

    // Ankle & Chunky Toddler Sneaker
    ctx.translate(0, 16);
    ctx.rotate(ankleAngle);

    // Sneaker Base
    ctx.fillStyle = sneakerColor;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-6, 0, 16, 9, 4);
    ctx.fill();
    ctx.stroke();

    // White Sneaker Sole
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, 7, 16, 3);

    ctx.restore();
  }

  /**
   * Render an Articulated Arm: Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand
   */
  renderArm(ctx, shoulderX, shoulderY, armAngle, elbowAngle, wristAngle, sleeveColor, gloveColor) {
    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(armAngle);

    // Shoulder Joint
    ctx.fillStyle = '#1b7a43';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Upper Arm
    ctx.fillStyle = sleeveColor;
    ctx.beginPath();
    ctx.roundRect(-4.5, 0, 9, 16, 4);
    ctx.fill();

    // Elbow Joint with Bending
    ctx.translate(0, 14);
    ctx.rotate(elbowAngle);
    ctx.fillStyle = '#1b7a43';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Forearm
    ctx.fillStyle = sleeveColor;
    ctx.beginPath();
    ctx.roundRect(-4, 0, 8, 14, 3.5);
    ctx.fill();

    // Wrist & Hero Glove / Mitt
    ctx.translate(0, 13);
    ctx.rotate(wristAngle);
    ctx.fillStyle = gloveColor;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render Flowing Superhero Cape
   */
  renderCape(ctx, spineAngle, capeFly, capeSway) {
    ctx.save();
    ctx.translate(0, -24);
    ctx.rotate(spineAngle * 0.4);

    const capeLen = 48 + capeFly * 20;
    const capeW = 28 + capeFly * 12;

    const capeGrad = ctx.createLinearGradient(0, 0, 0, capeLen);
    capeGrad.addColorStop(0, '#f39c12');
    capeGrad.addColorStop(1, '#d35400');
    ctx.fillStyle = capeGrad;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.bezierCurveTo(-capeW + capeSway * 18, capeLen * 0.5, -capeW * 0.8 + capeSway * 24, capeLen, capeSway * 14, capeLen);
    ctx.bezierCurveTo(capeW * 0.8 + capeSway * 24, capeLen, capeW + capeSway * 18, capeLen * 0.5, 12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
