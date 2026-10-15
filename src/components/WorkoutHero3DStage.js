/**
 * WorkoutHero3DStage.js
 * 
 * High-Performance Articulated 3D WebGL Stage for Dino Hero Workouts
 * 
 * Features:
 * 1. Side-by-Side 3D Synchronized Duo:
 *    - Left: 3D Articulated Dinosaur Coach (Rex, Raptor, Stego, Pterry, Chomper, Brachio, Dippy, Spino)
 *    - Right: Fully Articulated 3D Toddler Superhero Avatar with full FK bone hierarchy
 * 2. Pure Mathematical Gross-Motor Kinematics for all 8 Prehistoric Workouts:
 *    - Velociraptor Run, Stegosaurus Walks, Pterodactyl Take Off, T-Rex Run,
 *      Compsognathus Prances, Brachiosaurus Stretch, The Diplodocus, Spinosaurus Stretch.
 * 3. Parity Contract with WorkoutHeroDuoCanvas:
 *    - setWorkout(workoutId, coachId, tempoBpm)
 *    - setTimeRemaining(seconds)
 *    - triggerBeat()
 *    - startAnimation(), pauseAnimation(), resumeAnimation(), stopAnimation()
 *    - destroy()
 * 4. Resilient WebGL Fallback:
 *    - isWebGLSupported() detection
 *    - try/catch context acquisition
 *    - webglcontextlost recovery hot-swapping to WorkoutHeroDuoCanvas without interruption
 * 5. Strict Stitch Design System:
 *    - Electric Cyan (#00d2d3), Emerald Green (#2ecc71), Solar Amber (#f1c40f), Midnight Slate (#09141e).
 *    - ZERO pink or purple.
 */

import {
  createAvatarRig,
  createCoachRig,
  createRingGeometry,
  createBoxGeometry,
  STITCH_COLORS,
  hexToRgb,
  mat4Create,
  mat4Identity,
  mat4Perspective,
  mat4LookAt,
  mat4Multiply,
  mat4Invert,
  mat4Transpose
} from '../services/avatarSkeletalRig.js';

import {
  applyWorkoutKinematics,
  applyCoachKinematics
} from '../services/workoutKinematicsEngine.js';

import { WorkoutHeroDuoCanvas } from './WorkoutHeroDuoCanvas.js';

// =============================================================================
// WEBGL SHADERS
// =============================================================================

const VS_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aUV;

  uniform mat4 uProjectionMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uModelMatrix;
  uniform mat4 uNormalMatrix;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUV;

  void main() {
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
    vUV = aUV;
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
  }
