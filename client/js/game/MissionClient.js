// Orquestra uma missão no cliente: mundo, jogador, inimigos, eventos da simulação, HUD
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BIOME_VIS } from './BiomeVisuals.js';
import { buildTerrain, buildLiquid, buildMinimapCanvas } from './Terrain.js';
import { Atmosphere } from './Atmosphere.js';
import { PropField } from './Props.js';
import { Effects } from './Effects.js';
import { EnemyManager } from './Enemies.js';
import { Entities } from './Entities.js';
import { Player } from './Player.js';
import { Avatar, ANIM } from './Avatar.js';
import { HUD } from '../ui/HUD.js';
import { ENEMIES, ENEMY_LIST } from '../../../shared/data/enemies.js';
import { WEAPONS, WEAPON_LIST } from '../../../shared/data/weapons.js';
import { FACTIONS } from '../../../shared/data/factions.js';
import { MISSION_TYPES } from '../../../shared/data/progression.js';

const REMOTE_SOUND = { ar7: 'rifle', sg12: 'shotgun', smg9: 'smg', dmr4: 'sniper', pl2: 'plasma', arc3: 'arc', p19: 'pistol', r6: 'revolver', mp5: 'smg', mg43: 'mg', rl8: 'rocket', rg1: 'rail', gl6: 'gl' };

export class MissionClient {
  constructor(game, { cfg, full, myId, transport, world }) {
    this.game = game;
    this.renderer = game.renderer;
    this.audio = game.audio;
    this.input = game.input;
    this.profile = game.profile;
    this.cfg = cfg;
    this.myId = myId;
    this.transport = transport;
    this.online = transport.online;
    this.world = world;
    this.vis = BIOME_VIS[cfg.biome] || BIOME_VIS.desert;
    const quality = this.profile.data.settings.quality || 'alta';
    this.quality = quality;

    this.scene = new THREE.Scene();
    const w = window.innerWidth, h = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.profile.data.settings.fov || 72, w / h, 0.1, 2600);
    this.scene.add(this.camera);

    this.atmo = new Atmosphere(this.scene, world, this.vis, quality);
    this.scene.add(buildTerrain(world, this.vis));
    this.liquid = buildLiquid(world, this.vis);
    if (this.liquid) this.scene.add(this.liquid.mesh);
    this.props = new PropField(this.scene, world, this.vis, quality);
    this.effects = new Effects(this.scene, quality, (x, z) => world.groundAt(x, z));
    this.effects.setScale(h);
    this.enemies = new EnemyManager(this.scene, world, this.effects, this.audio);
    this.entities = new Entities(this);
    this.entities.buildPOIs(cfg);
    this.mapCanvas = buildMinimapCanvas(world, this.vis, 256);

    this.hud = new HUD(game.uiRoot, this);
    const mt = MISSION_TYPES[cfg.type];
    this.hud.setMission(cfg, cfg.planetName, mt ? mt.name : cfg.type);
    this.player = new Player(this, this.profile);
    this.hud.setupCallins(this.player.callins);
    const sp = world.spawn;
    this.player.pos.set(sp.x, world.groundAt(sp.x, sp.z), sp.z);
    this.player.yaw = Math.atan2(world.main[0].x - sp.x, world.main[0].z - sp.z);

