// Mapa galáctico inicial
// pos: coordenadas na vista da galáxia. links: rotas de suprimento.

export const SECTORS = {
  aurea: { name: 'Setor Áurea', color: '#3fb6ff' },
  vortice: { name: 'Setor Vórtice', color: '#ff8a2a' },
  forja: { name: 'Setor Forja', color: '#ff3b3b' },
  penumbra: { name: 'Setor Penumbra', color: '#b06bff' },
};

export const PLANETS = [
  // ---- Território da Legião ----
  { id: 'aurora', name: 'Aurora Prime', biome: 'crystal', sector: 'aurea', pos: [0, 0, 0], owner: 'legion', size: 1.5, rings: true, capital: true,
    desc: 'Capital da Legião. Torres de cristal e o maior estaleiro orbital da galáxia.' },
  { id: 'helion', name: 'Hélion', biome: 'ocean', sector: 'aurea', pos: [20, 2, 9], owner: 'legion', size: 1.1,
    desc: 'Mundo-oceano que abastece metade da frota com deutério.' },
  { id: 'vesta', name: 'Vesta Minor', biome: 'tundra', sector: 'aurea', pos: [-17, -2, 13], owner: 'legion', size: 1.0,
    desc: 'Colônia de mineração congelada. As auroras são visíveis do espaço.' },
  { id: 'caldus', name: 'Caldus', biome: 'desert', sector: 'aurea', pos: [4, 1, -21], owner: 'legion', size: 1.2,
    desc: 'Deserto vermelho onde os Caídos fazem seu treinamento básico.' },

  // ---- Setor Vórtice (Enxame Vorr) ----
  { id: 'kharon', name: 'Kharon', biome: 'desert', sector: 'vortice', pos: [40, 3, 13], owner: 'vorr', lib: 35, size: 1.0,
    desc: 'Cânions infestados. Os ninhos cristalinos já cobrem o hemisfério sul.' },
  { id: 'tessar', name: 'Tessar', biome: 'jungle', sector: 'vortice', pos: [52, 0, -14], owner: 'vorr', lib: 10, size: 1.2,
    desc: 'Selva fervilhante. O Enxame transformou os pântanos em berçários.' },
  { id: 'myrr', name: 'Myrr', biome: 'jungle', sector: 'vortice', pos: [62, -2, 30], owner: 'vorr', lib: 0, size: 0.9,
    desc: 'Esporos tóxicos e cogumelos do tamanho de prédios.' },
  { id: 'oskar', name: 'Oskar-9', biome: 'volcanic', sector: 'vortice', pos: [72, 4, 2], owner: 'vorr', lib: 0, size: 1.0,
    desc: 'O calor das forjas vulcânicas alimenta os casulos do Enxame.' },
  { id: 'vorrhal', name: 'Vorrhal', biome: 'volcanic', sector: 'vortice', pos: [92, 2, 18], owner: 'vorr', lib: 0, size: 1.6, rings: true, homeworld: true,
    desc: 'Mundo-colmeia. Dizem que o planeta inteiro pulsa como um coração.' },

  // ---- Setor Forja (Concílio de Ferro) ----
  { id: 'grisel', name: 'Grisel', biome: 'moon', sector: 'forja', pos: [-28, 1, -30], owner: 'ferro', lib: 20, size: 0.8,
    desc: 'Lua mineradora tomada pelas máquinas. Fábricas trabalham dia e noite.' },
  { id: 'ankh', name: 'Ankh Reach', biome: 'desert', sector: 'forja', pos: [-48, -3, -12], owner: 'ferro', lib: 5, size: 1.1,
    desc: 'Antiga refinaria da Legião, agora uma fortaleza do Concílio.' },
  { id: 'ferrum', name: 'Portão Ferrum', biome: 'volcanic', sector: 'forja', pos: [-56, 2, -44], owner: 'ferro', lib: 0, size: 1.2,
    desc: 'Fundições orbitais despejam aço derretido sobre a superfície.' },
  { id: 'nadir', name: 'Nadir', biome: 'tundra', sector: 'forja', pos: [-34, 0, -62], owner: 'ferro', lib: 0, size: 0.9,
    desc: 'Estações de comunicação do Concílio escondidas no gelo eterno.' },
  { id: 'forja', name: 'Forja Mãe', biome: 'moon', sector: 'forja', pos: [-78, 3, -66], owner: 'ferro', lib: 0, size: 1.5, rings: true, homeworld: true,
    desc: 'Onde o Concílio nasceu. Uma lua inteira convertida em linha de montagem.' },

  // ---- Setor Penumbra (Os Ecos) ----
  { id: 'lumen', name: 'Lúmen', biome: 'crystal', sector: 'penumbra', pos: [-12, 2, 42], owner: 'ecos', lib: 25, size: 1.0,
    desc: 'Os cristais de Lúmen cantam quando uma fenda se abre.' },
  { id: 'eidolon', name: 'Eidolon', biome: 'moon', sector: 'penumbra', pos: [14, -2, 54], owner: 'ecos', lib: 0, size: 0.8,
    desc: 'Uma lua silenciosa onde as sombras se movem sozinhas.' },
  { id: 'sylph', name: 'Sylph', biome: 'ocean', sector: 'penumbra', pos: [-32, 3, 64], owner: 'ecos', lib: 0, size: 1.1,
    desc: 'Arquipélago engolido por névoa violeta.' },
  { id: 'nihil', name: 'Nihil', biome: 'crystal', sector: 'penumbra', pos: [-4, 1, 80], owner: 'ecos', lib: 0, size: 1.0,
    desc: 'Monólitos do vazio flutuam sobre planícies de vidro.' },
  { id: 'umbra', name: 'Umbra Sacra', biome: 'tundra', sector: 'penumbra', pos: [-22, -1, 100], owner: 'ecos', lib: 0, size: 1.5, rings: true, homeworld: true,
    desc: 'O coração dos Ecos. Nenhuma sonda voltou de lá.' },
];

export const LINKS = [
  ['aurora', 'helion'], ['aurora', 'vesta'], ['aurora', 'caldus'],
  ['helion', 'kharon'], ['caldus', 'tessar'], ['helion', 'tessar'],
  ['kharon', 'myrr'], ['kharon', 'tessar'], ['tessar', 'oskar'], ['myrr', 'oskar'],
  ['oskar', 'vorrhal'], ['myrr', 'vorrhal'],
  ['caldus', 'grisel'], ['vesta', 'ankh'], ['grisel', 'ankh'], ['grisel', 'ferrum'],
  ['ankh', 'ferrum'], ['ferrum', 'nadir'], ['nadir', 'forja'], ['ferrum', 'forja'],
  ['vesta', 'lumen'], ['helion', 'eidolon'], ['lumen', 'eidolon'], ['lumen', 'sylph'],
  ['eidolon', 'nihil'], ['sylph', 'nihil'], ['nihil', 'umbra'], ['sylph', 'umbra'],
];

export const PLANET_MAP = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

export function neighbors(id) {
  const out = [];
  for (const [a, b] of LINKS) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}
