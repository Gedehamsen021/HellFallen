// Modelos animados: soldado (Caído), armas e inimigos das 3 facções
import * as THREE from 'three';
import { WEAPONS } from '../../../../shared/data/weapons.js';
import { stdMat, glowMat, B, C, K, S, O, pivot, darken, merge, G, paint, xf, jitter } from './kit.js';

// =====================================================================
// SOLDADO
// =====================================================================
export function buildTrooper(look = {}) {
  const c1 = look.c1 || '#2b2f3a';
  const c2 = look.c2 || '#d4a017';
  const visor = look.visor || '#ffb000';
  const m1 = stdMat(c1, { rough: 0.55, metal: 0.35 });
  const m1d = stdMat(darken(c1, 0.75), { rough: 0.6, metal: 0.3 });
  const m2 = stdMat(c2, { rough: 0.45, metal: 0.5 });
  const md = stdMat('#17191f', { rough: 0.8 });
  const mv = glowMat(visor, 1.8);
  const gold = stdMat('#e0b040', { rough: 0.3, metal: 0.8 });
  const exo = glowMat('#ffc63a', 2);

  const root = new THREE.Group();
  const body = pivot(0, 0, 0);
  root.add(body);
  const hips = pivot(0, 0.95, 0);
  body.add(hips);
  hips.add(B(0.36, 0.18, 0.22, m1));
  hips.add(B(0.12, 0.14, 0.06, m2, { z: 0.12, y: -0.04 }));

  const legsV = look.legs || 0;
  const mkLeg = (side) => {
    const leg = pivot(side * 0.11, -0.03, 0);
    hips.add(leg);
    leg.add(B(0.16, 0.44, 0.18, m1, { y: -0.22 }));
    leg.add(B(0.05, 0.3, 0.1, md, { x: side * 0.08, y: -0.2 }));
    const shin = pivot(0, -0.45, 0);
    leg.add(shin);
    shin.add(B(0.15, 0.4, 0.17, m1, { y: -0.2 }));
    shin.add(B(0.17, 0.12, 0.08, m2, { y: 0.0, z: 0.08 }));
    shin.add(B(0.18, 0.12, 0.28, md, { y: -0.44, z: 0.04 }));
    if (legsV === 1) shin.add(B(0.18, 0.28, 0.06, m2, { y: -0.2, z: 0.1 }));
    if (legsV === 2) shin.add(B(0.02, 0.3, 0.02, mv, { x: side * 0.08, y: -0.2, z: 0.06 }));
    if (legsV === 3) { shin.add(B(0.19, 0.03, 0.29, exo, { y: -0.505, z: 0.04 })); shin.add(B(0.02, 0.32, 0.02, exo, { x: side * 0.085, y: -0.22 })); }
    return { leg, shin };
  };
  const L = mkLeg(-1), R = mkLeg(1);

  const torso = pivot(0, 1.02, 0);
  body.add(torso);
  torso.add(B(0.44, 0.4, 0.27, m1, { y: 0.24 }));
  torso.add(B(0.36, 0.14, 0.22, m1d, { y: 0.06 }));
  torso.add(B(0.4, 0.07, 0.25, md, { y: 0.0 }));
  const chestV = look.chest || 0;
  if (chestV === 0) {
    torso.add(B(0.4, 0.26, 0.06, m2, { y: 0.3, z: 0.15 }));
    torso.add(B(0.14, 0.08, 0.04, md, { y: 0.32, z: 0.185 }));
  } else if (chestV === 1) {
    torso.add(B(0.38, 0.22, 0.05, m1d, { y: 0.3, z: 0.15 }));
    for (let i = -1; i <= 1; i++) torso.add(B(0.1, 0.1, 0.07, m2, { x: i * 0.12, y: 0.12, z: 0.16 }));
    torso.add(B(0.06, 0.4, 0.04, m2, { x: 0.1, y: 0.25, z: 0.15, rz: 0.5 }));
  } else if (chestV === 2) {
    torso.add(B(0.46, 0.32, 0.08, m2, { y: 0.28, z: 0.15 }));
    torso.add(B(0.5, 0.1, 0.32, m2, { y: 0.46 }));
    torso.add(B(0.08, 0.08, 0.04, mv, { y: 0.3, z: 0.2 }));
  } else if (chestV === 3) {
    torso.add(B(0.4, 0.28, 0.06, m2, { y: 0.29, z: 0.15 }));
    torso.add(C(0.08, 0.05, exo, { y: 0.3, z: 0.19, rx: Math.PI / 2 }, 8));
  } else if (chestV === 4) {
    torso.add(B(0.48, 0.34, 0.09, gold, { y: 0.28, z: 0.15 }));
    torso.add(B(0.54, 0.12, 0.34, gold, { y: 0.46 }));
    torso.add(B(0.1, 0.1, 0.04, exo, { y: 0.3, z: 0.2 }));
  }
  // mochila
  torso.add(B(0.32, 0.36, 0.16, m1d, { y: 0.27, z: -0.21 }));
  torso.add(B(0.26, 0.1, 0.06, m2, { y: 0.38, z: -0.3 }));
  torso.add(C(0.012, 0.5, md, { x: 0.11, y: 0.62, z: -0.25 }, 4));
  torso.add(S(0.025, glowMat('#4cff8a', 2.5), { x: 0.11, y: 0.88, z: -0.25 }));

  // cabeça
  const head = pivot(0, 0.5, 0);
  torso.add(head);
  head.add(B(0.1, 0.06, 0.1, md, { y: 0.0 }));
  const hv = look.helmet || 0;
  if (hv === 0) {
    head.add(S(0.17, m1, { y: 0.14, sx: 0.95, sy: 1.0, sz: 1.08 }, 1));
    head.add(B(0.22, 0.065, 0.06, mv, { y: 0.15, z: 0.145 }));
    head.add(B(0.05, 0.1, 0.1, m2, { x: 0.165, y: 0.12 }));
    head.add(B(0.05, 0.1, 0.1, m2, { x: -0.165, y: 0.12 }));
  } else if (hv === 1) {
    head.add(B(0.3, 0.28, 0.32, m1, { y: 0.14 }));
    head.add(B(0.07, 0.07, 0.32, m2, { y: 0.3 }));
    head.add(B(0.24, 0.05, 0.04, mv, { y: 0.17, z: 0.165 }));
    head.add(B(0.05, 0.12, 0.04, mv, { y: 0.1, z: 0.165 }));
  } else if (hv === 2) {
    head.add(S(0.18, m1, { y: 0.14, sz: 1.1 }, 1));
    head.add(B(0.3, 0.08, 0.16, mv, { y: 0.15, z: 0.08 }));
    head.add(B(0.1, 0.18, 0.1, m2, { y: 0.24, z: -0.08, rx: -0.4 }));
  } else if (hv === 3) {
    head.add(S(0.17, md, { y: 0.14 }, 1));
    head.add(B(0.24, 0.2, 0.05, stdMat('#d8d0c0', { rough: 0.6 }), { y: 0.12, z: 0.14 }));
    head.add(B(0.06, 0.025, 0.02, mv, { x: 0.05, y: 0.15, z: 0.17 }));
    head.add(B(0.06, 0.025, 0.02, mv, { x: -0.05, y: 0.15, z: 0.17 }));
    head.add(K(0.24, 0.42, m2, { y: 0.24, z: -0.03, rx: -0.2 }, 5));
  } else if (hv === 4) {
    head.add(S(0.18, m1, { y: 0.14 }, 1));
    head.add(S(0.075, exo, { y: 0.15, z: 0.16 }));
    head.add(B(0.02, 0.22, 0.14, gold, { x: 0.18, y: 0.2, rz: -0.3 }));
    head.add(B(0.02, 0.22, 0.14, gold, { x: -0.18, y: 0.2, rz: 0.3 }));
    head.add(B(0.02, 0.16, 0.2, gold, { y: 0.33 }));
  } else {
    head.add(B(0.3, 0.26, 0.3, m1, { y: 0.14 }));
    head.add(B(0.26, 0.05, 0.04, exo, { y: 0.16, z: 0.155 }));
    for (let i = 0; i < 5; i++) head.add(K(0.03, 0.18, exo, { x: (i - 2) * 0.06, y: 0.36 - Math.abs(i - 2) * 0.03, z: 0.1 }, 4));
  }

  // braços + arma (pivô de mira)
  const aim = pivot(0, 0.38, 0);
  torso.add(aim);
  const armsV = look.arms || 0;
  const mkArm = (side) => {
    const arm = pivot(side * 0.29, 0, 0);
    aim.add(arm);
    const pad = armsV === 1 ? [0.24, 0.14, 0.24] : armsV === 2 ? [0.15, 0.08, 0.17] : [0.19, 0.11, 0.21];
    arm.add(B(pad[0], pad[1], pad[2], m2, { y: 0.03, x: side * 0.02 }));
    arm.add(B(0.12, 0.3, 0.13, m1, { y: -0.15 }));
    const fore = pivot(0, -0.3, 0);
    arm.add(fore);
    fore.add(B(armsV === 1 ? 0.15 : 0.12, 0.28, armsV === 1 ? 0.16 : 0.13, m2, { y: -0.14 }));
    fore.add(B(0.09, 0.09, 0.1, md, { y: -0.3 }));
    if (armsV === 2) fore.add(B(0.02, 0.22, 0.02, mv, { y: -0.14, z: 0.07 }));
    if (armsV === 3) fore.add(S(0.055, exo, { y: -0.2, z: 0.07 }));
    if (armsV === 4) for (let i = -1; i <= 1; i++) fore.add(K(0.015, 0.12, glowMat('#ff3b3b', 2), { x: i * 0.03, y: -0.38, z: 0.04, rx: Math.PI }, 3));
    return { arm, fore };
  };
  const AL = mkArm(-1), AR = mkArm(1);
  const weaponMount = pivot(0.24, -0.04, 0.32);
  weaponMount.scale.setScalar(1.3);
  aim.add(weaponMount);

  // insígnia (capa / estandarte / faixa)
  const markV = look.mark || 0;
  let cape = null;
  if (markV === 0 || markV === 3) {
    cape = pivot(0, 0.44, -0.3);
    torso.add(cape);
    const capeMat = stdMat(markV === 3 ? '#3a1010' : darken(c1, 0.8), { rough: 0.9, side: THREE.DoubleSide });
    cape.add(B(0.34, 0.78, 0.025, capeMat, { y: -0.39 }));
    if (markV === 3) {
      cape.add(B(0.34, 0.03, 0.03, exo, { y: -0.78 }));
      cape.add(O(0.06, exo, { y: -0.4, z: -0.02, sy: 1.4 }));
    } else {
      cape.add(B(0.1, 0.1, 0.03, m2, { y: -0.35, z: -0.01 }));
    }
  } else if (markV === 1) {
    const pole = pivot(-0.12, 0.45, -0.3);
    torso.add(pole);
    pole.add(C(0.012, 0.9, md, { y: 0.35 }, 4));
    cape = pivot(0, 0.75, 0);
    pole.add(cape);
    cape.add(B(0.02, 0.26, 0.36, stdMat(c2, { side: THREE.DoubleSide }), { y: -0.13, z: -0.18 }));
  } else if (markV === 2) {
    torso.add(B(0.07, 0.56, 0.3, m2, { y: 0.24, rz: 0.75, z: 0.01 }));
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    root, body, hips, torso, head, aim,
    legL: L.leg, legR: R.leg, shinL: L.shin, shinR: R.shin,
    armL: AL.arm, armR: AR.arm, foreL: AL.fore, foreR: AR.fore,
    weaponMount, cape,
  };
}

