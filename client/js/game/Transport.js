// Transporte da missão: local (solo, simulação no navegador) ou rede (servidor autoritativo)
import { MissionSim, SIM_TICK, SNAP_EVERY } from '../../../shared/sim/MissionSim.js';

export class LocalTransport {
  constructor(cfg, world, playerInfo) {
    this.sim = new MissionSim({ ...cfg, world });
    this.myId = 'me';
    this.sim.addPlayer(this.myId, playerInfo);
    this.acc = 0;
    this.tick = 0;
    this.listeners = {};
    this.paused = true;
    this.online = false;
  }
  on(type, fn) { this.listeners[type] = fn; }
  send(k, d) { this.sim.handle(this.myId, k, d); }
  update(dt) {
    if (this.paused) return;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= SIM_TICK) {
      this.acc -= SIM_TICK;
      this.sim.update(SIM_TICK);
      this.tick++;
      if (this.tick % SNAP_EVERY === 0 || this.sim.ended) {
        const s = this.sim.snapshot();
        if (this.listeners.snap) this.listeners.snap(s);
        if (this.sim.ended) { this.paused = true; break; }
      }
    }
  }
  fullState() { return this.sim.fullState(); }
  abandon() { this.sim.end(false, 'Missão abandonada.'); const s = this.sim.snapshot(); if (this.listeners.snap) this.listeners.snap(s); }
  leave() {}
}

export class NetTransport {
  constructor(net, myId) {
    this.net = net;
    this.myId = myId;
    this.listeners = {};
    this.online = true;
    this.paused = false;
    this.queue = [];
    this.off = [
      net.on('snap', (m) => {
        if (this.listeners.snap) this.listeners.snap(m.s);
        else this.queue.push(m.s);
      }),
      net.on('chat', (m) => this.listeners.chat && this.listeners.chat(m)),
      net.on('mission.result', (m) => this.listeners.result && this.listeners.result(m)),
      net.on('disconnect', () => this.listeners.disconnect && this.listeners.disconnect()),
    ];
  }
  on(type, fn) {
    this.listeners[type] = fn;
    if (type === 'snap' && this.queue.length) {
      const q = this.queue;
      this.queue = [];
      for (const s of q) fn(s);
    }
  }
  send(k, d) { this.net.send('m', { k, d }); }
  update() {}
  abandon() { this.net.send('mission.leave'); }
  leave() { this.off.forEach((f) => f()); }
}
