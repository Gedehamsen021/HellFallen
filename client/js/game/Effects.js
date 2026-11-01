// Efeitos visuais: partículas, explosões, traçantes, feixes, raios, decalques
import * as THREE from 'three';
import { glowMat } from './models/kit.js';

const VERT = `
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
uniform float uScale;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(aSize * uScale / -mv.z, 512.0);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec3 vColor; varying float vAlpha;
uniform float uSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, uSoft, d) * vAlpha;
  gl_FragColor = vec4(vColor * (1.0 + (1.0 - d * 2.0) * 0.6), a);
}`;

class ParticlePool {
  constructor(scene, n, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 700 }, uSoft: { value: additive ? 0.0 : 0.2 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
    this.geo = geo;
    this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, color, s0, s1, life, grav = 0, drag = 0, alpha = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = color.r; this.col[k + 1] = color.g; this.col[k + 2] = color.b;
    this.life[i] = life; this.max[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.size[i] = s0;
    this.a0[i] = alpha; this.alpha[i] = alpha;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      v[k] *= d; v[k + 1] = v[k + 1] * d - this.grav[i] * dt; v[k + 2] *= d;
      p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
      const t = 1 - this.life[i] / this.max[i];
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

const tmpC = new THREE.Color();
const COL = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const FIRE = [COL('#ffd27a', 2.2), COL('#ff9a3a', 2.2), COL('#ff5a1a', 2.0), COL('#ffb84a', 2.4)];
const SMOKE = [COL('#6a625a'), COL('#7a7268'), COL('#5a524c'), COL('#8a8278')];
const DUST = [COL('#a89a88'), COL('#b8aa96'), COL('#988a7a')];

export class Effects {
  constructor(scene, quality = 'alta', groundAt = null) {
    this.scene = scene;
    this.groundAt = groundAt;
    this.quality = quality;
    const q = quality === 'baixa' ? 0.5 : 1;
    this.add = new ParticlePool(scene, Math.floor(5000 * q), true);
    this.norm = new ParticlePool(scene, Math.floor(3500 * q), false);
    this.timed = [];

    // luzes reaproveitáveis
    this.lights = [];
    const nl = quality === 'alta' ? 6 : quality === 'media' ? 3 : 0;
    for (let i = 0; i < nl; i++) {
      const l = new THREE.PointLight('#ffaa55', 0, 30, 1.6);
      l.userData = { t: 0, life: 0, i0: 0 };
      scene.add(l);
      this.lights.push(l);
    }
    this.lightCursor = 0;

    // traçantes
    this.tracerGeo = new THREE.BoxGeometry(1, 1, 1);
    this.tracerGeo.translate(0, 0, -0.5);
    this.tracers = [];
    // detritos
    this.debrisGeo = new THREE.IcosahedronGeometry(0.22, 0);
    this.debris = [];
    // decalques
    this.decalGeo = new THREE.CircleGeometry(1, 10);
    this.decalGeo.rotateX(-Math.PI / 2);
    this.decalMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.decals = [];
    // anéis
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
  }

  setScale(h) {
    this.add.uniforms.uScale.value = h * 0.9;
    this.norm.uniforms.uScale.value = h * 0.9;
  }

  flash(x, y, z, color = '#ffaa55', intensity = 40, dist = 30, life = 0.25) {
    if (!this.lights.length) return;
    const l = this.lights[this.lightCursor];
    this.lightCursor = (this.lightCursor + 1) % this.lights.length;
    l.position.set(x, y, z);
    l.color.set(color);
    l.distance = dist;
    l.intensity = intensity;
    l.userData.t = 0; l.userData.life = life; l.userData.i0 = intensity;
  }

  burst(pool, n, x, y, z, { speed = 5, up = 0, color, colors, s0 = 0.5, s1 = 0.1, life = 0.6, lifeVar = 0.3, grav = 0, drag = 1, alpha = 1, spread = 1, dir = null }) {
    for (let i = 0; i < n; i++) {
      let vx = (Math.random() - 0.5) * 2, vy = (Math.random() - 0.5) * 2, vz = (Math.random() - 0.5) * 2;
      const l = Math.hypot(vx, vy, vz) || 1;
      const sp = speed * (0.3 + Math.random() * 0.7);
      vx = vx / l * sp * spread; vy = vy / l * sp * spread + up; vz = vz / l * sp * spread;
      if (dir) { vx += dir.x * speed; vy += dir.y * speed; vz += dir.z * speed; }
      const c = colors ? colors[(Math.random() * colors.length) | 0] : color;
      pool.emit(x, y, z, vx, vy, vz, c, s0 * (0.7 + Math.random() * 0.6), s1, life + Math.random() * lifeVar, grav, drag, alpha);
    }
  }

  explosion(x, y, z, r = 4, kind = 'grenade') {
    const big = Math.min(3, r / 4);
    if (kind === 'acid') {
      this.burst(this.add, 18, x, y, z, { speed: 6, up: 2, color: COL('#b6ff3a', 1.6), s0: 0.6, s1: 0.1, life: 0.5, grav: 12 });
      this.burst(this.norm, 6, x, y, z, { speed: 1.5, up: 1, color: COL('#5a8a2a'), s0: 1, s1: 2.5, life: 1.2, alpha: 0.5 });
      return;
    }
    if (kind === 'voidbolt') {
      this.burst(this.add, 22, x, y, z, { speed: 7, color: COL('#c06bff', 2), s0: 0.6, s1: 0.1, life: 0.5 });
      this.flash(x, y, z, '#c06bff', 18, 14, 0.2);
      return;
    }
    if (kind === 'plasma') {
      this.burst(this.add, 14, x, y, z, { speed: 5, color: COL('#d08aff', 2.2), s0: 0.5, s1: 0.05, life: 0.35 });
      this.flash(x, y, z, '#c06bff', 12, 10, 0.15);
      return;
    }
    if (kind === 'mines') {
      this.burst(this.norm, 10, x, y, z, { speed: 4, up: 2, color: COL('#5a5048'), s0: 0.8, s1: 1.8, life: 0.8, alpha: 0.5 });
      return;
    }
    const isFire = kind === 'napalm' || kind === 'incendiary';
    const isSolar = kind === 'solar';
    const isOrb = kind === 'orbital' || isSolar;
    const fireN = Math.min(140, 18 + r * 7) * (isSolar ? 2 : 1);
    this.burst(this.add, 4, x, y, z, { speed: 0.5, color: COL('#fff2c8', 3), s0: r * 3.2, s1: r * 4, life: 0.12, lifeVar: 0.05, alpha: 1 });
    this.burst(this.add, fireN, x, y, z, { speed: r * 2.6, up: r * 0.6, colors: FIRE, s0: r * 0.9, s1: r * 0.25, life: isFire ? 1.0 : 0.55, lifeVar: 0.4, drag: 3.2 });
    this.burst(this.add, Math.min(60, 10 + r * 3), x, y, z, { speed: 16 + r * 3, up: 6, color: COL('#ffd27a', 2.5), s0: 0.22, s1: 0.05, life: 0.8, grav: 22, drag: 0.5 });
    this.burst(this.norm, Math.min(50, 6 + r * 3) * (isSolar ? 2 : 1), x, y + r * 0.3, z, { speed: r * 1.0, up: r * 0.5 + 1, colors: SMOKE, s0: r * 0.7, s1: r * 2.2, life: 2.0, lifeVar: 1.4, drag: 1.4, alpha: 0.38 });
    if (isOrb) {
      this.burst(this.norm, 30, x, y, z, { speed: r * 1.8, up: r * 0.2, colors: DUST, s0: r * 0.6, s1: r * 1.8, life: 3, lifeVar: 1, drag: 2, alpha: 0.35, spread: 1.4 });
      for (let i = 0; i < 20; i++) this.add.emit(x, y + i * r * 0.25, z, (Math.random() - 0.5) * 2, r * 1.2 + Math.random() * 4, (Math.random() - 0.5) * 2, FIRE[i % 4], r * 0.8, r * 1.6, 1.2, 0, 0.8, 0.8);
    }
    this.flash(x, y + 1, z, isFire ? '#ff6a1a' : '#ffaa55', 60 * big + 20, 12 + r * 5, 0.35);
    this.ring(x, y, z, r * (isSolar ? 3 : 2.2), isSolar ? '#ffffff' : '#ffc890', isSolar ? 1.2 : 0.45);
    const nd = kind === 'structure' ? 14 : Math.min(10, Math.floor(r));
    for (let i = 0; i < nd; i++) this.spawnDebris(x, y, z, r);
    if (this.groundAt && r >= 2.5) this.decal(x, z, r * (isSolar ? 0.7 : 0.9));
    if (isSolar) {
      const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d0').multiplyScalar(3), transparent: true, opacity: 1, toneMapped: false }));
      sphere.position.set(x, y, z);
      this.scene.add(sphere);
      this.timed.push({ obj: sphere, t: 0, life: 1.6, update: (o, t) => { o.scale.setScalar(4 + t * r * 1.4); o.material.opacity = Math.max(0, 1 - t / 1.6); } });
    }
  }

  ring(x, y, z, r, color = '#ffc890', life = 0.45) {
    const mat = glowMat(color, 1.5, { additive: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide }).clone();
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(x, y + 0.3, z);
    this.scene.add(m);
    this.timed.push({ obj: m, t: 0, life, update: (o, t) => { const k = t / life; o.scale.setScalar(0.5 + k * r); o.material.opacity = 0.8 * (1 - k); }, dispose: true });
  }

  spawnDebris(x, y, z, r) {
    let d = this.debris.find((o) => !o.visible);
    if (!d) {
      if (this.debris.length > 50) d = this.debris[(Math.random() * this.debris.length) | 0];
      else {
        d = new THREE.Mesh(this.debrisGeo, new THREE.MeshStandardMaterial({ color: '#3a3430', flatShading: true }));
        d.castShadow = true;
        this.scene.add(d);
        this.debris.push(d);
      }
    }
    d.visible = true;
    d.position.set(x, y + 0.5, z);
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * r * 1.5;
    d.userData = { vx: Math.cos(a) * sp, vy: 6 + Math.random() * 8, vz: Math.sin(a) * sp, life: 2.5, rs: (Math.random() - 0.5) * 12 };
    d.scale.setScalar(0.6 + Math.random() * 1.2);
  }

  decal(x, z, r) {
    let d;
    if (this.decals.length >= 40) d = this.decals.shift();
    else d = new THREE.Mesh(this.decalGeo, this.decalMat.clone());
    d.position.set(x, this.groundAt(x, z) + 0.08, z);
    d.scale.setScalar(r);
    d.material.opacity = 0.55;
    d.userData.t = 0;
    this.scene.add(d);
    this.decals.push(d);
  }

  tracer(from, to, color = '#ffd27a', width = 0.05, speed = 450) {
    let t = this.tracers.find((o) => !o.mesh.visible);
    if (!t) {
      if (this.tracers.length > 80) t = this.tracers[0];
      else {
        t = { mesh: new THREE.Mesh(this.tracerGeo, glowMat('#ffd27a', 2.5)) };
        this.scene.add(t.mesh);
        this.tracers.push(t);
      }
    }
    t.mesh.material = glowMat(color, 2.8);
    t.mesh.visible = true;
    t.from = from.clone();
    t.dir = to.clone().sub(from);
    t.dist = t.dir.length();
    t.dir.normalize();
    t.t = 0;
    t.speed = speed;
    t.width = width;
    t.mesh.scale.set(width, width, 1);
  }

  muzzle(pos, dir, color = '#ffc070', size = 1) {
    this.burst(this.add, 3, pos.x, pos.y, pos.z, { speed: 2, color: COL(color, 2.5), s0: 0.5 * size, s1: 0.1, life: 0.06, lifeVar: 0.03, dir, spread: 0.4 });
    this.flash(pos.x, pos.y, pos.z, color, 6 * size, 8, 0.06);
  }

  impact(x, y, z, kind = 'dirt', color = null) {
    if (kind === 'blood') {
      const c = COL(color || '#ffb347', 1.6);
      this.burst(this.add, 6, x, y, z, { speed: 4, up: 1.5, color: c, s0: 0.35, s1: 0.05, life: 0.35, grav: 10 });
    } else if (kind === 'shield') {
      this.burst(this.add, 10, x, y, z, { speed: 4, color: COL('#7fd8ff', 2), s0: 0.4, s1: 0.05, life: 0.3 });
    } else {
      this.burst(this.norm, 3, x, y, z, { speed: 1.5, up: 1.2, color: COL(color || '#7a6a5a'), s0: 0.4, s1: 1.0, life: 0.6, alpha: 0.6 });
      this.burst(this.add, 2, x, y, z, { speed: 4, up: 2, color: COL('#ffd27a', 2), s0: 0.12, s1: 0.02, life: 0.2, grav: 15 });
    }
  }

  gore(x, y, z, color, big = 1) {
    const c = COL(color, 1.8);
    this.burst(this.add, Math.floor(16 * big), x, y, z, { speed: 6 * big, up: 3, color: c, s0: 0.5 * big, s1: 0.05, life: 0.6, grav: 14, drag: 0.8 });
    this.burst(this.norm, Math.floor(4 * big), x, y, z, { speed: 2, up: 1, color: COL(color, 0.6), s0: 0.6 * big, s1: 1.4 * big, life: 0.8, alpha: 0.3 });
  }

  flame(pos, dir) {
    for (let i = 0; i < 3; i++) {
      const sp = 16 + Math.random() * 6;
      const s = 0.18;
      const c = FIRE[(Math.random() * 4) | 0];
      this.add.emit(pos.x, pos.y, pos.z, dir.x * sp + (Math.random() - 0.5) * sp * s, dir.y * sp + (Math.random() - 0.5) * sp * s + 1, dir.z * sp + (Math.random() - 0.5) * sp * s, c, 0.3, 2.2, 0.55 + Math.random() * 0.2, -3, 1.6, 0.9);
    }
    if (Math.random() < 0.3) this.norm.emit(pos.x + dir.x * 8, pos.y + dir.y * 8 + 1, pos.z + dir.z * 8, dir.x * 4, 2, dir.z * 4, SMOKE[0], 1, 3, 1.4, -1, 1, 0.4);
  }

  fireZone(x, z, r) {
    const y = this.groundAt ? this.groundAt(x, z) : 0;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      this.add.emit(x + Math.cos(a) * d, y + 0.2, z + Math.sin(a) * d, 0, 2 + Math.random() * 2, 0, FIRE[(Math.random() * 4) | 0], 0.8, 1.6, 0.7 + Math.random() * 0.4, -2, 0.5, 0.9);
    }
    if (Math.random() < 0.2) this.norm.emit(x, y + 2, z, 0, 2, 0, SMOKE[1], 1.5, 4, 2, -0.5, 0.5, 0.35);
  }

  lightning(points, color = '#7ff3ff') {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, opacity: 1, toneMapped: false, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.timed.push({ obj: line, t: 0, life: 0.14, update: (o, t) => { o.material.opacity = 1 - t / 0.14; }, dispose: true });
    const last = points[points.length - 1];
    this.burst(this.add, 6, last.x, last.y, last.z, { speed: 5, color: COL(color, 2), s0: 0.3, s1: 0.05, life: 0.2 });
  }

  arcBolt(from, to, color) {
    const pts = [from.clone()];
    const segs = 8;
    const d = to.clone().sub(from);
    const len = d.length();
    for (let i = 1; i < segs; i++) {
      const p = from.clone().addScaledVector(d, i / segs);
      p.x += (Math.random() - 0.5) * len * 0.08;
      p.y += (Math.random() - 0.5) * len * 0.08;
      p.z += (Math.random() - 0.5) * len * 0.08;
      pts.push(p);
    }
    pts.push(to.clone());
    this.lightning(pts, color);
  }

  beam(x, y, z, { color = '#ffd8a0', width = 1.2, height = 500, life = 0.5, k = 3 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.beamGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(width, height, width);
    this.scene.add(m);
    this.timed.push({ obj: m, t: 0, life, update: (o, t) => { const f = 1 - t / life; o.scale.x = o.scale.z = width * (0.3 + f); o.material.opacity = 0.9 * f; }, dispose: true });
    this.flash(x, y + 3, z, color, 60, 40, life);
  }

  shellStreak(x, y, z) {
    const from = new THREE.Vector3(x + 30, y + 260, z + 15);
    const to = new THREE.Vector3(x, y, z);
    this.tracer(from, to, '#ffb070', 0.5, 480);
  }

  breach(x, y, z, faction) {
    if (faction === 'vorr') {
      this.burst(this.norm, 30, x, y, z, { speed: 6, up: 6, colors: DUST, s0: 1.2, s1: 3, life: 1.8, lifeVar: 1, grav: 3, alpha: 0.45 });
      this.burst(this.add, 25, x, y, z, { speed: 3, up: 4, color: COL('#ffb347', 1.8), s0: 0.4, s1: 0.1, life: 1.6, grav: -1 });
      for (let i = 0; i < 8; i++) this.spawnDebris(x, y, z, 5);
    } else if (faction === 'ferro') {
      this.beam(x, y, z, { color: '#ff3b3b', width: 0.8, height: 120, life: 2.0, k: 2 });
      this.burst(this.add, 40, x, y + 1, z, { speed: 8, up: 4, color: COL('#ffd27a', 2), s0: 0.25, s1: 0.05, life: 0.8, grav: 15 });
      this.burst(this.norm, 18, x, y, z, { speed: 3, up: 2, colors: SMOKE, s0: 1.5, s1: 4, life: 2.5, alpha: 0.6 });
    } else {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c06bff').multiplyScalar(2.5), transparent: true, opacity: 0.9, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const rift = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.25, 6, 24), mat);
      rift.position.set(x, y + 3, z);
      this.scene.add(rift);
      const core = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24), new THREE.MeshBasicMaterial({ color: '#05000c', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      rift.add(core);
      this.timed.push({ obj: rift, t: 0, life: 3, update: (o, t) => {
        const k = t < 0.5 ? t / 0.5 : t > 2.4 ? Math.max(0, (3 - t) / 0.6) : 1;
        o.scale.set(k, k * 1.4, k);
        o.rotation.y += 0.02;
        if (Math.random() < 0.5) this.add.emit(x + (Math.random() - 0.5) * 4, y + 3 + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 4, 0, 0.5, 0, COL('#c06bff', 2), 0.5, 0.05, 0.8, 0, 0, 1);
      }, dispose: true });
      this.flash(x, y + 3, z, '#c06bff', 40, 30, 2.5);
    }
  }

  flare(x, y, z, color = '#ff3b3b') {
    const c = COL(color, 3);
    const obj = new THREE.Object3D();
    obj.position.set(x, y + 2, z);
    this.scene.add(obj);
    this.timed.push({ obj, t: 0, life: 1.6, update: (o, t, dt) => {
      o.position.y += 28 * dt;
      this.add.emit(o.position.x, o.position.y, o.position.z, 0, 0, 0, c, 1.2, 0.2, 0.5, 0, 0, 1);
      if (t > 1.5) this.burst(this.add, 30, o.position.x, o.position.y, o.position.z, { speed: 8, color: c, s0: 0.6, s1: 0.1, life: 1.2, grav: 4 });
    } });
  }

  teleport(x, y, z) {
    this.burst(this.add, 18, x, y + 1, z, { speed: 5, color: COL('#c06bff', 2), s0: 0.5, s1: 0.05, life: 0.4 });
    this.burst(this.add, 8, x, y + 1, z, { speed: 1, color: COL('#7ff3ff', 2), s0: 1.4, s1: 0.1, life: 0.3 });
  }

  podLand(x, y, z) {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      this.norm.emit(x, y + 0.3, z, Math.cos(a) * 12, 1 + Math.random(), Math.sin(a) * 12, DUST[i % 3], 1.0, 3.0, 1.2, 0, 2.2, 0.35);
    }
    this.burst(this.add, 20, x, y + 0.5, z, { speed: 8, up: 4, colors: FIRE, s0: 0.8, s1: 0.1, life: 0.4, drag: 3 });
    this.flash(x, y + 1, z, '#ffaa55', 40, 20, 0.3);
    this.ring(x, y, z, 6, '#ffd8a0', 0.5);
  }

  update(dt) {
    this.add.update(dt);
    this.norm.update(dt);
    for (const l of this.lights) {
      if (l.intensity <= 0) continue;
      l.userData.t += dt;
      const k = 1 - l.userData.t / l.userData.life;
      l.intensity = k > 0 ? l.userData.i0 * k * k : 0;
    }
    for (const t of this.tracers) {
      if (!t.mesh.visible) continue;
      t.t += dt;
      const travel = t.t * t.speed;
      const head = Math.min(t.dist, travel);
      const tail = Math.max(0, travel - 7);
      if (tail >= t.dist) { t.mesh.visible = false; continue; }
      t.mesh.position.copy(t.from).addScaledVector(t.dir, head);
      t.mesh.lookAt(t.mesh.position.x + t.dir.x, t.mesh.position.y + t.dir.y, t.mesh.position.z + t.dir.z);
      t.mesh.scale.set(t.width, t.width, Math.max(0.05, head - tail));
    }
    for (const d of this.debris) {
      if (!d.visible) continue;
      const u = d.userData;
      u.life -= dt;
      u.vy -= 20 * dt;
      d.position.x += u.vx * dt; d.position.y += u.vy * dt; d.position.z += u.vz * dt;
      d.rotation.x += u.rs * dt; d.rotation.z += u.rs * dt * 0.7;
      if (this.groundAt) {
        const g = this.groundAt(d.position.x, d.position.z);
        if (d.position.y < g + 0.1) { d.position.y = g + 0.1; u.vy *= -0.3; u.vx *= 0.6; u.vz *= 0.6; u.rs *= 0.5; }
      }
      if (u.life <= 0) d.visible = false;
    }
    for (const dc of this.decals) {
      dc.userData.t += dt;
      dc.material.opacity = Math.max(0, 0.55 * (1 - dc.userData.t / 40));
    }
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const e = this.timed[i];
      e.t += dt;
      e.update(e.obj, e.t, dt);
      if (e.t >= e.life) {
        this.scene.remove(e.obj);
        if (e.dispose && e.obj.geometry && e.obj.geometry !== this.ringGeo && e.obj.geometry !== this.beamGeo) e.obj.geometry.dispose();
        if (e.obj.material && e.dispose) e.obj.material.dispose();
        this.timed.splice(i, 1);
      }
    }
  }
}