// =====================================================================
// ARMAS
// =====================================================================
export function buildWeapon(id) {
  const W = WEAPONS[id] || WEAPONS.ar7;
  const body = stdMat(W.color, { metal: 0.55, rough: 0.4 });
  const acc = stdMat(W.accent, { metal: 0.3, rough: 0.5 });
  const dk = stdMat('#15171c', { metal: 0.6, rough: 0.35 });
  const gl = glowMat(W.accent, 2);
  const g = new THREE.Group();
  let mz = 0.7;
  const barrel = (r, len, z, y = 0.02) => g.add(C(r, len, dk, { y, z, rx: Math.PI / 2 }, 6));
  switch (id) {
    case 'ar7':
      g.add(B(0.07, 0.11, 0.42, body, { z: 0.15 }));
      g.add(B(0.075, 0.085, 0.22, acc, { z: 0.42 }));
      barrel(0.018, 0.34, 0.6);
      g.add(B(0.05, 0.17, 0.08, dk, { y: -0.12, z: 0.2, rx: 0.2 }));
      g.add(B(0.05, 0.09, 0.22, body, { z: -0.14, y: -0.02 }));
      g.add(B(0.045, 0.1, 0.05, dk, { y: -0.09, z: 0.0, rx: 0.3 }));
      g.add(B(0.035, 0.045, 0.1, dk, { y: 0.08, z: 0.16 }));
      g.add(B(0.012, 0.012, 0.012, gl, { y: 0.11, z: 0.16 }));
      mz = 0.78;
      break;
    case 'sg12':
      g.add(B(0.08, 0.12, 0.38, body, { z: 0.1 }));
      barrel(0.03, 0.55, 0.52, 0.03);
      g.add(B(0.07, 0.07, 0.2, acc, { y: -0.04, z: 0.45 }));
      g.add(B(0.055, 0.1, 0.24, body, { z: -0.17, y: -0.03 }));
      g.add(B(0.045, 0.1, 0.05, dk, { y: -0.09, z: -0.02, rx: 0.3 }));
      for (let i = 0; i < 4; i++) g.add(C(0.012, 0.05, acc, { x: 0.045, y: 0.0, z: 0.0 + i * 0.035, rz: Math.PI / 2 }, 5));
      mz = 0.8;
      break;
    case 'smg9':
      g.add(B(0.065, 0.1, 0.32, body, { z: 0.1 }));
      barrel(0.016, 0.16, 0.33);
      g.add(B(0.04, 0.22, 0.06, dk, { y: -0.15, z: 0.15 }));
      g.add(B(0.04, 0.06, 0.16, acc, { z: -0.1, y: 0.0 }));
      g.add(B(0.02, 0.02, 0.2, gl, { x: 0.035, z: 0.1 }));
      mz = 0.42;
      break;
    case 'dmr4':
      g.add(B(0.07, 0.11, 0.46, body, { z: 0.15 }));
      barrel(0.017, 0.55, 0.65);
      g.add(C(0.032, 0.26, dk, { y: 0.1, z: 0.14, rx: Math.PI / 2 }, 8));
      g.add(C(0.028, 0.01, gl, { y: 0.1, z: 0.275, rx: Math.PI / 2 }, 8));
      g.add(B(0.05, 0.14, 0.07, dk, { y: -0.11, z: 0.2, rx: 0.15 }));
      g.add(B(0.055, 0.11, 0.26, acc, { z: -0.16, y: -0.02 }));
      mz = 0.95;
      break;
    case 'pl2':
      g.add(B(0.1, 0.13, 0.44, body, { z: 0.15 }));
      g.add(C(0.05, 0.3, acc, { y: 0.02, z: 0.5, rx: Math.PI / 2 }, 8));
      for (let i = 0; i < 3; i++) g.add(C(0.058, 0.025, gl, { y: 0.02, z: 0.4 + i * 0.08, rx: Math.PI / 2 }, 8));
      g.add(B(0.05, 0.09, 0.2, body, { z: -0.15 }));
      g.add(B(0.03, 0.06, 0.18, gl, { x: 0.052, z: 0.12 }));
      mz = 0.68;
      break;
    case 'arc3':
      g.add(B(0.09, 0.12, 0.4, body, { z: 0.12 }));
      g.add(S(0.07, gl, { z: 0.38, y: 0.02 }));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.add(K(0.012, 0.22, acc, { x: Math.cos(a) * 0.05, y: 0.02 + Math.sin(a) * 0.05, z: 0.52, rx: Math.PI / 2 }, 4));
      }
      g.add(B(0.05, 0.09, 0.2, body, { z: -0.14 }));
      mz = 0.64;
      break;
    case 'lb1':
      g.add(B(0.08, 0.12, 0.5, body, { z: 0.15 }));
      g.add(B(0.06, 0.06, 0.3, acc, { y: 0.02, z: 0.52 }));
      g.add(C(0.04, 0.02, gl, { y: 0.02, z: 0.68, rx: Math.PI / 2 }, 8));
      g.add(B(0.05, 0.1, 0.22, body, { z: -0.17, y: -0.02 }));
      g.add(B(0.1, 0.03, 0.2, gl, { y: 0.075, z: 0.1 }));
      mz = 0.72;
      break;
    case 'p19':
      g.add(B(0.05, 0.075, 0.24, body, { z: 0.08 }));
      g.add(B(0.045, 0.13, 0.06, dk, { y: -0.08, z: -0.01, rx: 0.25 }));
      g.add(B(0.01, 0.01, 0.01, gl, { y: 0.045, z: 0.0 }));
      mz = 0.22;
      break;
    case 'r6':
      g.add(C(0.02, 0.24, dk, { y: 0.03, z: 0.15, rx: Math.PI / 2 }, 6));
      g.add(C(0.045, 0.07, body, { y: 0.01, z: 0.02, rx: Math.PI / 2 }, 7));
      g.add(B(0.045, 0.13, 0.06, acc, { y: -0.08, z: -0.05, rx: 0.3 }));
      mz = 0.28;
      break;
    case 'mp5':
      g.add(B(0.05, 0.085, 0.22, body, { z: 0.08 }));
      barrel(0.014, 0.1, 0.22);
      g.add(B(0.04, 0.18, 0.05, dk, { y: -0.12, z: 0.02 }));
      g.add(B(0.02, 0.02, 0.1, glowMat('#ff3b3b', 2), { x: 0.03, z: 0.08 }));
      mz = 0.28;
      break;
    case 'mg43':
      g.add(B(0.11, 0.15, 0.5, body, { z: 0.12 }));
      g.add(C(0.045, 0.45, acc, { y: 0.03, z: 0.55, rx: Math.PI / 2 }, 8));
      barrel(0.02, 0.25, 0.85, 0.03);
      g.add(B(0.14, 0.14, 0.16, dk, { x: -0.08, y: -0.1, z: 0.12 }));
      g.add(B(0.06, 0.12, 0.26, body, { z: -0.25, y: -0.02 }));
      g.add(C(0.008, 0.25, dk, { x: 0.05, y: -0.1, z: 0.72, rz: 0.3 }, 3));
      g.add(C(0.008, 0.25, dk, { x: -0.05, y: -0.1, z: 0.72, rz: -0.3 }, 3));
      mz = 0.98;
      break;
    case 'rl8':
      g.add(C(0.075, 1.1, body, { y: 0.06, z: 0.2, rx: Math.PI / 2 }, 8));
      g.add(C(0.085, 0.12, acc, { y: 0.06, z: 0.72, rx: Math.PI / 2 }, 8));
      g.add(C(0.085, 0.1, acc, { y: 0.06, z: -0.32, rx: Math.PI / 2 }, 8));
      g.add(B(0.04, 0.12, 0.05, dk, { y: -0.06, z: 0.05, rx: 0.2 }));
      g.add(B(0.05, 0.07, 0.1, dk, { x: -0.1, y: 0.1, z: 0.2 }));
      g.add(B(0.02, 0.02, 0.02, glowMat('#ff2a2a', 3), { x: -0.1, y: 0.14, z: 0.25 }));
      mz = 0.78;
      break;
    case 'rg1':
      g.add(B(0.11, 0.14, 0.45, body, { z: 0.05 }));
      g.add(B(0.03, 0.05, 0.75, acc, { x: 0.04, y: 0.02, z: 0.55 }));
      g.add(B(0.03, 0.05, 0.75, acc, { x: -0.04, y: 0.02, z: 0.55 }));
      g.add(B(0.02, 0.02, 0.7, gl, { y: 0.02, z: 0.55 }));
      g.add(B(0.06, 0.1, 0.22, body, { z: -0.25, y: -0.02 }));
      g.add(C(0.03, 0.2, dk, { y: 0.11, z: 0.05, rx: Math.PI / 2 }, 8));
      mz = 0.95;
      break;
    case 'fl3':
      g.add(B(0.09, 0.12, 0.4, body, { z: 0.1 }));
      g.add(C(0.07, 0.36, acc, { y: -0.12, z: 0.06, rx: Math.PI / 2 }, 8));
      g.add(C(0.03, 0.3, dk, { y: 0.02, z: 0.45, rx: Math.PI / 2 }, 6));
      g.add(C(0.045, 0.06, dk, { y: 0.02, z: 0.62, rx: Math.PI / 2 }, 6));
      g.add(S(0.02, glowMat('#4fa8ff', 3), { y: -0.02, z: 0.64 }));
      mz = 0.66;
      break;
    case 'gl6':
      g.add(B(0.09, 0.12, 0.36, body, { z: 0.08 }));
      g.add(C(0.11, 0.14, acc, { y: -0.02, z: 0.1, rx: Math.PI / 2 }, 8));
      g.add(C(0.045, 0.3, dk, { y: 0.03, z: 0.4, rx: Math.PI / 2 }, 7));
      g.add(B(0.05, 0.1, 0.2, body, { z: -0.18, y: -0.02 }));
      mz = 0.56;
      break;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, mz);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// =====================================================================
