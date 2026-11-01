// Avatar do soldado (local ou remoto) com animação procedural
import * as THREE from 'three';
import { buildTrooper, buildWeapon, gripPose, applyPose } from './models/units.js';
import { WEAPON_LIST } from '../../../shared/data/weapons.js';

export const ANIM = { MOVE: 1, SPRINT: 2, AIM: 4, FIRE: 8, RELOAD: 16, AIR: 32 };

export class Avatar {
  constructor(scene, look = {}, name = '') {
    this.scene = scene;
    this.look = look;
    this.model = buildTrooper(look);
    this.root = this.model.root;
    scene.add(this.root);
    this.weaponId = null;
    this.weapon = null;
    this.phase = 0;
    this.speed = 0;
    this.dead = false;
    this.deadT = 0;
    this.recoil = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.capeT = Math.random() * 10;
    this.name = name;
    this.label = null;
  }

  setWeapon(id) {
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weapon) this.model.weaponMount.remove(this.weapon);
    this.weapon = id ? buildWeapon(id) : null;
    if (this.weapon) this.model.weaponMount.add(this.weapon);
    this.ik = gripPose(this.model, this.weapon);
  }

  setWeaponIndex(i) {
    this.setWeapon(WEAPON_LIST[i] || null);
  }

  muzzleWorld(out = new THREE.Vector3()) {
    if (this.weapon && this.weapon.userData.muzzle) return this.weapon.userData.muzzle.getWorldPosition(out);
    return this.root.getWorldPosition(out).add(new THREE.Vector3(0, 1.4, 0));
  }

  kick(amount = 1) { this.recoil = Math.min(1, this.recoil + 0.4 * amount); }

  // state: { x,y,z, yaw, pitch, flags, moveF, moveR, speed }
  update(dt, s) {
    const m = this.model;
    this.root.position.set(s.x, s.y, s.z);
    this.yaw = s.yaw;
    this.root.rotation.y = s.yaw;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT * 3);
      m.body.rotation.x = -k * Math.PI / 2;
      m.body.position.y = k * 0.25;
      return;
    }
    m.body.rotation.x = 0;
    m.body.position.y = 0;
    const flags = s.flags || 0;
    const moving = !!(flags & ANIM.MOVE);
    const sprint = !!(flags & ANIM.SPRINT);
    const aiming = !!(flags & ANIM.AIM);
    const air = !!(flags & ANIM.AIR);
    const targetSpeed = moving ? (sprint ? 1.6 : 1) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    this.phase += dt * (sprint ? 11 : 8.5) * Math.min(1, this.speed + 0.001);
    const sw = Math.sin(this.phase);
    const amp = 0.55 * Math.min(1.3, this.speed);
    const back = s.moveF < -0.2 ? -1 : 1;
    if (air) {
      m.legL.rotation.x = -0.6; m.legR.rotation.x = 0.3;
      m.shinL.rotation.x = 0.9; m.shinR.rotation.x = 0.5;
    } else {
      m.legL.rotation.x = sw * amp * back;
      m.legR.rotation.x = -sw * amp * back;
      m.shinL.rotation.x = Math.max(0, -sw) * amp * 1.4;
      m.shinR.rotation.x = Math.max(0, sw) * amp * 1.4;
    }
    const strafe = s.moveR || 0;
    m.hips.rotation.y = moving && Math.abs(strafe) > 0.3 && Math.abs(s.moveF) < 0.3 ? -strafe * 0.6 : 0;
    m.hips.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * 0.05 * this.speed;
    m.torso.position.y = 1.02 + Math.abs(Math.cos(this.phase)) * 0.05 * this.speed;
    this.pitch += ((s.pitch || 0) - this.pitch) * Math.min(1, dt * 15);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (sprint && !aiming) {
      m.torso.rotation.x = 0.25;
      m.aim.rotation.x = 0.7;
      m.armR.rotation.set(-0.5 + sw * 0.4, 0, -0.1);
      m.armL.rotation.set(-1.0 - sw * 0.3, 0, 0.5);
      m.foreR.rotation.x = -0.8;
      m.foreL.rotation.x = -0.6;
    } else {
      m.torso.rotation.x = -this.pitch * 0.25;
      m.aim.rotation.x = -this.pitch * 0.75 - this.recoil * 0.15 + ((flags & ANIM.RELOAD) ? 0.35 : 0);
      if (!this.ik) this.ik = gripPose(m, this.weapon);
      applyPose(m, this.ik, !!(flags & ANIM.RELOAD));
      m.aim.position.z = -this.recoil * 0.08;
    }
    m.head.rotation.x = -this.pitch * 0.4;
    if (m.cape) {
      this.capeT += dt * (2 + this.speed * 6);
      m.cape.rotation.x = 0.08 + this.speed * 0.32 + Math.sin(this.capeT) * (0.04 + this.speed * 0.06);
    }
  }

  setDead(d) {
    if (d === this.dead) return;
    this.dead = d;
    this.deadT = 0;
  }

  setVisible(v) { this.root.visible = v; }

  dispose() {
    this.scene.remove(this.root);
  }
}
