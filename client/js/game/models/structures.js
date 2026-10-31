// Veículos, pontos de interesse, torres e itens coletáveis
import * as THREE from 'three';
import { stdMat, glowMat, B, C, K, S, O, pivot, darken } from './kit.js';
import { CALLINS, CALLIN_CATS } from '../../../../shared/data/callins.js';

const METAL = '#5a5f6a', METAL2 = '#383c45', DARK = '#1c1e24', LEGION = '#3fb6ff', GOLD = '#e0a020';

function shadowAll(g) {
  g.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
  return g;
}

export function buildDropPod(kind = 'player') {
  const g = new THREE.Group();
  const accent = kind === 'sentry' ? '#4cff8a' : kind === 'player' ? LEGION : '#4fb8ff';
  const m = stdMat(METAL, { metal: 0.6, rough: 0.4 }), m2 = stdMat(METAL2, { metal: 0.5 }), acc = stdMat(accent, { metal: 0.3 });
  g.add(C(0.75, 2.4, m, { y: 1.6 }, 8));
  g.add(K(0.75, 1.1, m2, { y: 0.0, rx: Math.PI }, 8));
  g.add(K(0.55, 0.7, m2, { y: 3.15 }, 8));
  g.add(B(1.54, 0.25, 1.54, acc, { y: 2.3, ry: Math.PI / 8 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(B(0.08, 1.6, 0.6, m2, { x: Math.cos(a) * 0.8, y: 1.0, z: Math.sin(a) * 0.8, ry: -a }));
  }
  g.add(B(0.5, 0.7, 0.05, glowMat(accent, 1.6), { y: 1.7, z: 0.76 }));
  const flame = K(0.5, 2.2, glowMat('#ffb070', 2.2, { additive: true, transparent: true, opacity: 0.8 }), { y: 4.5 }, 8);
  flame.castShadow = false;
  g.add(flame);
  g.userData.flame = flame;
  return shadowAll(g);
}

export function buildShuttle() {
  const g = new THREE.Group();
  const hull = stdMat('#6a707c', { metal: 0.6, rough: 0.35 }), hull2 = stdMat('#3a3f4a', { metal: 0.5 }), acc = stdMat(LEGION, { metal: 0.3 });
  const glass = glowMat('#7fd8ff', 1.2);
  g.add(B(3.2, 2.4, 11, hull, { y: 2.4 }));
  g.add(B(2.6, 1.6, 3.0, hull2, { y: 2.6, z: 6.2 }));
  g.add(B(2.0, 0.7, 1.6, glass, { y: 3.1, z: 7.0, rx: -0.3 }));
  g.add(B(12, 0.35, 3.6, hull2, { y: 3.0, z: -0.6 }));
  g.add(B(3.3, 0.3, 4, acc, { y: 3.62, z: 0 }));
  for (const x of [-5, 5]) {
    g.add(C(0.8, 3.2, hull, { x, y: 2.8, z: -0.6, rx: Math.PI / 2 }, 8));
    const f = K(0.65, 2.2, glowMat('#7fd8ff', 2.2, { additive: true, transparent: true, opacity: 0.85 }), { x, y: 2.8, z: -3.4, rx: -Math.PI / 2 }, 8);
    f.castShadow = false;
    g.add(f);
    g.userData.flames = (g.userData.flames || []).concat(f);
  }
  g.add(B(0.4, 2.6, 2.2, hull2, { y: 4.4, z: -4.6 }));
  g.add(B(2.4, 0.2, 2.8, glowMat('#ffd76a', 0.9), { y: 1.15, z: -4.2 }));
  for (const [x, z] of [[-1.3, 3], [1.3, 3], [-1.3, -3.5], [1.3, -3.5]]) {
    g.add(C(0.1, 1.2, hull2, { x, y: 0.6, z }, 5));
    g.add(B(0.5, 0.12, 0.6, hull2, { x, y: 0.06, z }));
  }
  g.add(S(0.15, glowMat('#ff3b3b', 3), { x: 6, y: 3.0, z: -0.6 }));
  g.add(S(0.15, glowMat('#4cff8a', 3), { x: -6, y: 3.0, z: -0.6 }));
  return shadowAll(g);
}

export function buildJet() {
  const g = new THREE.Group();
  const hull = stdMat('#7a808c', { metal: 0.6, rough: 0.35 }), dark = stdMat(METAL2, { metal: 0.5 });
  g.add(B(1.2, 0.9, 7, hull, { y: 0 }));
  g.add(K(0.6, 2, hull, { z: 4.4, rx: Math.PI / 2 }, 6));
  g.add(B(0.7, 0.4, 1.4, glowMat('#7fd8ff', 1.2), { y: 0.55, z: 1.8 }));
  g.add(B(9, 0.15, 2.6, dark, { z: -0.6 }));
  g.add(B(0.15, 1.6, 1.4, dark, { y: 0.9, z: -2.9 }));
  g.add(B(3.2, 0.12, 1.0, dark, { z: -3.1 }));
  g.add(K(0.45, 1.6, glowMat('#ffb070', 2.4, { additive: true, transparent: true, opacity: 0.9 }), { z: -4.3, rx: -Math.PI / 2 }, 6));
  return g;
}

export function buildMissile() {
  const g = new THREE.Group();
  g.add(C(0.7, 7, stdMat('#e8e8ec', { metal: 0.3 }), { y: 3.5 }, 8));
  g.add(K(0.7, 2, stdMat('#c83a2a'), { y: 8 }, 8));
  g.add(B(0.1, 1.6, 2.2, stdMat(METAL2), { y: 1 }));
  g.add(B(2.2, 1.6, 0.1, stdMat(METAL2), { y: 1 }));
  g.add(C(0.72, 0.5, stdMat(GOLD, { metal: 0.6 }), { y: 6.4 }, 8));
  const flame = K(0.6, 4, glowMat('#ffd070', 2.6, { additive: true, transparent: true, opacity: 0.9 }), { y: -2, rx: Math.PI }, 8);
  flame.visible = false;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

export function buildTurret(kind) {
  const g = new THREE.Group();
  const m = stdMat('#4a5048', { metal: 0.5, rough: 0.5 }), m2 = stdMat(METAL2, { metal: 0.5 }), green = glowMat('#4cff8a', 2);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(B(0.12, 0.12, 1.4, m2, { x: Math.cos(a) * 0.5, y: 0.35, z: Math.sin(a) * 0.5, ry: -a + Math.PI / 2, rx: 0.5 }));
  }
  g.add(C(0.3, 1.0, m, { y: 0.8 }, 8));
  const head = pivot(0, 1.4, 0);
  g.add(head);
  if (kind === 1) {
    head.add(B(1.0, 0.8, 1.0, m));
    for (let i = 0; i < 4; i++) head.add(C(0.12, 0.2, glowMat('#ff8a2a', 1.6), { x: -0.25 + (i % 2) * 0.5, y: -0.2 + Math.floor(i / 2) * 0.4, z: 0.5, rx: Math.PI / 2 }, 6));
  } else {
    head.add(B(0.6, 0.45, 0.8, m));
    head.add(C(0.05, 0.9, m2, { x: 0.12, y: 0.0, z: 0.8, rx: Math.PI / 2 }, 6));
    head.add(C(0.05, 0.9, m2, { x: -0.12, y: 0.0, z: 0.8, rx: Math.PI / 2 }, 6));
    head.add(B(0.4, 0.12, 0.6, m2, { y: 0.25, z: -0.1 }));
  }
  head.add(B(0.15, 0.06, 0.04, green, { y: 0.18, z: 0.42 }));
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 1.25);
  head.add(muzzle);
  g.userData.head = head;
  g.userData.muzzle = muzzle;
  return shadowAll(g);
}

export function buildBeacon(callinId) {
  const cat = CALLINS[callinId] ? CALLIN_CATS[CALLINS[callinId].cat] : CALLIN_CATS.orbital;
  const g = new THREE.Group();
  g.add(C(0.07, 0.35, stdMat(DARK, { metal: 0.6 }), { y: 0.17 }, 6));
  const light = S(0.07, glowMat(cat.color, 3), { y: 0.38 });
  g.add(light);
  g.userData.light = light;
  g.userData.color = cat.color;
  return g;
}

export function buildTerminal() {
  const g = new THREE.Group();
  const m = stdMat(METAL, { metal: 0.6 }), m2 = stdMat(METAL2);
  g.add(B(2.2, 0.4, 1.6, m2, { y: 0.2 }));
  g.add(B(1.4, 1.6, 0.8, m, { y: 1.2 }));
  g.add(B(1.2, 0.8, 0.05, glowMat('#4fd8ff', 1.4), { y: 1.5, z: 0.42, rx: -0.2 }));
  g.add(C(0.06, 2.2, m2, { x: 0.8, y: 2.1 }, 5));
  g.add(K(0.7, 0.4, stdMat('#c0c5cf', { metal: 0.6 }), { x: 0.8, y: 3.2, rx: Math.PI * 0.7 }, 10));
  g.add(S(0.1, glowMat('#ff3b3b', 3), { x: 0.8, y: 3.3 }));
  return shadowAll(g);
}

export function buildConsole() {
  const g = new THREE.Group();
  g.add(B(0.8, 1.0, 0.6, stdMat(METAL, { metal: 0.6 }), { y: 0.5 }));
  g.add(B(0.9, 0.12, 0.7, stdMat(METAL2), { y: 1.05, rx: -0.3 }));
  const screen = B(0.6, 0.04, 0.45, glowMat('#ff3b3b', 1.8), { y: 1.12, rx: -0.3 });
  g.add(screen);
  g.userData.screen = screen;
  return shadowAll(g);
}

export function buildSilo() {
  const g = new THREE.Group();
  const m = stdMat(METAL2, { metal: 0.5 }), y = stdMat('#d4a017', { metal: 0.3 });
  g.add(C(4.2, 0.6, m, { y: 0.3 }, 12));
  g.add(C(3.4, 0.2, stdMat(DARK), { y: 0.62 }, 12));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(B(0.3, 9, 0.3, stdMat(METAL, { metal: 0.6 }), { x: Math.cos(a) * 2.2, y: 4.5, z: Math.sin(a) * 2.2 }));
    g.add(B(0.8, 0.15, 0.4, y, { x: Math.cos(a) * 3.9, y: 0.65, z: Math.sin(a) * 3.9, ry: -a }));
  }
  g.add(B(4.6, 0.25, 0.25, stdMat(METAL), { y: 8.6 }));
  const missile = buildMissile();
  missile.position.y = 0.6;
  g.add(missile);
  g.userData.missile = missile;
  return shadowAll(g);
}

