// Mapa galáctico 3D: estrelas, nebulosas, planetas low poly, rotas e territórios
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PLANETS, LINKS, PLANET_MAP, SECTORS } from '../../../shared/data/planets.js';
import { FACTIONS } from '../../../shared/data/factions.js';
import { BIOME_VIS } from '../game/BiomeVisuals.js';
import { createNoise2D } from '../../../shared/noise.js';
import { mulberry32 } from '../../../shared/rng.js';
import { planetStatus } from '../../../shared/galaxy.js';
import { buildBastion } from '../game/models/structures.js';

function glowTexture(color, soft = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(soft, color.replace(/[\d.]+\)$/, '0.25)'));
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hexToRgba = (hex, a) => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};

export class GalaxyView {
  constructor(renderer, quality = 'alta') {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03040a');
    const w = window.innerWidth, h = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 3000);
    this.camera.position.set(30, 110, 150);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(5, 0, 20);
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.targetGoal = null;
    this.selected = null;
    this.hover = null;
    this.time = 0;
    this.enabled = true;

    this.scene.add(new THREE.AmbientLight('#8090c0', 0.55));
    const key = new THREE.PointLight('#fff2d8', 3000, 0, 1.6);
    key.position.set(0, 40, 0);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#7a9aff', 0.6);
    fill.position.set(-50, 80, 100);
    this.scene.add(fill);

    this.buildStars();
    this.buildGalaxyDisc();
    this.buildNebulae();
    this.buildPlanets();
    this.buildLinks();
    this.ship = buildBastion();
    this.ship.scale.setScalar(0.35);
    this.scene.add(this.ship);

