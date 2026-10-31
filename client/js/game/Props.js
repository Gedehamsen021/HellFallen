// Vegetação e rochas instanciadas, divididas em blocos para culling por distância
import * as THREE from 'three';
import { buildPropGeometry, buildLandmark } from './models/props.js';
import { vcMat, vcGlowMat } from './models/kit.js';

const CHUNK = 200;
const SHADOW_TYPES = new Set(['cactus', 'rock_big', 'pillar', 'pine_snow', 'ice_spike', 'tree_jungle', 'tree_glow', 'mushroom_giant', 'rock_lava', 'dead_tree', 'crystal_big', 'tree_round', 'palm', 'antenna', 'vent', 'crystal_ice', 'crystal_fire', 'bones']);
const TILT_TYPES = new Set(['rock_big', 'rock_small', 'rock_lava', 'crystal_small', 'bones']);

export class PropField {
  constructor(scene, world, vis, quality = 'alta') {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.chunks = [];
    const geoCache = new Map();
    const getGeo = (type, variant) => {
      const key = type + ':' + variant;
      if (!geoCache.has(key)) geoCache.set(key, buildPropGeometry(type, vis, variant));
      return geoCache.get(key);
    };
    const density = quality === 'baixa' ? 0.5 : 1;
    const buckets = new Map();
    for (let i = 0; i < world.props.length; i++) {
      const p = world.props[i];
      if (density < 1 && (i % 2 === 1) && !SHADOW_TYPES.has(p.t)) continue;
      const cx = Math.floor((p.x + world.HALF) / CHUNK), cz = Math.floor((p.z + world.HALF) / CHUNK);
      const variant = p.v < 0.5 ? 0 : 1;
      const key = cx + ',' + cz + ':' + p.t + ':' + variant;
      let b = buckets.get(key);
      if (!b) { b = { cx, cz, type: p.t, variant, list: [] }; buckets.set(key, b); }
      b.list.push(p);
    }
    const chunkMap = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    for (const b of buckets.values()) {
      const geo = getGeo(b.type, b.variant);
      const ckey = b.cx + ',' + b.cz;
      let chunk = chunkMap.get(ckey);
      if (!chunk) {
        chunk = { center: new THREE.Vector3(-world.HALF + (b.cx + 0.5) * CHUNK, 0, -world.HALF + (b.cz + 0.5) * CHUNK), meshes: [] };
        chunkMap.set(ckey, chunk);
        this.chunks.push(chunk);
      }
      const makeIM = (g, mat, shadow) => {
        const im = new THREE.InstancedMesh(g, mat, b.list.length);
        for (let i = 0; i < b.list.length; i++) {
          const p = b.list[i];
          const tilt = TILT_TYPES.has(p.t) ? (p.v - 0.5) * 0.5 : (p.v - 0.5) * 0.08;
          e.set(tilt, p.r, tilt * 0.6);
          q.setFromEuler(e);
          s.setScalar(p.s);
          v.set(p.x, p.y - (TILT_TYPES.has(p.t) ? 0.15 * p.s : 0.05), p.z);
          m.compose(v, q, s);
          im.setMatrixAt(i, m);
          if (mat === vcMat) {
            const k = 0.86 + ((p.v * 7.31) % 1) * 0.24;
            col.setRGB(k, k, k);
            im.setColorAt(i, col);
          }
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = shadow && quality !== 'baixa';
        im.receiveShadow = mat === vcMat;
        this.group.add(im);
        chunk.meshes.push(im);
      };
      if (geo.solid) makeIM(geo.solid, vcMat, SHADOW_TYPES.has(b.type));
      if (geo.glow) makeIM(geo.glow, vcGlowMat, false);
    }

    // marcos gigantes
    this.landmarks = [];
    for (const lm of world.landmarks) {
      const g = buildLandmark(lm.type, vis, Math.floor(lm.x * 13 + lm.z * 7));
      g.position.set(lm.x, world.groundAt(lm.x, lm.z) - 0.3, lm.z);
      g.rotation.y = lm.rot;
      scene.add(g);
      this.landmarks.push(g);
    }
    this.cullDist = (vis.fog[1] || 500) + CHUNK * 0.8;
  }

  update(camPos) {
    const cd2 = this.cullDist * this.cullDist;
    for (const c of this.chunks) {
      const dx = c.center.x - camPos.x, dz = c.center.z - camPos.z;
      const vis = dx * dx + dz * dz < cd2;
      for (const m of c.meshes) m.visible = vis;
    }
  }
}
