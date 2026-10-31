// Facções da guerra galáctica
export const FACTIONS = {
  legion: {
    id: 'legion',
    name: 'Legião HellFallen',
    short: 'Legião',
    the: 'a Legião', of: 'da Legião',
    color: '#3fb6ff',
    desc: 'Os Caídos. Soldados de elite lançados do Bastião orbital direto para o inferno.',
  },
  vorr: {
    id: 'vorr',
    name: 'Enxame Vorr',
    short: 'Vorr',
    the: 'o Enxame Vorr', of: 'do Enxame Vorr',
    color: '#ff8a2a',
    blood: '#ffb347',
    desc: 'Uma colmeia cristalina que devora planetas inteiros. Ataca em ondas, nunca recua.',
    breach: 'A terra se abre — o Enxame está emergindo!',
  },
  ferro: {
    id: 'ferro',
    name: 'Concílio de Ferro',
    short: 'Ferro',
    the: 'o Concílio de Ferro', of: 'do Concílio de Ferro',
    color: '#ff3b3b',
    blood: '#ffd27a',
    desc: 'Máquinas de guerra autônomas que esqueceram seus criadores. Precisas, frias e blindadas.',
    breach: 'Naves de desembarque do Concílio se aproximando!',
  },
  ecos: {
    id: 'ecos',
    name: 'Os Ecos',
    short: 'Ecos',
    the: 'os Ecos', of: 'dos Ecos',
    color: '#b06bff',
    blood: '#7ff3ff',
    desc: 'Entidades do vazio que atravessam a realidade por fendas. Ninguém sabe o que querem.',
    breach: 'Uma fenda do vazio está se abrindo!',
  },
};

export const ENEMY_FACTIONS = ['vorr', 'ferro', 'ecos'];
