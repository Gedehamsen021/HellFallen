// Simulação autoritativa de uma missão.
// Roda no servidor (multiplayer) ou no navegador (modo solo) — sem dependência de Three.js.
import { generateWorld, PLAY_LIMIT } from '../world.js';
import { ENEMIES, ENEMY_INDEX, ROSTER } from '../data/enemies.js';
import { CALLINS } from '../data/callins.js';
import { GRENADES, WEAPONS } from '../data/weapons.js';
import { DIFFICULTIES } from '../data/progression.js';
import { FACTIONS } from '../data/factions.js';
import { RNG, clamp, angleLerp } from '../rng.js';

export const SIM_TICK = 1 / 20;
export const SNAP_EVERY = 2;
const ACTIVE_RANGE = 230;
const DESPAWN_RANGE = 420;

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

const PROJ_GRAVITY = { grenade: 22, beacon: 22, gl: 18, acid: 14, cannon: 4 };
const CONTACT_KINDS = { rocket: 1, gl: 1, plasma: 1, trocket: 1 };

export class MissionSim {
  constructor(cfg) {
    this.cfg = cfg;
    this.world = cfg.world || generateWorld({ seed: cfg.seed, biome: cfg.biome, missionType: cfg.type });
    this.rng = new RNG((cfg.seed * 7 + 13) >>> 0);
    this.diff = DIFFICULTIES[clamp(cfg.difficulty | 0, 1, 10) - 1];
    this.roster = ROSTER[cfg.faction] || ROSTER.vorr;
    this.dmgScale = 0.75 + this.diff.lvl * 0.05;
    this.time = 0;
    this.tickCount = 0;
    this.timeLimit = (24 + cfg.difficulty) * 60;
    this.players = new Map();
    this.enemies = new Map();
    this.projectiles = new Map();
    this.turrets = new Map();
    this.zones = [];
    this.timers = [];
    this.pickups = new Map();
    this.objectives = [];
    this.events = [];
    this.nextId = 1;
    this.reinforcements = this.diff.reinf + (cfg.bonusReinf || 0);
    const w = this.world;
    this.extraction = { state: 'locked', x: w.extraction.x, z: w.extraction.z, timer: 0, wave: 0 };
    this.ended = false;
    this.result = null;
    this.patrolTimer = 40;
    this.breachCooldown = 25;
    this.noSupport = false;
    this.cachesOpened = new Set();
    this.setupObjectives();
    this.populate();
    for (let i = 0; i < w.samples.length; i++) {
      const s = w.samples[i];
      this.addPickup('sample', s.x, s.z, { n: 1 });
    }
  }

  // ------------------------------------------------------------------ util
  emit(type, data) {
    data.type = type;
    this.events.push(data);
  }
  after(delay, fn) {
    this.timers.push({ at: this.time + delay, fn });
  }
  msg(text, style = 'info', to = null) {
    this.emit('msg', { text, s: style, to });
  }
  alivePlayers() {
    const out = [];
    for (const p of this.players.values()) if (p.alive && !p.onboard) out.push(p);
    return out;
  }
  ground(x, z) {
    return this.world.groundAt(x, z);
  }
  validLand(x, z) {
    if (Math.abs(x) > PLAY_LIMIT || Math.abs(z) > PLAY_LIMIT) return false;
    const w = this.world;
    if (w.liquid && w.liquid !== 'ice' && w.groundAt(x, z) < w.liquidLevel + 0.3) return false;
    return true;
  }
  findLandNear(x, z, minR, maxR, tries = 20) {
    for (let i = 0; i < tries; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(minR, maxR);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (this.validLand(px, pz)) return { x: px, z: pz };
    }
    return null;
  }

  // ------------------------------------------------------------------ setup
  setupObjectives() {
    const w = this.world, R = this.roster, type = this.cfg.type;
    if (type === 'purge') {
      const targets = w.main.map((s) => this.spawnEnemy(R.structure, s.x, s.z, { guard: true, main: true }).id);
      this.objectives.push({ id: 'main', kind: 'destroy', main: true, label: `Destruir ${R.structureName}s Primários`, targets, total: targets.length, count: 0, done: false, x: w.main[0].x, z: w.main[0].z });
    } else if (type === 'uplink') {
      const s = w.main[0];
      this.objectives.push({ id: 'main', kind: 'uplink', main: true, label: 'Transmitir os dados do terminal', x: s.x, z: s.z, r: 15, state: 'idle', progress: 0, duration: 95 + this.diff.lvl * 6, wave: 8, done: false });
    } else if (type === 'launch') {
      const s = w.main[0];
      this.objectives.push({ id: 'main', kind: 'launch', main: true, label: 'Ativar os consoles do Farol', x: s.x, z: s.z, consoles: s.consoles.map((c) => ({ x: c.x, z: c.z, on: false })), state: 'consoles', timer: 60 + this.diff.lvl * 3, wave: 6, done: false });
    } else if (type === 'eliminate') {
      const s = w.main[0];
      const boss = this.spawnEnemy(R.boss, s.x, s.z, { guard: true, boss: true });
      this.objectives.push({ id: 'main', kind: 'eliminate', main: true, label: `Eliminar: ${ENEMIES[R.boss].name}`, target: boss.id, x: s.x, z: s.z, done: false });
    } else if (type === 'defend') {
      const s = w.main[0];
      const hp = 3500 + this.diff.lvl * 200;
      this.objectives.push({ id: 'main', kind: 'defend', main: true, label: 'Ativar e defender o gerador', x: s.x, z: s.z, state: 'idle', hp, maxHp: hp, timer: 140 + this.diff.lvl * 8, wave: 6, done: false });
    }
    w.outposts.forEach((o, i) => {
      const st = this.spawnEnemy(R.structure, o.x, o.z, { guard: true });
      this.objectives.push({ id: 'op' + i, kind: 'destroy', optional: true, label: `${R.structureName} avançado`, targets: [st.id], total: 1, count: 0, done: false, x: o.x, z: o.z });
    });
  }

  populate() {
    const w = this.world, d = this.diff;
    const [gmin, gmax] = d.groupSize;
    for (const s of w.main) this.spawnGroup(s.x, s.z, this.rng.int(gmin + 1, gmax + 2), { guard: true, spread: 18 });
    for (const o of w.outposts) this.spawnGroup(o.x, o.z, this.rng.int(gmin, gmax + 1), { guard: true, spread: 14 });
    for (let i = 0; i < d.patrols; i++) {
      for (let k = 0; k < 10; k++) {
        const x = this.rng.range(-480, 480), z = this.rng.range(-480, 480);
        if (Math.hypot(x - w.spawn.x, z - w.spawn.z) < 130) continue;
        if (!this.validLand(x, z)) continue;
        this.spawnGroup(x, z, this.rng.int(gmin, gmax), { guard: true, spread: 10 });
        break;
      }
    }
  }

  pickType() {
    const r = this.rng.float();
    const R = this.roster;
    if (r < this.diff.heavy) return this.rng.pick(R.heavy);
    if (r < this.diff.heavy + this.diff.mid) return this.rng.pick(R.mid);
    return this.rng.pick(R.fodder);
  }

  spawnGroup(x, z, size, opts = {}) {
    const out = [];
    const spread = opts.spread || 6;
    for (let i = 0; i < size; i++) {
      const p = this.findLandNear(x, z, 0, spread, 8) || { x, z };
      out.push(this.spawnEnemy(opts.type || this.pickType(), p.x, p.z, opts));
    }
    return out;
  }

  spawnEnemy(type, x, z, opts = {}) {
    const def = ENEMIES[type];
    const hpMult = def.structure ? 0.8 + this.diff.lvl * 0.04 : this.diff.hpMult;
    const e = {
      id: this.nextId++, type, ti: ENEMY_INDEX[type], def,
      x, z, y: this.ground(x, z) + (def.hover || 0) + (def.fly || 0), rot: this.rng.range(-Math.PI, Math.PI),
      hp: def.hp * hpMult, maxHp: def.hp * hpMult,
      state: opts.state || (opts.target ? 'alert' : 'idle'),
      home: { x, z }, goal: opts.goal || null, target: opts.target || null, targetGen: !!opts.targetGen,
      guard: !!opts.guard, main: !!opts.main, boss: !!opts.boss,
      cd: this.rng.range(0.5, (def.cd || 2) + 1), t: this.rng.range(0, 10), atk: 0,
      mode: 'approach', modeT: 0, burstLeft: 0, burstT: 0, strafe: this.rng.sign(), strafeT: 2,
      orbitA: this.rng.range(0, Math.PI * 2), blinkCd: this.rng.range(2, 5), summonT: 12,
      spawnT: this.rng.range(2, 6), wanderT: 0, called: false, alertAt: 0, sc: 0, sleep: false, hitBy: null,
      vx: 0, vz: 0, losT: 0,
    };
    if (def.structure) e.rot = 0;
    this.enemies.set(e.id, e);
    return e;
  }

