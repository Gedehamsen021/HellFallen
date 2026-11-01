import { Game } from './Game.js';

function showFatal(err) {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.remove('hide');
    const t = boot.querySelector('.boot-text');
    if (t) t.textContent = 'Erro ao iniciar: ' + (err && err.message ? err.message : err) + ' — seu navegador suporta WebGL?';
  }
}

try {
  window.game = new Game();
} catch (e) {
  showFatal(e);
}
