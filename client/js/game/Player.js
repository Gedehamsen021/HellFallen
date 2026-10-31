// Jogador local: movimento, câmera em terceira pessoa, armas, granadas, chamados, dano
import * as THREE from 'three';
import { WEAPONS, GRENADES, WEAPON_INDEX } from '../../../shared/data/weapons.js';
import { CALLINS } from '../../../shared/data/callins.js';
import { ENEMIES } from '../../../shared/data/enemies.js';
import { PLAY_LIMIT } from '../../../shared/world.js';
import { Avatar, ANIM } from './Avatar.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;
const SOUND = { ar7: 'rifle', sg12: 'shotgun', smg9: 'smg', dmr4: 'sniper', pl2: 'plasma', arc3: 'arc', lb1: null, p19: 'pistol', r6: 'revolver', mp5: 'smg', mg43: 'mg', rl8: 'rocket', rg1: 'rail', fl3: null, gl6: 'gl' };
const TRACER = { pl2: null, arc3: null, lb1: null, rg1: '#7fd8ff', fl3: null };

export class Player {
  constructor(mc, profile) {
    this.mc = mc;
    this.world = mc.world;
    this.input = mc.input;
    this.audio = mc.audio;
    this.fx = mc.effects;
    this.profile = profile;
    const d = profile.derived();
    this.d = d;
    this.mods = d.mods;
    this.settings = profile.data.settings;
    this.look = profile.look();
    this.avatar = new Avatar(mc.scene, this.look, profile.data.name);
    this.avatar.setVisible(false);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.05;
    this.maxHp = d.maxHp;
    this.hp = d.maxHp;
    this.maxStamina = 100 * (1 + (this.mods.stamina || 0));
    this.stamina = this.maxStamina;
    this.alive = false;
    this.onGround = true;
    this.maxStims = d.stims;
    this.stims = d.stims;
    this.maxGrenades = d.grenades;
    this.grenades = d.grenades;
    this.grenadeType = profile.data.loadout.grenade;
    this.callins = profile.data.loadout.callins.filter((id) => CALLINS[id]).map((id) => ({ id, def: CALLINS[id], cd: 0, max: CALLINS[id].cooldown * d.cooldownMult }));
    this.slots = [this.makeWeapon(profile.data.loadout.primary), this.makeWeapon(profile.data.loadout.secondary), null];
    this.cur = 0;
    this.aimBlend = 0;
    this.aiming = false;
    this.sprinting = false;
    this.fireCd = 0;
    this.reloadT = 0;
    this.switchT = 0;
    this.bloom = 0;
    this.nadeCd = 0;
    this.lastHitT = 99;
    this.lastStandUsed = false;
    this.cheatCd = 0;
    this.feverT = 0;
    this.invulnT = 0;
    this.stateT = 0;
    this.tagSeq = 1;
    this.beamAcc = new Map();
    this.beamT = 0;
    this.firing = false;
    this.shotRelay = 0;
    this.camDir = new THREE.Vector3(0, 0, 1);
    this.camRight = new THREE.Vector3(-1, 0, 0);
    this.shake = 0;
    this.deathT = 0;
    this.stats = { shots: 0, hits: 0 };
    this.moveF = 0;
    this.moveR = 0;
    this.beamMesh = null;
    this.podRide = null;
    this.onboard = false;
    this.inLava = 0;
    this.baseFov = this.settings.fov || 72;
    this.camDistNow = 4;
  }

  makeWeapon(id) {
    const W = WEAPONS[id];
    if (!W) return null;
    const energy = !!W.energy;
    return {
      id, W,
      mag: energy ? 0 : W.type === 'flame' ? W.fuel : W.mag,
      mags: energy ? 0 : (W.mags || 0) + (W.slot !== 'support' ? this.d.mags : Math.floor(this.d.mags / 2)),
      heat: 0, overheated: false, charge: 0,
    };
  }

  get weapon() { return this.slots[this.cur]; }

