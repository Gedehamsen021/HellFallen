// Armas — primárias, secundárias e de suporte (entregues por chamado orbital)
// type: hitscan | pellet | projectile | beam | flame | arc | rail
// pen: penetração de blindagem (0..5)

export const WEAPONS = {
  // ------------------ PRIMÁRIAS ------------------
  ar7: {
    id: 'ar7', name: 'AR-7 Vindicador', slot: 'primary', class: 'Fuzil de Assalto', type: 'hitscan',
    dmg: 30, rpm: 640, auto: true, mag: 32, mags: 7, reload: 2.2, spread: 1.6, aimSpread: 0.5, recoil: 0.9,
    pen: 1, range: 160, level: 1, cost: 0, color: '#3a3f47', accent: '#ffb000',
    desc: 'Confiável, versátil e barato. O melhor amigo de todo Caído.',
  },
  sg12: {
    id: 'sg12', name: 'SG-12 Rompe-Muralha', slot: 'primary', class: 'Escopeta', type: 'pellet',
    dmg: 16, pellets: 9, rpm: 80, auto: false, mag: 8, mags: 5, reload: 2.8, spread: 6.5, aimSpread: 4.5, recoil: 3.2,
    pen: 1, range: 45, level: 2, cost: 600, color: '#4a3a2c', accent: '#ff6a00',
    desc: 'Transforma qualquer enxame em confete. Péssima a longa distância.',
  },
  smg9: {
    id: 'smg9', name: 'SMG-9 Vespa', slot: 'primary', class: 'Submetralhadora', type: 'hitscan',
    dmg: 20, rpm: 920, auto: true, mag: 45, mags: 6, reload: 1.9, spread: 2.6, aimSpread: 1.2, recoil: 0.6,
    pen: 1, range: 90, level: 4, cost: 900, mobility: 1.08, color: '#2f3d3a', accent: '#00ffa2',
    desc: 'Leve e furiosa. Você corre mais rápido segurando ela.',
  },
  dmr4: {
    id: 'dmr4', name: 'DMR-4 Sentença', slot: 'primary', class: 'Rifle de Precisão', type: 'hitscan',
    dmg: 110, rpm: 210, auto: false, mag: 12, mags: 6, reload: 2.6, spread: 0.9, aimSpread: 0.05, recoil: 2.4,
    pen: 2, range: 300, level: 6, cost: 1300, zoom: 2.4, color: '#2e3440', accent: '#5ac8ff',
    desc: 'Um tiro, um veredito. Atravessa blindagem leve.',
  },
  pl2: {
    id: 'pl2', name: 'PL-2 Fornalha', slot: 'primary', class: 'Fuzil de Plasma', type: 'projectile', energy: true,
    dmg: 55, rpm: 400, auto: true, heatPerShot: 7, cooldownRate: 32, projSpeed: 110, splash: 1.4, spread: 1.2, aimSpread: 0.5, recoil: 0.8,
    pen: 2, range: 200, level: 9, cost: 2000, color: '#2a2440', accent: '#c06bff',
    desc: 'Munição infinita, mas superaquece. Disparos de plasma com pequena explosão.',
  },
  arc3: {
    id: 'arc3', name: 'ARC-3 Tempestade', slot: 'primary', class: 'Lança-Raios', type: 'arc', energy: true,
    dmg: 85, rpm: 75, auto: true, heatPerShot: 18, cooldownRate: 30, chains: 3, spread: 0, aimSpread: 0, recoil: 1.6,
    pen: 3, range: 38, level: 14, cost: 3200, color: '#1f2b3d', accent: '#7ff3ff',
    desc: 'Descargas elétricas que saltam entre até 3 inimigos. Não precisa de mira perfeita.',
  },
  lb1: {
    id: 'lb1', name: 'LB-1 Ceifador', slot: 'primary', class: 'Fuzil Laser', type: 'beam', energy: true,
    dmg: 260, rpm: 0, auto: true, heatPerSec: 34, cooldownRate: 28, spread: 0, aimSpread: 0, recoil: 0,
    pen: 2, range: 120, level: 18, cost: 4200, color: '#402828', accent: '#ff3b5c',
    desc: 'Feixe contínuo que derrete o que tocar (dano por segundo). Cuidado com o calor.',
  },

  // ------------------ SECUNDÁRIAS ------------------
  p19: {
    id: 'p19', name: 'P-19 Guardiã', slot: 'secondary', class: 'Pistola', type: 'hitscan',
    dmg: 40, rpm: 420, auto: false, mag: 15, mags: 5, reload: 1.4, spread: 1.4, aimSpread: 0.6, recoil: 1.0,
    pen: 1, range: 100, level: 1, cost: 0, color: '#33363d', accent: '#ffb000',
    desc: 'Pistola padrão. Recarrega rápido.',
  },
  r6: {
    id: 'r6', name: 'R-6 Magnum', slot: 'secondary', class: 'Revólver', type: 'hitscan',
    dmg: 140, rpm: 140, auto: false, mag: 6, mags: 6, reload: 2.4, spread: 1.0, aimSpread: 0.25, recoil: 4.0,
    pen: 2, range: 140, level: 5, cost: 800, color: '#3d2f2a', accent: '#d4af37',
    desc: 'Seis motivos para o inimigo ficar longe.',
  },
  mp5: {
    id: 'mp5', name: 'MP-5 Fúria', slot: 'secondary', class: 'Pistola Automática', type: 'hitscan',
    dmg: 22, rpm: 1000, auto: true, mag: 28, mags: 5, reload: 1.6, spread: 3.2, aimSpread: 1.8, recoil: 0.7,
    pen: 1, range: 70, level: 8, cost: 1100, color: '#2b2f36', accent: '#ff3b3b',
    desc: 'Um borrifo de chumbo para emergências.',
  },

  // ------------------ SUPORTE ------------------
  mg43: {
    id: 'mg43', name: 'MG-43 Martelo', slot: 'support', class: 'Metralhadora Pesada', type: 'hitscan',
    dmg: 48, rpm: 720, auto: true, mag: 120, mags: 3, reload: 4.2, spread: 2.4, aimSpread: 1.0, recoil: 1.2,
    pen: 2, range: 180, mobility: 0.85, color: '#2d3329', accent: '#ffb000',
    desc: 'Cento e vinte argumentos por cinto. Atravessa blindagem média.',
  },
  rl8: {
    id: 'rl8', name: 'RL-8 Catapulta', slot: 'support', class: 'Lança-Foguetes', type: 'projectile',
    dmg: 650, rpm: 60, auto: false, mag: 1, mags: 7, reload: 2.6, projSpeed: 75, splash: 4.5, explosive: true,
    spread: 0.4, aimSpread: 0.1, recoil: 5, pen: 4, range: 300, mobility: 0.9, color: '#39402f', accent: '#ff6a00',
    desc: 'Resposta universal para qualquer coisa blindada.',
  },
  rg1: {
    id: 'rg1', name: 'RG-1 Lança de Íons', slot: 'support', class: 'Canhão Eletromagnético', type: 'rail',
    dmg: 700, rpm: 50, auto: false, mag: 1, mags: 20, reload: 1.6, charge: 0.75, spread: 0, aimSpread: 0, recoil: 6,
    pen: 5, range: 400, mobility: 0.9, pierce: true, color: '#26303d', accent: '#5ac8ff',
    desc: 'Carregue e dispare um projétil que atravessa tudo em linha reta.',
  },
  fl3: {
    id: 'fl3', name: 'FL-3 Inferno', slot: 'support', class: 'Lança-Chamas', type: 'flame',
    dmg: 340, rpm: 0, auto: true, fuel: 100, mags: 3, fuelPerSec: 12, reload: 3.0, spread: 0, aimSpread: 0, recoil: 0,
    pen: 3, range: 17, mobility: 0.92, color: '#402a20', accent: '#ff4a00',
    desc: 'Cone de fogo que incendeia enxames inteiros (dano por segundo). Não aponte para os amigos.',
  },
  gl6: {
    id: 'gl6', name: 'GL-6 Trovão', slot: 'support', class: 'Lança-Granadas', type: 'projectile',
    dmg: 280, rpm: 110, auto: false, mag: 8, mags: 3, reload: 3.4, projSpeed: 48, gravity: 18, splash: 5.0, explosive: true,
    spread: 0.6, aimSpread: 0.3, recoil: 2.5, pen: 3, range: 150, mobility: 0.92, color: '#2f3829', accent: '#ffd000',
    desc: 'Arremessa granadas em arco. Ideal para destruir ninhos e fábricas.',
  },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'Granada de Fragmentação', dmg: 420, radius: 6.5, fuse: 2.4, count: 4, level: 1, cost: 0, color: '#3d4a2a',
    desc: 'Clássica. Explode após 2,4 segundos.' },
  incendiary: { id: 'incendiary', name: 'Granada Incendiária', dmg: 180, radius: 5, fuse: 2.0, count: 4, level: 6, cost: 900, fire: true, color: '#7a2a10',
    desc: 'Deixa uma poça de fogo por alguns segundos.' },
  impact: { id: 'impact', name: 'Granada de Impacto', dmg: 380, radius: 5.5, fuse: 0, count: 4, level: 11, cost: 1500, impact: true, color: '#2a3d6a',
    desc: 'Explode ao tocar qualquer superfície.' },
};

export const WEAPON_LIST = Object.keys(WEAPONS);
export const WEAPON_INDEX = Object.fromEntries(WEAPON_LIST.map((k, i) => [k, i]));
export const PRIMARIES = WEAPON_LIST.filter((k) => WEAPONS[k].slot === 'primary');
export const SECONDARIES = WEAPON_LIST.filter((k) => WEAPONS[k].slot === 'secondary');
export const SUPPORTS = WEAPON_LIST.filter((k) => WEAPONS[k].slot === 'support');
