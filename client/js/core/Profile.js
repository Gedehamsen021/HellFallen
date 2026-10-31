// Perfil persistente do jogador (localStorage): nível, arsenal, equipamento, pesquisa
import { WEAPONS, GRENADES } from '../../../shared/data/weapons.js';
import { CALLINS } from '../../../shared/data/callins.js';
import { PERKS, perkSlots } from '../../../shared/data/perks.js';
import { GEAR_PERKS, EXOTIC_MAP, RARITIES, rollGear, starterGear } from '../../../shared/data/gear.js';
import { xpForLevel, MAX_LEVEL, RESEARCH, rankFor, DIFFICULTIES } from '../../../shared/data/progression.js';

const KEY = 'hellfallen.profile.v1';

export const ARMOR_COLORS = ['#2b2f3a', '#e8e4d8', '#3a4a2a', '#5a2a22', '#1f3550', '#8a1f1f', '#d4a017', '#4a4a52', '#16161c', '#6b4a8a', '#2a6b6b', '#b05a1a', '#c8c8d0', '#203020'];
export const VISOR_COLORS = ['#ffb000', '#3fd8ff', '#ff3b4e', '#4cff8a', '#c06bff', '#ffffff', '#ff7ad9'];

export function defaultProfile(name = 'Caído') {
  const gear = starterGear();
  return {
    v: 1,
    name,
    level: 1,
    xp: 0,
    credits: 400,
    samples: 0,
    owned: {
      weapons: ['ar7', 'p19'],
      callins: ['orb_precision', 'sentry_mg', 'supply', 'wpn_mg43'],
      grenades: ['frag'],
    },
    loadout: {
      primary: 'ar7', secondary: 'p19', grenade: 'frag',
      callins: ['orb_precision', 'sentry_mg', 'supply', 'wpn_mg43'],
      perks: ['adrenaline', 'quickhands'],
    },
    inventory: gear,
    equipped: Object.fromEntries(gear.map((g) => [g.slot, g.uid])),
    colors: { c1: '#4a4a52', c2: '#d4a017', visor: '#ffb000' },
    research: [],
    stats: { missions: 0, success: 0, kills: 0, deaths: 0, extractions: 0, samples: 0, bestDifficulty: 0 },
    maxDifficulty: 3,
    claimedOrders: [],
    settings: { sens: 1, volume: 0.7, quality: 'alta', fov: 72 },
  };
}

