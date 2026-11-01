// HUD da missão (DOM + canvas)
import { WEAPONS } from '../../../shared/data/weapons.js';
import { CALLIN_CATS } from '../../../shared/data/callins.js';
import { GRENADES } from '../../../shared/data/weapons.js';

const KEYS = ['Z', 'X', 'C', 'V'];
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class HUD {
  constructor(root, mc) {
    this.mc = mc;
    this.el = document.createElement('div');
    this.el.className = 'screen hud';
    root.appendChild(this.el);
    this.el.innerHTML = `
      <div class="vignette"></div>
      <div class="lowhp hidden"></div>
      <div class="compass"><div class="strip"></div><div class="center"></div></div>
      <div class="mission-timer"></div>
      <div class="extract-banner hidden"></div>
      <div class="boss-bar hidden"><div class="bn"></div><div class="bar"><div></div></div></div>
      <div class="hud-tl">
        <div class="mission-head"></div>
        <div class="objectives"></div>
      </div>
      <div class="hud-tr">
        <div class="minimap"><canvas width="210" height="210"></canvas></div>
        <div class="hud-stats"><span class="st-reinf"></span><span class="st-samples"></span></div>
      </div>
      <div class="killfeed"></div>
      <div class="feed"></div>
      <div class="crosshair"><i class="c-t"></i><i class="c-b"></i><i class="c-l"></i><i class="c-r"></i><i class="c-d"></i></div>
      <div class="hitmarker"></div>
      <div class="prompt hidden"></div>
      <div class="big-msg"></div>
      <div class="chat-hud"><div class="cl"></div></div>
      <div class="hud-bl">
        <div class="squad-hud"></div>
        <div class="hp-wrap"><div class="hp-val">100</div><div class="hp-bar"><div class="ghost"></div><div class="fill"></div></div></div>
        <div class="stam-bar"><div class="fill"></div></div>
        <div class="hud-items"><span class="it-stim"></span><span class="it-nade"></span></div>
      </div>
      <div class="hud-br">
        <div class="wpn-name"></div>
        <div class="ammo"><span class="mag"></span><span class="res"></span></div>
        <div class="heat-bar hidden"><div class="fill"></div></div>
        <div class="wpn-slots"></div>
      </div>
      <div class="callin-bar"></div>
      <div class="death-screen hidden"><div class="dt">VOCÊ CAIU</div><div class="ds"></div></div>
      <div class="big-map hidden"><canvas width="900" height="900"></canvas></div>
      <div class="click-to-play hidden">CLIQUE PARA JOGAR</div>
    `;
    const q = (s) => this.el.querySelector(s);
    this.$ = {
      vignette: q('.vignette'), lowhp: q('.lowhp'), compass: q('.compass .strip'), timer: q('.mission-timer'),
      extract: q('.extract-banner'), boss: q('.boss-bar'), bossName: q('.boss-bar .bn'), bossFill: q('.boss-bar .bar > div'),
      head: q('.mission-head'), objectives: q('.objectives'), minimap: q('.minimap canvas'),
      reinf: q('.st-reinf'), samples: q('.st-samples'), killfeed: q('.killfeed'), feed: q('.feed'),
      cross: q('.crosshair'), hit: q('.hitmarker'), prompt: q('.prompt'), big: q('.big-msg'),
      chat: q('.chat-hud'), chatLog: q('.chat-hud .cl'),
      squad: q('.squad-hud'), hpVal: q('.hp-val'), hpFill: q('.hp-bar .fill'), hpGhost: q('.hp-bar .ghost'),
      stam: q('.stam-bar .fill'), stim: q('.it-stim'), nade: q('.it-nade'),
      wname: q('.wpn-name'), ammo: q('.ammo'), mag: q('.ammo .mag'), res: q('.ammo .res'), heat: q('.heat-bar'), heatFill: q('.heat-bar .fill'),
      slots: q('.wpn-slots'), callins: q('.callin-bar'), death: q('.death-screen'), deathSub: q('.death-screen .ds'),
      bigMap: q('.big-map'), bigCanvas: q('.big-map canvas'), clickPlay: q('.click-to-play'),
    };
    this.mini = this.$.minimap.getContext('2d');
    this.bigCtx = this.$.bigCanvas.getContext('2d');
    this.hitT = 0;
    this.vigT = 0;
    this.bigT = 0;
    this.dead = false;
    this.mapOpen = false;
    this.callinEls = [];
    this.lastObjKey = '';
    this.chatLines = [];
    this.buildCompass();
  }

  buildCompass() {
    const marks = [['N', Math.PI], ['NE', Math.PI * 0.75], ['L', Math.PI / 2], ['SE', Math.PI / 4], ['S', 0], ['SO', -Math.PI / 4], ['O', -Math.PI / 2], ['NO', -Math.PI * 0.75]];
    this.cardinals = marks.map(([t, a]) => {
      const d = document.createElement('div');
      d.className = 'mk' + (t.length === 1 ? ' cardinal' : '');
      d.textContent = t;
      this.$.compass.appendChild(d);
      return { el: d, a };
    });
    this.compassMarks = [];
  }

  setMission(cfg, planetName, missionName) {
    this.$.head.innerHTML = `${missionName}<small>${planetName} · DIFICULDADE ${cfg.difficulty}</small>`;
  }

  setupCallins(callins) {
    this.$.callins.innerHTML = '';
    this.callinEls = callins.map((c, i) => {
      const color = CALLIN_CATS[c.def.cat].color;
      const d = document.createElement('div');
      d.className = 'callin-slot';
      d.style.color = color;
      d.title = c.def.name;
      d.innerHTML = `<span class="key">${KEYS[i]}</span>${c.def.icon}<div class="cd"></div><span class="cdt"></span>`;
      this.$.callins.appendChild(d);
      return { el: d, cd: d.querySelector('.cd'), cdt: d.querySelector('.cdt') };
    });
  }

  hitmarker(weak, kill = false) {
    const h = this.$.hit;
    h.className = 'hitmarker show' + (kill ? ' kill' : weak ? ' weak' : '');
    this.hitT = kill ? 0.25 : 0.1;
  }

  damage(dmg) {
    this.vigT = Math.min(0.8, this.vigT + dmg / 50);
  }

  message(text, style = 'info') {
    const d = document.createElement('div');
    d.className = 'fm ' + style;
    d.textContent = text;
    this.$.feed.appendChild(d);
    while (this.$.feed.children.length > 5) this.$.feed.firstChild.remove();
    setTimeout(() => { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; }, 4200);
    setTimeout(() => d.remove(), 4800);
  }

  kill(text) {
    const d = document.createElement('div');
    d.textContent = text;
    this.$.killfeed.prepend(d);
    while (this.$.killfeed.children.length > 6) this.$.killfeed.lastChild.remove();
    setTimeout(() => d.remove(), 5000);
  }

  bigMessage(title, sub = '', dur = 3.5, color = null) {
    this.$.big.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.$.big.style.color = color || '';
    this.$.big.classList.add('show');
    this.bigT = dur;
  }

  chat(from, text, sys = false) {
    const d = document.createElement('div');
    if (sys) d.innerHTML = `<i style="color:#8a93a6">${escapeHtml(text)}</i>`;
    else d.innerHTML = `<b style="color:#ffb000">${escapeHtml(from)}:</b> ${escapeHtml(text)}`;
    this.$.chatLog.appendChild(d);
    while (this.$.chatLog.children.length > 6) this.$.chatLog.firstChild.remove();
    setTimeout(() => d.remove(), 12000);
  }

  setDead(d) {
    this.dead = d;
    this.$.death.classList.toggle('hidden', !d);
  }

  setPrompt(html) {
    if (html) { this.$.prompt.innerHTML = html; this.$.prompt.classList.remove('hidden'); }
    else this.$.prompt.classList.add('hidden');
  }

  setClickToPlay(v) { this.$.clickPlay.classList.toggle('hidden', !v); }

  toggleMap(on) {
    this.mapOpen = on;
    this.$.bigMap.classList.toggle('hidden', !on);
  }

  setObjectives(obs) {
    const key = JSON.stringify(obs.map((o) => [o.l, o.d, o.c, o.s, o.f, Math.round(o.pr || 0), Math.round(o.tm || 0), o.hp, o.pa]));
    if (key === this.lastObjKey) return;
    this.lastObjKey = key;
    const main = obs.filter((o) => o.m);
    const opt = obs.filter((o) => o.o);
    let html = '';
    for (const o of main) {
      let extra = '';
      if (o.k === 'destroy') extra = ` (${o.c}/${o.t})`;
      let bar = '';
      if (o.k === 'uplink' && o.s === 'active') bar = `<div class="bar pbar"><div style="width:${o.pr}%"></div></div><div class="dim" style="font-size:12px">${Math.floor(o.pr)}%${o.pa ? ' — PAUSADO: volte para a zona!' : ''}</div>`;
      if (o.k === 'launch' && o.s === 'countdown') bar = `<div class="dim" style="font-size:13px">Lançamento em ${fmtTime(o.tm)}</div>`;
      if (o.k === 'launch' && o.s === 'consoles') extra = ` (${o.cs.filter(Boolean).length}/3)`;
      if (o.k === 'defend' && o.s === 'active') bar = `<div class="bar pbar"><div style="width:${o.hp}%;background:#4fd8ff"></div></div><div class="dim" style="font-size:12px">Gerador ${o.hp}% · resta ${fmtTime(o.tm)}</div>`;
      html += `<div class="obj ${o.d ? 'done' : ''}"><div class="ck"></div><div>${o.l}${extra}${bar}</div></div>`;
    }
    const doneOpt = opt.filter((o) => o.d).length;
    if (opt.length) html += `<div class="obj opt ${doneOpt === opt.length ? 'done' : ''}"><div class="ck"></div><div>Destruir postos avançados (${doneOpt}/${opt.length})</div></div>`;
    this.$.objectives.innerHTML = html;
  }

  put(el, html) {
    if (el._v !== html) { el.innerHTML = html; el._v = html; }
  }

  update(dt, s) {
    const p = s.player;
    const $ = this.$;
    const put = (el, html) => this.put(el, html);
    // marcadores de acerto / dano
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $.hit.classList.remove('show'); }
    this.vigT = Math.max(0, this.vigT - dt * 1.5);
    $.vignette.style.opacity = this.vigT;
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) $.big.classList.remove('show'); }

    // vida / estamina
    const hpk = Math.max(0, p.hp / p.maxHp);
    put($.hpVal, Math.ceil(Math.max(0, p.hp)));
    $.hpFill.style.transform = `scaleX(${hpk})`;
    $.hpGhost.style.transform = `scaleX(${hpk})`;
    $.stam.style.transform = `scaleX(${p.stamina / p.maxStamina})`;
    $.lowhp.classList.toggle('hidden', !(p.alive && hpk < 0.3));
    put($.stim, `✚ ${p.stims}`);
    put($.nade, `● ${p.grenades} <span class="dim" style="font-size:12px">${GRENADES[p.grenadeType]?.name.replace('Granada ', '') || ''}</span>`);

    // arma
    const w = p.weapon;
    if (w) {
      const W = w.W;
      put($.wname, W.name + (p.reloadT > 0 ? ' — RECARREGANDO' : ''));
      if (W.energy) {
        put($.mag, w.overheated ? 'QUENTE' : '∞');
        put($.res, '');
        $.heat.classList.remove('hidden');
        $.heatFill.style.transform = `scaleX(${w.heat / 100})`;
        $.ammo.classList.toggle('low', w.overheated);
      } else if (W.type === 'flame') {
        put($.mag, Math.ceil(w.mag) + '%');
        put($.res, `/ ${w.mags}`);
        $.heat.classList.add('hidden');
        $.ammo.classList.toggle('low', w.mag < 20);
      } else {
        put($.mag, w.mag);
        put($.res, `/ ${w.mags}`);
        $.heat.classList.toggle('hidden', W.type !== 'rail');
        if (W.type === 'rail') $.heatFill.style.transform = `scaleX(${Math.min(1, w.charge / W.charge)})`;
        $.ammo.classList.toggle('low', w.mag <= Math.ceil(W.mag * 0.25));
      }
    }
    const slotsHtml = p.slots.map((sl, i) => sl ? `<div class="${i === p.cur ? 'act' : ''}">${i + 1} · ${sl.W.name.split(' ')[0]}</div>` : '').join('');
    if (slotsHtml !== this._slots) { $.slots.innerHTML = slotsHtml; this._slots = slotsHtml; }

    // mira dinâmica
    const sp = w ? ((p.aiming ? w.W.aimSpread : w.W.spread) + p.bloom) * 4 + 4 : 6;
    const cs = $.cross.children;
    cs[0].style.top = `${-sp - 8}px`;
    cs[1].style.top = `${sp}px`;
    cs[2].style.left = `${-sp - 8}px`;
    cs[3].style.left = `${sp}px`;
    $.cross.style.opacity = p.alive && !p.sprinting ? 1 : 0.15;

    // chamados
    for (let i = 0; i < this.callinEls.length; i++) {
      const c = p.callins[i];
      const e = this.callinEls[i];
      const k = c.cd / c.max;
      e.cd.style.height = `${k * 100}%`;
      this.put(e.cdt, c.cd > 0 ? Math.ceil(c.cd) + 's' : '');
      e.el.classList.toggle('ready', c.cd <= 0 && !s.noSupport);
      e.el.style.opacity = s.noSupport ? 0.35 : 1;
    }

    // status
    put($.reinf, `⇣ Reforços: <b>${s.reinforcements}</b>`);
    put($.samples, `◈ <b>${s.mySamples}</b>`);
    put($.timer, s.timeLeft !== null ? `${s.noSupport ? 'SEM SUPORTE ORBITAL' : 'Suporte orbital: ' + fmtTime(s.timeLeft)}` : '');
    $.timer.classList.toggle('warn', s.timeLeft !== null && s.timeLeft < 120);

    // esquadrão
    const sq = s.squad.map((m) => `<div class="sq ${m.alive ? '' : 'dead'}"><span>${escapeHtml(m.name)}</span><div class="bar"><div style="width:${m.alive ? Math.max(0, Math.min(100, m.hp)) : 0}%"></div></div>${m.alive ? '' : '✝'}</div>`).join('');
    if (sq !== this._sq) { $.squad.innerHTML = sq; this._sq = sq; }

    // morte
    if (this.dead) {
      put($.deathSub, s.reinforcements > 0 && !s.noSupport ? `Reforço chegando em breve… (${s.reinforcements} restantes)` : 'Sem reforços. Torça pelos seus companheiros.');
    }

    // extração
    const ex = s.extraction;
    let exText = '';
    if (ex[0] === 'available') exText = 'EXTRAÇÃO DISPONÍVEL — vá até a zona e use o console';
    else if (ex[0] === 'called') exText = `NAVE DE EXTRAÇÃO CHEGANDO EM ${ex[1]}s — SEGUREM A POSIÇÃO`;
    else if (ex[0] === 'landing') exText = 'NAVE POUSANDO…';
    else if (ex[0] === 'boarding') exText = 'EMBARQUEM NA NAVE!';
    else if (ex[0] === 'departing') exText = 'DECOLANDO';
    put($.extract, exText);
    $.extract.classList.toggle('hidden', !exText);

    // chefe
    if (s.boss) {
      $.boss.classList.remove('hidden');
      put($.bossName, s.boss.def.name.toUpperCase());
      $.bossFill.style.width = `${s.boss.hp * 100}%`;
    } else $.boss.classList.add('hidden');

    this.updateCompass(s);
    this.drawMinimap(s);
    if (this.mapOpen) this.drawBigMap(s);
  }

  updateCompass(s) {
    const yaw = s.yaw;
    const W = 520, half = W / 2, span = Math.PI / 2;
    const place = (el, a) => {
      let rel = a - yaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      if (Math.abs(rel) > span * 1.05) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = `${half - (rel / span) * half}px`;
    };
    for (const c of this.cardinals) place(c.el, c.a);
    const marks = s.markers;
    while (this.compassMarks.length < marks.length) {
      const d = document.createElement('div');
      d.className = 'mk obj';
      this.$.compass.appendChild(d);
      this.compassMarks.push(d);
    }
    for (let i = 0; i < this.compassMarks.length; i++) {
      const el = this.compassMarks[i];
      const m = marks[i];
      if (!m) { el.style.display = 'none'; continue; }
      el.textContent = m.icon;
      el.style.color = m.color;
      place(el, Math.atan2(m.x - s.px, m.z - s.pz));
      if (el.style.display !== 'none') el.title = '';
      el.dataset.d = Math.round(Math.hypot(m.x - s.px, m.z - s.pz));
    }
  }

  drawMinimap(s) {
    const ctx = this.mini;
    const W = 210, R = W / 2;
    const base = s.mapCanvas;
    const k = base.width / s.mapSize;
    const range = 150;
    const zoom = R / range / k;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R);
    ctx.rotate(s.yaw + Math.PI);
    ctx.scale(zoom, zoom);
    ctx.translate(-(s.px + s.half) * k, -(s.pz + s.half) * k);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
    // marcadores (posições relativas rotacionadas)
    const toMini = (x, z) => {
      const dx = x - s.px, dz = z - s.pz;
      const a = s.yaw + Math.PI;
      const c = Math.cos(a), sn = Math.sin(a);
      const mx = (dx * c - dz * sn) * (R / range);
      const my = (dx * sn + dz * c) * (R / range);
      return [R + mx, R + my];
    };
    const dot = (x, z, color, r = 3, shape = 'c', clampEdge = false) => {
      let [mx, my] = toMini(x, z);
      const dd = Math.hypot(mx - R, my - R);
      if (dd > R - 6) {
        if (!clampEdge) return;
        mx = R + (mx - R) / dd * (R - 6);
        my = R + (my - R) / dd * (R - 6);
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      if (shape === 'd') { ctx.moveTo(mx, my - r - 1); ctx.lineTo(mx + r + 1, my); ctx.lineTo(mx, my + r + 1); ctx.lineTo(mx - r - 1, my); }
      else if (shape === 's') ctx.rect(mx - r, my - r, r * 2, r * 2);
      else ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const e of s.radar) dot(e.x, e.z, e.structure ? '#ff3b3b' : 'rgba(255,70,70,0.9)', e.structure ? 4 : e.heavy ? 3.5 : 2.2, e.structure ? 's' : 'c');
    for (const pk of s.pickupsNear) dot(pk.x, pk.z, pk.k === 'sample' ? '#6af0c8' : '#4fb8ff', 2.2);
    for (const m of s.markers) dot(m.x, m.z, m.color, 4, 'd', true);
    for (const t of s.teammates) dot(t.x, t.z, '#3fb6ff', 3.2, 'c', true);
    // jogador
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(R, R - 7);
    ctx.lineTo(R + 5, R + 5);
    ctx.lineTo(R, R + 2);
    ctx.lineTo(R - 5, R + 5);
    ctx.fill();
  }

  drawBigMap(s) {
    const ctx = this.bigCtx;
    const W = 900;
    const k = W / s.mapSize;
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(s.mapCanvas, 0, 0, W, W);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 1; i < 12; i++) {
      ctx.beginPath(); ctx.moveTo(i * W / 12, 0); ctx.lineTo(i * W / 12, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * W / 12); ctx.lineTo(W, i * W / 12); ctx.stroke();
    }
    const P = (x, z) => [(x + s.half) * k, (z + s.half) * k];
    ctx.font = 'bold 14px Rajdhani, sans-serif';
    for (const m of s.markers) {
      const [x, y] = P(m.x, m.z);
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(m.label || '', x + 12, y + 5);
    }
    for (const e of s.structuresKnown) {
      const [x, y] = P(e.x, e.z);
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
    for (const t of s.teammates) {
      const [x, y] = P(t.x, t.z);
      ctx.fillStyle = '#3fb6ff';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(t.name, x + 9, y + 4);
    }
    const [px, py] = P(s.px, s.pz);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-s.yaw + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 3); ctx.lineTo(-8, 8); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, 260, 92);
    ctx.fillStyle = '#fff';
    ctx.fillText('◆ Amarelo: objetivos   ◆ Verde: extração', 20, 32);
    ctx.fillText('■ Vermelho: estruturas inimigas', 20, 52);
    ctx.fillText('● Azul: esquadrão   ◆ Laranja: marcações', 20, 72);
    ctx.fillText('[M] fechar mapa', 20, 92);
  }

  dispose() {
    this.el.remove();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
