/**
 * WorldAdventureMapCanvas.js
 * High-Performance Procedural 3D Floating Archipelago Engine
 * 4 Living Biomes, 360° Touch Turntable Orbit, Isometric Tilt, Pinch Zoom,
 * Real-world Sky Cycle (Sunrise, Daytime, Sunset, Bedtime Twilight with Fireflies),
 * Toy-Box Touch Physics (Tree shaking, waterfall splashes, musical rune chimes, mystery chests),
 * Walking Hero & Pet Companion navigation along the Path of Valor.
 *
 * Strictly adheres to Explorer Design System: Zero pink or purple.
 */

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import {
  WORLD_BIOMES,
  PATH_OF_VALOR_WAYPOINTS,
  SECRET_SHRINES,
  TOY_BOX_ENTITIES
} from '../data/worldMapData.js';
import { registerActiveCanvas } from '../utils/activeViewCanvasRegistry.js';

export class WorldAdventureMapCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = options;

    // Viewport & Scale
    this.width = 0;
    this.height = 0;
    this.pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    // 3D Camera Controls
    this.camera = {
      rotY: Math.PI / 4, // 45° initial turntable angle
      tilt: 0.65, // Camera pitch (elevation angle in radians ~37°)
      zoom: 1.0,
      targetZoom: 1.0,
      centerX: 0,
      centerY: 0,
      distance: 380
    };

    // Interaction Drag State
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.dragDistance = 0;
    this.pinchStartDist = 0;

    // Animation & Particle State
    this.animFrameId = null;
    this.lastTime = performance.now();
    this.time = 0;

    // Toy-Box Interactive Animations
    this.shakingTrees = new Map(); // id -> { remainingMs: 0 }
    this.splashes = []; // array of active splash particles
    this.fireflies = []; // array of nighttime fireflies
    this.stars = []; // sky stars
    this.clouds = []; // sky clouds
    this.floatingNotes = []; // chime particles

    // Hero & Pet Walking Path State
    this.heroPos = { x: -28, y: 1.5, z: -28 };
    this.petPos = { x: -30, y: 1.5, z: -30 };
    this.targetWaypointIdx = 0;
    this.pathProgress = 0;

    // Raycast Clickable Entities
    this.renderedHitTargets = [];

    this.initEnvironment();
    this.bindEvents();
    this.resize();

    // Register canvas with global registry to kill RAF loops on view transitions
    registerActiveCanvas(() => this.destroy());

    // Start 60fps render loop
    this.startLoop();
  }

  initEnvironment() {
    // Generate static night stars
    this.stars = Array.from({ length: 45 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.6,
      size: Math.random() * 2 + 1,
      twinkleOffset: Math.random() * Math.PI * 2
    }));

    // Generate daytime clouds
    this.clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * 1.5 - 0.25,
      y: 0.1 + Math.random() * 0.25,
      speed: 0.0003 + Math.random() * 0.0003,
      size: 40 + Math.random() * 30
    }));

    // Generate floating fireflies for twilight/bedtime
    this.fireflies = Array.from({ length: 28 }, () => ({
      x: (Math.random() - 0.5) * 80,
      y: Math.random() * 8 + 1,
      z: (Math.random() - 0.5) * 80,
      speed: Math.random() * 0.8 + 0.4,
      phase: Math.random() * Math.PI * 2
    }));
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement 
      ? this.canvas.parentElement.getBoundingClientRect()
      : { width: 800, height: 600 };

    this.width = rect.width || 800;
    this.height = Math.max(500, rect.height || 620);

    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  bindEvents() {
    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
    this.handleWheel = this.onWheel.bind(this);
    this.handleResize = () => this.resize();

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);

    // Touch Pinch Zoom
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.pinchStartDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / this.pinchStartDist;
        this.camera.targetZoom = Math.max(0.65, Math.min(1.85, this.camera.targetZoom * factor));
        this.pinchStartDist = dist;
      }
    }, { passive: true });
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.dragDistance = 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  onPointerMove(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.dragDistance += Math.hypot(dx, dy);

    // Horizontal drag = Turntable Yaw Rotation
    this.camera.rotY += dx * 0.007;

    // Vertical drag = Pitch Tilt
    this.camera.tilt = Math.max(0.35, Math.min(1.15, this.camera.tilt + dy * 0.004));

    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    // If drag distance was minimal (< 8px), treat as a tap/click on 3D elements!
    if (this.dragDistance < 8) {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      this.handleCanvasClick(clickX, clickY);
    }
  }

  onWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0015;
    this.camera.targetZoom = Math.max(0.65, Math.min(1.85, this.camera.targetZoom + zoomDelta));
  }

  handleCanvasClick(clickX, clickY) {
    // Check raycasted hit targets in order of Z depth (closest first)
    const sortedTargets = [...this.renderedHitTargets].sort((a, b) => b.depth - a.depth);

    for (const target of sortedTargets) {
      const dist = Math.hypot(clickX - target.screenX, clickY - target.screenY);
      if (dist <= target.radius) {
        this.onEntityTapped(target);
        return;
      }
    }
  }

  onEntityTapped(target) {
    switch (target.type) {
      case 'waypoint':
        if (typeof Sound?.tap === 'function') Sound.tap();
        store.setWorldWaypointSelected(target.data.id);
        if (this.options.onWaypointClick) {
          this.options.onWaypointClick(target.data);
        }
        break;

      case 'fruit_tree':
        this.shakeTree(target.id, target.screenX, target.screenY);
        break;

      case 'waterfall':
        this.triggerWaterfallSplash(target.screenX, target.screenY);
        break;

      case 'rune_monolith':
        this.chimeRune(target.data, target.screenX, target.screenY);
        break;

      case 'secret_shrine':
        this.discoverShrine(target.data);
        break;

      case 'parent_chest':
        this.tapParentChest(target.data);
        break;

      default:
        break;
    }
  }

  shakeTree(treeId, screenX, screenY) {
    this.shakingTrees.set(treeId, { remainingMs: 600 });
    if (typeof Sound?.crunch === 'function') Sound.crunch();
    else if (typeof Sound?.pop === 'function') Sound.pop();

    store.recordToyBoxInteraction('apple');

    // Spawn falling apple fruit particle
    this.floatingNotes.push({
      x: screenX + (Math.random() - 0.5) * 20,
      y: screenY - 20,
      vy: 1.5,
      life: 1.0,
      text: '🍎 +2 Coins',
      color: '#2ecc71'
    });
  }

  triggerWaterfallSplash(screenX, screenY) {
    if (typeof Sound?.splash === 'function') Sound.splash();
    else if (typeof Sound?.bloop === 'function') Sound.bloop();

    store.recordToyBoxInteraction('splash');

    // Spawn 15 water droplet particles
    for (let i = 0; i < 15; i++) {
      this.splashes.push({
        x: screenX,
        y: screenY,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 6 - 2,
        size: Math.random() * 4 + 2,
        life: 1.0,
        color: '#00d2d3'
      });
    }

    // Leaping fish
    this.floatingNotes.push({
      x: screenX,
      y: screenY - 10,
      vy: -2.0,
      life: 1.0,
      text: '🐟 Splish!',
      color: '#00d2d3'
    });
  }

  chimeRune(runeData, screenX, screenY) {
    if (typeof Sound?.chirp === 'function') Sound.chirp();
    store.recordToyBoxInteraction('chime');

    this.floatingNotes.push({
      x: screenX,
      y: screenY - 20,
      vy: -1.5,
      life: 1.0,
      text: '🎵 Chime!',
      color: '#ffb961'
    });
  }

  discoverShrine(shrineData) {
    const res = store.discoverWorldSecret(shrineData.id);
    if (res.alreadyDiscovered) {
      if (typeof Sound?.bloop === 'function') Sound.bloop();
      store.showReward('Secret Already Discovered!', `You unlocked ${shrineData.name}!`, 0, 0);
    } else if (res.success) {
      store.showReward(
        `Secret Unlocked: ${shrineData.name}!`,
        shrineData.speechDiscovery || 'Legendary explorer discovery!',
        shrineData.rewardCoins,
        Math.round(shrineData.rewardCoins / 2)
      );
    }
  }

  tapParentChest(chestData) {
    if (chestData.unlocked) {
      if (typeof Sound?.bloop === 'function') Sound.bloop();
      store.showReward('Mystery Stash Unlocked', 'You already claimed this secret stash!', 0, 0);
      return;
    }

    const res = store.unlockParentWorldChest(chestData.id);
    if (res.success) {
      store.showReward(
        'Mystery Stash Unlocked!',
        `Incredible streak dedication! You opened ${chestData.title}!`,
        chestData.rewardCoins,
        Math.round(chestData.rewardCoins / 2)
      );
    } else {
      store.showReward(
        'Locked Secret Stash 🔒',
        res.reason || `Requires a ${chestData.requiredStreak}-day streak to open! Keep going!`,
        0,
        0
      );
    }
  }

  // 3D Point to 2D Screen Projection Matrix
  project3D(x, y, z) {
    const cosY = Math.cos(this.camera.rotY);
    const sinY = Math.sin(this.camera.rotY);
    const cosT = Math.cos(this.camera.tilt);
    const sinT = Math.sin(this.camera.tilt);

    // Orbit Turntable Yaw
    const rotX = x * cosY - z * sinY;
    const rotZ = x * sinY + z * cosY;

    // Camera Pitch Tilt (Isometric Angle)
    const projY = -y * cosT + rotZ * sinT;
    const projZ = y * sinT + rotZ * cosT;

    // Perspective depth divisor
    const perspective = 480 / (480 + projZ * 1.5);
    const scale = this.camera.zoom * perspective;

    const screenX = this.width / 2 + rotX * 5.2 * scale;
    const screenY = this.height / 2 + 30 + projY * 4.4 * scale;

    return { screenX, screenY, scale, depth: projZ };
  }

  getTimeOfDay() {
    const mapState = store.getWorldAdventureMapState();
    if (mapState.islandTimeOverride) {
      return mapState.islandTimeOverride;
    }
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'sunset';
    return 'bedtime';
  }

  startLoop() {
    const loop = (timestamp) => {
      const dt = Math.min(100, timestamp - this.lastTime);
      this.lastTime = timestamp;
      this.time += dt * 0.001;

      // Smooth zoom lerp
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;

      this.update(dt);
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  update(dt) {
    // Update tree shake animations
    for (const [treeId, shake] of this.shakingTrees.entries()) {
      shake.remainingMs -= dt;
      if (shake.remainingMs <= 0) {
        this.shakingTrees.delete(treeId);
      }
    }

    // Update splash particles
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.25; // gravity
      s.life -= 0.025;
      if (s.life <= 0) {
        this.splashes.splice(i, 1);
      }
    }

    // Update floating note labels
    for (let i = this.floatingNotes.length - 1; i >= 0; i--) {
      const note = this.floatingNotes[i];
      note.y += note.vy;
      note.life -= 0.02;
      if (note.life <= 0) {
        this.floatingNotes.splice(i, 1);
      }
    }

    // Hero & Pet Path Walking Lerp
    const waypoints = PATH_OF_VALOR_WAYPOINTS;
    const targetWp = waypoints[this.targetWaypointIdx] || waypoints[0];
    this.heroPos.x += (targetWp.coordinates.x - this.heroPos.x) * 0.04;
    this.heroPos.y += (targetWp.coordinates.y - this.heroPos.y) * 0.04;
    this.heroPos.z += (targetWp.coordinates.z - this.heroPos.z) * 0.04;

    this.petPos.x += (this.heroPos.x - 2.5 - this.petPos.x) * 0.03;
    this.petPos.y += (this.heroPos.y - this.petPos.y) * 0.03;
    this.petPos.z += (this.heroPos.z - 2.5 - this.petPos.z) * 0.03;
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.renderedHitTargets = [];

    const timeOfDay = this.getTimeOfDay();

    // 1. Draw Sky & Lighting Atmosphere
    this.drawSky(timeOfDay);

    // 2. Draw Floating Archipelago Island Strata (4 Biomes)
    this.drawIslandBase();

    // 3. Draw Cobblestone Path of Valor Waypoint Trail
    this.drawPathTrail();

    // 4. Draw Biome Props & Interactive Toy-Box Entities
    this.drawBiomeProps();

    // 5. Draw Hero & Active Pet Companion Walkers
    this.drawHeroAndPet();

    // 6. Draw Waypoint Pins & Shrines
    this.drawWaypointsAndShrines();

    // 7. Draw Mystery Chests & Custom Landmarks
    this.drawParentStashes();

    // 8. Draw Atmosphere Particles (Fireflies / Splashes / Floating Text)
    this.drawAtmosphere(timeOfDay);
  }

  drawSky(timeOfDay) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);

    if (timeOfDay === 'morning') {
      grad.addColorStop(0, '#0a2318');
      grad.addColorStop(0.5, '#134731');
      grad.addColorStop(1, '#1b6946');
    } else if (timeOfDay === 'day') {
      grad.addColorStop(0, '#051824');
      grad.addColorStop(0.5, '#0b324a');
      grad.addColorStop(1, '#0e4a6d');
    } else if (timeOfDay === 'sunset') {
      grad.addColorStop(0, '#261205');
      grad.addColorStop(0.5, '#4a2208');
      grad.addColorStop(1, '#6e340a');
    } else {
      // Bedtime Twilight
      grad.addColorStop(0, '#03080d');
      grad.addColorStop(0.5, '#08141e');
      grad.addColorStop(1, '#0e2233');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Stars (at night or morning)
    if (timeOfDay === 'bedtime' || timeOfDay === 'morning') {
      ctx.fillStyle = '#ffb961';
      for (const s of this.stars) {
        const alpha = Math.sin(this.time * 2 + s.twinkleOffset) * 0.4 + 0.6;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x * this.width, s.y * this.height, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }
  }

  drawIslandBase() {
    const ctx = this.ctx;

    // 4 Biome Quadrants:
    // Q1: Meadows (-X, -Z)
    // Q2: Lagoon (+X, -Z)
    // Q3: Volcano (-X, +Z)
    // Q4: Summit (+X, +Z)
    const quadrants = [
      { name: 'Whispering Meadows', color: '#1b4332', edge: '#2ecc71', x1: -42, z1: -42, x2: -2, z2: -2, yBase: 0, yTop: 2.2 },
      { name: 'Sunken Lagoon', color: '#042a38', edge: '#00d2d3', x1: 2, z1: -42, x2: 42, z2: -2, yBase: 0, yTop: 1.8 },
      { name: 'Molten Volcano', color: '#3d1c06', edge: '#f39c12', x1: -42, z1: 2, x2: -2, z2: 42, yBase: 0, yTop: 3.8 },
      { name: 'Crystal Summit', color: '#16222f', edge: '#ffb961', x1: 2, z1: 2, x2: 42, z2: 42, yBase: 0, yTop: 6.2 }
    ];

    quadrants.forEach((q) => {
      // Under-island floating rock strata (dark drop cliff)
      const p1 = this.project3D(q.x1, q.yBase - 8, q.z1);
      const p2 = this.project3D(q.x2, q.yBase - 8, q.z1);
      const p3 = this.project3D(q.x2, q.yBase - 8, q.z2);
      const p4 = this.project3D(q.x1, q.yBase - 8, q.z2);

      const t1 = this.project3D(q.x1, q.yTop, q.z1);
      const t2 = this.project3D(q.x2, q.yTop, q.z1);
      const t3 = this.project3D(q.x2, q.yTop, q.z2);
      const t4 = this.project3D(q.x1, q.yTop, q.z2);

      // Draw subterranean rock wall
      ctx.fillStyle = '#061019';
      ctx.beginPath();
      ctx.moveTo(p1.screenX, p1.screenY);
      ctx.lineTo(p2.screenX, p2.screenY);
      ctx.lineTo(t2.screenX, t2.screenY);
      ctx.lineTo(t1.screenX, t1.screenY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p2.screenX, p2.screenY);
      ctx.lineTo(p3.screenX, p3.screenY);
      ctx.lineTo(t3.screenX, t3.screenY);
      ctx.lineTo(t2.screenX, t2.screenY);
      ctx.closePath();
      ctx.fill();

      // Draw Plateau Surface
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.moveTo(t1.screenX, t1.screenY);
      ctx.lineTo(t2.screenX, t2.screenY);
      ctx.lineTo(t3.screenX, t3.screenY);
      ctx.lineTo(t4.screenX, t4.screenY);
      ctx.closePath();
      ctx.fill();

      // Stylized edge glow
      ctx.strokeStyle = q.edge;
      ctx.lineWidth = 2.5 * t1.scale;
      ctx.stroke();
    });

    // Draw Lagoon Water Surface in Q2
    const w1 = this.project3D(10, 1.9, -34);
    const w2 = this.project3D(34, 1.9, -34);
    const w3 = this.project3D(34, 1.9, -10);
    const w4 = this.project3D(10, 1.9, -10);

    const waterGrad = ctx.createLinearGradient(w1.screenX, w1.screenY, w3.screenX, w3.screenY);
    waterGrad.addColorStop(0, '#00d2d3');
    waterGrad.addColorStop(1, '#057a8a');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.moveTo(w1.screenX, w1.screenY);
    ctx.lineTo(w2.screenX, w2.screenY);
    ctx.lineTo(w3.screenX, w3.screenY);
    ctx.lineTo(w4.screenX, w4.screenY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#55efc4';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawPathTrail() {
    const ctx = this.ctx;
    const waypoints = PATH_OF_VALOR_WAYPOINTS;

    // Draw Cobblestone Waypoint Trail
    ctx.save();
    ctx.beginPath();
    waypoints.forEach((wp, idx) => {
      const p = this.project3D(wp.coordinates.x, wp.coordinates.y + 0.1, wp.coordinates.z);
      if (idx === 0) ctx.moveTo(p.screenX, p.screenY);
      else ctx.lineTo(p.screenX, p.screenY);
    });
    ctx.strokeStyle = '#050f18';
    ctx.lineWidth = 14 * this.camera.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner bright dashed trail
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 4 * this.camera.zoom;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawBiomeProps() {
    const ctx = this.ctx;

    // Render interactive toy-box entities
    TOY_BOX_ENTITIES.forEach((entity) => {
      const p = this.project3D(entity.coordinates.x, entity.coordinates.y, entity.coordinates.z);

      if (entity.type === 'fruit_tree') {
        const isShaking = this.shakingTrees.has(entity.id);
        const shakeAngle = isShaking ? Math.sin(this.time * 25) * 0.15 : 0;

        ctx.save();
        ctx.translate(p.screenX, p.screenY);
        ctx.rotate(shakeAngle);
        ctx.scale(p.scale, p.scale);

        // Trunk
        ctx.fillStyle = '#4a2800';
        ctx.fillRect(-4, -14, 8, 14);

        // Foliage Foliar Blob
        ctx.fillStyle = entity.color;
        ctx.beginPath();
        ctx.arc(0, -22, 16, 0, Math.PI * 2);
        ctx.fill();

        // Apples
        ctx.fillStyle = entity.fruitType === 'apple' ? '#e74c3c' : '#00d2d3';
        [-6, 4, -2].forEach((ox, i) => {
          ctx.beginPath();
          ctx.arc(ox, -22 + (i * 4 - 4), 3, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        // Register hit target for shaking
        this.renderedHitTargets.push({
          type: 'fruit_tree',
          id: entity.id,
          screenX: p.screenX,
          screenY: p.screenY - 18 * p.scale,
          radius: 24 * p.scale,
          depth: p.depth
        });
      } else if (entity.type === 'waterfall') {
        // Waterfall Cascade
        ctx.fillStyle = '#00d2d3';
        const flow = (this.time * 40) % 20;
        ctx.fillRect(p.screenX - 8 * p.scale, p.screenY - 15 * p.scale, 16 * p.scale, 25 * p.scale);

        this.renderedHitTargets.push({
          type: 'waterfall',
          id: entity.id,
          screenX: p.screenX,
          screenY: p.screenY,
          radius: 26 * p.scale,
          depth: p.depth
        });
      } else if (entity.type === 'rune_monolith') {
        // Glowing Obelisk Monolith
        ctx.save();
        ctx.translate(p.screenX, p.screenY);
        ctx.scale(p.scale, p.scale);

        ctx.fillStyle = '#0b1e2c';
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.lineTo(4, -28);
        ctx.lineTo(0, -34);
        ctx.lineTo(-4, -28);
        ctx.closePath();
        ctx.fill();

        // Rune Glyph
        ctx.fillStyle = '#ffb961';
        ctx.shadowColor = '#ffb961';
        ctx.shadowBlur = 6;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ᚱ', 0, -14);
        ctx.restore();

        this.renderedHitTargets.push({
          type: 'rune_monolith',
          id: entity.id,
          data: entity,
          screenX: p.screenX,
          screenY: p.screenY - 16 * p.scale,
          radius: 20 * p.scale,
          depth: p.depth
        });
      }
    });
  }

  drawHeroAndPet() {
    const ctx = this.ctx;
    const heroProj = this.project3D(this.heroPos.x, this.heroPos.y + 0.8, this.heroPos.z);
    const petProj = this.project3D(this.petPos.x, this.petPos.y + 0.6, this.petPos.z);

    // 1. Hero Avatar (Skeletal Walker with Shield & Cape)
    ctx.save();
    ctx.translate(heroProj.screenX, heroProj.screenY);
    ctx.scale(heroProj.scale, heroProj.scale);

    const bob = Math.sin(this.time * 8) * 2;

    // Hero Drop Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cape (Billowing)
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(-6, -14 + bob);
    ctx.lineTo(-12 + Math.sin(this.time * 6) * 3, -4 + bob);
    ctx.lineTo(-4, -6 + bob);
    ctx.closePath();
    ctx.fill();

    // Body Armor
    ctx.fillStyle = '#09141e';
    ctx.fillRect(-6, -18 + bob, 12, 14);

    // Head / Helmet
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(0, -22 + bob, 7, 0, Math.PI * 2);
    ctx.fill();

    // Golden Crest
    ctx.fillStyle = '#ffb961';
    ctx.fillRect(-2, -31 + bob, 4, 6);
    ctx.restore();

    // 2. Active Companion Pet (Running alongside)
    const activePet = store.getActivePet();
    ctx.save();
    ctx.translate(petProj.screenX, petProj.screenY);
    ctx.scale(petProj.scale * 0.85, petProj.scale * 0.85);

    const petBob = Math.cos(this.time * 8) * 2.5;

    // Pet Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pet Body
    ctx.fillStyle = activePet.color || '#2ecc71';
    ctx.beginPath();
    ctx.arc(0, -12 + petBob, 9, 0, Math.PI * 2);
    ctx.fill();

    // Pet Ears / Horns
    ctx.fillStyle = '#ffb961';
    ctx.beginPath();
    ctx.arc(-5, -20 + petBob, 3, 0, Math.PI * 2);
    ctx.arc(5, -20 + petBob, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pet Happy Eyes
    ctx.fillStyle = '#09141e';
    ctx.beginPath();
    ctx.arc(-3, -13 + petBob, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -13 + petBob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawWaypointsAndShrines() {
    const ctx = this.ctx;
    const waypoints = PATH_OF_VALOR_WAYPOINTS;
    const mapState = store.getWorldAdventureMapState();
    const selectedWpId = mapState.selectedWaypointId;

    // Draw 8 Waypoints
    waypoints.forEach((wp, idx) => {
      const p = this.project3D(wp.coordinates.x, wp.coordinates.y + 1.2, wp.coordinates.z);
      const isSelected = selectedWpId === wp.id;
      const isNext = idx === this.targetWaypointIdx;

      ctx.save();
      ctx.translate(p.screenX, p.screenY);
      ctx.scale(p.scale, p.scale);

      // Pulsing Ring for Next or Selected Waypoint
      if (isSelected || isNext) {
        ctx.strokeStyle = wp.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const pulse = 18 + Math.sin(this.time * 6) * 4;
        ctx.arc(0, -18, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Waypoint Stem
      ctx.fillStyle = '#050f18';
      ctx.fillRect(-2, -6, 4, 8);

      // Waypoint Chunky Marker Pin
      ctx.fillStyle = wp.color;
      ctx.beginPath();
      ctx.arc(0, -18, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#050f18';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Step Number Text
      ctx.fillStyle = '#050f18';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(wp.stepNumber), 0, -18);

      ctx.restore();

      // Register hit target for tap
      this.renderedHitTargets.push({
        type: 'waypoint',
        id: wp.id,
        data: wp,
        screenX: p.screenX,
        screenY: p.screenY - 18 * p.scale,
        radius: 24 * p.scale,
        depth: p.depth
      });
    });

    // Draw Secret Discovery Shrines
    SECRET_SHRINES.forEach((shrine) => {
      const p = this.project3D(shrine.coordinates.x, shrine.coordinates.y + 0.8, shrine.coordinates.z);
      const isDiscovered = (mapState.discoveredSecrets || []).includes(shrine.id);

      ctx.save();
      ctx.translate(p.screenX, p.screenY);
      ctx.scale(p.scale, p.scale);

      // Shrine Pedestal
      ctx.fillStyle = isDiscovered ? shrine.color : '#1c3144';
      ctx.beginPath();
      ctx.arc(0, -10, isDiscovered ? 12 : 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffb961';
      ctx.lineWidth = isDiscovered ? 3 : 1;
      ctx.stroke();

      // Golden Star Badge
      ctx.fillStyle = '#050f18';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isDiscovered ? '★' : '?', 0, -10);

      ctx.restore();

      this.renderedHitTargets.push({
        type: 'secret_shrine',
        id: shrine.id,
        data: shrine,
        screenX: p.screenX,
        screenY: p.screenY - 10 * p.scale,
        radius: 20 * p.scale,
        depth: p.depth
      });
    });
  }

  drawParentStashes() {
    const ctx = this.ctx;
    const mapState = store.getWorldAdventureMapState();
    const chests = mapState.parentHiddenChests || [];

    chests.forEach((chest) => {
      const p = this.project3D(chest.coordinates.x, chest.coordinates.y + 0.8, chest.coordinates.z);

      ctx.save();
      ctx.translate(p.screenX, p.screenY);
      ctx.scale(p.scale, p.scale);

      // Chest Base Box
      ctx.fillStyle = chest.unlocked ? '#2ecc71' : '#f39c12';
      ctx.fillRect(-10, -14, 20, 14);
      ctx.strokeStyle = '#ffb961';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -14, 20, 14);

      // Chest Lock Icon
      ctx.fillStyle = '#050f18';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chest.unlocked ? '🔓' : '🔒', 0, -7);

      ctx.restore();

      this.renderedHitTargets.push({
        type: 'parent_chest',
        id: chest.id,
        data: chest,
        screenX: p.screenX,
        screenY: p.screenY - 7 * p.scale,
        radius: 22 * p.scale,
        depth: p.depth
      });
    });
  }

  drawAtmosphere(timeOfDay) {
    const ctx = this.ctx;

    // Draw Water Splash Droplets
    for (const s of this.splashes) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Floating Notes / Harvest Text
    for (const note of this.floatingNotes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, note.life);
      ctx.fillStyle = note.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(note.text, note.x, note.y);
      ctx.restore();
    }

    // Draw Fireflies at Twilight / Bedtime
    if (timeOfDay === 'bedtime' || store.getWorldAdventureMapState().bedtimeLullabyActive) {
      ctx.fillStyle = '#2ecc71';
      for (const fly of this.fireflies) {
        const flyX = fly.x + Math.sin(this.time * fly.speed + fly.phase) * 8;
        const flyZ = fly.z + Math.cos(this.time * fly.speed + fly.phase) * 8;
        const p = this.project3D(flyX, fly.y, flyZ);

        const glow = Math.sin(this.time * 4 + fly.phase) * 0.4 + 0.6;
        ctx.globalAlpha = glow;
        ctx.shadowColor = '#2ecc71';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, 2.5 * p.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1.0;
    }
  }

  setWaypoint(idx) {
    this.targetWaypointIdx = Math.max(0, Math.min(PATH_OF_VALOR_WAYPOINTS.length - 1, idx));
  }

  recenter() {
    this.camera.rotY = Math.PI / 4;
    this.camera.tilt = 0.65;
    this.camera.targetZoom = 1.0;
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('wheel', this.handleWheel);
    }
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('resize', this.handleResize);
  }
}
