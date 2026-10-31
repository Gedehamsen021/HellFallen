// Equipamento estilo "loot": 5 slots, raridades, atributos, perks e exóticos únicos
import { RNG } from '../rng.js';

export const GEAR_SLOTS = [
  { id: 'helmet', name: 'Capacete' },
  { id: 'arms', name: 'Manoplas' },
  { id: 'chest', name: 'Peitoral' },
  { id: 'legs', name: 'Grevas' },
  { id: 'mark', name: 'Insígnia' },
];

export const STATS = [
  { id: 'vigor', name: 'Vigor', short: 'VIG', desc: '+1 de vida máxima por ponto' },
  { id: 'agilidade', name: 'Agilidade', short: 'AGI', desc: '+0,3% de velocidade por ponto' },
  { id: 'blindagem', name: 'Blindagem', short: 'BLD', desc: '-0,4% de dano recebido por ponto' },
  { id: 'foco', name: 'Foco', short: 'FOC', desc: '-0,4% de recarga de chamados por ponto' },
  { id: 'destreza', name: 'Destreza', short: 'DES', desc: '+0,5% de velocidade de recarga por ponto' },
];

export const RARITIES = {
  common: { id: 'common', name: 'Comum', color: '#c9ccd1', budget: 14, perks: 0, w: 50, salvage: 20 },
  uncommon: { id: 'uncommon', name: 'Incomum', color: '#5fd068', budget: 20, perks: 0, w: 30, salvage: 45 },
  rare: { id: 'rare', name: 'Raro', color: '#4fa3ff', budget: 26, perks: 1, w: 15, salvage: 90 },
  legendary: { id: 'legendary', name: 'Lendário', color: '#b26bff', budget: 32, perks: 2, w: 4.5, salvage: 180 },
  exotic: { id: 'exotic', name: 'Exótico', color: '#ffc63a', budget: 30, perks: 0, w: 0.9, salvage: 350 },
};
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary', 'exotic'];

export const GEAR_BASES = {
  helmet: [
    { id: 'h_scout', name: 'Elmo Batedor', variant: 0 },
    { id: 'h_bulwark', name: 'Elmo Bastião', variant: 1 },
    { id: 'h_vanguard', name: 'Visor Vanguarda', variant: 2 },
    { id: 'h_reaper', name: 'Máscara Ceifadora', variant: 3 },
  ],
  arms: [
    { id: 'a_grip', name: 'Manoplas de Assalto', variant: 0 },
    { id: 'a_forge', name: 'Braçadeiras da Forja', variant: 1 },
    { id: 'a_viper', name: 'Luvas Víbora', variant: 2 },
  ],
  chest: [
    { id: 'c_plate', name: 'Couraça de Placas', variant: 0 },
    { id: 'c_vest', name: 'Colete Tático', variant: 1 },
    { id: 'c_aegis', name: 'Peitoral Égide', variant: 2 },
  ],
  legs: [
    { id: 'l_runner', name: 'Grevas de Corrida', variant: 0 },
    { id: 'l_sentinel', name: 'Grevas Sentinela', variant: 1 },
    { id: 'l_strider', name: 'Botas Andarilhas', variant: 2 },
  ],
  mark: [
    { id: 'm_cloak', name: 'Manto do Caído', variant: 0 },
    { id: 'm_banner', name: 'Flâmula de Campanha', variant: 1 },
    { id: 'm_sash', name: 'Faixa de Honra', variant: 2 },
  ],
};

export const GEAR_PERKS = {
  reload10: { id: 'reload10', name: 'Recarga Rápida', desc: 'Recarga 10% mais rápida', mod: { reload: 0.1 } },
  explo10: { id: 'explo10', name: 'Pirotecnia', desc: '+10% de dano explosivo', mod: { explosive: 0.1 } },
  mag1: { id: 'mag1', name: 'Bolsos Fundos', desc: '+1 carregador', mod: { mags: 1 } },
  stim1: { id: 'stim1', name: 'Kit de Campo', desc: '+1 estimulante', mod: { stims: 1 } },
  nade1: { id: 'nade1', name: 'Cinto de Granadas', desc: '+1 granada', mod: { grenades: 1 } },
  speed5: { id: 'speed5', name: 'Passo Leve', desc: '+5% de velocidade', mod: { speed: 0.05 } },
  dr8: { id: 'dr8', name: 'Revestimento Cerâmico', desc: '-8% de dano recebido', mod: { dr: 0.08 } },
  cool8: { id: 'cool8', name: 'Uplink Ajustado', desc: '-8% de recarga de chamados', mod: { cooldown: 0.08 } },
  heavy10: { id: 'heavy10', name: 'Quebra-Couraça', desc: '+10% de dano contra pesados', mod: { heavyDmg: 0.1 } },
  weak15: { id: 'weak15', name: 'Mira Fina', desc: '+15% de dano em pontos fracos', mod: { weakDmg: 0.15 } },
  stam20: { id: 'stam20', name: 'Fôlego', desc: '+20% de estamina', mod: { stamina: 0.2 } },
  regen1: { id: 'regen1', name: 'Nanorreparo', desc: 'Regenera 1 de vida por segundo', mod: { regen: 1 } },
  heal3: { id: 'heal3', name: 'Sede de Batalha', desc: 'Abates restauram 3 de vida', mod: { killHeal: 3 } },
};

