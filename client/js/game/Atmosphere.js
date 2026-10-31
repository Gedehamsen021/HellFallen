// Céu, luz, neblina, astros, nuvens e clima de cada planeta
import * as THREE from 'three';
import { TIME_OF_DAY } from './BiomeVisuals.js';
import { mix } from './models/kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D } from '../../../shared/noise.js';
import { RNG } from '../../../shared/rng.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uStars; uniform float uTime; uniform float uAurora;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.5));
  col = mix(col, uBottom, smoothstep(0.0, -0.2, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 900.0) * 8.0 + pow(s, 14.0) * 0.35 + pow(s, 3.0) * 0.12);
  if (uStars > 0.0 && h > -0.05) {
    vec3 p = d * 260.0;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float r = hash(cell);
    float star = step(0.9965, r) * smoothstep(0.32, 0.0, length(f)) * (0.55 + 0.45 * sin(uTime * 2.0 + r * 300.0));
    col += vec3(0.9, 0.95, 1.0) * star * uStars * 1.6 * smoothstep(-0.05, 0.25, h);
    float neb = sin(d.x * 3.0 + d.z * 2.0) * sin(d.y * 5.0 - d.x * 2.0);
    col += vec3(0.25, 0.1, 0.4) * smoothstep(0.4, 1.0, neb) * uStars * 0.25 * smoothstep(0.0, 0.4, h);
  }
  if (uAurora > 0.0 && h > 0.04) {
    float band = sin(d.x * 5.0 + uTime * 0.25 + sin(d.z * 3.5 + uTime * 0.17) * 2.2);
    float a = smoothstep(0.55, 1.0, band) * smoothstep(0.04, 0.25, h) * smoothstep(0.75, 0.3, h);
    col += vec3(0.15, 1.0, 0.55) * a * uAurora * 0.7 + vec3(0.6, 0.2, 1.0) * a * uAurora * 0.35 * smoothstep(0.25, 0.6, h);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PART_VERT = `
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
uniform float uScale;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PART_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.15, d) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

export class Atmosphere {
  constructor(scene, world, vis, quality = 'alta') {
    this.scene = scene;
    this.world = world;
    this.vis = vis;
    let todKey = world.timeOfDay;
    if (todKey === 'night' && vis.noNight) todKey = world.biome === 'moon' ? 'day' : 'dusk';
    const tod = TIME_OF_DAY[todKey] || TIME_OF_DAY.day;
    this.tod = tod;
    const rng = new RNG(world.seed + 77);
    const isMoon = world.biome === 'moon';

    const top = mix(vis.sky.top, tod.topTint, tod.topMix);
    const horizon = mix(vis.sky.horizon, tod.horizonTint, tod.horizonMix);
    const bottom = mix(vis.sky.bottom, tod.horizonTint, tod.horizonMix * 0.8);
    let fogCol = mix(vis.sky.fog, tod.horizonTint, tod.horizonMix * 0.85);
    if (tod.night) fogCol = mix(fogCol, '#0a0f22', 0.35);
    const sunColor = mix(vis.sky.sun, tod.sunColor, 0.65);

    const az = rng.range(0, Math.PI * 2);
    const el = tod.sunElev;
    this.sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();

    // céu
    this.skyUniforms = {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
      uSunDir: { value: this.sunDir.clone() },
      uSunColor: { value: new THREE.Color(sunColor).multiplyScalar(tod.night ? 0.5 : 1) },
      uStars: { value: Math.max(tod.stars, vis.stars || 0) },
      uTime: { value: 0 },
      uAurora: { value: vis.aurora ? (tod.night ? 1 : tod.stars > 0 ? 0.5 : 0.12) : 0 },
    };
    const skyMat = new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    scene.background = new THREE.Color(fogCol);

    // neblina
    const [fn, ff] = vis.fog;
    this.fog = new THREE.Fog(fogCol, fn, ff * tod.fogMul);
    scene.fog = this.fog;

    // luzes
    const sunInt = (isMoon ? 3.0 : 2.6) * tod.sunMul;
    this.sun = new THREE.DirectionalLight(sunColor, sunInt);
    this.sun.castShadow = quality !== 'baixa';
    const sm = quality === 'alta' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);
    const hemiSky = tod.night ? mix(horizon, '#3a5aa8', 0.5) : mix(horizon, top, 0.3);
    const hemiGround = mix(vis.ground.low, '#000000', 0.45);
    this.hemi = new THREE.HemisphereLight(hemiSky, hemiGround, (vis.ambient || 0.6) * (tod.night ? 1.6 : 1.15));
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(tod.night ? '#6a7ab8' : '#ffffff', tod.night ? 0.55 : 0.18);
    scene.add(this.ambient);

    // astros
    this.celestial = new THREE.Group();
    scene.add(this.celestial);
    for (const cb of vis.celestial || []) this.addCelestial(cb, rng);

    // nuvens
    this.clouds = null;
    if (vis.clouds) this.buildClouds(vis.clouds, rng, tod);

    // clima
    this.weather = null;
    this.buildWeather(vis.weather, quality);
  }

  addCelestial(cb, rng) {
    const dir = new THREE.Vector3(...cb.dir).normalize();
    const dist = 1500;
    if (cb.kind === 'sun') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(cb.size, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(cb.color).multiplyScalar(3), fog: false, toneMapped: false }));
      m.position.copy(dir.multiplyScalar(dist));
      m.lookAt(0, 0, 0);
      this.celestial.add(m);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(cb.size * 4, 24), new THREE.MeshBasicMaterial({ color: cb.color, fog: false, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.copy(m.position).multiplyScalar(1.001);
      halo.lookAt(0, 0, 0);
      this.celestial.add(halo);
      return;
    }
    const geo = new THREE.IcosahedronGeometry(cb.size, cb.kind === 'planet' ? 4 : 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const noise = createNoise2D(Math.floor(rng.float() * 1e6));
    const c1 = new THREE.Color(cb.color), c2 = new THREE.Color(cb.color2 || cb.color), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / cb.size, y = pos.getY(i) / cb.size, z = pos.getZ(i) / cb.size;
      let t;
      if (cb.kind === 'planet') t = Math.sin(y * 9 + noise(x * 2, z * 2) * 2.5) * 0.5 + 0.5;
      else t = noise(x * 3 + y, z * 3 - y) * 0.5 + 0.5;
      c.copy(c1).lerp(c2, t);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, fog: false, emissive: cb.color, emissiveIntensity: 0.08 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(dir.clone().multiplyScalar(dist));
    m.rotation.set(rng.range(-0.4, 0.4), rng.range(0, 6), rng.range(-0.4, 0.4));
    this.celestial.add(m);
    if (cb.ring) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(cb.size * 1.35, cb.size * 2.1, 48, 1), new THREE.MeshBasicMaterial({ color: cb.ring, side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: false }));
      ring.position.copy(m.position);
      ring.rotation.set(Math.PI / 2 + 0.35, 0.2, 0.3);
      this.celestial.add(ring);
    }
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(cb.size * 1.06, 24, 16), new THREE.MeshBasicMaterial({ color: cb.atmo || cb.color, transparent: true, opacity: 0.15, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
    atmo.position.copy(m.position);
    this.celestial.add(atmo);
  }

  buildClouds(cfg, rng, tod) {
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.IcosahedronGeometry(1, 0);
      g.scale(rng.range(0.8, 1.4), rng.range(0.5, 0.8), rng.range(0.8, 1.3));
      g.translate(rng.range(-1.6, 1.6), rng.range(-0.2, 0.3), rng.range(-0.8, 0.8));
      puffs.push(g);
    }
    const geo = mergeGeometries(puffs);
    const color = tod.night ? mix(cfg.color, '#2a3050', 0.7) : tod.horizonMix > 0.3 ? mix(cfg.color, tod.horizonTint, 0.35) : cfg.color;
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, transparent: true, opacity: cfg.opacity, emissive: color, emissiveIntensity: 0.25 });
    const n = cfg.count;
    this.clouds = new THREE.InstancedMesh(geo, mat, n);
    this.cloudData = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const d = { x: rng.range(-1000, 1000), y: rng.range(150, 240), z: rng.range(-1000, 1000), s: rng.range(14, 34), r: rng.range(0, 6) };
      this.cloudData.push(d);
    }
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
    this.cloudWind = new THREE.Vector2(rng.range(-1, 1), rng.range(-1, 1)).normalize().multiplyScalar(4);
    this.updateClouds(0, new THREE.Vector3());
  }

  updateClouds(dt, center) {
    if (!this.clouds) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < this.cloudData.length; i++) {
      const d = this.cloudData[i];
      d.x += this.cloudWind.x * dt;
      d.z += this.cloudWind.y * dt;
      if (d.x - center.x > 1000) d.x -= 2000; else if (d.x - center.x < -1000) d.x += 2000;
      if (d.z - center.z > 1000) d.z -= 2000; else if (d.z - center.z < -1000) d.z += 2000;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.r);
      s.set(d.s, d.s, d.s);
      p.set(d.x, d.y, d.z);
      m.compose(p, q, s);
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  buildWeather(type, quality) {
    const presets = {
      sand: { n: 1400, color: '#e8b070', size: 0.25, alpha: 0.5, vel: [9, -0.5, 3], jitter: 2, additive: false },
      snow: { n: 2200, color: '#ffffff', size: 0.22, alpha: 0.85, vel: [1.5, -3, 0.8], jitter: 1.2, additive: false },
      spores: { n: 900, color: '#a8ff6a', size: 0.22, alpha: 0.8, vel: [0.2, 0.4, 0.1], jitter: 0.6, additive: true },
      ash: { n: 1500, color: '#5a4a48', size: 0.2, alpha: 0.75, vel: [1, -1.5, 0.6], jitter: 0.8, additive: false, embers: true },
      motes: { n: 900, color: '#ffc8f8', size: 0.2, alpha: 0.85, vel: [0.3, 0.3, 0.2], jitter: 0.5, additive: true },
      rain: { n: 2400, color: '#cfe8ff', size: 0.12, alpha: 0.5, vel: [1, -26, 0.5], jitter: 0.5, additive: false },
      dust: { n: 500, color: '#c8c8d8', size: 0.15, alpha: 0.4, vel: [0.3, -0.1, 0.2], jitter: 0.3, additive: false },
    };
    const p = presets[type];
    if (!p) return;
    const mult = quality === 'alta' ? 1 : quality === 'media' ? 0.6 : 0.3;
    const n = Math.floor(p.n * mult);
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const color = new Float32Array(n * 3);
    const alpha = new Float32Array(n);
    const c = new THREE.Color(p.color);
    const ember = new THREE.Color('#ff7a2a').multiplyScalar(2);
    const box = 70;
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * box * 2;
      pos[i * 3 + 1] = Math.random() * 45 - 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * box * 2;
      const isEmber = p.embers && i % 6 === 0;
      size[i] = p.size * (0.6 + Math.random() * 0.8) * (isEmber ? 1.3 : 1);
      const cc = isEmber ? ember : c;
      color[i * 3] = cc.r; color[i * 3 + 1] = cc.g; color[i * 3 + 2] = cc.b;
      alpha[i] = p.alpha * (0.5 + Math.random() * 0.5);
      vel[i * 3] = p.vel[0] + (Math.random() - 0.5) * p.jitter;
      vel[i * 3 + 1] = isEmber ? 1.5 + Math.random() : p.vel[1] + (Math.random() - 0.5) * p.jitter;
      vel[i * 3 + 2] = p.vel[2] + (Math.random() - 0.5) * p.jitter;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 900 } },
      vertexShader: PART_VERT, fragmentShader: PART_FRAG,
      transparent: true, depthWrite: false,
      blending: p.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.weather = { pts, vel, n, box, type, center: new THREE.Vector3() };
  }

  updateWeather(dt, cam) {
    const w = this.weather;
    if (!w) return;
    const pos = w.pts.geometry.attributes.position;
    const a = pos.array;
    const t = performance.now() * 0.001;
    const cx = cam.x, cy = cam.y, cz = cam.z;
    const B = w.box;
    for (let i = 0; i < w.n; i++) {
      const k = i * 3;
      a[k] += w.vel[k] * dt + (w.type === 'spores' || w.type === 'motes' ? Math.sin(t + i) * 0.01 : 0);
      a[k + 1] += w.vel[k + 1] * dt;
      a[k + 2] += w.vel[k + 2] * dt;
      if (a[k] - cx > B) a[k] -= B * 2; else if (a[k] - cx < -B) a[k] += B * 2;
      if (a[k + 2] - cz > B) a[k + 2] -= B * 2; else if (a[k + 2] - cz < -B) a[k + 2] += B * 2;
      if (a[k + 1] - cy < -12) a[k + 1] += 50; else if (a[k + 1] - cy > 38) a[k + 1] -= 50;
    }
    pos.needsUpdate = true;
  }

  update(dt, camera, focus) {
    this.skyUniforms.uTime.value += dt;
    this.sky.position.copy(camera.position);
    this.celestial.position.copy(camera.position);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
    this.sun.target.position.copy(focus);
    this.updateClouds(dt, camera.position);
    this.updateWeather(dt, camera.position);
  }
}
