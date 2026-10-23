/* ui/combo.js — чип «КОМБО ⌘» рядом с главным числом (v0.20.0).
   Тап по числу копит серию; чип показывает серию и множитель, гаснет вместе с ней. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let el = null;
  let valEl = null;
  let multEl = null;
  let barEl = null;
  let shown = 0;

  function build() {
    valEl = G.h('span', { class: 'combo-val', text: '0' });
    multEl = G.h('span', { class: 'combo-mult', text: '×1.00' });
    barEl = G.h('div', { class: 'combo-bar-fill' });
    el = G.h('div', { class: 'combo-chip' }, [
      G.h('span', { class: 'combo-ico', text: '⌘' }),
      valEl,
      multEl,
      G.h('div', { class: 'combo-bar' }, [barEl])
    ]);
    const hero = document.getElementById('hero');
    if (hero) hero.appendChild(el);
    else document.body.appendChild(el);

    /* тап по самому числу — это и есть механика */
    const num = document.getElementById('heroN');
    if (num) {
      num.style.cursor = 'pointer';
      num.style.touchAction = 'manipulation';
      num.addEventListener('pointerdown', () => {
        const v = G.combo.tap(G.state);
        if (v === null) return;
        if (typeof G.animationsOff === 'function' && !G.animationsOff()) {
          num.classList.remove('tap');
          void num.offsetWidth;
          num.classList.add('tap');
        }
        S.update(G.state);
      });
    }
    return el;
  }

  const S = {
    mount() { build(); },

    update(state) {
      if (!state || !G.combo) return;
      if (!el) build();
      const v = G.combo.value(state);
      shown = v;
      const max = (G.content.combo && G.content.combo.maxCombo) || 12;
      valEl.textContent = v.toFixed(1);
      multEl.textContent = '×' + G.combo.mult(state).toFixed(2);
      barEl.style.width = Math.max(0, Math.min(1, v / max)) * 100 + '%';
      el.classList.toggle('on', v > 0.2);
      el.classList.toggle('hot', v >= max * 0.9);
    },

    /* для тестов/дебага */
    value() { return shown; }
  };

  G.ui.combo = S;
})(window.G = window.G || {});