// INIMIGOS
// =====================================================================
const VORR = { shell: '#c2461f', shell2: '#8a2a14', under: '#3a1a14', glow: '#ffb347', sac: '#c6ff3a', bone: '#f0d8a8' };
const FERRO = { steel: '#5d636e', steel2: '#3e434c', dark: '#22252b', red: '#ff2a2a', orange: '#ff8a2a' };
const ECOS = { robe: '#2a1a40', robe2: '#1a1028', bone: '#ddd4f2', cyan: '#7ff3ff', violet: '#c06bff' };

function insectLegs(parent, { count, spread, len1, len2, r, mat, y = 0, scale = 1, out = 2.0 }) {
  const legs = [];
  const per = count / 2;
  for (let i = 0; i < per; i++) {
    const z = per === 1 ? 0 : (spread / 2) - (i / (per - 1)) * spread;
    for (const side of [-1, 1]) {
      const hip = pivot(side * 0.4 * scale, y, z);
      hip.rotation.z = side * out;
      parent.add(hip);
      hip.add(C(r, len1, mat, { y: -len1 / 2 }, 5));
      const knee = pivot(0, -len1, 0);
      knee.rotation.z = -side * (out - 0.3);
      hip.add(knee);
      knee.add(C(r * 0.75, len2, mat, { y: -len2 / 2 }, 5));
      knee.add(K(r * 0.8, len2 * 0.25, mat, { y: -len2 - len2 * 0.1, rx: Math.PI }, 4));
      legs.push({ hip, knee, side, phase: (i % 2 === 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0), baseZ: hip.rotation.z, baseK: knee.rotation.z });
    }
  }
  return legs;
}

