// Perks do soldado — até 3 equipados (o 3º slot libera no nível 15)
// mod: modificadores somados aos do equipamento

export const PERKS = {
  adrenaline: { id: 'adrenaline', name: 'Adrenalina', icon: '♥', level: 1, desc: 'Cada abate restaura 6 de vida.', mod: { killHeal: 6 } },
  quickhands: { id: 'quickhands', name: 'Mãos Ligeiras', icon: '↻', level: 1, desc: 'Recarga 25% mais rápida.', mod: { reload: 0.25 } },
  ammo: { id: 'ammo', name: 'Munição Extra', icon: '▤', level: 2, desc: '+2 carregadores em todas as armas.', mod: { mags: 2 } },
  lungs: { id: 'lungs', name: 'Pulmões de Aço', icon: '≋', level: 3, desc: '+60% de estamina e regeneração mais rápida.', mod: { stamina: 0.6 } },
  grenadier: { id: 'grenadier', name: 'Granadeiro', icon: '●', level: 4, desc: '+2 granadas e raio de explosão 15% maior.', mod: { grenades: 2, nadeRadius: 0.15 } },
  reactive: { id: 'reactive', name: 'Blindagem Reativa', icon: '⬢', level: 5, desc: '-40% de dano de explosões (inclusive as suas).', mod: { blastResist: 0.4 } },
  logistics: { id: 'logistics', name: 'Logística Avançada', icon: '⌛', level: 6, desc: 'Recarga de chamados orbitais 15% menor.', mod: { cooldown: 0.15 } },
  eagleeye: { id: 'eagleeye', name: 'Olho de Águia', icon: '◉', level: 8, desc: '+30% de dano em pontos fracos.', mod: { weakDmg: 0.3 } },
  coldblood: { id: 'coldblood', name: 'Sangue Frio', icon: '❄', level: 9, desc: '-40% de dispersão e recuo ao mirar.', mod: { aimSteady: 0.4 } },
  medic: { id: 'medic', name: 'Kit Médico', icon: '✚', level: 10, desc: '+2 estimulantes, que curam 25% a mais.', mod: { stims: 2, stimPower: 0.25 } },
  sprinter: { id: 'sprinter', name: 'Corredor', icon: '»', level: 11, desc: '+12% de velocidade ao correr.', mod: { sprint: 0.12 } },
  laststand: { id: 'laststand', name: 'Último Suspiro', icon: '✝', level: 13, desc: 'Uma vez por vida, sobrevive a um golpe fatal com 1 de vida.', mod: { lastStand: 1 } },
  giantslayer: { id: 'giantslayer', name: 'Caçador de Colossos', icon: '⚔', level: 16, desc: '+30% de dano contra inimigos pesados e estruturas.', mod: { heavyDmg: 0.3 } },
  pyro: { id: 'pyro', name: 'Piromaníaco', icon: '✹', level: 19, desc: '+25% de dano explosivo e de fogo.', mod: { explosive: 0.25 } },
};

export const PERK_LIST = Object.keys(PERKS);
export function perkSlots(level) { return level >= 15 ? 3 : 2; }
