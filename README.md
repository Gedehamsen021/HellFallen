# HELLFALLEN

**Shooter cooperativo low poly com guerra galáctica, feito em Three.js.**

Você é um *Caído*, soldado de elite da Legião HellFallen, lançado em cápsulas do Bastião orbital para reconquistar planetas dominados por três facções inimigas. Jogue sozinho ou em esquadrões de até 4 jogadores, cumpra objetivos, chame ataques orbitais, sobreviva às ondas e extraia antes que seja tarde.

## Como rodar

Requer [Node.js](https://nodejs.org) 18 ou superior.

```bash
npm install
```

```bash
npm start
```

Abra **http://localhost:8080** no navegador (Chrome, Edge ou Firefox, com WebGL).

### Multiplayer

O servidor Node hospeda a guerra galáctica compartilhada e as missões em grupo:

- **Na mesma rede (LAN):** todos acessam `http://IP-DO-COMPUTADOR:8080`.
- **Pela internet:** hospede o servidor em qualquer serviço Node (Render, Railway, Fly.io, VPS…). A porta vem da variável `PORT`.
- Na aba **ESQUADRÃO**, crie um esquadrão (código de 4 letras), convide amigos, ou use a entrada rápida em esquadrões públicos. O líder escolhe planeta, missão e dificuldade. Dá para entrar com a missão já em andamento.

Sem servidor (ou se a conexão cair), o jogo funciona em **modo solo**, com a guerra galáctica salva localmente no navegador.

## Controles

| Tecla | Ação |
|---|---|
| WASD | mover |
| Shift | correr |
| Espaço | pular |
| Mouse | olhar · botão esquerdo atira · botão direito mira |
| R | recarregar |
| 1 / 2 / 3 · roda do mouse | primária / secundária / arma de suporte |
| G | granada |
| F | estimulante (cura) |
| E | interagir / pegar item |
| Z X C V (ou 4-7) | arremessar sinalizador de chamado orbital |
| M ou Tab | mapa completo |
| B ou botão do meio | marcar posição para o esquadrão |
| Enter | chat do esquadrão (online) |
| Esc | menu / pausa (no solo) |

## O que tem no jogo

### Guerra galáctica
- Mapa galáctico 3D com 19 planetas em 4 setores, rotas de suprimento e territórios.
- Libertação por planeta: cada missão vencida avança a frente, e o inimigo recupera terreno com o tempo.
- **Invasões**: as facções atacam planetas da Legião com um cronômetro; defenda ou perca o planeta.
- **Ordens Supremas** globais com recompensa em créditos.
- No servidor, a guerra é compartilhada por todos os jogadores e salva em `server/data/galaxy.json`.

### Planetas e biomas
Sete biomas com terreno procedural de 1,2 km × 1,2 km, céu, astros, nuvens, clima e horário (amanhecer, dia, crepúsculo, noite):

- Deserto Âmbar
- Tundra Glacial (com aurora)
- Selva Tóxica (pântano ácido)
- Mundo Vulcânico (rios de lava)
- Planícies Cristalinas
- Arquipélago
- Lua Estéril

Cada mapa tem marcos gigantes (arcos de rocha, ossadas colossais, naves caídas, ruínas, torres, monólitos).

### Facções inimigas
| Facção | Tropas | Estrutura | Chefe |
|---|---|---|---|
| **Enxame Vorr** (colmeia cristalina) | Rastejantes, Cuspidores, Guerreiros, Colossos | Ninhos | Matriarca da Colmeia |
| **Concílio de Ferro** (máquinas) | Drones, Soldados, Devastadores, Andarilhos Blindados | Fábricas | Titã do Concílio |
| **Os Ecos** (entidades do vazio) | Espectros que teleportam, Arautos, Guardiões | Obeliscos | Leviatã do Vazio |

Os inimigos têm blindagem, pontos fracos, ataques corpo a corpo, à distância e em investida. Alguns pedem reforços, abrindo brechas, desembarques e fendas.

### Missões
- **Purgar Território:** destruir 3 estruturas principais.
- **Transmissão de Dados:** ativar o terminal e defender a zona.
- **Ignição do Farol:** ativar 3 consoles e defender o lançamento do míssil.
- **Caçada:** eliminar um chefe.
- **Defender o Gerador:** sobreviver às ondas mantendo o gerador de pé.

Toda missão tem postos avançados opcionais, amostras para coletar, depósitos de equipamento, reforços limitados, limite de tempo do suporte orbital e extração com nave. São 10 níveis de dificuldade.

### Arsenal
- **7 primárias:** fuzil, escopeta, submetralhadora, rifle de precisão, plasma, lança-raios em cadeia, laser contínuo.
- **3 secundárias** e **3 granadas**.
- **5 armas de suporte**, entregues por cápsula: metralhadora pesada, lança-foguetes, canhão eletromagnético perfurante, lança-chamas, lança-granadas.
- **16 chamados orbitais:** ataque de precisão, barragem, laser orbital, bombas de fragmentação, napalm, Ogiva Solar, torres sentinela e de foguetes, escudo, campo minado, suprimentos e entregas de armas.
- Fogo amigo existe!

### Progressão
- 50 níveis com patentes, créditos e amostras.
- **14 perks** (até 3 equipados).
- **Equipamento estilo loot** em 5 slots (Capacete, Manoplas, Peitoral, Grevas, Insígnia):
  - raridades Comum → Exótico;
  - atributos Vigor, Agilidade, Blindagem, Foco e Destreza;
  - perks de equipamento e **exóticos com efeitos únicos** (só um por vez);
  - cada peça muda o visual do soldado.
- Cores de armadura e visor personalizáveis.
- **Pesquisa do Bastião:** melhorias permanentes pagas com amostras.
- Caixas de suprimentos, desmonte de itens e relatório pós-missão com loot.

## Estrutura do código

```
server/index.js          servidor HTTP + WebSocket (esquadrões, missões, guerra galáctica)
shared/                  código usado pelo servidor e pelo navegador
  world.js               gerador de mundo determinístico (terreno, POIs, vegetação, colisão)
  galaxy.js              regras da guerra galáctica
  sim/MissionSim.js      simulação autoritativa da missão (IA, objetivos, chamados, extração)
  data/                  planetas, biomas, facções, inimigos, armas, chamados, perks, equipamento
client/
  index.html, css/       interface
  js/Game.js             controlador principal
  js/galaxy/             mapa galáctico 3D
  js/game/               missão: terreno, céu, vegetação, efeitos, inimigos, jogador, entidades
  js/game/models/        todos os modelos low poly, construídos por código (sem arquivos externos)
  js/ui/                 hub, HUD, relatório
  js/core/               perfil, rede, áudio procedural, entrada
```

A mesma `MissionSim` roda no servidor (multiplayer) ou no navegador (solo). Os mapas são gerados a partir de uma semente compartilhada, então só o estado da partida trafega pela rede. Todos os modelos 3D e sons são procedurais, sem nenhum asset externo.