export class Profile {
  constructor(data) {
    this.data = data;
  }

  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const base = defaultProfile(d.name);
        const merged = { ...base, ...d, owned: { ...base.owned, ...d.owned }, loadout: { ...base.loadout, ...d.loadout }, settings: { ...base.settings, ...d.settings }, stats: { ...base.stats, ...d.stats }, colors: { ...base.colors, ...d.colors } };
        return new Profile(merged);
      }
    } catch (e) {
      console.warn('Perfil corrompido, criando novo', e);
    }
    return null;
  }

  static create(name) {
    const p = new Profile(defaultProfile(name));
    p.grantFreeUnlocks();
    p.save();
    return p;
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {}
  }

  get level() { return this.data.level; }
  get rank() { return rankFor(this.data.level); }
  xpNeeded() { return xpForLevel(this.data.level); }

  // Itens sem custo liberam automaticamente ao atingir o nível
  grantFreeUnlocks() {
    const d = this.data;
    for (const [id, w] of Object.entries(WEAPONS)) if (w.slot !== 'support' && !w.cost && w.level <= d.level && !d.owned.weapons.includes(id)) d.owned.weapons.push(id);
    for (const [id, c] of Object.entries(CALLINS)) if (!c.cost && c.level <= d.level && !d.owned.callins.includes(id)) d.owned.callins.push(id);
    for (const [id, g] of Object.entries(GRENADES)) if (!g.cost && g.level <= d.level && !d.owned.grenades.includes(id)) d.owned.grenades.push(id);
  }

  addXp(amount) {
    const d = this.data;
    const levels = [];
    d.xp += Math.round(amount);
    while (d.level < MAX_LEVEL && d.xp >= xpForLevel(d.level)) {
      d.xp -= xpForLevel(d.level);
      d.level++;
      levels.push(d.level);
    }
    if (d.level >= MAX_LEVEL) d.xp = Math.min(d.xp, xpForLevel(MAX_LEVEL));
    if (levels.length) this.grantFreeUnlocks();
    return levels;
  }

  equippedItems() {
    const d = this.data;
    const out = {};
    for (const [slot, uid] of Object.entries(d.equipped)) {
      const it = d.inventory.find((i) => i.uid === uid);
      if (it) out[slot] = it;
    }
    return out;
  }

  totalStats() {
    const s = { vigor: 0, agilidade: 0, blindagem: 0, foco: 0, destreza: 0 };
    for (const it of Object.values(this.equippedItems())) for (const k in s) s[k] += it.stats[k] || 0;
    return s;
  }

  power() {
    const items = Object.values(this.equippedItems());
    if (!items.length) return 0;
    return Math.round(items.reduce((a, i) => a + i.power, 0) / items.length);
  }

  // Soma de modificadores de perks + equipamento + exóticos + pesquisa
  mods() {
    const m = {};
    const add = (mod) => { for (const k in mod) m[k] = (m[k] || 0) + mod[k]; };
    const d = this.data;
    for (const pid of d.loadout.perks.slice(0, perkSlots(d.level))) if (PERKS[pid]) add(PERKS[pid].mod);
    for (const it of Object.values(this.equippedItems())) {
      for (const pk of it.perks || []) if (GEAR_PERKS[pk]) add(GEAR_PERKS[pk].mod);
      if (it.exotic && EXOTIC_MAP[it.exotic]) add(EXOTIC_MAP[it.exotic].mod);
    }
    for (const rid of d.research) {
      const r = RESEARCH.find((x) => x.id === rid);
      if (r) add(r.mod);
    }
    return m;
  }

  derived() {
    const s = this.totalStats();
    const m = this.mods();
    const nade = GRENADES[this.data.loadout.grenade] || GRENADES.frag;
    return {
      stats: s,
      mods: m,
      maxHp: Math.round(100 + s.vigor + (m.hp || 0)),
      speedMult: 1 + s.agilidade * 0.003 + (m.speed || 0),
      dr: Math.min(0.6, s.blindagem * 0.004 + (m.dr || 0)),
      cooldownMult: Math.max(0.4, 1 - s.foco * 0.004 - (m.cooldown || 0)),
      reloadMult: 1 + s.destreza * 0.005 + (m.reload || 0),
      stims: 4 + (m.stims || 0),
      grenades: nade.count + (m.grenades || 0),
      mags: m.mags || 0,
      power: this.power(),
    };
  }

  look() {
    const eq = this.equippedItems();
    const d = this.data;
    return {
      c1: d.colors.c1, c2: d.colors.c2, visor: d.colors.visor,
      helmet: eq.helmet?.variant || 0, arms: eq.arms?.variant || 0, chest: eq.chest?.variant || 0,
      legs: eq.legs?.variant || 0, mark: eq.mark?.variant || 0,
    };
  }

  netMods() {
    const m = this.mods();
    return { reinf: m.reinf || 0, extractSpeed: m.extractSpeed || 0, callinSpeed: m.callinSpeed || 0, supplyBoxes: m.supplyBoxes || 0, turretAmmo: m.turretAmmo || 0 };
  }

  hasExoticEquipped(exceptSlot) {
    return Object.values(this.equippedItems()).some((i) => i.rarity === 'exotic' && i.slot !== exceptSlot);
  }

  equip(uid) {
    const it = this.data.inventory.find((i) => i.uid === uid);
    if (!it) return 'Item não encontrado';
    if (it.rarity === 'exotic' && this.hasExoticEquipped(it.slot)) return 'Apenas um exótico pode ser equipado por vez.';
    this.data.equipped[it.slot] = uid;
    this.save();
    return null;
  }

  dismantle(uid) {
    const d = this.data;
    if (Object.values(d.equipped).includes(uid)) return 0;
    const idx = d.inventory.findIndex((i) => i.uid === uid);
    if (idx < 0) return 0;
    const it = d.inventory[idx];
    const value = RARITIES[it.rarity].salvage + Math.round(it.power / 10);
    d.inventory.splice(idx, 1);
    d.credits += value;
    this.save();
    return value;
  }

  buyCrate() {
    const cost = 600;
    if (this.data.credits < cost) return null;
    this.data.credits -= cost;
    const item = rollGear({ power: 40 + this.data.level * 12, luck: this.mods().luck || 0, minRarity: 'uncommon' });
    this.data.inventory.push(item);
    this.save();
    return item;
  }

  // ---------------- Recompensas da missão ----------------
  applyMissionResult(result, myId, extra = {}) {
    const d = this.data;
    const me = result.players.find((p) => p.id === myId) || { kills: 0, xpKills: 0, deaths: 0, samples: 0, extracted: false };
    const diff = DIFFICULTIES[result.difficulty - 1];
    const lines = [];
    lines.push(['Abates', me.xpKills]);
    if (result.mainDone) lines.push(['Objetivo principal', 600]);
    if (result.optionalDone) lines.push([`Objetivos secundários (${result.optionalDone})`, result.optionalDone * 180]);
    if (me.extracted) lines.push(['Extração', 400]);
    if (result.caches && me.extracted) lines.push([`Depósitos (${result.caches})`, result.caches * 120]);
    let base = lines.reduce((a, l) => a + l[1], 0);
    if (!result.success) { base *= 0.4; lines.push(['Penalidade por fracasso', '×0,4']); }
    const xp = Math.round(base * diff.xpMult);
    lines.push([`Bônus de dificuldade (${diff.name})`, '×' + diff.xpMult.toFixed(2).replace('.', ',')]);
    const credits = Math.round((result.success ? 260 : 70) * (1 + result.difficulty * 0.25) + me.kills * 2 + (me.extracted ? 160 : 0));
    const samples = me.samples || 0;
    const levels = this.addXp(xp);
    d.credits += credits;
    d.samples += samples;
    d.stats.missions++;
    if (result.success) d.stats.success++;
    d.stats.kills += me.kills;
    d.stats.deaths += me.deaths;
    if (me.extracted) d.stats.extractions++;
    d.stats.samples += samples;
    if (result.success) {
      d.stats.bestDifficulty = Math.max(d.stats.bestDifficulty, result.difficulty);
      d.maxDifficulty = Math.min(10, Math.max(d.maxDifficulty, result.difficulty + 1));
    }
    // loot
    const loot = [];
    if (result.success) {
      let rolls = 1 + (result.difficulty >= 4 ? 1 : 0) + (result.difficulty >= 8 ? 1 : 0);
      if (me.extracted) rolls += result.caches || 0;
      const power = 40 + d.level * 12 + result.difficulty * 14;
      for (let i = 0; i < rolls; i++) {
        const item = rollGear({
          power,
          minRarity: result.difficulty >= 7 ? 'uncommon' : 'common',
          exoticBoost: result.difficulty * 0.25,
          luck: (this.mods().luck || 0) + result.difficulty * 0.05,
        });
        d.inventory.push(item);
        loot.push(item);
      }
    }
    for (const lv of levels) {
      if (lv % 5 === 0) {
        const item = rollGear({ power: 40 + lv * 12, minRarity: 'rare', exoticBoost: 2 });
        d.inventory.push(item);
        loot.push(item);
      }
    }
    if (d.inventory.length > 120) {
      // descarta os piores itens não equipados para manter o inventário sob controle
      const eq = new Set(Object.values(d.equipped));
      d.inventory.sort((a, b) => b.power - a.power);
      while (d.inventory.length > 120) {
        const idx = d.inventory.findLastIndex((i) => !eq.has(i.uid) && i.rarity !== 'exotic');
        if (idx < 0) break;
        d.inventory.splice(idx, 1);
      }
    }
    this.save();
    return { xp, credits, samples, levels, loot, lines, me };
  }
}
