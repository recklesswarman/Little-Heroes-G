/**
 * BedtimeStoryStage3D.js
 *
 * Lightweight compatibility shim for legacy bedtime test suites.
 * Note: The live BedtimeStoryView now exclusively renders AI Storybook illustrations
 * via bedtimeIllustrationService ("Show 3D Stage" UI and runtime WebGL stage removed).
 * Vite tree-shakes this module out of production builds.
 */

import { Sound } from '../audio/sfx.js';

export const BEDTIME_EXPLORER_PALETTE = {
  MIDNIGHT_SLATE: '#09141e',
  DEEP_NIGHT: '#040a10',
  TWILIGHT_TEAL: '#0e2634',
  EMERALD_GREEN: '#2ecc71',
  ELECTRIC_CYAN: '#00d2d3',
  SOLAR_AMBER: '#f39c12',
  WARM_AMBER: '#ffb961',
  STARS_WHITE: '#ffffff'
};

export const PENTATONIC_CHIMES = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

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
  } catch {
    return false;
  }
}

function getPetArchetype(key) {
  if (['rex', 'raptor', 'stego', 'pterry', 'chomper', 'brachio', 'dippy', 'spino'].includes(key)) return 'dino';
  if (['pyro', 'aero', 'blaze', 'luna', 'kira'].includes(key)) return 'mystic';
  if (['leo', 'stripe', 'fang', 'scout', 'shadow', 'barnaby'].includes(key)) return 'beast';
  if (['hydra', 'gnasher', 'ollie'].includes(key)) return 'aquatic';
  return 'mech';
}

function makeStubBone(name, parent = null) {
  const bone = {
    name,
    parent,
    children: [],
    meshes: [],
    attachMesh(mesh) {
      this.meshes.push(mesh);
      return mesh;
    }
  };
  if (parent) parent.children.push(bone);
  return bone;
}

function makeStubMesh(name, scaleY = 1.0) {
  return {
    name,
    transformScale: { x: 1.0, y: scaleY, z: 1.0 }
  };
}

export function createBedtimePetRig(petConfig = {}) {
  const key = (petConfig.key || petConfig.species || 'rex').toLowerCase();
  const archetype = petConfig.archetype || getPetArchetype(key);
  const isLongNeck = key === 'brachio' || key === 'dippy' || key === 'hydra';

  const root = makeStubBone('pet_root');
  const pelvis = makeStubBone('pet_pelvis', root);
  const spine = makeStubBone('pet_spine', pelvis);
  const chest = makeStubBone('pet_chest', spine);
  const neck = makeStubBone('pet_neck', chest);
  const head = makeStubBone('pet_head', neck);
  const tail1 = makeStubBone('pet_tail1', pelvis);
  const tail2 = makeStubBone('pet_tail2', tail1);
  const shoulderL = makeStubBone('pet_shoulder_l', chest);
  const shoulderR = makeStubBone('pet_shoulder_r', chest);
  const hipL = makeStubBone('pet_hip_l', pelvis);
  const hipR = makeStubBone('pet_hip_r', pelvis);

  const bones = { pelvis, spine, chest, neck, head, tail1, tail2, shoulderL, shoulderR, hipL, hipR };
  const meshes = [];
  const register = (bone, meshName, scaleY = 1.0) => {
    const rm = makeStubMesh(meshName, scaleY);
    bone.attachMesh(rm);
    meshes.push({ bone, renderMesh: rm });
  };

  register(pelvis, 'pet_pelvis_mesh');
  register(spine, 'pet_spine_mesh');
  register(chest, 'pet_chest_mesh');
  register(chest, 'pet_belly_mesh');
  register(neck, 'pet_neck_mesh', isLongNeck ? 0.64 : 0.28);
  register(head, 'pet_head_mesh');
  register(head, 'pet_snout_mesh');
  register(tail1, 'pet_tail1_mesh');
  register(tail2, 'pet_tail2_mesh');
  register(shoulderL, 'pet_leg_fl');
  register(shoulderR, 'pet_leg_fr');
  register(hipL, 'pet_leg_bl');
  register(hipR, 'pet_leg_br');

  if (archetype === 'mystic') {
    register(chest, 'pet_wing_L');
    register(chest, 'pet_wing_R');
    register(head, 'pet_horn');
  } else if (archetype === 'beast') {
    register(neck, 'pet_mane');
    register(head, 'pet_ear_L');
    register(head, 'pet_ear_R');
  } else if (archetype === 'aquatic') {
    register(spine, 'pet_dorsal_fin');
  } else if (archetype === 'mech') {
    register(head, 'pet_visor');
  } else if (key === 'stego') {
    register(spine, 'pet_stego_plate_1');
    register(chest, 'pet_stego_plate_2');
  } else if (key === 'spino') {
    register(spine, 'pet_spino_sail');
  }

  return { root, bones, meshes, sceneGroup: root, archetype, key };
}

export function attachMagicItemToHand(handBone, magicItemName = 'Starlight Lantern') {
  if (handBone && typeof handBone.attachMesh === 'function') {
    handBone.attachMesh(makeStubMesh(`magic_${String(magicItemName).toLowerCase().replace(/\s+/g, '_')}`));
  }
}

function computeBreathingState(clockSec) {
  const period = 8.0;
  const phase = ((clockSec % period) + period) % period;
  const progress = phase <= 4.0 ? phase / 4.0 : (8.0 - phase) / 4.0;
  return {
    period,
    scale: 0.90 + 0.30 * progress,
    glowAlpha: 0.40 + 0.50 * progress
  };
}

