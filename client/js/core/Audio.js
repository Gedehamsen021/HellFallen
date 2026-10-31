// Áudio procedural com WebAudio (sem arquivos externos)
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.loops = {};
    this.lastPlay = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setListener(x, y, z, yaw) {
    this.listener.x = x; this.listener.y = y; this.listener.z = z; this.listener.yaw = yaw;
  }

  // ganho/pan a partir de uma posição no mundo
  spatial(pos, maxDist = 120) {
    if (!pos) return { vol: 1, pan: 0 };
    const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z, dy = (pos.y || 0) - this.listener.y;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const vol = Math.max(0, 1 - d / maxDist);
    const ang = Math.atan2(dx, dz) - this.listener.yaw;
    const pan = -Math.sin(ang) * Math.min(1, d / 6);
    return { vol: vol * vol, pan: Math.max(-1, Math.min(1, pan)) };
  }

  out(vol, pan = 0) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.master);
    } else g.connect(this.master);
    return g;
  }

  throttle(key, ms) {
    const now = performance.now();
    if (this.lastPlay[key] && now - this.lastPlay[key] < ms) return false;
    this.lastPlay[key] = now;
    return true;
  }

  noiseBurst(dest, { dur = 0.2, type = 'bandpass', freq = 1000, freq2 = null, q = 1, vol = 1, attack = 0.002, t0 = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + t0;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  tone(dest, { type = 'sine', f1 = 440, f2 = null, dur = 0.2, vol = 0.5, attack = 0.005, t0 = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + t0;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const sp = this.spatial(pos, opts.range || 140);
    const vol = (opts.vol ?? 1) * sp.vol;
    if (vol < 0.01) return;
    const out = this.out(vol, sp.pan);
    switch (name) {
      case 'rifle':
        this.noiseBurst(out, { dur: 0.13, freq: 1800, q: 0.8, vol: 0.55 });
        this.tone(out, { type: 'triangle', f1: 160, f2: 50, dur: 0.12, vol: 0.6 });
        break;
      case 'smg':
        this.noiseBurst(out, { dur: 0.08, freq: 2400, q: 0.9, vol: 0.45 });
        this.tone(out, { type: 'triangle', f1: 200, f2: 70, dur: 0.07, vol: 0.4 });
        break;
      case 'pistol':
        this.noiseBurst(out, { dur: 0.1, freq: 2200, q: 1, vol: 0.45 });
        this.tone(out, { type: 'triangle', f1: 240, f2: 80, dur: 0.08, vol: 0.4 });
        break;
      case 'shotgun':
        this.noiseBurst(out, { dur: 0.32, type: 'lowpass', freq: 3200, freq2: 300, q: 0.5, vol: 0.85 });
        this.tone(out, { type: 'sine', f1: 120, f2: 35, dur: 0.25, vol: 0.9 });
        break;
      case 'sniper':
      case 'revolver':
        this.noiseBurst(out, { dur: 0.4, type: 'lowpass', freq: 4000, freq2: 400, q: 0.6, vol: 0.8 });
        this.tone(out, { type: 'sine', f1: 140, f2: 40, dur: 0.3, vol: 0.85 });
        break;
      case 'mg':
        this.noiseBurst(out, { dur: 0.12, freq: 1300, q: 0.7, vol: 0.6 });
        this.tone(out, { type: 'triangle', f1: 120, f2: 45, dur: 0.11, vol: 0.7 });
        break;
      case 'plasma':
        this.tone(out, { type: 'sawtooth', f1: 900, f2: 180, dur: 0.16, vol: 0.25 });
        this.noiseBurst(out, { dur: 0.1, freq: 3000, q: 2, vol: 0.2 });
        break;
      case 'arc':
        for (let i = 0; i < 4; i++) this.noiseBurst(out, { dur: 0.05, freq: 3000 + Math.random() * 3000, q: 4, vol: 0.4, t0: i * 0.03 });
        this.tone(out, { type: 'square', f1: 120, f2: 60, dur: 0.2, vol: 0.15 });
        break;
      case 'rail':
        this.tone(out, { type: 'sawtooth', f1: 2400, f2: 120, dur: 0.35, vol: 0.35 });
        this.noiseBurst(out, { dur: 0.4, type: 'lowpass', freq: 5000, freq2: 300, vol: 0.7 });
        break;
      case 'charge':
        this.tone(out, { type: 'sine', f1: 200, f2: 1800, dur: 0.7, vol: 0.18 });
        break;
      case 'rocket':
        this.noiseBurst(out, { dur: 0.6, type: 'lowpass', freq: 1500, freq2: 200, vol: 0.7, attack: 0.02 });
        this.tone(out, { type: 'sine', f1: 90, f2: 40, dur: 0.3, vol: 0.6 });
        break;
      case 'gl':
        this.tone(out, { type: 'sine', f1: 180, f2: 60, dur: 0.15, vol: 0.7 });
        this.noiseBurst(out, { dur: 0.1, freq: 800, vol: 0.4 });
        break;
      case 'enemyLaser':
        this.tone(out, { type: 'square', f1: 1400, f2: 300, dur: 0.12, vol: 0.18 });
        break;
      case 'acid':
        this.noiseBurst(out, { dur: 0.3, type: 'lowpass', freq: 900, freq2: 200, q: 3, vol: 0.4 });
        break;
      case 'voidbolt':
        this.tone(out, { type: 'sine', f1: 300, f2: 1100, dur: 0.25, vol: 0.25 });
        this.tone(out, { type: 'triangle', f1: 310, f2: 1150, dur: 0.25, vol: 0.15 });
        break;
      case 'explosion': {
        const big = opts.big || 1;
        this.noiseBurst(out, { dur: 1.2 * big, type: 'lowpass', freq: 1400, freq2: 60, q: 0.7, vol: 1.0, attack: 0.005 });
        this.tone(out, { type: 'sine', f1: 70, f2: 22, dur: 0.9 * big, vol: 1.0 });
        this.noiseBurst(out, { dur: 0.15, freq: 2500, q: 0.5, vol: 0.5 });
        break;
      }
      case 'boomFar':
        this.noiseBurst(out, { dur: 1.6, type: 'lowpass', freq: 400, freq2: 40, vol: 0.9, attack: 0.03 });
        break;
      case 'hit':
        this.tone(out, { type: 'square', f1: 1800, f2: 1200, dur: 0.04, vol: 0.12 });
        break;
      case 'weak':
        this.tone(out, { type: 'square', f1: 2400, f2: 1800, dur: 0.05, vol: 0.14 });
        break;
      case 'kill':
        this.tone(out, { type: 'triangle', f1: 900, f2: 1400, dur: 0.12, vol: 0.18 });
        break;
      case 'hurt':
        this.noiseBurst(out, { dur: 0.18, type: 'lowpass', freq: 600, vol: 0.6 });
        this.tone(out, { type: 'sine', f1: 110, f2: 60, dur: 0.15, vol: 0.5 });
        break;
      case 'reload':
        this.noiseBurst(out, { dur: 0.05, freq: 3000, q: 5, vol: 0.4 });
        this.noiseBurst(out, { dur: 0.06, freq: 2000, q: 5, vol: 0.45, t0: 0.18 });
        break;
      case 'empty':
        this.noiseBurst(out, { dur: 0.03, freq: 4000, q: 6, vol: 0.3 });
        break;
      case 'beacon':
        this.tone(out, { type: 'sine', f1: 1320, dur: 0.08, vol: 0.25 });
        this.tone(out, { type: 'sine', f1: 1760, dur: 0.08, vol: 0.25, t0: 0.1 });
        break;
      case 'incoming':
        this.tone(out, { type: 'sine', f1: 2200, f2: 300, dur: 1.4, vol: 0.3, attack: 0.1 });
        break;
      case 'jet':
        this.noiseBurst(out, { dur: 2.2, type: 'bandpass', freq: 400, freq2: 2400, q: 0.8, vol: 0.9, attack: 0.6 });
        break;
      case 'pod':
        this.noiseBurst(out, { dur: 2.6, type: 'lowpass', freq: 300, freq2: 2400, vol: 0.6, attack: 1.5 });
        break;
      case 'pickup':
        this.tone(out, { type: 'triangle', f1: 880, dur: 0.08, vol: 0.25 });
        this.tone(out, { type: 'triangle', f1: 1320, dur: 0.12, vol: 0.25, t0: 0.08 });
        break;
      case 'ui':
        this.tone(out, { type: 'square', f1: 1200, f2: 900, dur: 0.04, vol: 0.08 });
        break;
      case 'uiConfirm':
        this.tone(out, { type: 'triangle', f1: 660, dur: 0.08, vol: 0.2 });
        this.tone(out, { type: 'triangle', f1: 990, dur: 0.12, vol: 0.2, t0: 0.07 });
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(out, { type: 'triangle', f1: f, dur: 0.3, vol: 0.25, t0: i * 0.1 }));
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) this.tone(out, { type: 'square', f1: 880, f2: 660, dur: 0.25, vol: 0.12, t0: i * 0.3 });
        break;
      case 'screech':
        this.tone(out, { type: 'sawtooth', f1: 600 + Math.random() * 400, f2: 200, dur: 0.35, vol: 0.18 });
        break;
      case 'robot':
        this.tone(out, { type: 'square', f1: 300, dur: 0.06, vol: 0.12 });
        this.tone(out, { type: 'square', f1: 200, dur: 0.08, vol: 0.12, t0: 0.08 });
        break;
      case 'whisper':
        this.noiseBurst(out, { dur: 0.6, freq: 1800, freq2: 600, q: 6, vol: 0.25, attack: 0.15 });
        break;
      case 'stim':
        this.noiseBurst(out, { dur: 0.4, freq: 5000, q: 2, vol: 0.3 });
        this.tone(out, { type: 'sine', f1: 500, f2: 900, dur: 0.3, vol: 0.15 });
        break;
      case 'throw':
        this.noiseBurst(out, { dur: 0.15, freq: 800, freq2: 2000, q: 1, vol: 0.25 });
        break;
      case 'melee':
        this.noiseBurst(out, { dur: 0.15, type: 'lowpass', freq: 1200, vol: 0.5 });
        break;
      case 'breach':
        this.noiseBurst(out, { dur: 1.5, type: 'lowpass', freq: 250, freq2: 60, vol: 0.9, attack: 0.3 });
        break;
      case 'teleport':
        this.tone(out, { type: 'sine', f1: 1500, f2: 200, dur: 0.3, vol: 0.2 });
        break;
      case 'laserOrbital':
        this.tone(out, { type: 'sawtooth', f1: 80, dur: 0.5, vol: 0.2 });
        break;
    }
  }

  // sons contínuos (vento, lança-chamas, laser)
  loop(name, on, opts = {}) {
    if (!this.ctx) return;
    let l = this.loops[name];
    if (on && !l) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = opts.type || 'lowpass';
      f.frequency.value = opts.freq || 500;
      f.Q.value = opts.q || 0.7;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      l = this.loops[name] = { src, f, g, target: opts.vol ?? 0.2 };
    }
    if (l) {
      l.target = on ? (opts.vol ?? l.target) : 0;
      l.g.gain.setTargetAtTime(l.target, this.ctx.currentTime, 0.08);
      if (!on) {
        const ref = l;
        setTimeout(() => {
          if (this.loops[name] === ref && ref.target === 0) {
            try { ref.src.stop(); } catch {}
            delete this.loops[name];
          }
        }, 600);
      }
    }
  }

  stopAllLoops() {
    for (const k of Object.keys(this.loops)) this.loop(k, false);
  }
}