  addPickup(k, x, z, extra = {}) {
    const id = this.nextId++;
    const pk = { id, k, x, y: this.ground(x, z), z, ...extra };
    this.pickups.set(id, pk);
    this.emit('pick+', { i: id, k, x: r2(x), y: r2(pk.y), z: r2(z), w: pk.w, n: pk.n });
    return pk;
  }

  // ------------------------------------------------------------------ jogadores
  addPlayer(id, info = {}) {
    const w = this.world;
    const idx = this.players.size;
    const p = {
      id, name: info.name || 'Caído', look: info.look || {},
      x: w.spawn.x + (idx % 2 ? 3 : -3), z: w.spawn.z + (idx > 1 ? 3 : -3), y: 0, rot: 0, pitch: 0, anim: 0, weapon: 0,
      hp: 100, maxHp: 100, alive: false, pending: false, respawnAt: 0,
      kills: 0, xpKills: 0, deaths: 0, samples: 0, dmg: 0, hits: 0, onboard: false, onboardT: 0,
    };
    p.y = w.groundAt(p.x, p.z);
    this.players.set(id, p);
    this.emit('pjoin', { p: id, name: p.name, look: p.look });
    this.dropPlayer(p, this.time < 3);
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    this.emit('pleave', { p: id, name: p.name });
  }

  dropPlayer(p, initial) {
    const w = this.world;
    let tx, tz;
    const anchor = this.alivePlayers().find((o) => o !== p);
    if (initial) {
      const a = this.rng.range(0, Math.PI * 2);
      tx = w.spawn.x + Math.cos(a) * this.rng.range(2, 7);
      tz = w.spawn.z + Math.sin(a) * this.rng.range(2, 7);
    } else if (anchor) {
      const pt = this.findLandNear(anchor.x, anchor.z, 5, 10) || { x: anchor.x + 4, z: anchor.z };
      tx = pt.x; tz = pt.z;
    } else {
      const pt = this.findLandNear(p.x, p.z, 4, 14) || { x: w.spawn.x, z: w.spawn.z };
      tx = pt.x; tz = pt.z;
    }
    const land = 3.2;
    p.pending = true;
    this.emit('pod', { k: 'player', p: p.id, x: r2(tx), z: r2(tz), d: land });
    this.after(land, () => {
      if (!this.players.has(p.id)) return;
      p.alive = true;
      p.pending = false;
      p.x = tx; p.z = tz; p.y = this.ground(tx, tz);
      p.hp = p.maxHp;
      this.podImpact(tx, tz, p.id);
      this.emit('respawn', { p: p.id, x: r2(tx), y: r2(p.y), z: r2(tz) });
    });
  }

  handle(pid, type, d) {
    const p = this.players.get(pid);
    if (!p || this.ended || !d) return;
    switch (type) {
      case 'state':
        if (!p.alive || p.onboard) return;
        if (typeof d.x !== 'number' || typeof d.z !== 'number') return;
        p.x = clamp(d.x, -PLAY_LIMIT - 5, PLAY_LIMIT + 5);
        p.z = clamp(d.z, -PLAY_LIMIT - 5, PLAY_LIMIT + 5);
        p.y = d.y; p.rot = d.r; p.pitch = d.p; p.anim = d.a | 0; p.weapon = d.w | 0;
        p.hp = d.hp; p.maxHp = d.mhp || 100;
        break;
      case 'hit': this.playerHit(p, d); break;
      case 'throw': this.playerThrow(p, d); break;
      case 'interact': this.playerInteract(p, d); break;
      case 'pickup': this.playerPickup(p, d); break;
      case 'died':
        if (p.alive) {
          p.alive = false;
          p.deaths++;
          p.respawnAt = this.time + 7;
          this.emit('pdeath', { p: pid, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
          if (p.samples > 0) {
            this.addPickup('sample', p.x, p.z, { n: p.samples });
            p.samples = 0;
          }
          if (d.sw && WEAPONS[d.sw]) this.addPickup('weapon', p.x + 1, p.z, { w: d.sw });
        }
        break;
      case 'shot':
        this.emit('shot', { p: pid, w: d.w, x: d.x, y: d.y, z: d.z, ex: d.ex, ey: d.ey, ez: d.ez });
        break;
      case 'ping':
        this.emit('ping', { p: pid, x: d.x, z: d.z });
        break;
    }
  }

  playerHit(p, d) {
    const e = this.enemies.get(d.e);
    if (!e || e.hp <= 0) return;
    const def = e.def;
    let dmg = clamp(+d.d || 0, 0, 4000);
    let armor = def.armor;
    if (def.frontArmor && !d.wk) {
      const fx = Math.sin(e.rot), fz = Math.cos(e.rot);
      const tx = p.x - e.x, tz = p.z - e.z;
      const l = Math.hypot(tx, tz) || 1;
      if ((fx * tx + fz * tz) / l > 0.3) armor += 1;
    }
    if (d.wk) armor -= 1;
    const pen = d.pen | 0;
    if (pen < armor) dmg *= 0.2;
    if (def.structure && d.k !== 'x') dmg *= pen >= 4 ? 0.6 : 0.12;
    p.hits++;
    p.dmg += dmg;
    this.damageEnemy(e, dmg, p.id);
  }

  damageEnemy(e, dmg, by) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    if (by && this.players.has(by) && !e.def.structure) {
      if (e.state !== 'alert') {
        e.state = 'alert';
        e.alertAt = this.time;
        e.target = by;
        this.alertNear(e, 24, by);
      } else if (!e.target || this.rng.chance(0.15)) {
        e.target = by;
      }
    }
    if (e.hp <= 0) this.killEnemy(e, by);
  }

  killEnemy(e, by) {
    this.enemies.delete(e.id);
    this.emit('kill', { e: e.id, t: e.ti, by: by || null, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: r2(e.rot) });
    const p = by ? this.players.get(by) : null;
    if (p) {
      p.kills++;
      p.xpKills += e.def.xp;
    }
    if (e.def.structure) {
      this.explode(e.x, e.y + 2, e.z, 7, 300, by, 'structure', 5, true);
      this.msg(`${e.def.name} destruído!`, 'good');
    }
  }

  alertNear(src, r, target) {
    for (const o of this.enemies.values()) {
      if (o === src || o.def.structure || o.state === 'alert') continue;
      const dx = o.x - src.x, dz = o.z - src.z;
      if (dx * dx + dz * dz < r * r) {
        o.state = 'alert';
        o.alertAt = this.time;
        o.target = target;
      }
    }
  }

  playerThrow(p, d) {
    if (!p.alive) return;
    const k = d.k;
    const pr = {
      id: this.nextId++, k, owner: p.id, x: +d.x, y: +d.y, z: +d.z, vx: +d.vx, vy: +d.vy, vz: +d.vz,
      life: 14, tag: d.tag, dmg: 0, splash: 0, pen: 3, fuse: 99, impact: false, c: null, g: null,
    };
    if (![pr.x, pr.y, pr.z, pr.vx, pr.vy, pr.vz].every(Number.isFinite)) return;
    const m = clamp(+d.m || 1, 0.5, 2.5);
    const rm = clamp(+d.rm || 1, 0.5, 2);
    if (k === 'grenade') {
      const G = GRENADES[d.g] || GRENADES.frag;
      pr.g = G.id; pr.dmg = G.dmg * m; pr.splash = G.radius * rm; pr.fuse = G.impact ? 99 : G.fuse; pr.impact = !!G.impact; pr.fire = !!G.fire;
    } else if (k === 'beacon') {
      if (this.noSupport) { this.msg('O Bastião deixou a órbita — sem chamados disponíveis.', 'bad', p.id); return; }
      if (!CALLINS[d.c]) return;
      pr.c = d.c;
    } else if (k === 'rocket') {
      const W = WEAPONS.rl8; pr.dmg = W.dmg * m; pr.splash = W.splash; pr.pen = W.pen; pr.life = 5;
    } else if (k === 'gl') {
      const W = WEAPONS.gl6; pr.dmg = W.dmg * m; pr.splash = W.splash; pr.pen = W.pen; pr.life = 6;
    } else if (k === 'plasma') {
      const W = WEAPONS.pl2; pr.dmg = W.dmg * m; pr.splash = W.splash; pr.pen = W.pen; pr.life = 2.5;
    } else return;
    this.projectiles.set(pr.id, pr);
    this.emit('proj', { i: pr.id, k, x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), vx: r2(pr.vx), vy: r2(pr.vy), vz: r2(pr.vz), o: p.id, tag: d.tag, c: pr.c, g: pr.g });
  }

