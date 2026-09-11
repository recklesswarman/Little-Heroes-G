/**
 * BossColosseumCanvas.js
 * 
 * High-performance 3D Canvas Engine for the Hygiene Boss Blaster Colosseum
 * Features:
 * - 3D Candy Kingdom Ruins with dynamic sugar-to-enamel cleanup transformation
 * - 3D procedural Boss entity with auto-aim tracking, squishy hit physics & dizzy spins
 * - Slime Bomb projectile physics with physical shield deflection ricochet
 * - Auto-aim minty foam blaster streams
 * - Chore Supernova screen-clearing mega-bubble
 * - Companion Pet (Rex) 3D assist in foreground
 */

import { store } from '../state/store.js';
import { getHygieneBoss, HYGIENE_BOSSES } from '../data/hygieneBossesData.js';
import { Sound } from '../audio/sfx.js';

export class BossColosseumCanvas {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.bossId = options.bossId || 'sugar_bandit';
    this.bossData = getHygieneBoss(this.bossId) || HYGIENE_BOSSES[0];

    // Engine Dimensions
    this.width = 600;
    this.height = 420;
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.isDestroyed = false;

    // Simulation Timing
    this.clock = 0;
    this.lastTimestamp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // Auto-Aim Blaster & Nozzle Position
    this.aimX = this.width * 0.5;
    this.aimY = this.height * 0.4;
    this.nozzleX = this.width * 0.5;
    this.nozzleY = this.height * 0.95;

    // Particles & Projectiles
    this.foamBubbles = [];
    this.bossBombs = [];
    this.sparkles = [];
    this.cleanEnamelTiles = [];

    // Boss State & Physics
    this.bossX = this.width * 0.5;
    this.bossY = this.height * 0.38;
    this.bossBaseY = this.height * 0.38;
    this.bossScale = 1.0;
    this.bossWobble = 0;
    this.bossRotZ = 0;
    this.isBossDizzy = false;

    // Deflection Shield Physics
    this.shieldActiveTime = 0;
    this.shieldAlpha = 0;

    // Bomb Spawn Timer
    this.nextBombTime = 2.5;

    // Initialize Components
    this.initCanvas();
    this.initEnamelTiles();
    this.bindEvents();
    this.startLoop();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full block cursor-crosshair select-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = (typeof this.canvas.getContext === 'function') ? this.canvas.getContext('2d') : null;
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = (typeof this.container.getBoundingClientRect === 'function')
      ? this.container.getBoundingClientRect()
      : { width: this.container.clientWidth || 600, height: this.container.clientHeight || 420 };
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    this.width = rect.width || 600;
    this.height = rect.height || 420;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;

    this.bossX = this.width * 0.5;
    this.bossBaseY = this.height * 0.38;
    this.bossY = this.bossBaseY;
    this.nozzleX = this.width * 0.5;
    this.nozzleY = this.height * 0.95;