`;

const FS_SOURCE = `
  precision mediump float;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUV;

  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uOpacity;
  uniform vec3 uCameraPosition;

  void main() {
    vec3 normal = normalize(vNormal);

    // Stitch Design System Lighting:
    // Key Light from top-front-right
    vec3 keyLightDir = normalize(vec3(1.2, 2.5, 2.0));
    float keyDiff = max(dot(normal, keyLightDir), 0.0);

    // Rim / Silhouette Light in Electric Cyan from behind-left
    vec3 rimLightDir = normalize(vec3(-1.8, 1.4, -1.2));
    float rimDiff = max(dot(normal, rimLightDir), 0.0);
    vec3 rimColor = vec3(0.0, 0.824, 0.827); // Electric Cyan

    // Ambient Light (Midnight Slate ambiance)
    vec3 ambientColor = vec3(0.07, 0.12, 0.18);

    // Specular Highlight
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    vec3 halfVec = normalize(keyLightDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 24.0) * 0.35;

    // Combined Lit Color
    vec3 diffuse = uColor * (ambientColor + keyDiff * 0.85);
    vec3 rim = rimColor * rimDiff * 0.40;
    vec3 finalColor = diffuse + rim + vec3(spec) + uEmissive;

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

// =============================================================================
// WEBGL SUPPORT DETECTION
// =============================================================================

export function isWebGLSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// =============================================================================
// 3D STAGE CLASS
// =============================================================================

export class WorkoutHero3DStage {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.workoutId = options.workoutId || 'velociraptor_run';
    this.coachId = String(options.coachId || '2');
    this.tempoBpm = options.tempoBpm || 120;
    this.workoutTimeRemaining = 60;
    this.isHalfwayFlipped = false;

    this.isFallback = false;
    this.fallbackCanvas = null;

    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.uniforms = {};
    this.attributes = {};
    this.meshBufferCache = new WeakMap();

    this.animId = null;
    this.isAnimating = true;
    this.isPaused = false;
    this.isDestroyed = false;

    this.clock = 0;
    this.lastTimestamp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.beatPulse = 0;

    // Floor Pedestal Primitives
    this.floorArenaMesh = null;
    this.floorInnerRingMesh = null;

    // 3D Camera & Matrices
    this.width = 640;
    this.height = 360;
    this.projMatrix = mat4Create();
    this.viewMatrix = mat4Create();
    this.modelMatrix = mat4Create();
    this.normalMatrix = mat4Create();
    this.invMat = mat4Create();
    this.cameraPosition = [0, 0.45, 3.4];

    // Initialize WebGL or fallback immediately
    this.init();
  }

  init() {
    if (!isWebGLSupported()) {
      this.initFallback('WebGL is not supported on this device/environment.');
      return;
    }

    try {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'w-full h-full block select-none pointer-events-none';
      if (this.container) {
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);
      }

      const glOpts = { alpha: true, antialias: true, depth: true, preserveDrawingBuffer: false };
      this.gl = this.canvas.getContext('webgl2', glOpts) ||
                this.canvas.getContext('webgl', glOpts) ||
                this.canvas.getContext('experimental-webgl', glOpts);

      if (!this.gl) {
        throw new Error('Failed to create WebGL context.');
      }

      this.initWebGLShaders();
      this.initSceneRigs();
      this.initFloorPedestal();
      this.handleResize();

      // Listen for window resize
      this._resizeHandler = () => this.handleResize();
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this._resizeHandler);
      }

      // WebGL Context Loss Handler
      this._contextLostHandler = (e) => {
        e.preventDefault();
        console.warn('[WorkoutHero3DStage] WebGL context lost. Gracefully falling back to 2D canvas.');
        this.initFallback('WebGL context lost');
      };
      this.canvas.addEventListener('webglcontextlost', this._contextLostHandler);

      this.startLoop();
    } catch (err) {
      console.warn('[WorkoutHero3DStage] WebGL initialization error:', err);
      this.initFallback(err.message);
    }
  }

  initFallback(reason = '') {
    if (this.isFallback && this.fallbackCanvas) {
      return;
    }
    this.isFallback = true;
    if (this.canvas && this._contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
    }
    if (this.animId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (typeof document !== 'undefined') {
      this.fallbackCanvas = new WorkoutHeroDuoCanvas(this.container, {
        ...this.options,
        workoutId: this.workoutId,
        coachId: this.coachId,
        tempoBpm: this.tempoBpm
      });
      this.fallbackCanvas.setTimeRemaining(this.workoutTimeRemaining);
    }
  }

  initWebGLShaders() {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VS_SOURCE);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('VS compilation failed: ' + gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FS_SOURCE);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('FS compilation failed: ' + gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Shader program linking failed: ' + gl.getProgramInfoLog(prog));
    }

    this.program = prog;
    gl.useProgram(prog);

    // Query attribute locations
    this.attributes.position = gl.getAttribLocation(prog, 'aPosition');
    this.attributes.normal = gl.getAttribLocation(prog, 'aNormal');
    this.attributes.uv = gl.getAttribLocation(prog, 'aUV');

    // Query uniform locations
    this.uniforms.projectionMatrix = gl.getUniformLocation(prog, 'uProjectionMatrix');
    this.uniforms.viewMatrix = gl.getUniformLocation(prog, 'uViewMatrix');
    this.uniforms.modelMatrix = gl.getUniformLocation(prog, 'uModelMatrix');
    this.uniforms.normalMatrix = gl.getUniformLocation(prog, 'uNormalMatrix');
    this.uniforms.color = gl.getUniformLocation(prog, 'uColor');
    this.uniforms.emissive = gl.getUniformLocation(prog, 'uEmissive');
    this.uniforms.opacity = gl.getUniformLocation(prog, 'uOpacity');
    this.uniforms.cameraPosition = gl.getUniformLocation(prog, 'uCameraPosition');

    // Setup Depth & Blending states
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.035, 0.078, 0.118, 1.0); // Midnight Slate
  }

  initSceneRigs() {
    this.avatarRig = createAvatarRig(this.options);
    this.coachRig = createCoachRig(this.coachId, this.options);
  }

  initFloorPedestal() {
    // Floor Cyber Pedestal Rings
    this.floorArenaGeom = createRingGeometry(0.70, 0.78, 36);
    this.floorInnerRingGeom = createRingGeometry(0.35, 0.38, 28);
    this.floorPulseRingGeom = createRingGeometry(0.95, 1.00, 36);
  }

  getOrCreateMeshBuffers(geom) {
    if (!geom) return null;
    let bufs = this.meshBufferCache.get(geom);
    if (!bufs) {
      const gl = this.gl;
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geom.positions, gl.STATIC_DRAW);

      const normBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geom.normals, gl.STATIC_DRAW);

      const uvBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geom.uvs, gl.STATIC_DRAW);

      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indices, gl.STATIC_DRAW);

      bufs = {
        position: posBuf,
        normal: normBuf,
        uv: uvBuf,
        indices: idxBuf,
        count: geom.indices.length
      };
      this.meshBufferCache.set(geom, bufs);
    }
    return bufs;
  }

  handleResize() {
    if (this.isFallback && this.fallbackCanvas) {
      if (typeof this.fallbackCanvas.handleResize === 'function') {
        this.fallbackCanvas.handleResize();
      }
      return;
    }
    if (!this.canvas || !this.container || !this.gl) return;

    const rect = (typeof this.container.getBoundingClientRect === 'function')
      ? this.container.getBoundingClientRect()
      : { width: this.container.clientWidth || 640, height: this.container.clientHeight || 360 };

    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    this.width = rect.width || 640;
    this.height = rect.height || 360;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const aspect = (this.width > 0 && this.height > 0) ? (this.width / this.height) : (16 / 9);
    mat4Perspective(this.projMatrix, 45 * Math.PI / 180, aspect, 0.1, 100);
    mat4LookAt(
      this.viewMatrix,
      this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2],
      0, 0.20, 0,
      0, 1, 0
    );
  }

  // ===========================================================================
  // PARITY CONTRACT METHODS
  // ===========================================================================

  setWorkout(workoutId, coachId, tempoBpm = 120) {
    this.workoutId = workoutId;
    if (tempoBpm) this.tempoBpm = tempoBpm;

    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.setWorkout(workoutId, coachId, tempoBpm);
      return;
    }

    if (coachId && String(coachId) !== this.coachId) {
      this.coachId = String(coachId);
      if (this.gl) {
        this.coachRig = createCoachRig(this.coachId, this.options);
      }
    }
  }

  setTimeRemaining(seconds) {
    this.workoutTimeRemaining = seconds;
    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.setTimeRemaining(seconds);
    }
  }

  triggerBeat() {
    this.beatPulse = 1.0;
    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.triggerBeat();
    }
  }

  startAnimation() {
    this.isAnimating = true;
    this.isPaused = false;
    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.startAnimation();
    }
  }

  pauseAnimation() {
    this.isPaused = true;
    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.pauseAnimation();
    }
  }

  resumeAnimation() {
    this.isPaused = false;
    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.resumeAnimation();
    }
  }

  stopAnimation() {
    this.isAnimating = false;
    if (this.isFallback && this.fallbackCanvas) {
      this.fallbackCanvas.stopAnimation();
    }
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
    if (this.canvas && this._contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
    }
    if (this.fallbackCanvas && typeof this.fallbackCanvas.destroy === 'function') {
      this.fallbackCanvas.destroy();
      this.fallbackCanvas = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.gl = null;
  }

  // ===========================================================================
  // ANIMATION LOOP & RENDER PIPELINE
  // ===========================================================================

  startLoop() {
    const loop = (timestamp) => {
      if (this.isDestroyed || this.isFallback) return;

      const now = timestamp || ((typeof performance !== 'undefined') ? performance.now() : Date.now());
      const dt = Math.min((now - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = now;

      if (!this.isPaused && this.isAnimating) {
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
      this.beatPulse = Math.max(0, this.beatPulse - dt * 3.5);
    }

    // Apply gross-motor forward kinematics to both character rigs
    if (this.avatarRig) {
      applyWorkoutKinematics(
        this.avatarRig,
        this.workoutId,
        this.clock,
        this.tempoBpm,
        this.workoutTimeRemaining,
        this.isHalfwayFlipped
      );
    }

    if (this.coachRig) {
      applyCoachKinematics(
        this.coachRig,
        this.workoutId,
        this.coachId,
        this.clock,
        this.tempoBpm,
        this.workoutTimeRemaining,
        this.isHalfwayFlipped
      );
    }
  }

  render() {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    // Uniforms: Matrices & Camera
    gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, this.projMatrix);
    gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, this.viewMatrix);
    gl.uniform3fv(this.uniforms.cameraPosition, this.cameraPosition);

    // 1. Render Cyber Arena Floor Pedestals (Side-by-side rings)
    this.renderFloorPedestals();

    // 2. Render Dinosaur Coach (Left side)
    if (this.coachRig) {
      this.renderRigMeshes(this.coachRig);
    }

    // 3. Render Toddler Superhero Avatar (Right side)
    if (this.avatarRig) {
      this.renderRigMeshes(this.avatarRig);
    }
  }

  renderFloorPedestals() {
    const gl = this.gl;

    // Coach floor pedestal (Centered at X = -0.40)
    this.drawRingMesh(this.floorArenaGeom, -0.40, 0, 0, 1.0, hexToRgb(STITCH_COLORS.ELECTRIC_CYAN), 0.45);
    this.drawRingMesh(this.floorInnerRingGeom, -0.40, 0, 0, 1.0, hexToRgb(STITCH_COLORS.SOLAR_AMBER), 0.35);

    // Avatar floor pedestal (Centered at X = +0.38)
    this.drawRingMesh(this.floorArenaGeom, 0.38, 0, 0, 1.0, hexToRgb(STITCH_COLORS.EMERALD_GREEN), 0.45);
    this.drawRingMesh(this.floorInnerRingGeom, 0.38, 0, 0, 1.0, hexToRgb(STITCH_COLORS.SOLAR_AMBER), 0.35);

    // Metronome Beat Pulse Radial Ripple Wave
    if (this.beatPulse > 0) {
      const pulseScale = 1.0 + (1.0 - this.beatPulse) * 0.85;
      const pulseAlpha = this.beatPulse * 0.70;
      this.drawRingMesh(this.floorPulseRingGeom, -0.40, 0.01, 0, pulseScale, hexToRgb(STITCH_COLORS.SOLAR_AMBER), pulseAlpha);
      this.drawRingMesh(this.floorPulseRingGeom, 0.38, 0.01, 0, pulseScale, hexToRgb(STITCH_COLORS.ELECTRIC_CYAN), pulseAlpha);
    }
  }

  drawRingMesh(geom, posX, posY, posZ, scale, rgb, opacity) {
    const bufs = this.getOrCreateMeshBuffers(geom);
    if (!bufs) return;

    mat4Identity(this.modelMatrix);
    this.modelMatrix[12] = posX;
    this.modelMatrix[13] = posY;
    this.modelMatrix[14] = posZ;
    this.modelMatrix[0] = scale;
    this.modelMatrix[5] = scale;
    this.modelMatrix[10] = scale;

    mat4Identity(this.normalMatrix);

    const gl = this.gl;
    gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, this.modelMatrix);
    gl.uniformMatrix4fv(this.uniforms.normalMatrix, false, this.normalMatrix);
    gl.uniform3fv(this.uniforms.color, rgb);
    gl.uniform3fv(this.uniforms.emissive, rgb.map(v => v * 0.2));
    gl.uniform1f(this.uniforms.opacity, opacity);

    this.bindAndDrawBuffers(bufs);
  }

  renderRigMeshes(rig) {
    if (!rig || !rig.meshes) return;

    const gl = this.gl;
    const meshMatrix = mat4Create();
    const localOffsetMatrix = mat4Create();

    for (let i = 0; i < rig.meshes.length; i++) {
      const { bone, renderMesh } = rig.meshes[i];
      const bufs = this.getOrCreateMeshBuffers(renderMesh.geometry);
      if (!bufs) continue;

      // Compute mesh model matrix = bone.worldMatrix * localOffsetMatrix
      const off = renderMesh.transformOffset;
      const rot = renderMesh.rotationOffset;
      const scl = renderMesh.scaleOffset;

      mat4Identity(localOffsetMatrix);
      // Translation
      localOffsetMatrix[12] = off.x;
      localOffsetMatrix[13] = off.y;
      localOffsetMatrix[14] = off.z;
      // Scale
      localOffsetMatrix[0] = scl.x;
      localOffsetMatrix[5] = scl.y;
      localOffsetMatrix[10] = scl.z;

      mat4Multiply(meshMatrix, bone.worldMatrix, localOffsetMatrix);

      // Normal matrix = transpose(invert(modelMatrix))
      if (mat4Invert(this.invMat, meshMatrix)) {
        mat4Transpose(this.normalMatrix, this.invMat);
      } else {
        mat4Identity(this.normalMatrix);
      }

      gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, meshMatrix);
      gl.uniformMatrix4fv(this.uniforms.normalMatrix, false, this.normalMatrix);
      gl.uniform3fv(this.uniforms.color, renderMesh.rgb);
      gl.uniform3fv(this.uniforms.emissive, renderMesh.emissive);
      gl.uniform1f(this.uniforms.opacity, renderMesh.opacity);

      this.bindAndDrawBuffers(bufs);
    }
  }

  bindAndDrawBuffers(bufs) {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.position);
    gl.vertexAttribPointer(this.attributes.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attributes.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.normal);
    gl.vertexAttribPointer(this.attributes.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attributes.normal);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.uv);
    gl.vertexAttribPointer(this.attributes.uv, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.attributes.uv);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.indices);
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0);
  }
}