  playerInteract(p, d) {
    if (!p.alive) return;
    const o = String(d.o || '');
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    const main = this.objectives.find((ob) => ob.id === 'main');
    if (o === 'main' && main) {
      if (main.kind === 'uplink' && main.state === 'idle' && near(main.x, main.z, 7)) {
        main.state = 'active';
        main.label = 'Proteger a transmissão (fiquem na zona)';
        this.msg('Transmissão iniciada! Fiquem na zona até completar.', 'warn');
        this.wave(main.x, main.z, 40, 55, 1.0);
      } else if (main.kind === 'defend' && main.state === 'idle' && near(main.x, main.z, 8)) {
        main.state = 'active';
        main.label = 'Defender o gerador';
        this.msg('Gerador ativado! Ondas inimigas a caminho!', 'warn');
        this.wave(main.x, main.z, 40, 55, 1.0, true);
      }
    } else if (o.startsWith('console') && main && main.kind === 'launch' && main.state === 'consoles') {
      const c = main.consoles[+o.slice(7)];
      if (c && !c.on && near(c.x, c.z, 4.5)) {
        c.on = true;
        const left = main.consoles.filter((cc) => !cc.on).length;
        if (left > 0) this.msg(`Console ativado. Faltam ${left}.`, 'info');
        else {
          main.state = 'countdown';
          main.label = 'Defender o lançamento do Farol';
          this.msg('Ignição iniciada! Defendam o silo até o lançamento!', 'warn');
          this.wave(main.x, main.z, 40, 55, 1.2);
        }
      }
    } else if (o.startsWith('cache')) {
      const idx = +o.slice(5);
      const c = this.world.caches[idx];
      if (c && !this.cachesOpened.has(idx) && near(c.x, c.z, 4)) {
        this.cachesOpened.add(idx);
        this.emit('cache', { i: idx, by: p.id });
        this.msg(`${p.name} abriu um depósito de equipamento! Extraia para garantir o loot.`, 'good');
      }
    } else if (o === 'extract') {
      const ex = this.extraction;
      const w = this.world;
      if (ex.state === 'available' && near(w.extraction.consoleX, w.extraction.consoleZ, 5)) {
        ex.state = 'called';
        ex.timer = Math.round((50 + this.diff.lvl * 4) * (1 - (this.cfg.extractSpeed || 0)));
        ex.wave = 5;
        this.msg('Nave de extração a caminho! Segurem a posição!', 'warn');
        this.emit('extract', { s: 'called' });
      }
    }
  }

  playerPickup(p, d) {
    const pk = this.pickups.get(d.i);
    if (!pk || !p.alive) return;
    if (Math.hypot(p.x - pk.x, p.z - pk.z) > 4) return;
    this.pickups.delete(pk.id);
    if (pk.k === 'sample') p.samples += pk.n || 1;
    this.emit('pick-', { i: pk.id, by: p.id, k: pk.k, w: pk.w, n: pk.n });
  }

