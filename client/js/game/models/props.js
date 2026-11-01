// Geometrias de vegetação/rochas (instanciadas) e marcos gigantes do mapa
import * as THREE from 'three';
import { G, merge, xf, paint, jitter, vcMat, vcGlowMat, darken } from './kit.js';

// Retorna { solid, glow } — geometrias mescladas com cores por vértice
export function buildPropGeometry(type, vis, variant = 0) {
  const s = [], g = [];
  const seed = 11 + variant * 7;
  switch (type) {
    case 'cactus': {
      const c = '#4f8a3a', c2 = '#3f6a2e';
      s.push(G.cyl(0.32, 0.38, 3.2, 7, c, { y: 1.6 }));
      s.push(G.ico(0.32, 0, c, { y: 3.2, sy: 0.6 }));
      s.push(G.cyl(0.16, 0.18, 0.7, 6, c2, { x: 0.5, y: 1.4, rz: Math.PI / 2 }));
      s.push(G.cyl(0.18, 0.18, 1.2, 6, c, { x: 0.82, y: 1.95 }));
      s.push(G.cyl(0.15, 0.17, 0.5, 6, c2, { x: -0.42, y: 2.0, rz: Math.PI / 2 }));
      s.push(G.cyl(0.15, 0.15, 0.8, 6, c, { x: -0.62, y: 2.35 }));
      g.push(G.ico(0.13, 0, '#ff6aa8', { y: 3.45 }, 1.2));
      break;
    }
    case 'rock_big': {
      s.push(G.rock(1.5, vis.rock, seed, { y: 0.35, sx: 1.1, sy: 0.75, sz: 1.0 }, 0.45));
      s.push(G.rock(0.7, vis.rock2, seed + 3, { x: 1.2, y: 0.1, z: 0.6, sy: 0.7 }, 0.4, 0));
      break;
    }
    case 'rock_small': {
      s.push(G.rock(0.4, vis.rock2, seed, { y: 0.1, sy: 0.7 }, 0.45, 0));
      break;
    }
    case 'shrub_dry': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s.push(G.cone(0.05, 1.0, 3, '#8a6a3a', { x: Math.cos(a) * 0.2, y: 0.45, z: Math.sin(a) * 0.2, rx: Math.sin(a) * 0.6, rz: -Math.cos(a) * 0.6 }));
      }
      s.push(G.ico(0.25, 0, '#a08a4a', { y: 0.2, sy: 0.6 }));
      break;
    }
    case 'bones': {
      for (let i = 0; i < 5; i++) {
        s.push(G.torus(1.5 - i * 0.12, 0.11, 3, 7, Math.PI * 0.85, '#e8dcc0', { z: i * 0.7 - 1.4, rz: Math.PI * 0.08, y: -0.2 }));
      }
      s.push(G.box(0.25, 0.25, 4, '#d8ccb0', { y: 0.1, z: 0 }));
      break;
    }
    case 'pillar': {
      const c = vis.stone || '#c9a87a';
      s.push(G.cyl(0.85, 1.05, 5.5, 6, c, { y: 2.75 }));
      s.push(G.box(2.2, 0.5, 2.2, darken(c, 0.85), { y: 0.25 }));
      s.push(G.cyl(0.9, 0.85, 1.2, 6, darken(c, 0.92), { y: 6.0, rz: 0.25, x: 0.2 }));
      break;
    }
    case 'pine_snow': {
      s.push(G.cyl(0.18, 0.25, 1.4, 5, '#5a3e2a', { y: 0.7 }));
      const tiers = [[1.9, 2.6, 1.4], [1.45, 2.3, 2.7], [0.95, 2.0, 3.9]];
      for (const [r, h, y] of tiers) {
        s.push(G.cone(r, h, 7, variant % 2 ? '#2a5040' : '#2f5a46', { y }));
        s.push(G.cone(r * 0.62, h * 0.42, 7, '#f2f8ff', { y: y + h * 0.3 }));
      }
      break;
    }
    case 'ice_spike': {
      s.push(G.cone(1.0, 6.5, 5, '#bfe6ff', { y: 3.1, rz: 0.08 }));
      s.push(G.cone(0.55, 3.5, 5, '#d8f2ff', { x: 0.9, y: 1.6, rz: -0.35 }));
      s.push(G.cone(0.45, 2.6, 5, '#a8d8f5', { x: -0.7, y: 1.2, z: 0.3, rz: 0.45 }));
      break;
    }
    case 'crystal_ice': {
      s.push(G.rock(0.7, vis.rock2, seed, { y: 0.1, sy: 0.6 }, 0.4, 0));
      g.push(G.oct(0.5, '#7fd8ff', { y: 1.4, sx: 0.6, sy: 2.4, sz: 0.6 }, 1.1));
      g.push(G.oct(0.35, '#a8e8ff', { x: 0.5, y: 0.9, sx: 0.6, sy: 2.2, sz: 0.6, rz: -0.4 }, 1.1));
      g.push(G.oct(0.3, '#6fc8ff', { x: -0.4, y: 0.8, z: 0.2, sx: 0.6, sy: 2.0, sz: 0.6, rz: 0.5 }, 1.1));
      break;
    }
    case 'tree_jungle': {
      s.push(G.cyl(0.35, 0.6, 7.5, 6, '#5a4030', { y: 3.75 }));
      s.push(G.cone(0.9, 1.6, 5, '#4a3424', { y: 0.6 }));
      const cc = variant % 2 ? '#1f6a3a' : '#2a7a3a';
      s.push(G.ico(2.8, 0, cc, { y: 8.0, sy: 0.5 }));
      s.push(G.ico(2.2, 0, darken(cc, 0.85), { x: 1.4, y: 7.0, z: 0.6, sy: 0.55 }));
      s.push(G.ico(1.9, 0, darken(cc, 1.1), { x: -1.2, y: 7.4, z: -0.8, sy: 0.55 }));
      s.push(G.cyl(0.04, 0.04, 3, 3, '#3a6a2a', { x: 1.6, y: 5.5, z: 0.4 }));
      s.push(G.cyl(0.04, 0.04, 2.2, 3, '#3a6a2a', { x: -1.4, y: 6.0, z: -0.6 }));
      break;
    }
    case 'tree_glow': {
      s.push(G.cyl(0.14, 0.24, 2.4, 5, '#3a2f4a', { y: 1.2, rz: 0.1 }));
      s.push(G.cyl(0.1, 0.14, 2.0, 5, '#3a2f4a', { x: 0.2, y: 3.2, rz: -0.2 }));
      const gc = variant % 2 ? '#ff4fd8' : '#4fe8ff';
      g.push(G.ico(1.05, 0, gc, { x: 0.35, y: 4.6, sy: 0.75 }, 1.25));
      g.push(G.ico(0.22, 0, '#fff0a0', { x: 0.9, y: 3.6 }, 1.5));
      g.push(G.ico(0.18, 0, '#fff0a0', { x: -0.4, y: 4.2 }, 1.5));
      break;
    }
    case 'mushroom_giant': {
      s.push(G.cyl(0.42, 0.65, 5, 7, '#e8dccb', { y: 2.5 }));
      const cap = new THREE.SphereGeometry(2.6, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
      s.push(paint(xf(cap, { y: 4.7, sy: 0.55 }), variant % 2 ? '#7a3aa8' : '#a83a6a'));
      s.push(G.cyl(2.5, 2.5, 0.12, 8, '#4a2a5a', { y: 4.72 }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + variant;
        g.push(G.ico(0.22, 0, '#7fffd0', { x: Math.cos(a) * 1.5, y: 5.6 - Math.abs(Math.sin(a * 2)) * 0.2, z: Math.sin(a) * 1.5 }, 1.4));
      }
      g.push(G.cyl(2.2, 2.2, 0.06, 8, '#7fffd0', { y: 4.62 }, 0.9));
      break;
    }
    case 'fern': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s.push(G.cone(0.18, 1.6, 3, i % 2 ? '#3f8a3a' : '#2f7a34', { x: Math.cos(a) * 0.45, y: 0.5, z: Math.sin(a) * 0.45, rx: Math.sin(a) * 1.0, rz: -Math.cos(a) * 1.0, sz: 0.3 }));
      }
      break;
    }
    case 'rock_lava': {
      s.push(G.rock(1.3, '#2a2224', seed, { y: 0.4, sy: 0.8 }, 0.45));
      g.push(G.box(0.12, 0.9, 0.12, '#ff5a14', { x: 0.7, y: 0.6, z: 0.75, rz: 0.4 }, 2));
      g.push(G.box(0.1, 0.7, 0.1, '#ff7a24', { x: -0.8, y: 0.5, z: 0.5, rz: -0.6 }, 2));
      g.push(G.box(0.1, 0.6, 0.1, '#ff5a14', { x: 0.1, y: 1.2, z: -0.9, rx: 0.5 }, 2));
      break;
    }
    case 'dead_tree': {
      const c = '#2a2420';
      s.push(G.cyl(0.14, 0.28, 4.2, 5, c, { y: 2.1, rz: 0.06 }));
      s.push(G.cyl(0.06, 0.1, 1.6, 4, c, { x: 0.5, y: 3.2, rz: -0.9 }));
      s.push(G.cyl(0.05, 0.09, 1.3, 4, c, { x: -0.4, y: 2.6, rz: 1.0 }));
      s.push(G.cyl(0.05, 0.08, 1.1, 4, c, { y: 3.8, z: 0.35, rx: 0.8 }));
      g.push(G.ico(0.08, 0, '#ff7a2a', { x: 0.15, y: 1.0, z: 0.22 }, 2));
      break;
    }
    case 'crystal_fire': {
      s.push(G.rock(0.8, '#2a2022', seed, { y: 0.1, sy: 0.6 }, 0.4, 0));
      g.push(G.oct(0.45, '#ff6a2a', { y: 1.3, sx: 0.6, sy: 2.6, sz: 0.6 }, 1.5));
      g.push(G.oct(0.32, '#ff3a1a', { x: 0.45, y: 0.9, sx: 0.6, sy: 2.2, sz: 0.6, rz: -0.5 }, 1.5));
      g.push(G.oct(0.3, '#ffa03a', { x: -0.45, y: 0.8, sx: 0.6, sy: 2.0, sz: 0.6, rz: 0.5 }, 1.5));
      break;
    }
    case 'vent': {
      s.push(paint(xf(jitter(new THREE.CylinderGeometry(0.9, 2.2, 1.6, 7), 0.25, seed), { y: 0.8 }), '#3a3034'));
      g.push(G.cyl(0.75, 0.75, 0.1, 7, '#ffb03a', { y: 1.58 }, 2.2));
      break;
    }
    case 'crystal_big': {
      s.push(G.rock(1.0, vis.rock2, seed, { y: 0.1, sy: 0.5 }, 0.4, 0));
      const pink = variant % 3 === 0 ? '#ff7ad9' : variant % 3 === 1 ? '#c87aff' : '#7ad9ff';
      const spires = [[0, 0, 0.75, 6.5, 0], [0.9, 0.3, 0.5, 4.2, -0.35], [-0.8, -0.2, 0.55, 4.8, 0.3], [0.2, -0.9, 0.4, 3.2, 0.25]];
      for (const [x, z, r, h, tilt] of spires) {
        g.push(G.cyl(r, r, h, 6, pink, { x, y: h / 2, z, rz: tilt, rx: tilt * 0.5 }, 0.95));
        g.push(G.cone(r, r * 2, 6, darken(pink, 1.2), { x: x - Math.sin(tilt) * h / 2, y: h + r * 0.9 - Math.abs(tilt) * 0.3, z, rz: tilt, rx: tilt * 0.5 }, 1.05));
      }
      break;
    }
    case 'crystal_small': {
      const c = variant % 2 ? '#9a7aff' : '#ff8ae0';
      g.push(G.oct(0.22, c, { y: 0.4, sx: 0.6, sy: 2.4, sz: 0.6 }, 1.3));
      g.push(G.oct(0.16, c, { x: 0.2, y: 0.25, sx: 0.6, sy: 2, sz: 0.6, rz: -0.5 }, 1.3));
      break;
    }
    case 'tree_round': {
      s.push(G.cyl(0.16, 0.24, 2.6, 5, '#6a4a3a', { y: 1.3 }));
      const cc = vis.treeColor || (variant % 2 ? '#2fb39a' : '#3ac8a0');
      s.push(G.ico(1.7, 1, cc, { y: 3.4, sy: 0.9 }));
      s.push(G.ico(1.0, 0, darken(cc, 1.12), { x: 0.9, y: 4.2, z: 0.3 }));
      break;
    }
    case 'grass': {
      const c = vis.grassColor || '#5ab86a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + variant;
        s.push(G.cone(0.07, 0.9 + (i % 3) * 0.2, 3, i % 2 ? c : darken(c, 0.85), { x: Math.cos(a) * 0.15, y: 0.42, z: Math.sin(a) * 0.15, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3 }));
      }
      break;
    }
    case 'palm': {
      const segs = 6;
      let x = 0;
      for (let i = 0; i < segs; i++) {
        const y = i * 1.05 + 0.5;
        x = Math.pow(i / segs, 2) * 1.6;
        s.push(G.cyl(0.2 - i * 0.012, 0.24 - i * 0.012, 1.1, 6, i % 2 ? '#8a6a4a' : '#7a5a3a', { x, y, rz: -0.12 * (i / segs) * 2 }));
      }
      const top = { x: 1.6, y: segs * 1.05 + 0.2 };
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        s.push(G.cone(0.38, 3.4, 3, i % 2 ? '#3a9a4a' : '#2f8a3e', { x: top.x + Math.cos(a) * 1.3, y: top.y - 0.4, z: Math.sin(a) * 1.3, rx: Math.sin(a) * 1.9, rz: -Math.cos(a) * 1.9, sy: 1, sz: 0.25 }));
      }
      s.push(G.ico(0.18, 0, '#5a3a1a', { x: top.x + 0.2, y: top.y - 0.3, z: 0.2 }));
      s.push(G.ico(0.18, 0, '#5a3a1a', { x: top.x - 0.2, y: top.y - 0.35, z: -0.1 }));
      break;
    }
    case 'bush': {
      s.push(G.ico(0.7, 0, '#3f8f45', { y: 0.45, sy: 0.75 }));
      s.push(G.ico(0.5, 0, '#4fa050', { x: 0.55, y: 0.35, z: 0.2, sy: 0.75 }));
      s.push(G.ico(0.45, 0, '#358a3e', { x: -0.45, y: 0.3, z: -0.2, sy: 0.75 }));
      break;
    }
    case 'coral': {
      const c = variant % 2 ? '#ff7a6a' : '#ffb03a';
      s.push(G.cyl(0.12, 0.18, 1.4, 5, c, { y: 0.7 }));
      s.push(G.cyl(0.08, 0.12, 0.9, 5, c, { x: 0.3, y: 1.1, rz: -0.6 }));
      s.push(G.cyl(0.08, 0.12, 0.8, 5, c, { x: -0.25, y: 1.0, rz: 0.7 }));
      s.push(G.ico(0.2, 0, darken(c, 1.15), { y: 1.45 }));
      break;
    }
    case 'antenna': {
      s.push(G.box(1.4, 0.3, 1.4, '#4a4e58', { y: 0.15 }));
      s.push(G.cyl(0.08, 0.12, 5, 5, '#8a8f99', { y: 2.6 }));
      s.push(G.cone(0.9, 0.5, 8, '#b0b5bf', { y: 4.2, rx: Math.PI * 0.75 }));
      g.push(G.ico(0.12, 0, '#ff2a2a', { y: 5.2 }, 3));
      break;
    }
    default:
      s.push(G.box(1, 1, 1, '#ff00ff', { y: 0.5 }));
  }
  return { solid: s.length ? merge(s) : null, glow: g.length ? merge(g) : null };
}

