/* ui/app.js — сборка приложения и подписка на смену состояния. */
(function (G) {
  /* ---------- v0.19.0: мелкое движение интерфейса (ripple, вспышки) ---------- */
  function initMotion() {
    /* ripple на больших кнопках: делегированный pointerdown, без кнопочных обработчиков */
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target && e.target.closest
        ? e.target.closest('.btn, .chrono-btn, .dup-btn, .dup-merge, .echo-btn, .slot-spin, .bigbang-btn')
        : null;
      if (!btn || btn.disabled) return;
      if (typeof G.animationsOff === 'function' && G.animationsOff()) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.2;
      const dot = document.createElement('span');
      dot.className = 'ui-ripple';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (e.clientX - r.left - size / 2) + 'px';
      dot.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    }, { passive: true });

    /* вспышка главного числа, когда оно реально выросло (не чаще 4 раз в секунду) */
    const numEl = document.getElementById('heroN');
    if (!numEl) return;
    let lastText = '';
    let lastAt = 0;
    const flash = () => {
      const txt = numEl.textContent || '';
      if (txt === lastText) return;
      lastText = txt;
      const now = Date.now();
      if (now - lastAt < 240) return;
      lastAt = now;
      if (typeof G.animationsOff === 'function' && G.animationsOff()) return;
      numEl.classList.remove('grow');
      void numEl.offsetWidth;
      numEl.classList.add('grow');
    };
    motionFlash = flash;
  }
  let motionFlash = null;
  let fxDockEl = null;

  'use strict';

  G.ui = G.ui || {};

  /* Применить новое состояние (старт / импорт / сброс) */
  G.applyState = function (state) {
    G.state = state;
    G.initResources(state);
    state.D = G.growth.D(state);
    if (!G.ui.mainNumber) return;
    G.ui.mainNumber.applySettings(state);
    document.body.classList.toggle('hide-formulas', !state.settings.scientificHints);
    if (G.ui.docks) G.ui.docks.refresh(state);
    G.bus.emit('state:applied', state);
  };

  const App = {
    init(state) {
      G.applyState(state);

      /* инициализация UI */
      G.ui.mainNumber.init();
      G.ui.mainNumber.applySettings(state);
      G.ui.docks.init(state);
      if (G.ui.spark) G.ui.spark.mount();
      if (G.ui.rift) G.ui.rift.mount();
      if (G.ui.cracks) G.ui.cracks.mount();
      if (G.ui.combo) G.ui.combo.mount();
      if (G.ui.background) G.ui.background.mount();
      if (G.ui.menu) G.ui.menu.init();
      if (G.ui.fx) G.ui.fx.init();
      G.ui.fxDock();
      initMotion();

      document.getElementById('btn-settings').addEventListener('click', () => {
        if (G.ui.settings.isOpen()) G.ui.settings.close();
        else G.ui.settings.open(G.state);
      });

      /* Escape закрывает модалку */
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') G.ui.settings.close();
        if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
          if (document.body.classList.contains('modal-open')) return;
          G.save.saveLocal(G.state);
          G.ui.toast('Сохранено', 'good', 1200);
        }
      });

      /* сохраняем при уходе со страницы */
      window.addEventListener('beforeunload', () => G.save.saveLocal(G.state));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) G.save.saveLocal(G.state);
      });
    },

    render(state) {
      G.ui.mainNumber.update(state);
      if (motionFlash) motionFlash();
      if (G.ui.spark) G.ui.spark.update(state);
      if (G.ui.rift) G.ui.rift.update(state);
      if (G.ui.cracks) G.ui.cracks.update(state);
      if (G.ui.combo) G.ui.combo.update(state);
      if (G.ui.hints) G.ui.hints.update(state);
      if (G.ui.boardhead) G.ui.boardhead.tick(state);
      if (G.ui.fx) G.ui.fx.update(state);
      G.ui.docks.update(state);
      if (G.ui.settings.isOpen()) {
        /* лёгкое обновление превью формата */
        G.ui.settings.updatePreview(state);
      }
    }
  };

  /* единый док плавающих событий (искра ✦, разлом ⌁⃠): не перекрывают доску */
  G.ui.fxDock = function () {
    if (fxDockEl && fxDockEl.parentNode) return fxDockEl;
    fxDockEl = G.h('div', { class: 'fx-dock', 'aria-live': 'polite' });
    document.body.appendChild(fxDockEl);
    return fxDockEl;
  };

  G.ui.app = App;
})(window.G = window.G || {});