  // ------------------------------------------------------------ ciclo de vida
  spawn(x, y, z) {
    this.alive = true;
    const ox = x + Math.sin(this.yaw) * 1.2 + Math.cos(this.yaw) * 2.6, oz = z + Math.cos(this.yaw) * 1.2 - Math.sin(this.yaw) * 2.6;
    const pp = { x: ox, z: oz };
    this.world.collide(pp, 0.45);
    this.pos.set(pp.x, this.world.groundAt(pp.x, pp.z), pp.z);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.stims = this.maxStims;
    this.grenades = this.maxGrenades;
    this.slots[0] = this.makeWeapon(this.profile.data.loadout.primary);
    this.slots[1] = this.makeWeapon(this.profile.data.loadout.secondary);
    if (!this.slots[this.cur]) this.cur = 0;
    this.lastStandUsed = false;
    this.avatar.setDead(false);
    this.avatar.setVisible(true);
    this.invulnT = 1.5;
    this.podRide = null;
    this.mc.hud.setDead(false);
    this.shake = 0.6;
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.deathT = 0;
    this.avatar.setDead(true);
    const sw = this.slots[2] ? this.slots[2].id : null;
    this.slots[2] = null;
    if (this.cur === 2) this.cur = 0;
    this.mc.send('died', { sw });
    this.mc.hud.setDead(true);
    this.setBeam(false);
    this.audio.loop('flame', false);
    this.audio.loop('beam', false);
  }

  takeDamage(d, kind, fx, fz) {
    if (!this.alive || this.invulnT > 0 || this.onboard) return;
    let dmg = d * (1 - this.d.dr);
    if (kind === 'x') dmg *= 1 - (this.mods.blastResist || 0);
    this.hp -= dmg;
    this.lastHitT = 0;
    this.mc.hud.damage(dmg, fx, fz, this.pos, this.yaw);
    this.shake = Math.min(1, this.shake + Math.min(0.6, dmg / 60));
    if (this.audio.throttle('hurt', 120)) this.audio.play('hurt', null, { vol: 0.7 });
    if (kind === 'c' && fx !== undefined) {
      const dx = this.pos.x - fx, dz = this.pos.z - fz, l = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / l) * 12;
      this.vel.z += (dz / l) * 12;
      this.vel.y = 5;
      this.onGround = false;
    }
    if (this.hp <= 0) {
      if (this.mods.lastStand && !this.lastStandUsed) {
        this.hp = 1; this.lastStandUsed = true; this.invulnT = 2;
        this.mc.hud.message('ÚLTIMO SUSPIRO!', 'warn');
      } else if (this.mods.cheatDeath && this.cheatCd <= 0) {
        this.hp = 1; this.cheatCd = this.mods.cheatDeath; this.invulnT = 1.5;
        this.mc.hud.message('BASTIÃO VIVO: você se recusa a cair!', 'warn');
      } else {
        this.hp = 0;
        this.die();
      }
    }
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  onKill(def) {
    if (this.mods.killHeal) this.heal(this.mods.killHeal);
    if (this.mods.killFireRate) this.feverT = 4;
    if (this.mods.heavyNade && def && def.heavy) this.grenades = Math.min(this.maxGrenades, this.grenades + 1);
  }

  applyPickup(k, w, n) {
    if (k === 'ammo') {
      for (const s of this.slots) {
        if (!s) continue;
        const W = s.W;
        if (W.energy) { s.heat = 0; s.overheated = false; continue; }
        const maxMags = (W.mags || 0) + (W.slot !== 'support' ? this.d.mags : Math.floor(this.d.mags / 2));
        s.mags = Math.min(maxMags, s.mags + Math.ceil(maxMags * 0.6));
      }
      this.grenades = Math.min(this.maxGrenades, this.grenades + 2);
      this.stims = Math.min(this.maxStims, this.stims + 2);
      this.mc.hud.message('Munição reabastecida', 'info');
      this.audio.play('pickup');
    } else if (k === 'weapon' && WEAPONS[w]) {
      this.slots[2] = this.makeWeapon(w);
      this.switchTo(2);
      this.mc.hud.message(`Arma de suporte: ${WEAPONS[w].name}`, 'good');
      this.audio.play('pickup');
    } else if (k === 'sample') {
      this.mc.hud.message(`+${n || 1} amostra${(n || 1) > 1 ? 's' : ''}`, 'good');
      this.audio.play('pickup');
    }
  }

  switchTo(i) {
    if (!this.slots[i] || i === this.cur) return;
    this.cur = i;
    this.switchT = 0.35;
    this.reloadT = 0;
    this.setBeam(false);
    this.audio.loop('flame', false);
    this.audio.loop('beam', false);
    this.audio.play('reload', null, { vol: 0.4 });
  }

