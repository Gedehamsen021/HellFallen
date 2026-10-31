// Servidor HellFallen: arquivos estáticos + WebSocket (esquadrões, missões, guerra galáctica)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MissionSim, SIM_TICK, SNAP_EVERY } from '../shared/sim/MissionSim.js';
import { createGalaxy, galaxyTick, galaxySummary, applyMissionResult, missionFaction, missionTypesFor } from '../shared/galaxy.js';
import { PLANET_MAP } from '../shared/data/planets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = +(process.env.PORT || 8080);
const DATA_DIR = path.join(__dirname, 'data');
const GALAXY_FILE = path.join(DATA_DIR, 'galaxy.json');

// ------------------------------------------------------------------ HTTP estático
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules', 'three')],
  ['/client/', path.join(ROOT, 'client')],
  ['/shared/', path.join(ROOT, 'shared')],
];

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (url === '/' || url === '/index.html') return serveFile(res, path.join(ROOT, 'client', 'index.html'));
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, online: clients.size })); return; }
  for (const [prefix, dir] of MOUNTS) {
    if (url.startsWith(prefix)) {
      const file = path.resolve(dir, '.' + url.slice(prefix.length - 1));
      if (!file.startsWith(dir + path.sep)) break;
      return serveFile(res, file);
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404');
});

// ------------------------------------------------------------------ Galáxia
let galaxy;
try {
  galaxy = JSON.parse(fs.readFileSync(GALAXY_FILE, 'utf8'));
  if (!galaxy.planets) throw new Error('invalid');
  for (const id of Object.keys(PLANET_MAP)) if (!galaxy.planets[id]) throw new Error('outdated');
} catch {
  galaxy = createGalaxy();
}
let galaxyDirty = true;
function saveGalaxy() {
  if (!galaxyDirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(GALAXY_FILE, JSON.stringify(galaxy));
    galaxyDirty = false;
  } catch (e) {
    console.error('Falha ao salvar galáxia:', e.message);
  }
}

// ------------------------------------------------------------------ Estado de jogadores
const clients = new Map();
const squads = new Map();
let nextClientId = 1;

