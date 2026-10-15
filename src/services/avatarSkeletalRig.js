/**
 * avatarSkeletalRig.js
 * 
 * Procedural 3D Skeletal Rigging Engine for Little Hero Adventures
 * 
 * Features:
 * 1. Articulated Forward-Kinematic Bone Hierarchy:
 *    Root -> Pelvis -> Spine -> Chest -> Neck -> Head ->
 *    Shoulders -> Upper Arms -> Forearms -> Hands ->
 *    Hips -> Thighs -> Calves -> Chunky Sneakers -> Cape.
 * 2. Complete 3D Dinosaur Coach Hierarchy for all 8 Prehistoric Partners:
 *    Rex, Raptor, Stego, Pterry, Chomper, Brachio, Dippy, Spino.
 * 3. Procedural 3D Geometric Primitives:
 *    Capsules, cylinders, spheres, boxes, dynamic cloth cape ribbons, dorsal sails & wings.
 * 4. Strict Stitch Design System Color Palette:
 *    Electric Cyan (#00d2d3), Emerald Green (#2ecc71), Solar Amber (#f1c40f), Midnight Slate (#09141e).
 *    ZERO pink or purple anywhere.
 */

// =============================================================================
// 1. STITCH DESIGN PALETTE & COLOR CONVERSION UTILITIES
// =============================================================================

export const STITCH_COLORS = {
  ELECTRIC_CYAN: '#00d2d3',
  EMERALD_GREEN: '#2ecc71',
  SOLAR_AMBER: '#f1c40f',
  MIDNIGHT_SLATE: '#09141e',
  DEEP_SLATE: '#0e1c28',
  CYBER_TEAL: '#01a3a4',
  BRIGHT_GOLD: '#f39c12',
  WHITE: '#ffffff',
  CHARCOAL: '#1e293b'
};

export function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255
  ];
}

// =============================================================================
// 2. 4X4 MATRIX & VECTOR LINEAR ALGEBRA UTILITIES (PURE JAVASCRIPT)
// =============================================================================

export function mat4Create() {
  const out = new Float32Array(16);
  out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
  return out;
}

export function mat4Identity(out) {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

export function mat4Copy(out, a) {
  for (let i = 0; i < 16; i++) out[i] = a[i];
  return out;
}

export function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}

export function mat4FromTranslationRotationScale(out, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
  // Compute Euler rotation matrix XYZ
  const cx = Math.cos(rx), sx_sin = Math.sin(rx);
  const cy = Math.cos(ry), sy_sin = Math.sin(ry);
  const cz = Math.cos(rz), sz_sin = Math.sin(rz);

  // Rotation matrix components R = Rz * Ry * Rx
  const r00 = cy * cz;
  const r01 = sx_sin * sy_sin * cz - cx * sz_sin;
  const r02 = cx * sy_sin * cz + sx_sin * sz_sin;

  const r10 = cy * sz_sin;
  const r11 = sx_sin * sy_sin * sz_sin + cx * cz;
  const r12 = cx * sy_sin * sz_sin - sx_sin * cz;

  const r20 = -sy_sin;
  const r21 = sx_sin * cy;
  const r22 = cx * cy;

  out[0] = r00 * sx;
  out[1] = r10 * sx;
  out[2] = r20 * sx;
  out[3] = 0;

  out[4] = r01 * sy;
  out[5] = r11 * sy;
  out[6] = r21 * sy;
  out[7] = 0;

  out[8] = r02 * sz;
  out[9] = r12 * sz;
  out[10] = r22 * sz;
  out[11] = 0;

  out[12] = tx;
  out[13] = ty;
  out[14] = tz;
  out[15] = 1;
  return out;
}

export function mat4Perspective(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = (2 * far * near) * nf;
  out[15] = 0;
  return out;
}

export function mat4LookAt(out, eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {
  let z0 = eyeX - centerX;
  let z1 = eyeY - centerY;
  let z2 = eyeZ - centerZ;
  let len = Math.hypot(z0, z1, z2);
  if (len === 0) { z2 = 1; } else { len = 1 / len; z0 *= len; z1 *= len; z2 *= len; }

  let x0 = upY * z2 - upZ * z1;
  let x1 = upZ * z0 - upX * z2;
  let x2 = upX * z1 - upY * z0;
  len = Math.hypot(x0, x1, x2);
  if (len === 0) { x0 = 1; } else { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }

  let y0 = z1 * x2 - z2 * x1;
  let y1 = z2 * x0 - z0 * x2;
  let y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
  out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
  out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
  out[12] = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
  out[13] = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
  out[14] = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);
  out[15] = 1;
  return out;
}

export function mat4Invert(out, a) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

export function mat4Transpose(out, a) {
  out[0] = a[0]; out[1] = a[4]; out[2] = a[8]; out[3] = a[12];
  out[4] = a[1]; out[5] = a[5]; out[6] = a[9]; out[7] = a[13];
  out[8] = a[2]; out[9] = a[6]; out[10] = a[10]; out[11] = a[14];
  out[12] = a[3]; out[13] = a[7]; out[14] = a[11]; out[15] = a[15];
  return out;
}

// =============================================================================
// 3. ARTICULATED BONE NODE HIERARCHY
// =============================================================================

