// Entidades do mundo: projéteis, coletáveis, torres, zonas, cápsulas, sinalizadores, nave de extração, objetivos
import * as THREE from 'three';
import { glowMat, stdMat, B, S, C } from './models/kit.js';
import { buildWeapon } from './models/units.js';
import {
  buildDropPod, buildShuttle, buildJet, buildTurret, buildBeacon, buildTerminal, buildConsole,
  buildSilo, buildGenerator, buildExtractionPad, buildCache, buildSample, buildAmmoBox,
} from './models/structures.js';
import { CALLINS, CALLIN_CATS } from '../../../shared/data/callins.js';

const GRAV = { grenade: 22, beacon: 22, gl: 18, acid: 14, cannon: 4 };
const _v = new THREE.Vector3();

const SHIELD_VERT = `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHIELD_FRAG = `
uniform float uTime; uniform float uAlpha;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(vN, vV)), 2.5);
  float hex = 0.5 + 0.5 * sin(vN.y * 40.0 + uTime * 2.0) * sin(vN.x * 40.0 - uTime);
  vec3 col = vec3(0.35, 0.8, 1.0) * (0.25 + f * 1.6 + hex * 0.08);
  gl_FragColor = vec4(col * 1.5, (0.12 + f * 0.7) * uAlpha);
}`;

export class Entities {
  constructor(mc) {
    this.mc = mc;
    this.scene = mc.scene;
    this.world = mc.world;
    this.fx = mc.effects;
    this.audio = mc.audio;
    this.projectiles = new Map();
    this.localProj = new Map();
    this.pickups = new Map();
    this.turrets = new Map();
    this.zones = new Map();
    this.pods = [];
    this.beacons = new Map();
    this.timed = [];
    this.pings = [];
    this.pois = {};
    this.shuttle = null;
    this.shuttleState = null;
    this.time = 0;
  }

  ground(x, z) { return this.world.groundAt(x, z); }

  // ------------------------------------------------ objetivos estáticos
  buildPOIs(cfg) {
    const w = this.world;
    const place = (obj, x, z, rot = 0) => {
      obj.position.set(x, this.ground(x, z), z);
      obj.rotation.y = rot;
      this.scene.add(obj);
      return obj;
    };
    const site = w.main[0];
    if (cfg.type === 'uplink') {
      this.pois.terminal = place(buildTerminal(), site.x, site.z, 0.5);
      const ring = new THREE.Mesh(new THREE.RingGeometry(14.6, 15, 64), glowMat('#4fd8ff', 1.4, { transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(site.x, this.ground(site.x, site.z) + 0.3, site.z);
      ring.visible = false;
      this.scene.add(ring);
      this.pois.zoneRing = ring;
    } else if (cfg.type === 'launch') {
      this.pois.silo = place(buildSilo(), site.x, site.z);
      this.pois.consoles = site.consoles.map((c) => place(buildConsole(), c.x, c.z, Math.atan2(site.x - c.x, site.z - c.z)));
    } else if (cfg.type === 'defend') {
      this.pois.generator = place(buildGenerator(), site.x, site.z);
    }
    const ex = w.extraction;
    this.pois.pad = place(buildExtractionPad(), ex.x, ex.z);
    this.pois.extractConsole = place(buildConsole(), ex.consoleX, ex.consoleZ, Math.atan2(ex.x - ex.consoleX, ex.z - ex.consoleZ));
    this.pois.caches = w.caches.map((c, i) => place(buildCache(), c.x, c.z, i * 1.7));
  }

  updatePOIs(objectives, extraction, dt) {
    const main = objectives.find((o) => o.id === 'main');
    if (main) {
      if (main.k === 'launch' && this.pois.consoles) {
        this.pois.consoles.forEach((c, i) => { c.userData.screen.material = glowMat(main.cs && main.cs[i] ? '#4cff8a' : '#ff3b3b', 1.8); });
      }
      if (main.k === 'uplink' && this.pois.zoneRing) {
        this.pois.zoneRing.visible = main.s === 'active';
        this.pois.zoneRing.material.opacity = 0.4 + Math.sin(this.time * 4) * 0.2;
      }
      if (main.k === 'defend' && this.pois.generator) {
        const active = main.s === 'active';
        for (const [i, r] of this.pois.generator.userData.rings.entries()) {
          r.rotation.y += dt * (active ? 2 + i : 0.2);
          r.position.y = 1.4 + i * 1.2 + (active ? Math.sin(this.time * 3 + i) * 0.15 : 0);
        }
      }
    }
    if (this.pois.pad) {
      const st = extraction[0];
      const col = st === 'locked' ? '#ff3b3b' : st === 'available' ? '#ffb000' : '#4cff8a';
      const blink = st === 'called' || st === 'landing' ? (Math.sin(this.time * 8) > 0) : true;
      for (const l of this.pois.pad.userData.lights) { l.material = glowMat(col, 2.5); l.visible = blink; }
      this.pois.extractConsole.userData.screen.material = glowMat(col, 1.8);
    }
  }

  openCache(i) {
    const c = this.pois.caches?.[i];
    if (!c) return;
    c.userData.lid.rotation.x = -1.9;
    c.userData.glow.visible = true;
    this.fx.burst(this.fx.add, 30, c.position.x, c.position.y + 1, c.position.z, { speed: 4, up: 4, color: new THREE.Color('#ffc63a').multiplyScalar(2), s0: 0.4, s1: 0.05, life: 1 });
  }

  missileLaunch() {
    const silo = this.pois.silo;
    if (!silo) return;
    const missile = silo.userData.missile;
    missile.userData.flame.visible = true;
    const start = silo.position.clone();
    let vy = 2;
    this.audio.play('rocket', start, { vol: 2, range: 400 });
    this.timed.push({ t: 0, life: 7, update: (t, dt) => {
      vy += dt * 25;
      missile.position.y += vy * dt;
      const wp = missile.getWorldPosition(_v);
      this.fx.norm.emit(wp.x + (Math.random() - 0.5), wp.y - 1, wp.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, -2, (Math.random() - 0.5) * 3, new THREE.Color('#d8d0c8'), 2, 7, 3.5, -0.5, 0.3, 0.6);
      if (t > 6.8) {
        this.fx.explosion(wp.x, wp.y, wp.z, 30, 'solar');
        missile.visible = false;
      }
    } });
  }

  // ------------------------------------------------ projéteis
  makeProjMesh(kind, c) {
    switch (kind) {
      case 'grenade': {
        const g = new THREE.Group();
        g.add(S(0.12, stdMat('#3d4a2a'), {}, 0));
        g.add(S(0.04, glowMat('#ff3b3b', 3), { y: 0.1 }));
        return g;
      }
      case 'beacon': return buildBeacon(c);
      case 'rocket':
      case 'trocket': {
        const g = new THREE.Group();
        g.add(C(0.07, 0.6, stdMat('#4a5040'), { rx: Math.PI / 2 }, 6));
        g.add(S(0.12, glowMat('#ffb070', 3), { z: -0.35 }));
        return g;
      }
      case 'gl': return S(0.1, stdMat('#3a3a2a'), {}, 0);
      case 'plasma': return S(0.25, glowMat('#c070ff', 3), {}, 0);
      case 'acid': return S(0.3, glowMat('#b6ff3a', 1.8), {}, 0);
      case 'laser': return B(0.09, 0.09, 1.8, glowMat('#ff2a2a', 3.5));
      case 'voidbolt': return S(0.32, glowMat('#c06bff', 2.8), {}, 1);
      case 'cannon': return S(0.38, glowMat('#ff8a2a', 2.8), {}, 0);
      default: return S(0.2, glowMat('#ffffff', 2), {}, 0);
    }
  }

  createProjectile(kind, x, y, z, vx, vy, vz, c, owner) {
    const mesh = this.makeProjMesh(kind, c);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return { kind, mesh, vel: new THREE.Vector3(vx, vy, vz), g: GRAV[kind] || 0, life: 9, rest: false, owner };
  }

  localProjectile(tag, kind, pos, vel, c) {
    const p = this.createProjectile(kind, pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, c, this.mc.myId);
    this.localProj.set(tag, p);
    setTimeout(() => {
      if (this.localProj.get(tag) === p) { this.localProj.delete(tag); this.disposeProj(p); }
    }, 1500);
  }

  spawnProjectile(ev) {
    if (ev.o === this.mc.myId && ev.tag && this.localProj.has(ev.tag)) {
      const p = this.localProj.get(ev.tag);
      this.localProj.delete(ev.tag);
      this.projectiles.set(ev.i, p);
      return;
    }
    const p = this.createProjectile(ev.k, ev.x, ev.y, ev.z, ev.vx, ev.vy, ev.vz, ev.c, ev.o);
    this.projectiles.set(ev.i, p);
    if (ev.o === 'enemy') {
      const snd = { acid: 'acid', laser: 'enemyLaser', voidbolt: 'voidbolt', rocket: 'rocket', cannon: 'rocket' }[ev.k];
      if (snd && this.audio.throttle('ep' + snd, 40)) this.audio.play(snd, { x: ev.x, y: ev.y, z: ev.z }, { range: 90, vol: 0.7 });
      this.fx.muzzle(new THREE.Vector3(ev.x, ev.y, ev.z), new THREE.Vector3(ev.vx, ev.vy, ev.vz).normalize(), ev.k === 'acid' ? '#b6ff3a' : ev.k === 'voidbolt' ? '#c06bff' : '#ff4a2a', 0.8);
    } else if (ev.o !== this.mc.myId && ev.k === 'trocket') {
      this.audio.play('rocket', { x: ev.x, y: ev.y, z: ev.z }, { range: 90, vol: 0.5 });
    }
  }

  removeProjectile(ev) {
    const p = this.projectiles.get(ev.i);
    if (p) {
      this.projectiles.delete(ev.i);
      this.disposeProj(p);
    }
    if (ev.sh) this.fx.impact(ev.x, ev.y, ev.z, 'shield');
    else if (!ev.b && ev.x !== undefined) {
      if (p && p.kind === 'acid') this.fx.explosion(ev.x, ev.y, ev.z, 2, 'acid');
      else if (p && p.kind === 'laser') this.fx.impact(ev.x, ev.y, ev.z, 'blood', '#ff4a2a');
      else this.fx.impact(ev.x, ev.y, ev.z, 'dirt');
    }
  }

  disposeProj(p) {
    this.scene.remove(p.mesh);
  }

  updateProjectiles(dt) {
    const step = (p) => {
      if (p.rest) return;
      p.life -= dt;
      p.vel.y -= p.g * dt;
      const m = p.mesh;
      m.position.addScaledVector(p.vel, dt);
      const gy = this.ground(m.position.x, m.position.z);
      if (m.position.y < gy + 0.08) {
        if (p.kind === 'grenade') {
          m.position.y = gy + 0.08;
          p.vel.y = Math.abs(p.vel.y) * 0.28;
          p.vel.x *= 0.55; p.vel.z *= 0.55;
          if (p.vel.y < 1) p.vel.y = 0;
        } else if (p.kind === 'beacon') {
          m.position.y = gy;
          p.rest = true;
          m.rotation.set(0, 0, 0);
        } else {
          m.position.y = gy + 0.08;
          p.vel.set(0, 0, 0);
        }
      }
      if (p.kind === 'laser' || p.kind === 'rocket' || p.kind === 'trocket') {
        if (p.vel.lengthSq() > 0.01) m.lookAt(m.position.x + p.vel.x, m.position.y + p.vel.y, m.position.z + p.vel.z);
      } else if (p.kind === 'beacon' || p.kind === 'grenade') {
        m.rotation.x += dt * 8;
      }
      const pos = m.position;
      if (p.kind === 'rocket' || p.kind === 'trocket' || p.kind === 'gl') {
        this.fx.norm.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), new THREE.Color('#8a8580'), 0.3, 1.4, 0.9, -0.5, 1, 0.5);
        if (p.kind !== 'gl') this.fx.add.emit(pos.x, pos.y, pos.z, 0, 0, 0, new THREE.Color('#ffb070').multiplyScalar(2), 0.6, 0.1, 0.12, 0, 0, 1);
      } else if (p.kind === 'plasma' || p.kind === 'voidbolt') {
        this.fx.add.emit(pos.x, pos.y, pos.z, 0, 0, 0, new THREE.Color(p.kind === 'plasma' ? '#c070ff' : '#c06bff').multiplyScalar(2), 0.4, 0.05, 0.25, 0, 0, 0.8);
      } else if (p.kind === 'acid') {
        if (Math.random() < 0.5) this.fx.add.emit(pos.x, pos.y, pos.z, 0, -1, 0, new THREE.Color('#b6ff3a').multiplyScalar(1.6), 0.25, 0.05, 0.4, 6, 0, 0.8);
      } else if (p.kind === 'cannon') {
        this.fx.add.emit(pos.x, pos.y, pos.z, 0, 0, 0, new THREE.Color('#ff8a2a').multiplyScalar(2), 0.6, 0.1, 0.3, 0, 0, 0.8);
      } else if (p.kind === 'grenade' && p.mesh.children[1]) {
        p.mesh.children[1].visible = Math.sin(this.time * 20) > 0;
      }
    };
    for (const [id, p] of this.projectiles) {
      step(p);
      if (p.life <= 0) { this.disposeProj(p); this.projectiles.delete(id); }
    }
    for (const p of this.localProj.values()) step(p);
  }

  // ------------------------------------------------ sinalizadores e chamados
  plantBeacon(ev) {
    const p = this.projectiles.get(ev.i);
    if (p) { this.projectiles.delete(ev.i); this.disposeProj(p); }
    const cat = CALLINS[ev.c] ? CALLIN_CATS[CALLINS[ev.c].cat] : CALLIN_CATS.orbital;
    const g = new THREE.Group();
    g.position.set(ev.x, ev.y, ev.z);
    g.add(buildBeacon(ev.c));
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cat.color).multiplyScalar(2.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 120, 6, 1, true), beamMat);
    beam.position.y = 60;
    g.add(beam);
    const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(cat.color).multiplyScalar(2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.1;
    g.add(glowRing);
    this.scene.add(g);
    this.beacons.set(ev.i, { g, beam, ring: glowRing, t: 0, life: (ev.d || 3) + 15, color: cat.color });
    this.audio.play('beacon', ev, { range: 80 });
    if (CALLINS[ev.c]?.cat === 'orbital' || CALLINS[ev.c]?.cat === 'aereo') setTimeout(() => this.audio.play('incoming', ev, { range: 200 }), Math.max(0, (ev.d - 1.4) * 1000));
  }

  removeBeacon(i) {
    const b = this.beacons.get(i);
    if (!b) return;
    this.scene.remove(b.g);
    b.beam.geometry.dispose();
    this.beacons.delete(i);
  }

  spawnPod(ev) {
    const pod = buildDropPod(ev.k);
    const gy = this.ground(ev.x, ev.z);
    pod.position.set(ev.x + 30, gy + 320, ev.z - 20);
    this.scene.add(pod);
    const d = Math.max(0.5, ev.d || 3);
    const start = pod.position.clone();
    const end = new THREE.Vector3(ev.x, gy, ev.z);
    const obj = { pod, t: 0, d, start, end, landed: false, k: ev.k, p: ev.p, sink: 0 };
    this.pods.push(obj);
    this.audio.play('pod', end, { range: 250 });
    return obj;
  }

  updatePods(dt) {
    for (let i = this.pods.length - 1; i >= 0; i--) {
      const o = this.pods[i];
      o.t += dt;
      if (!o.landed) {
        const k = Math.min(1, o.t / o.d);
        const e = k * k;
        o.pod.position.lerpVectors(o.start, o.end, e);
        o.pod.lookAt(o.start);
        o.pod.rotateX(Math.PI / 2);
        o.pod.rotation.set(0, 0, 0);
        const p = o.pod.position;
        this.fx.add.emit(p.x, p.y + 4, p.z, (Math.random() - 0.5) * 2, 6, (Math.random() - 0.5) * 2, new THREE.Color('#ffb070').multiplyScalar(2.2), 1.6, 0.3, 0.3, 0, 0, 1);
        this.fx.norm.emit(p.x, p.y + 5, p.z, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, new THREE.Color('#9a9590'), 1.5, 4, 2.5, -0.3, 0.5, 0.45);
        if (k >= 1) {
          o.landed = true;
          o.pod.userData.flame.visible = false;
          o.pod.position.y = o.end.y - 0.6;
        }
      } else {
        if (o.t > o.d + 14) {
          o.sink += dt;
          o.pod.position.y -= dt * 0.5;
          if (o.sink > 6) { this.scene.remove(o.pod); this.pods.splice(i, 1); }
        }
      }
    }
  }

  flyJet(ev) {
    const jet = buildJet();
    const dir = new THREE.Vector3(ev.dx, 0, ev.dz).normalize();
    const gy = this.ground(ev.x, ev.z);
    const start = new THREE.Vector3(ev.x, gy + 45, ev.z).addScaledVector(dir, -350);
    jet.position.copy(start);
    jet.lookAt(start.clone().add(dir));
    this.scene.add(jet);
    this.audio.play('jet', { x: ev.x, y: gy, z: ev.z }, { range: 300 });
    this.timed.push({ t: 0, life: 6, update: (t, dt) => {
      jet.position.addScaledVector(dir, 130 * dt);
      jet.position.y += t > 3 ? dt * 25 : 0;
    }, end: () => this.scene.remove(jet) });
  }

  // ------------------------------------------------ coletáveis
  addPickup(ev) {
    let m;
    if (ev.k === 'sample') m = buildSample();
    else if (ev.k === 'ammo') m = buildAmmoBox();
    else {
      m = new THREE.Group();
      const wpn = buildWeapon(ev.w);
      wpn.position.y = 1.0;
      wpn.rotation.z = Math.PI / 2;
      m.add(wpn);
      m.userData.spin = wpn;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fb8ff').multiplyScalar(2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      m.add(ring);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fb8ff').multiplyScalar(1.5), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      col.position.y = 3;
      m.add(col);
    }
    m.position.set(ev.x, ev.y, ev.z);
    this.scene.add(m);
    this.pickups.set(ev.i, { id: ev.i, k: ev.k, w: ev.w, n: ev.n, m, x: ev.x, y: ev.y, z: ev.z });
  }

  removePickup(i) {
    const p = this.pickups.get(i);
    if (!p) return;
    this.scene.remove(p.m);
    this.pickups.delete(i);
  }

  // ------------------------------------------------ torres
  syncTurrets(list) {
    const seen = new Set();
    for (const [id, kind, x, y, z, rot, ammo] of list) {
      seen.add(id);
      let t = this.turrets.get(id);
      if (!t) {
        const m = buildTurret(kind);
        m.position.set(x, y, z);
        this.scene.add(m);
        t = { id, kind, m, rot, target: rot, ammo };
        this.turrets.set(id, t);
      }
      t.target = rot;
      t.ammo = ammo;
    }
    for (const [id, t] of this.turrets) {
      if (!seen.has(id)) { this.scene.remove(t.m); this.turrets.delete(id); }
    }
  }

  turretShot(ev) {
    const t = this.turrets.get(ev.i);
    if (!t) return;
    const muzzle = t.m.userData.muzzle.getWorldPosition(new THREE.Vector3());
    if (ev.r) {
      this.fx.muzzle(muzzle, new THREE.Vector3(0, 0, 1), '#ffb070', 1.5);
      return;
    }
    const to = new THREE.Vector3(ev.x, ev.y, ev.z);
    this.fx.tracer(muzzle, to, '#ffe08a', 0.06);
    this.fx.muzzle(muzzle, to.clone().sub(muzzle).normalize(), '#ffd27a', 0.8);
    this.fx.impact(ev.x, ev.y, ev.z, 'blood', '#ffd27a');
    if (this.audio.throttle('turret' + ev.i, 60)) this.audio.play('mg', muzzle, { range: 110, vol: 0.6 });
  }

  // ------------------------------------------------ zonas (escudo, fogo, laser, minas)
  syncZones(list) {
    const seen = new Set();
    for (const [id, kind, x, z, r, life] of list) {
      seen.add(id);
      let zn = this.zones.get(id);
      const gy = this.ground(x, z);
      if (!zn) {
        zn = { id, kind, x, z, r, obj: null };
        if (kind === 'shield') {
          const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } }, vertexShader: SHIELD_VERT, fragmentShader: SHIELD_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
          zn.obj = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), mat);
          zn.obj.position.set(x, gy, z);
          this.fx.flash(x, gy + 3, z, '#7fd8ff', 30, 20, 0.5);
        } else if (kind === 'laser') {
          const g = new THREE.Group();
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 600, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a2a').multiplyScalar(3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
          beam.position.y = 300;
          const core = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 600, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d0').multiplyScalar(3), toneMapped: false }));
          core.position.y = 300;
          g.add(beam, core);
          zn.obj = g;
          zn.beam = beam;
        } else if (kind === 'mine') {
          zn.obj = new THREE.Group();
          zn.obj.add(C(0.25, 0.1, stdMat('#2a2d33', { metal: 0.6 }), { y: 0.05 }, 8));
          zn.obj.add(S(0.06, glowMat('#ff3b3b', 3), { y: 0.14 }));
          zn.obj.position.set(x, gy, z);
        }
        if (zn.obj) this.scene.add(zn.obj);
        this.zones.set(id, zn);
      }
      zn.x = x; zn.z = z; zn.life = life;
      if (kind === 'laser' && zn.obj) {
        zn.obj.position.x += (x - zn.obj.position.x) * 0.3;
        zn.obj.position.z += (z - zn.obj.position.z) * 0.3;
        zn.obj.position.y = this.ground(zn.obj.position.x, zn.obj.position.z);
      }
      if (kind === 'shield' && zn.obj) zn.obj.material.uniforms.uAlpha.value = Math.min(1, life * 6);
    }
    for (const [id, zn] of this.zones) {
      if (!seen.has(id)) {
        if (zn.obj) this.scene.remove(zn.obj);
        this.zones.delete(id);
      }
    }
  }

  updateZones(dt) {
    for (const zn of this.zones.values()) {
      if (zn.kind === 'fire') {
        this.fx.fireZone(zn.x, zn.z, zn.r);
      } else if (zn.kind === 'laser' && zn.obj) {
        const p = zn.obj.position;
        zn.beam.scale.x = zn.beam.scale.z = 1 + Math.sin(this.time * 40) * 0.25;
        this.fx.burst(this.fx.add, 3, p.x, p.y + 0.5, p.z, { speed: 8, up: 4, color: new THREE.Color('#ffb070').multiplyScalar(2.5), s0: 0.4, s1: 0.05, life: 0.4, grav: 10 });
        if (Math.random() < 0.3) this.fx.norm.emit(p.x, p.y + 1, p.z, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, new THREE.Color('#3a3430'), 1.5, 4, 1.8, -0.5, 1, 0.5);
        if (Math.random() < 0.08) this.fx.decal(p.x, p.z, 2.2);
        if (Math.random() < 0.15) this.fx.flash(p.x, p.y + 2, p.z, '#ff4a2a', 40, 25, 0.15);
        if (this.audio.throttle('laserz', 450)) this.audio.play('laserOrbital', p, { range: 200, vol: 0.8 });
      } else if (zn.kind === 'shield' && zn.obj) {
        zn.obj.material.uniforms.uTime.value = this.time;
      } else if (zn.kind === 'mine' && zn.obj) {
        zn.obj.children[1].visible = Math.sin(this.time * 6 + zn.id) > 0;
      }
    }
  }

  // ------------------------------------------------ extração
  setExtraction(state) {
    const pad = this.pois.pad;
    if (!pad) return;
    if (state === this.shuttleState) return;
    const prev = this.shuttleState;
    this.shuttleState = state;
    if (state === 'landing' || ((state === 'boarding' || state === 'departing') && !this.shuttle)) {
      if (!this.shuttle) {
        this.shuttle = buildShuttle();
        this.scene.add(this.shuttle);
      }
      const end = pad.position.clone().add(new THREE.Vector3(0, 0.4, 0));
      const start = end.clone().add(new THREE.Vector3(-120, 160, -80));
      if (state === 'landing') {
        this.shuttle.position.copy(start);
        this.audio.play('jet', end, { range: 300 });
        this.shuttleAnim = { kind: 'land', t: 0, d: 6, start, end };
      } else {
        this.shuttle.position.copy(end);
        this.shuttleAnim = null;
      }
      this.shuttle.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
    }
    if (state === 'departing' && this.shuttle) {
      const start = this.shuttle.position.clone();
      this.shuttleAnim = { kind: 'leave', t: 0, d: 6, start };
      this.audio.play('jet', start, { range: 300 });
    }
  }

  updateShuttle(dt) {
    const a = this.shuttleAnim;
    if (!a || !this.shuttle) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.d);
    if (a.kind === 'land') {
      const e = 1 - Math.pow(1 - k, 3);
      this.shuttle.position.lerpVectors(a.start, a.end, e);
    } else {
      const e = k * k;
      this.shuttle.position.set(a.start.x + e * 60, a.start.y + e * 220, a.start.z + e * 120);
    }
    for (const f of this.shuttle.userData.flames || []) f.scale.y = 0.8 + Math.random() * 0.4;
    const p = this.shuttle.position;
    if (p.y - this.ground(p.x, p.z) < 15) this.fx.norm.emit(p.x + (Math.random() - 0.5) * 10, this.ground(p.x, p.z) + 0.5, p.z + (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14, 1, (Math.random() - 0.5) * 14, new THREE.Color('#9a9590'), 1.5, 4, 1.4, 0, 2, 0.4);
  }

  ping(x, z, color = '#ffb000') {
    const gy = this.ground(x, z);
    const m = new THREE.Group();
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), glowMat(color, 2.5));
    dia.position.y = 3;
    m.add(dia);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 4), glowMat(color, 2));
    beam.position.y = 1.5;
    m.add(beam);
    m.position.set(x, gy, z);
    this.scene.add(m);
    const obj = { x, z, m, t: 0, color };
    this.pings.push(obj);
    if (this.pings.length > 6) { const o = this.pings.shift(); this.scene.remove(o.m); }
  }

  update(dt) {
    this.time += dt;
    this.updateProjectiles(dt);
    this.updatePods(dt);
    this.updateZones(dt);
    this.updateShuttle(dt);
    for (const t of this.turrets.values()) {
      const h = t.m.userData.head;
      let d = t.target - h.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      h.rotation.y += d * Math.min(1, dt * 10);
    }
    for (const [id, b] of this.beacons) {
      b.t += dt;
      b.beam.material.opacity = 0.35 + Math.sin(b.t * 10) * 0.2;
      b.ring.scale.setScalar(1 + (b.t * 1.5) % 1.5);
      if (b.t > b.life) this.removeBeacon(id);
    }
    for (const p of this.pickups.values()) {
      if (p.m.userData.spin) p.m.userData.spin.rotation.y += dt * 1.5;
      if (p.k === 'sample') p.m.rotation.y += dt;
    }
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const pg = this.pings[i];
      pg.t += dt;
      pg.m.children[0].rotation.y += dt * 3;
      pg.m.children[0].position.y = 3 + Math.sin(pg.t * 3) * 0.3;
      if (pg.t > 10) { this.scene.remove(pg.m); this.pings.splice(i, 1); }
    }
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const e = this.timed[i];
      e.t += dt;
      e.update(e.t, dt);
      if (e.t >= e.life) { if (e.end) e.end(); this.timed.splice(i, 1); }
    }
  }
}
