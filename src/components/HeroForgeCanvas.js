/**
 * HeroForgeCanvas.js
 * 
 * Interactive 3D Canvas for the Hero Crafting Forge & Tinkering Lab:
 * - Mode 1: 3D Magnetic Forge Anvil & Turntable (360° rotation, hammer sparks, custom dyes)
 * - Mode 2: 3D Testing Range (Wind Tunnel for wings, Target Range for shields, Super Jump for boots)
 */

import { store } from '../state/store.js';
import { getBlueprintById } from '../data/heroForgeData.js';

export class HeroForgeCanvas {
  constructor(containerElement, onAnvilStruck = null) {
    this.container = containerElement;
    this.onAnvilStruck = onAnvilStruck;

    this.canvas = null;
    this.ctx = null;
    this.animId = null;

    this.width = 600;
    this.height = 360;

    // Turntable rotation & tilt
    this.rotationY = 0.4;
    this.tiltX = 0.15;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Hammer & Spark Physics
    this.hammerProgress = 0; // 0 (idle) to 1 (struck)
    this.isStriking = false;
    this.heatGlow = 0.0;
    this.sparks = [];

    // Wind Tunnel / Testing Particles
    this.airstreams = [];
    this.testBalls = [];
    this.testJumpY = 0;
    this.testJumpVy = 0;

    this.initCanvas();
    this.initParticles();
    this.bindEvents();
    this.startLoop();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing select-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = typeof this.canvas.getContext === 'function' ? this.canvas.getContext('2d') : null;
    this.handleResize();
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = typeof this.container.getBoundingClientRect === 'function'
      ? this.container.getBoundingClientRect()
      : { width: this.container.clientWidth || 600, height: this.container.clientHeight || 360 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width || 600;
    this.height = rect.height || 360;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx && typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }

  initParticles() {
    this.sparks = [];
    this.airstreams = [];
    for (let i = 0; i < 35; i++) {
      this.airstreams.push({
        x: Math.random() * 800 - 400,
        y: (Math.random() - 0.5) * 220,
        z: Math.random() * 600 + 100,
        speed: Math.random() * 14 + 16,
        length: Math.random() * 70 + 40,
        color: ['#00d2d3', '#54e98a', '#ffffff'][Math.floor(Math.random() * 3)]
      });
    }

    this.testBalls = [];
    for (let i = 0; i < 6; i++) {
      this.testBalls.push({
        x: 350 + i * 160,
        y: (Math.random() - 0.5) * 60,
        z: 300,
        radius: 12,
        deflected: false,
        vy: 0
      });
    }
  }

  bindEvents() {
    this._resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this._resizeHandler);

    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragStartY = clientY;
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      this.dragStartX = clientX;
      this.dragStartY = clientY;

      this.rotationY += dx * 0.012;
      this.tiltX = Math.max(-0.35, Math.min(0.45, this.tiltX + dy * 0.008));
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    this._mouseMoveHandler = (e) => onMove(e.clientX, e.clientY);
    this._mouseUpHandler = onEnd;
    window.addEventListener('mousemove', this._mouseMoveHandler);
    window.addEventListener('mouseup', this._mouseUpHandler);

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this._touchMoveHandler = (e) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.addEventListener('touchmove', this._touchMoveHandler, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  // Trigger Anvil Hammer Strike Action
  strikeAnvil() {
    this.isStriking = true;
    this.hammerProgress = 1.0;
    this.heatGlow = 1.0;

    // Spawn 25 radial sparks
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 6;
      this.sparks.push({
        x: 0,
        y: 10,
        z: 300,
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle)) * speed - 4,
        life: 1.0,
        color: ['#f1c40f', '#f39c12', '#ffffff', '#2ecc71'][Math.floor(Math.random() * 4)]
      });
    }