  startReload() {
    const s = this.weapon;
    if (!s || this.reloadT > 0 || s.W.energy) return;
    const full = s.W.type === 'flame' ? s.W.fuel : s.W.mag;
    if (s.mags <= 0 || s.mag >= full) return;
    this.reloadT = s.W.reload / this.d.reloadMult;
    this.audio.play('reload', null, { vol: 0.6 });
  }

  // ------------------------------------------------------------ mira
  aimTrace(maxDist, spreadRad = 0) {
    const cam = this.mc.camera;
    const dir = this.camDir.clone();
    if (spreadRad > 0) {
      const a = Math.random() * Math.PI * 2, r = spreadRad * Math.sqrt(Math.random());
      const up = _v2.copy(this.camRight).cross(dir).normalize();
      dir.addScaledVector(this.camRight, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    }
    const startOff = this.camDistNow * 0.9;
    const o = cam.position.clone().addScaledVector(dir, startOff);
    const hit = this.mc.enemies.raycast(o, dir, maxDist);
    const tT = this.world.terrainRay(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxDist);
    const tO = this.world.rayObstacles(o.x, o.y, o.z, dir.x, dir.y, dir.z, maxDist);
    let t = Math.min(tT, tO, maxDist);
    let enemy = null, weak = false;
    if (hit && hit.t <= t) { t = hit.t; enemy = hit.enemy; weak = hit.weak; }
    const point = o.clone().addScaledVector(dir, t);
    return { point, enemy, weak, t: t + startOff, dir, solid: t < maxDist };
  }

  dmgFor(W, def, weak, dist, base) {
    let d = base ?? W.dmg;
    d *= 1 + (this.mods.dmg || 0);
    if (weak) d *= 1.5 * (1 + (this.mods.weakDmg || 0));
    if (def && (def.heavy || def.structure)) d *= 1 + (this.mods.heavyDmg || 0);
    if (W.explosive || W.type === 'flame') d *= 1 + (this.mods.explosive || 0);
    if (dist > W.range) d *= Math.max(0.4, 1 - (dist - W.range) / W.range);
    return d;
  }

  sendHit(enemy, dmg, weak, pen, kind = 'b') {
    this.mc.send('hit', { e: enemy.id, d: Math.round(dmg), pen, wk: weak ? 1 : 0, k: kind });
    this.mc.enemies.flash(enemy.id);
    this.mc.hud.hitmarker(weak);
    this.stats.hits++;
    if (this.audio.throttle('hit', 50)) this.audio.play(weak ? 'weak' : 'hit', null, { vol: 0.8 });
  }

  // ------------------------------------------------------------ tiro
  fire(dt) {
    const s = this.weapon;
    if (!s) return;
    const W = s.W;
    const muzzle = this.avatar.muzzleWorld(new THREE.Vector3());
    const steady = this.aiming ? 1 - (this.mods.aimSteady || 0) : 1;
    const spreadDeg = (this.aiming ? W.aimSpread : W.spread) * steady + this.bloom;
    const fever = this.feverT > 0 ? 1 + (this.mods.killFireRate || 0) : 1;

    if (W.type === 'beam' || W.type === 'flame') {
      if (W.type === 'flame') {
        if (s.mag <= 0) { this.firing = false; this.audio.loop('flame', false); this.startReload(); return; }
        s.mag = Math.max(0, s.mag - W.fuelPerSec * dt);
        const dir = this.aimTrace(W.range).point.sub(muzzle).normalize();
        this.fx.flame(muzzle, dir);
        for (const h of this.mc.enemies.inCone(muzzle, dir, W.range, Math.cos(20 * DEG))) {
          const dmg = this.dmgFor(W, h.enemy.def, false, h.dist, W.dmg * dt);
          this.beamAcc.set(h.enemy.id, (this.beamAcc.get(h.enemy.id) || 0) + dmg);
        }
        this.audio.loop('flame', true, { freq: 700, vol: 0.35, type: 'lowpass' });
      } else {
        if (s.overheated) { this.firing = false; this.setBeam(false); return; }
        s.heat += W.heatPerSec * dt;
        if (s.heat >= 100) { s.heat = 100; s.overheated = true; this.audio.play('empty'); }
        const tr = this.aimTrace(W.range);
        this.setBeam(true, muzzle, tr.point);
        if (tr.enemy) {
          const dmg = this.dmgFor(W, tr.enemy.def, tr.weak, tr.t, W.dmg * dt);
          this.beamAcc.set(tr.enemy.id, (this.beamAcc.get(tr.enemy.id) || 0) + dmg);
          if (Math.random() < 0.3) this.fx.impact(tr.point.x, tr.point.y, tr.point.z, 'blood', tr.enemy.blood);
        } else if (tr.solid && Math.random() < 0.4) this.fx.impact(tr.point.x, tr.point.y, tr.point.z, 'dirt');
        this.audio.loop('beam', true, { type: 'bandpass', freq: 1800, q: 6, vol: 0.18 });
      }
      this.firing = true;
      this.beamT -= dt;
      if (this.beamT <= 0) {
        this.beamT = 0.1;
        for (const [id, dmg] of this.beamAcc) {
          const e = this.mc.enemies.map.get(id);
          if (e && dmg > 0.5) this.sendHit(e, dmg, false, W.pen, W.type === 'flame' ? 'f' : 'b');
        }
        this.beamAcc.clear();
      }
      return;
    }

    if (this.fireCd > 0) return;
    if (W.energy) {
      if (s.overheated) return;
    } else if (s.mag <= 0) {
      this.audio.play('empty');
      this.fireCd = 0.25;
      this.startReload();
      return;
    }
    if (W.type === 'rail') {
      s.charge += dt;
      if (s.charge < W.charge) {
        if (s.charge - dt <= 0) this.audio.play('charge', null, { vol: 0.8 });
        this.fx.add.emit(muzzle.x, muzzle.y, muzzle.z, 0, 0, 0, new THREE.Color('#7fd8ff').multiplyScalar(2.5), 0.3 + s.charge, 0.05, 0.08, 0, 0, 1);
        return;
      }
      s.charge = 0;
    }
    this.fireCd = 60 / W.rpm / fever;
    this.stats.shots++;
    let endPoint = null;
    const spreadRad = spreadDeg * DEG;

    if (W.type === 'hitscan' || W.type === 'pellet') {
      const n = W.pellets || 1;
      for (let i = 0; i < n; i++) {
        const tr = this.aimTrace(W.range * 2, spreadRad);
        if (tr.enemy) {
          this.sendHit(tr.enemy, this.dmgFor(W, tr.enemy.def, tr.weak, tr.t), tr.weak, W.pen, 'b');
          this.fx.impact(tr.point.x, tr.point.y, tr.point.z, 'blood', tr.enemy.blood);
        } else if (tr.solid) this.fx.impact(tr.point.x, tr.point.y, tr.point.z, 'dirt');
        if (i < 4) this.fx.tracer(muzzle, tr.point, W.accent === '#ff3b3b' ? '#ff8a6a' : '#ffd890', n > 1 ? 0.035 : 0.05);
        if (i === 0) endPoint = tr.point;
      }
    } else if (W.type === 'projectile') {
      const tr = this.aimTrace(300, spreadRad);
      const dir = tr.point.clone().sub(muzzle).normalize();
      const kind = W.id === 'rl8' ? 'rocket' : W.id === 'gl6' ? 'gl' : 'plasma';
      if (kind === 'gl') {
        const flat = Math.hypot(tr.point.x - muzzle.x, tr.point.z - muzzle.z);
        dir.y += Math.min(0.5, flat * 0.004 + 0.06);
        dir.normalize();
      }
      const vel = dir.multiplyScalar(W.projSpeed);
      const tag = 't' + this.tagSeq++;
      this.mc.entities.localProjectile(tag, kind, muzzle, vel);
      this.mc.send('throw', { k: kind, x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: vel.x, vy: vel.y, vz: vel.z, tag, m: 1 + (this.mods.dmg || 0) + (W.explosive ? this.mods.explosive || 0 : 0) });
      endPoint = tr.point;
    } else if (W.type === 'arc') {
      const tr = this.aimTrace(W.range);
      const dir = tr.point.clone().sub(muzzle).normalize();
      const hitSet = new Set();
      let from = muzzle.clone();
      let first = this.mc.enemies.inCone(muzzle, dir, W.range, Math.cos(14 * DEG))[0];
      if (first) {
        let e = first.enemy;
        for (let c = 0; c < W.chains && e; c++) {
          hitSet.add(e.id);
          const to = new THREE.Vector3(e.x, e.y + e.def.hit[0].y, e.z);
          this.fx.arcBolt(from, to, '#7ff3ff');
          this.sendHit(e, this.dmgFor(W, e.def, false, from.distanceTo(to)) * (c === 0 ? 1 : 0.7), false, W.pen, 'b');
          from = to;
          e = this.mc.enemies.nearest(to.x, to.y, to.z, 11, hitSet);
        }
      } else {
        this.fx.arcBolt(muzzle, tr.point, '#7ff3ff');
      }
      endPoint = tr.point;
    } else if (W.type === 'rail') {
      const cam = this.mc.camera;
      const dir = this.camDir.clone();
      const o = cam.position.clone().addScaledVector(dir, this.camDistNow * 0.9);
      const tT = Math.min(this.world.terrainRay(o.x, o.y, o.z, dir.x, dir.y, dir.z, W.range), this.world.rayObstacles(o.x, o.y, o.z, dir.x, dir.y, dir.z, W.range));
      const skip = new Set();
      for (let k = 0; k < 8; k++) {
        const h = this.mc.enemies.raycast(o, dir, Math.min(W.range, tT), skip);
        if (!h) break;
        skip.add(h.enemy.id);
        this.sendHit(h.enemy, this.dmgFor(W, h.enemy.def, h.weak, h.t), h.weak, W.pen, 'b');
        const p = o.clone().addScaledVector(dir, h.t);
        this.fx.impact(p.x, p.y, p.z, 'blood', h.enemy.blood);
      }
      endPoint = o.clone().addScaledVector(dir, Math.min(W.range, tT));
      this.fx.tracer(muzzle, endPoint, '#9fe8ff', 0.25, 1200);
      this.fx.arcBolt(muzzle, endPoint, '#7fd8ff');
      this.fx.impact(endPoint.x, endPoint.y, endPoint.z, 'dirt');
      this.shake = Math.min(1, this.shake + 0.3);
    }

    if (W.energy) {
      s.heat += W.heatPerShot;
      if (s.heat >= 100) { s.heat = 100; s.overheated = true; this.audio.play('empty'); }
    } else s.mag--;

    const rec = W.recoil * steady;
    this.pitch += rec * 0.0045 * (this.aiming ? 0.7 : 1);
    this.yaw += (Math.random() - 0.5) * rec * 0.003;
    this.bloom = Math.min(5, this.bloom + rec * 0.35);
    this.avatar.kick(rec * 0.4);
    const dirN = this.camDir;
    if (W.type !== 'arc') this.fx.muzzle(muzzle, dirN, W.type === 'rail' ? '#7fd8ff' : W.id === 'pl2' ? '#c070ff' : '#ffc070', W.pellets ? 1.5 : 1);
    const snd = SOUND[W.id];
    if (snd) this.audio.play(snd, null, { vol: 0.8 });
    if (endPoint) {
      this.shotRelay++;
      if (!W.auto || this.shotRelay % 2 === 0) {
        this.mc.send('shot', { w: WEAPON_INDEX[W.id], x: +muzzle.x.toFixed(2), y: +muzzle.y.toFixed(2), z: +muzzle.z.toFixed(2), ex: +endPoint.x.toFixed(1), ey: +endPoint.y.toFixed(1), ez: +endPoint.z.toFixed(1) });
      }
    }
    if (!W.energy && s.mag <= 0) this.startReload();
  }

  setBeam(on, from, to) {
    if (!on) {
      if (this.beamMesh) this.beamMesh.visible = false;
      return;
    }
    if (!this.beamMesh) {
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      this.beamMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b5c').multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.mc.scene.add(this.beamMesh);
    }
    this.beamMesh.visible = true;
    this.beamMesh.position.copy(from);
    this.beamMesh.lookAt(to);
    this.beamMesh.scale.set(1 + Math.random() * 0.4, 1 + Math.random() * 0.4, from.distanceTo(to));
    this.fx.flash(to.x, to.y, to.z, '#ff3b5c', 8, 8, 0.05);
  }

  throwThing(kind, extra = {}) {
    const right = this.camRight;
    const origin = this.pos.clone().add(new THREE.Vector3(0, 1.65, 0)).addScaledVector(right, 0.3);
    const dir = this.camDir.clone();
    dir.y += 0.22;
    dir.normalize();
    const speed = kind === 'beacon' ? 17 : 19;
    const vel = dir.multiplyScalar(speed).addScaledVector(this.vel, 0.4);
    const tag = 't' + this.tagSeq++;
    this.mc.entities.localProjectile(tag, kind, origin, vel, extra.c);
    this.mc.send('throw', { k: kind, x: origin.x, y: origin.y, z: origin.z, vx: vel.x, vy: vel.y, vz: vel.z, tag, ...extra });
    this.audio.play('throw', null, { vol: 0.7 });
  }

  // ------------------------------------------------------------ atualização
  update(dt) {
    const inp = this.input;
    const playing = this.mc.playing;
    this.cheatCd = Math.max(0, this.cheatCd - dt);
    this.feverT = Math.max(0, this.feverT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.nadeCd = Math.max(0, this.nadeCd - dt);
    for (const c of this.callins) c.cd = Math.max(0, c.cd - dt);

    // olhar
    if (playing) {
      const sens = (this.settings.sens || 1) * 0.0022 * (this.aiming ? 0.55 : 1);
      this.yaw -= inp.dx * sens;
      this.pitch -= inp.dy * sens;
      this.pitch = Math.max(-1.25, Math.min(1.3, this.pitch));
    }

    if (!this.alive) {
      this.deathT += dt;
      this.updateCamera(dt, true);
      this.avatar.update(dt, { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: 0, flags: 0 });
      return;
    }
    if (this.onboard) {
      this.updateCamera(dt, true);
      return;
    }

    const s = this.weapon;
    const W = s?.W;
    this.lastHitT += dt;
    if (this.mods.regen) this.heal(this.mods.regen * dt);
    if (this.mods.outRegen && this.lastHitT > 4) this.heal(this.mods.outRegen * dt);

    // movimento
    const f = playing ? (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0) : 0;
    const r = playing ? (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0) : 0;
    this.moveF = f; this.moveR = r;
    const moving = f !== 0 || r !== 0;
    this.aiming = playing && inp.mouseDown(2) && this.switchT <= 0;
    const deep = this.world.isDeep(this.pos.x, this.pos.z);
    const wantSprint = playing && inp.down('ShiftLeft') && f > 0 && !this.aiming && !deep;
    if (wantSprint && moving && this.stamina > 1) {
      this.sprinting = true;
      if (!this.mods.freeSprint) this.stamina -= 20 * dt;
    } else {
      this.sprinting = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + 16 * (1 + (this.mods.stamina || 0)) * dt);
    }
    let speed = 5.4 * this.d.speedMult * (W?.mobility || 1);
    if (this.sprinting) speed *= 1.7 * (1 + (this.mods.sprint || 0));
    if (this.aiming) speed *= 0.6;
    if (deep) speed *= 0.5;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    let wx = fx * f + rx * r, wz = fz * f + rz * r;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx = (wx / wl) * speed; wz = (wz / wl) * speed; }
    const accel = this.onGround ? 12 : 2.5;
    this.vel.x += (wx - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wz - this.vel.z) * Math.min(1, dt * accel);
    if (playing && inp.hit('Space') && this.onGround) {
      this.vel.y = 7.5;
      this.onGround = false;
    }
    this.vel.y -= 24 * dt;
    const ox = this.pos.x, oz = this.pos.z;
    const g0 = this.world.groundAt(ox, oz);
    const pos2 = { x: ox + this.vel.x * dt, z: oz + this.vel.z * dt };
    this.world.collide(pos2, 0.45);
    pos2.x = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, pos2.x));
    pos2.z = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, pos2.z));
    const g1 = this.world.groundAt(pos2.x, pos2.z);
    const hd = Math.hypot(pos2.x - ox, pos2.z - oz);
    if (this.onGround && hd > 0.001 && (g1 - g0) / hd > 1.4) {
      // íngreme demais
      pos2.x = ox; pos2.z = oz;
    }
    this.pos.x = pos2.x;
    this.pos.z = pos2.z;
    this.pos.y += this.vel.y * dt;
    const g = this.world.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g) {
      this.pos.y = g;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.onGround && this.pos.y - g < 0.6 && this.vel.y <= 0) {
      this.pos.y = g;
      this.vel.y = 0;
    } else {
      this.onGround = false;
    }
    // líquidos perigosos
    if (this.world.inLiquid(this.pos.x, this.pos.z) && this.pos.y < this.world.liquidLevel + 0.2) {
      const liq = this.world.liquid;
      if (liq === 'lava') { this.inLava += dt; this.takeDamage(40 * dt / (1 - this.d.dr), 'f'); }
      else if (liq === 'toxic') this.takeDamage(6 * dt / (1 - this.d.dr), 'f');
    }

    // armas
    this.switchT = Math.max(0, this.switchT - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.bloom = Math.max(0, this.bloom - dt * 6);
    for (const sl of this.slots) {
      if (!sl || !sl.W.energy) continue;
      if (!(this.firing && sl === s)) sl.heat = Math.max(0, sl.heat - sl.W.cooldownRate * (sl.overheated ? 1.3 : 1) * dt);
      if (sl.overheated && sl.heat < 25) sl.overheated = false;
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0 && s) {
        s.mag = s.W.type === 'flame' ? s.W.fuel : s.W.mag;
        s.mags--;
      }
    }
    if (playing) {
      if (inp.hit('Digit1')) this.switchTo(0);
      if (inp.hit('Digit2')) this.switchTo(1);
      if (inp.hit('Digit3')) this.switchTo(2);
      if (inp.wheel) {
        let i = this.cur;
        for (let k = 0; k < 3; k++) {
          i = (i + (inp.wheel > 0 ? 1 : 2)) % 3;
          if (this.slots[i]) break;
        }
        this.switchTo(i);
      }
      if (inp.hit('KeyR')) this.startReload();
      if (inp.hit('KeyG') && this.grenades > 0 && this.nadeCd <= 0) {
        this.grenades--;
        this.nadeCd = 0.8;
        this.throwThing('grenade', { g: this.grenadeType, m: 1 + (this.mods.explosive || 0), rm: 1 + (this.mods.nadeRadius || 0) });
      }
      const keys = [['KeyZ', 'Digit4'], ['KeyX', 'Digit5'], ['KeyC', 'Digit6'], ['KeyV', 'Digit7']];
      for (let i = 0; i < this.callins.length; i++) {
        if (inp.hit(keys[i][0]) || inp.hit(keys[i][1])) this.useCallin(i);
      }
      if (inp.hit('KeyF')) this.useStim();
      if (inp.mouseHit(1) || inp.hit('KeyB')) {
        const tr = this.aimTrace(400);
        this.mc.send('ping', { x: +tr.point.x.toFixed(1), z: +tr.point.z.toFixed(1) });
      }
    }
    const trigger = playing && inp.mouseDown(0) && !this.sprinting;
    const canFire = s && this.switchT <= 0 && this.reloadT <= 0;
    if (canFire && trigger && (W.auto || inp.mouseHit(0) || W.type === 'rail')) {
      this.fire(dt);
    } else {
      if (this.firing) { this.firing = false; this.audio.loop('flame', false); this.audio.loop('beam', false); }
      this.setBeam(false);
      if (s && s.W.type === 'rail' && s.charge > 0 && !trigger) s.charge = 0;
      if (this.beamAcc.size) {
        for (const [id, dmg] of this.beamAcc) {
          const e = this.mc.enemies.map.get(id);
          if (e && dmg > 0.5) this.sendHit(e, dmg, false, W.pen, W.type === 'flame' ? 'f' : 'b');
        }
        this.beamAcc.clear();
      }
    }
    if (this.sprinting && this.firing) this.firing = false;

    // avatar
    let flags = 0;
    if (moving) flags |= ANIM.MOVE;
    if (this.sprinting) flags |= ANIM.SPRINT;
    if (this.aiming || trigger) flags |= ANIM.AIM;
    if (this.firing) flags |= ANIM.FIRE;
    if (this.reloadT > 0) flags |= ANIM.RELOAD;
    if (!this.onGround) flags |= ANIM.AIR;
    this.flags = flags;
    if (s) this.avatar.setWeapon(s.id);
    const faceYaw = this.sprinting && Math.abs(r) > 0 ? Math.atan2(wx, wz) : this.yaw;
    this.bodyYaw = this.bodyYaw === undefined ? faceYaw : this.bodyYaw + angDiff(this.bodyYaw, faceYaw) * Math.min(1, dt * 12);
    this.avatar.update(dt, { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.bodyYaw, pitch: this.pitch, flags, moveF: this.sprinting ? 1 : f, moveR: this.sprinting ? 0 : r });

    this.updateCamera(dt, false);

    // envia estado
    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.stateT = 1 / 15;
      this.mc.send('state', {
        x: +this.pos.x.toFixed(2), y: +this.pos.y.toFixed(2), z: +this.pos.z.toFixed(2),
        r: +this.bodyYaw.toFixed(2), p: +this.pitch.toFixed(2), a: flags,
        w: s ? WEAPON_INDEX[s.id] : 0, hp: Math.round(this.hp), mhp: this.maxHp,
      });
    }
  }

  useCallin(i) {
    const c = this.callins[i];
    if (!c) return;
    if (this.mc.noSupport) { this.mc.hud.message('Sem suporte orbital!', 'bad'); return; }
    if (c.cd > 0) { this.audio.play('empty'); return; }
    c.cd = c.max;
    this.throwThing('beacon', { c: c.id });
    this.mc.hud.message(`${c.def.name} solicitado`, 'info');
  }

  useStim() {
    if (this.stims <= 0 || this.hp >= this.maxHp) return;
    this.stims--;
    this.heal(100 * (1 + (this.mods.stimPower || 0)));
    this.audio.play('stim', null, { vol: 0.8 });
    this.fx.burst(this.fx.add, 12, this.pos.x, this.pos.y + 1.2, this.pos.z, { speed: 2, up: 1, color: new THREE.Color('#4cff8a').multiplyScalar(2), s0: 0.3, s1: 0.05, life: 0.6 });
  }

  updateCamera(dt, dead) {
    const cam = this.mc.camera;
    const targetAim = this.aiming ? 1 : 0;
    this.aimBlend += (targetAim - this.aimBlend) * Math.min(1, dt * 12);
    const a = this.aimBlend;
    let dist = 4.6 - 1.7 * a;
    let shoulder = 1.0 - 0.1 * a;
    let height = 1.8 + 0.05 * a;
    if (dead) { dist = 9; shoulder = 0; height = 3; }
    if (this.onboard && this.mc.entities.shuttle) {
      const sp = this.mc.entities.shuttle.position;
      cam.position.lerp(_v.set(sp.x + 25, sp.y + 12, sp.z + 25), Math.min(1, dt * 2));
      cam.lookAt(sp);
      return;
    }
    if (this.podRide) {
      const p = this.podRide.pod.position;
      cam.position.set(p.x + 14, p.y + 10, p.z + 14);
      cam.lookAt(p.x, p.y - 6, p.z);
      this.camDistNow = 4;
      return;
    }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = this.camDir.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    this.camRight.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const pivot = _v.set(this.pos.x, this.pos.y + height, this.pos.z);
    // colisão da câmera com o terreno
    const back = _v2.copy(dir).multiplyScalar(-1).addScaledVector(this.camRight, shoulder / dist).normalize();
    const tHit = this.world.terrainRay(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, dist + 0.5);
    if (tHit < dist + 0.5) dist = Math.max(0.8, tHit - 0.5);
    this.camDistNow = dist;
    const camPos = pivot.clone().addScaledVector(dir, -dist).addScaledVector(this.camRight, shoulder);
    const gy = this.world.groundAt(camPos.x, camPos.z) + 0.4;
    if (camPos.y < gy) camPos.y = gy;
    if (this.shake > 0) {
      const k = this.shake * this.shake * 0.35;
      camPos.x += (Math.random() - 0.5) * k;
      camPos.y += (Math.random() - 0.5) * k;
      camPos.z += (Math.random() - 0.5) * k;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    cam.position.copy(camPos);
    cam.lookAt(camPos.x + dir.x, camPos.y + dir.y, camPos.z + dir.z);
    const zoom = this.weapon?.W.zoom || 1.4;
    const fov = this.baseFov / (1 + (zoom - 1) * a);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  dispose() {
    this.avatar.dispose();
    if (this.beamMesh) this.mc.scene.remove(this.beamMesh);
    this.audio.loop('flame', false);
    this.audio.loop('beam', false);
  }
}

function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
