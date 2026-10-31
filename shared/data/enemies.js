// Inimigos de cada facção
// ai: melee | ranged | charger | flyer | blinker | boss | structure
// armor: nível de blindagem (penetração da arma precisa ser >= para dano total)
// hit: esferas de colisão relativas ao pé do inimigo { y, z (frente), r, weak }

export const ENEMIES = {
  // ======================== ENXAME VORR ========================
  vorr_crawler: {
    faction: 'vorr', name: 'Rastejante', tier: 'fodder', ai: 'melee',
    hp: 70, armor: 0, speed: 7.8, radius: 0.7, dmg: 9, range: 1.9, cd: 0.85, aggro: 55, xp: 4,
    hit: [{ y: 0.55, z: 0, r: 0.75 }, { y: 0.7, z: 0.75, r: 0.38, weak: true }],
  },
  vorr_spitter: {
    faction: 'vorr', name: 'Cuspidor', tier: 'mid', ai: 'ranged', calls: true,
    hp: 170, armor: 0, speed: 4.6, radius: 0.95, dmg: 16, range: 32, minRange: 12, cd: 2.6, aggro: 65, xp: 9,
    proj: { kind: 'acid', speed: 24, gravity: 14, splash: 2.2 },
    hit: [{ y: 0.9, z: -0.3, r: 1.0, weak: true }, { y: 0.8, z: 0.6, r: 0.55 }],
  },
  vorr_warrior: {
    faction: 'vorr', name: 'Guerreiro', tier: 'mid', ai: 'melee',
    hp: 320, armor: 1, speed: 6.3, radius: 1.0, dmg: 24, range: 2.6, cd: 1.2, aggro: 60, xp: 14,
    hit: [{ y: 1.1, z: 0, r: 0.95 }, { y: 1.9, z: 0.6, r: 0.42, weak: true }],
  },
  vorr_colossus: {
    faction: 'vorr', name: 'Colosso Vorr', tier: 'heavy', ai: 'charger', heavy: true, frontArmor: true,
    hp: 1700, armor: 3, speed: 4.2, chargeSpeed: 19, radius: 2.1, dmg: 45, range: 3.6, cd: 1.6, aggro: 70, xp: 60,
    hit: [{ y: 1.6, z: 0.4, r: 1.9 }, { y: 1.5, z: -1.8, r: 1.1, weak: true }],
  },
  vorr_matriarch: {
    faction: 'vorr', name: 'Matriarca da Colmeia', tier: 'boss', ai: 'boss', heavy: true, boss: true,
    hp: 7000, armor: 2, speed: 3.6, radius: 3.0, dmg: 50, range: 4.5, cd: 1.8, aggro: 90, xp: 300,
    proj: { kind: 'acid', speed: 26, gravity: 12, splash: 4, count: 5 },
    summon: 'vorr_crawler',
    hit: [{ y: 2.4, z: 0, r: 2.8 }, { y: 3.6, z: 2.4, r: 1.1, weak: true }],
  },
  vorr_nest: {
    faction: 'vorr', name: 'Ninho Vorr', tier: 'structure', ai: 'structure', structure: true,
    hp: 1600, armor: 2, radius: 4.5, xp: 40, spawn: ['vorr_crawler', 'vorr_crawler', 'vorr_warrior'], spawnEvery: 9,
    hit: [{ y: 1.6, z: 0, r: 4.2 }, { y: 4.6, z: 0, r: 1.3, weak: true }],
  },

  // ======================== CONCÍLIO DE FERRO ========================
  ferro_drone: {
    faction: 'ferro', name: 'Drone Vigia', tier: 'fodder', ai: 'flyer',
    hp: 80, armor: 0, speed: 9, radius: 0.7, dmg: 7, range: 30, minRange: 8, cd: 1.3, aggro: 60, xp: 5, fly: 7,
    proj: { kind: 'laser', speed: 70, gravity: 0, splash: 0 },
    hit: [{ y: 0, z: 0, r: 0.8, weak: true }],
  },
  ferro_trooper: {
    faction: 'ferro', name: 'Soldado de Ferro', tier: 'fodder', ai: 'ranged', calls: true,
    hp: 120, armor: 0, speed: 4.6, radius: 0.6, dmg: 9, range: 42, minRange: 14, cd: 1.5, burst: 3, aggro: 70, xp: 6,
    proj: { kind: 'laser', speed: 75, gravity: 0, splash: 0 },
    hit: [{ y: 1.1, z: 0, r: 0.6 }, { y: 1.8, z: 0.05, r: 0.3, weak: true }],
  },
  ferro_brute: {
    faction: 'ferro', name: 'Devastador', tier: 'mid', ai: 'ranged',
    hp: 650, armor: 2, speed: 3.6, radius: 1.0, dmg: 28, range: 46, minRange: 16, cd: 3.6, burst: 2, aggro: 70, xp: 22,
    proj: { kind: 'rocket', speed: 40, gravity: 0, splash: 3.5 },
    hit: [{ y: 1.4, z: 0, r: 0.95 }, { y: 2.45, z: 0.1, r: 0.36, weak: true }],
  },
  ferro_walker: {
    faction: 'ferro', name: 'Andarilho Blindado', tier: 'heavy', ai: 'ranged', heavy: true,
    hp: 2600, armor: 3, speed: 3.0, radius: 2.4, dmg: 40, range: 55, minRange: 18, cd: 4.2, burst: 1, aggro: 80, xp: 70,
    proj: { kind: 'cannon', speed: 55, gravity: 4, splash: 5 },
    hit: [{ y: 3.2, z: 0, r: 2.2 }, { y: 3.4, z: -2.0, r: 0.9, weak: true }, { y: 1.3, z: 0, r: 1.3 }],
  },
  ferro_titan: {
    faction: 'ferro', name: 'Titã do Concílio', tier: 'boss', ai: 'boss', heavy: true, boss: true,
    hp: 8000, armor: 3, speed: 2.6, radius: 3.4, dmg: 45, range: 60, cd: 2.4, aggro: 100, xp: 320,
    proj: { kind: 'rocket', speed: 42, gravity: 0, splash: 4.5, count: 4 },
    summon: 'ferro_drone',
    hit: [{ y: 5.2, z: 0, r: 3.0 }, { y: 7.4, z: 0.8, r: 1.0, weak: true }, { y: 2.0, z: 0, r: 1.8 }],
  },
  ferro_factory: {
    faction: 'ferro', name: 'Fábrica Autônoma', tier: 'structure', ai: 'structure', structure: true,
    hp: 2000, armor: 2, radius: 5.0, xp: 45, spawn: ['ferro_trooper', 'ferro_trooper', 'ferro_drone', 'ferro_brute'], spawnEvery: 11,
    hit: [{ y: 2.4, z: 0, r: 4.6 }, { y: 6.8, z: 1.6, r: 1.0, weak: true }],
  },

  // ======================== OS ECOS ========================
  ecos_wisp: {
    faction: 'ecos', name: 'Espectro', tier: 'fodder', ai: 'blinker',
    hp: 75, armor: 0, speed: 7.2, radius: 0.6, dmg: 10, range: 2.0, cd: 0.9, aggro: 55, xp: 5, hover: 0.9,
    hit: [{ y: 1.1, z: 0, r: 0.65 }, { y: 1.8, z: 0, r: 0.35, weak: true }],
  },
  ecos_herald: {
    faction: 'ecos', name: 'Arauto', tier: 'mid', ai: 'ranged', calls: true,
    hp: 240, armor: 1, speed: 4.2, radius: 0.7, dmg: 14, range: 40, minRange: 14, cd: 2.0, burst: 2, aggro: 70, xp: 12, blink: true,
    proj: { kind: 'voidbolt', speed: 34, gravity: 0, splash: 1.5 },
    hit: [{ y: 1.5, z: 0, r: 0.7 }, { y: 2.6, z: 0, r: 0.35, weak: true }],
  },
  ecos_warden: {
    faction: 'ecos', name: 'Guardião do Vazio', tier: 'heavy', ai: 'charger', heavy: true,
    hp: 1500, armor: 3, speed: 3.8, chargeSpeed: 16, radius: 1.8, dmg: 40, range: 3.4, cd: 1.6, aggro: 70, xp: 55, hover: 0.6,
    hit: [{ y: 2.2, z: 0, r: 1.7 }, { y: 4.0, z: 0, r: 0.75, weak: true }],
  },
  ecos_leviathan: {
    faction: 'ecos', name: 'Leviatã do Vazio', tier: 'boss', ai: 'boss', heavy: true, boss: true,
    hp: 6500, armor: 2, speed: 3.4, radius: 3.0, dmg: 48, range: 50, cd: 2.0, aggro: 100, xp: 300, hover: 3,
    proj: { kind: 'voidbolt', speed: 30, gravity: 0, splash: 3, count: 6 },
    summon: 'ecos_wisp',
    hit: [{ y: 2.6, z: 0, r: 2.8 }, { y: 2.8, z: 2.8, r: 1.0, weak: true }],
  },
  ecos_obelisk: {
    faction: 'ecos', name: 'Obelisco do Vazio', tier: 'structure', ai: 'structure', structure: true,
    hp: 1800, armor: 2, radius: 3.0, xp: 42, spawn: ['ecos_wisp', 'ecos_wisp', 'ecos_herald'], spawnEvery: 10,
    hit: [{ y: 4.0, z: 0, r: 2.6 }, { y: 9.0, z: 0, r: 1.2, weak: true }],
  },
};

export const ENEMY_LIST = Object.keys(ENEMIES);
export const ENEMY_INDEX = Object.fromEntries(ENEMY_LIST.map((k, i) => [k, i]));

export const ROSTER = {
  vorr: {
    fodder: ['vorr_crawler'],
    mid: ['vorr_spitter', 'vorr_warrior'],
    heavy: ['vorr_colossus'],
    boss: 'vorr_matriarch',
    structure: 'vorr_nest',
    structureName: 'Ninho',
  },
  ferro: {
    fodder: ['ferro_trooper', 'ferro_drone'],
    mid: ['ferro_brute'],
    heavy: ['ferro_walker'],
    boss: 'ferro_titan',
    structure: 'ferro_factory',
    structureName: 'Fábrica',
  },
  ecos: {
    fodder: ['ecos_wisp'],
    mid: ['ecos_herald'],
    heavy: ['ecos_warden'],
    boss: 'ecos_leviathan',
    structure: 'ecos_obelisk',
    structureName: 'Obelisco',
  },
};
