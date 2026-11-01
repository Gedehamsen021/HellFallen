// Guerra Galáctica — estado persistente compartilhado por todos os jogadores
import { PLANETS, PLANET_MAP, neighbors } from './data/planets.js';
import { FACTIONS } from './data/factions.js';
import { MISSION_TYPES } from './data/progression.js';

const MIN = 60 * 1000;

export function createGalaxy(now = Date.now()) {
  const planets = {};
  for (const p of PLANETS) {
    planets[p.id] = { owner: p.owner, lib: p.lib ?? (p.owner === 'legion' ? 100 : 0) };
  }
  const g = {
    version: 1,
    created: now,
    updated: now,
    planets,
    invasions: [],
    order: null,
    orderSeq: 0,
    history: [{ t: now, text: 'A Legião HellFallen inicia a campanha de reconquista galáctica.', kind: 'info' }],
    stats: { missions: 0, success: 0, kills: 0, deaths: 0 },
    nextInvasionAt: now + 4 * MIN,
  };
  newOrder(g, now);
  return g;
}

export function planetStatus(g, id) {
  const st = g.planets[id];
  if (!st) return { kind: 'locked' };
  const inv = g.invasions.find((i) => i.planet === id);
  if (inv) return { kind: 'defense', inv };
  if (st.owner === 'legion') return { kind: 'safe' };
  const front = neighbors(id).some((n) => g.planets[n] && g.planets[n].owner === 'legion');
  return { kind: front ? 'contested' : 'locked' };
}

export function missionTypesFor(g, id) {
  const s = planetStatus(g, id);
  if (s.kind === 'defense') return Object.values(MISSION_TYPES).filter((m) => m.defense).map((m) => m.id);
  if (s.kind === 'contested') return Object.values(MISSION_TYPES).filter((m) => m.attack).map((m) => m.id);
  return [];
}

export function missionFaction(g, id) {
  const s = planetStatus(g, id);
  if (s.kind === 'defense') return s.inv.faction;
  return g.planets[id].owner;
}

function log(g, now, text, kind = 'info') {
  g.history.unshift({ t: now, text, kind });
  if (g.history.length > 40) g.history.length = 40;
}

function newOrder(g, now) {
  const contested = Object.keys(g.planets).filter((id) => planetStatus(g, id).kind === 'contested');
  g.orderSeq++;
  if (contested.length && Math.random() < 0.65) {
    // escolhe o planeta contestado mais avançado
    contested.sort((a, b) => g.planets[b].lib - g.planets[a].lib);
    const target = contested[Math.floor(Math.random() * Math.min(2, contested.length))];
    g.order = {
      id: g.orderSeq, kind: 'liberate', planet: target, reward: 1000, done: false, doneAt: 0,
      expires: now + 6 * 60 * MIN,
      text: `Libertem ${PLANET_MAP[target].name} do domínio ${FACTIONS[g.planets[target].owner].of}.`,
    };
  } else {
    const factions = ['vorr', 'ferro', 'ecos'];
    const f = factions[Math.floor(Math.random() * factions.length)];
    const target = 1500;
    g.order = {
      id: g.orderSeq, kind: 'kills', faction: f, target, progress: 0, reward: 800, done: false, doneAt: 0,
      expires: now + 4 * 60 * MIN,
      text: `Eliminem ${target} inimigos ${FACTIONS[f].of}.`,
    };
  }
  log(g, now, `NOVA ORDEM SUPREMA: ${g.order.text}`, 'order');
}