export class BedtimeStoryStage2DFallback {
  constructor(container = null, options = {}) {
    this.container = container;
    this.chapterIndex = typeof options.chapterIndex === 'number' ? options.chapterIndex : 0;
    this.sceneDescriptor = options.sceneDescriptor || null;
    this.isBreathingActive = this.chapterIndex >= 2;
    this.isDestroyed = false;
    this.clock = 0;
    this.breathingCycle = computeBreathingState(0);
    this.stars = Array.from({ length: 18 }, (_, idx) => ({
      x: (idx + 1) * 40,
      y: 60 + (idx % 4) * 30,
      noteIndex: idx % PENTATONIC_CHIMES.length
    }));
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : {};
    if (this.container && typeof this.container.appendChild === 'function' && this.canvas.nodeType) {
      this.container.appendChild(this.canvas);
    }
  }

  setSceneDescriptor(descriptor, chapterIndex = this.chapterIndex) {
    this.sceneDescriptor = descriptor;
    this.setChapter(chapterIndex);
  }

  setChapter(chapterIndex) {
    this.chapterIndex = Math.max(0, Math.min(3, Number(chapterIndex) || 0));
    this.isBreathingActive = this.chapterIndex >= 2;
  }

  update(dt = 0.016) {
    this.clock += Number(dt) || 0;
    this.breathingCycle = computeBreathingState(this.clock);
  }

  render() {}

  destroy() {
    this.isDestroyed = true;
  }
}

export class BedtimeStoryStage3D {
  constructor(container = null, options = {}) {
    this.container = container;
    this.chapterIndex = typeof options.chapterIndex === 'number' ? options.chapterIndex : 0;
    this.sceneDescriptor = options.sceneDescriptor || null;
    this.isDestroyed = false;
    this.clock = 0;
    this.breathingCycle = computeBreathingState(0);
    this.activeRipples = [];
    this.celestialBodies = Array.from({ length: 18 }, (_, idx) => ({
      x: 0,
      y: 1.2,
      z: -1.5,
      noteIndex: idx % PENTATONIC_CHIMES.length
    }));

    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.gl = this.canvas && typeof this.canvas.getContext === 'function'
      ? (this.canvas.getContext('webgl2') || this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl'))
      : null;

    this.isWebGLAvailable = Boolean(this.gl);
    this.isFallback = !this.gl;
    this.fallbackEngine = this.isFallback ? new BedtimeStoryStage2DFallback(container, options) : null;

    if (this.canvas && typeof this.canvas.addEventListener === 'function') {
      this._onContextLost = (e) => this.onContextLost(e);
      this.canvas.addEventListener('webglcontextlost', this._onContextLost);
      if (this.container && typeof this.container.appendChild === 'function' && !this.isFallback) {
        this.container.appendChild(this.canvas);
      }
    }
  }

  onContextLost(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    this.isFallback = true;
    this.isWebGLAvailable = false;
    if (!this.fallbackEngine) {
      this.fallbackEngine = new BedtimeStoryStage2DFallback(this.container, {
        chapterIndex: this.chapterIndex,
        sceneDescriptor: this.sceneDescriptor
      });
    }
  }

  setSceneDescriptor(descriptor, chapterIndex = this.chapterIndex) {
    this.sceneDescriptor = descriptor;
    this.setChapter(chapterIndex);
    if (this.fallbackEngine) {
      this.fallbackEngine.setSceneDescriptor(descriptor, this.chapterIndex);
    }
  }

  setChapter(chapterIndex) {
    this.chapterIndex = Math.max(0, Math.min(3, Number(chapterIndex) || 0));
    if (this.fallbackEngine) {
      this.fallbackEngine.setChapter(this.chapterIndex);
    }
  }

  setPet(petKey) {
    this.activePetKey = petKey;
  }

  playConstellationChime(noteIndex = 0) {
    const freq = PENTATONIC_CHIMES[Math.abs(noteIndex) % PENTATONIC_CHIMES.length];
    if (Sound && typeof Sound.playBedtimeChime === 'function') {
      Sound.playBedtimeChime(freq);
    }
    return freq;
  }

  triggerConstellationRipple(x = 0, y = 0, z = -1) {
    this.activeRipples.push({ x, y, z, scale: 0.8, alpha: 1.0, elapsed: 0 });
  }

  handleRaycastPointer(clientX = 0, clientY = 0) {
    this.handlePointerDown({ clientX, clientY });
  }

  handlePointerDown(event = {}) {
    const idx = Math.abs(Math.round((event.clientX || 0) + (event.clientY || 0))) % this.celestialBodies.length;
    const star = this.celestialBodies[idx] || this.celestialBodies[0];
    this.playConstellationChime(star.noteIndex);
    this.triggerConstellationRipple(star.x, star.y, star.z);
  }

  update(dt = 0.016) {
    const delta = Number(dt) || 0;
    this.clock += delta;
    this.breathingCycle = computeBreathingState(this.clock);
    for (let i = this.activeRipples.length - 1; i >= 0; i--) {
      const r = this.activeRipples[i];
      r.elapsed += delta;
      r.scale = 0.8 + r.elapsed * 1.2;
      r.alpha = Math.max(0, 1.0 - r.elapsed);
      if (r.alpha <= 0) {
        this.activeRipples.splice(i, 1);
      }
    }
    if (this.fallbackEngine) this.fallbackEngine.update(delta);
  }

  render() {
    if (this.fallbackEngine) this.fallbackEngine.render();
  }

  destroy() {
    this.isDestroyed = true;
    if (this.canvas && this._onContextLost && typeof this.canvas.removeEventListener === 'function') {
      this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    }
    if (this.fallbackEngine) this.fallbackEngine.destroy();
  }
}

export default BedtimeStoryStage3D;
