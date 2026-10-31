// Malha do terreno (low poly facetado), líquidos animados e minimapa
import * as THREE from 'three';
import { createNoise2D } from '../../../shared/noise.js';

const C = (hex) => new THREE.Color(hex);

function makeColorFn(world, vis) {
  const g = vis.ground;
  const P = { low: C(g.low), mid: C(g.mid), high: C(g.high), peak: C(g.peak), slope: C(g.slope), shore: C(g.shore), detail: C(g.detail) };
  const noise = createNoise2D(world.seed + 999);
  const L = world.liquid ? world.liquidLevel : -6;
  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  return function color(h, ny, x, z, out) {
    const hn = h + noise(x * 0.012, z * 0.012) * 3;
    const t = (hn - Math.max(L, -6)) / 70;
    if (t < 0.12) out.copy(P.low).lerp(P.mid, Math.max(0, t / 0.12));
    else if (t < 0.4) out.copy(P.mid).lerp(P.high, (t - 0.12) / 0.28);
    else if (t < 0.75) out.copy(P.high).lerp(P.peak, (t - 0.4) / 0.35);
    else out.copy(P.peak);
    const dn = noise(x * 0.035 + 40, z * 0.035 - 17);
    if (dn > 0.35) out.lerp(P.detail, Math.min(1, (dn - 0.35) * 2.5) * 0.6);
    if (world.liquid && hn < L + 1.6) out.lerp(P.shore, Math.min(1, (L + 1.6 - hn) / 1.4));
    if (ny < 0.82) out.lerp(P.slope, Math.min(1, (0.82 - ny) / 0.22));
    return out;
  };
}

export function buildTerrain(world, vis) {
  const { heights, N, RES, CELL, HALF } = world;
  const tris = RES * RES * 2;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const colorFn = makeColorFn(world, vis);
  const c = new THREE.Color();
  let k = 0;
  let seed = world.seed | 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) % 1000) / 1000;
  };
  const tri = (ax, az, ah, bx, bz, bh, cx, cz, ch) => {
    const ux = bx - ax, uy = bh - ah, uz = bz - az;
    const vx = cx - ax, vy = ch - ah, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    colorFn((ah + bh + ch) / 3, Math.abs(ny) / l, (ax + bx + cx) / 3, (az + bz + cz) / 3, c);
    const j = 0.93 + rand() * 0.12;
    const r = c.r * j, g = c.g * j, b = c.b * j;
    pos[k] = ax; pos[k + 1] = ah; pos[k + 2] = az;
    pos[k + 3] = bx; pos[k + 4] = bh; pos[k + 5] = bz;
    pos[k + 6] = cx; pos[k + 7] = ch; pos[k + 8] = cz;
    for (let q = 0; q < 3; q++) { col[k + q * 3] = r; col[k + q * 3 + 1] = g; col[k + q * 3 + 2] = b; }
    k += 9;
  };
  for (let j = 0; j < RES; j++) {
    const z0 = -HALF + j * CELL, z1 = z0 + CELL;
    for (let i = 0; i < RES; i++) {
      const x0 = -HALF + i * CELL, x1 = x0 + CELL;
      const h00 = heights[j * N + i], h10 = heights[j * N + i + 1];
      const h01 = heights[(j + 1) * N + i], h11 = heights[(j + 1) * N + i + 1];
      tri(x0, z0, h00, x0, z1, h01, x1, z0, h10);
      tri(x1, z0, h10, x0, z1, h01, x1, z1, h11);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

export function buildLiquid(world, vis) {
  if (!vis.liquid || !world.liquid) return null;
  const kind = vis.liquid.kind;
  const size = world.MAP_SIZE * 1.3;
  const geo = new THREE.PlaneGeometry(size, size, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const uniforms = { uTime: { value: 0 } };
  let mat;
  if (kind === 'ice') {
    mat = new THREE.MeshStandardMaterial({ color: vis.liquid.color, roughness: 0.12, metalness: 0.15, flatShading: true });
  } else {
    const params = {
      water: { color: vis.liquid.color, roughness: 0.08, metalness: 0.25, transparent: true, opacity: vis.liquid.opacity, amp: 0.35 },
      toxic: { color: vis.liquid.color, roughness: 0.2, metalness: 0.1, transparent: true, opacity: vis.liquid.opacity, emissive: '#3aff1a', ei: 0.35, amp: 0.2 },
      lava: { color: '#ff4a00', roughness: 0.6, metalness: 0, transparent: false, opacity: 1, emissive: '#ff5a10', ei: 1.6, amp: 0.25 },
    }[kind];
    mat = new THREE.MeshStandardMaterial({
      color: params.color, roughness: params.roughness, metalness: params.metalness, flatShading: true,
      transparent: params.transparent, opacity: params.opacity,
      emissive: params.emissive || '#000000', emissiveIntensity: params.ei || 0,
    });
    const amp = params.amp;
    const speed = kind === 'lava' ? 0.35 : 1.0;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float tt = uTime * ${speed.toFixed(2)};
         transformed.y += (sin(position.x * 0.09 + tt * 1.3) + cos(position.z * 0.075 + tt * 0.9)) * ${amp.toFixed(2)}
                       + sin((position.x + position.z) * 0.17 + tt * 2.1) * ${(amp * 0.4).toFixed(2)};`
      );
      if (kind === 'lava') {
        shader.fragmentShader = 'uniform float uTime;\n' + shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float lv = sin(vViewPosition.x * 0.05 + uTime * 0.6) * sin(vViewPosition.y * 0.07 - uTime * 0.4);
           totalEmissiveRadiance *= 0.75 + 0.45 * lv;`
        );
      }
    };
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = world.liquidLevel;
  mesh.receiveShadow = kind !== 'lava';
  return { mesh, update: (t) => { uniforms.uTime.value = t; } };
}

export function buildMinimapCanvas(world, vis, size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const colorFn = makeColorFn(world, vis);
  const c = new THREE.Color();
  const liq = vis.liquid ? new THREE.Color(vis.liquid.color) : null;
  const scale = world.MAP_SIZE / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = -world.HALF + (px + 0.5) * scale;
      const z = -world.HALF + (py + 0.5) * scale;
      const h = world.groundAt(x, z);
      const hx = world.groundAt(x + scale, z);
      const hz = world.groundAt(x, z + scale);
      const slope = Math.min(1, Math.hypot(hx - h, hz - h) / scale);
      colorFn(h, 1 - slope * 0.6, x, z, c);
      if (liq && h < world.liquidLevel) c.copy(liq).multiplyScalar(0.7);
      const shade = 1 + (h - hx) * 0.06 + (h - hz) * 0.06;
      const i = (py * size + px) * 4;
      img.data[i] = Math.min(255, Math.max(0, Math.pow(c.r, 1 / 2.2) * 255 * shade));
      img.data[i + 1] = Math.min(255, Math.max(0, Math.pow(c.g, 1 / 2.2) * 255 * shade));
      img.data[i + 2] = Math.min(255, Math.max(0, Math.pow(c.b, 1 / 2.2) * 255 * shade));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