export function galaxyTick(g, now = Date.now()) {
  const dt = (now - g.updated) / 1000;
  if (dt <= 0) return false;
  g.updated = now;
  let changed = false;

  // Inimigos recuperam terreno lentamente (-1% a cada 4 minutos)
  for (const id in g.planets) {
    const st = g.planets[id];
    if (st.owner !== 'legion' && st.lib > 0 && planetStatus(g, id).kind === 'contested') {
      st.lib = Math.max(0, st.lib - dt / 240);
      changed = true;
    }
  }

  // Invasões
  for (const inv of [...g.invasions]) {
    const name = PLANET_MAP[inv.planet].name;
    if (inv.progress >= 100) {
      g.invasions.splice(g.invasions.indexOf(inv), 1);
      log(g, now, `Invasão repelida em ${name}! Glória aos Caídos.`, 'good');
      changed = true;
    } else if (now >= inv.end) {
      g.invasions.splice(g.invasions.indexOf(inv), 1);
      g.planets[inv.planet].owner = inv.faction;
      g.planets[inv.planet].lib = 0;
      log(g, now, `${name} caiu para ${FACTIONS[inv.faction].the}.`, 'bad');
      changed = true;
    }
  }

  if (now >= g.nextInvasionAt) {
    const candidates = [];
    for (const id in g.planets) {
      if (g.planets[id].owner !== 'legion') continue;
      if (g.invasions.some((i) => i.planet === id)) continue;
      const attackers = neighbors(id).filter((n) => g.planets[n].owner !== 'legion').map((n) => g.planets[n].owner);
      if (attackers.length) candidates.push({ id, attackers });
    }
    if (candidates.length && g.invasions.length < 2) {
      const c = candidates[Math.floor(Math.random() * candidates.length)];
      const faction = c.attackers[Math.floor(Math.random() * c.attackers.length)];
      g.invasions.push({ planet: c.id, faction, start: now, end: now + 30 * MIN, progress: 0 });
      log(g, now, `ALERTA: ${FACTIONS[faction].the} ${faction === 'ecos' ? 'estão' : 'está'} invadindo ${PLANET_MAP[c.id].name}!`, 'bad');
      changed = true;
    }
    g.nextInvasionAt = now + (14 + Math.random() * 12) * MIN;
  }

  // Ordem Suprema
  const o = g.order;
  if (o && !o.done) {
    if (o.kind === 'liberate' && g.planets[o.planet].owner === 'legion') {
      o.done = true; o.doneAt = now;
      log(g, now, `ORDEM SUPREMA CUMPRIDA: ${PLANET_MAP[o.planet].name} foi libertado!`, 'good');
      changed = true;
    } else if (o.kind === 'kills' && o.progress >= o.target) {
      o.done = true; o.doneAt = now;
      log(g, now, 'ORDEM SUPREMA CUMPRIDA: a ameaça foi contida!', 'good');
      changed = true;
    } else if (now > o.expires || (o.kind === 'liberate' && planetStatus(g, o.planet).kind !== 'contested')) {
      log(g, now, 'A Ordem Suprema expirou. O Alto Comando está decepcionado.', 'bad');
      newOrder(g, now);
      changed = true;
    }
  } else if (!o || (o.done && now > o.doneAt + 3 * MIN)) {
    newOrder(g, now);
    changed = true;
  }

  // Se a capital caiu (improvável), devolve para manter o jogo jogável
  if (!Object.values(g.planets).some((p) => p.owner === 'legion')) {
    g.planets.aurora.owner = 'legion';
    g.planets.aurora.lib = 100;
  }
  return changed;
}

// Aplica o resultado de uma missão. Retorna quanto de libertação foi contribuído.
export function applyMissionResult(g, { planetId, difficulty, success, kills = 0, deaths = 0, faction }, now = Date.now()) {
  g.stats.missions++;
  g.stats.kills += kills;
  g.stats.deaths += deaths;
  if (g.order && !g.order.done && g.order.kind === 'kills' && g.order.faction === faction) {
    g.order.progress = Math.min(g.order.target, g.order.progress + kills);
  }
  if (!success) return 0;
  g.stats.success++;
  const gain = 3 + difficulty * 1.3;
  const s = planetStatus(g, planetId);
  const name = PLANET_MAP[planetId]?.name || planetId;
  if (s.kind === 'defense') {
    s.inv.progress = Math.min(100, s.inv.progress + gain * 1.8);
    return gain * 1.8;
  }
  if (s.kind === 'contested') {
    const st = g.planets[planetId];
    st.lib = Math.min(100, st.lib + gain);
    if (st.lib >= 100) {
      st.owner = 'legion';
      st.lib = 100;
      log(g, now, `${name} foi LIBERTADO pela Legião!`, 'good');
    }
    return gain;
  }
  return 0;
}

export function galaxySummary(g) {
  return {
    planets: g.planets,
    invasions: g.invasions,
    order: g.order,
    history: g.history.slice(0, 15),
    stats: g.stats,
  };
}
