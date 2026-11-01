// Gerador de mundo determinístico. Servidor e cliente geram o MESMO mapa a partir da semente.
import { createNoise2D, fbm, ridged } from './noise.js';
import { RNG, clamp, smoothstep, lerp, hashString } from './rng.js';
import { BIOMES, PROP_DEFS } from './data/biomes.js';

export const MAP_SIZE = 1200;
export const HALF = MAP_SIZE / 2;
export const RES = 240;
export const CELL = MAP_SIZE / RES;
export const PLAY_LIMIT = 545;
const OB_CELL = 16;
const OB_N = Math.ceil(MAP_SIZE / OB_CELL);

const LANDMARKS_BY_BIOME = {
  desert: ['arch', 'bones_giant', 'wreck', 'ruin', 'monolith'],
  tundra: ['wreck', 'tower', 'ruin', 'monolith'],
  jungle: ['ruin', 'wreck', 'monolith', 'arch'],
  volcanic: ['wreck', 'tower', 'monolith', 'arch'],
  crystal: ['ruin', 'monolith', 'arch', 'tower'],
  ocean: ['wreck', 'tower', 'ruin', 'arch'],
  moon: ['wreck', 'tower', 'monolith', 'ruin'],
};

export function generateWorld({ seed, biome, missionType, decor = false }) {
  const B = BIOMES[biome] || BIOMES.desert;
  const T = B.terrain;
  const rng = new RNG(seed);
  const n1 = createNoise2D(seed + 11);
  const n2 = createNoise2D(seed + 23);
  const n3 = createNoise2D(seed + 37);
  const n4 = createNoise2D(seed + 51);
  const liquidLevel = B.liquid ? B.liquidLevel : -999;

  const craters = [];
  for (let i = 0; i < T.craters; i++) {
    craters.push({ x: rng.range(-520, 520), z: rng.range(-520, 520), r: rng.range(14, 50), d: rng.range(4, 11) });
  }

  function baseHeight(x, z) {
    const wx = x + n3(x * 0.0021, z * 0.0021) * 70;
    const wz = z + n3(x * 0.0021 + 31.7, z * 0.0021 - 12.3) * 70;
    let h = T.base;
    h += fbm(n1, wx * 0.0032, wz * 0.0032, 4) * T.hills;
    const mask = smoothstep(T.mask - 0.12, T.mask + 0.22, fbm(n2, x * 0.0014 + 7.1, z * 0.0014 - 3.3, 2) * 0.5 + 0.5);
    const r = ridged(n2, wx * 0.0055, wz * 0.0055, 4);
    h += r * r * T.mountains * mask * 1.6;
    if (T.dunes) {
      const d = Math.sin((wx * 0.8 + wz * 0.35) * 0.055 + n1(x * 0.008, z * 0.008) * 2.5);
      h += Math.pow(d * 0.5 + 0.5, 2) * T.dunes;
    }
    if (T.terrace) {
      const s = T.terrace;
      const k = h / s;
      const f = Math.floor(k);
      const t = k - f;
      h = (f + smoothstep(0.3, 0.7, t)) * s;
    }
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const dx = x - c.x, dz = z - c.z;
      const d2 = (dx * dx + dz * dz) / (c.r * c.r);
      if (d2 > 2.2) continue;
      const d = Math.sqrt(d2);
      h += -c.d * Math.max(0, 1 - d2) + c.d * 0.45 * Math.exp(-((d - 1) * (d - 1)) / 0.03);
    }
    h += n4(x * 0.045, z * 0.045) * T.rough;
    const e = Math.max(Math.abs(x), Math.abs(z)) / HALF;
    if (e > 0.8) {
      const t = smoothstep(0.8, 1.0, e);
      h += t * t * 120 + t * ridged(n4, x * 0.01, z * 0.01, 3) * 60;
    }
    return h;
  }

  function slopeAt(x, z) {
    const a = baseHeight(x + 6, z), b = baseHeight(x - 6, z);
    const c = baseHeight(x, z + 6), d = baseHeight(x, z - 6);
    return Math.max(Math.abs(a - b), Math.abs(c - d)) / 12;
  }

  // ---------------- Pontos de interesse ----------------
  const pads = [];
  const placed = [];
  const LIM = 450;

  function findSpot({ minDist = 60, maxSlope = 0.45, tries = 260, farFrom = null, farDist = 0, lim = LIM, near = null, nearR = 0 } = {}) {
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < tries; i++) {
      let x, z;
      if (near) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(nearR * 0.4, nearR);
        x = near.x + Math.cos(a) * d; z = near.z + Math.sin(a) * d;
      } else {
        x = rng.range(-lim, lim); z = rng.range(-lim, lim);
      }
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      const h = baseHeight(x, z);
      let score = 0;
      if (h < liquidLevel + 1.5) score -= 40 + (liquidLevel + 1.5 - h) * 2;
      const s = slopeAt(x, z);
      if (s > maxSlope) score -= (s - maxSlope) * 60;
      for (const p of placed) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < minDist) score -= (minDist - d);
      }
      if (farFrom) {
        const d = Math.hypot(farFrom.x - x, farFrom.z - z);
        if (d < farDist) score -= (farDist - d) * 0.5;
      }
      if (score >= 0) return { x, z };
      if (score > bestScore) { bestScore = score; best = { x, z }; }
    }
    return best;
  }

  function addPad(p, r) {
    const h0 = baseHeight(p.x, p.z);
    const h = Math.max(h0, liquidLevel + 2.5);
    pads.push({ x: p.x, z: p.z, r, h });
    placed.push(p);
    return h;
  }

  const spawn = findSpot({ lim: 420 });
  addPad(spawn, 22);

  const extraction = findSpot({ farFrom: spawn, farDist: 500, minDist: 200 });
  addPad(extraction, 30);
  extraction.consoleX = extraction.x + 9;
  extraction.consoleZ = extraction.z + 3;

  const main = [];
  const mainCount = missionType === 'purge' ? 3 : 1;
  for (let i = 0; i < mainCount; i++) {
    const s = findSpot({ farFrom: spawn, farDist: mainCount > 1 ? 200 : 270, minDist: 170 });
    const kind = missionType;
    const site = { x: s.x, z: s.z, kind };
    if (missionType === 'launch') {
      site.consoles = [0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + 0.4;
        return { x: s.x + Math.cos(a) * 16, z: s.z + Math.sin(a) * 16 };
      });
    }
    addPad(s, missionType === 'purge' ? 30 : 38);
    main.push(site);
  }

  const outposts = [];
  const outpostCount = rng.int(3, 5);
  for (let i = 0; i < outpostCount; i++) {
    const s = findSpot({ farFrom: spawn, farDist: 140, minDist: 120 });
    addPad(s, 26);
    outposts.push({ x: s.x, z: s.z });
  }

  const caches = [];
  for (let i = 0; i < 3; i++) {
    const s = findSpot({ minDist: 80, farFrom: spawn, farDist: 80 });
    addPad(s, 8);
    caches.push({ x: s.x, z: s.z });
  }

  const landmarkTypes = LANDMARKS_BY_BIOME[biome] || ['monolith'];
  const landmarks = [];
  for (let i = 0; i < 7; i++) {
    const s = findSpot({ minDist: 75, maxSlope: 0.6, lim: 500 });
    const type = landmarkTypes[i % landmarkTypes.length];
    const h = addPad(s, type === 'wreck' ? 22 : 16);
    landmarks.push({ x: s.x, z: s.z, type, rot: rng.range(0, Math.PI * 2), y: h });
  }

  const samples = [];
  for (let i = 0; i < 9; i++) {
    const s = findSpot({ minDist: 55, farFrom: spawn, farDist: 60, maxSlope: 0.7 });
    placed.push(s);
    samples.push({ x: s.x, z: s.z });
  }

  // ---------------- Altura final (com áreas niveladas) ----------------
  function heightAt(x, z) {
    let h = baseHeight(x, z);
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      const dx = x - p.x, dz = z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > p.r * p.r) continue;
      const w = 1 - smoothstep(p.r * 0.55, p.r, Math.sqrt(d2));
      h = lerp(h, p.h, w);
    }
    return h;
  }

  const N = RES + 1;
  const heights = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const z = -HALF + j * CELL;
    for (let i = 0; i < N; i++) {
      heights[j * N + i] = heightAt(-HALF + i * CELL, z);
    }
  }

  // Interpolação idêntica à triangulação da malha do terreno
  function groundAt(x, z) {
    let gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
    gx = clamp(gx, 0, RES - 0.0001);
    gz = clamp(gz, 0, RES - 0.0001);
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const h00 = heights[j * N + i];
    const h10 = heights[j * N + i + 1];
    const h01 = heights[(j + 1) * N + i];
    const h11 = heights[(j + 1) * N + i + 1];
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  // ---------------- Obstáculos ----------------
  const obstacles = [];
  const obGrid = new Array(OB_N * OB_N);
  function addObstacle(x, z, r, kind) {
    const ob = { x, z, r, kind };
    obstacles.push(ob);
    const ci = clamp(Math.floor((x + HALF) / OB_CELL), 0, OB_N - 1);
    const cj = clamp(Math.floor((z + HALF) / OB_CELL), 0, OB_N - 1);
    const k = cj * OB_N + ci;
    (obGrid[k] || (obGrid[k] = [])).push(ob);
  }

  // landmarks com colisão
  for (const lm of landmarks) {
    const c = Math.cos(lm.rot), s = Math.sin(lm.rot);
    const local = (lx, lz) => ({ x: lm.x + lx * c + lz * s, z: lm.z - lx * s + lz * c });
    if (lm.type === 'wreck') {
      for (let k = -3; k <= 3; k++) { const p = local(0, k * 3.2); addObstacle(p.x, p.z, 3.2, 'wreck'); }
    } else if (lm.type === 'ruin') {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        addObstacle(lm.x + Math.cos(a) * 10, lm.z + Math.sin(a) * 10, 1.3, 'pillar');
      }
    } else if (lm.type === 'arch') {
      const a = local(-7, 0), b = local(7, 0);
      addObstacle(a.x, a.z, 2.4, 'arch'); addObstacle(b.x, b.z, 2.4, 'arch');
    } else if (lm.type === 'bones_giant') {
      const sk = local(0, 9); addObstacle(sk.x, sk.z, 3.5, 'bones');
    } else if (lm.type === 'tower') {
      addObstacle(lm.x, lm.z, 2.6, 'tower');
    } else if (lm.type === 'monolith') {
      addObstacle(lm.x, lm.z, 2.8, 'monolith');
    }
  }
  // objetivos com colisão
  for (const m of main) {
    if (m.kind === 'uplink') addObstacle(m.x, m.z, 1.6, 'terminal');
    if (m.kind === 'defend') addObstacle(m.x, m.z, 3.2, 'generator');
    if (m.kind === 'launch') {
      addObstacle(m.x, m.z, 3.4, 'silo');
      for (const c of m.consoles) addObstacle(c.x, c.z, 0.9, 'console');
    }
  }
  addObstacle(extraction.consoleX, extraction.consoleZ, 0.9, 'console');

  function insidePad(x, z, extra = 0) {
    for (const p of pads) {
      const dx = x - p.x, dz = z - p.z;
      const rr = p.r * 0.8 + extra;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  // ---------------- Vegetação / rochas ----------------
  const props = [];
  for (const pd of B.props) {
    if (pd.decor && !decor) continue;
    const def = PROP_DEFS[pd.type] || { r: 0 };
    const prng = new RNG(seed ^ hashString(pd.type));
    const dn = createNoise2D((seed ^ hashString(pd.type + '#')) >>> 0);
    let count = 0, tries = 0;
    while (count < pd.count && tries < pd.count * 5) {
      tries++;
      const x = prng.range(-HALF + 15, HALF - 15);
      const z = prng.range(-HALF + 15, HALF - 15);
      const dens = dn(x * 0.006, z * 0.006) * 0.5 + 0.5;
      if (prng.float() > dens * dens * 1.8 + 0.05) continue;
      const y = groundAt(x, z);
      if (pd.underwater) {
        if (!B.liquid || y > liquidLevel - 0.6) continue;
      } else if (y < liquidLevel + 0.35) continue;
      if (pd.minH !== undefined && y < pd.minH) continue;
      if (pd.maxH !== undefined && y > pd.maxH) continue;
      if (insidePad(x, z, def.r > 0 ? 3 : 0)) continue;
      const big = pd.type === 'rock_big' || pd.type === 'crystal_big' || pd.type === 'rock_lava';
      const s = big ? prng.range(0.6, 2.1) : prng.range(0.7, 1.35);
      props.push({ t: pd.type, x, y, z, s, r: prng.range(0, Math.PI * 2), v: prng.float() });
      if (def.r > 0) addObstacle(x, z, def.r * s, pd.type);
      count++;
    }
  }

  function collide(pos, radius) {
    const ci = Math.floor((pos.x + HALF) / OB_CELL);
    const cj = Math.floor((pos.z + HALF) / OB_CELL);
    let hit = false;
    for (let dj = -1; dj <= 1; dj++) {
      const j = cj + dj;
      if (j < 0 || j >= OB_N) continue;
      for (let di = -1; di <= 1; di++) {
        const i = ci + di;
        if (i < 0 || i >= OB_N) continue;
        const cell = obGrid[j * OB_N + i];
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          const ob = cell[k];
          const dx = pos.x - ob.x, dz = pos.z - ob.z;
          const min = ob.r + radius;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.001;
            const push = min - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  // Raio contra obstáculos (cilindros) — retorna distância ou Infinity
  function rayObstacles(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = Infinity;
    const steps = Math.ceil(maxDist / OB_CELL) + 1;
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const px = ox + dx * s * OB_CELL, pz = oz + dz * s * OB_CELL;
      const ci = Math.floor((px + HALF) / OB_CELL), cj = Math.floor((pz + HALF) / OB_CELL);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= OB_N || j >= OB_N) continue;
        const k = j * OB_N + i;
        if (seen.has(k)) continue;
        seen.add(k);
        const cell = obGrid[k];
        if (!cell) continue;
        for (const ob of cell) {
          // interseção raio 2D x círculo
          const fx = ox - ob.x, fz = oz - ob.z;
          const a = dx * dx + dz * dz;
          if (a < 1e-6) continue;
          const b = 2 * (fx * dx + fz * dz);
          const c = fx * fx + fz * fz - ob.r * ob.r * 0.8;
          const disc = b * b - 4 * a * c;
          if (disc < 0) continue;
          const t = (-b - Math.sqrt(disc)) / (2 * a);
          if (t < 0 || t > maxDist || t >= best) continue;
          const hy = oy + dy * t;
          const gy = groundAt(ob.x, ob.z);
          const top = gy + obstacleHeight(ob);
          if (hy < top) best = t;
        }
      }
      if (best < s * OB_CELL) break;
    }
    return best;
  }

  function obstacleHeight(ob) {
    switch (ob.kind) {
      case 'rock_big': case 'rock_lava': return ob.r * 1.1;
      case 'crystal_big': return ob.r * 4;
      case 'cactus': return 4;
      case 'pillar': return 7;
      case 'wreck': return 6;
      case 'tower': return 30;
      case 'monolith': return 18;
      case 'arch': return 14;
      case 'bones': return 6;
      case 'console': return 1.3;
      case 'terminal': return 2.6;
      case 'generator': return 5;
      case 'silo': return 4;
      default: return 9;
    }
  }

  function terrainRay(ox, oy, oz, dx, dy, dz, maxDist) {
    let step = 1.5;
    let prevT = 0;
    for (let t = step; t <= maxDist; t += step) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y < groundAt(x, z)) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 8; k++) {
          const mid = (lo + hi) / 2;
          if (oy + dy * mid < groundAt(ox + dx * mid, oz + dz * mid)) hi = mid; else lo = mid;
        }
        return hi;
      }
      prevT = t;
      if (t > 40) step = 3;
    }
    return Infinity;
  }

  function isDeep(x, z) {
    return B.liquid && B.liquid !== 'ice' && groundAt(x, z) < liquidLevel - 1.2;
  }
  function inLiquid(x, z) {
    return B.liquid && B.liquid !== 'ice' && groundAt(x, z) < liquidLevel - 0.15;
  }

  const timeRoll = rng.float();
  const timeOfDay = timeRoll < 0.22 ? 'dawn' : timeRoll < 0.6 ? 'day' : timeRoll < 0.82 ? 'dusk' : 'night';

  return {
    seed, biome, missionType, B, liquid: B.liquid, liquidLevel, timeOfDay,
    heights, N, RES, CELL, HALF, MAP_SIZE, PLAY_LIMIT,
    groundAt, heightAt, collide, rayObstacles, terrainRay, isDeep, inLiquid,
    obstacles, props, pads,
    spawn, extraction, main, outposts, caches, landmarks, samples,
  };
}