export class BoneNode {
  constructor(name, parent = null) {
    this.name = name;
    this.parent = parent;
    this.children = [];
    if (parent) {
      parent.children.push(this);
    }

    // Transform parameters
    this.position = { x: 0, y: 0, z: 0 };
    this.basePosition = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 }; // Radians
    this.baseRotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };

    // Matrices
    this.localMatrix = mat4Create();
    this.worldMatrix = mat4Create();

    // Meshes bound to this bone
    this.meshes = [];
  }

  setBasePosition(x, y, z) {
    this.basePosition = { x, y, z };
    this.position = { x, y, z };
    return this;
  }

  setBaseRotation(x, y, z) {
    this.baseRotation = { x, y, z };
    this.rotation = { x, y, z };
    return this;
  }

  reset() {
    this.position.x = this.basePosition.x;
    this.position.y = this.basePosition.y;
    this.position.z = this.basePosition.z;
    this.rotation.x = this.baseRotation.x;
    this.rotation.y = this.baseRotation.y;
    this.rotation.z = this.baseRotation.z;
    this.scale.x = 1;
    this.scale.y = 1;
    this.scale.z = 1;
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].reset();
    }
  }

  updateMatrix(parentWorldMatrix = null) {
    mat4FromTranslationRotationScale(
      this.localMatrix,
      this.position.x, this.position.y, this.position.z,
      this.rotation.x, this.rotation.y, this.rotation.z,
      this.scale.x, this.scale.y, this.scale.z
    );

    if (parentWorldMatrix) {
      mat4Multiply(this.worldMatrix, parentWorldMatrix, this.localMatrix);
    } else {
      mat4Copy(this.worldMatrix, this.localMatrix);
    }

    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateMatrix(this.worldMatrix);
    }
  }

  attachMesh(mesh) {
    this.meshes.push(mesh);
    return this;
  }
}

// =============================================================================
// 4. PROCEDURAL 3D GEOMETRY GENERATORS (BUFFER ARRAYS FOR WEBGL)
// =============================================================================

