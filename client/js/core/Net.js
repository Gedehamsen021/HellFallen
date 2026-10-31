// Cliente WebSocket com reconexão automática
export class Net {
  constructor() {
    this.ws = null;
    this.online = false;
    this.id = null;
    this.handlers = new Map();
    this.helloData = null;
    this.retry = 0;
    this.closedByUser = false;
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

  connect(helloData) {
    this.helloData = helloData;
    if (location.protocol === 'file:') {
      this.emit('status', { online: false });
      return;
    }
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws.onopen = () => {
      this.online = true;
      this.retry = 0;
      this.send('hello', typeof this.helloData === 'function' ? this.helloData() : this.helloData);
      this.emit('status', { online: true });
    };
    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') this.id = msg.id;
      this.emit(msg.t, msg);
    };
    this.ws.onclose = () => {
      const was = this.online;
      this.online = false;
      this.id = null;
      if (was) this.emit('status', { online: false });
      this.emit('disconnect', {});
      this.scheduleRetry();
    };
    this.ws.onerror = () => {};
  }

  scheduleRetry() {
    if (this.closedByUser) return;
    this.retry++;
    const delay = Math.min(15000, 2000 * this.retry);
    setTimeout(() => this.connect(this.helloData), delay);
  }

  send(t, data = {}) {
    if (!this.online || !this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ t, ...data }));
    return true;
  }
}
