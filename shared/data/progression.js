// Níveis, patentes, dificuldades, tipos de missão e pesquisas

export const MAX_LEVEL = 50;

export function xpForLevel(level) {
  return Math.round(600 + (level - 1) * 220 + Math.pow(level - 1, 1.7) * 18);
}

export const RANKS = [
  [1, 'Cadete'], [3, 'Caído'], [6, 'Cabo Infernal'], [10, 'Sargento do Abismo'],
  [15, 'Tenente Cinzento'], [20, 'Capitão Rubro'], [25, 'Comandante de Queda'],
  [30, 'Coronel do Vazio'], [35, 'General Estelar'], [40, 'Marechal do Inferno'], [50, 'Lenda Caída'],
];

export function rankFor(level) {
  let r = RANKS[0][1];
  for (const [l, name] of RANKS) if (level >= l) r = name;
  return r;
}

export const DIFFICULTIES = [
  { lvl: 1, name: 'Recruta', hpMult: 0.75, groupSize: [2, 3], patrols: 7, patrolEvery: 95, maxActive: 22, mid: 0.12, heavy: 0, breachCd: 45, xpMult: 1.0, reinf: 8, level: 1 },
  { lvl: 2, name: 'Soldado', hpMult: 0.85, groupSize: [2, 4], patrols: 8, patrolEvery: 85, maxActive: 26, mid: 0.18, heavy: 0, breachCd: 40, xpMult: 1.2, reinf: 8, level: 1 },
  { lvl: 3, name: 'Veterano', hpMult: 0.95, groupSize: [3, 4], patrols: 9, patrolEvery: 75, maxActive: 30, mid: 0.22, heavy: 0.03, breachCd: 36, xpMult: 1.45, reinf: 7, level: 3 },
  { lvl: 4, name: 'Desafiador', hpMult: 1.0, groupSize: [3, 5], patrols: 10, patrolEvery: 68, maxActive: 34, mid: 0.26, heavy: 0.05, breachCd: 32, xpMult: 1.75, reinf: 7, level: 6 },
  { lvl: 5, name: 'Brutal', hpMult: 1.05, groupSize: [3, 6], patrols: 11, patrolEvery: 60, maxActive: 38, mid: 0.3, heavy: 0.07, breachCd: 30, xpMult: 2.1, reinf: 6, level: 9 },
  { lvl: 6, name: 'Implacável', hpMult: 1.1, groupSize: [4, 6], patrols: 12, patrolEvery: 54, maxActive: 42, mid: 0.33, heavy: 0.09, breachCd: 27, xpMult: 2.5, reinf: 6, level: 12 },
  { lvl: 7, name: 'Suicida', hpMult: 1.15, groupSize: [4, 7], patrols: 13, patrolEvery: 48, maxActive: 46, mid: 0.36, heavy: 0.11, breachCd: 24, xpMult: 3.0, reinf: 5, level: 16 },
  { lvl: 8, name: 'Impossível', hpMult: 1.2, groupSize: [5, 7], patrols: 14, patrolEvery: 43, maxActive: 52, mid: 0.38, heavy: 0.13, breachCd: 22, xpMult: 3.6, reinf: 5, level: 20 },
  { lvl: 9, name: 'Infernal', hpMult: 1.3, groupSize: [5, 8], patrols: 15, patrolEvery: 38, maxActive: 58, mid: 0.4, heavy: 0.15, breachCd: 20, xpMult: 4.3, reinf: 5, level: 25 },
  { lvl: 10, name: 'Queda do Inferno', hpMult: 1.4, groupSize: [6, 9], patrols: 16, patrolEvery: 34, maxActive: 64, mid: 0.42, heavy: 0.18, breachCd: 18, xpMult: 5.2, reinf: 4, level: 30 },
];

export const MISSION_TYPES = {
  purge: {
    id: 'purge', name: 'Purgar Território', icon: '✸',
    desc: 'Destrua as 3 estruturas inimigas principais. Use explosivos e chamados orbitais.',
    attack: true, defense: false,
  },
  uplink: {
    id: 'uplink', name: 'Transmissão de Dados', icon: '⌁',
    desc: 'Ative o terminal e proteja a transmissão até chegar a 100%.',
    attack: true, defense: true,
  },
  launch: {
    id: 'launch', name: 'Ignição do Farol', icon: '⇡',
    desc: 'Ative os 3 consoles e defenda o lançamento do míssil sísmico.',
    attack: true, defense: false,
  },
  eliminate: {
    id: 'eliminate', name: 'Caçada', icon: '☠',
    desc: 'Localize e elimine um alvo de altíssimo valor e sua escolta.',
    attack: true, defense: false,
  },
  defend: {
    id: 'defend', name: 'Defender o Gerador', icon: '⛨',
    desc: 'Ative o gerador planetário e mantenha-o de pé durante as ondas inimigas.',
    attack: false, defense: true,
  },
};

export const RESEARCH = [
  { id: 'r_reinf', name: 'Cápsulas de Reforço Extras', desc: '+2 reforços por missão.', samples: 15, credits: 500, mod: { reinf: 2 } },
  { id: 'r_vitals', name: 'Nanotraje Reforçado', desc: '+15 de vida máxima.', samples: 20, credits: 800, mod: { hp: 15 } },
  { id: 'r_stims', name: 'Farmácia de Campo', desc: '+1 estimulante.', samples: 20, credits: 700, mod: { stims: 1 } },
  { id: 'r_orbital', name: 'Capacitores do Canhão', desc: '-10% de recarga de todos os chamados.', samples: 30, credits: 1500, mod: { cooldown: 0.1 } },
  { id: 'r_drop', name: 'Trajetória Otimizada', desc: 'Chamados chegam 30% mais rápido.', samples: 25, credits: 1200, mod: { callinSpeed: 0.3 } },
  { id: 'r_supply', name: 'Logística de Carga', desc: 'Suprimentos trazem +2 caixas.', samples: 15, credits: 600, mod: { supplyBoxes: 2 } },
  { id: 'r_turret', name: 'Tambores Expandidos', desc: 'Torres com +40% de munição.', samples: 25, credits: 1000, mod: { turretAmmo: 0.4 } },
  { id: 'r_extract', name: 'Pilotos de Elite', desc: 'Nave de extração chega 30% mais rápido.', samples: 35, credits: 1800, mod: { extractSpeed: 0.3 } },
  { id: 'r_luck', name: 'Scanner de Destroços', desc: '+25% de chance de loot raro.', samples: 40, credits: 2500, mod: { luck: 0.25 } },
];