export function buildGenerator() {
  const g = new THREE.Group();
  const m = stdMat(METAL, { metal: 0.6 }), m2 = stdMat(METAL2);
  g.add(C(3.4, 0.6, m2, { y: 0.3 }, 10));
  g.add(C(2.2, 4, m, { y: 2.6 }, 10));
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = C(2.4, 0.25, glowMat('#4fd8ff', 1.8), { y: 1.4 + i * 1.2 }, 10);
    g.add(r);
    rings.push(r);
  }
  g.add(K(2.2, 1.4, m2, { y: 5.3 }, 10));
  g.add(S(0.5, glowMat('#4fd8ff', 2.5), { y: 6.2 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.add(B(0.5, 3.2, 0.5, m2, { x: Math.cos(a) * 3.4, y: 1.6, z: Math.sin(a) * 3.4 }));
    g.add(S(0.2, glowMat('#4fd8ff', 2.5), { x: Math.cos(a) * 3.4, y: 3.4, z: Math.sin(a) * 3.4 }));
  }
  g.userData.rings = rings;
  return shadowAll(g);
}

export function buildExtractionPad() {
  const g = new THREE.Group();
  const m = stdMat('#3a3e46', { metal: 0.4, rough: 0.6 }), y = stdMat('#d4a017');
  g.add(C(9, 0.4, m, { y: 0.2 }, 6));
  g.add(C(7.6, 0.06, y, { y: 0.42 }, 6));
  g.add(C(7.2, 0.08, m, { y: 0.44 }, 6));
  const lights = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = S(0.18, glowMat('#ff3b3b', 2.5), { x: Math.cos(a) * 8.4, y: 0.55, z: Math.sin(a) * 8.4 });
    g.add(l);
    lights.push(l);
  }
  g.add(B(1.2, 0.08, 4, y, { y: 0.5 }));
  g.add(B(4, 0.08, 1.2, y, { y: 0.5 }));
  g.userData.lights = lights;
  return shadowAll(g);
}