export const EXOTICS = [
  { id: 'x_argos', slot: 'helmet', name: 'Olho de Argos', variant: 4,
    perk: 'Visão Absoluta', desc: 'Inimigos num raio de 45m aparecem no radar e são marcados.', mod: { radar: 45 } },
  { id: 'x_crown', slot: 'helmet', name: 'Coroa do Bombardeiro', variant: 5,
    perk: 'Linha Direta', desc: 'Chamados orbitais recarregam 25% mais rápido.', mod: { cooldown: 0.25 } },
  { id: 'x_helio', slot: 'arms', name: 'Punhos de Hélio', variant: 3,
    perk: 'Fusão Portátil', desc: '+2 granadas e raio de explosão 40% maior.', mod: { grenades: 2, nadeRadius: 0.4 } },
  { id: 'x_fever', slot: 'arms', name: 'Gatilho Febril', variant: 4,
    perk: 'Frenesi', desc: 'Abates aumentam a cadência de tiro em 30% por 4 segundos.', mod: { killFireRate: 0.3 } },
  { id: 'x_starheart', slot: 'chest', name: 'Coração de Estrela', variant: 3,
    perk: 'Fornalha Interna', desc: 'Regenera 5 de vida/s após 4s sem sofrer dano.', mod: { outRegen: 5 } },
  { id: 'x_bastion', slot: 'chest', name: 'Bastião Vivo', variant: 4,
    perk: 'Recusa em Cair', desc: 'Um golpe fatal te deixa com 1 de vida (recarga 45s).', mod: { cheatDeath: 45 } },
  { id: 'x_phantom', slot: 'legs', name: 'Passo Fantasma', variant: 3,
    perk: 'Fôlego Infinito', desc: 'Correr não gasta estamina e +8% de velocidade.', mod: { freeSprint: 1, speed: 0.08 } },
  { id: 'x_banner', slot: 'mark', name: 'Estandarte do Inferno', variant: 3,
    perk: 'Grito de Guerra', desc: '+20% de dano. Matar inimigos pesados recarrega granadas.', mod: { dmg: 0.2, heavyNade: 1 } },
];

export const EXOTIC_MAP = Object.fromEntries(EXOTICS.map((e) => [e.id, e]));

let uidCounter = 0;
export function makeUid(rng) {
  uidCounter++;
  return Date.now().toString(36) + '-' + Math.floor((rng ? rng.float() : Math.random()) * 1e9).toString(36) + uidCounter;
}

// Gera uma peça de equipamento aleatória
export function rollGear({ seed, power = 100, slot = null, minRarity = 'common', exoticBoost = 0, luck = 0 } = {}) {
  const rng = new RNG(seed ?? Math.floor(Math.random() * 1e9));
  const minIdx = RARITY_ORDER.indexOf(minRarity);
  const pool = RARITY_ORDER.slice(minIdx).map((id) => {
    const r = RARITIES[id];
    let w = r.w;
    if (id === 'exotic') w += exoticBoost;
    if (id !== 'common') w *= 1 + luck;
    return { id, w };
  });
  const rarity = rng.weighted(pool).id;
  const slotId = slot || rng.pick(GEAR_SLOTS).id;
  const R = RARITIES[rarity];
  let base, name, exotic = null;
  if (rarity === 'exotic') {
    const options = EXOTICS.filter((e) => e.slot === slotId);
    exotic = rng.pick(options);
    name = exotic.name;
    base = { id: exotic.id, variant: exotic.variant };
  } else {
    base = rng.pick(GEAR_BASES[slotId]);
    name = base.name;
  }
  // distribui orçamento de atributos
  const budget = R.budget + Math.floor(power / 60);
  const stats = { vigor: 0, agilidade: 0, blindagem: 0, foco: 0, destreza: 0 };
  const keys = Object.keys(stats);
  const primary = rng.pick(keys);
  const secondary = rng.pick(keys.filter((k) => k !== primary));
  let left = budget;
  const p1 = Math.round(budget * rng.range(0.35, 0.5));
  stats[primary] += p1; left -= p1;
  const p2 = Math.round(left * rng.range(0.35, 0.55));
  stats[secondary] += p2; left -= p2;
  while (left > 0) {
    const k = rng.pick(keys);
    const amt = Math.min(left, rng.int(1, 3));
    stats[k] += amt;
    left -= amt;
  }
  const perks = [];
  const perkKeys = Object.keys(GEAR_PERKS);
  while (perks.length < R.perks) {
    const k = rng.pick(perkKeys);
    if (!perks.includes(k)) perks.push(k);
  }
  return {
    uid: makeUid(rng),
    slot: slotId,
    base: base.id,
    variant: base.variant,
    name,
    rarity,
    power: Math.max(10, Math.round(power + rng.range(-8, 12))),
    stats,
    perks,
    exotic: exotic ? exotic.id : null,
  };
}

export function starterGear() {
  const mk = (slot, base, variant, name, stats) => ({
    uid: 'starter-' + slot, slot, base, variant, name, rarity: 'common', power: 10, stats, perks: [], exotic: null,
  });
  return [
    mk('helmet', 'h_scout', 0, 'Elmo Batedor', { vigor: 4, agilidade: 2, blindagem: 4, foco: 2, destreza: 2 }),
    mk('arms', 'a_grip', 0, 'Manoplas de Assalto', { vigor: 2, agilidade: 2, blindagem: 2, foco: 2, destreza: 6 }),
    mk('chest', 'c_plate', 0, 'Couraça de Placas', { vigor: 6, agilidade: 0, blindagem: 6, foco: 2, destreza: 0 }),
    mk('legs', 'l_runner', 0, 'Grevas de Corrida', { vigor: 2, agilidade: 7, blindagem: 2, foco: 1, destreza: 2 }),
    mk('mark', 'm_cloak', 0, 'Manto do Caído', { vigor: 3, agilidade: 3, blindagem: 2, foco: 4, destreza: 2 }),
  ];
}
