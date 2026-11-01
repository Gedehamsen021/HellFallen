// Teclado + mouse com pointer lock
export class Input {
  constructor(target) {
    this.target = target;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = new Set();
    this.mousePressed = new Set();
    this.mouseReleased = new Set();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.enabled = true;
    this.locked = false;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (this.isTyping(e)) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.locked) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
    this.fallback = false;
    document.addEventListener('pointerlockerror', () => {
      // navegador recusou capturar o mouse: joga mesmo assim, sem captura
      this.fallback = true;
      this.locked = true;
      if (this.onLockChange) this.onLockChange(true);
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (this.fallback && e.target && e.target.closest && e.target.closest('button, input, select, .pause-menu')) return;
      this.mouse.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      if (this.mouse.has(e.button)) this.mouseReleased.add(e.button);
      this.mouse.delete(e.button);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.fallback = false;
      this.locked = document.pointerLockElement === this.target;
      if (!this.locked) { this.mouse.clear(); this.keys.clear(); }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  lock() {
    if (this.locked) return;
    const fail = () => {
      if (this.locked) return;
      this.fallback = true;
      this.locked = true;
      if (this.onLockChange) this.onLockChange(true);
    };
    try {
      if (!this.target.requestPointerLock) { fail(); return; }
      const p = this.target.requestPointerLock();
      if (p && p.catch) p.catch(fail);
    } catch { fail(); }
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.fallback) {
      this.fallback = false;
      this.locked = false;
      this.keys.clear();
      this.mouse.clear();
      if (this.onLockChange) this.onLockChange(false);
    }
  }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  mouseDown(b) { return this.enabled && this.mouse.has(b); }
  mouseHit(b) { return this.enabled && this.mousePressed.has(b); }
  mouseUp(b) { return this.mouseReleased.has(b); }

  endFrame() {
    this.pressed.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}
