// Interface (DOM): título, hub (guerra, arsenal, equipamento, perks, pesquisa, esquadrão), carregamento, relatório, pausa
import * as THREE from 'three';
import { PLANETS, PLANET_MAP, SECTORS, neighbors } from '../../../shared/data/planets.js';
import { FACTIONS } from '../../../shared/data/factions.js';
import { BIOMES } from '../../../shared/data/biomes.js';
import { WEAPONS, GRENADES, PRIMARIES, SECONDARIES, SUPPORTS } from '../../../shared/data/weapons.js';
import { CALLINS, CALLIN_CATS, CALLIN_LIST } from '../../../shared/data/callins.js';
import { PERKS, PERK_LIST, perkSlots } from '../../../shared/data/perks.js';
import { GEAR_SLOTS, STATS, RARITIES, GEAR_PERKS, EXOTIC_MAP } from '../../../shared/data/gear.js';
import { DIFFICULTIES, MISSION_TYPES, RESEARCH, rankFor, xpForLevel } from '../../../shared/data/progression.js';
import { planetStatus, missionTypesFor, missionFaction } from '../../../shared/galaxy.js';
import { ARMOR_COLORS, VISOR_COLORS } from '../core/Profile.js';
import { buildTrooper, buildWeapon, gripPose, applyPose } from '../game/models/units.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TIPS = [
  'Granadas e chamados orbitais são a melhor forma de destruir ninhos, fábricas e obeliscos.',
  'Atire nos pontos fracos (cabeças, sacos brilhantes, núcleos) para causar dano extra.',
  'Inimigos pesados têm blindagem: use armas com penetração alta como o RL-8 ou o RG-1.',
  'Fogo amigo existe. Cuidado onde você joga o sinalizador do ataque orbital!',
  'Amostras só contam se você extrair com elas. Se cair, elas ficam no chão.',
  'Os Cuspidores, Soldados de Ferro e Arautos pedem reforços. Mate-os primeiro!',
  'Depósitos de equipamento garantem loot extra — mas só se você extrair.',
  'Apenas um item exótico pode ser equipado por vez. Escolha com sabedoria.',
  'Cápsulas de queda causam dano ao pousar. Use isso a seu favor (ou não fique embaixo).',
  'Pressione M para abrir o mapa completo e B (ou botão do meio) para marcar posições.',
];

export class UI {
  constructor(game) {
    this.game = game;
    this.root = game.uiRoot;
    this.screen = null;
    this.tab = 'war';
    this.selPlanet = null;
    this.selMission = null;
    this.selDiff = 1;
    this.selSlot = 'helmet';
    this.pauseOpen = false;
    this.labelEls = new Map();
    this.chatLog = [];
    this.publicSquads = [];
    this.preview = null;
  }

  clear() {
    if (this.screen) this.screen.remove();
    this.screen = null;
    this.labelEls.clear();
    this.destroyPreview();
  }

  make(cls, html) {
    this.clear();
    const el = document.createElement('div');
    el.className = 'screen ' + cls;
    el.innerHTML = html;
    this.root.appendChild(el);
    this.screen = el;
    return el;
  }

