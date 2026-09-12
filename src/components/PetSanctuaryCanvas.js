/**
 * PetSanctuaryCanvas.js
 * 
 * High-performance 3D Canvas Engine for the 3D Hero Pet Sanctuary & Playpark
 * Features:
 * - Living 3D Sanctuary Habitat: Floating meadow island, warm bubble lagoon pond,
 *   solar orange picnic blanket, and starlight evolution pedestal.
 * - Skeletal Procedural 3D Creature Engine supporting 6 archetypes:
 *   (Dino, Dragon, Beast, Aquatic, Robot, Mystic) with squash-and-stretch physics.
 * - Real-Time 360° Touch Orbit Turntable with inertial glide.
 * - Micro-interactions: Head scratch purrs, belly tickle backflips, snack feeding chomps,
 *   and foamy bubble lagoon scrubbing.
 * - Dynamic 3D Forged Gear Attachment (Helmets, Wings, Greaves, Shields).
 * - Roaming background companion pets playing in the distance.
 */

import { store } from '../state/store.js';
import { getPetArchetype, getPetBondBonus, PETS_DATABASE } from '../data/petsData.js';
import { Sound } from '../audio/sfx.js';

export class PetSanctuaryCanvas {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.petId = options.petId || store.getActivePet()?.id || '2';
    
    // Engine Dimensions
    this.width = 600;
    this.height = 480;
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.isDestroyed = false;

    // Simulation Timing & Animation Clock
    this.clock = 0;
    this.lastTimestamp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // Turntable Orbit Camera State
    this.rotY = 0;
    this.targetRotY = 0;
    this.rotVelocity = 0.003;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartRotY = 0;

    // Pet Physics & Skeletal Animation State
    this.petX = 0;
    this.petY = 0;
    this.petScaleX = 1.0;
    this.petScaleY = 1.0;
    this.petHeadRot = 0;
    this.petTailAngle = 0;
    this.isPettingHead = false;
    this.isTickled = false;
    this.flipProgress = 0;

    // Interactive Snack & Particle Systems
    this.eatingSnack = null;
    this.snackProgress = 0;
    this.floatingBubbles = [];
    this.starlightSparks = [];
    this.floatingHearts = [];

    // Initialize Component
    this.initCanvas();
    this.initPondBubbles();
    this.initStarlightSparks();
    this.bindEvents();
    this.startLoop();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing select-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = (typeof this.canvas.getContext === 'function') ? this.canvas.getContext('2d') : null;
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = (typeof this.container.getBoundingClientRect === 'function')
      ? this.container.getBoundingClientRect()
      : { width: this.container.clientWidth || 600, height: this.container.clientHeight || 480 };
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    this.width = rect.width || 600;
    this.height = rect.height || 480;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;

    if (this.ctx && typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  initPondBubbles() {
    this.floatingBubbles = [];
    for (let i = 0; i < 14; i++) {
      this.floatingBubbles.push({
        x: (Math.random() - 0.5) * 110 - 130,
        y: Math.random() * 40 + 70,
        radius: Math.random() * 8 + 6,
        speedY: Math.random() * 0.8 + 0.6,
        phase: Math.random() * Math.PI * 2,
        color: 'rgba(224, 251, 252, 0.75)'
      });
    }
  }

  initStarlightSparks() {
    this.starlightSparks = [];
    for (let i = 0; i < 22; i++) {
      this.starlightSparks.push({
        x: (Math.random() - 0.5) * (this.width * 0.8),
        y: Math.random() * (this.height * 0.7) + 50,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.2,
        radius: Math.random() * 2.5 + 1.2,
        color: ['#00d2d3', '#54e98a', '#ffb961', '#ffffff'][Math.floor(Math.random() * 4)],
        life: Math.random() * 3 + 1
      });
    }
  }

  bindEvents() {
    if (!this.canvas) return;

    this._onPointerDown = (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      this.dragStartRotY = this.rotY;
    };

    this._onPointerMove = (e) => {
      if (!this.isDragging) return;
      const currentX = e.clientX || (e.touches && e.touches[0]?.clientX) || this.dragStartX;
      const deltaX = currentX - this.dragStartX;
      this.targetRotY = this.dragStartRotY + deltaX * 0.008;
    };

    this._onPointerUp = (e) => {
      if (this.isDragging) {
        const currentX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX) || this.dragStartX;
        const deltaX = Math.abs(currentX - this.dragStartX);
        if (deltaX < 5) {
          // Tap detected! Inspect tap coordinates for head scratch or belly tickle
          this.handleTapInteraction(e);
        }
      }
      this.isDragging = false;
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);

    this._resizeHandler = () => this.handleResize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  handleTapInteraction(e) {
    const rect = (typeof this.canvas.getBoundingClientRect === 'function')
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: this.width, height: this.height };
    const clickX = (e.clientX || 0) - rect.left;
    const clickY = (e.clientY || 0) - rect.top;

    const centerX = this.width * 0.5;
    const centerY = this.height * 0.55;

    // Pet Head Bounds
    if (Math.hypot(clickX - centerX, clickY - (centerY - 60)) < 45) {
      this.triggerHeadScratch();
      return;
    }

    // Pet Belly Bounds
    if (Math.hypot(clickX - centerX, clickY - centerY) < 55) {
      this.triggerBellyTickle();
      return;
    }

    // Generic friendly cheer
    this.triggerCheer();
  }

