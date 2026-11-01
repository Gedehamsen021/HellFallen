// Visual dos inimigos: interpolação, animação procedural, mira (raycast) e morte
import * as THREE from 'three';
import { ENEMIES, ENEMY_LIST } from '../../../shared/data/enemies.js';
import { FACTIONS } from '../../../shared/data/factions.js';
import { buildEnemy } from './models/units.js';

const _v = new THREE.Vector3();

export class EnemyManager {
  constructor(scene, world, effects, audio) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.audio = audio;
    this.map = new Map();
    this.renderTime = 0;
  }

  create(id, ti, x, y, z, rot) {
    const type = ENEMY_LIST[ti];
    const def = ENEMIES[type];
    const { root, parts } = buildEnemy(type);
    root.position.set(x, y, z);
    root.rotation.y = rot;
    this.scene.add(root);
    const e = {
      id, type, def, root, parts, samples: [], hp: 1, sc: 0,
      x, y, z, rot, px: x, pz: z, phase: Math.random() * 10, moveAmt: 0, t: Math.random() * 10,
      dead: false, deadT: 0, flashT: 0, atkT: 0, blood: FACTIONS[def.faction]?.blood || '#ffb347',
      spawnT: 0,
    };
    if (!def.structure) {
      root.scale.setScalar(0.01);
      e.spawnT = 0.001;
    }
    this.map.set(id, e);
    return e;
  }

  applySnapshot(list, t) {
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const [id, ti, x, y, z, rot, hpb, sc] = list[i];
      seen.add(id);
      let e = this.map.get(id);
      if (!e) e = this.create(id, ti, x, y, z, rot);
      if (e.dead) continue;
      e.samples.push({ t, x, y, z, rot });
      if (e.samples.length > 10) e.samples.shift();
      e.hp = hpb / 255;
      e.sc = sc;
    }
    for (const [id, e] of this.map) {
      if (!seen.has(id) && !e.dead) this.remove(e);
    }
  }

  remove(e) {
    this.scene.remove(e.root);
    this.map.delete(e.id);
  }

  kill(id, ev) {
    const e = this.map.get(id);
    if (!e) {
      if (ev) {
        const def = ENEMIES[ENEMY_LIST[ev.t]];
        if (def) this.effects.gore(ev.x, ev.y + 1, ev.z, FACTIONS[def.faction]?.blood || '#fff', def.heavy ? 2 : 1);
      }
      return;
    }
    e.dead = true;
    e.deadT = 0;
    const big = e.def.structure ? 3 : e.def.heavy ? 2 : 1;
    const hy = e.def.hit[0].y;
    this.effects.gore(e.x, e.y + hy, e.z, e.blood, big);
    if (e.def.faction === 'ferro') this.effects.burst(this.effects.add, 12 * big, e.x, e.y + hy, e.z, { speed: 9, up: 4, color: new THREE.Color('#ffd27a').multiplyScalar(2.4), s0: 0.2, s1: 0.04, life: 0.7, grav: 18 });
    e.fallDir = Math.random() < 0.5 ? -1 : 1;
  }

  flash(id) {
    const e = this.map.get(id);
    if (e) e.flashT = 0.08;
  }

  attack(id, kind) {
    const e = this.map.get(id);
    if (!e) return;
    e.atkT = kind === 'roar' ? 0.9 : kind === 'slam' ? 0.8 : 0.45;
    e.atkKind = kind;
    if (Math.random() < 0.5 || kind) {
      const f = e.def.faction;
      this.audio.play(f === 'vorr' ? 'screech' : f === 'ferro' ? 'robot' : 'whisper', { x: e.x, y: e.y, z: e.z }, { range: 60, vol: kind ? 1 : 0.6 });
    }
  }

  teleport(id, x, z) {
    const e = this.map.get(id);
    if (!e) return;
    e.samples = [];
    e.x = x; e.z = z;
    e.root.position.x = x; e.root.position.z = z;
  }

  sample(e) {
    const s = e.samples;
    if (!s.length) return;
    const rt = this.renderTime;
    if (s.length === 1 || rt <= s[0].t) {
      const a = s[0];
      e.x = a.x; e.y = a.y; e.z = a.z; e.rot = a.rot;
      return;
    }
    for (let i = s.length - 1; i >= 1; i--) {
      const a = s[i - 1], b = s[i];
      if (rt >= a.t) {
        if (rt > b.t) {
          const ex = Math.min(0.15, rt - b.t);
          const dt = b.t - a.t || 0.1;
          e.x = b.x + (b.x - a.x) / dt * ex;
          e.z = b.z + (b.z - a.z) / dt * ex;
          e.y = b.y;
          e.rot = b.rot;
          return;
        }
        const k = (rt - a.t) / ((b.t - a.t) || 1);
        e.x = a.x + (b.x - a.x) * k;
        e.y = a.y + (b.y - a.y) * k;
        e.z = a.z + (b.z - a.z) * k;
        let dr = b.rot - a.rot;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        e.rot = a.rot + dr * k;
        return;
      }
    }
  }

  update(dt, renderTime, camPos) {
    this.renderTime = renderTime;
    for (const e of [...this.map.values()]) {
      if (e.dead) {
        e.deadT += dt;
        const k = Math.min(1, e.deadT * 2.5);
        if (e.def.structure) {
          e.root.position.y = e.y - e.deadT * 1.5;
          e.root.rotation.z = Math.sin(e.deadT * 30) * 0.02;
        } else if (e.def.fly) {
          e.root.position.y = Math.max(this.world.groundAt(e.x, e.z), e.root.position.y - dt * 12);
          e.root.rotation.z += dt * 6;
        } else {
          e.root.rotation.z = k * 1.4 * e.fallDir;
          e.root.position.y = e.y - Math.max(0, e.deadT - 1.2) * 0.8;
        }
        if (e.deadT > (e.def.structure ? 3 : 2.5)) this.remove(e);
        continue;
      }
      this.sample(e);
      const moved = Math.hypot(e.x - e.px, e.z - e.pz);
      const spd = dt > 0 ? moved / dt : 0;
      e.px = e.x; e.pz = e.z;
      e.moveAmt += (Math.min(1.2, spd / Math.max(1, (e.def.speed || 4) * 0.8)) - e.moveAmt) * Math.min(1, dt * 8);
      e.t += dt;
      e.root.position.set(e.x, e.y, e.z);
      e.root.rotation.y = e.rot;
      if (e.spawnT > 0) {
        e.spawnT += dt;
        const k = Math.min(1, e.spawnT * 3);
        e.root.scale.setScalar(k);
        if (k >= 1) e.spawnT = 0;
      }
      // culling por distância para animação
      const far = camPos && (Math.abs(e.x - camPos.x) > 160 || Math.abs(e.z - camPos.z) > 160);
      if (!far) this.animate(e, dt, spd);
      if (e.flashT > 0) {
        e.flashT -= dt;
        const f = Math.max(0, e.flashT / 0.08);
        for (const m of e.parts.glowMats) m.emissive.setRGB(f * 0.9, f * 0.9, f * 0.9);
      }
      e.atkT = Math.max(0, e.atkT - dt);
    }
  }

  animate(e, dt, spd) {
    const p = e.parts;
    const mv = e.moveAmt;
    e.phase += dt * (p.gait || 8) * Math.max(0.15, mv);
    for (const s of p.spin) s.rotation.y += dt * 20;
    switch (p.anim) {
      case 'insect': {
        for (const L of p.legs) {
          const ph = e.phase + L.phase;
          L.hip.rotation.y = Math.sin(ph) * 0.45 * mv;
          L.hip.rotation.z = L.baseZ + Math.max(0, Math.cos(ph)) * 0.25 * L.side * mv;
        }
        if (p.body) {
          p.body.position.y = (p.body.userData.baseY ??= p.body.position.y) + Math.abs(Math.sin(e.phase * 2)) * 0.05 * mv;
          p.body.rotation.x = e.sc === 5 ? -0.15 : e.sc === 3 ? 0.12 : 0;
        }
        if (p.head) {
          const base = (p.head.userData.baseZ ??= p.head.position.z);
          const lunge = e.atkT > 0 ? Math.sin((1 - e.atkT / 0.45) * Math.PI) * 0.35 : 0;
          p.head.position.z = base + lunge * (e.def.radius || 1);
          p.head.rotation.x = Math.sin(e.t * 9) * 0.05;
        }
        for (const A of p.arms) {
          const swing = e.atkT > 0 ? Math.sin((1 - e.atkT / 0.45) * Math.PI) : 0;
          A.arm.rotation.x = A.baseX - swing * 1.4 + Math.sin(e.t * 3 + A.side) * 0.08;
          if (A.fore) A.fore.rotation.x = A.baseF + swing * 0.6;
        }
        for (const pl of p.pulse) pl.scale.setScalar(1 + Math.sin(e.t * 4) * 0.06);
        break;
      }
      case 'biped': {
        const sw = Math.sin(e.phase);
        for (const L of p.legs) {
          L.leg.rotation.x = sw * 0.6 * mv * L.side;
          L.shin.rotation.x = Math.max(0, -sw * L.side) * 0.9 * mv;
        }
        if (p.hips) p.hips.position.y = (p.hips.userData.baseY ??= p.hips.position.y) + Math.abs(Math.cos(e.phase)) * 0.05 * mv;
        if (p.body) p.body.rotation.z = Math.sin(e.phase) * 0.04 * mv;
        if (p.head) p.head.rotation.y = Math.sin(e.t * 0.7) * 0.3;
        if (e.sc === 4 && p.body) p.body.rotation.x = -0.06;
        else if (p.body) p.body.rotation.x = 0;
        break;
      }
      case 'flyer': {
        if (p.body) {
          p.body.rotation.x = Math.min(0.4, e.moveAmt * 0.35);
          p.body.rotation.z = Math.sin(e.t * 2) * 0.1;
        }
        break;
      }
      case 'hover': {
        if (p.body) {
          p.body.position.y = Math.sin(e.t * 2.2) * 0.12;
          p.body.rotation.x = e.moveAmt * 0.2 + (e.atkT > 0 ? -0.3 : 0);
        }
        if (p.orbit) p.orbit.rotation.y += dt * 2.5;
        for (const A of p.arms) {
          A.arm.rotation.x = (A.baseX || 0) + Math.sin(e.t * 2 + A.side) * 0.15 - (e.atkT > 0 ? Math.sin((1 - e.atkT / 0.45) * Math.PI) * 1.2 : 0);
        }
        if (p.tentacles) {
          for (let ti = 0; ti < p.tentacles.length; ti++) {
            const segs = p.tentacles[ti];
            for (let i = 0; i < segs.length; i++) segs[i].rotation.x = Math.sin(e.t * 2 + i * 0.7 + ti) * 0.35;
          }
        }
        for (const pl of p.pulse) pl.scale.setScalar(1 + Math.sin(e.t * 5) * 0.15);
        break;
      }
      case 'structure': {
        for (const pl of p.pulse) pl.scale.setScalar(1 + Math.sin(e.t * 2.5) * 0.08);
        for (const s of p.spin) s.rotation.z += dt * 0.8;
        break;
      }
    }
  }

  structurePulse(id) {
    const e = this.map.get(id);
    if (!e) return;
    this.effects.burst(this.effects.add, 20, e.x, e.y + 2, e.z, { speed: 4, up: 3, color: new THREE.Color(e.blood).multiplyScalar(2), s0: 0.5, s1: 0.1, life: 0.8 });
  }

  // Raio contra as esferas de colisão de todos os inimigos
  raycast(o, d, maxDist, skip = null) {
    let best = null;
    let bestT = maxDist;
    for (const e of this.map.values()) {
      if (e.dead || (skip && skip.has(e.id))) continue;
      const dx0 = e.x - o.x, dz0 = e.z - o.z;
      const reach = e.def.radius * 3 + 6;
      // descarte rápido
      const proj = dx0 * d.x + dz0 * d.z;
      if (proj < -reach) continue;
      const sn = Math.sin(e.rot), cs = Math.cos(e.rot);
      for (const h of e.def.hit) {
        const cx = e.x + sn * h.z, cy = e.y + h.y, cz = e.z + cs * h.z;
        const lx = cx - o.x, ly = cy - o.y, lz = cz - o.z;
        const tca = lx * d.x + ly * d.y + lz * d.z;
        if (tca < 0) continue;
        const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
        const r2 = h.r * h.r;
        if (d2 > r2) continue;
        const t = tca - Math.sqrt(r2 - d2);
        if (t < bestT && t > 0) {
          bestT = t;
          best = { enemy: e, t, weak: !!h.weak };
        }
      }
    }
    return best;
  }

  inCone(o, d, range, cosA) {
    const out = [];
    for (const e of this.map.values()) {
      if (e.dead) continue;
      const cy = e.y + e.def.hit[0].y;
      const lx = e.x - o.x, ly = cy - o.y, lz = e.z - o.z;
      const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (dist > range + e.def.radius) continue;
      const c = (lx * d.x + ly * d.y + lz * d.z) / (dist || 1);
      if (c >= cosA || dist < e.def.radius + 1) out.push({ enemy: e, dist, point: _v.set(e.x, cy, e.z).clone() });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  nearest(x, y, z, range, exclude) {
    let best = null, bd = range;
    for (const e of this.map.values()) {
      if (e.dead || exclude.has(e.id)) continue;
      const d = Math.hypot(e.x - x, e.y + e.def.hit[0].y - y, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  bosses() {
    const out = [];
    for (const e of this.map.values()) if (!e.dead && e.def.boss) out.push(e);
    return out;
  }

  dispose() {
    for (const e of this.map.values()) this.scene.remove(e.root);
    this.map.clear();
  }
}
