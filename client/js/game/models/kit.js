// Kit de modelagem low poly: materiais em cache, geometrias coloridas e utilidades
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

// ---------- materiais ----------
const matCache = new Map();
export function stdMat(color, opts = {}) {
  const key = 's' + color + (opts.rough ?? '') + (opts.metal ?? '') + (opts.emissive ?? '') + (opts.transparent ? 't' + opts.opacity : '') + (opts.side ?? '');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: opts.rough ?? 0.75,
      metalness: opts.metal ?? 0.1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.ei ?? 1,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}
export function glowMat(color, k = 1.6, opts = {}) {
  const key = 'g' + color + k + (opts.transparent ? 't' + opts.opacity : '') + (opts.additive ? 'a' : '');
  let m = matCache.get(key);
  if (!m) {
    _c.set(color).multiplyScalar(k);
    m = new THREE.MeshBasicMaterial({
      color: _c.clone(),
      toneMapped: false,
      transparent: !!opts.transparent || !!opts.additive,
      opacity: opts.opacity ?? 1,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !opts.additive,
      side: opts.side ?? THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
}
export const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05 });
export const vcGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

// ---------- geometrias ----------
export function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, s = null } = {}) {
  if (s !== null) { sx = sy = sz = s; }
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_v, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

export function paint(geo, color, k = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  if (!g.attributes.normal) g.computeVertexNormals();
  _c.set(color).multiplyScalar(k);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Desloca vértices de forma determinística (mesma posição => mesmo deslocamento)
export function jitter(geo, amount, seed = 1) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const h = hash3(Math.round(x * 97), Math.round(y * 97), Math.round(z * 97), seed);
    pos.setXYZ(i, x + (h[0] - 0.5) * amount, y + (h[1] - 0.5) * amount, z + (h[2] - 0.5) * amount);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
function hash3(x, y, z, s) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  const out = [];
  for (let k = 0; k < 3; k++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    out.push(((h >>> 0) % 10000) / 10000);
  }
  return out;
}

export function merge(list) {
  const g = mergeGeometries(list.filter(Boolean), false);
  g.computeBoundingSphere();
  return g;
}

// Atalhos de geometria colorida (para mesclar)
export const G = {
  box: (w, h, d, color, t = {}, k = 1) => paint(xf(new THREE.BoxGeometry(w, h, d), t), color, k),
  cyl: (rt, rb, h, seg, color, t = {}, k = 1) => paint(xf(new THREE.CylinderGeometry(rt, rb, h, seg), t), color, k),
  cone: (r, h, seg, color, t = {}, k = 1) => paint(xf(new THREE.ConeGeometry(r, h, seg), t), color, k),
  ico: (r, d, color, t = {}, k = 1) => paint(xf(new THREE.IcosahedronGeometry(r, d), t), color, k),
  oct: (r, color, t = {}, k = 1) => paint(xf(new THREE.OctahedronGeometry(r, 0), t), color, k),
  dodec: (r, color, t = {}, k = 1) => paint(xf(new THREE.DodecahedronGeometry(r, 0), t), color, k),
  torus: (r, tube, rs, ts, arc, color, t = {}, k = 1) => paint(xf(new THREE.TorusGeometry(r, tube, rs, ts, arc), t), color, k),
  rock: (r, color, seed, t = {}, amt = 0.4, detail = 1) => paint(xf(jitter(new THREE.IcosahedronGeometry(r, detail), r * amt, seed), t), color),
};

// Atalhos de Mesh (para modelos animados)
export function mesh(geo, material, t = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(t.x || 0, t.y || 0, t.z || 0);
  m.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
  if (t.s !== undefined) m.scale.setScalar(t.s);
  else m.scale.set(t.sx || 1, t.sy || 1, t.sz || 1);
  m.castShadow = t.shadow !== false;
  m.receiveShadow = false;
  return m;
}
const geoCache = new Map();
function cachedGeo(key, fn) {
  let g = geoCache.get(key);
  if (!g) { g = fn(); geoCache.set(key, g); }
  return g;
}
export const unitBox = () => cachedGeo('box', () => new THREE.BoxGeometry(1, 1, 1));
export const unitCyl = (seg = 6) => cachedGeo('cyl' + seg, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg));
export const unitCone = (seg = 6) => cachedGeo('cone' + seg, () => new THREE.ConeGeometry(0.5, 1, seg));
export const unitIco = (d = 0) => cachedGeo('ico' + d, () => new THREE.IcosahedronGeometry(0.5, d));
export const unitOct = () => cachedGeo('oct', () => new THREE.OctahedronGeometry(0.5, 0));

export function B(w, h, d, material, t = {}) {
  return mesh(unitBox(), material, { ...t, sx: w, sy: h, sz: d });
}
export function C(r, h, material, t = {}, seg = 6) {
  return mesh(unitCyl(seg), material, { ...t, sx: r * 2, sy: h, sz: r * 2 });
}
export function K(r, h, material, t = {}, seg = 6) {
  return mesh(unitCone(seg), material, { ...t, sx: r * 2, sy: h, sz: r * 2 });
}
export function S(r, material, t = {}, d = 0) {
  return mesh(unitIco(d), material, { ...t, sx: r * 2 * (t.sx || 1), sy: r * 2 * (t.sy || 1), sz: r * 2 * (t.sz || 1) });
}
export function O(r, material, t = {}) {
  return mesh(unitOct(), material, { ...t, sx: r * 2 * (t.sx || 1), sy: r * 2 * (t.sy || 1), sz: r * 2 * (t.sz || 1) });
}
export function pivot(x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

export function darken(hex, f) {
  return '#' + _c.set(hex).multiplyScalar(f).getHexString();
}
export function mix(a, b, t) {
  const c1 = new THREE.Color(a), c2 = new THREE.Color(b);
  return '#' + c1.lerp(c2, t).getHexString();
}
