/**
 * GermBustersGame.js
 * 
 * Fast-paced whack-a-mole style reflex game for Little Hero Adventures.
 * Playful sugar bugs and tartar critters pop up from tooth burrows.
 * Tapping them cleanses them with sudsy bubbles and sparkles!
 * The child's active pet mascot cheers along with clean smile power.
 * 
 * Complies strictly with the Explorer Palette:
 * #09141e Midnight Slate, #10b981 Emerald, #00d2d3 Cyan, #f59e0b Solar Amber, #ffb961 Warm Amber.
 * ZERO pink or purple.
 */

import { Sound } from '../audio/sfx.js';

export class GermBustersGame {
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

    // Round timer & stats
    this.timeLeft = this.toddlerMode ? 40 : 30;
    this.score = 0;
    this.bugsBopped = 0;
    this.streak = 0;
    this.maxStreak = 0;

    // 6 Tooth Burrows (2 rows x 3 columns)
    this.burrows = [];
    this.initBurrows();

    // Spawning control
    this.spawnTimer = 0;
    this.particles = [];

    // Active Pet Mascot state
    this.mascotBounce = 0;
    this.mascotCheerTimer = 0;
    this.petImage = null;
    this.loadPetImage();

    // Event binding
    this.handlePointerDown = this.handlePointerDown.bind(this);
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

  initBurrows() {
    const prevBugs = (this.burrows || []).map(b => b.bug);
    this.burrows = [];
    const cols = 3;
    const rows = 2;
    const arenaW = Math.min(this.width - 120, 480);
    const arenaH = this.height - 120;
    const startX = (this.width - arenaW) / 2 + 10;
    const startY = 80;
    const colSpacing = arenaW / (cols - 1);
    const rowSpacing = arenaH / (rows - 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = r * cols + c;
        this.burrows.push({
          id,
          x: startX + c * colSpacing,
          y: startY + r * rowSpacing,
          radius: 36,
          bug: prevBugs[id] || null,
          rippleTimer: 0
        });
      }
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.initBurrows();
  }

  setToddlerMode(enabled) {
    this.toddlerMode = Boolean(enabled);
  }

  bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
  }

  unbindEvents() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    }
  }

  handlePointerDown(e) {
    if (!this.running || this.paused) return;
    if (e && e.preventDefault) e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const touchX = (clientX - rect.left) * scaleX;
    const touchY = (clientY - rect.top) * scaleY;

    this.checkHit(touchX, touchY);
  }

  checkHit(x, y) {
    let hitAny = false;

    for (let i = 0; i < this.burrows.length; i++) {
      const b = this.burrows[i];
      // Generous kid tap radius
      const dist = Math.hypot(x - b.x, y - b.y);
      if (dist <= b.radius * 1.35) {
        if (b.bug && b.bug.state !== 'whacked') {
          // HIT!
          hitAny = true;
          this.whackBug(b);
          break;
        } else {
          // Tapped empty burrow - gentle ripple
          b.rippleTimer = 0.4;
          Sound.chirp();
        }
      }
    }

    if (!hitAny && !this.toddlerMode) {
      // Big kid mode: streak reset on complete miss outside burrows
      this.streak = 0;
    }
  }

  whackBug(burrow) {
    const bug = burrow.bug;
    bug.state = 'whacked';
    bug.timer = 0.35; // animation before disappears
    this.bugsBopped++;
    this.score += bug.points;
    this.streak++;
    if (this.streak > this.maxStreak) this.maxStreak = this.streak;

    this.mascotCheerTimer = 0.8;
    Sound.pop();
    this.spawnBubbles(burrow.x, burrow.y - 20, bug.color || '#00d2d3', 14);

    if (this.options.onScoreUpdate) {
      this.options.onScoreUpdate(this.score, this.streak);
    }

    // Dynamic Kokoro cheer on milestones
    if (this.streak === 5) {
      if (this.options.onVoiceCheer) this.options.onVoiceCheer("Sugar bugs banished! Clean smile power!");
    } else if (this.streak === 10) {
      if (this.options.onVoiceCheer) this.options.onVoiceCheer("Super Bop Streak! Your smile sparkles!");
    } else if (this.bugsBopped === 15) {
      if (this.options.onVoiceCheer) this.options.onVoiceCheer("So clean and bright! Champion buster!");
    }
  }

  spawnBubbles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 110,
        vy: -40 - Math.random() * 80,
        color: color || '#00d2d3',
        size: 3 + Math.random() * 5,
        alpha: 1,
        life: 0.5 + Math.random() * 0.3
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
    this.timeLeft = this.toddlerMode ? 40 : 30;
    this.score = 0;
    this.bugsBopped = 0;
    this.streak = 0;
    this.burrows.forEach(b => { b.bug = null; b.rippleTimer = 0; });
    this.particles = [];
    this.spawnTimer = 0;

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
    // Round countdown
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.endGame();
      return;
    }

    // Mascot animation
    this.mascotBounce += dt * 3;
    if (this.mascotCheerTimer > 0) {
      this.mascotCheerTimer -= dt;
    }

    // Spawn sugar bugs
    this.spawnTimer += dt;
    const interval = this.toddlerMode ? 1.6 : 1.1;
    if (this.spawnTimer > interval) {
      this.spawnTimer = 0;
      this.trySpawnBug();
    }

    // Update active bugs in burrows
    this.burrows.forEach(b => {
      if (b.rippleTimer > 0) b.rippleTimer -= dt;

      if (b.bug) {
        const bug = b.bug;
        if (bug.state === 'rising') {
          bug.popProgress = Math.min(1, bug.popProgress + dt * 4);
          if (bug.popProgress >= 1) {
            bug.state = 'idle';
            bug.timer = bug.duration;
          }
        } else if (bug.state === 'idle') {
          bug.timer -= dt;
          if (bug.timer <= 0) {
            bug.state = 'sinking';
          }
        } else if (bug.state === 'sinking') {
          bug.popProgress = Math.max(0, bug.popProgress - dt * 3.5);
          if (bug.popProgress <= 0) {
            b.bug = null;
          }
        } else if (bug.state === 'whacked') {
          bug.timer -= dt;
          bug.popProgress = Math.max(0, bug.popProgress - dt * 2.5);
          if (bug.timer <= 0) {
            b.bug = null;
          }
        }
      }
    });

    // Update bubbles particles
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

  trySpawnBug() {
    const emptyBurrows = this.burrows.filter(b => !b.bug);
    if (emptyBurrows.length === 0) return;

    // Pick 1 or 2 burrows
    const countToSpawn = (this.toddlerMode || emptyBurrows.length < 3) ? 1 : (Math.random() > 0.6 ? 2 : 1);
    const shuffled = [...emptyBurrows].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(countToSpawn, shuffled.length); i++) {
      const b = shuffled[i];
      const roll = Math.random();

      let typeData;
      if (roll < 0.2) {
        // Golden Starlight Bug (rare bonus)
        typeData = {
          name: 'Golden Bug',
          emoji: '✨',
          subEmoji: '🌟',
          color: '#f59e0b',
          points: 50,
          duration: this.toddlerMode ? 2.5 : 1.4
        };
      } else if (roll < 0.55) {
        // Sneaky Cavity Critter (cyan/slate)
        typeData = {
          name: 'Cavity Critter',
          emoji: '👾',
          subEmoji: '🦷',
          color: '#00d2d3',
          points: 20,
          duration: this.toddlerMode ? 2.8 : 1.8
        };
      } else {
        // Sticky Tartar Bug (amber)
        typeData = {
          name: 'Tartar Bug',
          emoji: '🦠',
          subEmoji: '🫧',
          color: '#ffb961',
          points: 10,
          duration: this.toddlerMode ? 3.0 : 2.2
        };
      }

      b.bug = {
        ...typeData,
        state: 'rising',
        popProgress: 0,
        timer: 0
      };
    }
  }

  endGame() {
    this.running = false;
    Sound.fanfare();
    if (this.options.onGameOver) {
      this.options.onGameOver(this.score, {
        won: this.bugsBopped > 0,
        cleared: this.bugsBopped > 0,
        bugsBopped: this.bugsBopped,
        maxStreak: this.maxStreak
      });
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Bathroom / Clean Hygiene Arena background (#09141e Midnight Slate gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#09141e');
    bgGrad.addColorStop(0.6, '#0d2436');
    bgGrad.addColorStop(1, '#11324a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Decorative suds bubbles floating in background
    ctx.fillStyle = 'rgba(0, 210, 211, 0.08)';
    for (let i = 0; i < 6; i++) {
      const bx = (this.width * 0.15 * i + 40) % this.width;
      const by = 40 + (i * 55) % (this.height - 80);
      ctx.beginPath();
      ctx.arc(bx, by, 18 + (i % 3) * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Render 6 Tooth Burrows
    this.burrows.forEach(b => {
      this.renderToothBurrow(ctx, b);
    });

    // 3. Render Bubbles Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 4. Render Cheering Active Pet Mascot in Corner
    this.renderMascot(ctx);

    // 5. HUD: Score, Timer, Streak
    this.renderHUD(ctx);
  }

  renderToothBurrow(ctx, b) {
    ctx.save();
    const cx = b.x;
    const cy = b.y;

    // Ripple if tapped empty
    if (b.rippleTimer > 0) {
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, b.radius + (0.4 - b.rippleTimer) * 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tooth Burrow Pedestal (Pearly white rounded tooth top with dark slate base)
    // Shadow / crater hole
    ctx.fillStyle = '#061019';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, b.radius, b.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Render Bug coming up out of the burrow
    if (b.bug) {
      const bug = b.bug;
      ctx.save();
      // Clip bug inside the burrow top
      ctx.beginPath();
      ctx.rect(cx - b.radius - 10, cy - b.radius * 1.8, (b.radius + 10) * 2, b.radius * 2.2);
      ctx.clip();

      const riseOffset = (1 - bug.popProgress) * 45;
      const bugY = cy - 10 + riseOffset;

      if (bug.state === 'whacked') {
        // Dizzy spinning retreat
        ctx.translate(cx, bugY);
        ctx.scale(1.2, 0.7);
        ctx.font = '34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💫', 0, 0);
      } else {
        // Bug body & funny face
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bug.emoji, cx, bugY);

        if (bug.name === 'Golden Bug') {
          ctx.font = '16px sans-serif';
          ctx.fillText('✨', cx + 18, bugY - 14);
        }
      }
      ctx.restore();
    }

    // Front rim of tooth cavity (gleaming tooth crown in Explorer Palette)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 14, b.radius * 0.85, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  renderMascot(ctx) {
    ctx.save();
    // Mascot positioned in bottom-left
    const mx = 60;
    const isCheering = this.mascotCheerTimer > 0;
    const bounceY = isCheering ? Math.sin(performance.now() * 0.02) * 8 : Math.sin(this.mascotBounce) * 4;
    const my = this.height - 60 + bounceY;

    // Pedestal disk
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.beginPath();
    ctx.ellipse(mx, this.height - 35, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pet avatar
    if (this.petImage && this.petImage.complete && this.petImage.naturalWidth > 0) {
      ctx.drawImage(this.petImage, mx - 28, my - 28, 56, 56);
    } else {
      ctx.beginPath();
      ctx.arc(mx, my, 26, 0, Math.PI * 2);
      ctx.fillStyle = this.pet.color || '#10b981';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#00d2d3';
      ctx.stroke();

      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.pet.emoji || '🐾', mx, my);
    }

    // Toothbrush wand in pet's hand
    ctx.font = '20px sans-serif';
    ctx.fillText('🪥', mx + 24, my - 12);

    if (isCheering) {
      ctx.fillStyle = '#ffb961';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CLEAN!', mx, my - 34);
    }

    ctx.restore();
  }

  renderHUD(ctx) {
    ctx.save();
    // Timer Pill (Top Center)
    ctx.fillStyle = 'rgba(9, 20, 30, 0.8)';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, this.width / 2 - 55, 12, 110, 34, 10, true, true);

    ctx.fillStyle = this.timeLeft <= 5 ? '#f59e0b' : '#00d2d3';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⏱️ ${Math.ceil(this.timeLeft)}s`, this.width / 2, 29);

    // Score Pill (Top Left)
    this.roundRect(ctx, 16, 12, 120, 34, 10, true, true);
    ctx.fillStyle = '#ffb961';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⭐ ${this.score}`, 28, 29);

    // Streak / Mode Pill (Top Right)
    ctx.fillStyle = this.streak >= 3 ? '#10b981' : '#00d2d3';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    const modeLabel = this.streak >= 3 ? `🔥 ${this.streak}x Combo!` : (this.toddlerMode ? '👶 Toddler Mode' : '🚀 Big Kid');
    ctx.fillText(modeLabel, this.width - 20, 29);

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