    this.composer = null;
    if (quality !== 'baixa') {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 0.8));
      this.composer.addPass(new OutputPass());
    }
    this.raycaster = new THREE.Raycaster();
  }

  buildStars() {
    const n = 7000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rand = mulberry32(42);
    const palette = ['#ffffff', '#cfe0ff', '#ffe8c8', '#ffd0a0', '#a8c8ff', '#ffb0b0'].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2;
      const r = 900 + rand() * 600;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(th) * s * r;
      pos[i * 3 + 1] = u * r;
      pos[i * 3 + 2] = Math.sin(th) * s * r;
      const c = palette[(rand() * palette.length) | 0];
      const k = 0.5 + rand() * 1.4;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false });
    this.scene.add(new THREE.Points(geo, mat));
  }

  buildGalaxyDisc() {
    const n = 16000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rand = mulberry32(7);
    const arms = 4;
    const armCol = [new THREE.Color('#5aa8ff'), new THREE.Color('#ff8a4a'), new THREE.Color('#ff4a6a'), new THREE.Color('#b07aff')];
    for (let i = 0; i < n; i++) {
      const arm = i % arms;
      const d = Math.pow(rand(), 0.7) * 170;
      const a = (arm / arms) * Math.PI * 2 + d * 0.028 + (rand() - 0.5) * 0.6;
      pos[i * 3] = Math.cos(a) * d + (rand() - 0.5) * 8 + 5;
      pos[i * 3 + 1] = (rand() - 0.5) * (12 - d * 0.04) - 8;
      pos[i * 3 + 2] = Math.sin(a) * d + (rand() - 0.5) * 8 + 20;
      const c = armCol[arm].clone().lerp(new THREE.Color('#ffffff'), Math.max(0, 1 - d / 40) * 0.8);
      const k = 0.12 + rand() * 0.3;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    this.disc = new THREE.Points(geo, mat);
    this.scene.add(this.disc);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,200,1)', 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    core.position.set(5, -8, 20);
    core.scale.setScalar(55);
    core.material.opacity = 0.55;
    this.scene.add(core);
  }

  buildNebulae() {
    const rand = mulberry32(99);
    const cols = ['#3a6aff', '#ff6a3a', '#ff3a5a', '#a05aff', '#3affd0', '#ff3ab0'];
    for (let i = 0; i < 26; i++) {
      const c = cols[i % cols.length];
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(hexToRgba(c, 0.5), 0.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.16 + rand() * 0.14 }));
      const a = rand() * Math.PI * 2, d = 60 + rand() * 260;
      s.position.set(Math.cos(a) * d, -30 + rand() * 40 - (d > 200 ? 60 : 0), Math.sin(a) * d);
      s.scale.setScalar(80 + rand() * 180);
      this.scene.add(s);
    }
  }

  buildPlanets() {
    this.planets = new Map();
    this.pickables = [];
    for (const p of PLANETS) {
      const vis = BIOME_VIS[p.biome];
      const R = 1.6 + (p.size || 1) * 1.3;
      const g = new THREE.Group();
      g.position.set(p.pos[0], p.pos[1], p.pos[2]);
      this.scene.add(g);
      // planeta com relevo e biomas
      const geo = new THREE.IcosahedronGeometry(R, 3);
      const pa = geo.attributes.position;
      const noise = createNoise2D(p.id.length * 131 + p.pos[0] * 7);
      const colors = new Float32Array(pa.count * 3);
      const G = vis.ground;
      const cLow = new THREE.Color(G.low), cMid = new THREE.Color(G.mid), cHigh = new THREE.Color(G.high), cPeak = new THREE.Color(G.peak);
      const cLiq = vis.liquid ? new THREE.Color(vis.liquid.color) : null;
      const c = new THREE.Color();
      const tmp = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        tmp.set(pa.getX(i), pa.getY(i), pa.getZ(i)).normalize();
        let n = noise(tmp.x * 1.6 + tmp.y * 0.7, tmp.z * 1.6 - tmp.y * 0.9) * 0.7 + noise(tmp.x * 4 + 3, tmp.z * 4 + tmp.y * 3) * 0.3;
        const liquidCut = p.biome === 'ocean' ? 0.15 : vis.liquid ? -0.25 : -2;
        if (cLiq && n < liquidCut) {
          c.copy(cLiq);
          if (vis.liquid.kind === 'lava') c.multiplyScalar(1.6);
          tmp.multiplyScalar(R);
        } else {
          const t = (n - liquidCut) / (1 - liquidCut);
          if (t < 0.3) c.copy(cLow).lerp(cMid, t / 0.3);
          else if (t < 0.65) c.copy(cMid).lerp(cHigh, (t - 0.3) / 0.35);
          else c.copy(cHigh).lerp(cPeak, Math.min(1, (t - 0.65) / 0.3));
          tmp.multiplyScalar(R * (1 + Math.max(0, n) * 0.08));
        }
        if (Math.abs(tmp.y / R) > 0.85 && p.biome !== 'volcanic') c.lerp(new THREE.Color('#ffffff'), 0.6);
        pa.setXYZ(i, tmp.x, tmp.y, tmp.z);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      const ng = geo.index ? geo.toNonIndexed() : geo;
      // recolore no geometry não indexado (cores por face = média)
      const npos = ng.attributes.position;
      const ncol = new Float32Array(npos.count * 3);
      const idx = geo.index ? geo.index.array : null;
      for (let f = 0; f < npos.count / 3; f++) {
        let r = 0, gg = 0, b = 0;
        for (let k = 0; k < 3; k++) {
          const vi = idx ? idx[f * 3 + k] : f * 3 + k;
          r += colors[vi * 3]; gg += colors[vi * 3 + 1]; b += colors[vi * 3 + 2];
        }
        for (let k = 0; k < 3; k++) { ncol[(f * 3 + k) * 3] = r / 3; ncol[(f * 3 + k) * 3 + 1] = gg / 3; ncol[(f * 3 + k) * 3 + 2] = b / 3; }
      }
      ng.setAttribute('color', new THREE.BufferAttribute(ncol, 3));
      ng.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05, emissive: vis.liquid?.kind === 'lava' ? '#ff3a00' : '#000000', emissiveIntensity: vis.liquid?.kind === 'lava' ? 0.25 : 0 });
      const mesh = new THREE.Mesh(ng, mat);
      mesh.rotation.z = 0.3;
      mesh.userData.planetId = p.id;
      g.add(mesh);
      this.pickables.push(mesh);
      // atmosfera
      const atmoCol = vis.sky.horizon;
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 24, 16), new THREE.MeshBasicMaterial({ color: atmoCol, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
      g.add(atmo);
      if (p.rings) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.4, R * 2.1, 48), new THREE.MeshBasicMaterial({ color: vis.sky.horizon, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = Math.PI / 2 + 0.4;
        g.add(ring);
      }
      // brilho de território
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 0.25), color: FACTIONS[p.owner].color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.28 }));
      halo.scale.setScalar(R * 9);
      g.add(halo);
      // anel de facção
      const fring = new THREE.Mesh(new THREE.RingGeometry(R * 1.55, R * 1.7, 48), new THREE.MeshBasicMaterial({ color: FACTIONS[p.owner].color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      fring.rotation.x = -Math.PI / 2;
      g.add(fring);
      // anel de invasão
      const inv = new THREE.Mesh(new THREE.RingGeometry(R * 1.9, R * 2.1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a3a').multiplyScalar(2), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      inv.rotation.x = -Math.PI / 2;
      inv.visible = false;
      g.add(inv);
      // seleção
      const sel = new THREE.Mesh(new THREE.TorusGeometry(R * 2.4, 0.08, 4, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb000').multiplyScalar(2), toneMapped: false }));
      sel.rotation.x = Math.PI / 2;
      sel.visible = false;
      g.add(sel);
      this.planets.set(p.id, { def: p, g, mesh, halo, fring, inv, sel, R, spin: 0.05 + Math.random() * 0.15 });
    }
  }

  buildLinks() {
    this.links = [];
    for (const [a, b] of LINKS) {
      const pa = PLANET_MAP[a].pos, pb = PLANET_MAP[b].pos;
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...pa), new THREE.Vector3(...pb)]);
      const mat = new THREE.LineDashedMaterial({ color: '#3a4a6a', dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.7 });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      this.scene.add(line);
      this.links.push({ a, b, line });
    }
  }

  setGalaxy(g) {
    this.galaxy = g;
    for (const [id, pl] of this.planets) {
      const st = g.planets[id];
      if (!st) continue;
      const col = FACTIONS[st.owner].color;
      pl.halo.material.color.set(col);
      pl.fring.material.color.set(col);
      const status = planetStatus(g, id);
      pl.inv.visible = status.kind === 'defense';
      pl.status = status.kind;
      pl.fring.material.opacity = status.kind === 'contested' ? 1 : 0.6;
    }
    for (const L of this.links) {
      const oa = g.planets[L.a]?.owner, ob = g.planets[L.b]?.owner;
      let col = '#3a4a6a', op = 0.5;
      if (oa === 'legion' && ob === 'legion') { col = '#3fb6ff'; op = 0.9; }
      else if (oa === 'legion' || ob === 'legion') { col = '#ffb000'; op = 1; }
      else col = new THREE.Color(FACTIONS[oa].color).multiplyScalar(0.6).getStyle();
      L.line.material.color.set(col);
      L.line.material.opacity = op;
    }
  }

  select(id) {
    if (this.selected) this.planets.get(this.selected).sel.visible = false;
    this.selected = id;
    const pl = this.planets.get(id);
    if (!pl) return;
    pl.sel.visible = true;
    this.targetGoal = pl.g.position.clone();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camGoal = this.targetGoal.clone().addScaledVector(dir, Math.max(30, pl.R * 9));
  }

  pick(clientX, clientY) {
    const v = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length) return hits[0].object.userData.planetId;
    // tolerância: planeta mais próximo na tela
    let best = null, bd = 0.05;
    const p = new THREE.Vector3();
    for (const [id, pl] of this.planets) {
      p.copy(pl.g.position).project(this.camera);
      if (p.z > 1) continue;
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  labels() {
    const out = [];
    const w = window.innerWidth, h = window.innerHeight;
    const p = new THREE.Vector3();
    for (const [id, pl] of this.planets) {
      p.copy(pl.g.position);
      p.y -= pl.R * 1.9;
      p.project(this.camera);
      out.push({ id, x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, visible: p.z < 1, dist: this.camera.position.distanceTo(pl.g.position) });
    }
    return out;
  }

  update(dt) {
    this.time += dt;
    if (this.targetGoal) {
      this.controls.target.lerp(this.targetGoal, Math.min(1, dt * 3));
      if (this.camGoal) this.camera.position.lerp(this.camGoal, Math.min(1, dt * 2.5));
      if (this.controls.target.distanceTo(this.targetGoal) < 0.05) { this.targetGoal = null; this.camGoal = null; }
    }
    this.controls.update();
    for (const pl of this.planets.values()) {
      pl.mesh.rotation.y += dt * pl.spin;
      if (pl.inv.visible) {
        const k = (this.time * 0.8) % 1;
        pl.inv.scale.setScalar(1 + k * 0.6);
        pl.inv.material.opacity = 0.9 * (1 - k);
      }
      if (pl.status === 'contested') pl.fring.rotation.z += dt * 0.5;
      const hov = this.hover === pl.def.id;
      const s = hov ? 1.12 : 1;
      pl.mesh.scale.lerp(new THREE.Vector3(s, s, s), Math.min(1, dt * 10));
      pl.sel.rotation.z += dt * 0.6;
    }
    this.disc.rotation.y += dt * 0.004;
    const sel = this.selected ? this.planets.get(this.selected) : this.planets.get('aurora');
    const a = this.time * 0.35;
    const r = sel.R * 3.4;
    this.ship.position.set(sel.g.position.x + Math.cos(a) * r, sel.g.position.y + 0.6 + Math.sin(a * 2) * 0.3, sel.g.position.z + Math.sin(a) * r);
    this.ship.lookAt(sel.g.position.x + Math.cos(a + 0.1) * r, this.ship.position.y, sel.g.position.z + Math.sin(a + 0.1) * r);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