    if (this.onAnvilStruck) {
      this.onAnvilStruck();
    }
  }

  project3D(x, y, z, rotY = 0, tiltX = 0) {
    // Rotate about Y
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY + 300;

    // Tilt about X
    const cosT = Math.cos(tiltX);
    const sinT = Math.sin(tiltX);
    const y1 = y * cosT - z1 * sinT;
    const z2 = y * sinT + z1 * cosT;

    if (z2 <= 20) return null;
    const fov = 380;
    const scale = fov / z2;
    const screenX = this.width / 2 + x1 * scale;
    const screenY = this.height / 2 + y1 * scale;

    return { screenX, screenY, scale, zDepth: z2 };
  }

  startLoop() {
    const loop = (time) => {
      this.update();
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

  update() {
    // Slowly spin turntable when user is not dragging
    if (!this.isDragging) {
      this.rotationY += 0.008;
    }

    // Cool down forge heat glow
    if (this.heatGlow > 0) {
      this.heatGlow = Math.max(0, this.heatGlow - 0.025);
    }

    // Hammer spring return
    if (this.hammerProgress > 0) {
      this.hammerProgress = Math.max(0, this.hammerProgress - 0.08);
    }

    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.45; // gravity
      s.life -= 0.04;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Mode 2 updates (Wind Tunnel / Target Range / Super Jump)
    const forge = store.getHeroForgeState();
    if (forge.forgeMode === 'testing') {
      // Stream airstreams horizontally
      for (const stream of this.airstreams) {
        stream.x -= stream.speed;
        if (stream.x < -400) {
          stream.x = 400;
          stream.y = (Math.random() - 0.5) * 200;
        }
      }

      // Foam target deflection
      for (const ball of this.testBalls) {
        if (!ball.deflected) {
          ball.x -= 10;
          if (ball.x < 30) {
            // Deflected by shield!
            ball.deflected = true;
            ball.vy = (Math.random() - 0.5) * 12 - 6;
          }
        } else {
          ball.x += 14;
          ball.y += ball.vy;
          if (ball.x > 450) {
            ball.x = 450 + Math.random() * 100;
            ball.deflected = false;
          }
        }
      }

      // Super jump bounce
      this.testJumpY += this.testJumpVy;
      this.testJumpVy += 0.6; // gravity
      if (this.testJumpY > 0) {
        this.testJumpY = 0;
        this.testJumpVy = -13; // bounce
      }
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.width;
    const h = this.height;
    const forge = store.getHeroForgeState();
    const bp = getBlueprintById(forge.selectedBlueprintId);
    const dyes = forge.customDyes || { primary: '#2ecc71', accent: '#f39c12', glow: '#00d2d3' };
    const isTesting = forge.forgeMode === 'testing';

    // 1. WORKSHOP BACKGROUND
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#050f18');
    bgGrad.addColorStop(0.5, '#09141e');
    bgGrad.addColorStop(1, '#0e1c28');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle Workshop Blueprint Grid
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.07)';
    ctx.lineWidth = 1;
    const gridSize = 28;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (!isTesting) {
      // =========================================================
      // MODE 1: 3D FORGE ANVIL & MAGNETIC TURNTABLE
      // =========================================================

      // Turntable Base Platform
      const baseProj = this.project3D(0, 75, 0, 0, this.tiltX);
      if (baseProj) {
        const radX = 130 * baseProj.scale;
        const radY = 40 * baseProj.scale;

        // Heated Base Ring
        const ringGrad = ctx.createRadialGradient(baseProj.screenX, baseProj.screenY, 10, baseProj.screenX, baseProj.screenY, radX);
        ringGrad.addColorStop(0, this.heatGlow > 0.1 ? `rgba(243, 156, 18, ${this.heatGlow})` : 'rgba(84, 233, 138, 0.25)');
        ringGrad.addColorStop(0.6, 'rgba(18, 29, 38, 0.8)');
        ringGrad.addColorStop(1, 'rgba(5, 15, 24, 0.95)');

        ctx.fillStyle = ringGrad;
        ctx.beginPath();
        ctx.ellipse(baseProj.screenX, baseProj.screenY, radX, radY, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.heatGlow > 0.1 ? '#f39c12' : '#2ecc71';
        ctx.lineWidth = 2.5 * baseProj.scale;
        ctx.stroke();

        // Magnetic Coils / Runes
        ctx.strokeStyle = dyes.glow;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(baseProj.screenX, baseProj.screenY - 10 * baseProj.scale, radX * 0.8, radY * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3D Procedural Mesh on Turntable
      this.render3DGearMesh(ctx, bp, dyes, this.rotationY, this.tiltX);

      // Render Anvil Sparks
      for (const spark of this.sparks) {
        const sp = this.project3D(spark.x, spark.y, spark.z, this.rotationY, this.tiltX);
        if (sp) {
          ctx.fillStyle = spark.color;
          ctx.globalAlpha = spark.life;
          ctx.beginPath();
          ctx.arc(sp.screenX, sp.screenY, Math.max(1, 3 * spark.life), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      // Anvil Hammer Strike Graphic Overlay
      if (this.hammerProgress > 0.05) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        const hammerAngle = -Math.PI / 4 + (1.0 - this.hammerProgress) * 0.8;
        ctx.rotate(hammerAngle);
        ctx.fillStyle = '#b86a04';
        ctx.fillRect(-8, -90, 16, 75); // handle
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-22, -115, 44, 25); // hammer head
        ctx.restore();
      }

    } else {
      // =========================================================
      // MODE 2: 3D TESTING RANGE
      // =========================================================
      this.renderTestingRange(ctx, bp, dyes);
    }
  }

  render3DGearMesh(ctx, bp, dyes, rotY, tiltX) {
    const meshType = bp?.meshType || 'jetpack';
    const centerY = -15;

    const pCenter = this.project3D(0, centerY, 0, rotY, tiltX);
    if (!pCenter) return;
    const scale = pCenter.scale;
    const cx = pCenter.screenX;
    const cy = pCenter.screenY;

    // Glowing Core Aura
    const glowGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 70 * scale);
    glowGrad.addColorStop(0, dyes.glow);
    glowGrad.addColorStop(0.5, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, 70 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    if (meshType === 'jetpack') {
      // Main Center Chassis
      ctx.fillStyle = dyes.primary;
      ctx.strokeStyle = dyes.accent;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.roundRect(cx - 28 * scale, cy - 35 * scale, 56 * scale, 70 * scale, 12 * scale);
      ctx.fill();
      ctx.stroke();

      // Twin Rocket Thruster Cylinders (Left & Right)
      ctx.fillStyle = dyes.accent;
      ctx.beginPath();
      ctx.roundRect(cx - 52 * scale, cy - 25 * scale, 18 * scale, 60 * scale, 8 * scale);
      ctx.roundRect(cx + 34 * scale, cy - 25 * scale, 18 * scale, 60 * scale, 8 * scale);
      ctx.fill();
      ctx.stroke();

      // Cyan Glowing Thruster Plumes
      const plumeGrad = ctx.createLinearGradient(cx, cy + 35 * scale, cx, cy + 75 * scale);
      plumeGrad.addColorStop(0, dyes.glow);
      plumeGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 52 * scale, cy + 35 * scale);
      ctx.lineTo(cx - 34 * scale, cy + 35 * scale);
      ctx.lineTo(cx - 43 * scale, cy + 70 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx + 34 * scale, cy + 35 * scale);
      ctx.lineTo(cx + 52 * scale, cy + 35 * scale);
      ctx.lineTo(cx + 43 * scale, cy + 70 * scale);
      ctx.closePath();
      ctx.fill();

      // Central Energy Power Core
      ctx.fillStyle = dyes.glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();

    } else if (meshType === 'wings' || meshType === 'glider') {
      // Swept Aerodynamic Wings
      ctx.fillStyle = dyes.primary;
      ctx.strokeStyle = dyes.accent;
      ctx.lineWidth = 3 * scale;

      // Left Wing
      ctx.beginPath();
      ctx.moveTo(cx - 10 * scale, cy);
      ctx.lineTo(cx - 85 * scale, cy - 35 * scale);
      ctx.lineTo(cx - 65 * scale, cy + 20 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Wing
      ctx.beginPath();
      ctx.moveTo(cx + 10 * scale, cy);
      ctx.lineTo(cx + 85 * scale, cy - 35 * scale);
      ctx.lineTo(cx + 65 * scale, cy + 20 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Central Starlight Crystal Core
      ctx.fillStyle = dyes.glow;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 16 * scale, 24 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

    } else if (meshType === 'shield') {
      // Knight Heraldic Shield
      ctx.fillStyle = dyes.primary;
      ctx.strokeStyle = dyes.accent;
      ctx.lineWidth = 4 * scale;

      ctx.beginPath();
      ctx.moveTo(cx - 45 * scale, cy - 45 * scale);
      ctx.lineTo(cx + 45 * scale, cy - 45 * scale);
      ctx.lineTo(cx + 40 * scale, cy + 15 * scale);
      ctx.lineTo(cx, cy + 55 * scale);
      ctx.lineTo(cx - 40 * scale, cy + 15 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shield Emblem Star
      ctx.fillStyle = dyes.glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * scale, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Helmets / Cowl / Boots default
      ctx.fillStyle = dyes.primary;
      ctx.strokeStyle = dyes.accent;
      ctx.lineWidth = 3.5 * scale;

      ctx.beginPath();
      ctx.arc(cx, cy, 38 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Visor / Horn accents
      ctx.fillStyle = dyes.glow;
      ctx.fillRect(cx - 25 * scale, cy - 10 * scale, 50 * scale, 18 * scale);
    }
  }

  renderTestingRange(ctx, bp, dyes) {
    const w = this.width;
    const h = this.height;
    const activePet = store.getActivePet();
    const petColor = activePet?.color || '#2ecc71';
    const category = bp?.category || 'wings';

    if (category === 'wings') {
      // 1. 3D WIND TUNNEL SIMULATOR
      // Airstream speedlines
      ctx.lineWidth = 2;
      for (const stream of this.airstreams) {
        ctx.strokeStyle = stream.color;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(stream.x + w / 2, stream.y + h / 2);
        ctx.lineTo(stream.x + stream.length + w / 2, stream.y + h / 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // Pet flying with equipped wings
      const petX = w * 0.42;
      const petY = h * 0.5 + Math.sin(performance.now() * 0.006) * 15;

      // Wing trails
      ctx.fillStyle = dyes.glow;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(petX - 80, petY - 12, 60, 24);
      ctx.globalAlpha = 1.0;

      // Companion Pet Body
      ctx.fillStyle = petColor;
      ctx.beginPath();
      ctx.arc(petX, petY, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Jetpack / Wings on back
      ctx.fillStyle = dyes.primary;
      ctx.fillRect(petX - 44, petY - 18, 16, 36);

      // Windspeed HUD Telemetry
      ctx.fillStyle = 'rgba(9, 20, 30, 0.9)';
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 2;
      ctx.roundRect(w - 190, 20, 170, 75, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00d2d3';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('WIND TUNNEL TELEMETRY', w - 175, 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('142 KM/H', w - 175, 62);

      ctx.fillStyle = '#54e98a';
      ctx.font = 'bold 10px "Quicksand", sans-serif';
      ctx.fillText('+25% LIFT COEFFICIENT', w - 175, 80);

    } else if (category === 'shields' || category === 'helmets') {
      // 2. TARGET DEFLECTION RANGE
      const petX = w * 0.32;
      const petY = h * 0.52;

      // Pet Body
      ctx.fillStyle = petColor;
      ctx.beginPath();
      ctx.arc(petX, petY, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Shield Forcefield Dome
      ctx.strokeStyle = dyes.glow;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(petX + 35, petY, 48, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();

      // Foam Balls
      for (const ball of this.testBalls) {
        ctx.fillStyle = ball.deflected ? '#54e98a' : '#f39c12';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y + h / 2, ball.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Target Range HUD
      ctx.fillStyle = 'rgba(9, 20, 30, 0.9)';
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 2;
      ctx.roundRect(w - 190, 20, 170, 70, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('DEFLECTION RANGE', w - 175, 40);

      ctx.fillStyle = '#54e98a';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('100% DEFLECTED!', w - 175, 62);

    } else {
      // 3. BOOTS SUPER JUMP
      const petX = w * 0.5;
      const petY = h * 0.65 + this.testJumpY;

      // Spring Launchpad
      ctx.fillStyle = '#202b35';
      ctx.fillRect(petX - 45, h * 0.72, 90, 16);

      // Pet Jumping
      ctx.fillStyle = petColor;
      ctx.beginPath();
      ctx.arc(petX, petY, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Boots on pet
      ctx.fillStyle = dyes.primary;
      ctx.fillRect(petX - 22, petY + 24, 16, 14);
      ctx.fillRect(petX + 6, petY + 24, 16, 14);

      // Star Rings in Sky
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(petX, h * 0.22, 60, 16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  setShellColor(hex) {
    if (!this.dyes) this.dyes = {};
    this.dyes.primary = hex;
    const forge = store.getHeroForgeState();
    if (forge && forge.customDyes) forge.customDyes.primary = hex;
  }

  setTrimColor(hex) {
    if (!this.dyes) this.dyes = {};
    this.dyes.accent = hex;
    const forge = store.getHeroForgeState();
    if (forge && forge.customDyes) forge.customDyes.accent = hex;
  }

  setCoreColor(hex) {
    if (!this.dyes) this.dyes = {};
    this.dyes.glow = hex;
    const forge = store.getHeroForgeState();
    if (forge && forge.customDyes) forge.customDyes.glow = hex;
  }

  setTestingMode(active) {
    this.testingMode = Boolean(active);
  }

  triggerForgeStrike() {
    this.hammerProgress = 1.0;
    this.heatGlow = 1.0;
    this.hammerStrikeActive = true;
    for (let i = 0; i < 30; i++) {
      const angle = (Math.random() * Math.PI) + Math.PI;
      const speed = Math.random() * 8 + 4;
      this.sparks.push({
        x: (this.width || 600) * 0.5 + (Math.random() - 0.5) * 40,
        y: (this.height || 360) * 0.65,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: ['#f1c40f', '#f39c12', '#ffffff', '#2ecc71'][Math.floor(Math.random() * 4)]
      });
    }
    setTimeout(() => {
      this.hammerStrikeActive = false;
    }, 400);
  }

  destroy() {
    this.isDestroyed = true;
    this.stopLoop();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._mouseMoveHandler) window.removeEventListener('mousemove', this._mouseMoveHandler);
    if (this._mouseUpHandler) window.removeEventListener('mouseup', this._mouseUpHandler);
    if (this._touchMoveHandler) window.removeEventListener('touchmove', this._touchMoveHandler);
  }
}
