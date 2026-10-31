// Controlador principal: renderizador, telas, rede, galáxia e missões
import * as THREE from 'three';
import { Profile } from './core/Profile.js';
import { Net } from './core/Net.js';
import { AudioSys } from './core/Audio.js';
import { Input } from './core/Input.js';
import { UI } from './ui/UI.js';
import { GalaxyView } from './galaxy/GalaxyView.js';
import { MissionClient } from './game/MissionClient.js';
import { LocalTransport, NetTransport } from './game/Transport.js';
import { generateWorld } from '../../shared/world.js';
import { createGalaxy, galaxyTick, galaxySummary, applyMissionResult, missionFaction, missionTypesFor } from '../../shared/galaxy.js';
import { PLANET_MAP } from '../../shared/data/planets.js';
import { MISSION_TYPES } from '../../shared/data/progression.js';

const GALAXY_KEY = 'hellfallen.galaxy.v1';

export class Game {
  constructor() {
    this.container = document.getElementById('game');
    this.uiRoot = document.getElementById('ui');
    this.profile = Profile.load();
    const quality = this.profile?.data.settings.quality || 'alta';
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'baixa', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'alta' ? 1.5 : quality === 'media' ? 1 : 0.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.audio = new AudioSys();
    if (this.profile) this.audio.setVolume(this.profile.data.settings.volume);
    this.input = new Input(this.renderer.domElement);
    this.net = new Net();
    this.ui = new UI(this);
    this.galaxyView = new GalaxyView(this.renderer, quality);
    this.state = 'title';
    this.mission = null;
    this.squad = null;
    this.activeCounts = {};
    this.online = 0;
    this.lastGain = 0;

    // guerra galáctica local (modo solo / servidor offline)
    try { this.localGalaxy = JSON.parse(localStorage.getItem(GALAXY_KEY)); } catch { this.localGalaxy = null; }
    if (!this.localGalaxy || !this.localGalaxy.planets || Object.keys(PLANET_MAP).some((id) => !this.localGalaxy.planets[id])) this.localGalaxy = createGalaxy();
    galaxyTick(this.localGalaxy, Date.now());
    this.useLocalGalaxy();
    setInterval(() => {
      if (this.net.online) return;
      galaxyTick(this.localGalaxy, Date.now());
      this.saveLocalGalaxy();
      this.useLocalGalaxy();
      if (this.state === 'hub' && this.ui.tab === 'war') this.ui.renderWarLeft();
    }, 5000);

    this.setupNet();
    this.setupEvents();
    this.net.connect(() => this.helloData());
    this.last = performance.now();
    requestAnimationFrame(() => this.loop());
    const boot = document.getElementById('boot');
    boot.classList.add('hide');
    setTimeout(() => boot.remove(), 700);
    this.ui.showTitle();
  }

  helloData() {
    const p = this.profile;
    return p ? { name: p.data.name, level: p.data.level, look: p.look(), mods: p.netMods() } : { name: 'Recruta', level: 1, look: {}, mods: {} };
  }

  syncProfile() {
    if (this.profile) this.net.send('profile', this.helloData());
  }

  useLocalGalaxy() {
    this.galaxy = galaxySummary(this.localGalaxy);
    this.activeCounts = {};
    this.galaxyView.setGalaxy(this.galaxy);
  }

  saveLocalGalaxy() {
    try { localStorage.setItem(GALAXY_KEY, JSON.stringify(this.localGalaxy)); } catch {}
  }