export function buildCache() {
  const g = new THREE.Group();
  const m = stdMat('#3a4a2a', { rough: 0.6 }), m2 = stdMat(METAL2, { metal: 0.5 });
  g.add(B(1.6, 0.8, 1.0, m, { y: 0.4 }));
  const lid = pivot(0, 0.8, -0.5);
  lid.add(B(1.65, 0.2, 1.05, m, { y: 0.1, z: 0.5 }));
  lid.add(B(0.4, 0.06, 0.06, glowMat('#ffc63a', 2.4), { y: 0.21, z: 1.0 }));
  g.add(lid);
  g.add(B(1.7, 0.1, 0.12, m2, { y: 0.2, z: 0.48 }));
  g.add(B(0.3, 0.84, 1.05, m2, { x: 0.6, y: 0.42 }));
  g.add(B(0.3, 0.84, 1.05, m2, { x: -0.6, y: 0.42 }));
  const glow = B(1.4, 0.05, 0.85, glowMat('#ffc63a', 2.2), { y: 0.82 });
  glow.visible = false;
  g.add(glow);
  g.userData.lid = lid;
  g.userData.glow = glow;
  return shadowAll(g);
}

export function buildSample() {
  const g = new THREE.Group();
  g.add(C(0.18, 0.5, stdMat(METAL, { metal: 0.6 }), { y: 0.25 }, 6));
  g.add(C(0.14, 0.36, glowMat('#6af0c8', 2), { y: 0.3 }, 6));
  g.add(C(0.2, 0.06, stdMat(METAL2), { y: 0.52 }, 6));
  return g;
}

