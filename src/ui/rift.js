/* ui/rift.js — плавающий разлом ⌁⃠ поверх игры (как искра, но другое событие).
   Пока разлом открыт — M и ⌁ удвоены. Тап продлевает разлом. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let el = null;
  let label = null;
  let shown = false;

  function ensure() {
    if (el) return el;
    el = G.h('button', { class: 'rift-float', type: 'button', title: 'Разлом — жми!' });
    label = G.h('span', { class: 'rift-float-label' });
    el.appendChild(G.h('span', { class: 'rift-float-icon', text: '⌁⃠' }));
    el.appendChild(label);
    el.addEventListener('click', () => {
      const add = G.rift.catchRift(G.state);
      if (add > 0) {
        G.ui.toast('⌁⃠ Разлом продлён на ' + add.toFixed(0) + ' с', 'good', 2200);
        el.classList.remove('popped');
        void el.offsetWidth;
        el.classList.add('popped');
      }
      S.update(G.state);
    });
    document.body.appendChild(el);
    return el;
  }

  function place(seed) {
    const a = (seed * 7919 + 104729) % 233280;
    const b = (seed * 3571 + 6151) % 233280;
    el.style.left = (10 + (a / 233280) * 76).toFixed(1) + 'vw';
    el.style.top = (48 + (b / 233280) * 34).toFixed(1) + 'vh';
  }

  const S = {
    mount() { ensure(); },

    update(state) {
      if (!state || !G.rift) return;
      const open = G.rift.visible(state);
      if (!open) {
        if (el) el.classList.remove('visible');
        shown = false;
        return;
      }
      ensure();
      if (!shown) {
        place(Math.floor((state.stats.playtime || 0) * 3) + 17);
        shown = true;
        el.classList.add('visible');
      }
      label.textContent = 'РАЗЛОМ · M ×' + (G.content.rift.mult || 2) + ' · +' +
        (G.content.rift.extend || 3) + ' с';
      const left = G.rift.left(state);
      el.classList.toggle('fading', left < 4);
    }
  };

  G.ui.rift = S;
})(window.G = window.G || {});