    // pós-processamento
    this.composer = null;
    if (quality !== 'baixa') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.4, 0.35, 0.86);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.remotes = new Map();
    this.playerMeta = new Map();
    this.objectives = [];
    this.extraction = ['locked', 0];
    this.reinforcements = 0;
    this.timeLeft = null;
    this.noSupport = false;
    this.mySamples = 0;
    this.renderTime = 0;
    this.latestT = 0;
    this.gotSnap = false;
    this.playing = false;
    this.paused = false;
    this.ended = false;
    this.result = null;
    this.cachesOpened = new Set();
    this.pendingPickup = new Set();
    this.structuresKnown = new Map();
    this.time = 0;
    this.nameTags = new Map();
    this.chatOpen = false;

    if (full) {
      for (const pk of full.pickups || []) this.entities.addPickup(pk);
      for (const i of full.caches || []) { this.cachesOpened.add(i); this.entities.openCache(i); }
      for (const pm of full.players || []) this.playerMeta.set(pm.p, pm);
      this.reinforcements = full.reinforcements;
    }
    transport.on('snap', (s) => this.onSnap(s));
    transport.on('chat', (m) => this.hud.chat(m.from, m.text, m.sys));
    transport.on('disconnect', () => {
      this.hud.message('Conexão com o servidor perdida!', 'bad');
      if (!this.ended) setTimeout(() => this.finish({ success: false, reason: 'Conexão perdida.', players: [], objectives: [], difficulty: cfg.difficulty, planetId: cfg.planetId, faction: cfg.faction, type: cfg.type, mainDone: false, optionalDone: 0, caches: 0, time: Math.round(this.time) }), 1500);
    });

    this.nameTagRoot = document.createElement('div');
    this.nameTagRoot.className = 'planet-labels';
    this.hud.el.prepend(this.nameTagRoot);

    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    this.audio.loop('wind', true, { freq: world.biome === 'moon' ? 200 : 380, vol: world.biome === 'moon' ? 0.02 : 0.06 });
    this.hud.setClickToPlay(true);
    this.hud.bigMessage(cfg.planetName.toUpperCase(), `${mt ? mt.name : ''} · ${FACTIONS[cfg.faction].name}`, 5);
  }

  send(k, d) { this.transport.send(k, d); }

  setPlaying(locked) {
    this.playing = locked && !this.paused && !this.ended;
    this.hud.setClickToPlay(!locked && !this.ended && !this.game.ui.pauseOpen);
    if (!this.online) this.transport.paused = !locked || this.ended;
  }

  handleKey(e) {
    if (this.ended) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyM' || e.code === 'Tab') {
      e.preventDefault();
      this.hud.toggleMap(!this.hud.mapOpen);
    }
    if (e.code === 'Enter' && this.online && !this.chatOpen) {
      e.preventDefault();
      this.openChat();
    }
  }

  openChat() {
    this.chatOpen = true;
    const inp = document.createElement('input');
    inp.className = 'chat-input';
    inp.placeholder = 'Mensagem para o esquadrão…';
    inp.maxLength = 160;
    this.hud.$.chat.appendChild(inp);
    setTimeout(() => inp.focus(), 0);
    const close = () => { this.chatOpen = false; inp.remove(); };
    inp.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        const t = inp.value.trim();
        if (t) this.game.net.send('chat', { text: t });
        close();
      } else if (ev.key === 'Escape') close();
    });
    inp.addEventListener('blur', close);
  }

  // ------------------------------------------------------------ snapshots
  onSnap(s) {
    this.latestT = s.t;
    if (!this.gotSnap) { this.renderTime = s.t - 0.12; this.gotSnap = true; }
    for (const ev of s.ev) if (ev.type === 'pjoin') this.playerMeta.set(ev.p, { p: ev.p, name: ev.name, look: ev.look });
    this.enemies.applySnapshot(s.e, s.t);
    this.applyPlayers(s.p, s.t);
    this.entities.syncTurrets(s.tu);
    this.entities.syncZones(s.z);
    for (const ev of s.ev) this.handleEvent(ev);
    this.objectives = s.ob;
    this.hud.setObjectives(s.ob);
    this.extraction = s.ex;
    this.entities.setExtraction(s.ex[0]);
    this.reinforcements = s.rf;
    this.timeLeft = s.tl;
    if (s.ns && !this.noSupport) this.hud.bigMessage('SEM SUPORTE ORBITAL', 'O Bastião deixou a órbita. Extraiam!', 4, '#ff3b4e');
    this.noSupport = !!s.ns;
    for (const e of this.enemies.map.values()) if (e.def.structure) this.structuresKnown.set(e.id, { x: e.x, z: e.z });
  }

  applyPlayers(list, t) {
    const seen = new Set();
    for (const row of list) {
      const [id, x, y, z, rot, pitch, anim, wpn, hp, alive, onboard, samples] = row;
      seen.add(id);
      if (id === this.myId) {
        this.mySamples = samples;
        if (onboard && !this.player.onboard) {
          this.player.onboard = true;
          this.player.avatar.setVisible(false);
          this.hud.bigMessage('A BORDO', 'Aguardando decolagem', 3, '#4cff8a');
        }
        continue;
      }
      let r = this.remotes.get(id);
      if (!r) {
        const meta = this.playerMeta.get(id) || { name: 'Caído', look: {} };
        r = { id, name: meta.name, avatar: new Avatar(this.scene, meta.look || {}, meta.name), samples: [], alive, hp, flags: 0, wpn, x, y, z, yaw: rot, pitch, onboard };
        this.remotes.set(id, r);
      }
      r.samples.push({ t, x, y, z, rot, pitch });
      if (r.samples.length > 10) r.samples.shift();
      r.flags = anim; r.wpn = wpn; r.hp = hp; r.alive = !!alive; r.onboard = !!onboard;
    }
    for (const [id, r] of this.remotes) {
      if (!seen.has(id)) {
        r.avatar.dispose();
        this.remotes.delete(id);
        const tag = this.nameTags.get(id);
        if (tag) { tag.remove(); this.nameTags.delete(id); }
      }
    }
  }

  handleEvent(ev) {
    const me = this.myId;
    const pp = this.player.pos;
    switch (ev.type) {
      case 'boom': {
        this.effects.explosion(ev.x, ev.y, ev.z, ev.r, ev.k);
        const d = Math.hypot(ev.x - pp.x, ev.z - pp.z);
        const big = ev.k === 'solar' ? 3 : ev.k === 'orbital' ? 2 : 1;
        if (!['acid', 'plasma', 'voidbolt', 'mines'].includes(ev.k)) {
          this.audio.play(d > 120 ? 'boomFar' : 'explosion', ev, { range: 400 * big, vol: Math.min(1.4, 0.5 + ev.r / 8), big });
          this.player.shake = Math.min(1, this.player.shake + Math.max(0, 1 - d / (ev.r * 7 + 10)) * (0.4 + big * 0.3));
        } else if (ev.k === 'plasma') this.audio.play('plasma', ev, { range: 60, vol: 0.5 });
        if (ev.k === 'solar') this.game.ui.flashScreen();
        break;
      }
      case 'proj': this.entities.spawnProjectile(ev); break;
      case 'projx': this.entities.removeProjectile(ev); break;
      case 'kill': {
        this.enemies.kill(ev.e, ev);
        if (ev.by === me) {
          const def = ENEMIES[ENEMY_LIST[ev.t]];
          this.player.onKill(def);
          this.hud.hitmarker(false, true);
          if (this.audio.throttle('kill', 60)) this.audio.play('kill', null, { vol: 0.7 });
          if (def && (def.heavy || def.structure)) this.hud.kill(`Você eliminou: ${def.name}`);
        } else if (ev.by) {
          const def = ENEMIES[ENEMY_LIST[ev.t]];
          const r = this.remotes.get(ev.by);
          if (def && (def.heavy || def.structure) && r) this.hud.kill(`${r.name} eliminou: ${def.name}`);
        }
        break;
      }
      case 'dmg': if (ev.p === me) this.player.takeDamage(ev.d, ev.k, ev.fx, ev.fz); break;
      case 'atk': this.enemies.attack(ev.e, ev.k); break;
      case 'breach': {
        this.effects.breach(ev.x, ev.y, ev.z, ev.f);
        this.audio.play('breach', ev, { range: 160 });
        const d = Math.hypot(ev.x - pp.x, ev.z - pp.z);
        if (d < 90 && this.audio.throttle('breachmsg', 8000)) this.hud.message(FACTIONS[ev.f]?.breach || 'Reforços inimigos!', 'bad');
        break;
      }
      case 'flare': this.effects.flare(ev.x, ev.y, ev.z, this.cfg.faction === 'ecos' ? '#c06bff' : this.cfg.faction === 'vorr' ? '#ffb347' : '#ff3b3b'); this.audio.play('alarm', ev, { range: 120, vol: 0.5 }); break;
      case 'tele':
        this.effects.teleport(ev.x0, ev.y0, ev.z0);
        this.effects.teleport(ev.x, this.world.groundAt(ev.x, ev.z), ev.z);
        this.enemies.teleport(ev.e, ev.x, ev.z);
        this.audio.play('teleport', ev, { range: 60, vol: 0.5 });
        break;
      case 'beacon': this.entities.plantBeacon(ev); break;
      case 'beaconx': this.entities.removeBeacon(ev.i); break;
      case 'orb':
        if (ev.k === 'solar') {
          this.effects.beam(ev.x, ev.y, ev.z, { color: '#fff4d0', width: 12, height: 800, life: 0.8, k: 4 });
        } else this.effects.beam(ev.x, ev.y, ev.z, { color: '#ffd8a0', width: 1.8, height: 700, life: 0.5 });
        break;
      case 'shell': this.effects.shellStreak(ev.x, ev.y, ev.z); break;
      case 'jet': this.entities.flyJet(ev); break;
      case 'pod': {
        const pod = this.entities.spawnPod(ev);
        if (ev.k === 'player' && ev.p === me) {
          this.player.podRide = pod;
          this.player.avatar.setVisible(false);
        }
        break;
      }
      case 'podland': this.effects.podLand(ev.x, ev.y, ev.z); this.audio.play('explosion', ev, { range: 200, vol: 0.8 }); break;
      case 'respawn':
        if (ev.p === me) {
          this.player.spawn(ev.x, ev.y, ev.z);
          this.player.onboard = false;
        }
        break;
      case 'pdeath': {
        if (ev.p !== me) {
          const r = this.remotes.get(ev.p);
          this.hud.kill(`${r ? r.name : 'Um Caído'} caiu em combate`);
        }
        break;
      }
      case 'pick+': this.entities.addPickup(ev); break;
      case 'pick-':
        this.entities.removePickup(ev.i);
        this.pendingPickup.delete(ev.i);
        if (ev.by === me) this.player.applyPickup(ev.k, ev.w, ev.n);
        break;
      case 'tshot': this.entities.turretShot(ev); break;
      case 'msg': if (!ev.to || ev.to === me) this.hud.message(ev.text, ev.s); break;
      case 'cache':
        this.cachesOpened.add(ev.i);
        this.entities.openCache(ev.i);
        this.audio.play('pickup', null, { vol: 0.7 });
        break;
      case 'extract':
        if (ev.s === 'available') this.hud.bigMessage('EXTRAÇÃO DISPONÍVEL', 'Vá até a zona de extração', 4, '#4cff8a');
        if (ev.s === 'called') this.audio.play('alarm', null, { vol: 0.5 });
        break;
      case 'board':
        if (ev.p === me) { this.player.onboard = true; this.player.avatar.setVisible(false); }
        else { const r = this.remotes.get(ev.p); if (r) r.onboard = true; }
        break;
      case 'launch': this.entities.missileLaunch(); break;
      case 'shot': {
        if (ev.p === me) break;
        const r = this.remotes.get(ev.p);
        const from = new THREE.Vector3(ev.x, ev.y, ev.z);
        const to = new THREE.Vector3(ev.ex, ev.ey, ev.ez);
        const wid = WEAPON_LIST[ev.w];
        if (wid === 'arc3') this.effects.arcBolt(from, to, '#7ff3ff');
        else if (wid === 'rg1') this.effects.tracer(from, to, '#9fe8ff', 0.25, 1200);
        else if (!['pl2', 'rl8', 'gl6'].includes(wid)) this.effects.tracer(from, to, '#ffd890', 0.05);
        this.effects.muzzle(from, to.clone().sub(from).normalize());
        if (r) r.avatar.kick(0.6);
        const snd = REMOTE_SOUND[wid];
        if (snd) this.audio.play(snd, from, { range: 150, vol: 0.6 });
        break;
      }
      case 'ping': {
        const r = ev.p === me ? null : this.remotes.get(ev.p);
        this.entities.ping(ev.x, ev.z, ev.p === me ? '#ffb000' : '#ff8a2a');
        this.audio.play('beacon', null, { vol: 0.4 });
        if (r) this.hud.message(`${r.name} marcou uma posição`, 'info');
        break;
      }
      case 'pjoin': {
        const r = this.remotes.get(ev.p);
        if (r && r.name !== ev.name) {
          r.name = ev.name;
          const tag = this.nameTags.get(ev.p);
          if (tag) { tag.remove(); this.nameTags.delete(ev.p); }
        }
        if (ev.p !== me && this.time > 1) this.hud.message(`${ev.name} entrou na missão`, 'info');
        break;
      }
      case 'pleave': this.hud.message(`${ev.name} saiu da missão`, 'warn'); break;
      case 'sspawn': this.enemies.structurePulse(ev.e); break;
      case 'end':
        this.result = ev.result;
        this.ended = true;
        this.hud.bigMessage(ev.result.success ? 'MISSÃO CUMPRIDA' : 'MISSÃO FRACASSADA', ev.result.reason, 4, ev.result.success ? '#4cff8a' : '#ff3b4e');
        setTimeout(() => this.finish(ev.result), 3500);
        break;
    }
  }

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.ended = true;
    this.game.endMission(result, this.myId);
  }

  // ------------------------------------------------------------ interações
  interactables() {
    const out = [];
    const w = this.world;
    const main = this.objectives.find((o) => o.id === 'main');
    if (main) {
      const site = w.main[0];
      if (main.k === 'uplink' && main.s === 'idle') out.push({ x: site.x, z: site.z, r: 5.5, text: 'Ativar terminal de transmissão', o: 'main' });
      if (main.k === 'defend' && main.s === 'idle') out.push({ x: site.x, z: site.z, r: 6.5, text: 'Ativar gerador planetário', o: 'main' });
      if (main.k === 'launch' && main.s === 'consoles') site.consoles.forEach((c, i) => { if (!main.cs[i]) out.push({ x: c.x, z: c.z, r: 3.5, text: 'Ativar console do Farol', o: 'console' + i }); });
    }
    w.caches.forEach((c, i) => { if (!this.cachesOpened.has(i)) out.push({ x: c.x, z: c.z, r: 3, text: 'Abrir depósito de equipamento', o: 'cache' + i }); });
    if (this.extraction[0] === 'available') out.push({ x: w.extraction.consoleX, z: w.extraction.consoleZ, r: 4, text: 'Chamar nave de extração', o: 'extract' });
    return out;
  }

  updateInteraction() {
    const p = this.player;
    if (!p.alive || p.onboard) { this.hud.setPrompt(null); return; }
    let best = null, bd = Infinity;
    for (const it of this.interactables()) {
      const d = Math.hypot(it.x - p.pos.x, it.z - p.pos.z);
      if (d < it.r && d < bd) { bd = d; best = { ...it, kind: 'obj' }; }
    }
    for (const pk of this.entities.pickups.values()) {
      const d = Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z);
      if (pk.k === 'sample' && d < 2.4 && !this.pendingPickup.has(pk.id)) {
        this.pendingPickup.add(pk.id);
        this.send('pickup', { i: pk.id });
        continue;
      }
      if (pk.k !== 'sample' && d < 2.6 && d < bd) {
        bd = d;
        best = { kind: 'pick', id: pk.id, text: pk.k === 'ammo' ? 'Pegar munição' : `Pegar ${WEAPONS[pk.w]?.name || 'arma'}` };
      }
    }
    if (best) {
      this.hud.setPrompt(`<b>[E]</b> ${best.text}`);
      if (this.playing && this.input.hit('KeyE')) {
        if (best.kind === 'obj') { this.send('interact', { o: best.o }); this.audio.play('uiConfirm', null, { vol: 0.6 }); }
        else if (!this.pendingPickup.has(best.id)) { this.pendingPickup.add(best.id); this.send('pickup', { i: best.id }); setTimeout(() => this.pendingPickup.delete(best.id), 1500); }
      }
    } else this.hud.setPrompt(null);
  }

  markers() {
    const out = [];
    const w = this.world;
    for (const o of this.objectives) {
      if (o.d) continue;
      if (o.m) out.push({ x: o.x, z: o.z, icon: '◆', color: '#ffb000', label: o.l });
    }
    const main = this.objectives.find((o) => o.id === 'main');
    if (main && main.k === 'launch' && main.s === 'consoles') {
      w.main[0].consoles.forEach((c, i) => { if (!main.cs[i]) out.push({ x: c.x, z: c.z, icon: '◇', color: '#ffd76a', label: 'Console' }); });
    }
    if (this.extraction[0] !== 'locked') out.push({ x: w.extraction.x, z: w.extraction.z, icon: '⇡', color: '#4cff8a', label: 'Extração' });
    for (const pg of this.entities.pings) out.push({ x: pg.x, z: pg.z, icon: '▼', color: pg.color, label: 'Marcação' });
    return out;
  }

  // ------------------------------------------------------------ atualização
  update(dt) {
    this.time += dt;
    this.transport.update(dt);
    if (this.gotSnap) {
      this.renderTime += dt;
      const target = this.latestT - 0.12;
      if (Math.abs(this.renderTime - target) > 0.6) this.renderTime = target;
      else this.renderTime += (target - this.renderTime) * Math.min(1, dt * 2);
    }
    this.player.update(dt);
    const camPos = this.camera.position;
    this.updateRemotes(dt);
    this.enemies.update(dt, this.renderTime, camPos);
    this.entities.update(dt);
    this.entities.updatePOIs(this.objectives, this.extraction, dt);
    this.effects.update(dt);
    this.atmo.update(dt, this.camera, this.player.pos);
    if (this.liquid) this.liquid.update(this.time);
    this.props.update(camPos);
    this.updateInteraction();
    this.audio.setListener(camPos.x, camPos.y, camPos.z, this.player.yaw);

    const p = this.player;
    const radarR = 42 + (p.mods.radar || 0);
    const radar = [];
    for (const e of this.enemies.map.values()) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.pos.x, e.z - p.pos.z);
      if (d < radarR || (e.def.structure && d < 160)) radar.push({ x: e.x, z: e.z, structure: !!e.def.structure, heavy: !!e.def.heavy });
    }
    const pickupsNear = [];
    for (const pk of this.entities.pickups.values()) if (Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z) < 70) pickupsNear.push(pk);
    let boss = null;
    for (const b of this.enemies.bosses()) if (Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < 90) boss = b;
    const squad = [];
    const teammates = [];
    for (const r of this.remotes.values()) {
      squad.push({ name: r.name, hp: r.hp, alive: r.alive });
      if (r.alive && !r.onboard) teammates.push({ x: r.x, z: r.z, name: r.name });
    }
    this.hud.update(dt, {
      player: p, yaw: p.yaw, px: p.pos.x, pz: p.pos.z,
      reinforcements: this.reinforcements, timeLeft: this.timeLeft, noSupport: this.noSupport, mySamples: this.mySamples,
      extraction: this.extraction, squad, teammates, radar, pickupsNear, boss,
      markers: this.markers(), structuresKnown: [...this.structuresKnown.values()].filter((s, i) => true),
      mapCanvas: this.mapCanvas, mapSize: this.world.MAP_SIZE, half: this.world.HALF,
    });
    this.updateNameTags();
  }

  updateRemotes(dt) {
    const rt = this.renderTime;
    for (const r of this.remotes.values()) {
      const s = r.samples;
      if (s.length) {
        let a = s[0], b = s[s.length - 1], k = 1;
        for (let i = s.length - 1; i >= 1; i--) {
          if (rt >= s[i - 1].t) { a = s[i - 1]; b = s[i]; k = Math.min(1, (rt - a.t) / ((b.t - a.t) || 1)); break; }
        }
        if (rt < s[0].t) { a = b = s[0]; k = 0; }
        r.x = a.x + (b.x - a.x) * k; r.y = a.y + (b.y - a.y) * k; r.z = a.z + (b.z - a.z) * k;
        let dr = b.rot - a.rot;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        r.yaw = a.rot + dr * k;
        r.pitch = a.pitch + (b.pitch - a.pitch) * k;
      }
      r.avatar.setWeaponIndex(r.wpn);
      r.avatar.setDead(!r.alive);
      r.avatar.setVisible(!r.onboard && (r.alive || r.avatar.deadT < 8));
      const moving = !!(r.flags & ANIM.MOVE);
      r.avatar.update(dt, { x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch, flags: r.flags, moveF: moving ? 1 : 0, moveR: 0 });
      if (r.alive && (r.flags & ANIM.FIRE)) {
        const wid = WEAPON_LIST[r.wpn];
        const muzzle = r.avatar.muzzleWorld(new THREE.Vector3());
        const dir = new THREE.Vector3(Math.sin(r.yaw) * Math.cos(r.pitch), Math.sin(r.pitch), Math.cos(r.yaw) * Math.cos(r.pitch));
        if (wid === 'fl3') this.effects.flame(muzzle, dir);
        else if (wid === 'lb1') this.effects.tracer(muzzle, muzzle.clone().addScaledVector(dir, 60), '#ff3b5c', 0.08, 2000);
      }
    }
  }

  updateNameTags() {
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const r of this.remotes.values()) {
      let tag = this.nameTags.get(r.id);
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'plabel';
        tag.innerHTML = `<div class="n" style="font-size:16px;color:#7fd0ff">${r.name.replace(/[<>&]/g, '')}</div><div class="s"></div>`;
        this.nameTagRoot.appendChild(tag);
        this.nameTags.set(r.id, tag);
      }
      v.set(r.x, r.y + 2.3, r.z).project(this.camera);
      const d = Math.hypot(r.x - this.player.pos.x, r.z - this.player.pos.z);
      if (v.z > 1 || r.onboard || d > 250) { tag.style.display = 'none'; continue; }
      tag.style.display = '';
      tag.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      tag.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      tag.querySelector('.s').textContent = r.alive ? `${Math.round(d)}m` : 'CAÍDO';
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
    this.effects.setScale(h);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    this.transport.leave();
    this.player.dispose();
    this.hud.dispose();
    this.enemies.dispose();
    this.audio.stopAllLoops();
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    });
    if (this.composer) this.composer.dispose?.();
  }
}
