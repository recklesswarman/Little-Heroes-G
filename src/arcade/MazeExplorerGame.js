/**
 * MazeExplorerGame.js
 * 
 * Toddler Maze Explorer labyrinth mini-game for Little Hero Adventures.
 * Guides the child's active pet hero along path corridors to collect
 * star gems and discover the golden treasure chest!
 * 
 * Supports:
 * - Direct swipe / drag path tracing
 * - Large chunky on-screen D-Pad arrow buttons
 * - Tap adjacent corridor tile
 * - Toddler breadcrumb path glow
 * 
 * Complies strictly with the Explorer Palette:
 * #09141e Midnight Slate, #10b981 Emerald, #00d2d3 Cyan, #f59e0b Solar Amber, #ffb961 Warm Amber.
 * ZERO pink or purple.
 */

import { Sound } from '../audio/sfx.js';

export class MazeExplorerGame {
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

    // Maze grid sizing (Toddler 7x5 or 7x7)
    this.cols = this.toddlerMode ? 7 : 9;
    this.rows = this.toddlerMode ? 5 : 7;
    this.cellSize = Math.min(
      Math.floor((this.width - 40) / this.cols),
      Math.floor((this.height - 110) / this.rows)
    );
    this.offsetX = Math.floor((this.width - (this.cols * this.cellSize)) / 2);
    this.offsetY = 55;

    // Grid: 0 = path, 1 = wall
    this.grid = [];
    this.gems = []; // [{ c, r, collected }]
    this.goal = { c: this.cols - 1, r: this.rows - 1 };
    this.solutionPath = [];

    // Player position (discrete cell + smooth interpolation)
    this.playerCell = { c: 0, r: 0 };
    this.playerVisual = { x: 0, y: 0 };
    this.moveQueue = [];

    // Stats
    this.score = 0;
    this.gemsCollected = 0;
    this.stepsTaken = 0;

    // Visuals & particles
    this.particles = [];
    this.footprints = [];
    this.petImage = null;
    this.loadPetImage();

    // Touch / swipe tracking
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isDragging = false;

    // Generate maze
    this.generateMaze();

    // Event binding
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
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