  setupNet() {
    const n = this.net;
    n.on('status', ({ online }) => {
      if (!online) {
        this.squad = null;
        this.useLocalGalaxy();
      }
      this.ui.updateNetStatus();
      if (this.state === 'hub') this.ui.refresh();
    });
    n.on('galaxy', (m) => {
      this.galaxy = m.g;
      this.activeCounts = m.active || {};
      this.online = m.online || 1;
      this.galaxyView.setGalaxy(this.galaxy);
      if (this.state === 'hub') this.ui.refresh();
      else this.ui.updateNetStatus();
    });
    n.on('squad', (m) => {
      const prev = this.squad;
      this.squad = m.squad;
      if (this.squad && this.squad.mission && this.squad.leader !== n.id) {
        this.ui.selPlanet = this.squad.mission.planetId;
        this.ui.selMission = this.squad.mission.type;
        this.ui.selDiff = this.squad.mission.difficulty;
        if (this.state === 'hub') this.galaxyView.select(this.ui.selPlanet);
      }
      if (!prev && this.squad && this.state === 'hub') this.ui.toast(`Esquadrão ${this.squad.code}`);
      if (this.state === 'hub') this.ui.refresh();
    });
    n.on('squad.list', (m) => {
      this.ui.publicSquads = m.list || [];
      if (this.state === 'hub' && this.ui.tab === 'squad' && !this.squad) this.ui.renderSquadList();
    });
    n.on('chat', (m) => this.ui.addChat(m));
    n.on('error', (m) => this.ui.toast(m.text));
    n.on('mission.start', (m) => this.startMission(m, true));
    n.on('mission.result', (m) => { this.lastGain = m.gain || 0; });
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.galaxyView.resize(w, h);
      if (this.mission) this.mission.resize(w, h);
    });
    const cv = this.renderer.domElement;
    let down = null;
    cv.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      this.audio.unlock();
      if (this.state === 'mission' && this.mission && !this.ui.pauseOpen && !this.mission.ended) this.input.lock();
    });
    cv.addEventListener('pointerup', (e) => {
      if (this.state === 'hub' && this.ui.tab === 'war' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
        const id = this.galaxyView.pick(e.clientX, e.clientY);
        if (id) this.ui.selectPlanet(id);
      }
      down = null;
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.state !== 'hub' || this.ui.tab !== 'war') return;
      const id = this.galaxyView.pick(e.clientX, e.clientY);
      this.galaxyView.hover = id;
      cv.style.cursor = id ? 'pointer' : 'grab';
    });
    this.input.onLockChange = (locked) => {
      if (!this.mission) return;
      this.mission.setPlaying(locked);
      if (locked) this.ui.hidePause();
      else if (this.state === 'mission' && !this.mission.ended) this.ui.showPause(this.mission);
    };
  }

  startHub(name) {
    if (!this.profile) this.profile = Profile.create(name);
    else if (name && name !== this.profile.data.name) { this.profile.data.name = name; this.profile.save(); }
    this.audio.setVolume(this.profile.data.settings.volume);
    this.syncProfile();
    this.state = 'hub';
    this.ui.showHub('war');
  }

  deploy(planetId, type, difficulty) {
    if (this.squad && this.net.online) {
      if (this.squad.leader !== this.net.id) return;
      this.net.send('squad.select', { planetId, type, difficulty });
      this.net.send('squad.start', {});
      return;
    }
    const types = missionTypesFor(this.galaxy, planetId);
    if (!types.includes(type)) { this.ui.toast('Missão indisponível.'); return; }
    const planet = PLANET_MAP[planetId];
    const mods = this.profile.netMods();
    const cfg = {
      seed: Math.floor(Math.random() * 2 ** 31),
      planetId, planetName: planet.name, biome: planet.biome,
      faction: missionFaction(this.galaxy, planetId), type, difficulty,
      bonusReinf: mods.reinf, extractSpeed: mods.extractSpeed, callinSpeed: mods.callinSpeed,
      supplyBoxes: mods.supplyBoxes, turretAmmo: mods.turretAmmo, online: false,
    };
    this.startMission({ cfg, full: null, you: 'me' }, false);
  }

  startMission(msg, online) {
    if (this.mission) return;
    const cfg = msg.cfg;
    const planet = PLANET_MAP[cfg.planetId];
    const transport = online ? new NetTransport(this.net, msg.you) : null;
    this.state = 'loading';
    this.ui.showLoading(planet, MISSION_TYPES[cfg.type]?.name || '', cfg.faction);
    this.audio.unlock();
    setTimeout(() => {
      try {
        const world = generateWorld({ seed: cfg.seed, biome: cfg.biome, missionType: cfg.type, decor: true });
        const tr = transport || new LocalTransport(cfg, world, { name: this.profile.data.name, look: this.profile.look() });
        const full = online ? msg.full : tr.fullState();
        this.mission = new MissionClient(this, { cfg, full, myId: online ? msg.you : 'me', transport: tr, world });
        this.ui.clear();
        this.state = 'mission';
        this.lastGain = 0;
      } catch (e) {
        console.error(e);
        this.ui.toast('Falha ao carregar a missão: ' + e.message, 6000);
        if (transport) { transport.abandon(); transport.leave(); }
        this.mission = null;
        this.backToHub();
      }
    }, 60);
  }

  endMission(result, myId) {
    const mc = this.mission;
    if (!mc) return;
    let gain = 0;
    if (!mc.online) {
      gain = applyMissionResult(this.localGalaxy, {
        planetId: result.planetId, difficulty: result.difficulty, success: result.success, faction: result.faction,
        kills: (result.players || []).reduce((a, p) => a + p.kills, 0), deaths: (result.players || []).reduce((a, p) => a + p.deaths, 0),
      });
      galaxyTick(this.localGalaxy, Date.now());
      this.saveLocalGalaxy();
      this.useLocalGalaxy();
    }
    const rewards = this.profile.applyMissionResult(result, myId);
    this.input.unlock();
    this.ui.hidePause();
    mc.dispose();
    this.mission = null;
    this.state = 'debrief';
    this.syncProfile();
    setTimeout(() => this.ui.showDebrief(result, rewards, mc.online ? this.lastGain : gain), 50);
  }

  backToHub() {
    this.state = 'hub';
    this.ui.showHub('war');
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'mission' && this.mission) {
      this.mission.update(dt);
      this.mission.render();
    } else if (this.state !== 'loading') {
      this.galaxyView.update(dt);
      this.galaxyView.render();
      this.ui.updateLabels();
    }
    this.input.endFrame();
  }
}