function biped(root, { scale = 1, torsoMat, limbMat, jointMat, headFn, torsoSize = [0.4, 0.45, 0.25], legLen = 0.48, armLen = 0.3, limbR = 0.05 }) {
  const s = scale;
  const hips = pivot(0, legLen * 2 * s + 0.08 * s, 0);
  root.add(hips);
  hips.add(B(0.3 * s, 0.14 * s, 0.18 * s, jointMat));
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = pivot(side * 0.12 * s, 0, 0);
    hips.add(leg);
    leg.add(C(limbR * s, legLen * s, limbMat, { y: -legLen * s / 2 }, 5));
    leg.add(S(limbR * 1.6 * s, jointMat, { y: -legLen * s }));
    const shin = pivot(0, -legLen * s, 0);
    leg.add(shin);
    shin.add(C(limbR * 0.9 * s, legLen * s, limbMat, { y: -legLen * s / 2 }, 5));
    shin.add(B(0.14 * s, 0.07 * s, 0.26 * s, jointMat, { y: -legLen * s, z: 0.05 * s }));
    legs.push({ leg, shin, side });
  }
  const torso = pivot(0, 0.06 * s, 0);
  hips.add(torso);
  torso.add(B(torsoSize[0] * s, torsoSize[1] * s, torsoSize[2] * s, torsoMat, { y: torsoSize[1] * s / 2 + 0.05 * s }));
  const head = pivot(0, torsoSize[1] * s + 0.12 * s, 0);
  torso.add(head);
  if (headFn) headFn(head, s);
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = pivot(side * (torsoSize[0] / 2 + 0.06) * s, torsoSize[1] * s - 0.02 * s, 0);
    torso.add(arm);
    arm.add(S(limbR * 1.7 * s, jointMat));
    arm.add(C(limbR * 0.9 * s, armLen * s, limbMat, { y: -armLen * s / 2 }, 5));
    const fore = pivot(0, -armLen * s, 0);
    arm.add(fore);
    fore.add(C(limbR * 0.8 * s, armLen * s, limbMat, { y: -armLen * s / 2 }, 5));
    arms.push({ arm, fore, side });
  }
  return { hips, torso, head, legs, arms };
}

