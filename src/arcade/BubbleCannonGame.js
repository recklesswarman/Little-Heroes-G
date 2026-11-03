/**
 * BubbleCannonGame.js
 * 
 * Directional bubble/fruit shooter mini-game for Little Hero Adventures.
 * The child's active pet hero aims and launches colored treat orbs from the
 * bottom cannon to match 3 or more treat bubbles in the ceiling constellation.
 * 
 * Complies strictly with the Explorer Palette:
 * #09141e Midnight Slate, #10b981 Emerald, #00d2d3 Cyan, #f59e0b Solar Amber, #ffb961 Warm Amber.
 * ZERO pink or purple.
 */

import { Sound } from '../audio/sfx.js';

const BUBBLE_COLORS = [
  { id: 'emerald', name: 'Star Kiwi', hex: '#10b981', emoji: '🥝' },
  { id: 'cyan', name: 'Aqua Kelp', hex: '#00d2d3', emoji: '🍈' },
  { id: 'solar', name: 'Solar Star', hex: '#f59e0b', emoji: '⭐' },
  { id: 'amber', name: 'Honey Treat', hex: '#ffb961', emoji: '🍯' },
  { id: 'slate', name: 'Cosmic Berry', hex: '#225577', emoji: '🫐' }
];

export class BubbleCannonGame {
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

    // Grid configuration
    this.cols = 8;
    this.maxRows = 9;
    this.bubbleRadius = 18;
    this.gridStartX = (this.width - (this.cols * this.bubbleRadius * 2)) / 2 + this.bubbleRadius;
    this.gridStartY = 55;

    // Grid array: rows of bubbles
    this.grid = [];
    this.initGrid();

    // Cannon state
    this.cannonX = this.width / 2;
    this.cannonY = this.height - 40;
    this.aimAngle = -Math.PI / 2; // Straight up initially
    this.isAiming = false;

    // Current & next bubble
    this.currentOrb = this.getRandomBubbleColor();
    this.nextOrb = this.getRandomBubbleColor();
    this.flyingOrb = null; // null or { x, y, vx, vy, radius, color }

    // Stats
    this.score = 0;
    this.shotsFired = 0;
    this.bubblesPopped = 0;
    this.streak = 0;
    this.maxStreak = 0;

    // Effects
    this.particles = [];
    this.fallingBubbles = [];

    // Pet image
    this.petImage = null;
    this.loadPetImage();

    // Event binding
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
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

  getRandomBubbleColor() {
    return BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
  }

  initGrid() {
    this.grid = [];
    const initialRows = this.toddlerMode ? 3 : 4;
    for (let r = 0; r < this.maxRows; r++) {
      const row = [];
      const colsInRow = (r % 2 === 1) ? this.cols - 1 : this.cols;
      for (let c = 0; c < colsInRow; c++) {
        if (r < initialRows) {
          row.push(this.getRandomBubbleColor());
        } else {
          row.push(null);
        }
      }
      this.grid.push(row);
    }
  }

  getBubblePosition(r, c) {
    const isOdd = r % 2 === 1;
    const rowOffset = isOdd ? this.bubbleRadius : 0;
    const x = this.gridStartX + rowOffset + c * (this.bubbleRadius * 2);
    const y = this.gridStartY + r * (this.bubbleRadius * 1.732); // Hexagonal packing spacing
    return { x, y };
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.cannonX = this.width / 2;
    this.cannonY = this.height - 40;
    this.gridStartX = (this.width - (this.cols * this.bubbleRadius * 2)) / 2 + this.bubbleRadius;
  }

  setToddlerMode(enabled) {
    this.toddlerMode = Boolean(enabled);
  }

  bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.handlePointerUp, { passive: false });
  }

  unbindEvents() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('pointermove', this.handlePointerMove);
      this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    }
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  handlePointerDown(e) {
    if (!this.running || this.paused || this.flyingOrb) return;
    if (e && e.preventDefault) e.preventDefault();
    this.isAiming = true;
    this.updateAimAngle(e);
  }

  handlePointerMove(e) {
    if (!this.isAiming) return;
    if (e && e.preventDefault) e.preventDefault();
    this.updateAimAngle(e);
  }

  handlePointerUp(e) {
    if (!this.isAiming) return;
    this.isAiming = false;
    this.fireOrb();
  }

  updateAimAngle(e) {
    const pos = this.getCanvasCoords(e);
    const dx = pos.x - this.cannonX;
    const dy = pos.y - this.cannonY;
    let angle = Math.atan2(dy, dx);

    // Clamp angle so kids can only aim upwards into the field (-160° to -20°)
    const minAngle = -Math.PI * 0.9;
    const maxAngle = -Math.PI * 0.1;
    this.aimAngle = Math.max(minAngle, Math.min(maxAngle, angle));
  }

  fireOrb() {
    if (this.flyingOrb) return;

    const speed = 620; // Fast and snappy
    this.flyingOrb = {
      x: this.cannonX,
      y: this.cannonY - 10,
      vx: Math.cos(this.aimAngle) * speed,
      vy: Math.sin(this.aimAngle) * speed,
      radius: this.bubbleRadius,
      color: this.currentOrb
    };

    Sound.pop();
    this.shotsFired++;
    this.currentOrb = this.nextOrb;
    this.nextOrb = this.getRandomBubbleColor();
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
    this.shotsFired = 0;
    this.bubblesPopped = 0;
    this.streak = 0;
    this.flyingOrb = null;
    this.particles = [];
    this.fallingBubbles = [];
    this.initGrid();
    this.currentOrb = this.getRandomBubbleColor();
    this.nextOrb = this.getRandomBubbleColor();

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

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.08);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animId = requestAnimationFrame(this.loop);
  }

  update(dt) {
    // Update flying orb
    if (this.flyingOrb) {
      const orb = this.flyingOrb;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;

      // Bounce off side walls (Explorer bounds)
      const leftBound = this.gridStartX - this.bubbleRadius;
      const rightBound = this.gridStartX + this.cols * this.bubbleRadius * 2 - this.bubbleRadius;

      if (orb.x - orb.radius <= leftBound) {
        orb.x = leftBound + orb.radius;
        orb.vx = -orb.vx;
        Sound.chirp();
      } else if (orb.x + orb.radius >= rightBound) {
        orb.x = rightBound - orb.radius;
        orb.vx = -orb.vx;
        Sound.chirp();
      }

      // Check collision with ceiling
      if (orb.y - orb.radius <= this.gridStartY) {
        this.snapOrbToGrid(orb, null);
        this.flyingOrb = null;
      } else {
        // Check collision with existing grid bubbles
        const hit = this.checkGridCollision(orb);
        if (hit) {
          this.snapOrbToGrid(orb, hit);
          this.flyingOrb = null;
        }
      }
    }

    // Update falling bubbles
    for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
      const fb = this.fallingBubbles[i];
      fb.vy += 600 * dt;
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      fb.alpha -= dt * 1.2;
      if (fb.y > this.height || fb.alpha <= 0) {
        this.fallingBubbles.splice(i, 1);
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

  checkGridCollision(orb) {
    let closestHit = null;
    let closestDist = Infinity;
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      for (let c = 0; c < row.length; c++) {
        const bubble = row[c];
        if (bubble) {
          const pos = this.getBubblePosition(r, c);
          const dist = Math.hypot(orb.x - pos.x, orb.y - pos.y);
          if (dist < this.bubbleRadius * 1.85 && dist < closestDist) {
            closestDist = dist;
            closestHit = { r, c };
          }
        }
      }
    }
    return closestHit;
  }

  snapOrbToGrid(orb, hitCell = null) {
    // Determine candidate empty cells
    const candidates = [];

    if (!hitCell || orb.y - orb.radius <= this.gridStartY) {
      // Ceiling hit: prioritize open cells in row 0
      for (let c = 0; c < this.grid[0].length; c++) {
        if (!this.grid[0][c]) {
          candidates.push({ r: 0, c });
        }
      }
    }

    if (hitCell) {
      // Hit a bubble: prioritize empty neighbors of the collided bubble
      const neighbors = this.getNeighbors(hitCell.r, hitCell.c);
      neighbors.forEach(n => {
        if (!this.grid[n.r][n.c]) {
          candidates.push(n);
        }
      });
    }

    // Fallback if no direct candidates found: scan open cells adjacent to ANY occupied bubble or row 0
    if (candidates.length === 0) {
      for (let r = 0; r < this.grid.length; r++) {
        const row = this.grid[r];
        for (let c = 0; c < row.length; c++) {
          if (!row[c]) {
            if (r === 0) {
              candidates.push({ r, c });
            } else {
              const hasOccupiedNeighbor = this.getNeighbors(r, c).some(n => this.grid[n.r][n.c]);
              if (hasOccupiedNeighbor) {
                candidates.push({ r, c });
              }
            }
          }
        }
      }
    }

    // Find candidate closest to orb position
    let bestDist = Infinity;
    let bestR = -1;
    let bestC = -1;

    candidates.forEach(cell => {
      const pos = this.getBubblePosition(cell.r, cell.c);
      const dist = Math.hypot(orb.x - pos.x, orb.y - pos.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestR = cell.r;
        bestC = cell.c;
      }
    });

    if (bestR !== -1 && bestC !== -1) {
      this.grid[bestR][bestC] = orb.color;
      this.processMatches(bestR, bestC, orb.color.id);

      // Check danger line (bottom row reached)
      if (bestR >= this.maxRows - 1) {
        if (this.toddlerMode) {
          // Toddler Practice Mode: Star burst wave clears bottom rows to prevent game over
          Sound.pop();
          Sound.chirp();
          for (let r = Math.max(0, this.maxRows - 3); r < this.maxRows; r++) {
            for (let c = 0; c < this.grid[r].length; c++) {
              if (this.grid[r][c]) {
                const pos = this.getBubblePosition(r, c);
                this.spawnPopParticles(pos.x, pos.y, '#f59e0b', 6);
                this.grid[r][c] = null;
              }
            }
          }
          if (this.options.onVoiceCheer) {
            this.options.onVoiceCheer("Bubble Surge! Keep aiming for the stars!");
          }
        } else {
          this.endGame(false);
        }
      }
    }
  }

  getNeighbors(r, c) {
    const neighbors = [];
    const isOdd = r % 2 === 1;

    // Up/down and left/right offsets in staggered hex grid
    const offsets = isOdd
      ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
      : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];

    offsets.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < this.grid.length && nc >= 0 && nc < this.grid[nr].length) {
        neighbors.push({ r: nr, c: nc });
      }
    });
    return neighbors;
  }

  processMatches(startR, startC, targetColorId) {
    // Flood fill to find all connected matching bubbles
    const visited = new Set();
    const cluster = [];
    const queue = [{ r: startR, c: startC }];
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
      const curr = queue.shift();
      cluster.push(curr);

      const neighbors = this.getNeighbors(curr.r, curr.c);
      neighbors.forEach(n => {
        const key = `${n.r},${n.c}`;
        if (!visited.has(key)) {
          const b = this.grid[n.r][n.c];
          if (b && b.id === targetColorId) {
            visited.add(key);
            queue.push(n);
          }
        }
      });
    }

    if (cluster.length >= 3) {
      // POP!
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      const pts = cluster.length * 15 + this.streak * 10;
      this.score += pts;
      this.bubblesPopped += cluster.length;

      cluster.forEach(cell => {
        const pos = this.getBubblePosition(cell.r, cell.c);
        const color = this.grid[cell.r][cell.c];
        this.spawnPopParticles(pos.x, pos.y, color ? color.hex : '#10b981', 10);
        this.grid[cell.r][cell.c] = null;
      });

      Sound.pop();
      Sound.coin();

      // Drop floating disconnected bubbles
      this.dropFloatingBubbles();

      if (this.options.onScoreUpdate) {
        this.options.onScoreUpdate(this.score, this.streak);
      }

      // Dynamic Kokoro cheer
      if (cluster.length >= 5) {
        if (this.options.onVoiceCheer) this.options.onVoiceCheer("Mega Bubble Blast! Look at that match!");
      } else if (this.streak === 3) {
        if (this.options.onVoiceCheer) this.options.onVoiceCheer("Super Shot! Bubble Cannon Master!");
      }

      // Check if grid completely cleared
      if (this.isGridEmpty()) {
        this.score += 200;
        this.endGame(true);
      }
    } else {
      // Missed match
      this.streak = 0;
      // In Big Kid mode, ceiling can descend after every 5 shots
      if (!this.toddlerMode && this.shotsFired % 5 === 0) {
        this.descendCeiling();
      }
    }
  }

  dropFloatingBubbles() {
    // Find all bubbles connected to ceiling (row 0)
    const connectedToCeiling = new Set();
    const queue = [];

    // All row 0 bubbles start the queue
    for (let c = 0; c < this.grid[0].length; c++) {
      if (this.grid[0][c]) {
        connectedToCeiling.add(`0,${c}`);
        queue.push({ r: 0, c });
      }
    }

    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = this.getNeighbors(curr.r, curr.c);
      neighbors.forEach(n => {
        const key = `${n.r},${n.c}`;
        if (!connectedToCeiling.has(key) && this.grid[n.r][n.c]) {
          connectedToCeiling.add(key);
          queue.push(n);
        }
      });
    }

    // Any bubble not connected to ceiling falls!
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] && !connectedToCeiling.has(`${r},${c}`)) {
          const pos = this.getBubblePosition(r, c);
          this.fallingBubbles.push({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 80,
            vy: -40 - Math.random() * 40,
            color: this.grid[r][c],
            alpha: 1
          });
          this.score += 25;
          this.grid[r][c] = null;
        }
      }
    }
  }

  descendCeiling() {
    // Push new row at top
    const newRow = [];
    for (let c = 0; c < this.cols; c++) {
      newRow.push(this.getRandomBubbleColor());
    }
    this.grid.unshift(newRow);
    this.grid.pop(); // Remove bottom row

    // Check danger line
    const bottomRow = this.grid[this.grid.length - 2];
    if (bottomRow && bottomRow.some(b => b !== null)) {
      this.endGame(false);
    }
  }

  isGridEmpty() {
    return this.grid.every(row => row.every(b => b === null));
  }

  spawnPopParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 140,
        vy: (Math.random() - 0.5) * 140,
        color: color || '#10b981',
        size: 3 + Math.random() * 4,
        alpha: 1,
        life: 0.45 + Math.random() * 0.25
      });
    }
  }

  endGame(cleared = false) {
    this.running = false;
    Sound.fanfare();
    if (this.options.onGameOver) {
      this.options.onGameOver(this.score, {
        cleared,
        shots: this.shotsFired,
        bubblesPopped: this.bubblesPopped,
        maxStreak: this.maxStreak
      });
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Celestial background (Midnight Slate #09141e gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#09141e');
    bgGrad.addColorStop(0.5, '#0b1d2c');
    bgGrad.addColorStop(1, '#0e263a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Trajectory Laser Guideline (bounces off walls)
    if (this.isAiming && !this.flyingOrb) {
      this.renderAimGuide(ctx);
    }

    // 3. Grid bubbles
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r];
      for (let c = 0; c < row.length; c++) {
        const bubble = row[c];
        if (bubble) {
          const pos = this.getBubblePosition(r, c);
          this.renderBubble(ctx, pos.x, pos.y, bubble);
        }
      }
    }

    // 4. Flying orb
    if (this.flyingOrb) {
      this.renderBubble(ctx, this.flyingOrb.x, this.flyingOrb.y, this.flyingOrb.color);
    }

    // 5. Falling disconnected bubbles
    this.fallingBubbles.forEach(fb => {
      ctx.save();
      ctx.globalAlpha = fb.alpha;
      this.renderBubble(ctx, fb.x, fb.y, fb.color);
      ctx.restore();
    });

    // 6. Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 7. Cannon & Active Pet Hero at bottom
    this.renderCannon(ctx);

    // 8. HUD
    this.renderHUD(ctx);
  }

  renderAimGuide(ctx) {
    ctx.save();
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);

    let startX = this.cannonX;
    let startY = this.cannonY;
    let dirX = Math.cos(this.aimAngle);
    let dirY = Math.sin(this.aimAngle);

    const leftBound = this.gridStartX - this.bubbleRadius;
    const rightBound = this.gridStartX + this.cols * this.bubbleRadius * 2 - this.bubbleRadius;

    ctx.beginPath();
    ctx.moveTo(startX, startY);

    // Cast ray to first bounce or ceiling
    for (let step = 0; step < 400; step += 10) {
      startX += dirX * 10;
      startY += dirY * 10;

      if (startX <= leftBound) {
        ctx.lineTo(startX, startY);
        dirX = -dirX;
      } else if (startX >= rightBound) {
        ctx.lineTo(startX, startY);
        dirX = -dirX;
      }

      if (startY <= this.gridStartY) {
        ctx.lineTo(startX, startY);
        break;
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  renderBubble(ctx, x, y, bubble) {
    ctx.save();
    // Glowing treat sphere in Explorer Palette
    const r = this.bubbleRadius;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, bubble.hex);
    grad.addColorStop(1, '#09141e');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Treat symbol in center
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.emoji, x, y);

    ctx.restore();
  }

  renderCannon(ctx) {
    ctx.save();
    const cx = this.cannonX;
    const cy = this.cannonY;

    // Cannon Barrel (Rotates with aimAngle)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.aimAngle + Math.PI / 2);

    ctx.fillStyle = '#0f2738';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-12, -35, 24, 40, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Cannon Base (Starlight pedestal in Emerald / Cyan)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Current loaded treat orb
    if (!this.flyingOrb) {
      this.renderBubble(ctx, cx, cy - 8, this.currentOrb);
    }

    // Active Pet Mascot standing next to cannon (left side)
    const px = cx - 60;
    const py = cy + 4;
    if (this.petImage && this.petImage.complete && this.petImage.naturalWidth > 0) {
      ctx.drawImage(this.petImage, px - 22, py - 22, 44, 44);
    } else {
      ctx.beginPath();
      ctx.arc(px, py, 20, 0, Math.PI * 2);
      ctx.fillStyle = this.pet.color || '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.pet.emoji || '🐾', px, py);
    }

    // "Next" Orb preview (right side)
    const nx = cx + 60;
    ctx.fillStyle = 'rgba(9, 20, 30, 0.7)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(nx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    this.renderBubble(ctx, nx, cy, this.nextOrb);
    ctx.fillStyle = '#00d2d3';
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', nx, cy + 24);

    ctx.restore();
  }

  renderHUD(ctx) {
    ctx.save();
    // Score Pill (Top Left)
    ctx.fillStyle = 'rgba(9, 20, 30, 0.8)';
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, 16, 12, 120, 32, 10, true, true);

    ctx.fillStyle = '#ffb961';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⭐ ${this.score}`, 28, 28);

    // Shots / Mode (Top Right)
    ctx.fillStyle = this.streak >= 2 ? '#f59e0b' : '#10b981';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    const label = this.streak >= 2 ? `🔥 ${this.streak}x Combo!` : (this.toddlerMode ? '👶 Toddler Laser' : `Shots: ${this.shotsFired}`);
    ctx.fillText(label, this.width - 20, 28);

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
