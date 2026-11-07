/**
 * StarlightRunnerGame.js
 * 
 * Endless parallax side-scroller mini-game for Little Hero Adventures.
 * The child's active pet hero runs across Starlight Glade, collecting
 * starlight fruit, double-jumping over sleepy logs, crystal spikes, and mud puddles.
 * 
 * Complies strictly with the Explorer Palette:
 * #09141e Midnight Slate, #10b981 Emerald, #00d2d3 Cyan, #f59e0b Solar Amber, #ffb961 Warm Amber.
 * ZERO pink or purple.
 */

import { Sound } from '../audio/sfx.js';

export class StarlightRunnerGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = (typeof canvas.getContext === 'function') ? canvas.getContext('2d') : null;
    this.options = options;
    this.pet = options.pet || { id: '1', name: 'Rex', color: '#10b981', emoji: '🦖' };
    this.toddlerMode = Boolean(options.toddlerMode);

    this.width = canvas.width || 640;
    this.height = canvas.height || 400;

    // Simulation timing
    this.running = false;
    this.paused = false;
    this.destroyed = false;
    this.animId = null;
    this.lastTime = 0;

    // Game stats
    this.score = 0;
    this.distance = 0;
    this.fruitsCollected = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.hearts = this.toddlerMode ? 999 : 3;
    this.invincibleTimer = 0;
    this.speed = this.toddlerMode ? 190 : 230;

    // Player state
    this.groundY = this.height - 75;
    this.player = {
      x: 75,
      y: this.groundY - 44,
      width: 44,
      height: 44,
      vy: 0,
      gravity: 800,
      jumpForce: -400,
      jumpCount: 0,
      maxJumps: 2,
      isGrounded: true,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      stumbleTimer: 0
    };

    // Parallax background layers
    this.stars = [];
    this.initStars(40);
    this.bgOffsetFar = 0;
    this.bgOffsetMid = 0;
    this.bgOffsetNear = 0;

    // Entities
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.collectibleSpawnTimer = 0;

    // Pet image caching
    this.petImage = null;
    this.loadPetImage();

    // Event binding
    this.handleTouchOrClick = this.handleTouchOrClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.bindEvents();
  }

  loadPetImage() {
    if (typeof window === 'undefined' || !this.pet) return;
    const src = this.pet.avatar || (this.pet.key ? `assets/pets/${this.pet.key}.png` : null);
    if (src) {
      const img = new Image();
      img.src = src;
      img.onload = () => { this.petImage = img; };
      this.petImage = img;
    }
  }

  initStars(count = 40) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * (this.height - 100),
        size: 1 + Math.random() * 2.2,
        twinkleSpeed: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.handleTouchOrClick, { passive: false });
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  unbindEvents() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handleTouchOrClick);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  handleTouchOrClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    this.jump();
  }

  handleKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (e.preventDefault) e.preventDefault();
      this.jump();
    }
  }

  jump() {
    if (!this.running || this.paused) return;

    if (this.player.isGrounded) {
      this.player.vy = this.player.jumpForce;
      this.player.isGrounded = false;
      this.player.jumpCount = 1;
      this.player.scaleX = 0.8;
      this.player.scaleY = 1.25;
      Sound.pop();
      this.spawnDust(this.player.x + 20, this.groundY, '#10b981', 8);
    } else if (this.player.jumpCount < this.player.maxJumps) {
      // Double jump with flip
      this.player.vy = this.player.jumpForce * 0.9;
      this.player.jumpCount = 2;
      this.player.rotation = 0;
      Sound.laser();
      this.spawnDust(this.player.x + 20, this.player.y + 20, '#00d2d3', 12);
    }
  }

  spawnDust(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.7) * 70,
        color: color || '#00d2d3',
        size: 2 + Math.random() * 4,
        alpha: 1,
        life: 0.4 + Math.random() * 0.3
      });
    }
  }

  start() {
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animId = requestAnimationFrame(this.loop);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused && this.running) {
      this.paused = false;
      this.lastTime = performance.now();
      this.animId = requestAnimationFrame(this.loop);
    }
  }

  restart() {
    this.score = 0;
    this.distance = 0;
    this.fruitsCollected = 0;
    this.streak = 0;
    this.hearts = this.toddlerMode ? 999 : 3;
    this.invincibleTimer = 0;
    this.speed = this.toddlerMode ? 190 : 230;

    this.player.y = this.groundY - 44;
    this.player.vy = 0;
    this.player.jumpCount = 0;
    this.player.isGrounded = true;
    this.player.stumbleTimer = 0;
    this.player.rotation = 0;

    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.collectibleSpawnTimer = 0;

    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.running = false;
    this.destroyed = true;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.unbindEvents();
  }

  loop(timestamp) {
    if (!this.running || this.destroyed) return;
    if (this.paused) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animId = requestAnimationFrame(this.loop);
  }

  update(dt) {
    // Distance & progressive speed
    this.distance += this.speed * dt * 0.1;
    this.score = Math.floor(this.distance + this.fruitsCollected * 25);
    if (!this.toddlerMode) {
      this.speed = Math.min(360, 230 + Math.floor(this.distance / 150) * 15);
    }

    if (this.options.onScoreUpdate) {
      this.options.onScoreUpdate(this.score, this.streak);
    }

    // Toddler Mode Milestone: Reaching Cozy Starlight Camp (~350 distance)
    if (this.toddlerMode && this.distance >= 350) {
      if (this.options.onVoiceCheer) {
        this.options.onVoiceCheer("You made it to the Cozy Starlight Nest! Super Runner!");
      }
      this.endGame(true);
      return;
    }

    // Parallax scrolling
    this.bgOffsetFar = (this.bgOffsetFar + this.speed * dt * 0.1) % this.width;
    this.bgOffsetMid = (this.bgOffsetMid + this.speed * dt * 0.4) % this.width;
    this.bgOffsetNear = (this.bgOffsetNear + this.speed * dt) % this.width;

    // Player physics
    if (!this.player.isGrounded) {
      this.player.vy += this.player.gravity * dt;
      this.player.y += this.player.vy * dt;

      // Rotation during double jump
      if (this.player.jumpCount === 2) {
        this.player.rotation += dt * 9;
      }

      if (this.player.y >= this.groundY - this.player.height) {
        this.player.y = this.groundY - this.player.height;
        this.player.vy = 0;
        this.player.isGrounded = true;
        this.player.jumpCount = 0;
        this.player.rotation = 0;
        this.player.scaleX = 1.2;
        this.player.scaleY = 0.8;
      }
    }

    // Squash & stretch recovery
    this.player.scaleX += (1 - this.player.scaleX) * dt * 10;
    this.player.scaleY += (1 - this.player.scaleY) * dt * 10;

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }
    if (this.player.stumbleTimer > 0) {
      this.player.stumbleTimer -= dt;
    }

    // Spawn obstacles
    this.spawnTimer += dt;
    const minSpawnInterval = this.toddlerMode ? 2.4 : 1.6;
    if (this.spawnTimer > minSpawnInterval + Math.random() * 1.2) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }

    // Spawn collectibles (starlight fruit, coins, crystals)
    this.collectibleSpawnTimer += dt;
    if (this.collectibleSpawnTimer > 0.9) {
      this.collectibleSpawnTimer = 0;
      this.spawnCollectible();
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed * dt;

      // Generous kid-friendly collision box
      const pBox = {
        x: this.player.x + 8,
        y: this.player.y + 6,
        w: this.player.width - 16,
        h: this.player.height - 10
      };
      const oBox = {
        x: obs.x + 6,
        y: obs.y + 6,
        w: obs.width - 12,
        h: obs.height - 10
      };

      if (!obs.hit && this.checkCollision(pBox, oBox)) {
        obs.hit = true;
        this.handleObstacleHit(obs);
      }

      if (obs.x < -60) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const item = this.collectibles[i];
      item.x -= this.speed * dt;
      item.wobble += dt * 4;

      // Collision with player
      const dist = Math.hypot((this.player.x + 20) - item.x, (this.player.y + 20) - item.y);
      if (!item.collected && dist < 32) {
        item.collected = true;
        this.fruitsCollected++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;

        Sound.coin();
        this.spawnDust(item.x, item.y, item.color || '#ffb961', 10);

        // Companion voice cheers on streaks
        if (this.streak === 5) {
          if (this.options.onVoiceCheer) this.options.onVoiceCheer("Starlight Streak! Keep it up!");
        } else if (this.streak === 10) {
          if (this.options.onVoiceCheer) this.options.onVoiceCheer("Super Starlight Dash! You're flying!");
        } else if (this.streak === 20) {
          if (this.options.onVoiceCheer) this.options.onVoiceCheer("Unstoppable Hero! Amazing jumping!");
        }

        this.collectibles.splice(i, 1);
        continue;
      }

      if (item.x < -40) {
        this.collectibles.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / 0.5);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  checkCollision(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  handleObstacleHit(obs) {
    if (this.invincibleTimer > 0) return;

    if (this.toddlerMode) {
      // Gentle funny bounce, zero damage
      this.player.vy = -220;
      this.player.isGrounded = false;
      this.player.stumbleTimer = 0.6;
      Sound.chirp();
      this.spawnDust(this.player.x + 20, this.player.y + 20, '#f59e0b', 8);
    } else {
      this.hearts--;
      this.streak = 0;
      this.invincibleTimer = 1.6;
      this.player.stumbleTimer = 0.5;
      Sound.pop();
      this.spawnDust(this.player.x + 20, this.player.y + 20, '#f59e0b', 14);

      if (this.hearts <= 0) {
        this.endGame();
      }
    }
  }

  spawnObstacle() {
    const types = [
      { type: 'log', emoji: '🪵', width: 36, height: 32, y: this.groundY - 30 },
      { type: 'crystal', emoji: '💠', width: 32, height: 36, y: this.groundY - 34 },
      { type: 'puddle', emoji: '💧', width: 40, height: 20, y: this.groundY - 18 }
    ];
    const pick = types[Math.floor(Math.random() * types.length)];
    this.obstacles.push({
      x: this.width + 20,
      y: pick.y,
      width: pick.width,
      height: pick.height,
      type: pick.type,
      emoji: pick.emoji,
      hit: false
    });
  }

  spawnCollectible() {
    const treats = [
      { name: 'Starberry', emoji: '⭐', color: '#ffb961', pts: 20 },
      { name: 'Solar Melon', emoji: '🍈', color: '#10b981', pts: 25 },
      { name: 'Starlight Gem', emoji: '💎', color: '#00d2d3', pts: 30 },
      { name: 'Hero Coin', emoji: '🪙', color: '#f59e0b', pts: 40 }
    ];
    const pick = treats[Math.floor(Math.random() * treats.length)];

    // Varying jump heights: ground level, single-jump arc, double-jump high arc
    const heights = [
      this.groundY - 35,
      this.groundY - 80,
      this.groundY - 135
    ];
    const yPos = heights[Math.floor(Math.random() * heights.length)];

    this.collectibles.push({
      x: this.width + 20,
      y: yPos,
      radius: 14,
      emoji: pick.emoji,
      color: pick.color,
      points: pick.pts,
      wobble: Math.random() * Math.PI,
      collected: false
    });
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.groundY = this.height - 75;
    if (this.player.isGrounded) {
      this.player.y = this.groundY - this.player.height;
    } else {
      this.player.y = Math.min(this.player.y, this.groundY - this.player.height);
    }
    this.initStars(40);
  }

  setToddlerMode(enabled) {
    this.toddlerMode = Boolean(enabled);
    this.speed = this.toddlerMode ? 190 : 230;
    if (this.toddlerMode) {
      this.hearts = 999;
    } else if (this.hearts > 3 || this.hearts <= 0) {
      this.hearts = 3;
    }
  }

  endGame(cleared = false) {
    this.running = false;
    Sound.fanfare();
    if (this.options.onGameOver) {
      this.options.onGameOver(this.score, {
        won: cleared,
        cleared,
        distance: Math.floor(this.distance),
        fruits: this.fruitsCollected,
        maxStreak: this.maxStreak
      });
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Deep space sky (Midnight Slate #09141e to #0f2438)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGrad.addColorStop(0, '#09141e');
    skyGrad.addColorStop(0.7, '#0d2235');
    skyGrad.addColorStop(1, '#112c42');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Stars
    ctx.fillStyle = '#ffffff';
    const now = performance.now() / 1000;
    this.stars.forEach((s) => {
      const alpha = 0.4 + 0.6 * Math.sin(now * s.twinkleSpeed + s.phase);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 3. Starlight celestial orb / moon in upper right (Warm Amber & Cyan glow)
    const moonGrad = ctx.createRadialGradient(this.width - 80, 70, 5, this.width - 80, 70, 45);
    moonGrad.addColorStop(0, '#ffb961');
    moonGrad.addColorStop(0.5, 'rgba(0, 210, 211, 0.4)');
    moonGrad.addColorStop(1, 'rgba(9, 20, 30, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(this.width - 80, 70, 45, 0, Math.PI * 2);
    ctx.fill();

    // 4. Parallax Mountain silhouettes (#0b1f30)
    ctx.fillStyle = '#0b1f30';
    ctx.beginPath();
    ctx.moveTo(0, this.height - 70);
    for (let x = 0; x <= this.width + 120; x += 60) {
      const ox = (x - this.bgOffsetFar) % (this.width + 120);
      const h = 50 + Math.sin(x * 0.03) * 35;
      ctx.lineTo(ox, this.height - 70 - h);
    }
    ctx.lineTo(this.width, this.height - 70);
    ctx.closePath();
    ctx.fill();

    // 5. Parallax Forest & Ruins (#0d283c)
    ctx.fillStyle = '#0d283c';
    ctx.beginPath();
    ctx.moveTo(0, this.height - 70);
    for (let x = 0; x <= this.width + 80; x += 40) {
      const ox = (x - this.bgOffsetMid) % (this.width + 80);
      const h = 25 + Math.sin(x * 0.05) * 20;
      ctx.lineTo(ox, this.height - 70 - h);
    }
    ctx.lineTo(this.width, this.height - 70);
    ctx.closePath();
    ctx.fill();

    // 6. Foreground running ground (#10b981 Emerald with glowing neon edge #00d2d3)
    const groundGrad = ctx.createLinearGradient(0, this.groundY, 0, this.height);
    groundGrad.addColorStop(0, '#10b981');
    groundGrad.addColorStop(0.15, '#0d4a3b');
    groundGrad.addColorStop(1, '#091e2b');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

    // Neon terrain top line
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.width, this.groundY);
    ctx.stroke();

    // 7. Render Obstacles
    this.obstacles.forEach((obs) => {
      ctx.save();
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obs.emoji, obs.x + obs.width / 2, obs.y + obs.height / 2);
      ctx.restore();
    });

    // 8. Render Collectibles (Starlight Fruit)
    this.collectibles.forEach((item) => {
      ctx.save();
      const floatY = item.y + Math.sin(item.wobble) * 4;
      // Starlight glow aura
      ctx.shadowColor = item.color || '#ffb961';
      ctx.shadowBlur = 10;
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, item.x, floatY);
      ctx.restore();
    });

    // 9. Render Particles
    this.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 10. Render Playable Active Pet Hero
    this.renderPlayer(ctx);

    // 11. HUD Overlay
    this.renderHUD(ctx);
  }

  renderPlayer(ctx) {
    ctx.save();
    const cx = this.player.x + this.player.width / 2;
    const cy = this.player.y + this.player.height / 2;

    ctx.translate(cx, cy);
    ctx.rotate(this.player.rotation);
    ctx.scale(this.player.scaleX, this.player.scaleY);

    // Invincibility flashing
    if (this.invincibleTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    const w = this.player.width;
    const h = this.player.height;

    if (this.petImage && this.petImage.complete && this.petImage.naturalWidth > 0) {
      ctx.drawImage(this.petImage, -w / 2, -h / 2, w, h);
    } else {
      // Fallback procedural pet token in Explorer Palette
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.pet.color || '#10b981';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00d2d3';
      ctx.stroke();

      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.pet.emoji || '🐾', 0, 1);
    }

    // Stumble stars if recently bumped
    if (this.player.stumbleTimer > 0) {
      ctx.font = '14px sans-serif';
      ctx.fillText('💫', 0, -h / 2 - 8);
    }

    ctx.restore();
  }

  renderHUD(ctx) {
    ctx.save();
    // Top Score & Distance Pill (Explorer Slate/Cyan)
    ctx.fillStyle = 'rgba(9, 20, 30, 0.75)';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, 12, 12, 140, 34, 10, true, true);

    ctx.fillStyle = '#ffb961';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⭐ ${this.score}`, 22, 29);

    // Hearts (Big Kid) or Toddler badge
    if (!this.toddlerMode) {
      let heartStr = '';
      for (let i = 0; i < 3; i++) {
        heartStr += (i < this.hearts) ? '⚡' : '⚪';
      }
      ctx.fillStyle = '#10b981';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(heartStr, this.width - 20, 29);
    } else {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('👶 Toddler Practice Mode', this.width - 20, 29);
    }

    // Streak badge if active
    if (this.streak >= 3) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 ${this.streak}x Combo!`, this.width / 2, 29);
    }

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius = 8, fill = true, stroke = true) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}