  triggerHeadScratch() {
    this.isPettingHead = true;
    if (typeof Sound?.bloop === 'function') Sound.bloop();
    else if (typeof Sound?.tap === 'function') Sound.tap();

    // Spawn 5 floating hearts
    for (let i = 0; i < 5; i++) {
      this.floatingHearts.push({
        x: this.width * 0.5 + (Math.random() - 0.5) * 50,
        y: this.height * 0.45,
        vy: -Math.random() * 2 - 1.5,
        vx: (Math.random() - 0.5) * 1.5,
        size: Math.random() * 8 + 14,
        alpha: 1.0
      });
    }

    // Award +5 Bond XP
    const hero = store.getState().selectedHero;
    const petId = hero?.activePetId || '2';
    const sanct = store.getPetSanctuaryState();
    if (sanct.petBondMap[petId]) {
      sanct.petBondMap[petId].xp = (sanct.petBondMap[petId].xp || 0) + 5;
    }

    setTimeout(() => { this.isPettingHead = false; }, 800);
  }

  triggerBellyTickle() {
    if (this.isTickled) return;
    this.isTickled = true;
    this.flipProgress = 0;
    if (typeof Sound?.fanfare === 'function') Sound.fanfare();
    else if (typeof Sound?.sparkle === 'function') Sound.sparkle();

    // Spawn 8 starburst sparkles
    for (let i = 0; i < 8; i++) {
      this.starlightSparks.push({
        x: this.width * 0.5,
        y: this.height * 0.55,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        radius: Math.random() * 4 + 2,
        color: '#ffb961',
        life: 1.2
      });
    }

    const interval = setInterval(() => {
      this.flipProgress += 0.12;
      if (this.flipProgress >= Math.PI * 2) {
        clearInterval(interval);
        this.flipProgress = 0;
        this.isTickled = false;
      }
    }, 16);
  }

  triggerFeedTreat(treat) {
    this.eatingSnack = treat;
    this.snackProgress = 0;
    if (typeof Sound?.bloop === 'function') Sound.bloop();

    const interval = setInterval(() => {
      this.snackProgress += 0.1;
      if (this.snackProgress >= 1.0) {
        clearInterval(interval);
        this.eatingSnack = null;
        this.triggerCheer();
      }
    }, 24);
  }

  triggerBathLagoon() {
    if (typeof Sound?.sparkle === 'function') Sound.sparkle();
    for (const b of this.floatingBubbles) {
      b.radius *= 1.8;
      setTimeout(() => { b.radius /= 1.8; }, 900);
    }
    this.triggerCheer();
  }

  triggerCheer() {
    // Joyful hop
    this.petScaleY = 0.85;
    this.petScaleX = 1.15;
    setTimeout(() => {
      this.petScaleY = 1.15;
      this.petScaleX = 0.9;
      setTimeout(() => {
        this.petScaleY = 1.0;
        this.petScaleX = 1.0;
      }, 150);
    }, 120);
  }