  // ------------------------------------------------------------------ chamados orbitais
  startCallin(pr) {
    const C = CALLINS[pr.c];
    if (!C) return;
    const x = pr.x, y = pr.y, z = pr.z;
    const owner = pr.owner;
    const delay = C.delay * (1 - (this.cfg.callinSpeed || 0));
    this.emit('beacon', { i: pr.id, c: pr.c, x: r2(x), y: r2(y), z: r2(z), d: r2(delay) });
    const op = this.players.get(owner);
    let dx = 1, dz = 0;
    if (op) {
      const l = Math.hypot(x - op.x, z - op.z);
      if (l > 0.5) { dx = (x - op.x) / l; dz = (z - op.z) / l; }
    }
    const done = () => this.emit('beaconx', { i: pr.id });
    const id = C.id;

    if (id === 'orb_precision') {
      this.after(delay, () => {
        this.emit('orb', { x: r2(x), y: r2(y), z: r2(z), k: 'precision' });
        this.after(0.4, () => { this.explode(x, y + 1, z, C.radius, C.dmg, owner, 'orbital', C.pen); done(); });
      });
    } else if (id === 'orb_solar') {
      this.after(delay, () => {
        this.emit('orb', { x: r2(x), y: r2(y), z: r2(z), k: 'solar' });
        this.after(0.6, () => { this.explode(x, y + 2, z, C.radius, C.dmg, owner, 'solar', C.pen); done(); });
      });
    } else if (id === 'orb_barrage') {
      this.after(delay, () => {
        for (let i = 0; i < C.count; i++) {
          this.after((i / C.count) * C.duration, () => {
            const a = this.rng.range(0, Math.PI * 2), r = Math.sqrt(this.rng.float()) * C.area;
            const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
            const py = this.ground(px, pz);
            this.emit('shell', { x: r2(px), y: r2(py), z: r2(pz) });
            this.after(0.55, () => this.explode(px, py + 0.5, pz, C.radius, C.dmg, owner, 'shell', C.pen));
          });
        }
        this.after(C.duration + 0.6, done);
      });
    } else if (id === 'orb_laser') {
      this.after(delay, () => {
        this.zones.push({ id: this.nextId++, kind: 'laser', x, z, r: C.radius, t: 0, life: C.duration, dps: C.dmg, owner, speed: C.speed, tick: 0 });
        done();
      });
    } else if (id === 'air_cluster' || id === 'air_napalm') {
      this.after(delay, () => {
        this.emit('jet', { x: r2(x), z: r2(z), dx: r2(dx), dz: r2(dz), k: id });
        for (let i = 0; i < C.count; i++) {
          const f = (i / (C.count - 1) - 0.5) * C.length;
          const px = x + dx * f + this.rng.range(-1.5, 1.5), pz = z + dz * f + this.rng.range(-1.5, 1.5);
          this.after(0.7 + i * 0.07, () => {
            const py = this.ground(px, pz);
            if (id === 'air_cluster') this.explode(px, py + 0.5, pz, C.radius, C.dmg, owner, 'cluster', C.pen);
            else {
              this.explode(px, py + 0.5, pz, 3, 120, owner, 'napalm', 3);
              this.zones.push({ id: this.nextId++, kind: 'fire', x: px, z: pz, r: C.radius, t: 0, life: C.duration, dps: C.dmg * 4, owner, tick: 0 });
            }
          });
        }
        this.after(1.5, done);
      });
    } else if (id === 'sentry_mg' || id === 'sentry_rocket') {
      this.emit('pod', { k: 'sentry', x: r2(x), z: r2(z), d: r2(delay) });
      this.after(delay, () => {
        this.podImpact(x, z, owner);
        const ammo = Math.round(C.ammo * (1 + (this.cfg.turretAmmo || 0)));
        this.turrets.set(pr.id, { id: pr.id, kind: id, x, y: this.ground(x, z), z, rot: 0, ammo, maxAmmo: ammo, life: C.life, cd: 1, owner, C, target: null });
        done();
      });
    } else if (id === 'shield') {
      this.after(delay, () => {
        this.zones.push({ id: this.nextId++, kind: 'shield', x, z, r: C.radius, t: 0, life: C.life, owner });
        done();
      });
    } else if (id === 'minefield') {
      this.after(delay, () => {
        for (let i = 0; i < C.count; i++) {
          const a = this.rng.range(0, Math.PI * 2), r = Math.sqrt(this.rng.float()) * C.area;
          this.zones.push({ id: this.nextId++, kind: 'mine', x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, r: 1.8, t: 0, life: C.life, owner, dmg: C.dmg, br: C.radius });
        }
        this.emit('boom', { x: r2(x), y: r2(y), z: r2(z), r: 3, k: 'mines' });
        done();
      });
    } else if (id === 'supply') {
      this.emit('pod', { k: 'supply', x: r2(x), z: r2(z), d: r2(delay) });
      this.after(delay, () => {
        this.podImpact(x, z, owner);
        const n = C.boxes + (this.cfg.supplyBoxes || 0);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.addPickup('ammo', x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6);
        }
        done();
      });
    } else if (C.cat === 'arma') {
      this.emit('pod', { k: 'weapon', x: r2(x), z: r2(z), d: r2(delay) });
      this.after(delay, () => {
        this.podImpact(x, z, owner);
        this.addPickup('weapon', x + 1.2, z, { w: C.weapon });
        done();
      });
    }
  }

  podImpact(x, z, owner) {
    const y = this.ground(x, z);
    this.emit('podland', { x: r2(x), y: r2(y), z: r2(z) });
    for (const e of [...this.enemies.values()]) {
      if (e.def.structure) continue;
      const dx = e.x - x, dz = e.z - z;
      if (dx * dx + dz * dz < Math.pow(2.8 + e.def.radius, 2)) this.damageEnemy(e, 1500, owner);
    }
    for (const p of this.alivePlayers()) {
      if (p.pending) continue;
      if (Math.hypot(p.x - x, p.z - z) < 1.6) this.emit('dmg', { p: p.id, d: 400, k: 'x', fx: r2(x), fz: r2(z) });
    }
  }

  // ------------------------------------------------------------------ dano em área
  explode(x, y, z, r, dmg, owner, kind, pen = 3, silent = false) {
    if (!silent || kind === 'structure') this.emit('boom', { x: r2(x), y: r2(y), z: r2(z), r: r2(r), k: kind });
    const isEnemy = owner === 'enemy';
    if (!isEnemy) {
      for (const e of [...this.enemies.values()]) {
        const ey = e.y + e.def.hit[0].y;
        const dx = e.x - x, dy = ey - y, dz = e.z - z;
        const reach = r + e.def.radius * 0.7;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > reach * reach) continue;
        const f = 1 - 0.6 * (Math.sqrt(d2) / reach);
        let dd = dmg * f;
        if (pen < e.def.armor) dd *= 0.35;
        this.damageEnemy(e, dd, this.players.has(owner) ? owner : null);
      }
    }
    for (const p of this.alivePlayers()) {
      if (p.pending) continue;
      const dx = p.x - x, dy = p.y + 1 - y, dz = p.z - z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < r) {
        const f = 1 - d / r;
        const base = isEnemy ? dmg : dmg * 0.5;
        const dd = Math.min(base * (0.3 + 0.7 * f), isEnemy ? dmg : 600);
        if (dd >= 1) this.emit('dmg', { p: p.id, d: Math.round(dd), k: 'x', fx: r2(x), fz: r2(z) });
      }
    }
  }

  wave(cx, cz, minR, maxR, mult = 1, targetGen = false) {
    const pt = this.findLandNear(cx, cz, minR, maxR, 30);
    if (!pt) return;
    const [gmin, gmax] = this.diff.groupSize;
    const count = Math.round(this.rng.int(gmin + 1, gmax + 2) * mult);
    const near = this.alivePlayers();
    const tgt = near.length ? this.rng.pick(near).id : null;
    this.breach(pt.x, pt.z, count, tgt, targetGen);
  }

  breach(x, z, count, target, targetGen = false) {
    this.emit('breach', { x: r2(x), y: r2(this.ground(x, z)), z: r2(z), f: this.cfg.faction });
    this.after(2.2, () => {
      if (this.ended) return;
      for (let i = 0; i < count; i++) {
        const p = this.findLandNear(x, z, 0, 6, 8) || { x, z };
        this.spawnEnemy(this.pickType(), p.x, p.z, { state: 'alert', target, targetGen });
      }
    });
  }

  // ------------------------------------------------------------------ loop principal
  update(dt) {
    if (this.ended) return;
    this.time += dt;
    this.tickCount++;

    // timers
    if (this.timers.length) {
      const due = [];
      this.timers = this.timers.filter((t) => {
        if (t.at <= this.time) { due.push(t); return false; }
        return true;
      });
      due.sort((a, b) => a.at - b.at);
      for (const t of due) t.fn();
    }

    // reforços
    for (const p of this.players.values()) {
      if (!p.alive && !p.pending && this.time >= p.respawnAt && !p.onboard) {
        if (this.reinforcements > 0 && !this.noSupport) {
          this.reinforcements--;
          this.dropPlayer(p, false);
          this.msg(`Reforço a caminho: ${p.name}`, 'info');
        }
      }
    }

    if (!this.noSupport && this.time >= this.timeLimit) {
      this.noSupport = true;
      this.msg('O Bastião deixou a órbita! Sem chamados nem reforços. Extraiam!', 'bad');
    }

    this.updateDirector(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateTurrets(dt);
    this.updateZones(dt);
    this.updateObjectives(dt);
    this.updateExtraction(dt);

    // derrota: todos mortos e sem reforços
    if (!this.ended && this.players.size > 0) {
      const anyAlive = [...this.players.values()].some((p) => p.alive || p.pending || p.onboard);
      if (!anyAlive && (this.reinforcements <= 0 || this.noSupport)) {
        const mainDone = this.objectives.filter((o) => o.main).every((o) => o.done);
        this.end(mainDone, mainDone ? 'Objetivo cumprido, mas ninguém voltou.' : 'Esquadrão aniquilado.');
      }
    }
  }

  updateDirector(dt) {
    this.breachCooldown -= dt;
    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0) {
      this.patrolTimer = this.diff.patrolEvery * this.rng.range(0.75, 1.25);
      const alive = this.alivePlayers();
      if (alive.length && this.activeCount() < this.diff.maxActive) {
        const p = this.rng.pick(alive);
        const pt = this.findLandNear(p.x, p.z, 110, 165, 20);
        if (pt) {
          const [gmin, gmax] = this.diff.groupSize;
          const goal = { x: p.x + this.rng.range(-25, 25), z: p.z + this.rng.range(-25, 25) };
          this.spawnGroup(pt.x, pt.z, this.rng.int(gmin, gmax), { state: 'patrol', goal, spread: 6 });
        }
      }
    }
  }

  activeCount() {
    let n = 0;
    for (const e of this.enemies.values()) if (!e.sleep && !e.def.structure) n++;
    return n;
  }

  updateEnemies(dt) {
    const alive = this.alivePlayers();
    const main = this.objectives.find((o) => o.id === 'main');
    const gen = main && main.kind === 'defend' && main.state === 'active' ? main : null;
    const w = this.world;
    const awake = [];

    for (const e of this.enemies.values()) {
      const def = e.def;
      let nearest = null, nd = Infinity;
      for (const p of alive) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < nd) { nd = d; nearest = p; }
      }
      if (nd > DESPAWN_RANGE && !e.guard && alive.length) {
        this.enemies.delete(e.id);
        continue;
      }
      if (nd > ACTIVE_RANGE && e.state !== 'patrol' && !e.targetGen) {
        e.sleep = true;
        e.sc = 0;
        continue;
      }
      e.sleep = false;
      if (def.structure) {
        this.updateStructure(e, dt, nd, nearest);
        continue;
      }
      awake.push(e);
      e.cd -= dt;
      e.t += dt;
      e.blinkCd -= dt;
      e.losT -= dt;

      // ---- alvo
      let target = null;
      if (e.target) {
        target = this.players.get(e.target);
        if (!target || !target.alive || target.onboard || Math.hypot(target.x - e.x, target.z - e.z) > def.aggro * 2.4) {
          e.target = null;
          target = null;
        }
      }
      const aggro = e.state === 'alert' ? def.aggro * 1.6 : def.aggro;
      if (!target && nearest && nd < aggro) {
        target = nearest;
        e.target = nearest.id;
      }
      if (target && e.state !== 'alert') {
        e.state = 'alert';
        e.alertAt = this.time;
        this.alertNear(e, 22, target.id);
      }
      // alvo: gerador
      let T = null;
      if (target) T = { x: target.x, y: target.y + 1.1, z: target.z, p: target };
      if (gen && e.targetGen) {
        const dg = Math.hypot(gen.x - e.x, gen.z - e.z);
        if (!T || Math.hypot(T.x - e.x, T.z - e.z) > 9) T = { x: gen.x, y: this.ground(gen.x, gen.z) + 2, z: gen.z, gen: true, r: 3.2, dg };
      }

      let mvx = 0, mvz = 0, spd = 0;
      let face = null;
      e.sc = 0;

      if (!T) {
        if (e.state === 'patrol' && e.goal) {
          const dx = e.goal.x - e.x, dz = e.goal.z - e.z;
          const d = Math.hypot(dx, dz);
          if (d < 6) { e.state = 'idle'; e.home = { x: e.x, z: e.z }; }
          else { mvx = dx / d; mvz = dz / d; spd = def.speed * 0.55; }
        } else {
          e.wanderT -= dt;
          if (e.wanderT <= 0) {
            e.wanderT = this.rng.range(3, 8);
            const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0, 12);
            e.goal = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
          }
          if (e.goal) {
            const dx = e.goal.x - e.x, dz = e.goal.z - e.z;
            const d = Math.hypot(dx, dz);
            if (d > 1) { mvx = dx / d; mvz = dz / d; spd = def.speed * 0.3; }
          }
        }
      } else {
        const dx = T.x - e.x, dz = T.z - e.z;
        const d = Math.hypot(dx, dz) || 0.01;
        const nx = dx / d, nz = dz / d;
        const reach = (T.gen ? T.r : 0);
        face = Math.atan2(dx, dz);
        switch (def.ai) {
          case 'melee':
          case 'blinker': {
            if (def.ai === 'blinker' && d > 10 && e.blinkCd <= 0) {
              this.blink(e, T, 3, 5);
              e.blinkCd = this.rng.range(3, 6);
              break;
            }
            if (e.atk > 0) {
              e.atk -= dt;
              e.sc = 2;
              if (e.atk <= 0) this.meleeLand(e, T, def.range + 0.9 + reach);
            } else if (d > def.range + reach) {
              mvx = nx; mvz = nz; spd = def.speed;
            } else if (e.cd <= 0) {
              e.atk = 0.35;
              e.cd = def.cd;
              e.sc = 2;
              this.emit('atk', { e: e.id });
            }
            break;
          }
          case 'ranged':
          case 'flyer': {
            if (def.ai === 'flyer') {
              e.orbitA += dt * 0.6 * e.strafe;
              const R = 13 + (e.id % 7);
              const gx = T.x + Math.cos(e.orbitA) * R, gz = T.z + Math.sin(e.orbitA) * R;
              const ddx = gx - e.x, ddz = gz - e.z, dd = Math.hypot(ddx, ddz) || 1;
              if (dd > 1) { mvx = ddx / dd; mvz = ddz / dd; spd = def.speed * Math.min(1, dd / 6); }
            } else {
              e.strafeT -= dt;
              if (e.strafeT <= 0) { e.strafeT = this.rng.range(1.5, 4); e.strafe = this.rng.sign(); }
              if (e.losT > 0 || d > def.range * 0.85 + reach) { mvx = nx; mvz = nz; spd = def.speed; }
              else if (d < def.minRange) { mvx = -nx; mvz = -nz; spd = def.speed * 0.8; }
              else { mvx = -nz * e.strafe; mvz = nx * e.strafe; spd = def.speed * 0.45; }
              if (def.blink && e.blinkCd <= 0 && this.rng.chance(dt * 0.3)) {
                this.blinkSide(e);
                e.blinkCd = this.rng.range(5, 9);
              }
            }
            if (e.burstLeft > 0) {
              e.burstT -= dt;
              e.sc = 4;
              if (e.burstT <= 0) {
                this.enemyShoot(e, T);
                e.burstLeft--;
                e.burstT = 0.2;
              }
            } else if (e.cd <= 0 && d < def.range + reach) {
              if (def.ai === 'flyer' || T.gen || this.hasLOS(e, T)) {
                e.burstLeft = def.burst || 1;
                e.burstT = 0.15;
                e.cd = def.cd * this.rng.range(0.85, 1.25);
              } else {
                e.losT = 2.5;
                e.cd = 0.8;
              }
            }
            break;
          }
          case 'charger': {
            e.modeT -= dt;
            if (e.mode === 'approach') {
              if (e.atk > 0) {
                e.atk -= dt; e.sc = 2;
                if (e.atk <= 0) this.meleeLand(e, T, def.range + 1.2 + reach);
              } else if (d < def.range + reach && e.cd <= 0) {
                e.atk = 0.45; e.cd = def.cd; e.sc = 2;
                this.emit('atk', { e: e.id });
              } else {
                mvx = nx; mvz = nz; spd = def.speed;
                if (d < 30 && d > 7 && e.modeT <= 0) {
                  e.mode = 'windup'; e.modeT = 0.9;
                  this.emit('atk', { e: e.id, k: 'roar' });
                }
              }
            } else if (e.mode === 'windup') {
              e.sc = 5;
              if (e.modeT <= 0) {
                e.mode = 'charge';
                e.modeT = Math.min(d / def.chargeSpeed + 0.7, 2.4);
                e.cdx = nx; e.cdz = nz;
                e.hitSet = new Set();
              }
            } else if (e.mode === 'charge') {
              e.sc = 3;
              mvx = e.cdx; mvz = e.cdz; spd = def.chargeSpeed;
              face = Math.atan2(e.cdx, e.cdz);
              for (const p of alive) {
                if (e.hitSet.has(p.id)) continue;
                if (Math.hypot(p.x - e.x, p.z - e.z) < def.radius + 1.0) {
                  e.hitSet.add(p.id);
                  this.emit('dmg', { p: p.id, d: Math.round(def.dmg * 1.3 * this.dmgScale), k: 'c', fx: r2(e.x), fz: r2(e.z) });
                }
              }
              if (gen && Math.hypot(gen.x - e.x, gen.z - e.z) < def.radius + 3.5) { gen.hp -= def.dmg * 3; e.modeT = 0; }
              if (e.modeT <= 0) { e.mode = 'recover'; e.modeT = 1.5; }
            } else if (e.mode === 'recover') {
              e.sc = 0;
              if (e.modeT <= 0) { e.mode = 'approach'; e.modeT = this.rng.range(3, 6); }
            }
            break;
          }
          case 'boss': {
            e.summonT -= dt;
            if (e.summonT <= 0 && def.summon) {
              e.summonT = this.rng.range(16, 22);
              const pt = this.findLandNear(e.x, e.z, 5, 10) || e;
              this.emit('breach', { x: r2(pt.x), y: r2(this.ground(pt.x, pt.z)), z: r2(pt.z), f: this.cfg.faction });
              this.after(2, () => {
                for (let i = 0; i < 3 + Math.floor(this.diff.lvl / 3); i++) {
                  const q = this.findLandNear(pt.x, pt.z, 0, 5, 6) || pt;
                  this.spawnEnemy(def.summon, q.x, q.z, { state: 'alert', target: target ? target.id : null });
                }
              });
            }
            if (e.atk > 0) {
              e.atk -= dt; e.sc = 2;
              if (e.atk <= 0) {
                this.explode(e.x + Math.sin(e.rot) * 2, e.y + 0.5, e.z + Math.cos(e.rot) * 2, 7, def.dmg * this.dmgScale, 'enemy', 'slam', 3);
              }
            } else if (d < def.range + 2 && e.cd <= 0) {
              e.atk = 0.8; e.cd = def.cd + 1; e.sc = 2;
              this.emit('atk', { e: e.id, k: 'slam' });
            } else {
              if (d > 14) { mvx = nx; mvz = nz; spd = def.speed; }
              if (e.burstLeft > 0) {
                e.burstT -= dt; e.sc = 4;
                if (e.burstT <= 0) { this.enemyShoot(e, T); e.burstLeft--; e.burstT = 0.35; }
              } else if (e.cd <= 0 && d > 8 && d < 70) {
                e.burstLeft = 2; e.burstT = 0.2; e.cd = def.cd * 2;
              }
            }
            break;
          }
        }

        // pedir reforços
        if (def.calls && !e.called && this.breachCooldown <= 0 && this.time - e.alertAt > 4 && this.rng.chance(dt * 0.22) && this.activeCount() < this.diff.maxActive) {
          e.called = true;
          this.breachCooldown = this.diff.breachCd;
          this.emit('flare', { e: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
          const pt = this.findLandNear(e.x, e.z, 14, 26) || e;
          const [gmin, gmax] = this.diff.groupSize;
          this.after(1.5, () => {
            if (!this.ended) this.breach(pt.x, pt.z, this.rng.int(gmin + 1, gmax + 2), target ? target.id : null);
          });
        }
      }
      e.vx = mvx * spd;
      e.vz = mvz * spd;
      if (spd > 0.1 && e.sc === 0) e.sc = 1;
      const want = face !== null && (e.sc >= 2 || spd < def.speed * 0.6) ? face : spd > 0.1 ? Math.atan2(mvx, mvz) : e.rot;
      e.rot = angleLerp(e.rot, want, Math.min(1, dt * (e.mode === 'charge' ? 3 : 7)));
    }

    // separação + movimento
    for (let i = 0; i < awake.length; i++) {
      const a = awake[i];
      for (let j = i + 1; j < awake.length; j++) {
        const b = awake[j];
        const dx = a.x - b.x, dz = a.z - b.z;
        const min = (a.def.radius + b.def.radius) * 0.8;
        if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const wa = b.def.radius / (a.def.radius + b.def.radius);
          a.x += (dx / d) * push * wa * 2; a.z += (dz / d) * push * wa * 2;
          b.x -= (dx / d) * push * (1 - wa) * 2; b.z -= (dz / d) * push * (1 - wa) * 2;
        }
      }
    }
    const pos = { x: 0, z: 0 };
    for (const e of awake) {
      const def = e.def;
      const flying = !!def.fly;
      let nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
      if (!flying && w.liquid && w.liquid !== 'ice') {
        const bad = (x, z) => w.groundAt(x, z) < w.liquidLevel - (w.liquid === 'water' ? 1.0 : 0.2);
        if (bad(nx, nz) && !bad(e.x, e.z)) {
          if (!bad(nx, e.z)) nz = e.z;
          else if (!bad(e.x, nz)) nx = e.x;
          else { nx = e.x; nz = e.z; }
        }
      }
      pos.x = nx; pos.z = nz;
      if (!flying) w.collide(pos, def.radius * 0.7);
      e.x = clamp(pos.x, -PLAY_LIMIT - 30, PLAY_LIMIT + 30);
      e.z = clamp(pos.z, -PLAY_LIMIT - 30, PLAY_LIMIT + 30);
      const g = w.groundAt(e.x, e.z);
      if (flying) {
        const ty = Math.max(g, w.liquidLevel) + def.fly + Math.sin(e.t * 1.7) * 0.7;
        e.y += (ty - e.y) * Math.min(1, dt * 3);
      } else {
        e.y = g + (def.hover || 0) + (def.hover ? Math.sin(e.t * 2) * 0.15 : 0);
      }
    }
  }

  blink(e, T, minR, maxR) {
    const pt = this.findLandNear(T.x, T.z, minR, maxR, 10);
    if (!pt) return;
    this.emit('tele', { e: e.id, x0: r2(e.x), y0: r2(e.y), z0: r2(e.z), x: r2(pt.x), z: r2(pt.z) });
    e.x = pt.x; e.z = pt.z;
  }
  blinkSide(e) {
    const pt = this.findLandNear(e.x, e.z, 6, 12, 10);
    if (!pt) return;
    this.emit('tele', { e: e.id, x0: r2(e.x), y0: r2(e.y), z0: r2(e.z), x: r2(pt.x), z: r2(pt.z) });
    e.x = pt.x; e.z = pt.z;
  }

  meleeLand(e, T, reach) {
    const d = Math.hypot(T.x - e.x, T.z - e.z);
    if (d > reach) return;
    const dmg = e.def.dmg * this.dmgScale;
    if (T.gen) {
      const main = this.objectives.find((o) => o.id === 'main');
      if (main) main.hp -= dmg * 2;
    } else if (T.p) {
      this.emit('dmg', { p: T.p.id, d: Math.round(dmg), k: 'm', fx: r2(e.x), fz: r2(e.z) });
    }
  }

  hasLOS(e, T) {
    const ox = e.x, oy = e.y + 1.6, oz = e.z;
    const dx = T.x - ox, dy = T.y - oy, dz = T.z - oz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const t = this.world.terrainRay(ox, oy, oz, dx / d, dy / d, dz / d, d - 1);
    return t === Infinity;
  }

  enemyShoot(e, T) {
    const def = e.def, P = def.proj;
    if (!P) return;
    const muzzleY = def.fly ? 0 : def.hit[0].y + 0.3;
    const mx = e.x + Math.sin(e.rot) * def.radius * 0.8;
    const mz = e.z + Math.cos(e.rot) * def.radius * 0.8;
    const my = e.y + muzzleY;
    const count = P.count || 1;
    const dist = Math.hypot(T.x - mx, T.z - mz);
    const err = 0.8 + dist * 0.035;
    for (let i = 0; i < count; i++) {
      const tx = T.x + this.rng.range(-err, err) + (count > 1 ? (i - (count - 1) / 2) * 2.2 : 0);
      const tz = T.z + this.rng.range(-err, err);
      const ty = T.y + this.rng.range(-err * 0.4, err * 0.4);
      let vx, vy, vz;
      const dx = tx - mx, dy = ty - my, dz = tz - mz;
      if (P.gravity > 0) {
        const t = Math.max(0.3, Math.hypot(dx, dz) / P.speed);
        vx = dx / t; vz = dz / t; vy = (dy + 0.5 * P.gravity * t * t) / t;
      } else {
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        vx = (dx / l) * P.speed; vy = (dy / l) * P.speed; vz = (dz / l) * P.speed;
      }
      const pr = {
        id: this.nextId++, k: P.kind, owner: 'enemy', x: mx, y: my, z: mz, vx, vy, vz,
        life: 4, dmg: def.dmg * this.dmgScale, splash: P.splash || 0, g: P.gravity || 0, pen: 0,
      };
      this.projectiles.set(pr.id, pr);
      this.emit('proj', { i: pr.id, k: pr.k, x: r2(mx), y: r2(my), z: r2(mz), vx: r2(vx), vy: r2(vy), vz: r2(vz), o: 'enemy', e: e.id });
    }
  }

  updateStructure(e, dt, nd, nearest) {
    const def = e.def;
    if (!nearest || nd > 80) return;
    e.spawnT -= dt;
    if (e.spawnT <= 0) {
      e.spawnT = def.spawnEvery * this.rng.range(0.8, 1.3) / (0.75 + this.diff.lvl * 0.05);
      if (this.activeCount() >= this.diff.maxActive) return;
      const n = this.rng.int(1, 2);
      this.emit('sspawn', { e: e.id });
      for (let i = 0; i < n; i++) {
        const pt = this.findLandNear(e.x, e.z, def.radius + 1.5, def.radius + 4, 8);
        if (!pt) continue;
        this.spawnEnemy(this.rng.pick(def.spawn), pt.x, pt.z, { state: 'alert', target: nearest.id });
      }
    }
  }

  updateProjectiles(dt) {
    const w = this.world;
    const alive = this.alivePlayers();
    const shields = this.zones.filter((z) => z.kind === 'shield');
    const main = this.objectives.find((o) => o.id === 'main');
    const gen = main && main.kind === 'defend' && main.state === 'active' ? main : null;
    for (const pr of [...this.projectiles.values()]) {
      const g = pr.owner === 'enemy' ? pr.g : (PROJ_GRAVITY[pr.k] || 0);
      pr.vy -= g * dt;
      let nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt, nz = pr.z + pr.vz * dt;
      pr.life -= dt;
      let remove = false, boom = false;

      if (pr.owner === 'enemy') {
        for (const s of shields) {
          const d0 = Math.hypot(pr.x - s.x, pr.z - s.z), d1 = Math.hypot(nx - s.x, nz - s.z);
          if (d0 > s.r && d1 <= s.r) { remove = true; this.emit('projx', { i: pr.id, x: r2(nx), y: r2(ny), z: r2(nz), sh: 1 }); break; }
        }
        if (!remove) {
          for (const p of alive) {
            if (p.pending) continue;
            const dx = nx - p.x, dy = ny - (p.y + 1.0), dz = nz - p.z;
            if (dx * dx + dy * dy * 0.6 + dz * dz < 1.0) {
              if (pr.splash > 0) boom = true;
              else this.emit('dmg', { p: p.id, d: Math.round(pr.dmg), k: pr.k === 'laser' ? 'l' : 'p', fx: r2(pr.x), fz: r2(pr.z) });
              remove = true;
              if (!boom) this.emit('projx', { i: pr.id, x: r2(nx), y: r2(ny), z: r2(nz) });
              break;
            }
          }
          if (!remove && gen) {
            const gy = this.ground(gen.x, gen.z);
            if (Math.hypot(nx - gen.x, nz - gen.z) < 3.4 && ny < gy + 5) {
              gen.hp -= pr.dmg * 1.5;
              remove = true;
              if (pr.splash > 0) boom = true; else this.emit('projx', { i: pr.id, x: r2(nx), y: r2(ny), z: r2(nz) });
            }
          }
        }
      } else if (CONTACT_KINDS[pr.k] || (pr.k === 'grenade' && pr.impact)) {
        for (const e of this.enemies.values()) {
          const dx = nx - e.x, dz = nz - e.z;
          const rr = e.def.radius + 0.4;
          if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
          const dy = ny - (e.y + e.def.hit[0].y);
          if (dx * dx + dz * dz + dy * dy * 0.5 < rr * rr) { boom = true; remove = true; break; }
        }
      }

      if (!remove) {
        const gy = w.groundAt(nx, nz);
        const liquidTop = w.liquid && w.liquid !== 'ice' ? w.liquidLevel : -999;
        if (ny <= gy + 0.05 || (pr.k === 'beacon' && ny <= liquidTop)) {
          if (pr.k === 'grenade' && !pr.impact) {
            ny = gy + 0.06;
            pr.vy = Math.abs(pr.vy) * 0.28;
            pr.vx *= 0.55; pr.vz *= 0.55;
            if (pr.vy < 1) pr.vy = 0;
          } else if (pr.k === 'beacon') {
            pr.x = nx; pr.y = Math.max(gy, liquidTop); pr.z = nz;
            this.projectiles.delete(pr.id);
            this.startCallin(pr);
            continue;
          } else {
            remove = true;
            if (pr.splash > 0 || pr.k === 'grenade') boom = true;
            else this.emit('projx', { i: pr.id, x: r2(nx), y: r2(gy), z: r2(nz) });
          }
        }
      }
      if (!remove && (pr.k === 'grenade' || pr.k === 'beacon')) {
        const pos = { x: nx, z: nz };
        if (w.collide(pos, 0.15)) {
          const gy = w.groundAt(nx, nz);
          if (ny < gy + 6) { pr.vx *= -0.4; pr.vz *= -0.4; nx = pos.x; nz = pos.z; }
        }
      }
      pr.x = nx; pr.y = ny; pr.z = nz;
      if (pr.k === 'grenade') {
        pr.fuse -= dt;
        if (pr.fuse <= 0) { boom = true; remove = true; }
      }
      if (!remove && pr.life <= 0) {
        remove = true;
        if (pr.splash > 0 && pr.owner !== 'enemy') boom = true;
        else this.emit('projx', { i: pr.id, x: r2(pr.x), y: r2(pr.y), z: r2(pr.z) });
      }
      if (remove) {
        this.projectiles.delete(pr.id);
        if (boom) {
          this.emit('projx', { i: pr.id, x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), b: 1 });
          const kind = pr.owner === 'enemy' ? pr.k : (pr.k === 'grenade' ? (pr.fire ? 'incendiary' : 'grenade') : pr.k);
          this.explode(pr.x, pr.y + 0.2, pr.z, pr.splash || 3, pr.dmg, pr.owner, kind, pr.pen ?? 3);
          if (pr.fire) this.zones.push({ id: this.nextId++, kind: 'fire', x: pr.x, z: pr.z, r: pr.splash * 0.9, t: 0, life: 8, dps: 90, owner: pr.owner, tick: 0 });
        }
      }
    }
  }

  updateTurrets(dt) {
    for (const t of [...this.turrets.values()]) {
      t.life -= dt;
      if (t.life <= 0 || t.ammo <= 0) {
        this.turrets.delete(t.id);
        this.emit('boom', { x: r2(t.x), y: r2(t.y + 1), z: r2(t.z), r: 2, k: 'turret' });
        continue;
      }
      t.cd -= dt;
      // procura alvo
      if (!t.target || !this.enemies.has(t.target) || this.tickCount % 10 === 0) {
        let best = null, bs = Infinity;
        for (const e of this.enemies.values()) {
          if (e.sleep) continue;
          const d = Math.hypot(e.x - t.x, e.z - t.z);
          if (d > t.C.range) continue;
          let score = d;
          if (t.kind === 'sentry_rocket' && (e.def.heavy || e.def.tier === 'mid' || e.def.structure)) score -= 40;
          if (e.def.structure && t.kind === 'sentry_mg') score += 100;
          if (score < bs) { bs = score; best = e; }
        }
        t.target = best ? best.id : null;
      }
      const e = t.target ? this.enemies.get(t.target) : null;
      if (!e) continue;
      const want = Math.atan2(e.x - t.x, e.z - t.z);
      t.rot = angleLerp(t.rot, want, Math.min(1, dt * 5));
      let diff = Math.abs(want - t.rot) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 0.25 || t.cd > 0) continue;
      t.cd = 1 / t.C.fireRate;
      t.ammo--;
      const hy = e.y + e.def.hit[0].y;
      if (t.kind === 'sentry_mg') {
        let dmg = t.C.dmg;
        if (t.C.pen < e.def.armor) dmg *= 0.2;
        if (e.def.structure) dmg *= 0.1;
        this.emit('tshot', { i: t.id, x: r2(e.x), y: r2(hy), z: r2(e.z) });
        this.damageEnemy(e, dmg, t.owner);
      } else {
        const ox = t.x, oy = t.y + 2.2, oz = t.z;
        const dx = e.x - ox, dy = hy - oy, dz = e.z - oz;
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const sp = 45;
        const pr = { id: this.nextId++, k: 'trocket', owner: t.owner, x: ox, y: oy, z: oz, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, life: 3, dmg: t.C.dmg, splash: t.C.radius, pen: t.C.pen };
        this.projectiles.set(pr.id, pr);
        this.emit('proj', { i: pr.id, k: 'trocket', x: r2(ox), y: r2(oy), z: r2(oz), vx: r2(pr.vx), vy: r2(pr.vy), vz: r2(pr.vz), o: t.owner });
        this.emit('tshot', { i: t.id, r: 1 });
      }
    }
  }

  updateZones(dt) {
    const alive = this.alivePlayers();
    for (const zn of [...this.zones]) {
      zn.t += dt;
      if (zn.t >= zn.life) {
        this.zones.splice(this.zones.indexOf(zn), 1);
        continue;
      }
      if (zn.kind === 'fire') {
        zn.tick -= dt;
        if (zn.tick <= 0) {
          zn.tick = 0.25;
          for (const e of [...this.enemies.values()]) {
            if (Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.def.radius * 0.5) this.damageEnemy(e, zn.dps * 0.25 * (e.def.structure ? 0.3 : 1), this.players.has(zn.owner) ? zn.owner : null);
          }
          for (const p of alive) {
            if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r * 0.85) this.emit('dmg', { p: p.id, d: Math.round(zn.dps * 0.25 * 0.35), k: 'f', fx: r2(zn.x), fz: r2(zn.z) });
          }
        }
      } else if (zn.kind === 'laser') {
        let best = null, bd = 38;
        for (const e of this.enemies.values()) {
          const d = Math.hypot(e.x - zn.x, e.z - zn.z);
          if (d < bd) { bd = d; best = e; }
        }
        if (best && bd > 0.5) {
          const step = Math.min(bd, zn.speed * dt);
          zn.x += ((best.x - zn.x) / bd) * step;
          zn.z += ((best.z - zn.z) / bd) * step;
        }
        zn.tick -= dt;
        if (zn.tick <= 0) {
          zn.tick = 0.1;
          for (const e of [...this.enemies.values()]) {
            if (Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.def.radius * 0.6) this.damageEnemy(e, zn.dps * 0.1, this.players.has(zn.owner) ? zn.owner : null);
          }
          for (const p of alive) {
            if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r * 0.8) this.emit('dmg', { p: p.id, d: 14, k: 'f', fx: r2(zn.x), fz: r2(zn.z) });
          }
        }
      } else if (zn.kind === 'mine') {
        for (const e of this.enemies.values()) {
          if (e.def.fly || e.def.structure) continue;
          if (Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.def.radius * 0.5) {
            this.zones.splice(this.zones.indexOf(zn), 1);
            this.explode(zn.x, this.ground(zn.x, zn.z) + 0.3, zn.z, zn.br, zn.dmg, zn.owner, 'mine', 4);
            break;
          }
        }
      }
    }
  }

  updateObjectives(dt) {
    for (const ob of this.objectives) {
      if (ob.done || ob.failed) continue;
      if (ob.kind === 'destroy') {
        ob.count = ob.targets.filter((id) => !this.enemies.has(id)).length;
        if (ob.count >= ob.total) {
          ob.done = true;
          this.msg(ob.main ? 'Objetivo principal concluído!' : `Objetivo secundário concluído: ${ob.label}`, 'good');
        } else if (ob.main) {
          const next = ob.targets.map((id) => this.enemies.get(id)).find(Boolean);
          if (next) { ob.x = next.x; ob.z = next.z; }
        }
      } else if (ob.kind === 'eliminate') {
        const t = this.enemies.get(ob.target);
        if (!t) { ob.done = true; this.msg('Alvo eliminado! Objetivo principal concluído!', 'good'); }
        else { ob.x = t.x; ob.z = t.z; }
      } else if (ob.kind === 'uplink' && ob.state === 'active') {
        const inZone = this.alivePlayers().some((p) => Math.hypot(p.x - ob.x, p.z - ob.z) < ob.r);
        if (inZone) ob.progress = Math.min(100, ob.progress + (dt / ob.duration) * 100);
        ob.paused = !inZone;
        ob.wave -= dt;
        if (ob.wave <= 0) { ob.wave = Math.max(12, 22 - this.diff.lvl); this.wave(ob.x, ob.z, 38, 55); }
        if (ob.progress >= 100) { ob.done = true; ob.state = 'done'; this.msg('Transmissão concluída! Objetivo principal cumprido!', 'good'); }
      } else if (ob.kind === 'launch' && ob.state === 'countdown') {
        ob.timer -= dt;
        ob.wave -= dt;
        if (ob.wave <= 0) { ob.wave = Math.max(11, 20 - this.diff.lvl); this.wave(ob.x, ob.z, 38, 55); }
        if (ob.timer <= 0) {
          ob.done = true; ob.state = 'done';
          this.emit('launch', { x: r2(ob.x), y: r2(this.ground(ob.x, ob.z)), z: r2(ob.z) });
          this.msg('O Farol foi lançado! Objetivo principal cumprido!', 'good');
        }
      } else if (ob.kind === 'defend' && ob.state === 'active') {
        ob.timer -= dt;
        ob.wave -= dt;
        if (ob.wave <= 0) { ob.wave = Math.max(10, 18 - this.diff.lvl); this.wave(ob.x, ob.z, 38, 52, 1, true); }
        if (ob.hp <= 0) {
          ob.failed = true; ob.hp = 0;
          this.msg('O gerador foi destruído!', 'bad');
          this.end(false, 'Gerador destruído.');
          return;
        }
        if (ob.timer <= 0) { ob.done = true; ob.state = 'done'; this.msg('Gerador estabilizado! Objetivo principal cumprido!', 'good'); }
      }
    }
    if (this.extraction.state === 'locked' && this.objectives.filter((o) => o.main).every((o) => o.done)) {
      this.extraction.state = 'available';
      this.msg('Extração disponível! Vá até a zona de extração e chame a nave.', 'good');
      this.emit('extract', { s: 'available' });
    }
  }

  updateExtraction(dt) {
    const ex = this.extraction;
    if (ex.state === 'called') {
      ex.timer -= dt;
      ex.wave -= dt;
      if (ex.wave <= 0) {
        ex.wave = Math.max(10, 18 - this.diff.lvl * 0.8);
        this.wave(ex.x, ex.z, 35, 55, 1.1);
      }
      if (ex.timer <= 0) {
        ex.state = 'landing';
        ex.timer = 6;
        this.emit('extract', { s: 'landing' });
      }
    } else if (ex.state === 'landing') {
      ex.timer -= dt;
      if (ex.timer <= 0) {
        ex.state = 'boarding';
        ex.timer = 0;
        this.msg('A nave pousou! Embarquem!', 'good');
        this.emit('extract', { s: 'boarding' });
      }
    } else if (ex.state === 'boarding') {
      ex.timer += dt;
      for (const p of this.alivePlayers()) {
        if (Math.hypot(p.x - ex.x, p.z - ex.z) < 7.5) {
          p.onboardT += dt;
          if (p.onboardT > 0.6) {
            p.onboard = true;
            this.emit('board', { p: p.id });
          }
        } else p.onboardT = 0;
      }
      const all = [...this.players.values()];
      const onboard = all.filter((p) => p.onboard).length;
      const remaining = all.filter((p) => (p.alive || p.pending) && !p.onboard).length;
      if (onboard > 0 && (remaining === 0 || ex.timer > 60)) {
        ex.state = 'departing';
        ex.timer = 5;
        this.emit('extract', { s: 'departing' });
        this.msg('Decolando! Bom trabalho, Caídos.', 'good');
      }
    } else if (ex.state === 'departing') {
      ex.timer -= dt;
      if (ex.timer <= 0) {
        ex.state = 'done';
        this.end(true, 'Extração concluída.');
      }
    }
  }

  end(success, reason) {
    if (this.ended) return;
    this.ended = true;
    const objectives = this.objectives.map((o) => ({ id: o.id, label: o.label, main: !!o.main, done: !!o.done }));
    this.result = {
      success, reason,
      time: Math.round(this.time),
      planetId: this.cfg.planetId, faction: this.cfg.faction, type: this.cfg.type, difficulty: this.cfg.difficulty,
      objectives,
      mainDone: this.objectives.filter((o) => o.main).every((o) => o.done),
      optionalDone: this.objectives.filter((o) => o.optional && o.done).length,
      optionalTotal: this.objectives.filter((o) => o.optional).length,
      caches: this.cachesOpened.size,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, kills: p.kills, xpKills: p.xpKills, deaths: p.deaths,
        samples: p.onboard ? p.samples : 0, extracted: p.onboard, dmg: Math.round(p.dmg),
      })),
    };
    this.emit('end', { result: this.result });
  }

  // ------------------------------------------------------------------ rede
  compactObjective(o) {
    const c = { id: o.id, k: o.kind, l: o.label, d: o.done ? 1 : 0, x: r1(o.x), z: r1(o.z) };
    if (o.main) c.m = 1;
    if (o.optional) c.o = 1;
    if (o.failed) c.f = 1;
    if (o.kind === 'destroy') { c.c = o.count; c.t = o.total; }
    if (o.kind === 'uplink') { c.s = o.state; c.pr = r1(o.progress); c.pa = o.paused ? 1 : 0; c.r = o.r; }
    if (o.kind === 'launch') { c.s = o.state; c.tm = r1(o.timer); c.cs = o.consoles.map((cc) => (cc.on ? 1 : 0)); }
    if (o.kind === 'defend') { c.s = o.state; c.tm = r1(o.timer); c.hp = Math.round((o.hp / o.maxHp) * 100); }
    return c;
  }

  snapshot() {
    const players = [...this.players.values()];
    const e = [];
    for (const en of this.enemies.values()) {
      if (!en.def.structure) {
        let near = false;
        for (const p of players) {
          if (Math.abs(p.x - en.x) < 250 && Math.abs(p.z - en.z) < 250) { near = true; break; }
        }
        if (!near) continue;
      }
      e.push([en.id, en.ti, r1(en.x), r1(en.y), r1(en.z), r2(en.rot), Math.max(1, Math.round((en.hp / en.maxHp) * 255)), en.sc]);
    }
    const snap = {
      t: r2(this.time),
      tl: Math.max(0, Math.round(this.timeLimit - this.time)),
      e,
      p: players.map((pl) => [pl.id, r2(pl.x), r2(pl.y), r2(pl.z), r2(pl.rot), r2(pl.pitch), pl.anim, pl.weapon, Math.round(pl.hp), pl.alive ? 1 : 0, pl.onboard ? 1 : 0, pl.samples]),
      tu: [...this.turrets.values()].map((t) => [t.id, t.kind === 'sentry_mg' ? 0 : 1, r1(t.x), r1(t.y), r1(t.z), r2(t.rot), Math.round((t.ammo / t.maxAmmo) * 100)]),
      z: this.zones.map((zn) => [zn.id, zn.kind, r1(zn.x), r1(zn.z), zn.r, r2(1 - zn.t / zn.life)]),
      ev: this.events,
      rf: this.reinforcements,
      ex: [this.extraction.state, Math.round(this.extraction.timer)],
      ob: this.objectives.map((o) => this.compactObjective(o)),
      ns: this.noSupport ? 1 : 0,
    };
    this.events = [];
    return snap;
  }

  fullState() {
    const { world, ...cfg } = this.cfg;
    return {
      cfg,
      time: this.time,
      pickups: [...this.pickups.values()].map((p) => ({ i: p.id, k: p.k, x: r2(p.x), y: r2(p.y), z: r2(p.z), w: p.w, n: p.n })),
      caches: [...this.cachesOpened],
      players: [...this.players.values()].map((p) => ({ p: p.id, name: p.name, look: p.look })),
      reinforcements: this.reinforcements,
    };
  }
}
