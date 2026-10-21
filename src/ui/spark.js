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
    document.body.appendChild(el);
    return el;
  }

  function place(seed) {
    /* простая псевдослучайная, но устойчивая точка по id искры */
    const a = (seed * 9301 + 49297) % 233280;
    const b = (seed * 4177 + 12345) % 233280;
    const x = 24 + (a / 233280) * 58;      /* 24…82 % по ширине */
    const y = 26 + (b / 233280) * 48;      /* 26…74 % по высоте */
    el.style.left = x.toFixed(1) + 'vw';
    el.style.top = y.toFixed(1) + 'vh';
  }

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
        el.querySelector('.spark-float-icon').textContent = now.icon || '✦';
        place(Math.floor((state.stats.playtime || 0) * 7) + now.id.length * 13);
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