function send(c, msg) {
  if (c.ws.readyState === 1) c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
}
function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients.values()) send(c, s);
}
function sanitize(str, max = 24) {
  return String(str || '').replace(/[<>&"'`]/g, '').trim().slice(0, max);
}

function activeCounts() {
  const counts = {};
  for (const sq of squads.values()) {
    const pid = sq.mission?.planetId;
    if (!pid) continue;
    counts[pid] = (counts[pid] || 0) + sq.members.size;
  }
  return counts;
}

function galaxyMessage() {
  return { t: 'galaxy', g: galaxySummary(galaxy), active: activeCounts(), online: clients.size };
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += A[Math.floor(Math.random() * A.length)];
  } while (squads.has(code));
  return code;
}

function squadInfo(sq) {
  return {
    code: sq.code,
    leader: sq.leader,
    public: sq.public,
    state: sq.sim ? 'mission' : 'lobby',
    mission: sq.mission,
    members: [...sq.members].map((id) => {
      const c = clients.get(id);
      return { id, name: c?.name || '?', level: c?.level || 1, ready: sq.ready.has(id), look: c?.look || {} };
    }),
  };
}
function sendSquad(sq) {
  const msg = JSON.stringify({ t: 'squad', squad: squadInfo(sq) });
  for (const id of sq.members) {
    const c = clients.get(id);
    if (c) send(c, msg);
  }
}
function squadChat(sq, from, text, sys = false) {
  const msg = JSON.stringify({ t: 'chat', from, text, sys });
  for (const id of sq.members) {
    const c = clients.get(id);
    if (c) send(c, msg);
  }
}

function joinSquad(c, sq) {
  if (c.squad) leaveSquad(c);
  if (sq.members.size >= 4) { send(c, { t: 'error', text: 'Esquadrão cheio (máximo 4).' }); return false; }
  sq.members.add(c.id);
  c.squad = sq.code;
  squadChat(sq, null, `${c.name} entrou no esquadrão.`, true);
  sendSquad(sq);
  if (sq.sim) startForMember(sq, c);
  return true;
}

function leaveSquad(c) {
  const sq = squads.get(c.squad);
  c.squad = null;
  if (!sq) return;
  sq.members.delete(c.id);
  sq.ready.delete(c.id);
  if (sq.sim) sq.sim.removePlayer(c.id);
  if (sq.members.size === 0) {
    squads.delete(sq.code);
    return;
  }
  if (sq.leader === c.id) sq.leader = [...sq.members][0];
  squadChat(sq, null, `${c.name} saiu do esquadrão.`, true);
  sendSquad(sq);
}

function startForMember(sq, c) {
  sq.sim.addPlayer(c.id, { name: c.name, look: c.look });
  send(c, { t: 'mission.start', cfg: sq.simCfg, full: sq.sim.fullState(), you: c.id });
}

function startMission(sq) {
  const m = sq.mission;
  if (!m || !PLANET_MAP[m.planetId]) return;
  galaxyTick(galaxy, Date.now());
  const types = missionTypesFor(galaxy, m.planetId);
  if (!types.includes(m.type)) {
    squadChat(sq, null, 'Essa missão não está mais disponível neste planeta.', true);
    return;
  }
  const planet = PLANET_MAP[m.planetId];
  const leader = clients.get(sq.leader);
  const mods = leader?.mods || {};
  const cfg = {
    seed: Math.floor(Math.random() * 2 ** 31),
    planetId: planet.id, planetName: planet.name, biome: planet.biome,
    faction: missionFaction(galaxy, planet.id), type: m.type,
    difficulty: Math.max(1, Math.min(10, m.difficulty | 0)),
    bonusReinf: Math.min(4, mods.reinf || 0),
    extractSpeed: Math.min(0.5, mods.extractSpeed || 0),
    callinSpeed: Math.min(0.5, mods.callinSpeed || 0),
    supplyBoxes: Math.min(4, mods.supplyBoxes || 0),
    turretAmmo: Math.min(1, mods.turretAmmo || 0),
    online: true,
  };
  sq.simCfg = cfg;
  sq.sim = new MissionSim(cfg);
  sq.tick = 0;
  sq.ready.clear();
  for (const id of sq.members) {
    const c = clients.get(id);
    if (c) startForMember(sq, c);
  }
  sendSquad(sq);
  console.log(`[missão] esquadrão ${sq.code} → ${planet.name} (${m.type}, dif ${cfg.difficulty}) com ${sq.members.size} jogador(es)`);
}

function finishMission(sq) {
  const r = sq.sim.result;
  if (r) {
    const kills = r.players.reduce((a, p) => a + p.kills, 0);
    const deaths = r.players.reduce((a, p) => a + p.deaths, 0);
    const gain = applyMissionResult(galaxy, { planetId: r.planetId, difficulty: r.difficulty, success: r.success, kills, deaths, faction: r.faction });
    galaxyTick(galaxy, Date.now());
    galaxyDirty = true;
    const msg = JSON.stringify({ t: 'mission.result', gain });
    for (const id of sq.members) { const c = clients.get(id); if (c) send(c, msg); }
    broadcast(galaxyMessage());
  }
  sq.sim = null;
  sendSquad(sq);
}

// ------------------------------------------------------------------ WebSocket
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws) => {
  const c = { id: 'p' + nextClientId++, ws, name: 'Caído', level: 1, look: {}, squad: null, mods: {}, alive: true };
  clients.set(c.id, c);

  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const sq = c.squad ? squads.get(c.squad) : null;
    switch (msg.t) {
      case 'hello':
        c.name = sanitize(msg.name) || 'Caído';
        c.level = Math.max(1, Math.min(50, msg.level | 0));
        c.look = typeof msg.look === 'object' && msg.look ? msg.look : {};
        c.mods = typeof msg.mods === 'object' && msg.mods ? msg.mods : {};
        send(c, { t: 'welcome', id: c.id });
        send(c, galaxyMessage());
        break;
      case 'profile':
        if (msg.name) c.name = sanitize(msg.name) || c.name;
        c.level = Math.max(1, Math.min(50, msg.level | 0));
        if (msg.look && typeof msg.look === 'object') c.look = msg.look;
        if (msg.mods && typeof msg.mods === 'object') c.mods = msg.mods;
        if (sq) sendSquad(sq);
        break;
      case 'squad.create': {
        if (c.squad) leaveSquad(c);
        const nsq = { code: makeCode(), leader: c.id, members: new Set(), ready: new Set(), public: !!msg.public, mission: null, sim: null };
        squads.set(nsq.code, nsq);
        joinSquad(c, nsq);
        break;
      }
      case 'squad.join': {
        const target = squads.get(String(msg.code || '').toUpperCase().trim());
        if (!target) send(c, { t: 'error', text: 'Esquadrão não encontrado.' });
        else joinSquad(c, target);
        break;
      }
      case 'squad.quick': {
        const open = [...squads.values()].filter((s) => s.public && s.members.size < 4 && s.code !== c.squad && (!msg.planetId || s.mission?.planetId === msg.planetId));
        open.sort((a, b) => b.members.size - a.members.size);
        if (open.length) joinSquad(c, open[0]);
        else send(c, { t: 'error', text: 'Nenhum esquadrão público disponível. Crie um e deixe-o público!' });
        break;
      }
      case 'squad.list': {
        const list = [...squads.values()].filter((s) => s.public && s.members.size < 4).slice(0, 20).map((s) => ({
          code: s.code, size: s.members.size, mission: s.mission, state: s.sim ? 'mission' : 'lobby', leader: clients.get(s.leader)?.name,
        }));
        send(c, { t: 'squad.list', list });
        break;
      }
      case 'squad.leave':
        if (sq) leaveSquad(c);
        send(c, { t: 'squad', squad: null });
        break;
      case 'squad.public':
        if (sq && sq.leader === c.id) { sq.public = !!msg.public; sendSquad(sq); }
        break;
      case 'squad.select':
        if (sq && sq.leader === c.id && !sq.sim && PLANET_MAP[msg.planetId]) {
          sq.mission = { planetId: msg.planetId, type: String(msg.type), difficulty: Math.max(1, Math.min(10, msg.difficulty | 0)) };
          sendSquad(sq);
        }
        break;
      case 'squad.ready':
        if (sq) { if (msg.ready) sq.ready.add(c.id); else sq.ready.delete(c.id); sendSquad(sq); }
        break;
      case 'squad.start':
        if (sq && sq.leader === c.id && !sq.sim) startMission(sq);
        break;
      case 'chat': {
        const text = sanitize(msg.text, 160);
        if (text && sq) squadChat(sq, c.name, text);
        break;
      }
      case 'm':
        if (sq && sq.sim && msg.k) sq.sim.handle(c.id, msg.k, msg.d);
        break;
      case 'mission.leave':
        if (sq && sq.sim) {
          sq.sim.removePlayer(c.id);
          if (![...sq.members].some((id) => sq.sim.players.has(id))) {
            sq.sim = null;
          }
          sendSquad(sq);
        }
        break;
    }
  });

  ws.on('close', () => {
    if (c.squad) leaveSquad(c);
    clients.delete(c.id);
  });
});

// ------------------------------------------------------------------ Loops
setInterval(() => {
  for (const sq of squads.values()) {
    if (!sq.sim) continue;
    sq.sim.update(SIM_TICK);
    sq.tick++;
    if (sq.tick % SNAP_EVERY === 0 || sq.sim.ended) {
      const snap = JSON.stringify({ t: 'snap', s: sq.sim.snapshot() });
      for (const id of sq.members) {
        const c = clients.get(id);
        if (c && sq.sim.players.has(id)) send(c, snap);
      }
      if (sq.sim.ended) finishMission(sq);
    }
  }
}, SIM_TICK * 1000);

setInterval(() => {
  if (galaxyTick(galaxy, Date.now())) galaxyDirty = true;
}, 5000);
setInterval(() => broadcast(galaxyMessage()), 15000);
setInterval(saveGalaxy, 30000);
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 20000);

process.on('SIGINT', () => { saveGalaxy(); process.exit(0); });
process.on('SIGTERM', () => { saveGalaxy(); process.exit(0); });

server.listen(PORT, () => {
  console.log(`\n  HELLFALLEN — servidor no ar em http://localhost:${PORT}\n`);
});