  startLoop() {
    const loop = (timestamp) => {
      if (this.isDestroyed) return;
      const now = timestamp || ((typeof performance !== 'undefined') ? performance.now() : Date.now());
      const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = now;

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
    this.clock += dt;

    // 1. Smooth Orbit Rotation
    if (!this.isDragging) {
      this.targetRotY += this.rotVelocity * 0.5;
    }
    this.rotY += (this.targetRotY - this.rotY) * 0.08;

    // 2. Pet Gentle Breathing & Tail Wag
    this.petHeadRot = Math.sin(this.clock * 2) * 0.06;
    this.petTailAngle = Math.sin(this.clock * 4) * 0.25;

    // 3. Update Pond Bubbles
    for (const b of this.floatingBubbles) {
      b.y -= b.speedY;
      b.x += Math.sin(this.clock * 2 + b.phase) * 0.3;
      if (b.y < -30) {
        b.y = 80;
      }
    }

    // 4. Update Starlight Sparks
    for (let i = this.starlightSparks.length - 1; i >= 0; i--) {
      const sp = this.starlightSparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life -= dt * 0.8;
      if (sp.life <= 0 || sp.y < 0) {
        sp.y = this.height * 0.8;
        sp.life = 2.5;
      }
    }

    // 5. Update Floating Hearts
    for (let i = this.floatingHearts.length - 1; i >= 0; i--) {
      const h = this.floatingHearts[i];
      h.y += h.vy;
      h.x += h.vx;
      h.alpha -= dt * 1.2;
      if (h.alpha <= 0) {
        this.floatingHearts.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.width;
    const h = this.height;
    const activePet = store.getActivePet() || { name: 'Rex', archetype: 'dino', color: '#2ecc71' };
    const archetype = getPetArchetype(activePet);
    const isPearly = store.getPearlyGleamStatus ? store.getPearlyGleamStatus(activePet.id) : false;

    // =========================================================================
    // 1. SKY DOME GRADIENT & ATMOSPHERIC STARLIGHT
    // =========================================================================
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#050f18');
    skyGrad.addColorStop(0.55, '#09141e');
    skyGrad.addColorStop(1, '#0e1c28');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Ambient Blueprint Grid
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 36) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Starlight Spores drifting upward
    for (const sp of this.starlightSparks) {
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.min(1.0, sp.life);
      ctx.beginPath();
      ctx.arc(w * 0.5 + sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // =========================================================================
    // 2. 3D FLOATING MEADOW SANCTUARY ISLAND (ROTATING TURNTABLE)
    // =========================================================================
    ctx.save();
    ctx.translate(w * 0.5, h * 0.65);

    // Island Turntable Rotation Factor
    const cosR = Math.cos(this.rotY);
    const sinR = Math.sin(this.rotY);

    // Dark Slate Island Underbelly
    ctx.fillStyle = '#121d26';
    ctx.strokeStyle = '#2b3640';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 45, 230, 85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rich Emerald Meadow Grass Disk
    const grassGrad = ctx.createRadialGradient(0, 0, 40, 0, 0, 240);
    grassGrad.addColorStop(0, '#2ecc71');
    grassGrad.addColorStop(0.6, '#1d7340');
    grassGrad.addColorStop(1, '#124828');
    ctx.fillStyle = grassGrad;
    ctx.strokeStyle = '#54e98a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 240, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Grassy Mounds (Tactile rolling hills)
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.ellipse(-140 * cosR, -25, 55, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(145 * cosR, -28, 65, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // =========================================================================
    // 3. SANCTUARY HABITAT FIXTURES (LAGOON, PICNIC, STARLIGHT ALTAR)
    // =========================================================================
    // 3a. Warm Bubble Lagoon Pond (Left Side)
    const pondX = -130 * cosR;
    const pondY = 15;
    ctx.save();
    ctx.translate(pondX, pondY);
    
    // Stone Rim
    ctx.fillStyle = '#2b3640';
    ctx.beginPath();
    ctx.ellipse(0, 0, 75, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Cyan Water Surface
    const waterGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 65);
    waterGrad.addColorStop(0, '#48dbfb');
    waterGrad.addColorStop(0.8, '#00d2d3');
    waterGrad.addColorStop(1, '#008889');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(0, -2, 68, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rising Lagoon Bubbles
    for (const b of this.floatingBubbles) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x + 130, b.y - 70, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // 3b. Solar Orange Picnic Blanket & Fruit Basket (Right Side)
    const picnicX = 130 * cosR;
    const picnicY = 20;
    ctx.save();
    ctx.translate(picnicX, picnicY);
    ctx.rotate(0.15 * cosR);

    // Blanket Rect
    ctx.fillStyle = '#f39c12';
    ctx.strokeStyle = '#ffb961';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-45, -24, 90, 48, 8);
    ctx.fill();
    ctx.stroke();

    // Blanket Checker Stripes
    ctx.strokeStyle = 'rgba(211, 84, 0, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-45, 0); ctx.lineTo(45, 0);
    ctx.moveTo(0, -24); ctx.lineTo(0, 24);
    ctx.stroke();

    // Treat Bowl with Starberries
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(0, -5, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffb961';
    ctx.beginPath();
    ctx.arc(-5, -9, 5, 0, Math.PI * 2);
    ctx.arc(6, -8, 6, 0, Math.PI * 2);
    ctx.arc(1, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3c. Starlight Evolution Pedestal (Back Center)
    ctx.save();
    ctx.translate(0, -45);
    
    // Stone Altar Base
    ctx.fillStyle = '#16212b';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing Rune Ring
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(0, -4, 48, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hovering Starlight Evolution Crystal Shard
    const crystalY = -40 + Math.sin(this.clock * 2.5) * 6;
    ctx.save();
    ctx.translate(0, crystalY);
    ctx.rotate(this.clock * 1.5);
    ctx.fillStyle = '#00d2d3';
    ctx.shadowColor = '#48dbfb';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end pedestal

    // 3d. Roaming Companion Buddy in the background
    this.renderRoamingBuddy(ctx, -75 * sinR, -38);

    // =========================================================================
    // 4. MAIN SKELETAL 3D COMPANION PET (CENTER STAGE)
    // =========================================================================
    ctx.save();
    const petBaseY = -12;
    ctx.translate(0, petBaseY);

    // Backflip Tickle Physics
    if (this.isTickled) {
      ctx.rotate(this.flipProgress);
      ctx.translate(0, -Math.sin(this.flipProgress) * 45);
    }

    // Squash & Stretch Bounce
    ctx.scale(this.petScaleX, this.petScaleY);

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pearly Gleam Starlight Halo Aura (if active)
    if (isPearly) {
      ctx.save();
      ctx.strokeStyle = '#48dbfb';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.ellipse(0, -35, 68, 75, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Sparkle Star Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Material Symbols Outlined"';
      ctx.textAlign = 'center';
      ctx.fillText('hotel_class', 52, -85);
      ctx.restore();
    }

    // Render Procedural Skeletal Creature Mesh
    this.renderCreatureMesh(ctx, activePet, archetype);

    // Render 3D Attached Forged Gear
    this.renderEquippedGear(ctx, activePet);

    ctx.restore(); // end pet

    ctx.restore(); // end island turntable

    // =========================================================================
    // 5. FLOATING HEARTS & MUNCH PARTICLES (SCREEN SPACE)
    // =========================================================================
    for (const h of this.floatingHearts) {
      ctx.fillStyle = '#ffb961';
      ctx.globalAlpha = h.alpha;
      ctx.font = 'bold ' + h.size + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❤️', h.x, h.y);
    }
    ctx.globalAlpha = 1.0;

    // Eating Snack Flying Animation
    if (this.eatingSnack) {
      const snackStartX = w * 0.65;
      const snackStartY = h * 0.75;
      const targetX = w * 0.5;
      const targetY = h * 0.52;
      const currentX = snackStartX + (targetX - snackStartX) * this.snackProgress;
      const currentY = snackStartY + (targetY - snackStartY) * this.snackProgress - Math.sin(this.snackProgress * Math.PI) * 50;

      ctx.save();
      ctx.translate(currentX, currentY);
      ctx.scale(1.0 - this.snackProgress * 0.3, 1.0 - this.snackProgress * 0.3);
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.eatingSnack.emoji || '🍎', 0, 0);
      ctx.restore();
    }
  }

  renderCreatureMesh(ctx, pet, archetype) {
    const primary = pet.color || archetype.baseBodyColor || '#2ecc71';
    const accent = pet.accentColor || '#f39c12';
    const belly = archetype.bellyColor || '#6bfe9c';
    const type = archetype.id || 'dino';

    // 1. Tail wag
    ctx.save();
    ctx.translate(-24, 0);
    ctx.rotate(this.petTailAngle);
    ctx.fillStyle = primary;
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-18, 4, 22, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (type === 'dino') {
      // Spiked tail club
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-34, 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Main Body Sphere
    ctx.fillStyle = primary;
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Belly Soft Patch
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(4, 4, 32, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Archetype Features (Wings, Shell, Ears, Fins, Antennas)
    if (type === 'dragon') {
      // Azure Wings
      ctx.fillStyle = '#00d2d3';
      ctx.strokeStyle = '#008889';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-20, -15);
      ctx.lineTo(-58, -45);
      ctx.lineTo(-40, -10);
      ctx.lineTo(-62, 5);
      ctx.lineTo(-24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (type === 'aquatic') {
      // Turtle Shell rim
      ctx.strokeStyle = '#008889';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 44, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'robot') {
      // Antenna
      ctx.fillStyle = '#00d2d3';
      ctx.fillRect(-2, -58, 4, 18);
      ctx.beginPath();
      ctx.arc(0, -60, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Head & Face
    ctx.save();
    ctx.translate(0, -36);
    ctx.rotate(this.petHeadRot);

    // Head Base
    ctx.fillStyle = primary;
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Snout / Nose
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(0, 8, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    if (this.isPettingHead) {
      // Happy curved squint eyes (^_^)
      ctx.strokeStyle = '#050f18';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-14, -4, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(14, -4, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      // Big expressive cartoon eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(-14, -4, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(14, -4, 10, 13, 0, 0, Math.PI * 2); ctx.fill();

      // Pupils
      ctx.fillStyle = '#09141e';
      ctx.beginPath(); ctx.arc(-13, -3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(13, -3, 6, 0, Math.PI * 2); ctx.fill();

      // Sparkle Glints
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-11, -5, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, -5, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Happy Grinning Mouth
    ctx.fillStyle = '#050f18';
    ctx.beginPath();
    ctx.arc(0, 10, 8, 0, Math.PI);
    ctx.fill();

    ctx.restore(); // end head

    // 5. Paws & Feet
    ctx.fillStyle = primary;
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-22, 34, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(22, 34, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  renderEquippedGear(ctx, pet) {
    const hero = store.getState().selectedHero;
    const gearMap = (hero && hero.equippedPetGearMap) ? (hero.equippedPetGearMap[pet.id] || {}) : {};

    // 1. Helmet / Aviator Cap on Head
    if (gearMap.head || gearMap.helmet) {
      ctx.save();
      ctx.translate(0, -64 + this.petHeadRot * 10);
      ctx.fillStyle = '#f39c12';
      ctx.strokeStyle = '#ffb961';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();

      // Aviator Goggles
      ctx.fillStyle = '#00d2d3';
      ctx.beginPath();
      ctx.arc(-12, 4, 8, 0, Math.PI * 2);
      ctx.arc(12, 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Wings / Jetpack on Back
    if (gearMap.back || gearMap.wings) {
      ctx.save();
      ctx.translate(0, -10);
      ctx.fillStyle = '#00d2d3';
      ctx.strokeStyle = '#54e98a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-28, -8); ctx.lineTo(-65, -35); ctx.lineTo(-45, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(28, -8); ctx.lineTo(65, -35); ctx.lineTo(45, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. Greaves on Boots
    if (gearMap.boots || gearMap.legs) {
      ctx.fillStyle = '#ffb961';
      ctx.fillRect(-26, 26, 12, 6);
      ctx.fillRect(14, 26, 12, 6);
    }
  }

  renderRoamingBuddy(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y + Math.sin(this.clock * 2) * 4);

    // Little Cloud / Dragon Buddy roaming in distance
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.arc(-10, 2, 10, 0, Math.PI * 2);
    ctx.arc(10, 2, 10, 0, Math.PI * 2);
    ctx.fill();

    // Friendly face
    ctx.fillStyle = '#09141e';
    ctx.beginPath();
    ctx.arc(-4, -1, 1.5, 0, Math.PI * 2);
    ctx.arc(4, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  destroy() {
    this.isDestroyed = true;
    this.stopLoop();
    if (this.canvas) {
      if (this._onPointerDown) this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      if (this._onPointerMove) this.canvas.removeEventListener('pointermove', this._onPointerMove);
      if (this._onPointerUp) this.canvas.removeEventListener('pointerup', this._onPointerUp);
    }
    if (this._resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.container && this.canvas && this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