export function createSphereGeometry(radius = 0.5, latBands = 12, lonBands = 12) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon * 2 * Math.PI) / lonBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;
      const u = 1 - lon / lonBands;
      const v = 1 - lat / latBands;

      normals.push(x, y, z);
      uvs.push(u, v);
      positions.push(radius * x, radius * y, radius * z);
    }
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const first = lat * (lonBands + 1) + lon;
      const second = first + lonBands + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createCylinderGeometry(radiusTop = 0.3, radiusBottom = 0.3, height = 1.0, segments = 12) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const halfH = height / 2;

  // Side vertices
  for (let y = 0; y <= 1; y++) {
    const v = y;
    const r = y === 0 ? radiusBottom : radiusTop;
    const posY = y === 0 ? -halfH : halfH;

    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      positions.push(r * cosTheta, posY, r * sinTheta);
      normals.push(cosTheta, 0, sinTheta);
      uvs.push(u, v);
    }
  }

  for (let x = 0; x < segments; x++) {
    const first = x;
    const second = x + segments + 1;
    indices.push(first, second, first + 1);
    indices.push(second, second + 1, first + 1);
  }

  // Top cap center
  const topCenterIdx = positions.length / 3;
  positions.push(0, halfH, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);

  const topOffset = segments + 1;
  for (let x = 0; x < segments; x++) {
    indices.push(topCenterIdx, topOffset + x, topOffset + x + 1);
  }

  // Bottom cap center
  const bottomCenterIdx = positions.length / 3;
  positions.push(0, -halfH, 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);

  for (let x = 0; x < segments; x++) {
    indices.push(bottomCenterIdx, x + 1, x);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createBoxGeometry(w = 1.0, h = 1.0, d = 1.0) {
  const x = w / 2, y = h / 2, z = d / 2;

  const positions = [
    // Front face
    -x, -y,  z,   x, -y,  z,   x,  y,  z,  -x,  y,  z,
    // Back face
    -x, -y, -z,  -x,  y, -z,   x,  y, -z,   x, -y, -z,
    // Top face
    -x,  y, -z,  -x,  y,  z,   x,  y,  z,   x,  y, -z,
    // Bottom face
    -x, -y, -z,   x, -y, -z,   x, -y,  z,  -x, -y,  z,
    // Right face
     x, -y, -z,   x,  y, -z,   x,  y,  z,   x, -y,  z,
    // Left face
    -x, -y, -z,  -x, -y,  z,  -x,  y,  z,  -x,  y, -z
  ];

  const normals = [
    // Front
     0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
    // Back
     0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
    // Top
     0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
    // Bottom
     0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
    // Right
     1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
    // Left
    -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0
  ];

  const uvs = [
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1
  ];

  const indices = [
     0,  1,  2,      0,  2,  3,    // Front
     4,  5,  6,      4,  6,  7,    // Back
     8,  9, 10,      8, 10, 11,    // Top
    12, 13, 14,     12, 14, 15,    // Bottom
    16, 17, 18,     16, 18, 19,    // Right
    20, 21, 22,     20, 22, 23     // Left
  ];

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createCapeGeometry(width = 0.35, length = 0.65, segX = 4, segY = 6) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let y = 0; y <= segY; y++) {
    const v = y / segY;
    const posY = -v * length;
    // Cape tapers wider at bottom
    const w = width * (0.8 + 0.4 * v);

    for (let x = 0; x <= segX; x++) {
      const u = x / segX;
      const posX = (u - 0.5) * w;
      // Slight natural curve back
      const posZ = -0.02 * v * v;

      positions.push(posX, posY, posZ);
      normals.push(0, 0, -1);
      uvs.push(u, v);
    }
  }

  for (let y = 0; y < segY; y++) {
    for (let x = 0; x < segX; x++) {
      const a = y * (segX + 1) + x;
      const b = a + (segX + 1);
      // Double sided triangles
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
      indices.push(a, a + 1, b);
      indices.push(b, a + 1, b + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    segX,
    segY
  };
}

export function createPlateGeometry(w = 0.12, h = 0.22, d = 0.04) {
  // Stegosaurus dorsal diamond plate
  const positions = [
     0,      h / 2,   0,
    -w / 2,  0,       0,
     w / 2,  0,       0,
     0,     -h / 2,   0,
     0,      0,       d / 2,
     0,      0,      -d / 2
  ];

  const normals = [
     0,  1,  0,
    -1,  0,  0,
     1,  0,  0,
     0, -1,  0,
     0,  0,  1,
     0,  0, -1
  ];

  const indices = [
    4, 1, 0,   4, 0, 2,   4, 2, 3,   4, 3, 1,
    5, 0, 1,   5, 2, 0,   5, 3, 2,   5, 1, 3
  ];

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(positions.length / 3 * 2),
    indices: new Uint16Array(indices)
  };
}

export function createSailGeometry(w = 0.38, h = 0.45) {
  // Spinosaurus dorsal arch sail fin
  const segs = 8;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = (t - 0.5) * w;
    const archH = Math.sin(t * Math.PI) * h;

    positions.push(0, 0, z); // Base
    normals.push(1, 0, 0);
    uvs.push(t, 0);

    positions.push(0, archH, z); // Crest
    normals.push(1, 0, 0);
    uvs.push(t, 1);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 2;
    indices.push(a, b, a + 1);
    indices.push(b, b + 1, a + 1);
    // Double sided
    indices.push(a, a + 1, b);
    indices.push(b, a + 1, b + 1);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createRingGeometry(innerR = 0.8, outerR = 0.9, segs = 32) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    positions.push(innerR * cosT, 0, innerR * sinT);
    normals.push(0, 1, 0);
    uvs.push(0, i / segs);

    positions.push(outerR * cosT, 0, outerR * sinT);
    normals.push(0, 1, 0);
    uvs.push(1, i / segs);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 2;
    indices.push(a, b, a + 1);
    indices.push(b, b + 1, a + 1);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

// =============================================================================
// 5. PROCEDURAL 3D MESH DEFINITION
// =============================================================================

export class RenderMesh {
  constructor(name, geometry, materialOptions = {}) {
    this.name = name;
    this.geometry = geometry;
    this.color = materialOptions.color || STITCH_COLORS.ELECTRIC_CYAN;
    this.rgb = hexToRgb(this.color);
    this.emissive = materialOptions.emissive || [0, 0, 0];
    this.roughness = materialOptions.roughness ?? 0.4;
    this.metalness = materialOptions.metalness ?? 0.1;
    this.opacity = materialOptions.opacity ?? 1.0;
    this.wireframe = !!materialOptions.wireframe;
    this.transformOffset = materialOptions.offset || { x: 0, y: 0, z: 0 };
    this.rotationOffset = materialOptions.rotation || { x: 0, y: 0, z: 0 };
    this.scaleOffset = materialOptions.scale || { x: 1, y: 1, z: 1 };
  }
}

// =============================================================================
// 6. BUILD PROCEDURAL 3D TODDLER SUPERHERO AVATAR RIG
// =============================================================================

/**
 * createAvatarRig
 * 
 * Builds an articulated 3D Toddler Superhero Avatar with forward-kinematic bones:
 * Root -> Pelvis -> Spine -> Chest -> Neck -> Head ->
 * Shoulders -> Upper Arms -> Forearms -> Hands ->
 * Hips -> Thighs -> Calves -> Chunky Sneakers -> Cape.
 * 
 * Styled strictly in Stitch design system:
 * Electric Cyan, Emerald Green, Solar Amber, Midnight Slate.
 */
export function createAvatarRig(options = {}) {
  // Shared Primitives
  const geomSphere = createSphereGeometry(0.5, 12, 12);
  const geomCylinder = createCylinderGeometry(0.3, 0.3, 0.5, 12);
  const geomBox = createBoxGeometry(0.4, 0.4, 0.4);
  const geomCape = createCapeGeometry(0.36, 0.65, 4, 6);

  // 1. Root Node (Placed on the right side of the side-by-side stage)
  const root = new BoneNode('root');
  root.setBasePosition(0.38, 0, 0);

  // 2. Pelvis
  const pelvis = new BoneNode('pelvis', root);
  pelvis.setBasePosition(0, 0.52, 0);
  pelvis.attachMesh(new RenderMesh('pelvis_belt', geomBox, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.65, y: 0.22, z: 0.42 },
    offset: { x: 0, y: 0, z: 0 }
  }));
  pelvis.attachMesh(new RenderMesh('pelvis_shorts', geomCylinder, {
    color: STITCH_COLORS.EMERALD_GREEN,
    scale: { x: 0.72, y: 0.35, z: 0.55 },
    offset: { x: 0, y: -0.05, z: 0 }
  }));

  // 3. Spine
  const spine = new BoneNode('spine', pelvis);
  spine.setBasePosition(0, 0.12, 0);
  spine.attachMesh(new RenderMesh('spine_torso_lower', geomCylinder, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.68, y: 0.32, z: 0.52 },
    offset: { x: 0, y: 0.05, z: 0 }
  }));

  // 4. Chest
  const chest = new BoneNode('chest', spine);
  chest.setBasePosition(0, 0.15, 0);
  // Hero Chest Plate (Midnight Slate tunic with Emerald Green Lightning Crest)
  chest.attachMesh(new RenderMesh('chest_plate', geomBox, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.78, y: 0.42, z: 0.56 },
    offset: { x: 0, y: 0.08, z: 0 }
  }));
  chest.attachMesh(new RenderMesh('chest_emblem', geomBox, {
    color: STITCH_COLORS.EMERALD_GREEN,
    emissive: hexToRgb(STITCH_COLORS.EMERALD_GREEN).map(v => v * 0.4),
    scale: { x: 0.32, y: 0.32, z: 0.08 },
    offset: { x: 0, y: 0.08, z: 0.28 }
  }));
  chest.attachMesh(new RenderMesh('chest_star', geomSphere, {
    color: STITCH_COLORS.SOLAR_AMBER,
    emissive: hexToRgb(STITCH_COLORS.SOLAR_AMBER).map(v => v * 0.5),
    scale: { x: 0.14, y: 0.14, z: 0.14 },
    offset: { x: 0, y: 0.08, z: 0.32 }
  }));

  // 5. Neck
  const neck = new BoneNode('neck', chest);
  neck.setBasePosition(0, 0.22, 0);
  neck.attachMesh(new RenderMesh('neck_mesh', geomCylinder, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.32, y: 0.25, z: 0.32 },
    offset: { x: 0, y: 0.04, z: 0 }
  }));

  // 6. Head
  const head = new BoneNode('head', neck);
  head.setBasePosition(0, 0.14, 0);
  // Superhero Cowl Helmet (Electric Cyan)
  head.attachMesh(new RenderMesh('head_cowl', geomSphere, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.54, y: 0.54, z: 0.52 },
    offset: { x: 0, y: 0.12, z: 0 }
  }));
  // Toddler Face Skin Window (Solar Amber)
  head.attachMesh(new RenderMesh('face_skin', geomSphere, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.44, y: 0.42, z: 0.44 },
    offset: { x: 0, y: 0.09, z: 0.10 }
  }));
  // Hero Visor / Cowl Crest (Solar Amber with Cyan Lightning)
  head.attachMesh(new RenderMesh('visor_crest', geomBox, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.48, y: 0.12, z: 0.20 },
    offset: { x: 0, y: 0.26, z: 0.22 }
  }));
  // Left Eye
  head.attachMesh(new RenderMesh('eye_left', geomSphere, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.09, y: 0.09, z: 0.06 },
    offset: { x: -0.11, y: 0.12, z: 0.28 }
  }));
  // Right Eye
  head.attachMesh(new RenderMesh('eye_right', geomSphere, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.09, y: 0.09, z: 0.06 },
    offset: { x: 0.11, y: 0.12, z: 0.28 }
  }));

  // 7. Left Shoulder & Arm Chain
  const shoulderL = new BoneNode('shoulderL', chest);
  shoulderL.setBasePosition(-0.24, 0.14, 0);
  shoulderL.attachMesh(new RenderMesh('shoulder_pad_L', geomSphere, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.25, y: 0.25, z: 0.25 },
    offset: { x: 0, y: 0, z: 0 }
  }));

  const armL = new BoneNode('armL', shoulderL);
  armL.setBasePosition(-0.06, -0.06, 0);
  armL.attachMesh(new RenderMesh('arm_sleeve_L', geomCylinder, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.24, y: 0.38, z: 0.24 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  const forearmL = new BoneNode('forearmL', armL);
  forearmL.setBasePosition(0, -0.18, 0);
  // Solar Amber Hero Gauntlet
  forearmL.attachMesh(new RenderMesh('forearm_gauntlet_L', geomCylinder, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.25, y: 0.34, z: 0.25 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  const handL = new BoneNode('handL', forearmL);
  handL.setBasePosition(0, -0.16, 0);
  handL.attachMesh(new RenderMesh('glove_hand_L', geomSphere, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.22, y: 0.22, z: 0.22 },
    offset: { x: 0, y: -0.02, z: 0 }
  }));

  // 8. Right Shoulder & Arm Chain
  const shoulderR = new BoneNode('shoulderR', chest);
  shoulderR.setBasePosition(0.24, 0.14, 0);
  shoulderR.attachMesh(new RenderMesh('shoulder_pad_R', geomSphere, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.25, y: 0.25, z: 0.25 },
    offset: { x: 0, y: 0, z: 0 }
  }));

  const armR = new BoneNode('armR', shoulderR);
  armR.setBasePosition(0.06, -0.06, 0);
  armR.attachMesh(new RenderMesh('arm_sleeve_R', geomCylinder, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.24, y: 0.38, z: 0.24 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  const forearmR = new BoneNode('forearmR', armR);
  forearmR.setBasePosition(0, -0.18, 0);
  // Solar Amber Hero Gauntlet
  forearmR.attachMesh(new RenderMesh('forearm_gauntlet_R', geomCylinder, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.25, y: 0.34, z: 0.25 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  const handR = new BoneNode('handR', forearmR);
  handR.setBasePosition(0, -0.16, 0);
  handR.attachMesh(new RenderMesh('glove_hand_R', geomSphere, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.22, y: 0.22, z: 0.22 },
    offset: { x: 0, y: -0.02, z: 0 }
  }));

  // 9. Left Hip & Leg Chain
  const hipL = new BoneNode('hipL', pelvis);
  hipL.setBasePosition(-0.14, -0.08, 0);

  const thighL = new BoneNode('thighL', hipL);
  thighL.setBasePosition(0, -0.06, 0);
  thighL.attachMesh(new RenderMesh('thigh_pants_L', geomCylinder, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.28, y: 0.40, z: 0.28 },
    offset: { x: 0, y: -0.09, z: 0 }
  }));

  const calfL = new BoneNode('calfL', thighL);
  calfL.setBasePosition(0, -0.20, 0);
  calfL.attachMesh(new RenderMesh('kneepad_L', geomSphere, {
    color: STITCH_COLORS.EMERALD_GREEN,
    scale: { x: 0.22, y: 0.22, z: 0.24 },
    offset: { x: 0, y: 0.02, z: 0.08 }
  }));
  calfL.attachMesh(new RenderMesh('calf_shin_L', geomCylinder, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.25, y: 0.36, z: 0.25 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  // Foot Left: Chunky Sneaker
  const footL = new BoneNode('footL', calfL);
  footL.setBasePosition(0, -0.19, 0.04);
  footL.attachMesh(new RenderMesh('sneaker_upper_L', geomBox, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.38, y: 0.22, z: 0.58 },
    offset: { x: 0, y: -0.04, z: 0.08 }
  }));
  footL.attachMesh(new RenderMesh('sneaker_sole_L', geomBox, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.44, y: 0.12, z: 0.64 },
    offset: { x: 0, y: -0.12, z: 0.08 }
  }));
  footL.attachMesh(new RenderMesh('sneaker_toe_L', geomSphere, {
    color: STITCH_COLORS.WHITE,
    scale: { x: 0.34, y: 0.20, z: 0.30 },
    offset: { x: 0, y: -0.06, z: 0.28 }
  }));

  // 10. Right Hip & Leg Chain
  const hipR = new BoneNode('hipR', pelvis);
  hipR.setBasePosition(0.14, -0.08, 0);

  const thighR = new BoneNode('thighR', hipR);
  thighR.setBasePosition(0, -0.06, 0);
  thighR.attachMesh(new RenderMesh('thigh_pants_R', geomCylinder, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.28, y: 0.40, z: 0.28 },
    offset: { x: 0, y: -0.09, z: 0 }
  }));

  const calfR = new BoneNode('calfR', thighR);
  calfR.setBasePosition(0, -0.20, 0);
  calfR.attachMesh(new RenderMesh('kneepad_R', geomSphere, {
    color: STITCH_COLORS.EMERALD_GREEN,
    scale: { x: 0.22, y: 0.22, z: 0.24 },
    offset: { x: 0, y: 0.02, z: 0.08 }
  }));
  calfR.attachMesh(new RenderMesh('calf_shin_R', geomCylinder, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.25, y: 0.36, z: 0.25 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  // Foot Right: Chunky Sneaker
  const footR = new BoneNode('footR', calfR);
  footR.setBasePosition(0, -0.19, 0.04);
  footR.attachMesh(new RenderMesh('sneaker_upper_R', geomBox, {
    color: STITCH_COLORS.ELECTRIC_CYAN,
    scale: { x: 0.38, y: 0.22, z: 0.58 },
    offset: { x: 0, y: -0.04, z: 0.08 }
  }));
  footR.attachMesh(new RenderMesh('sneaker_sole_R', geomBox, {
    color: STITCH_COLORS.SOLAR_AMBER,
    scale: { x: 0.44, y: 0.12, z: 0.64 },
    offset: { x: 0, y: -0.12, z: 0.08 }
  }));
  footR.attachMesh(new RenderMesh('sneaker_toe_R', geomSphere, {
    color: STITCH_COLORS.WHITE,
    scale: { x: 0.34, y: 0.20, z: 0.30 },
    offset: { x: 0, y: -0.06, z: 0.28 }
  }));

  // 11. Billowing Cape (Anchored to back of chest)
  const cape = new BoneNode('cape', chest);
  cape.setBasePosition(0, 0.16, -0.18);
  cape.attachMesh(new RenderMesh('hero_cape', geomCape, {
    color: STITCH_COLORS.EMERALD_GREEN,
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    offset: { x: 0, y: 0, z: 0 }
  }));

  const bones = {
    pelvis,
    spine,
    chest,
    neck,
    head,
    shoulderL,
    armL,
    forearmL,
    handL,
    shoulderR,
    armR,
    forearmR,
    handR,
    hipL,
    thighL,
    calfL,
    footL,
    hipR,
    thighR,
    calfR,
    footR,
    cape
  };

  // Collect all meshes
  const meshes = [];
  function collectMeshes(node) {
    for (let i = 0; i < node.meshes.length; i++) {
      meshes.push({
        bone: node,
        renderMesh: node.meshes[i]
      });
    }
    for (let i = 0; i < node.children.length; i++) {
      collectMeshes(node.children[i]);
    }
  }
  collectMeshes(root);

  // Initialize initial matrices
  root.updateMatrix();

  return {
    root,
    bones,
    meshes,
    sceneGroup: root,
    isAvatar: true
  };
}

// =============================================================================
// 7. BUILD PROCEDURAL 3D DINOSAUR COACH RIG (ALL 8 PREHISTORIC PARTNERS)
// =============================================================================

/**
 * createCoachRig
 * 
 * Builds an articulated 3D Dinosaur Coach matching the 8 workout coaches:
 * 1. Rex (T-Rex): Emerald Green & Solar Amber, short arms, massive legs, wagging tail
 * 2. Raptor (Velociraptor): Electric Cyan & Midnight Slate, sickle claw, agile stance
 * 3. Stego (Stegosaurus): Emerald Green & Solar Amber dorsal diamond plates
 * 4. Pterry (Pterodactyl): Solar Amber & Electric Cyan aerodynamic wings
 * 5. Chomper (T-Rex / Compy): Midnight Slate & Emerald Green crest
 * 6. Brachio (Brachiosaurus): Emerald Green & Cyan elongated graceful neck
 * 7. Dippy (Diplodocus): Electric Cyan & Amber spots, long neck & whip tail
 * 8. Spino (Spinosaurus): Emerald Green & Cyan glowing dorsal sail fin
 */
export function createCoachRig(coachId = '2', options = {}) {
  const cid = String(coachId);

  // Determine Coach Species & Primary Colors
  let species = 'raptor';
  let primaryColor = STITCH_COLORS.ELECTRIC_CYAN;
  let secondaryColor = STITCH_COLORS.MIDNIGHT_SLATE;
  let accentColor = STITCH_COLORS.SOLAR_AMBER;

  if (cid === '1') {
    species = 'trex';
    primaryColor = STITCH_COLORS.EMERALD_GREEN;
    secondaryColor = STITCH_COLORS.SOLAR_AMBER;
    accentColor = STITCH_COLORS.MIDNIGHT_SLATE;
  } else if (cid === '2') {
    species = 'raptor';
    primaryColor = STITCH_COLORS.ELECTRIC_CYAN;
    secondaryColor = STITCH_COLORS.MIDNIGHT_SLATE;
    accentColor = STITCH_COLORS.SOLAR_AMBER;
  } else if (cid === '3') {
    species = 'stego';
    primaryColor = STITCH_COLORS.EMERALD_GREEN;
    secondaryColor = STITCH_COLORS.SOLAR_AMBER;
    accentColor = STITCH_COLORS.ELECTRIC_CYAN;
  } else if (cid === '4') {
    species = 'pterry';
    primaryColor = STITCH_COLORS.SOLAR_AMBER;
    secondaryColor = STITCH_COLORS.ELECTRIC_CYAN;
    accentColor = STITCH_COLORS.MIDNIGHT_SLATE;
  } else if (cid === '5') {
    species = 'chomper';
    primaryColor = STITCH_COLORS.MIDNIGHT_SLATE;
    secondaryColor = STITCH_COLORS.EMERALD_GREEN;
    accentColor = STITCH_COLORS.SOLAR_AMBER;
  } else if (cid === '6') {
    species = 'brachio';
    primaryColor = STITCH_COLORS.EMERALD_GREEN;
    secondaryColor = STITCH_COLORS.ELECTRIC_CYAN;
    accentColor = STITCH_COLORS.SOLAR_AMBER;
  } else if (cid === '7') {
    species = 'dippy';
    primaryColor = STITCH_COLORS.ELECTRIC_CYAN;
    secondaryColor = STITCH_COLORS.SOLAR_AMBER;
    accentColor = STITCH_COLORS.EMERALD_GREEN;
  } else if (cid === '8') {
    species = 'spino';
    primaryColor = STITCH_COLORS.EMERALD_GREEN;
    secondaryColor = STITCH_COLORS.ELECTRIC_CYAN;
    accentColor = STITCH_COLORS.SOLAR_AMBER;
  }

  // Shared Primitives
  const geomSphere = createSphereGeometry(0.5, 12, 12);
  const geomCylinder = createCylinderGeometry(0.3, 0.3, 0.5, 12);
  const geomBox = createBoxGeometry(0.4, 0.4, 0.4);

  // 1. Root Node (Placed on the left side of the side-by-side stage)
  const root = new BoneNode('root');
  root.setBasePosition(-0.40, 0, 0);

  // 2. Pelvis / Body Core
  const pelvis = new BoneNode('pelvis', root);
  pelvis.setBasePosition(0, 0.46, 0);
  pelvis.attachMesh(new RenderMesh('coach_pelvis', geomSphere, {
    color: primaryColor,
    scale: { x: 0.85, y: 0.65, z: 0.95 },
    offset: { x: 0, y: 0, z: 0 }
  }));

  // 3. Spine
  const spine = new BoneNode('spine', pelvis);
  spine.setBasePosition(0, 0.10, 0.12);
  spine.attachMesh(new RenderMesh('coach_spine_body', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.82, y: 0.55, z: 0.82 },
    offset: { x: 0, y: 0.05, z: 0 }
  }));

  // 4. Chest
  const chest = new BoneNode('chest', spine);
  chest.setBasePosition(0, 0.12, 0.10);
  chest.attachMesh(new RenderMesh('coach_chest', geomSphere, {
    color: primaryColor,
    scale: { x: 0.80, y: 0.65, z: 0.75 },
    offset: { x: 0, y: 0.06, z: 0 }
  }));
  // Belly counter-tone
  chest.attachMesh(new RenderMesh('coach_belly', geomSphere, {
    color: secondaryColor,
    scale: { x: 0.65, y: 0.55, z: 0.45 },
    offset: { x: 0, y: 0.02, z: 0.28 }
  }));

  // 5. Neck
  const neck = new BoneNode('neck', chest);
  const neckLen = (species === 'brachio' || species === 'dippy') ? 0.36 : 0.16;
  neck.setBasePosition(0, 0.18, 0.10);
  neck.attachMesh(new RenderMesh('coach_neck', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.42, y: neckLen * 2.2, z: 0.42 },
    offset: { x: 0, y: neckLen * 0.5, z: 0 }
  }));

  // 6. Head & Snout
  const head = new BoneNode('head', neck);
  head.setBasePosition(0, neckLen, 0.08);
  head.attachMesh(new RenderMesh('coach_cranium', geomSphere, {
    color: primaryColor,
    scale: { x: 0.55, y: 0.45, z: 0.55 },
    offset: { x: 0, y: 0.08, z: 0 }
  }));
  // Snout
  head.attachMesh(new RenderMesh('coach_snout', geomBox, {
    color: primaryColor,
    scale: { x: 0.42, y: 0.28, z: 0.58 },
    offset: { x: 0, y: 0.02, z: 0.32 }
  }));
  // Eyes
  head.attachMesh(new RenderMesh('coach_eye_L', geomSphere, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.10, y: 0.10, z: 0.08 },
    offset: { x: -0.16, y: 0.14, z: 0.16 }
  }));
  head.attachMesh(new RenderMesh('coach_eye_R', geomSphere, {
    color: STITCH_COLORS.MIDNIGHT_SLATE,
    scale: { x: 0.10, y: 0.10, z: 0.08 },
    offset: { x: 0.16, y: 0.14, z: 0.16 }
  }));

  // 7. Multi-segment Tail Hierarchy
  const tail1 = new BoneNode('tail1', pelvis);
  tail1.setBasePosition(0, -0.04, -0.22);
  tail1.attachMesh(new RenderMesh('tail_seg_1', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.52, y: 0.45, z: 0.52 },
    offset: { x: 0, y: 0, z: -0.10 }
  }));

  const tail2 = new BoneNode('tail2', tail1);
  tail2.setBasePosition(0, 0, -0.22);
  tail2.attachMesh(new RenderMesh('tail_seg_2', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.38, y: 0.45, z: 0.38 },
    offset: { x: 0, y: 0, z: -0.10 }
  }));

  const tail3 = new BoneNode('tail3', tail2);
  tail3.setBasePosition(0, 0, -0.22);
  tail3.attachMesh(new RenderMesh('tail_seg_3', geomCylinder, {
    color: accentColor,
    scale: { x: 0.22, y: 0.45, z: 0.22 },
    offset: { x: 0, y: 0, z: -0.10 }
  }));

  // 8. Forelimbs (Arms or Wings)
  const shoulderL = new BoneNode('shoulderL', chest);
  shoulderL.setBasePosition(-0.24, 0.08, 0.10);
  const armL = new BoneNode('armL', shoulderL);
  armL.setBasePosition(-0.04, -0.04, 0);

  const shoulderR = new BoneNode('shoulderR', chest);
  shoulderR.setBasePosition(0.24, 0.08, 0.10);
  const armR = new BoneNode('armR', shoulderR);
  armR.setBasePosition(0.04, -0.04, 0);

  if (species === 'pterry') {
    // Aerodynamic Wings
    const geomWing = createCapeGeometry(0.65, 0.45, 4, 4);
    armL.attachMesh(new RenderMesh('wing_L', geomWing, {
      color: secondaryColor,
      scale: { x: 1.0, y: 0.8, z: 1.0 },
      offset: { x: -0.25, y: 0, z: 0 }
    }));
    armR.attachMesh(new RenderMesh('wing_R', geomWing, {
      color: secondaryColor,
      scale: { x: 1.0, y: 0.8, z: 1.0 },
      offset: { x: 0.25, y: 0, z: 0 }
    }));
  } else {
    // Dino Forelimbs / Claws
    const armScale = (species === 'trex' || species === 'chomper') ? 0.24 : 0.42;
    armL.attachMesh(new RenderMesh('forelimb_L', geomCylinder, {
      color: primaryColor,
      scale: { x: 0.22, y: armScale, z: 0.22 },
      offset: { x: 0, y: -armScale * 0.5, z: 0.04 }
    }));
    armR.attachMesh(new RenderMesh('forelimb_R', geomCylinder, {
      color: primaryColor,
      scale: { x: 0.22, y: armScale, z: 0.22 },
      offset: { x: 0, y: -armScale * 0.5, z: 0.04 }
    }));
  }

  // 9. Hind Limbs (Legs)
  const hipL = new BoneNode('hipL', pelvis);
  hipL.setBasePosition(-0.20, -0.08, -0.04);
  const thighL = new BoneNode('thighL', hipL);
  thighL.setBasePosition(0, -0.04, 0);
  thighL.attachMesh(new RenderMesh('coach_thigh_L', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.32, y: 0.45, z: 0.32 },
    offset: { x: 0, y: -0.10, z: 0 }
  }));

  const calfL = new BoneNode('calfL', thighL);
  calfL.setBasePosition(0, -0.20, 0);
  calfL.attachMesh(new RenderMesh('coach_calf_L', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.26, y: 0.38, z: 0.26 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  const footL = new BoneNode('footL', calfL);
  footL.setBasePosition(0, -0.18, 0.06);
  footL.attachMesh(new RenderMesh('coach_foot_L', geomBox, {
    color: accentColor,
    scale: { x: 0.36, y: 0.16, z: 0.55 },
    offset: { x: 0, y: -0.06, z: 0.08 }
  }));

  const hipR = new BoneNode('hipR', pelvis);
  hipR.setBasePosition(0.20, -0.08, -0.04);
  const thighR = new BoneNode('thighR', hipR);
  thighR.setBasePosition(0, -0.04, 0);
  thighR.attachMesh(new RenderMesh('coach_thigh_R', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.32, y: 0.45, z: 0.32 },
    offset: { x: 0, y: -0.10, z: 0 }
  }));

  const calfR = new BoneNode('calfR', thighR);
  calfR.setBasePosition(0, -0.20, 0);
  calfR.attachMesh(new RenderMesh('coach_calf_R', geomCylinder, {
    color: primaryColor,
    scale: { x: 0.26, y: 0.38, z: 0.26 },
    offset: { x: 0, y: -0.08, z: 0 }
  }));

  const footR = new BoneNode('footR', calfR);
  footR.setBasePosition(0, -0.18, 0.06);
  footR.attachMesh(new RenderMesh('coach_foot_R', geomBox, {
    color: accentColor,
    scale: { x: 0.36, y: 0.16, z: 0.55 },
    offset: { x: 0, y: -0.06, z: 0.08 }
  }));

  // 10. Species Special Features
  if (species === 'stego') {
    // Stegosaurus Dorsal Plates
    const geomPlate = createPlateGeometry(0.16, 0.28, 0.05);
    spine.attachMesh(new RenderMesh('stego_plate_1', geomPlate, {
      color: secondaryColor,
      scale: { x: 1, y: 1, z: 1 },
      offset: { x: -0.05, y: 0.24, z: 0 }
    }));
    spine.attachMesh(new RenderMesh('stego_plate_2', geomPlate, {
      color: secondaryColor,
      scale: { x: 1.1, y: 1.1, z: 1 },
      offset: { x: 0.05, y: 0.26, z: -0.14 }
    }));
    tail1.attachMesh(new RenderMesh('stego_plate_3', geomPlate, {
      color: secondaryColor,
      scale: { x: 0.9, y: 0.9, z: 1 },
      offset: { x: -0.04, y: 0.18, z: -0.08 }
    }));
    tail2.attachMesh(new RenderMesh('stego_plate_4', geomPlate, {
      color: secondaryColor,
      scale: { x: 0.7, y: 0.7, z: 1 },
      offset: { x: 0.04, y: 0.14, z: -0.08 }
    }));
  } else if (species === 'spino') {
    // Spinosaurus Dorsal Sail Fin
    const geomSail = createSailGeometry(0.55, 0.52);
    spine.attachMesh(new RenderMesh('spino_sail', geomSail, {
      color: secondaryColor,
      emissive: hexToRgb(secondaryColor).map(v => v * 0.35),
      scale: { x: 1, y: 1, z: 1 },
      offset: { x: 0, y: 0.20, z: -0.05 }
    }));
  }

  const bones = {
    pelvis,
    spine,
    chest,
    neck,
    head,
    tail1,
    tail2,
    tail3,
    shoulderL,
    armL,
    shoulderR,
    armR,
    hipL,
    thighL,
    calfL,
    footL,
    hipR,
    thighR,
    calfR,
    footR
  };

  const meshes = [];
  function collectMeshes(node) {
    for (let i = 0; i < node.meshes.length; i++) {
      meshes.push({
        bone: node,
        renderMesh: node.meshes[i]
      });
    }
    for (let i = 0; i < node.children.length; i++) {
      collectMeshes(node.children[i]);
    }
  }
  collectMeshes(root);

  root.updateMatrix();

  return {
    root,
    bones,
    meshes,
    sceneGroup: root,
    coachId: cid,
    species,
    isCoach: true
  };
}