export function buildAmmoBox() {
  const g = new THREE.Group();
  g.add(B(0.7, 0.42, 0.45, stdMat('#4a5a2a', { rough: 0.6 }), { y: 0.21 }));
  g.add(B(0.72, 0.08, 0.47, stdMat(METAL2), { y: 0.44 }));
  g.add(B(0.2, 0.2, 0.02, glowMat('#4fb8ff', 2), { y: 0.25, z: 0.235 }));
  return shadowAll(g);
}

export function buildBastion() {
  // Nave-capitânia orbital (vista da galáxia)
  const g = new THREE.Group();
  const hull = stdMat('#8a909c', { metal: 0.6, rough: 0.35 }), dark = stdMat(METAL2, { metal: 0.5 });
  g.add(B(1.0, 0.5, 5, hull));
  g.add(K(0.55, 1.8, hull, { z: 3.4, rx: Math.PI / 2 }, 4));
  g.add(B(0.7, 0.8, 1.2, dark, { y: 0.5, z: -1.2 }));
  g.add(B(3.2, 0.12, 1.4, dark, { z: -1.2 }));
  for (const x of [-0.35, 0.35]) g.add(K(0.25, 0.9, glowMat('#7fd8ff', 2.4), { x, z: -3.0, rx: -Math.PI / 2 }, 6));
  g.add(B(0.2, 0.05, 2.4, glowMat('#ffb000', 2), { y: 0.27, z: 0.6 }));
  return g;
}