export function buildEnemy(type) {
  const root = new THREE.Group();
  const parts = { anim: 'insect', legs: [], arms: [], spin: [], orbit: null, pulse: [], head: null, body: null, glowMats: [] };
  const sm = (c, o) => stdMat(c, o);

  switch (type) {
    // ------------------------------------------------ VORR
    case 'vorr_crawler':
    case 'vorr_colossus': {
      const big = type === 'vorr_colossus';
      const sc = big ? 2.6 : 1;
      const shell = sm(VORR.shell, { rough: 0.45, metal: 0.25 }), shell2 = sm(VORR.shell2, { rough: 0.5 }), under = sm(VORR.under, { rough: 0.8 });
      const glow = glowMat(VORR.glow, 1.7);
      const body = pivot(0, 0.55 * sc, 0);
      root.add(body);
      body.add(S(0.55 * sc, shell, { sx: 1.1, sy: 0.72, sz: 1.5 }, 1));
      body.add(B(0.8 * sc, 0.14 * sc, 0.5 * sc, shell2, { y: 0.32 * sc, z: -0.25 * sc, rx: -0.25 }));
      body.add(B(0.7 * sc, 0.14 * sc, 0.45 * sc, shell2, { y: 0.34 * sc, z: 0.2 * sc, rx: 0.2 }));
      body.add(S(0.42 * sc, under, { y: -0.18 * sc, sx: 1.1, sy: 0.5, sz: 1.4 }));
      const crystals = big ? 7 : 3;
      for (let i = 0; i < crystals; i++) {
        const a = (i / crystals) * Math.PI * 2;
        body.add(O(0.12 * sc, glow, { x: Math.cos(a) * 0.22 * sc, y: 0.42 * sc, z: Math.sin(a) * 0.3 * sc - 0.1 * sc, sy: 2.6, rz: Math.cos(a) * 0.5, rx: Math.sin(a) * 0.4 }));
      }
      if (big) {
        body.add(B(1.3 * sc * 0.6, 0.8, 0.3, shell2, { y: 0.1 * sc, z: 0.85 * sc, rx: -0.3 }));
        body.add(B(0.7, 1.0, 1.4, shell2, { x: 0.75 * sc * 0.55, y: 0.05 * sc, z: 0.4 * sc, rz: 0.3 }));
        body.add(B(0.7, 1.0, 1.4, shell2, { x: -0.75 * sc * 0.55, y: 0.05 * sc, z: 0.4 * sc, rz: -0.3 }));
        body.add(S(0.5, glowMat('#ff7a2a', 1.8), { y: 0.0, z: -0.85 * sc }));
      }
      const head = pivot(0, 0.05 * sc, 0.78 * sc);
      body.add(head);
      head.add(S(0.3 * sc, shell2, { sz: 1.2 }, 0));
      head.add(K(0.06 * sc, 0.38 * sc, sm(VORR.bone), { x: 0.13 * sc, z: 0.3 * sc, rx: Math.PI / 2, rz: 0.4 }, 4));
      head.add(K(0.06 * sc, 0.38 * sc, sm(VORR.bone), { x: -0.13 * sc, z: 0.3 * sc, rx: Math.PI / 2, rz: -0.4 }, 4));
      head.add(S(0.05 * sc, glow, { x: 0.12 * sc, y: 0.1 * sc, z: 0.25 * sc }));
      head.add(S(0.05 * sc, glow, { x: -0.12 * sc, y: 0.1 * sc, z: 0.25 * sc }));
      if (big) {
        head.add(K(0.14 * sc, 0.7 * sc, sm(VORR.bone), { x: 0.3 * sc, y: -0.1 * sc, z: 0.4 * sc, rx: Math.PI / 2 - 0.3, rz: 0.3 }, 5));
        head.add(K(0.14 * sc, 0.7 * sc, sm(VORR.bone), { x: -0.3 * sc, y: -0.1 * sc, z: 0.4 * sc, rx: Math.PI / 2 - 0.3, rz: -0.3 }, 5));
      }
      parts.legs = insectLegs(body, { count: 6, spread: 0.9 * sc, len1: 0.6 * sc, len2: 0.85 * sc, r: (big ? 0.09 : 0.045) * sc, mat: under, scale: sc * 1.05 });
      parts.body = body; parts.head = head; parts.anim = 'insect';
      parts.gait = big ? 5 : 11;
      break;
    }
    case 'vorr_spitter': {
      const shell = sm(VORR.shell, { rough: 0.45 }), shell2 = sm(VORR.shell2), under = sm(VORR.under);
      const sacMat = glowMat(VORR.sac, 1.3);
      const body = pivot(0, 0.75, 0);
      root.add(body);
      const sac = S(0.85, sacMat, { z: -0.55, y: 0.25, sy: 0.85 }, 1);
      body.add(sac);
      parts.pulse.push(sac);
      body.add(B(0.9, 0.12, 0.5, shell2, { y: 0.92, z: -0.5, rx: 0.15 }));
      body.add(B(0.8, 0.12, 0.4, shell2, { y: 0.8, z: -1.0, rx: 0.6 }));
      body.add(S(0.45, shell, { y: 0.1, z: 0.35, sz: 1.2 }, 0));
      const head = pivot(0, 0.15, 0.8);
      body.add(head);
      head.add(S(0.26, shell2, {}, 0));
      head.add(C(0.1, 0.4, shell, { z: 0.28, rx: Math.PI / 2 }, 6));
      head.add(C(0.07, 0.04, glowMat(VORR.sac, 2), { z: 0.49, rx: Math.PI / 2 }, 6));
      parts.legs = insectLegs(body, { count: 4, spread: 0.8, len1: 0.6, len2: 0.85, r: 0.06, mat: under, y: -0.05, scale: 1.1 });
      parts.body = body; parts.head = head; parts.gait = 7;
      break;
    }
    case 'vorr_warrior':
    case 'vorr_matriarch': {
      const boss = type === 'vorr_matriarch';
      const sc = boss ? 2.6 : 1;
      const shell = sm(VORR.shell, { rough: 0.45 }), shell2 = sm(VORR.shell2), under = sm(VORR.under);
      const glow = glowMat(VORR.glow, 1.7);
      const body = pivot(0, 0.8 * sc, 0);
      root.add(body);
      body.add(S(0.5 * sc, shell, { sx: 1, sy: 0.7, sz: 1.3 }, 1));
      const thorax = pivot(0, 0.2 * sc, 0.3 * sc);
      thorax.rotation.x = -0.6;
      body.add(thorax);
      thorax.add(S(0.42 * sc, shell, { y: 0.4 * sc, sy: 1.5 }, 0));
      thorax.add(B(0.6 * sc, 0.5 * sc, 0.12 * sc, shell2, { y: 0.45 * sc, z: -0.3 * sc }));
      for (let i = 0; i < (boss ? 6 : 2); i++) thorax.add(O(0.1 * sc, glow, { x: (i % 2 ? 1 : -1) * 0.18 * sc, y: (0.5 + Math.floor(i / 2) * 0.2) * sc, z: -0.38 * sc, sy: 2.5, rx: -0.5 }));
      const head = pivot(0, 0.95 * sc, 0.1 * sc);
      thorax.add(head);
      head.add(S(0.28 * sc, shell2, { sz: 1.3 }, 0));
      head.add(K(0.12 * sc, 0.5 * sc, shell2, { y: 0.22 * sc, z: -0.15 * sc, rx: -0.9 }, 4));
      head.add(S(0.05 * sc, glow, { x: 0.12 * sc, y: 0.08 * sc, z: 0.28 * sc }));
      head.add(S(0.05 * sc, glow, { x: -0.12 * sc, y: 0.08 * sc, z: 0.28 * sc }));
      if (boss) {
        for (let i = 0; i < 5; i++) head.add(O(0.12 * sc, glow, { x: (i - 2) * 0.12 * sc, y: 0.3 * sc, z: -0.05 * sc, sy: 3, rz: (i - 2) * 0.25 }));
        const sac = S(0.9 * sc, glowMat(VORR.sac, 1.2), { y: 0.1 * sc, z: -0.9 * sc, sy: 0.8 }, 1);
        body.add(sac);
        parts.pulse.push(sac);
      }
      for (const side of [-1, 1]) {
        const arm = pivot(side * 0.32 * sc, 0.7 * sc, 0.05 * sc);
        thorax.add(arm);
        arm.add(C(0.06 * sc, 0.55 * sc, under, { y: -0.27 * sc }, 5));
        const fore = pivot(0, -0.55 * sc, 0);
        arm.add(fore);
        fore.add(K(0.09 * sc, 1.1 * sc, sm(VORR.bone, { rough: 0.4 }), { y: 0.0, z: 0.5 * sc, rx: Math.PI / 2 }, 4));
        arm.rotation.x = -0.9;
        fore.rotation.x = 0.9;
        parts.arms.push({ arm, fore, side, baseX: -0.9, baseF: 0.9 });
      }
      parts.legs = insectLegs(body, { count: 4, spread: 0.8 * sc, len1: 0.65 * sc, len2: 0.95 * sc, r: 0.06 * sc, mat: under, y: -0.1 * sc, scale: sc });
      parts.body = body; parts.head = head; parts.gait = boss ? 4 : 8;
      break;
    }
    case 'vorr_nest': {
      const shell2 = sm('#5a2414', { rough: 0.7 }), dark = sm('#140806');
      const glow = glowMat(VORR.glow, 1.7);
      const mound = new THREE.Mesh(paint(xf(jitter(new THREE.CylinderGeometry(2.2, 4.6, 3.4, 9, 2), 0.6, 4), { y: 1.7 }), '#7a3018'), sm('#ffffff', { rough: 0.7 }));
      mound.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 });
      mound.castShadow = true;
      root.add(mound);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        root.add(C(0.55, 0.1, dark, { x: Math.cos(a) * 3.0, y: 1.5, z: Math.sin(a) * 3.0, rz: Math.cos(a) * 1.0, rx: -Math.sin(a) * 1.0 }, 7));
        root.add(O(0.35, glow, { x: Math.cos(a + 0.6) * 2.4, y: 3.0, z: Math.sin(a + 0.6) * 2.4, sy: 3.2, rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4 }));
      }
      root.add(S(1.4, shell2, { y: 3.6, sy: 0.6 }, 0));
      const core = O(1.0, glowMat('#ff7a2a', 2.4), { y: 4.6, sy: 1.8 });
      root.add(core);
      parts.pulse.push(core);
      parts.anim = 'structure';
      break;
    }

    // ------------------------------------------------ FERRO
    case 'ferro_drone': {
      const steel = sm(FERRO.steel, { metal: 0.7, rough: 0.35 }), dark = sm(FERRO.dark, { metal: 0.6 });
      const body = pivot(0, 0, 0);
      root.add(body);
      body.add(S(0.45, steel, {}, 1));
      body.add(B(0.95, 0.07, 0.12, dark, { ry: Math.PI / 4 }));
      body.add(B(0.95, 0.07, 0.12, dark, { ry: -Math.PI / 4 }));
      body.add(C(0.48, 0.12, dark, {}, 8));
      for (const [x, z] of [[0.65, 0.65], [-0.65, 0.65], [0.65, -0.65], [-0.65, -0.65]]) {
        body.add(C(0.07, 0.15, dark, { x: x * 0.75, y: 0.05, z: z * 0.75 }, 5));
        const rotor = C(0.3, 0.02, sm('#9aa0aa', { metal: 0.8 }), { x: x * 0.75, y: 0.13, z: z * 0.75 }, 6);
        body.add(rotor);
        parts.spin.push(rotor);
      }
      const eye = S(0.13, glowMat(FERRO.red, 2.0), { z: 0.38 });
      body.add(eye);
      body.add(C(0.03, 0.4, dark, { y: -0.35, z: 0.2, rx: Math.PI / 2 }, 5));
      parts.body = body; parts.anim = 'flyer';
      break;
    }
    case 'ferro_trooper': {
      const steel = sm(FERRO.steel, { metal: 0.65, rough: 0.4 }), steel2 = sm(FERRO.steel2, { metal: 0.6 }), dark = sm(FERRO.dark);
      const red = glowMat(FERRO.red, 2.0);
      const b = biped(root, {
        torsoMat: steel, limbMat: steel2, jointMat: dark,
        headFn: (h, s) => {
          h.add(B(0.22, 0.2, 0.24, steel, { y: 0.1 }));
          h.add(B(0.18, 0.04, 0.03, red, { y: 0.12, z: 0.125 }));
          h.add(C(0.01, 0.2, dark, { x: 0.08, y: 0.28 }, 3));
        },
      });
      b.torso.add(B(0.3, 0.15, 0.1, steel2, { y: 0.3, z: 0.14 }));
      b.torso.add(B(0.12, 0.12, 0.04, red, { y: 0.32, z: 0.19 }));
      const gun = pivot(0, 0, 0);
      b.arms[1].fore.add(gun);
      gun.add(B(0.07, 0.1, 0.6, dark, { y: -0.3, z: 0.2 }));
      gun.add(B(0.03, 0.03, 0.04, red, { y: -0.3, z: 0.52 }));
      b.arms[0].arm.rotation.x = -1.2; b.arms[0].arm.rotation.z = 0.5;
      b.arms[1].arm.rotation.x = -1.3;
      Object.assign(parts, { anim: 'biped', legs: b.legs, arms: b.arms, head: b.head, body: b.torso, hips: b.hips, gait: 9 });
      break;
    }
    case 'ferro_brute':
    case 'ferro_titan': {
      const boss = type === 'ferro_titan';
      const s = boss ? 2.8 : 1.3;
      const steel = sm(FERRO.steel, { metal: 0.65, rough: 0.4 }), steel2 = sm(FERRO.steel2, { metal: 0.6 }), dark = sm(FERRO.dark);
      const red = glowMat(FERRO.red, 2.0), orange = glowMat(FERRO.orange, 2);
      const b = biped(root, {
        scale: s, torsoMat: steel, limbMat: steel2, jointMat: dark, torsoSize: [0.7, 0.6, 0.48], legLen: 0.5, armLen: 0.34, limbR: 0.09,
        headFn: (h, sc) => {
          h.add(B(0.26 * sc, 0.18 * sc, 0.26 * sc, steel2, { y: 0.06 * sc }));
          h.add(S(0.06 * sc, red, { y: 0.07 * sc, z: 0.13 * sc }));
        },
      });
      b.torso.add(B(0.4 * s, 0.4 * s, 0.5 * s, steel2, { x: 0.52 * s, y: 0.6 * s, z: -0.05 * s }));
      for (let i = 0; i < 4; i++) b.torso.add(C(0.05 * s, 0.05 * s, orange, { x: (0.43 + (i % 2) * 0.17) * s, y: (0.53 + Math.floor(i / 2) * 0.15) * s, z: 0.2 * s, rx: Math.PI / 2 }, 6));
      b.torso.add(B(0.5 * s, 0.25 * s, 0.1 * s, steel2, { y: 0.4 * s, z: 0.27 * s }));
      b.torso.add(S(0.08 * s, orange, { y: 0.35 * s, z: -0.28 * s }));
      if (boss) {
        b.torso.add(B(0.4 * s, 0.4 * s, 0.5 * s, steel2, { x: -0.52 * s, y: 0.6 * s, z: -0.05 * s }));
        for (let i = 0; i < 4; i++) b.torso.add(C(0.05 * s, 0.05 * s, orange, { x: -(0.43 + (i % 2) * 0.17) * s, y: (0.53 + Math.floor(i / 2) * 0.15) * s, z: 0.2 * s, rx: Math.PI / 2 }, 6));
        b.torso.add(B(0.3 * s, 0.1 * s, 0.3 * s, red, { y: 0.66 * s, z: 0.05 * s }));
      }
      // escudo / canhão
      b.arms[0].fore.add(B(0.08 * s, 0.7 * s, 0.6 * s, steel, { y: -0.3 * s, z: 0.15 * s, x: -0.06 * s }));
      b.arms[1].fore.add(C(0.07 * s, 0.6 * s, dark, { y: -0.3 * s, z: 0.25 * s, rx: Math.PI / 2 }, 6));
      b.arms[0].arm.rotation.x = -0.9;
      b.arms[1].arm.rotation.x = -1.4;
      Object.assign(parts, { anim: 'biped', legs: b.legs, arms: b.arms, head: b.head, body: b.torso, hips: b.hips, gait: boss ? 3.5 : 6 });
      break;
    }
    case 'ferro_walker': {
      const steel = sm(FERRO.steel, { metal: 0.65, rough: 0.4 }), steel2 = sm(FERRO.steel2, { metal: 0.6 }), dark = sm(FERRO.dark);
      const red = glowMat(FERRO.red, 2.0), orange = glowMat(FERRO.orange, 2.2);
      const body = pivot(0, 3.2, 0);
      root.add(body);
      body.add(B(3.0, 1.3, 4.0, steel));
      body.add(B(2.6, 0.4, 3.4, steel2, { y: 0.8 }));
      body.add(B(1.4, 0.5, 0.6, orange, { y: 0.2, z: -2.0 }));
      const turret = pivot(0, 1.25, 0.2);
      body.add(turret);
      turret.add(B(1.6, 0.8, 1.8, steel2));
      turret.add(C(0.18, 2.6, dark, { y: 0.05, z: 1.9, rx: Math.PI / 2 }, 7));
      turret.add(B(0.6, 0.12, 0.08, red, { y: 0.15, z: 0.92 }));
      parts.head = turret;
      const legs = [];
      for (const [x, z, ph] of [[1, 1, 0], [-1, 1, Math.PI], [1, -1, Math.PI], [-1, -1, 0]]) {
        const hip = pivot(x * 1.5, -0.2, z * 1.6);
        body.add(hip);
        hip.rotation.z = x * 1.1;
        hip.add(B(0.35, 2.0, 0.45, steel2, { y: -1.0 }));
        const knee = pivot(0, -2.0, 0);
        hip.add(knee);
        knee.rotation.z = -x * 1.1;
        knee.add(B(0.3, 2.6, 0.4, steel, { y: -1.3 }));
        knee.add(B(0.6, 0.2, 0.7, dark, { y: -2.6 }));
        legs.push({ hip, knee, side: x, phase: ph, baseZ: hip.rotation.z, baseK: knee.rotation.z });
      }
      Object.assign(parts, { anim: 'insect', legs, body, gait: 3 });
      break;
    }
    case 'ferro_factory': {
      const steel = sm(FERRO.steel, { metal: 0.6, rough: 0.5 }), steel2 = sm(FERRO.steel2, { metal: 0.5 }), dark = sm(FERRO.dark);
      const red = glowMat(FERRO.red, 2.0), orange = glowMat(FERRO.orange, 2);
      root.add(B(8, 4.5, 8, steel, { y: 2.25 }));
      root.add(B(8.4, 0.5, 8.4, steel2, { y: 4.6 }));
      root.add(B(3, 3, 0.3, dark, { y: 1.5, z: 4.05 }));
      root.add(B(2.6, 0.2, 0.32, orange, { y: 2.9, z: 4.06 }));
      root.add(C(0.8, 4, steel2, { x: -2.5, y: 6.5, z: -2 }, 8));
      root.add(C(0.85, 0.3, orange, { x: -2.5, y: 8.5, z: -2 }, 8));
      root.add(C(0.6, 3, steel2, { x: 2.2, y: 6, z: -2.5 }, 8));
      root.add(C(0.65, 0.3, orange, { x: 2.2, y: 7.5, z: -2.5 }, 8));
      for (const [x, z] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) root.add(S(0.2, red, { x: x * 1.02, y: 4.9, z: z * 1.02 }));
      const core = B(1.4, 1.4, 1.4, red, { y: 6.8, z: 1.6 });
      root.add(core);
      root.add(B(1.8, 0.4, 1.8, dark, { y: 5.9, z: 1.6 }));
      parts.pulse.push(core);
      parts.anim = 'structure';
      break;
    }

    // ------------------------------------------------ ECOS
    case 'ecos_wisp': {
      const robe = sm(ECOS.robe, { rough: 0.9 }), bone = sm(ECOS.bone, { rough: 0.5 });
      const cyan = glowMat(ECOS.cyan, 1.7);
      const body = pivot(0, 0, 0);
      root.add(body);
      body.add(K(0.5, 1.3, robe, { y: 0.75 }, 7));
      body.add(K(0.42, 0.5, sm(ECOS.robe2), { y: 0.1, rx: Math.PI }, 7));
      const head = pivot(0, 1.7, 0);
      body.add(head);
      head.add(S(0.21, bone, { sz: 1.1 }, 1));
      head.add(K(0.28, 0.45, robe, { y: 0.15, z: -0.05, rx: -0.25 }, 6));
      head.add(S(0.045, cyan, { x: 0.08, y: 0.0, z: 0.18 }));
      head.add(S(0.045, cyan, { x: -0.08, y: 0.0, z: 0.18 }));
      const core = S(0.14, cyan, { y: 1.15, z: 0.22 });
      body.add(core);
      parts.pulse.push(core);
      const orbit = pivot(0, 1.2, 0);
      body.add(orbit);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        orbit.add(O(0.09, glowMat(ECOS.violet, 1.5), { x: Math.cos(a) * 0.65, z: Math.sin(a) * 0.65, sy: 2 }));
      }
      Object.assign(parts, { anim: 'hover', body, head, orbit });
      break;
    }
    case 'ecos_herald': {
      const robe = sm(ECOS.robe, { rough: 0.9 }), bone = sm(ECOS.bone, { rough: 0.5 });
      const cyan = glowMat(ECOS.cyan, 1.7), violet = glowMat(ECOS.violet, 1.6);
      const body = pivot(0, 0, 0);
      root.add(body);
      body.add(K(0.55, 2.0, robe, { y: 1.0 }, 7));
      body.add(B(0.32, 0.6, 0.2, bone, { y: 1.9 }));
      const head = pivot(0, 2.45, 0);
      body.add(head);
      head.add(S(0.17, bone, { sy: 1.4 }, 1));
      head.add(B(0.16, 0.03, 0.02, cyan, { y: 0.03, z: 0.15 }));
      const halo = mesh_torus(0.45, 0.03, violet);
      halo.position.set(0, 0.15, -0.2);
      head.add(halo);
      parts.spin.push(halo);
      for (const side of [-1, 1]) {
        const arm = pivot(side * 0.3, 2.05, 0);
        body.add(arm);
        arm.add(C(0.04, 0.7, bone, { y: -0.35 }, 4));
        arm.add(S(0.08, cyan, { y: -0.75 }));
        arm.rotation.x = -0.6;
        arm.rotation.z = side * 0.3;
        parts.arms.push({ arm, side, baseX: -0.6 });
      }
      Object.assign(parts, { anim: 'hover', body, head });
      break;
    }
    case 'ecos_warden': {
      const armor = sm(ECOS.bone, { rough: 0.4, metal: 0.3 }), dark = sm(ECOS.robe2);
      const cyan = glowMat(ECOS.cyan, 1.7), violet = glowMat(ECOS.violet, 1.6);
      const body = pivot(0, 0, 0);
      root.add(body);
      body.add(K(0.9, 1.6, dark, { y: 0.8, rx: Math.PI }, 7));
      body.add(S(1.15, armor, { y: 2.2, sy: 1.15, sx: 1.1 }, 0));
      body.add(B(1.8, 0.35, 1.0, dark, { y: 2.9 }));
      const core = S(0.32, cyan, { y: 2.3, z: 0.95 });
      body.add(core);
      parts.pulse.push(core);
      const head = pivot(0, 3.7, 0.2);
      body.add(head);
      head.add(S(0.4, armor, {}, 0));
      head.add(B(0.4, 0.06, 0.05, violet, { z: 0.36 }));
      for (const side of [-1, 1]) {
        const arm = pivot(side * 1.6, 2.6, 0.3);
        body.add(arm);
        arm.add(S(0.6, armor, { y: -0.6 }, 0));
        arm.add(S(0.12, cyan, { y: -0.6, z: 0.5 }));
        parts.arms.push({ arm, side, baseX: 0 });
      }
      Object.assign(parts, { anim: 'hover', body, head });
      break;
    }
    case 'ecos_leviathan': {
      const skin = sm('#3a2a5a', { rough: 0.6 }), belly = sm(ECOS.bone, { rough: 0.5 });
      const cyan = glowMat(ECOS.cyan, 1.7), violet = glowMat(ECOS.violet, 1.6);
      const body = pivot(0, 0, 0);
      root.add(body);
      body.add(S(2.0, skin, { y: 2.6, sx: 1.0, sy: 0.85, sz: 2.0 }, 1));
      body.add(S(1.6, belly, { y: 2.0, sx: 0.9, sy: 0.5, sz: 1.8 }, 0));
      for (let i = 0; i < 4; i++) {
        body.add(S(0.14, cyan, { x: 0.9, y: 3.1, z: 2.6 - i * 0.5 }));
        body.add(S(0.14, cyan, { x: -0.9, y: 3.1, z: 2.6 - i * 0.5 }));
      }
      body.add(B(4.2, 0.12, 1.6, skin, { y: 2.8, z: -0.5 }));
      body.add(K(0.5, 1.6, violet, { y: 4.3, z: 0.3, rx: -0.3 }, 4));
      const tentacles = [];
      for (let t = 0; t < 4; t++) {
        let parent = body;
        const segs = [];
        for (let i = 0; i < 5; i++) {
          const seg = pivot(i === 0 ? (t - 1.5) * 0.6 : 0, i === 0 ? 1.4 : -0.6, i === 0 ? -1.8 : -0.4);
          seg.add(S(0.3 - i * 0.04, i === 4 ? violet : skin, {}, 0));
          parent.add(seg);
          segs.push(seg);
          parent = seg;
        }
        tentacles.push(segs);
      }
      parts.tentacles = tentacles;
      Object.assign(parts, { anim: 'hover', body, head: body });
      break;
    }
    case 'ecos_obelisk': {
      const dark = sm('#1a1028', { rough: 0.3, metal: 0.4 });
      const violet = glowMat(ECOS.violet, 1.6), cyan = glowMat(ECOS.cyan, 1.7);
      root.add(O(1.6, dark, { y: 4.5, sy: 3.2 }));
      for (let i = 0; i < 6; i++) root.add(B(0.1, 0.9, 0.05, i % 2 ? violet : cyan, { y: 2.5 + i * 0.8, z: 1.05 - Math.abs(i - 2.5) * 0.12 }));
      const r1 = mesh_torus(2.6, 0.08, violet);
      r1.position.y = 4.5; r1.rotation.x = Math.PI / 2;
      root.add(r1);
      const r2 = mesh_torus(2.0, 0.06, cyan);
      r2.position.y = 6.5; r2.rotation.x = Math.PI / 2 + 0.3;
      root.add(r2);
      parts.spin.push(r1, r2);
      const top = O(0.9, cyan, { y: 9.0, sy: 1.6 });
      root.add(top);
      parts.pulse.push(top);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        root.add(O(0.4, dark, { x: Math.cos(a) * 3, y: 0.6, z: Math.sin(a) * 3, sy: 1.6 }));
      }
      parts.anim = 'structure';
      break;
    }
    default:
      root.add(B(1, 1, 1, sm('#ff00ff'), { y: 0.5 }));
  }

  // materiais próprios para piscar ao levar dano
  const clones = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (o.material.isMeshStandardMaterial) {
      let c = clones.get(o.material);
      if (!c) { c = o.material.clone(); clones.set(o.material, c); parts.glowMats.push(c); }
      o.material = c;
    }
  });
  return { root, parts };
}

function mesh_torus(r, tube, material) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 4, 18), material);
  return m;
}