// ---------------- marcos (meshes únicos) ----------------
export function buildLandmark(type, vis, seed = 1) {
  const s = [], g = [];
  const rock = vis.rock, rock2 = vis.rock2, stone = vis.stone || '#a0a0a0';
  switch (type) {
    case 'arch': {
      s.push(G.rock(3.2, rock, seed, { x: -7, y: 5, sx: 0.8, sy: 2.4, sz: 0.9 }, 0.35));
      s.push(G.rock(3.0, rock, seed + 1, { x: 7, y: 5, sx: 0.8, sy: 2.4, sz: 0.9 }, 0.35));
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const x = -7 + t * 14;
        const y = 11 + Math.sin(t * Math.PI) * 3.5;
        s.push(G.rock(2.4, i % 2 ? rock : rock2, seed + 10 + i, { x, y, sx: 1.1, sy: 0.7, sz: 0.9 }, 0.3));
      }
      s.push(G.rock(1.6, rock2, seed + 30, { x: -9.5, y: 0.5, z: 2 }, 0.4, 0));
      s.push(G.rock(1.2, rock2, seed + 31, { x: 9, y: 0.4, z: -2 }, 0.4, 0));
      break;
    }
    case 'bones_giant': {
      const bone = '#ece2c8', bone2 = '#cfc2a2';
      s.push(G.rock(3.4, bone, seed, { y: 2.2, z: 9, sx: 1.1, sy: 0.85, sz: 1.3 }, 0.2));
      s.push(G.ico(0.9, 0, '#2a2018', { x: 1.4, y: 3.0, z: 11.6 }));
      s.push(G.ico(0.9, 0, '#2a2018', { x: -1.4, y: 3.0, z: 11.6 }));
      s.push(G.cone(0.7, 6, 5, bone2, { x: 2.4, y: 1.2, z: 13, rx: 1.3, rz: -0.3 }));
      s.push(G.cone(0.7, 6, 5, bone2, { x: -2.4, y: 1.2, z: 13, rx: 1.3, rz: 0.3 }));
      for (let i = 0; i < 9; i++) {
        s.push(G.torus(5.6 - Math.abs(i - 3) * 0.35, 0.38, 4, 9, Math.PI * 0.9, i % 2 ? bone : bone2, { z: 4 - i * 2.4, y: -0.8, rz: Math.PI * 0.05 }));
      }
      s.push(G.box(0.9, 0.9, 24, bone2, { y: 0.4, z: -5 }));
      break;
    }
    case 'wreck': {
      const hull = '#5a5f6a', hull2 = '#3a3e48', stripe = '#d4882a';
      const root = { rx: 0.18, rz: 0.22 };
      s.push(G.box(5.5, 4, 20, hull, { y: 2.5, ...root }));
      s.push(G.cone(2.9, 6, 4, hull2, { y: 3.1, z: 12.4, rx: Math.PI / 2 + 0.18, rz: 0.22 + Math.PI / 4 }));
      s.push(G.box(5.6, 0.6, 3, stripe, { y: 4.4, z: 4, ...root }));
      s.push(G.box(12, 0.5, 5, hull2, { x: 6, y: 1.2, z: -2, rz: -0.3, rx: 0.1 }));
      s.push(G.box(4, 0.5, 4, hull2, { x: -5.5, y: 0.6, z: -1, rz: 0.5 }));
      s.push(G.cyl(1.3, 1.6, 3, 7, '#2a2d33', { x: 1.6, y: 2.4, z: -10.8, rx: Math.PI / 2 + 0.18 }));
      s.push(G.cyl(1.3, 1.6, 3, 7, '#2a2d33', { x: -1.6, y: 1.7, z: -10.8, rx: Math.PI / 2 + 0.18 }));
      g.push(G.cyl(1.0, 1.0, 0.2, 7, '#ff8a3a', { x: 1.6, y: 2.2, z: -12.3, rx: Math.PI / 2 + 0.18 }, 1.4));
      for (let i = 0; i < 6; i++) s.push(G.rock(0.8, hull2, seed + i, { x: Math.sin(i * 2.1) * 9, y: 0.2, z: Math.cos(i * 1.7) * 12 }, 0.5, 0));
      g.push(G.box(0.3, 0.3, 0.3, '#ff2a2a', { y: 5.1, z: 7 }, 3));
      break;
    }
    case 'ruin': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const h = i % 3 === 0 ? 3 + (seed % 3) : 7.5;
        s.push(G.cyl(1.0, 1.2, h, 6, stone, { x: Math.cos(a) * 10, y: h / 2, z: Math.sin(a) * 10 }));
        if (h > 5 && i % 2 === 0) {
          const b = ((i + 1) / 8) * Math.PI * 2;
          const mx = (Math.cos(a) + Math.cos(b)) * 5, mz = (Math.sin(a) + Math.sin(b)) * 5;
          s.push(G.box(8.4, 1.0, 1.6, darken(stone, 0.9), { x: mx, y: 8, z: mz, ry: -((a + b) / 2) + Math.PI / 2 }));
        }
      }
      s.push(G.cyl(2.6, 3.2, 1.2, 8, darken(stone, 0.8), { y: 0.6 }));
      s.push(G.box(1.6, 1.2, 1.6, darken(stone, 0.7), { y: 1.8 }));
      g.push(G.oct(0.6, '#5af0ff', { y: 3.4, sy: 1.6 }, 1.8));
      break;
    }
    case 'tower': {
      const m = '#6a6f7a', m2 = '#4a4e58';
      s.push(G.box(6, 1, 6, m2, { y: 0.5 }));
      for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        s.push(G.box(0.4, 26, 0.4, m, { x: x * 0.6, y: 13.5, z: z * 0.6, rx: -z * 0.03, rz: x * 0.03 }));
      }
      for (let i = 1; i < 8; i++) {
        const y = i * 3.3;
        const w = 2.6 - i * 0.12;
        s.push(G.box(w * 2, 0.2, 0.2, m2, { y, z: w * 0.95 }));
        s.push(G.box(w * 2, 0.2, 0.2, m2, { y, z: -w * 0.95 }));
        s.push(G.box(0.2, 0.2, w * 2, m2, { y, x: w * 0.95 }));
        s.push(G.box(0.2, 0.2, w * 2, m2, { y, x: -w * 0.95 }));
      }
      s.push(G.cone(2.4, 1.2, 10, '#c0c5cf', { y: 22, x: 1.2, rx: Math.PI * 0.6, rz: 0.2 }));
      s.push(G.box(2, 2, 2, m2, { y: 26.5 }));
      g.push(G.ico(0.35, 0, '#ff2a2a', { y: 28 }, 3));
      g.push(G.ico(0.25, 0, '#ff2a2a', { y: 14, x: 1.4 }, 3));
      break;
    }
    case 'monolith': {
      const dark = '#16121e';
      s.push(paint(xf(new THREE.CylinderGeometry(1.4, 2.4, 18, 4), { y: 9, ry: Math.PI / 4 }), dark));
      s.push(G.rock(3, rock2, seed, { y: 0.2, sy: 0.4 }, 0.4));
      for (let i = 0; i < 5; i++) {
        g.push(G.box(0.12, 1.6, 0.05, i % 2 ? '#c06bff' : '#5af0ff', { y: 3 + i * 3, z: 1.75 - i * 0.16, x: Math.sin(i) * 0.4 }, 2));
        g.push(G.box(0.12, 1.2, 0.05, '#c06bff', { y: 4 + i * 3, z: -1.75 + i * 0.16, x: Math.cos(i) * 0.3 }, 2));
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s.push(G.rock(0.7, dark, seed + i, { x: Math.cos(a) * 4.5, y: 6 + Math.sin(i * 1.3) * 3, z: Math.sin(a) * 4.5 }, 0.5, 0));
      }
      g.push(G.oct(0.9, '#c06bff', { y: 19.5, sy: 1.5 }, 2));
      break;
    }
  }
  const group = new THREE.Group();
  if (s.length) {
    const m = new THREE.Mesh(merge(s), vcMat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  if (g.length) group.add(new THREE.Mesh(merge(g), vcGlowMat));
  return group;
}