  toast(text, ms = 2600) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  flashScreen() {
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:60;pointer-events:none;transition:opacity 1.6s';
    document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.opacity = '0'; }));
    setTimeout(() => f.remove(), 1800);
  }

  click() { this.game.audio.play('ui', null, { vol: 0.6 }); }

  // =========================================================== TÍTULO
  showTitle() {
    const g = this.game;
    const p = g.profile;
    const el = this.make('title-screen', `
      <div class="logo">HELL<span>FALLEN</span></div>
      <div class="subtitle">Guerra Galáctica · Cooperativo até 4 jogadores</div>
      <div class="panel title-box">
        <label>Nome de guerra</label>
        <input id="t-name" maxlength="20" value="${esc(p ? p.data.name : '')}" placeholder="Seu nome de Caído" />
        <button class="btn primary big" id="t-play">${p ? 'CONTINUAR' : 'ALISTAR-SE'}</button>
        <div class="net-status" id="t-net"></div>
        <div class="controls-hint">
          <b>WASD</b><span>mover · <b>Shift</b> correr · <b>Espaço</b> pular</span>
          <b>Mouse</b><span>mirar (botão direito) e atirar</span>
          <b>R / 1 2 3</b><span>recarregar / trocar de arma</span>
          <b>G</b><span>granada · <b>F</b> estimulante · <b>E</b> interagir</span>
          <b>Z X C V</b><span>chamados orbitais (sinalizador)</span>
          <b>M</b><span>mapa · <b>B</b> marcar · <b>Enter</b> chat</span>
        </div>
      </div>
      <div class="title-footer">HELLFALLEN · feito com Three.js · um jogo original</div>
    `);
    const inp = el.querySelector('#t-name');
    const go = () => {
      const name = inp.value.trim().slice(0, 20) || 'Caído';
      this.game.audio.unlock();
      this.click();
      this.game.startHub(name);
    };
    el.querySelector('#t-play').onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    this.updateNetStatus();
    setTimeout(() => inp.focus(), 100);
  }

  updateNetStatus() {
    const el = this.screen && this.screen.querySelector('#t-net');
    if (el) {
      el.innerHTML = this.game.net.online
        ? `Servidor: <b class="on">ONLINE</b> · ${this.game.online || 1} Caído(s) conectado(s)`
        : `Servidor: <b class="off">OFFLINE</b> · modo solo (multiplayer requer <code>npm start</code>)`;
    }
    const pill = this.screen && this.screen.querySelector('.net-pill');
    if (pill) {
      pill.className = 'net-pill ' + (this.game.net.online ? 'on' : 'off');
      pill.textContent = this.game.net.online ? `ONLINE · ${this.game.online || 1}` : 'SOLO';
    }
  }

  // =========================================================== HUB
  showHub(tab = this.tab) {
    this.tab = tab;
    const el = this.make('hub', `
      <div class="hub-top">
        <div class="logo">HELL<span>FALLEN</span></div>
        <div class="tabs">
          <div class="tab" data-tab="war">GUERRA</div>
          <div class="tab" data-tab="arsenal">ARSENAL</div>
          <div class="tab" data-tab="gear">EQUIPAMENTO</div>
          <div class="tab" data-tab="perks">PERKS</div>
          <div class="tab" data-tab="research">PESQUISA</div>
          <div class="tab" data-tab="squad">ESQUADRÃO<span class="badge hidden" id="sq-badge"></span></div>
        </div>
        <div class="profile-chip" id="chip"></div>
      </div>
      <div class="hub-body" id="hub-body"></div>
    `);
    el.querySelectorAll('.tab').forEach((t) => {
      t.onclick = () => { this.click(); this.setTab(t.dataset.tab); };
    });
    this.renderChip();
    this.setTab(tab);
  }

  renderChip() {
    const chip = this.screen?.querySelector('#chip');
    if (!chip) return;
    const p = this.game.profile;
    const d = p.data;
    const need = xpForLevel(d.level);
    chip.innerHTML = `
      <div class="currency">
        <span class="pw" title="Poder do equipamento">⚡ ${p.power()}</span>
        <span class="cr" title="Créditos de guerra">¢ ${d.credits}</span>
        <span class="sm" title="Amostras">◈ ${d.samples}</span>
      </div>
      <div class="net-pill"></div>
      <div class="lvl">${d.level}</div>
      <div><div class="name">${esc(d.name)}</div><div class="rank">${p.rank}</div><div class="bar xpbar"><div style="width:${Math.min(100, (d.xp / need) * 100)}%"></div></div></div>
    `;
    this.updateNetStatus();
    const badge = this.screen?.querySelector('#sq-badge');
    if (badge) {
      const sq = this.game.squad;
      badge.classList.toggle('hidden', !sq);
      if (sq) badge.textContent = sq.members.length;
    }
  }

  setTab(tab) {
    this.tab = tab;
    this.destroyPreview();
    this.screen.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    const body = this.screen.querySelector('#hub-body');
    body.innerHTML = '';
    this.labelEls.clear();
    this.game.galaxyView.enabled = tab === 'war';
    if (tab === 'war') this.renderWar(body);
    else if (tab === 'arsenal') this.renderArsenal(body);
    else if (tab === 'gear') this.renderGear(body);
    else if (tab === 'perks') this.renderPerks(body);
    else if (tab === 'research') this.renderResearch(body);
    else if (tab === 'squad') this.renderSquad(body);
  }

  refresh() {
    if (this.screen && this.screen.classList.contains('hub')) {
      this.renderChip();
      if (this.tab === 'war') { this.renderWarLeft(); this.renderPlanetPanel(); this.renderSquadStrip(); }
      else if (this.tab === 'squad') this.setTab('squad');
    }
  }

  // ----------------------------------------------------------- GUERRA
  renderWar(body) {
    body.innerHTML = `
      <div class="planet-labels" id="labels"></div>
      <div class="war-left" id="war-left"></div>
      <div class="war-right"><div class="panel planet-panel" id="planet-panel"></div></div>
      <div class="panel squad-strip hidden" id="squad-strip"></div>
    `;
    const labels = body.querySelector('#labels');
    for (const p of PLANETS) {
      const d = document.createElement('div');
      d.className = 'plabel';
      labels.appendChild(d);
      this.labelEls.set(p.id, d);
    }
    if (!this.selPlanet) {
      const g = this.game.galaxy;
      const order = g?.order;
      const cand = order?.kind === 'liberate' ? order.planet : PLANETS.find((p) => g && planetStatus(g, p.id).kind === 'contested')?.id;
      this.selPlanet = cand || 'kharon';
    }
    this.game.galaxyView.select(this.selPlanet);
    this.renderWarLeft();
    this.renderPlanetPanel();
    this.renderSquadStrip();
  }

  renderWarLeft() {
    const el = this.screen?.querySelector('#war-left');
    if (!el) return;
    const g = this.game.galaxy;
    if (!g) { el.innerHTML = ''; return; }
    const o = g.order;
    let orderHtml = '<div class="dim">Aguardando o Alto Comando…</div>';
    if (o) {
      let prog = 0, ptxt = '';
      if (o.kind === 'liberate') { prog = g.planets[o.planet]?.lib || 0; ptxt = `${Math.floor(prog)}% libertado`; }
      else { prog = (o.progress / o.target) * 100; ptxt = `${o.progress} / ${o.target}`; }
      const left = Math.max(0, o.expires - Date.now());
      const claimed = this.game.profile.data.claimedOrders.includes(o.id);
      orderHtml = `
        <div class="otext">${esc(o.text)}</div>
        <div class="bar"><div style="width:${Math.min(100, prog)}%"></div></div>
        <div class="row" style="justify-content:space-between;font-size:13px;margin-top:4px"><span>${ptxt}</span><span class="dim">${o.done ? (claimed ? 'Recompensa recebida' : 'CUMPRIDA!') : `${Math.floor(left / 3600000)}h ${Math.floor(left / 60000) % 60}min`}</span></div>
        <div style="font-size:13px;margin-top:4px">Recompensa: <b style="color:var(--accent2)">¢ ${o.reward}</b></div>
        ${o.done && !claimed ? '<button class="btn gold small" id="claim" style="margin-top:8px">RESGATAR RECOMPENSA</button>' : ''}
      `;
    }
    const st = g.stats || {};
    const pd = this.game.profile.data.stats;
    el.innerHTML = `
      <div class="panel order-box"><div class="otitle">⚑ ORDEM SUPREMA</div>${orderHtml}</div>
      <div class="panel war-stats">
        <div><span class="dim">Missões da Legião</span><b>${st.missions || 0}</b></div>
        <div><span class="dim">Taxa de sucesso</span><b>${st.missions ? Math.round((st.success / st.missions) * 100) : 0}%</b></div>
        <div><span class="dim">Inimigos mortos</span><b>${(st.kills || 0).toLocaleString('pt-BR')}</b></div>
        <div><span class="dim">Caídos perdidos</span><b>${(st.deaths || 0).toLocaleString('pt-BR')}</b></div>
        <div><span class="dim">Suas missões</span><b>${pd.missions} (${pd.success} ✓)</b></div>
        <div><span class="dim">Seus abates</span><b>${pd.kills}</b></div>
      </div>
      <div class="panel news"><h3>Transmissões de guerra</h3><div class="items">${(g.history || []).map((h) => `<div class="item ${h.kind}"><time>${new Date(h.t).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</time>${esc(h.text)}</div>`).join('')}</div></div>
    `;
    const claim = el.querySelector('#claim');
    if (claim) claim.onclick = () => {
      const d = this.game.profile.data;
      d.claimedOrders.push(o.id);
      d.credits += o.reward;
      this.game.profile.save();
      this.game.audio.play('levelup');
      this.toast(`Ordem Suprema cumprida! +¢${o.reward}`);
      this.refresh();
    };
  }

  renderPlanetPanel() {
    const el = this.screen?.querySelector('#planet-panel');
    if (!el) return;
    const g = this.game.galaxy;
    const p = PLANET_MAP[this.selPlanet];
    if (!g || !p) { el.innerHTML = '<div class="dim">Carregando dados da galáxia…</div>'; return; }
    const st = g.planets[p.id];
    const status = planetStatus(g, p.id);
    const owner = FACTIONS[st.owner];
    const biome = BIOMES[p.biome];
    const active = this.game.activeCounts?.[p.id] || 0;
    let statusHtml = '';
    if (status.kind === 'safe') statusHtml = `<span class="tag" style="color:${FACTIONS.legion.color}">TERRITÓRIO DA LEGIÃO</span>`;
    else if (status.kind === 'contested') statusHtml = `<span class="tag" style="color:var(--accent2)">LINHA DE FRENTE</span> <span class="tag" style="color:${owner.color}">${owner.name}</span>`;
    else if (status.kind === 'defense') statusHtml = `<span class="tag" style="color:var(--bad)">SOB INVASÃO</span> <span class="tag" style="color:${FACTIONS[status.inv.faction].color}">${FACTIONS[status.inv.faction].name}</span>`;
    else statusHtml = `<span class="tag" style="color:var(--dim)">INACESSÍVEL</span> <span class="tag" style="color:${owner.color}">${owner.name}</span>`;
    let barHtml = '';
    if (status.kind === 'contested') {
      barHtml = `<div class="lib-row"><span>Libertação</span><span>${st.lib.toFixed(1)}%</span></div><div class="bar lib-bar"><div style="width:${st.lib}%;background:${FACTIONS.legion.color}"></div></div>`;
    } else if (status.kind === 'defense') {
      const left = Math.max(0, status.inv.end - Date.now());
      barHtml = `<div class="lib-row"><span>Defesa</span><span>${status.inv.progress.toFixed(1)}% · ${Math.floor(left / 60000)}min restantes</span></div><div class="bar lib-bar"><div style="width:${status.inv.progress}%;background:var(--good)"></div></div>`;
    }
    const types = missionTypesFor(g, p.id);
    const sq = this.game.squad;
    const isLeader = !sq || sq.leader === this.game.net.id;
    if (sq && !isLeader && sq.mission) {
      this.selPlanet = sq.mission.planetId;
    }
    let missionHtml = '';
    if (types.length) {
      if (!this.selMission || !types.includes(this.selMission)) this.selMission = types[0];
      const prof = this.game.profile;
      const maxD = prof.data.maxDifficulty;
      const diff = DIFFICULTIES[this.selDiff - 1];
      const loadout = prof.data.loadout;
      missionHtml = `
        <h3>Missões disponíveis</h3>
        <div class="mission-list">${types.map((t) => {
          const m = MISSION_TYPES[t];
          return `<div class="mission-card ${t === this.selMission ? 'sel' : ''}" data-m="${t}"><div class="mi">${m.icon}</div><div><div class="mt">${m.name}</div><div class="md">${m.desc}</div></div></div>`;
        }).join('')}</div>
        <h3>Dificuldade <span class="diff-name">${diff.name}</span></h3>
        <div class="diff-select">${DIFFICULTIES.map((d) => {
          const locked = d.lvl > maxD || d.level > prof.level;
          return `<div class="${d.lvl === this.selDiff ? 'sel' : ''} ${locked ? 'locked' : ''}" data-d="${d.lvl}" title="${d.name}${locked ? ' (bloqueada)' : ''}">${d.lvl}</div>`;
        }).join('')}</div>
        <div class="dim" style="font-size:12px">Poder recomendado: ⚡ ${diff.lvl * 45} · XP ×${diff.xpMult.toFixed(1)} · Reforços: ${diff.reinf}. Vença para desbloquear a próxima dificuldade.</div>
        <div class="loadout-mini">
          <span>${WEAPONS[loadout.primary].name}</span><span>${WEAPONS[loadout.secondary].name}</span><span>${GRENADES[loadout.grenade].name}</span>
          ${loadout.callins.map((c) => `<span style="color:${CALLIN_CATS[CALLINS[c].cat].color}">${CALLINS[c].icon} ${CALLINS[c].name}</span>`).join('')}
        </div>
        ${sq && !isLeader
          ? `<div class="locked-note">O líder do esquadrão escolhe a missão.<br><button class="btn ${sq.members.find((m) => m.id === this.game.net.id)?.ready ? 'primary' : ''}" id="ready-btn" style="margin-top:8px">${sq.members.find((m) => m.id === this.game.net.id)?.ready ? '✓ PRONTO' : 'MARCAR COMO PRONTO'}</button></div>`
          : `<button class="btn primary big" id="deploy">${sq ? 'LANÇAR ESQUADRÃO' : 'LANÇAR CÁPSULA'}</button>`}
      `;
    } else if (status.kind === 'safe') {
      missionHtml = '<div class="locked-note">Planeta seguro. Nenhuma operação necessária aqui.<br>Escolha um planeta na linha de frente (anel girando) ou sob invasão (anel vermelho).</div>';
    } else {
      missionHtml = '<div class="locked-note">Sem rota de suprimento. Liberte um planeta vizinho primeiro.</div>';
    }
    el.innerHTML = `
      <div class="psub">${SECTORS[p.sector].name} · ${biome.name}</div>
      <div class="pname">${p.name}</div>
      <div class="row" style="flex-wrap:wrap">${statusHtml}${active ? `<span class="tag" style="color:var(--good)">${active} em missão</span>` : ''}</div>
      <div class="pdesc">${p.desc}<br><span class="dim">${biome.desc}</span></div>
      ${barHtml}
      ${missionHtml}
    `;
    el.querySelectorAll('.mission-card').forEach((c) => c.onclick = () => { this.click(); this.selMission = c.dataset.m; this.renderPlanetPanel(); this.pushSquadSelection(); });
    el.querySelectorAll('.diff-select div').forEach((c) => c.onclick = () => { this.click(); this.selDiff = +c.dataset.d; this.renderPlanetPanel(); this.pushSquadSelection(); });
    const dep = el.querySelector('#deploy');
    if (dep) dep.onclick = () => { this.game.audio.play('uiConfirm'); this.game.deploy(p.id, this.selMission, this.selDiff); };
    const rb = el.querySelector('#ready-btn');
    if (rb) rb.onclick = () => {
      const me = sq.members.find((m) => m.id === this.game.net.id);
      this.game.net.send('squad.ready', { ready: !me?.ready });
    };
  }

  pushSquadSelection() {
    const sq = this.game.squad;
    if (sq && sq.leader === this.game.net.id && this.selMission) {
      this.game.net.send('squad.select', { planetId: this.selPlanet, type: this.selMission, difficulty: this.selDiff });
    }
  }

  selectPlanet(id) {
    if (!PLANET_MAP[id]) return;
    const sq = this.game.squad;
    if (sq && sq.leader !== this.game.net.id) { this.toast('Apenas o líder pode escolher o planeta.'); return; }
    this.selPlanet = id;
    this.selMission = null;
    this.game.galaxyView.select(id);
    this.click();
    this.renderPlanetPanel();
    this.pushSquadSelection();
  }

  renderSquadStrip() {
    const el = this.screen?.querySelector('#squad-strip');
    if (!el) return;
    const sq = this.game.squad;
    el.classList.toggle('hidden', !sq);
    if (!sq) return;
    el.innerHTML = `<span class="dim">ESQUADRÃO <b style="color:var(--accent2)">${sq.code}</b></span>${sq.members.map((m) => `<span class="sm">${m.id === sq.leader ? '★ ' : ''}${esc(m.name)} <span class="dim">nv${m.level}</span> ${m.ready ? '✓' : ''}</span>`).join('')}`;
  }

  updateLabels() {
    if (this.tab !== 'war' || !this.labelEls.size) return;
    const g = this.game.galaxy;
    const labels = this.game.galaxyView.labels();
    for (const l of labels) {
      const el = this.labelEls.get(l.id);
      if (!el) continue;
      if (!l.visible || l.dist > 330) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate(-50%, 0) translate(${l.x}px, ${l.y}px)`;
      el.style.left = '0'; el.style.top = '0';
      const p = PLANET_MAP[l.id];
      let s = '', cls = 'plabel';
      if (g) {
        const st = g.planets[l.id];
        const status = planetStatus(g, l.id);
        if (status.kind === 'defense') { s = `<span style="color:var(--bad)">⚠ INVASÃO ${Math.floor(status.inv.progress)}%</span>`; cls += ' inv'; }
        else if (status.kind === 'contested') s = `<span style="color:${FACTIONS[st.owner].color}">${FACTIONS[st.owner].short} · ${Math.floor(st.lib)}%</span>`;
        else if (status.kind === 'safe') s = `<span style="color:${FACTIONS.legion.color}">Legião</span>`;
        else s = `<span style="color:${FACTIONS[st.owner].color};opacity:.6">${FACTIONS[st.owner].short}</span>`;
      }
      if (l.id === this.selPlanet) cls += ' sel';
      const n = this.game.activeCounts?.[l.id];
      const html = `<div class="n">${p.name}</div><div class="s">${s}</div>${n ? `<div class="pl">● ${n} jogando</div>` : ''}`;
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      if (el.className !== cls) el.className = cls;
    }
  }

  // ----------------------------------------------------------- ARSENAL
  weaponStats(W) {
    const dmg = W.type === 'beam' || W.type === 'flame' ? W.dmg / 6 : W.dmg * (W.pellets || 1);
    const rate = W.rpm || 600;
    const rows = [
      ['Dano', Math.min(1, Math.sqrt(dmg / 600)), Math.round(dmg)],
      ['Cadência', Math.min(1, rate / 1000), W.rpm ? W.rpm : 'cont.'],
      ['Carregador', W.energy ? 1 : Math.min(1, (W.mag || W.fuel || 1) / 120), W.energy ? '∞' : W.mag || W.fuel],
      ['Penetração', W.pen / 5, W.pen],
      ['Alcance', Math.min(1, W.range / 300), W.range + 'm'],
    ];
    return rows.map(([n, v, t]) => `<div class="stat-line"><span>${n}</span><div class="bar"><div style="width:${v * 100}%"></div></div><span>${t}</span></div>`).join('');
  }

  renderArsenal(body) {
    const p = this.game.profile;
    const d = p.data;
    const lo = d.loadout;
    const card = (id, def, kind, equipped, extra = '') => {
      const owned = kind === 'weapon' ? d.owned.weapons.includes(id) : kind === 'grenade' ? d.owned.grenades.includes(id) : d.owned.callins.includes(id);
      const locked = def.level > d.level;
      let action = '';
      if (locked) action = `<div class="lockinfo">🔒 Nível ${def.level}</div>`;
      else if (!owned) action = `<button class="btn small gold" data-buy="${kind}:${id}">Comprar ¢${def.cost}</button>`;
      return `<div class="card ${equipped ? 'equipped' : ''} ${locked ? 'locked' : ''}" data-equip="${!locked && owned ? kind + ':' + id : ''}">
        ${equipped ? '<div class="eqmark">EQUIPADO</div>' : ''}
        ${extra}
        <div class="ct">${def.name}</div>
        <div class="cc">${def.class || ''}</div>
        <div class="cd">${def.desc}</div>
        ${kind === 'weapon' ? this.weaponStats(def) : ''}
        ${action}
      </div>`;
    };
    body.innerHTML = `
      <div class="tab-page"><div class="panel scroll" style="flex:1">
        <div class="page-title">ARSENAL</div>
        <div class="section-title">Arma primária</div>
        <div class="cards">${PRIMARIES.map((id) => card(id, WEAPONS[id], 'weapon', lo.primary === id)).join('')}</div>
        <div class="section-title">Arma secundária</div>
        <div class="cards">${SECONDARIES.map((id) => card(id, WEAPONS[id], 'weapon', lo.secondary === id)).join('')}</div>
        <div class="section-title">Granada</div>
        <div class="cards">${Object.keys(GRENADES).map((id) => card(id, GRENADES[id], 'grenade', lo.grenade === id)).join('')}</div>
        <div class="section-title">Chamados orbitais <small>escolha até 4 — clique para adicionar/remover (${lo.callins.length}/4)</small></div>
        <div class="cards">${CALLIN_LIST.map((id) => {
          const c = CALLINS[id];
          const color = CALLIN_CATS[c.cat].color;
          const idx = lo.callins.indexOf(id);
          const W = c.weapon ? WEAPONS[c.weapon] : null;
          const extra = `<div class="row"><div class="callin-icon" style="color:${color}">${c.icon}</div><div class="cc" style="color:${color}">${CALLIN_CATS[c.cat].name}${idx >= 0 ? ` · slot ${['Z', 'X', 'C', 'V'][idx]}` : ''}<br><span class="dim">Recarga ${c.cooldown}s</span></div></div>`;
          return card(id, { ...c, class: '', desc: c.desc + (W ? ` ${W.desc}` : '') }, 'callin', idx >= 0, extra);
        }).join('')}</div>
      </div></div>
    `;
    body.querySelectorAll('[data-buy]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const [kind, id] = b.dataset.buy.split(':');
      const def = kind === 'weapon' ? WEAPONS[id] : kind === 'grenade' ? GRENADES[id] : CALLINS[id];
      if (d.credits < def.cost) { this.toast('Créditos insuficientes.'); return; }
      d.credits -= def.cost;
      (kind === 'weapon' ? d.owned.weapons : kind === 'grenade' ? d.owned.grenades : d.owned.callins).push(id);
      p.save();
      this.game.audio.play('uiConfirm');
      this.toast(`${def.name} adquirido!`);
      this.renderChip();
      this.renderArsenal(body);
    });
    body.querySelectorAll('[data-equip]').forEach((c) => c.onclick = () => {
      if (!c.dataset.equip) return;
      const [kind, id] = c.dataset.equip.split(':');
      this.click();
      if (kind === 'weapon') {
        if (WEAPONS[id].slot === 'primary') lo.primary = id; else lo.secondary = id;
      } else if (kind === 'grenade') lo.grenade = id;
      else {
        const i = lo.callins.indexOf(id);
        if (i >= 0) { if (lo.callins.length > 1) lo.callins.splice(i, 1); }
        else if (lo.callins.length < 4) lo.callins.push(id);
        else { lo.callins.shift(); lo.callins.push(id); }
      }
      p.save();
      this.game.syncProfile();
      const sc = body.querySelector('.scroll').scrollTop;
      this.renderArsenal(body);
      body.querySelector('.scroll').scrollTop = sc;
    });
  }

  // ----------------------------------------------------------- EQUIPAMENTO
  gearCard(it, cmp = null, actions = true) {
    const R = RARITIES[it.rarity];
    const ex = it.exotic ? EXOTIC_MAP[it.exotic] : null;
    const stats = STATS.map((s) => {
      const v = it.stats[s.id];
      let delta = '';
      if (cmp) {
        const dv = v - cmp.stats[s.id];
        if (dv) delta = `<span class="${dv > 0 ? 'cmp-up' : 'cmp-dn'}">${dv > 0 ? '+' : ''}${dv}</span>`;
      }
      return `<div><span class="dim">${s.short}</span><b>${v}</b>${delta}</div>`;
    }).join('');
    const eq = Object.values(this.game.profile.data.equipped).includes(it.uid);
    return `<div class="card gear-card ${eq ? 'equipped' : ''} ${it.rarity === 'exotic' ? 'loot-glow-exotic' : it.rarity === 'legendary' ? 'loot-glow-legendary' : ''}" style="border-left-color:${R.color}" data-uid="${it.uid}">
      ${eq ? '<div class="eqmark">EQUIPADO</div>' : ''}
      <div class="ct" style="color:${R.color}">${esc(it.name)}</div>
      <div class="cc">${R.name} · ${GEAR_SLOTS.find((s) => s.id === it.slot).name} · <span style="color:#ffd76a">⚡${it.power}</span></div>
      <div class="gstats">${stats}</div>
      ${(it.perks || []).map((pk) => `<div class="gperk">◆ ${GEAR_PERKS[pk].name}: ${GEAR_PERKS[pk].desc}</div>`).join('')}
      ${ex ? `<div class="gexo">★ ${ex.perk}: ${ex.desc}</div>` : ''}
      ${actions && !eq ? `<div class="row"><button class="btn small primary" data-eq="${it.uid}">Equipar</button><button class="btn small ghost" data-dis="${it.uid}">Desmontar +¢${R.salvage + Math.round(it.power / 10)}</button></div>` : ''}
    </div>`;
  }

  renderGear(body) {
    const p = this.game.profile;
    const d = p.data;
    const eq = p.equippedItems();
    const der = p.derived();
    const slot = this.selSlot;
    const inv = d.inventory.filter((i) => i.slot === slot).sort((a, b) => (RARITIES[b.rarity].budget - RARITIES[a.rarity].budget) || b.power - a.power);
    const cur = eq[slot];
    const statBar = (name, v, max, txt) => `<div class="ss"><span>${name}</span><div class="bar"><div style="width:${Math.min(100, (v / max) * 100)}%"></div></div><b>${txt}</b></div>`;
    body.innerHTML = `
      <div class="tab-page">
        <div class="panel gear-preview">
          <div class="page-title" style="text-align:center">${esc(d.name)}</div>
          <canvas id="preview" width="340" height="360"></canvas>
          <div class="power-big">⚡ ${p.power()}</div>
          <div class="stat-summary">
            ${statBar('Vigor', der.stats.vigor, 100, der.maxHp + ' HP')}
            ${statBar('Agilidade', der.stats.agilidade, 100, '+' + Math.round((der.speedMult - 1) * 100) + '%')}
            ${statBar('Blindagem', der.stats.blindagem, 100, '-' + Math.round(der.dr * 100) + '%')}
            ${statBar('Foco', der.stats.foco, 100, '-' + Math.round((1 - der.cooldownMult) * 100) + '%')}
            ${statBar('Destreza', der.stats.destreza, 100, '+' + Math.round((der.reloadMult - 1) * 100) + '%')}
          </div>
          <div class="section-title" style="font-size:16px">Cor primária</div>
          <div class="color-row" data-c="c1">${ARMOR_COLORS.map((c) => `<div class="swatch ${d.colors.c1 === c ? 'sel' : ''}" style="background:${c}" data-v="${c}"></div>`).join('')}</div>
          <div class="section-title" style="font-size:16px">Cor secundária</div>
          <div class="color-row" data-c="c2">${ARMOR_COLORS.map((c) => `<div class="swatch ${d.colors.c2 === c ? 'sel' : ''}" style="background:${c}" data-v="${c}"></div>`).join('')}</div>
          <div class="section-title" style="font-size:16px">Visor</div>
          <div class="color-row" data-c="visor">${VISOR_COLORS.map((c) => `<div class="swatch ${d.colors.visor === c ? 'sel' : ''}" style="background:${c}" data-v="${c}"></div>`).join('')}</div>
        </div>
        <div class="panel" style="width:300px;display:flex;flex-direction:column;gap:10px">
          <div class="page-title">EQUIPAMENTO</div>
          <div class="slot-list">${GEAR_SLOTS.map((s) => {
            const it = eq[s.id];
            const R = it ? RARITIES[it.rarity] : RARITIES.common;
            return `<div class="slot ${s.id === slot ? 'sel' : ''}" data-slot="${s.id}" style="border-left-color:${R.color}"><div><div class="sn">${s.name}</div><div class="si" style="color:${R.color}">${it ? esc(it.name) : '—'}</div></div><div class="sp">${it ? it.power : ''}</div></div>`;
          }).join('')}</div>
          <div class="dim" style="font-size:13px">Itens caem ao completar missões (mais e melhores em dificuldades altas), em depósitos e a cada 5 níveis. Exóticos têm efeitos únicos — só um por vez.</div>
          <button class="btn gold" id="crate">CAIXA DE SUPRIMENTOS · ¢600</button>
          <div class="dim" style="font-size:12px">Garante um item Incomum ou melhor.</div>
          <div class="dim" style="font-size:13px">Inventário: ${d.inventory.length} itens</div>
        </div>
        <div class="panel scroll" style="flex:1">
          <div class="section-title">${GEAR_SLOTS.find((s) => s.id === slot).name} <small>${inv.length} item(ns)</small></div>
          <div class="cards">${inv.map((it) => this.gearCard(it, it.uid !== cur?.uid ? cur : null)).join('')}</div>
        </div>
      </div>
    `;
    body.querySelectorAll('.slot').forEach((s) => s.onclick = () => { this.click(); this.selSlot = s.dataset.slot; this.renderGear(body); });
    body.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => {
      const err = p.equip(b.dataset.eq);
      if (err) { this.toast(err); return; }
      this.game.audio.play('uiConfirm');
      this.game.syncProfile();
      this.renderChip();
      this.renderGear(body);
    });
    body.querySelectorAll('[data-dis]').forEach((b) => b.onclick = () => {
      const v = p.dismantle(b.dataset.dis);
      if (v) { this.toast(`Item desmontado: +¢${v}`); this.game.audio.play('pickup'); }
      this.renderChip();
      this.renderGear(body);
    });
    body.querySelectorAll('.color-row').forEach((row) => row.querySelectorAll('.swatch').forEach((sw) => sw.onclick = () => {
      d.colors[row.dataset.c] = sw.dataset.v;
      p.save();
      this.click();
      this.game.syncProfile();
      this.renderGear(body);
    }));
    body.querySelector('#crate').onclick = () => {
      const it = p.buyCrate();
      if (!it) { this.toast('Créditos insuficientes.'); return; }
      this.game.audio.play(it.rarity === 'exotic' || it.rarity === 'legendary' ? 'levelup' : 'uiConfirm');
      this.selSlot = it.slot;
      this.renderChip();
      this.renderGear(body);
      this.showModal(`<h2>Caixa aberta!</h2>${this.gearCard(it, null, false)}`);
    };
    this.createPreview(body.querySelector('#preview'));
  }

  createPreview(canvas) {
    this.destroyPreview();
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(340, 360, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 340 / 360, 0.1, 50);
    cam.position.set(0, 1.25, 4.6);
    cam.lookAt(0, 1.0, 0);
    scene.add(new THREE.HemisphereLight('#c8d8ff', '#3a2a20', 1.4));
    const key = new THREE.DirectionalLight('#ffe8d0', 2.4);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#ff7a3a', 1.6);
    rim.position.set(-3, 2, -3);
    scene.add(rim);
    const t = buildTrooper(this.game.profile.look());
    const w = buildWeapon(this.game.profile.data.loadout.primary);
    t.weaponMount.add(w);
    applyPose(t, gripPose(t, w));
    t.aim.rotation.x = 0.3;
    scene.add(t.root);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#1a1e28', metalness: 0.6, roughness: 0.4 }));
    base.position.y = -0.05;
    scene.add(base);
    const preview = { renderer, scene, cam, t, alive: true, drag: false, rot: 0.5, lastX: 0 };
    canvas.onpointerdown = (e) => { preview.drag = true; preview.lastX = e.clientX; };
    window.addEventListener('pointerup', preview.up = () => { preview.drag = false; });
    canvas.onpointermove = (e) => { if (preview.drag) { preview.rot += (e.clientX - preview.lastX) * 0.01; preview.lastX = e.clientX; } };
    const loop = () => {
      if (!preview.alive) return;
      if (!preview.drag) preview.rot += 0.006;
      t.root.rotation.y = preview.rot;
      if (t.cape) t.cape.rotation.x = 0.12 + Math.sin(performance.now() * 0.002) * 0.05;
      renderer.render(scene, cam);
      requestAnimationFrame(loop);
    };
    loop();
    this.preview = preview;
  }

  destroyPreview() {
    if (this.preview) {
      this.preview.alive = false;
      window.removeEventListener('pointerup', this.preview.up);
      this.preview.renderer.dispose();
      this.preview.renderer.forceContextLoss?.();
      this.preview = null;
    }
  }

  showModal(html) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="panel modal">${html}<button class="btn primary">OK</button></div>`;
    this.root.appendChild(bg);
    bg.querySelector('button').onclick = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
  }

  // ----------------------------------------------------------- PERKS
  renderPerks(body) {
    const p = this.game.profile;
    const d = p.data;
    const slots = perkSlots(d.level);
    body.innerHTML = `
      <div class="tab-page"><div class="panel scroll" style="flex:1">
        <div class="page-title">PERKS</div>
        <div class="dim">Escolha até ${slots} perks (${d.loadout.perks.length}/${slots}). O 3º espaço libera no nível 15.</div>
        <div class="cards" style="margin-top:12px">${PERK_LIST.map((id) => {
          const pk = PERKS[id];
          const locked = pk.level > d.level;
          const eq = d.loadout.perks.includes(id);
          return `<div class="card ${eq ? 'equipped' : ''} ${locked ? 'locked' : ''}" data-perk="${locked ? '' : id}">
            ${eq ? '<div class="eqmark">ATIVO</div>' : ''}
            <div class="row"><div class="callin-icon" style="color:var(--accent2)">${pk.icon}</div><div class="ct">${pk.name}</div></div>
            <div class="cd">${pk.desc}</div>
            ${locked ? `<div class="lockinfo">🔒 Nível ${pk.level}</div>` : ''}
          </div>`;
        }).join('')}</div>
      </div></div>
    `;
    body.querySelectorAll('[data-perk]').forEach((c) => c.onclick = () => {
      const id = c.dataset.perk;
      if (!id) return;
      const list = d.loadout.perks;
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      else {
        if (list.length >= slots) list.shift();
        list.push(id);
      }
      p.save();
      this.click();
      this.renderPerks(body);
    });
  }

  // ----------------------------------------------------------- PESQUISA
  renderResearch(body) {
    const p = this.game.profile;
    const d = p.data;
    body.innerHTML = `
      <div class="tab-page"><div class="panel scroll" style="flex:1">
        <div class="page-title">PESQUISA DO BASTIÃO</div>
        <div class="dim">Use amostras (◈) coletadas nas missões e créditos (¢) para melhorias permanentes. Você tem ◈ ${d.samples} e ¢ ${d.credits}.</div>
        <div class="cards" style="margin-top:12px">${RESEARCH.map((r) => {
          const done = d.research.includes(r.id);
          const can = !done && d.samples >= r.samples && d.credits >= r.credits;
          return `<div class="card ${done ? 'equipped' : ''}">
            ${done ? '<div class="eqmark">CONCLUÍDA</div>' : ''}
            <div class="ct">${r.name}</div>
            <div class="cd">${r.desc}</div>
            ${done ? '' : `<div class="row"><span style="color:#6af0c8">◈ ${r.samples}</span><span style="color:var(--accent2)">¢ ${r.credits}</span></div><button class="btn small ${can ? 'primary' : 'disabled'}" data-r="${r.id}">Pesquisar</button>`}
          </div>`;
        }).join('')}</div>
      </div></div>
    `;
    body.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
      const r = RESEARCH.find((x) => x.id === b.dataset.r);
      if (d.samples < r.samples || d.credits < r.credits) return;
      d.samples -= r.samples;
      d.credits -= r.credits;
      d.research.push(r.id);
      p.save();
      this.game.syncProfile();
      this.game.audio.play('levelup');
      this.toast(`Pesquisa concluída: ${r.name}`);
      this.renderChip();
      this.renderResearch(body);
    });
  }

  // ----------------------------------------------------------- ESQUADRÃO
  renderSquad(body) {
    const g = this.game;
    if (!g.net.online) {
      body.innerHTML = `<div class="tab-page"><div class="panel squad-box" style="max-width:640px;margin:0 auto">
        <div class="page-title">ESQUADRÃO</div>
        <div>Servidor offline — você está no <b>modo solo</b>. Tudo funciona, mas a guerra galáctica é local.</div>
        <div class="dim">Para jogar com amigos, rode o servidor com <code>npm install</code> e <code>npm start</code>, e todos acessam <code>http://SEU-IP:8080</code>. A guerra galáctica passa a ser compartilhada por todos os jogadores conectados.</div>
      </div></div>`;
      return;
    }
    const sq = g.squad;
    if (!sq) {
      body.innerHTML = `<div class="tab-page"><div class="panel squad-box" style="max-width:720px;margin:0 auto;width:100%">
        <div class="page-title">ESQUADRÃO</div>
        <div class="dim">Monte um esquadrão de até 4 Caídos. O líder escolhe planeta, missão e dificuldade na aba Guerra.</div>
        <div class="row"><button class="btn primary" id="sq-create">CRIAR ESQUADRÃO</button><label class="row" style="font-size:14px"><input type="checkbox" id="sq-pub" checked /> Público</label></div>
        <div class="row"><input class="text-input" id="sq-code" maxlength="4" placeholder="CÓDIGO" /><button class="btn" id="sq-join">ENTRAR</button><button class="btn" id="sq-quick">ENTRADA RÁPIDA</button></div>
        <div class="section-title">Esquadrões públicos <button class="btn small ghost" id="sq-refresh">Atualizar</button></div>
        <div class="col" id="sq-list"></div>
      </div></div>`;
      body.querySelector('#sq-create').onclick = () => g.net.send('squad.create', { public: body.querySelector('#sq-pub').checked });
      body.querySelector('#sq-join').onclick = () => g.net.send('squad.join', { code: body.querySelector('#sq-code').value });
      body.querySelector('#sq-quick').onclick = () => g.net.send('squad.quick', {});
      body.querySelector('#sq-refresh').onclick = () => g.net.send('squad.list', {});
      this.renderSquadList();
      g.net.send('squad.list', {});
      return;
    }
    const isLeader = sq.leader === g.net.id;
    const me = sq.members.find((m) => m.id === g.net.id);
    const m = sq.mission;
    body.innerHTML = `<div class="tab-page">
      <div class="panel squad-box" style="width:460px">
        <div class="page-title">ESQUADRÃO</div>
        <div class="dim">Código de convite</div>
        <div class="squad-code">${sq.code}</div>
        ${isLeader ? `<label class="row" style="font-size:14px"><input type="checkbox" id="sq-pub" ${sq.public ? 'checked' : ''}/> Público (aparece na entrada rápida)</label>` : ''}
        <div class="col">${sq.members.map((mm) => `<div class="member"><div class="ml">${mm.level}</div><div><div class="mn">${mm.id === sq.leader ? '★ ' : ''}${esc(mm.name)}</div><div class="dim" style="font-size:12px">${rankFor(mm.level)}</div></div><div class="ready ${mm.ready || mm.id === sq.leader ? 'yes' : 'no'}">${mm.id === sq.leader ? 'LÍDER' : mm.ready ? 'PRONTO' : 'AGUARDANDO'}</div></div>`).join('')}</div>
        <div class="panel" style="padding:10px">${m ? `<b>${PLANET_MAP[m.planetId]?.name}</b> · ${MISSION_TYPES[m.type]?.name} · Dificuldade ${m.difficulty} (${DIFFICULTIES[m.difficulty - 1].name})` : '<span class="dim">O líder ainda não escolheu a missão (aba Guerra).</span>'}${sq.state === 'mission' ? '<div style="color:var(--good)">Missão em andamento.</div>' : ''}</div>
        <div class="row">
          ${isLeader ? `<button class="btn primary" id="sq-start" ${m ? '' : 'disabled'}>LANÇAR ESQUADRÃO</button>` : `<button class="btn ${me?.ready ? 'primary' : ''}" id="sq-ready">${me?.ready ? '✓ PRONTO' : 'ESTOU PRONTO'}</button>`}
          <button class="btn ghost" id="sq-leave">SAIR</button>
        </div>
      </div>
      <div class="panel chat-box" style="flex:1;max-width:640px">
        <h3>Canal do esquadrão</h3>
        <div class="chat-log" id="chat-log">${this.chatLog.map((c) => c.sys ? `<div class="sys">${esc(c.text)}</div>` : `<div><b>${esc(c.from)}:</b> ${esc(c.text)}</div>`).join('')}</div>
        <input class="chat-input" id="chat-in" maxlength="160" placeholder="Digite e pressione Enter…" />
      </div>
    </div>`;
    const pub = body.querySelector('#sq-pub');
    if (pub) pub.onchange = () => g.net.send('squad.public', { public: pub.checked });
    const start = body.querySelector('#sq-start');
    if (start) start.onclick = () => { if (m) g.deploy(m.planetId, m.type, m.difficulty); };
    const rd = body.querySelector('#sq-ready');
    if (rd) rd.onclick = () => g.net.send('squad.ready', { ready: !me?.ready });
    body.querySelector('#sq-leave').onclick = () => g.net.send('squad.leave', {});
    const ci = body.querySelector('#chat-in');
    ci.onkeydown = (e) => {
      if (e.key === 'Enter' && ci.value.trim()) { g.net.send('chat', { text: ci.value.trim() }); ci.value = ''; }
    };
    const log = body.querySelector('#chat-log');
    log.scrollTop = log.scrollHeight;
  }

  renderSquadList() {
    const el = this.screen?.querySelector('#sq-list');
    if (!el) return;
    el.innerHTML = this.publicSquads.length ? this.publicSquads.map((s) => `<div class="member"><div class="ml">${s.size}/4</div><div><div class="mn">${esc(s.leader || '?')} · <span style="color:var(--accent2)">${s.code}</span></div><div class="dim" style="font-size:13px">${s.mission ? `${PLANET_MAP[s.mission.planetId]?.name} · ${MISSION_TYPES[s.mission.type]?.name || ''} · dif ${s.mission.difficulty}` : 'Escolhendo missão'} ${s.state === 'mission' ? '· EM MISSÃO (entrada em andamento)' : ''}</div></div><button class="btn small ready" data-join="${s.code}">ENTRAR</button></div>`).join('') : '<div class="dim">Nenhum esquadrão público no momento.</div>';
    el.querySelectorAll('[data-join]').forEach((b) => b.onclick = () => this.game.net.send('squad.join', { code: b.dataset.join }));
  }

  addChat(msg) {
    this.chatLog.push(msg);
    if (this.chatLog.length > 60) this.chatLog.shift();
    if (this.tab === 'squad' && this.screen?.querySelector('#chat-log')) {
      const log = this.screen.querySelector('#chat-log');
      const d = document.createElement('div');
      if (msg.sys) { d.className = 'sys'; d.textContent = msg.text; }
      else d.innerHTML = `<b>${esc(msg.from)}:</b> ${esc(msg.text)}`;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }
  }

  // =========================================================== CARREGAMENTO
  showLoading(planet, missionName, faction) {
    this.make('loading-screen', `
      <div class="lsub">Descendo para</div>
      <div class="lplanet">${esc(planet.name).toUpperCase()}</div>
      <div class="lsub" style="color:${FACTIONS[faction]?.color || '#fff'}">${missionName} · ${FACTIONS[faction]?.name || ''}</div>
      <div class="boot-bar"><div></div></div>
      <div class="ltip">💡 ${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>
    `);
  }

  // =========================================================== RELATÓRIO
  showDebrief(result, rewards, gain) {
    const p = this.game.profile;
    const win = result.success;
    const rows = (result.players || []).map((pl) => `<tr><td>${esc(pl.name)}</td><td>${pl.kills}</td><td>${pl.deaths}</td><td>${pl.samples}</td><td>${pl.extracted ? '<span style="color:var(--good)">✓</span>' : '<span style="color:var(--bad)">✗</span>'}</td><td>${pl.dmg}</td></tr>`).join('');
    const mt = MISSION_TYPES[result.type];
    const el = this.make('debrief', `
      <div class="panel debrief-box">
        <div class="dtitle ${win ? 'win' : 'lose'}">${win ? 'MISSÃO CUMPRIDA' : 'MISSÃO FRACASSADA'}</div>
        <div class="dsub">${PLANET_MAP[result.planetId]?.name || ''} · ${mt ? mt.name : ''} · ${DIFFICULTIES[result.difficulty - 1]?.name || ''} · ${Math.floor(result.time / 60)}min ${result.time % 60}s</div>
        <div class="dsub" style="text-transform:none;letter-spacing:1px">${esc(result.reason || '')}</div>
        ${gain ? `<div style="text-align:center;color:${FACTIONS.legion.color};font-weight:700">+${gain.toFixed(1)}% de libertação contribuída para a Legião</div>` : ''}
        <div class="reward-row">
          <div class="reward"><div class="rv" style="color:var(--accent2)">+${rewards.xp}</div><div class="rl">Experiência</div></div>
          <div class="reward"><div class="rv" style="color:var(--accent2)">+¢${rewards.credits}</div><div class="rl">Créditos</div></div>
          <div class="reward"><div class="rv" style="color:#6af0c8">+◈${rewards.samples}</div><div class="rl">Amostras</div></div>
          <div class="reward"><div class="rv">${rewards.me.kills}</div><div class="rl">Abates</div></div>
        </div>
        ${rewards.levels.length ? `<div class="levelup">NÍVEL ${rewards.levels[rewards.levels.length - 1]}! · ${rankFor(rewards.levels[rewards.levels.length - 1])}</div>` : ''}
        <div class="xp-breakdown">${rewards.lines.map(([a, b]) => `<span class="dim">${a}</span><b>${typeof b === 'number' ? '+' + b : b}</b>`).join('')}</div>
        <table class="stats-table"><tr><th>Caído</th><th>Abates</th><th>Mortes</th><th>Amostras</th><th>Extraído</th><th>Dano</th></tr>${rows}</table>
        ${rewards.loot.length ? `<div class="section-title" style="justify-content:center">LOOT OBTIDO</div><div class="loot-row">${rewards.loot.map((it, i) => this.gearCard(it, null, false).replace('class="card', `style="animation-delay:${0.2 + i * 0.25}s" class="card`)).join('')}</div>` : ''}
        <div class="row" style="justify-content:center"><button class="btn primary big" id="back">VOLTAR AO BASTIÃO</button></div>
      </div>
    `);
    el.querySelector('#back').onclick = () => { this.click(); this.game.backToHub(); };
    if (rewards.levels.length) setTimeout(() => this.game.audio.play('levelup'), 400);
  }

  // =========================================================== PAUSA
  showPause(mc) {
    if (this.pauseOpen) return;
    this.pauseOpen = true;
    const s = this.game.profile.data.settings;
    const bg = document.createElement('div');
    bg.className = 'pause-menu';
    bg.innerHTML = `<div class="panel pause-box">
      <h2>${mc.online ? 'MENU (a missão continua!)' : 'PAUSADO'}</h2>
      <button class="btn primary" id="p-resume">RETOMAR</button>
      <label>Sensibilidade do mouse <input type="range" id="p-sens" min="0.2" max="3" step="0.05" value="${s.sens}" /></label>
      <label>Volume <input type="range" id="p-vol" min="0" max="1" step="0.05" value="${s.volume}" /></label>
      <label>Campo de visão <input type="range" id="p-fov" min="60" max="95" step="1" value="${s.fov}" /></label>
      <label>Qualidade gráfica <select id="p-q"><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
      <div class="dim" style="font-size:12px">A qualidade é aplicada na próxima missão.</div>
      <button class="btn ghost" id="p-quit">ABANDONAR MISSÃO</button>
    </div>`;
    this.root.appendChild(bg);
    bg.querySelector('#p-q').value = s.quality;
    const save = () => { this.game.profile.save(); };
    bg.querySelector('#p-sens').oninput = (e) => { s.sens = +e.target.value; save(); };
    bg.querySelector('#p-vol').oninput = (e) => { s.volume = +e.target.value; this.game.audio.setVolume(s.volume); save(); };
    bg.querySelector('#p-fov').oninput = (e) => { s.fov = +e.target.value; if (mc.player) mc.player.baseFov = s.fov; save(); };
    bg.querySelector('#p-q').onchange = (e) => { s.quality = e.target.value; save(); };
    bg.querySelector('#p-resume').onclick = () => { this.hidePause(); this.game.input.lock(); };
    bg.querySelector('#p-quit').onclick = () => {
      this.hidePause();
      mc.transport.abandon();
      if (mc.online) mc.finish({ success: false, reason: 'Você abandonou a missão.', players: [], objectives: [], difficulty: mc.cfg.difficulty, planetId: mc.cfg.planetId, faction: mc.cfg.faction, type: mc.cfg.type, mainDone: false, optionalDone: 0, caches: 0, time: Math.round(mc.time) });
    };
    this.pauseEl = bg;
  }

  hidePause() {
    this.pauseOpen = false;
    if (this.pauseEl) this.pauseEl.remove();
    this.pauseEl = null;
  }
}
