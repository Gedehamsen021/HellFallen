// Cliente WebSocket com reconexão automática e servidor configurável
const SERVER_KEY = 'hellfallen.server';

export function configuredServer() {
  try {
    const saved = localStorage.getItem(SERVER_KEY);
    if (saved) return saved;
  } catch {}
  return (window.HELLFALLEN_CONFIG && window.HELLFALLEN_CONFIG.server) || '';
}

export function serverUrl() {
  let custom = configuredServer().trim();
  if (custom) {
    if (/^https?:\/\//.test(custom)) custom = custom.replace(/^http/, 'ws');
    if (!/^wss?:\/\//.test(custom)) custom = (location.protocol === 'https:' ? 'wss://' : 'ws://') + custom;
    custom = custom.replace(/\/+$/, '');
    if (!custom.endsWith('/ws')) custom += '/ws';
    return custom;
  }
  // hospedagem estática (GitHub Pages ou arquivo local) não tem servidor de jogo
  if (location.protocol === 'file:' || location.hostname.endsWith('github.io')) return null;
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}

export class Net {
  constructor() {
    this.ws = null;
    this.online = false;
    this.id = null;
    this.handlers = new Map();
    this.helloData = null;
    this.retry = 0;
    this.gen = 0;
    this.url = null;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  emit(type, msg) {
    const set = this.handlers.get(type);
    if (set) for (const fn of [...set]) fn(msg);
  }

  get hasServer() { return !!this.url; }

  setServer(addr) {
    try {
      if (addr) localStorage.setItem(SERVER_KEY, addr.trim());
      else localStorage.removeItem(SERVER_KEY);
    } catch {}
    this.reconnect();
  }

  reconnect() {
    this.gen++;
    this.retry = 0;
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      old.onclose = null;
      try { old.close(); } catch {}
    }
    if (this.online) { this.online = false; this.id = null; this.emit('status', { online: false }); this.emit('disconnect', {}); }
    this.connect(this.helloData);
  }

  connect(helloData) {
    this.helloData = helloData;
    this.url = serverUrl();
    const gen = this.gen;
    if (!this.url) {
      this.emit('status', { online: false });
      return;
    }
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry(gen);
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (gen !== this.gen) return;
      this.online = true;
      this.retry = 0;
      this.send('hello', typeof this.helloData === 'function' ? this.helloData() : this.helloData);
      this.emit('status', { online: true });
    };
    ws.onmessage = (e) => {
      if (gen !== this.gen) return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') this.id = msg.id;
      this.emit(msg.t, msg);
    };
    ws.onclose = () => {
      if (gen !== this.gen) return;
      const was = this.online;
      this.online = false;
      this.id = null;
      if (was) this.emit('status', { online: false });
      else this.emit('status', { online: false, failed: true });
      this.emit('disconnect', {});
      this.scheduleRetry(gen);
    };
    ws.onerror = () => {};
  }

  scheduleRetry(gen) {
    if (gen !== this.gen) return;
    this.retry++;
    const delay = Math.min(15000, 2000 * this.retry);
    setTimeout(() => { if (gen === this.gen) this.connect(this.helloData); }, delay);
  }

  send(t, data = {}) {
    if (!this.online || !this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ t, ...data }));
    return true;
  }
}
