/* ui/spark.js — плавающая «золотая искра» ✦ поверх игры.
   Кнопка появляется, когда systems/spark говорит «искра на экране», и исчезает по таймеру.
   Позиция — случайная точка в правой/центральной части экрана, чтобы не мешать шапке. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let el = null;
  let label = null;
  let shownId = null;

  function ensure() {
    if (el) return el;
    el = G.h('button', { class: 'spark-float', type: 'button', title: 'Поймать искру' });
    label = G.h('span', { class: 'spark-float-label' });
    el.appendChild(G.h('span', { class: 'spark-float-icon', text: '✦' }));
    el.appendChild(label);
    el.addEventListener('click', () => {
      const t = G.spark.catchSpark(G.state);
      if (t) {
        G.ui.toast('✦ ' + t.name + ': ' + t.text, 'good', 2600);
        el.classList.remove('popped');
        void el.offsetWidth;
        el.classList.add('popped');
      }
      S.update(G.state);
    });
    const host = G.ui.fxDock ? G.ui.fxDock() : document.body;
    host.appendChild(el);
    return el;
  }

  function place() { /* позиция задаётся контейнером .fx-dock */ }

  const S = {
    mount() { ensure(); },

    update(state) {
      if (!state || !G.spark) return;
      const now = G.spark.current(state);
      if (!now) {
        if (el) el.classList.remove('visible');
        shownId = null;
        return;
      }
      ensure();
      const rush = G.spark.rush(state);
      el.classList.toggle('rush', rush.active);
      const id = now.id + ':' + Math.ceil(G.spark.data(state).left);
      if (shownId !== now.id || !el.classList.contains('visible')) {
        el.style.setProperty('--spark', rush.active ? '#ff7ad9' : (now.color || '#ffd166'));
        G.ui.icons.set(el.querySelector('.spark-float-icon'), now.icon || 'sparkle');
        place();
        shownId = now.id;
        el.classList.add('visible');
      }
      label.textContent = rush.active
        ? 'РАЖ ' + rush.streak + '/' + rush.need + ' — жми!'
        : now.name + ' — жми!';
    }
  };

  G.ui.spark = S;
})(window.G = window.G || {});