    if (this.ctx && typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  initEnamelTiles() {
    this.cleanEnamelTiles = [];
    const rows = 5;
    const cols = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.cleanEnamelTiles.push({
          x: c * (this.width / cols),
          y: this.height * 0.68 + r * 22,
          w: this.width / cols + 2,
          h: 24,
          cleanOrder: Math.random(),
          sparkleDelay: Math.random() * 2
        });
      }
    }
  }

  bindEvents() {
    if (!this.canvas) return;

    // Swipe and Tap Gestures
    let startY = 0;
    let startX = 0;
    let startTime = 0;

    this._onPointerDown = (e) => {
      startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      startY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
      startTime = Date.now();
    };

    this._onPointerUp = (e) => {
      const endX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX) || startX;
      const endY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY) || startY;
      const deltaY = endY - startY;
      const deltaX = endX - startX;
      const duration = Date.now() - startTime;

      if (duration < 350) {
        if (deltaY < -40) {
          // Swipe Up -> Rapid Foam Blast
          this.fireFoam();
        } else if (deltaY > 40) {
          // Swipe Down -> Deflect Shield
          this.triggerDeflect();
        } else {
          // Tap anywhere -> Fire Foam at boss
          this.fireFoam();
        }
      }
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointerup', this._onPointerUp);

    this._resizeHandler = () => this.handleResize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  fireFoam() {
    const col = store.getBossColosseumState();
    if (col.currentHp <= 0) return;

    // Launch burst of 8 bubbly foam particles
    const bubbleColors = ['#48dbfb', '#00d2d3', '#54e98a', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.65;
      const speed = Math.random() * 6 + 13;
      this.foamBubbles.push({
        x: this.nozzleX + (Math.random() - 0.5) * 20,
        y: this.nozzleY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 10 + 9,
        color: bubbleColors[Math.floor(Math.random() * bubbleColors.length)],
        life: 1.0,
        decay: Math.random() * 0.02 + 0.025,
        targetX: this.bossX + (Math.random() - 0.5) * 50,
        targetY: this.bossY + (Math.random() - 0.5) * 40
      });
    }

    if (typeof Sound?.tap === 'function') Sound.tap();
    else if (typeof Sound?.bloop === 'function') Sound.bloop();

    // Trigger state damage
    store.fireColosseumBlaster();

    // Jiggle boss
    this.bossWobble = 1.0;
  }

  triggerDeflect() {
    this.shieldActiveTime = 0.8; // active for 800ms
    this.shieldAlpha = 1.0;

    // Deflect any approaching bomb in the lower half
    let deflectedCount = 0;
    for (const bomb of this.bossBombs) {
      if (bomb.y > this.height * 0.45 && bomb.vy > 0) {
        bomb.vy = -Math.abs(bomb.vy) * 1.5; // bounce back up
        bomb.vx = (Math.random() - 0.5) * 4;
        bomb.deflected = true;
        deflectedCount++;
      }
    }

    store.triggerColosseumDeflect();

    if (deflectedCount > 0) {
      this.bossWobble = 1.6;
      this.isBossDizzy = true;
      setTimeout(() => { this.isBossDizzy = false; }, 900);
      if (typeof Sound?.hit === 'function') Sound.hit();
    }
  }

  triggerSupernova() {
    const res = store.unleashChoreSupernova();
    if (!res.success) return;

    // Deflect/vaporize all bombs
    this.bossBombs = [];

    // Screen clearing starlight bubble ring
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2;
      const speed = Math.random() * 7 + 8;
      this.sparkles.push({
        x: this.width * 0.5,
        y: this.height * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 9 + 5,
        color: ['#ffb961', '#54e98a', '#00d2d3', '#ffffff'][Math.floor(Math.random() * 4)],
        life: 1.2
      });
    }

    this.bossWobble = 2.0;
    this.isBossDizzy = true;
    setTimeout(() => { this.isBossDizzy = false; }, 1400);
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
    const col = store.getBossColosseumState();

    // 1. Boss Floating & Wobble Physics
    this.bossY = this.bossBaseY + Math.sin(this.clock * 2.2) * 10;
    if (this.bossWobble > 0) {
      this.bossWobble = Math.max(0, this.bossWobble - dt * 2.5);
    }
    if (this.isBossDizzy) {
      this.bossRotZ = Math.sin(this.clock * 14) * 0.18;
    } else {
      this.bossRotZ = Math.sin(this.clock * 1.5) * 0.04;
    }

    // 2. Shield Fade
    if (this.shieldActiveTime > 0) {
      this.shieldActiveTime -= dt;
      this.shieldAlpha = Math.min(1.0, this.shieldActiveTime * 1.8);
    } else {
      this.shieldAlpha = 0;
    }

    // 3. Update Foam Bubbles (Arced stream towards boss)
    for (let i = this.foamBubbles.length - 1; i >= 0; i--) {
      const b = this.foamBubbles[i];
      // Steer slightly towards boss
      b.x += (b.targetX - b.x) * 0.06;
      b.y += b.vy;
      b.life -= b.decay;

      // Hit boss test
      const dist = Math.hypot(b.x - this.bossX, b.y - this.bossY);
      if (dist < 55) {
        // Pop sparkle
        for (let s = 0; s < 2; s++) {
          this.sparkles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: Math.random() * 4 + 2,
            color: b.color,
            life: 0.5
          });
        }
        this.foamBubbles.splice(i, 1);
        continue;
      }

      if (b.life <= 0 || b.y < -20) {
        this.foamBubbles.splice(i, 1);
      }
    }

    // 4. Boss Bomb Emitter
    if (col.currentHp > 0) {
      this.nextBombTime -= dt;
      if (this.nextBombTime <= 0) {
        this.nextBombTime = Math.random() * 2.5 + 3.0; // every 3-5.5s
        // Launch bomb
        this.bossBombs.push({
          x: this.bossX + (Math.random() - 0.5) * 30,
          y: this.bossY + 20,
          vx: (Math.random() - 0.5) * 2.2,
          vy: Math.random() * 1.5 + 3.2,
          size: 16,
          color: this.bossData.bombColor || '#f39c12',
          rot: 0,
          deflected: false
        });
      }
    }

    // 5. Update Boss Bombs
    for (let i = this.bossBombs.length - 1; i >= 0; i--) {
      const bomb = this.bossBombs[i];
      bomb.x += bomb.vx;
      bomb.y += bomb.vy;
      bomb.rot += 0.08;

      // If bomb was deflected back and hits boss
      if (bomb.deflected && bomb.vy < 0) {
        const dist = Math.hypot(bomb.x - this.bossX, bomb.y - this.bossY);
        if (dist < 60) {
          // Counter attack hit!
          this.bossWobble = 1.4;
          for (let s = 0; s < 12; s++) {
            this.sparkles.push({
              x: bomb.x,
              y: bomb.y,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              size: Math.random() * 6 + 3,
              color: '#54e98a',
              life: 0.8
            });
          }
          this.bossBombs.splice(i, 1);
          continue;
        }
      }

      // Check if off screen
      if (bomb.y > this.height + 40 || bomb.y < -50) {
        this.bossBombs.splice(i, 1);
      }
    }

    // 6. Update Sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life -= dt * 1.5;
      if (sp.life <= 0) {
        this.sparkles.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.width;
    const h = this.height;
    const col = store.getBossColosseumState();
    const cleanRatio = Math.min(1.0, (col.enamelCleanPercent || 0) / 100);

    // =========================================================================
    // 1. BACKGROUND & DYNAMIC SUGAR-TO-ENAMEL TRANSFORMATION
    // =========================================================================
    // Sky Dome Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#050f18');
    skyGrad.addColorStop(0.5, '#09141e');
    skyGrad.addColorStop(1, '#0e1c28');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Ambient Blueprint Grid
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Distant 3D Crumbling Candy Columns (Left & Right)
    this.renderRuinsColumn(ctx, w * 0.12, h * 0.22, 45, h * 0.55, cleanRatio, -0.06);
    this.renderRuinsColumn(ctx, w * 0.88, h * 0.22, 45, h * 0.55, cleanRatio, 0.06);

    // Floor Riverbed: Caramel (Dirty) vs Pearly White Enamel (Cleaned)
    const riverY = h * 0.72;
    const riverGrad = ctx.createLinearGradient(0, riverY, 0, h);
    if (cleanRatio < 0.8) {
      riverGrad.addColorStop(0, '#d35400');
      riverGrad.addColorStop(0.5, '#f39c12');
      riverGrad.addColorStop(1, '#16212b');
    } else {
      riverGrad.addColorStop(0, '#00d2d3');
      riverGrad.addColorStop(0.5, '#54e98a');
      riverGrad.addColorStop(1, '#121d26');
    }
    ctx.fillStyle = riverGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, riverY + 30, w * 0.48, 55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render Enamel Clean Tiles on Floor
    for (const tile of this.cleanEnamelTiles) {
      const isTileClean = cleanRatio >= tile.cleanOrder;
      ctx.fillStyle = isTileClean ? 'rgba(255, 255, 255, 0.85)' : 'rgba(243, 156, 18, 0.45)';
      ctx.strokeStyle = isTileClean ? '#00d2d3' : '#b36b00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(tile.x + 2, tile.y, tile.w - 4, tile.h - 2, 6);
      ctx.fill();
      ctx.stroke();

      if (isTileClean && Math.sin(this.clock * 3 + tile.sparkleDelay) > 0.85) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tile.x + tile.w * 0.5, tile.y + 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // =========================================================================
    // 2. 3D BOSS ENTITY (THE SUGAR BANDIT KING / PLAQUE KRAKEN / CAVITY KNIGHT)
    // =========================================================================
    ctx.save();
    ctx.translate(this.bossX, this.bossY);
    ctx.rotate(this.bossRotZ);
    const wobbleScale = 1.0 + Math.sin(this.clock * 20) * 0.12 * this.bossWobble;
    ctx.scale(wobbleScale, 1.0 / wobbleScale);

    // Drop Shadow underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 65, 55, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boss Body Geometry
    this.renderBossGraphic(ctx, this.bossData);

    // Active Tartar Shield Shell
    if (col.isShieldActive && col.shieldHp > 0) {
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(243, 156, 18, 0.2)';
      ctx.fill();

      // Shield HP badge
      ctx.fillStyle = '#ffb961';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SHIELD: ' + col.shieldHp + ' HP', 0, -78);
    }

    ctx.restore();

    // =========================================================================
    // 3. INCOMING SUGAR BOMBS & TARGET RETICLES
    // =========================================================================
    for (const bomb of this.bossBombs) {
      ctx.save();
      ctx.translate(bomb.x, bomb.y);
      ctx.rotate(bomb.rot);

      // Warning target reticle if heading towards player
      if (bomb.y > this.height * 0.45 && !bomb.deflected) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, bomb.size * 1.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Bomb Sphere
      ctx.fillStyle = bomb.deflected ? '#54e98a' : bomb.color;
      ctx.beginPath();
      ctx.arc(0, 0, bomb.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Candy Swirl / Core
      ctx.strokeStyle = bomb.deflected ? '#003919' : '#050f18';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, bomb.size * 0.5, 0, Math.PI * 1.5);
      ctx.stroke();

      ctx.restore();
    }

    // =========================================================================
    // 4. MINTY FOAM BUBBLE STREAMS & SPARKLES
    // =========================================================================
    for (const b of this.foamBubbles) {
      ctx.fillStyle = b.color;
      ctx.globalAlpha = Math.min(1.0, b.life * 1.2);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bubble highlight glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    for (const sp of this.sparkles) {
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.min(1.0, sp.life);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // =========================================================================
    // 5. TOOTH SHIELD DEFLECTION BARRIER (WHEN DEFLECT IS TRIGGERED)
    // =========================================================================
    if (this.shieldAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = this.shieldAlpha;
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#54e98a';
      ctx.shadowBlur = 24;

      const shieldY = h * 0.76;
      ctx.beginPath();
      ctx.arc(w * 0.5, shieldY + 60, 110, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
      ctx.fill();

      // Tooth Icon in center of shield
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Material Symbols Outlined", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('shield', w * 0.5, shieldY - 18);

      ctx.restore();
    }

    // =========================================================================
    // 6. COMPANION PET (REX) IN FOREGROUND CHEERING
    // =========================================================================
    this.renderRexAssist(ctx, w * 0.16, h * 0.86);

    // =========================================================================
    // 7. BLASTER NOZZLE AT BOTTOM CENTER
    // =========================================================================
    ctx.save();
    ctx.fillStyle = '#16212b';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(this.nozzleX - 24, h - 35, 48, 40, [12, 12, 0, 0]);
    ctx.fill();
    ctx.stroke();

    // Glowing Minty Nozzle Tip
    ctx.fillStyle = '#00d2d3';
    ctx.beginPath();
    ctx.ellipse(this.nozzleX, h - 30, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderRuinsColumn(ctx, x, y, width, height, cleanRatio, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // Column Shaft
    const colGrad = ctx.createLinearGradient(-width * 0.5, 0, width * 0.5, 0);
    if (cleanRatio >= 0.8) {
      colGrad.addColorStop(0, '#ffffff');
      colGrad.addColorStop(0.5, '#e0f7fa');
      colGrad.addColorStop(1, '#b2ebf2');
    } else {
      colGrad.addColorStop(0, '#16212b');
      colGrad.addColorStop(0.5, '#2b3640');
      colGrad.addColorStop(1, '#0e1720');
    }
    ctx.fillStyle = colGrad;
    ctx.fillRect(-width * 0.5, 0, width, height);

    // Candy Cane Spiral Stripes (Cyan & Solar Orange, no pink/purple)
    ctx.fillStyle = cleanRatio >= 0.8 ? '#00d2d3' : '#f39c12';
    for (let i = 20; i < height - 20; i += 45) {
      ctx.beginPath();
      ctx.moveTo(-width * 0.5, i);
      ctx.lineTo(width * 0.5, i - 14);
      ctx.lineTo(width * 0.5, i + 6);
      ctx.lineTo(-width * 0.5, i + 20);
      ctx.fill();
    }

    // Column Base & Capital
    ctx.fillStyle = cleanRatio >= 0.8 ? '#54e98a' : '#2b3640';
    ctx.fillRect(-width * 0.6, -12, width * 1.2, 14);
    ctx.fillRect(-width * 0.6, height, width * 1.2, 14);

    ctx.restore();
  }

  renderBossGraphic(ctx, boss) {
    // 3D Procedural Cartoon Monster
    const isKraken = boss.id === 'plaque_kraken';
    const isKnight = boss.id === 'cavity_knight';

    // Main Blob/Body
    ctx.fillStyle = boss.color || '#f39c12';
    ctx.beginPath();
    ctx.ellipse(0, 0, 52, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Body Texture / Crown
    if (isKraken) {
      // Slime Tentacles
      ctx.fillStyle = '#1b7a43';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 18, 42, 9, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isKnight) {
      // Cavity Knight Helmet Horns
      ctx.fillStyle = '#2b3640';
      ctx.beginPath();
      ctx.moveTo(-35, -25); ctx.lineTo(-55, -60); ctx.lineTo(-20, -35);
      ctx.moveTo(35, -25); ctx.lineTo(55, -60); ctx.lineTo(20, -35);
      ctx.fill();
    } else {
      // Sugar Bandit Crown
      ctx.fillStyle = '#f39c12';
      ctx.strokeStyle = '#d35400';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-32, -35);
      ctx.lineTo(-22, -58);
      ctx.lineTo(-8, -42);
      ctx.lineTo(0, -66);
      ctx.lineTo(8, -42);
      ctx.lineTo(22, -58);
      ctx.lineTo(32, -35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Googly Eyes (Looking towards nozzle)
    const eyeOffsetX = (this.nozzleX - (this.bossX || this.width * 0.5)) * 0.015;
    const eyeOffsetY = 3.5;

    // Left Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-18, -10, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#050f18'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#09141e';
    ctx.beginPath(); ctx.arc(-18 + eyeOffsetX, -10 + eyeOffsetY, 6.5, 0, Math.PI * 2); ctx.fill();

    // Right Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(18, -10, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#050f18'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#09141e';
    ctx.beginPath(); ctx.arc(18 + eyeOffsetX, -10 + eyeOffsetY, 6.5, 0, Math.PI * 2); ctx.fill();

    // Grinning Mouth with Tartar Teeth
    ctx.fillStyle = '#09141e';
    ctx.beginPath();
    ctx.arc(0, 18, 22, 0, Math.PI);
    ctx.fill();

    // Tartar Teeth
    ctx.fillStyle = '#ffb961';
    ctx.fillRect(-14, 18, 7, 8);
    ctx.fillRect(-3, 18, 7, 8);
    ctx.fillRect(8, 18, 7, 8);
  }

  renderRexAssist(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y + Math.sin(this.clock * 3) * 4);

    // Pedestal
    ctx.fillStyle = '#16212b';
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-30, 24, 60, 14, 6);
    ctx.fill();
    ctx.stroke();

    // Rex Dino Body (Emerald Green Toy)
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dino Snout
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.roundRect(-8, -12, 24, 16, 6);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-2, -14, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#050f18';
    ctx.beginPath(); ctx.arc(-1, -14, 2.5, 0, Math.PI * 2); ctx.fill();

    // Cheering arms
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-14, 4); ctx.lineTo(-24, -8);
    ctx.moveTo(14, 4); ctx.lineTo(24, -8);
    ctx.stroke();

    ctx.restore();
  }

  destroy() {
    this.isDestroyed = true;
    this.stopLoop();
    if (this.canvas) {
      if (this._onPointerDown) this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      if (this._onPointerUp) this.canvas.removeEventListener('pointerup', this._onPointerUp);
    }
    if (this._resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }
}