  generateMaze() {
    // Guaranteed solvable kid maze generator
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        // Initially all walls except start and goal
        row.push(1);
      }
      this.grid.push(row);
    }

    // Depth-First Search carving with 2-step jumps
    const stack = [];
    const startC = 0;
    const startR = 0;
    this.grid[startR][startC] = 0;
    stack.push({ c: startC, r: startR });

    while (stack.length > 0) {
      const curr = stack[stack.length - 1];
      const neighbors = [];

      const dirs = [
        { dc: 0, dr: -2, wc: 0, wr: -1 }, // North
        { dc: 0, dr: 2, wc: 0, wr: 1 },   // South
        { dc: -2, dr: 0, wc: -1, wr: 0 }, // West
        { dc: 2, dr: 0, wc: 1, wr: 0 }    // East
      ];

      dirs.forEach(d => {
        const nc = curr.c + d.dc;
        const nr = curr.r + d.dr;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows && this.grid[nr][nc] === 1) {
          neighbors.push({ nc, nr, wc: curr.c + d.wc, wr: curr.r + d.wr });
        }
      });

      if (neighbors.length > 0) {
        const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.grid[pick.wr][pick.wc] = 0;
        this.grid[pick.nr][pick.nc] = 0;
        stack.push({ c: pick.nc, r: pick.nr });
      } else {
        stack.pop();
      }
    }

    // Ensure goal is open
    this.goal = { c: this.cols - 1, r: this.rows - 1 };
    this.grid[this.goal.r][this.goal.c] = 0;
    // Ensure neighbor to goal is open so it's always accessible
    if (this.goal.c > 0) this.grid[this.goal.r][this.goal.c - 1] = 0;
    if (this.goal.r > 0) this.grid[this.goal.r - 1][this.goal.c] = 0;

    // For Toddler mode, open a few extra cross-connections so it's spacious
    if (this.toddlerMode) {
      for (let r = 1; r < this.rows - 1; r++) {
        for (let c = 1; c < this.cols - 1; c++) {
          if (Math.random() < 0.35) {
            this.grid[r][c] = 0;
          }
        }
      }
    }

    // Solve shortest path with BFS for Toddler breadcrumb hint
    this.findSolutionPath();

    // Place 4-6 Star Gems along the corridors
    this.gems = [];
    const openCells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === 0 && !(c === 0 && r === 0) && !(c === this.goal.c && r === this.goal.r)) {
          openCells.push({ c, r });
        }
      }
    }
    const shuffled = openCells.sort(() => Math.random() - 0.5);
    const gemCount = Math.min(this.toddlerMode ? 4 : 7, shuffled.length);
    for (let i = 0; i < gemCount; i++) {
      this.gems.push({ c: shuffled[i].c, r: shuffled[i].r, collected: false });
    }

    // Init player coords
    this.playerCell = { c: 0, r: 0 };
    const initialPos = this.cellToCoords(0, 0);
    this.playerVisual = { x: initialPos.x, y: initialPos.y };
  }

  findSolutionPath() {
    const queue = [{ c: 0, r: 0, path: [{ c: 0, r: 0 }] }];
    const visited = new Set(['0,0']);
    this.solutionPath = [];

    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr.c === this.goal.c && curr.r === this.goal.r) {
        this.solutionPath = curr.path;
        break;
      }

      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      dirs.forEach(([dc, dr]) => {
        const nc = curr.c + dc;
        const nr = curr.r + dr;
        const key = `${nc},${nr}`;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows && this.grid[nr][nc] === 0 && !visited.has(key)) {
          visited.add(key);
          queue.push({ c: nc, r: nr, path: [...curr.path, { c: nc, r: nr }] });
        }
      });
    }
  }

  cellToCoords(c, r) {
    return {
      x: this.offsetX + c * this.cellSize + this.cellSize / 2,
      y: this.offsetY + r * this.cellSize + this.cellSize / 2
    };
  }

  coordsToCell(x, y) {
    const c = Math.floor((x - this.offsetX) / this.cellSize);
    const r = Math.floor((y - this.offsetY) / this.cellSize);
    return { c, r };
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.cellSize = Math.min(
      Math.floor((this.width - 40) / this.cols),
      Math.floor((this.height - 110) / this.rows)
    );
    this.offsetX = Math.floor((this.width - (this.cols * this.cellSize)) / 2);
    this.offsetY = 55;
    const currentCoords = this.cellToCoords(this.playerCell.c, this.playerCell.r);
    this.playerVisual.x = currentCoords.x;
    this.playerVisual.y = currentCoords.y;
  }

  setToddlerMode(enabled) {
    this.toddlerMode = Boolean(enabled);
  }

  bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
    this.canvas.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    this.canvas.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  unbindEvents() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('pointermove', this.handlePointerMove);
      this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
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

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    this.touchStartX = x;
    this.touchStartY = y;
    this.isDragging = true;

    // Check tap on corridor
    const cell = this.coordsToCell(x, y);
    if (cell.c >= 0 && cell.c < this.cols && cell.r >= 0 && cell.r < this.rows) {
      const dc = cell.c - this.playerCell.c;
      const dr = cell.r - this.playerCell.r;
      if (Math.abs(dc) + Math.abs(dr) === 1) {
        this.tryMove(dc, dr);
      } else if (dc !== 0 || dr !== 0) {
        // Toddler friendly: step in dominant direction toward tapped tile
        if (Math.abs(dc) >= Math.abs(dr)) {
          this.tryMove(Math.sign(dc), 0);
        } else {
          this.tryMove(0, Math.sign(dr));
        }
      }
    }
  }

  handlePointerMove(e) {
    if (!this.isDragging || !this.running || this.paused) return;
    if (e && e.preventDefault) e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const dx = x - this.touchStartX;
    const dy = y - this.touchStartY;
    const threshold = this.cellSize * 0.4;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.tryMove(dx > 0 ? 1 : -1, 0);
      } else {
        this.tryMove(0, dy > 0 ? 1 : -1);
      }
      this.touchStartX = x;
      this.touchStartY = y;
    }
  }

  handlePointerUp() {
    this.isDragging = false;
  }

  handleKeyDown(e) {
    if (!this.running || this.paused) return;
    if (e.code === 'ArrowUp' || e.key === 'w') {
      if (e.preventDefault) e.preventDefault();
      this.tryMove(0, -1);
    } else if (e.code === 'ArrowDown' || e.key === 's') {
      if (e.preventDefault) e.preventDefault();
      this.tryMove(0, 1);
    } else if (e.code === 'ArrowLeft' || e.key === 'a') {
      if (e.preventDefault) e.preventDefault();
      this.tryMove(-1, 0);
    } else if (e.code === 'ArrowRight' || e.key === 'd') {
      if (e.preventDefault) e.preventDefault();
      this.tryMove(1, 0);
    }
  }

  tryMove(dc, dr) {
    const targetC = this.playerCell.c + dc;
    const targetR = this.playerCell.r + dr;

    if (targetC < 0 || targetC >= this.cols || targetR < 0 || targetR >= this.rows) {
      Sound.chirp();
      return;
    }

    if (this.grid[targetR][targetC] === 1) {
      // Wall bump
      Sound.chirp();
      return;
    }

    // Valid move!
    this.footprints.push({ ...this.playerCell, alpha: 0.8 });
    this.playerCell = { c: targetC, r: targetR };
    this.stepsTaken++;
    Sound.pop();

    // Check Star Gem collection
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      if (!g.collected && g.c === targetC && g.r === targetR) {
        g.collected = true;
        this.gemsCollected++;
        this.score += 30;
        Sound.coin();
        const coords = this.cellToCoords(g.c, g.r);
        this.spawnSparkles(coords.x, coords.y, '#ffb961', 12);
        if (this.options.onScoreUpdate) {
          this.options.onScoreUpdate(this.score);
        }
        break;
      }
    }

    // Check Victory (Treasure Chest goal)
    if (targetC === this.goal.c && targetR === this.goal.r) {
      this.score += 150;
      const coords = this.cellToCoords(this.goal.c, this.goal.r);
      this.spawnSparkles(coords.x, coords.y, '#f59e0b', 24);
      if (this.options.onVoiceCheer) {
        this.options.onVoiceCheer("Treasure discovered! You conquered the maze!");
      }
      this.endGame(true);
    }
  }

  spawnSparkles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        color: color || '#ffb961',
        size: 3 + Math.random() * 4,
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
    this.score = 0;
    this.gemsCollected = 0;
    this.stepsTaken = 0;
    this.particles = [];
    this.footprints = [];
    this.generateMaze();

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
    // Smoothly interpolate visual player position to target cell
    const targetPos = this.cellToCoords(this.playerCell.c, this.playerCell.r);
    this.playerVisual.x += (targetPos.x - this.playerVisual.x) * dt * 14;
    this.playerVisual.y += (targetPos.y - this.playerVisual.y) * dt * 14;

    // Fade footprints
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      this.footprints[i].alpha -= dt * 0.4;
      if (this.footprints[i].alpha <= 0) {
        this.footprints.splice(i, 1);
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

  endGame(won = true) {
    this.running = false;
    Sound.fanfare();
    if (this.options.onGameOver) {
      this.options.onGameOver(this.score, {
        won,
        gems: this.gemsCollected,
        steps: this.stepsTaken
      });
    }
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Midnight Slate background (#09141e)
    ctx.fillStyle = '#09141e';
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Render Maze Grid
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.offsetX + c * this.cellSize;
        const y = this.offsetY + r * this.cellSize;
        const isWall = this.grid[r][c] === 1;

        if (isWall) {
          // Wall: Slate block with glowing neon cyan/emerald border
          ctx.fillStyle = '#0d2235';
          this.roundRect(ctx, x + 2, y + 2, this.cellSize - 4, this.cellSize - 4, 6, true, false);
          ctx.strokeStyle = '#0e4a5a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Corridor path: Soft starlight floor tile
          ctx.fillStyle = '#11293d';
          this.roundRect(ctx, x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 4, true, false);
        }
      }
    }

    // 3. Toddler Mode Breadcrumb Glow Trail
    if (this.toddlerMode && this.solutionPath.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 210, 211, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      this.solutionPath.forEach((pt, idx) => {
        const coords = this.cellToCoords(pt.c, pt.r);
        if (idx === 0) ctx.moveTo(coords.x, coords.y);
        else ctx.lineTo(coords.x, coords.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 4. Footprints trail
    this.footprints.forEach(fp => {
      const coords = this.cellToCoords(fp.c, fp.r);
      ctx.fillStyle = `rgba(16, 185, 129, ${fp.alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Star Gems
    this.gems.forEach(g => {
      if (!g.collected) {
        const coords = this.cellToCoords(g.c, g.r);
        ctx.save();
        ctx.font = `${Math.floor(this.cellSize * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ffb961';
        ctx.shadowBlur = 8;
        ctx.fillText('⭐', coords.x, coords.y);
        ctx.restore();
      }
    });

    // 6. Golden Treasure Chest Goal
    const goalPos = this.cellToCoords(this.goal.c, this.goal.r);
    ctx.save();
    ctx.font = `${Math.floor(this.cellSize * 0.65)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.fillText('🏆', goalPos.x, goalPos.y);
    ctx.restore();

    // 7. Active Pet Hero
    this.renderPlayer(ctx);

    // 8. Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. On-Screen Chunky D-Pad Touch Buttons (for Toddler Easy Navigation)
    this.renderOnScreenDPad(ctx);

    // 10. HUD
    this.renderHUD(ctx);
  }

  renderPlayer(ctx) {
    ctx.save();
    const cx = this.playerVisual.x;
    const cy = this.playerVisual.y;
    const size = Math.floor(this.cellSize * 0.75);

    if (this.petImage && this.petImage.complete && this.petImage.naturalWidth > 0) {
      ctx.drawImage(this.petImage, cx - size / 2, cy - size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.pet.color || '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = `${Math.floor(size * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.pet.emoji || '🐾', cx, cy + 1);
    }
    ctx.restore();
  }

  renderOnScreenDPad(ctx) {
    // Only render on touch/mobile view or when enough vertical space
    if (this.height < 360) return;

    // Large high-contrast arrow buttons rendered on bottom right/left
    // Handled primarily via DOM buttons in ArcadeModal for maximum touch responsiveness
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

    // Gems collected pill (Top Right)
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    const totalGems = this.gems.length;
    ctx.fillText(`💎 ${this.gemsCollected}/${totalGems} Gems`, this.width - 20, 28);

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
