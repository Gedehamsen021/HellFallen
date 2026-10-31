// Chamados Orbitais — o jogador arremessa um sinalizador e o Bastião responde.
// cat: orbital (vermelho) | aereo (vermelho) | defesa (verde) | suprimento (azul) | arma (azul)

export const CALLIN_CATS = {
  orbital: { name: 'Orbital', color: '#ff4a3a' },
  aereo: { name: 'Aéreo', color: '#ff7a2a' },
  defesa: { name: 'Defesa', color: '#4cff8a' },
  suprimento: { name: 'Suprimento', color: '#4fb8ff' },
  arma: { name: 'Arma de Suporte', color: '#4fb8ff' },
};

export const CALLINS = {
  orb_precision: {
    id: 'orb_precision', name: 'Ataque Orbital de Precisão', cat: 'orbital', icon: '◎',
    cooldown: 90, delay: 2.6, level: 1, cost: 0, dmg: 2400, radius: 10, pen: 5,
    desc: 'Um único disparo do canhão principal do Bastião. Devastador num ponto.',
  },
  air_cluster: {
    id: 'air_cluster', name: 'Bombas de Fragmentação', cat: 'aereo', icon: '⁂',
    cooldown: 70, delay: 2.0, level: 2, cost: 500, dmg: 300, radius: 5, count: 12, length: 44, pen: 3,
    desc: 'Um caça risca o céu e espalha bombas em linha. Ótimo contra enxames.',
  },
  orb_barrage: {
    id: 'orb_barrage', name: 'Barragem 120mm', cat: 'orbital', icon: '☄',
    cooldown: 200, delay: 3.0, level: 5, cost: 1200, dmg: 520, radius: 7, count: 14, area: 26, duration: 8, pen: 4,
    desc: 'Chuva de projéteis numa grande área por 8 segundos. Mantenha distância!',
  },
  air_napalm: {
    id: 'air_napalm', name: 'Bombardeio de Napalm', cat: 'aereo', icon: '♨',
    cooldown: 110, delay: 2.2, level: 7, cost: 1500, dmg: 45, radius: 5.5, count: 6, length: 38, duration: 10,
    desc: 'Linha de fogo que queima por 10 segundos.',
  },
  orb_laser: {
    id: 'orb_laser', name: 'Laser Orbital', cat: 'orbital', icon: '✦',
    cooldown: 300, delay: 2.5, level: 15, cost: 3500, dmg: 650, radius: 4.5, duration: 11, speed: 9,
    desc: 'Um feixe que caça inimigos sozinho por 11 segundos.',
  },
  orb_solar: {
    id: 'orb_solar', name: 'Ogiva Solar', cat: 'orbital', icon: '☀',
    cooldown: 480, delay: 9, level: 20, cost: 6000, dmg: 9000, radius: 32, pen: 5,
    desc: 'O último recurso. Uma explosão gigantesca após 9 segundos. CORRA.',
  },
  sentry_mg: {
    id: 'sentry_mg', name: 'Torre Sentinela', cat: 'defesa', icon: '⌖',
    cooldown: 140, delay: 2.0, level: 1, cost: 0, dmg: 38, range: 55, ammo: 220, life: 120, fireRate: 9, pen: 2,
    desc: 'Metralhadora automática que dispara em qualquer inimigo próximo.',
  },
  sentry_rocket: {
    id: 'sentry_rocket', name: 'Torre de Foguetes', cat: 'defesa', icon: '⇈',
    cooldown: 190, delay: 2.0, level: 12, cost: 2500, dmg: 340, radius: 4, range: 70, ammo: 36, life: 140, fireRate: 0.8, pen: 4,
    desc: 'Dispara foguetes contra alvos pesados a longa distância.',
  },
  shield: {
    id: 'shield', name: 'Gerador de Escudo', cat: 'defesa', icon: '◍',
    cooldown: 170, delay: 1.5, level: 8, cost: 1800, radius: 9, life: 25,
    desc: 'Cúpula de energia que bloqueia projéteis inimigos por 25 segundos.',
  },
  minefield: {
    id: 'minefield', name: 'Campo Minado', cat: 'defesa', icon: '⁘',
    cooldown: 150, delay: 1.8, level: 6, cost: 1100, dmg: 450, radius: 4, count: 22, area: 13, life: 180,
    desc: 'Espalha 22 minas que explodem quando inimigos se aproximam.',
  },
  supply: {
    id: 'supply', name: 'Suprimentos', cat: 'suprimento', icon: '✚',
    cooldown: 150, delay: 3.0, level: 1, cost: 0, boxes: 4,
    desc: 'Cápsula com munição, granadas e estimulantes para o esquadrão.',
  },
  wpn_mg43: {
    id: 'wpn_mg43', name: 'Entrega: MG-43 Martelo', cat: 'arma', icon: '⫼', weapon: 'mg43',
    cooldown: 300, delay: 3.5, level: 1, cost: 0,
    desc: 'Entrega uma metralhadora pesada.',
  },
  wpn_rl8: {
    id: 'wpn_rl8', name: 'Entrega: RL-8 Catapulta', cat: 'arma', icon: '➶', weapon: 'rl8',
    cooldown: 300, delay: 3.5, level: 3, cost: 800,
    desc: 'Entrega um lança-foguetes antiblindagem.',
  },
  wpn_gl6: {
    id: 'wpn_gl6', name: 'Entrega: GL-6 Trovão', cat: 'arma', icon: '⦿', weapon: 'gl6',
    cooldown: 300, delay: 3.5, level: 4, cost: 1000,
    desc: 'Entrega um lança-granadas.',
  },
  wpn_fl3: {
    id: 'wpn_fl3', name: 'Entrega: FL-3 Inferno', cat: 'arma', icon: '♆', weapon: 'fl3',
    cooldown: 300, delay: 3.5, level: 9, cost: 1600,
    desc: 'Entrega um lança-chamas.',
  },
  wpn_rg1: {
    id: 'wpn_rg1', name: 'Entrega: RG-1 Lança de Íons', cat: 'arma', icon: '⟿', weapon: 'rg1',
    cooldown: 300, delay: 3.5, level: 10, cost: 2200,
    desc: 'Entrega um canhão eletromagnético perfurante.',
  },
};

export const CALLIN_LIST = Object.keys(CALLINS);
export const CALLIN_INDEX = Object.fromEntries(CALLIN_LIST.map((k, i) => [k, i]));
