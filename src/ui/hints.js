/* ui/hints.js — полоска подсказки над доской (онбординг, v0.20.0).
   Берёт первую подходящую подсказку из content/hints.js, условия — строки-формулы. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let el = null;
  let textEl = null;
  let current = null;

  function build() {
    textEl = G.h('span', { class: 'hint-text' });
    el = G.h('div', { class: 'hint-bar' }, [
      G.h('span', { class: 'hint-ico', text: '💡' }),
      textEl,
      G.h('button', { class: 'hint-close', type: 'button', text: '×', title: 'Скрыть подсказки' })
    ]);
    el.querySelector('.hint-close').addEventListener('click', () => {
      G.state.settings.hints = false;
      S.update(G.state);
    });
    const main = document.getElementById('main');
    if (main && main.parentNode) main.parentNode.insertBefore(el, main);
    else document.body.appendChild(el);
    return el;
  }

  function vars(state) {
    if (G.achievements && G.achievements.vars) return G.achievements.vars(state);
    return { D: G.growth.D(state) };
  }

  const S = {
    update(state) {
      if (!state || !G.content.hints) return;
      if (state.settings && state.settings.hints === false) {
        if (el) el.classList.remove('on');
        return;
      }
      if (!el) build();
      const v = vars(state);
      let pick = null;
      for (const h of (G.content.hints.list || [])) {
        if (G.formula(h.cond, v)) { pick = h; break; }
      }
      if (!pick) { el.classList.remove('on'); return; }
      if (pick !== current) {
        current = pick;
        textEl.textContent = pick.text;
        el.classList.add('on');
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      } else if (!el.classList.contains('on')) {
        el.classList.add('on');
      }
    }
  };

  G.ui.hints = S;
})(window.G = window.G || {});
