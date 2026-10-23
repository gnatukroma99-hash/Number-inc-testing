/* ui/cracks.js — плавающая ТРЕЩИНА ⟁ (Ярус 3).
   Это не «кнопка», а осколок стекла: неровный силуэт (clip-path), светящийся шов,
   таймер-полоска и разлёт на три части при ударе. Позиция — случайная точка в игровом
   поле (трещины должны «находиться», а не стоять в углу).

   Логика — в systems/cracks.js; здесь только показ и тап. */
(function (G) {
  'use strict';

  let el = null;
  let label = null;
  let timer = null;
  let shard = null;
  let seedShown = -1;
  let lastLife = 0;

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* случайная точка в безопасной зоне: не под шапкой, не под доками и тостами */
  function placeRandom() {
    if (!el) return;
    const w = window.innerWidth || 1200;
    const h = window.innerHeight || 800;
    /* Рабочая зона: правая половина и середина экрана по высоте.
       Так трещина не садится поверх панели покупок сверху и не лезет под доки/тосты. */
    const x0 = w * 0.42;
    const x1 = w * 0.9;
    const y0 = h * 0.34;
    const y1 = h * 0.76;
    const x = rand(x0, Math.max(x0 + 1, x1));
    const y = rand(y0, Math.max(y0 + 1, y1));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    /* небольшой наклон — осколки не стоят ровно */
    el.style.setProperty('--tilt', rand(-14, 14).toFixed(1) + 'deg');
  }

  function ensure() {
    if (el) return el;

    shard = G.h('span', { class: 'crack-shard', 'aria-hidden': 'true' });
    const seam = G.h('span', { class: 'crack-seam', 'aria-hidden': 'true' });
    const glint = G.h('span', { class: 'crack-glint', 'aria-hidden': 'true' });
    shard.appendChild(glint);
    shard.appendChild(seam);
    /* три осколка: только для анимации удара */
    const pieces = G.h('span', { class: 'crack-pieces', 'aria-hidden': 'true' }, [
      G.h('i', { class: 'crack-piece p1' }),
      G.h('i', { class: 'crack-piece p2' }),
      G.h('i', { class: 'crack-piece p3' })
    ]);

    label = G.h('span', { class: 'crack-label' });
    timer = G.h('span', { class: 'crack-timer', 'aria-hidden': 'true' });

    el = G.h('button', { class: 'crack-float', type: 'button', title: 'Трещина — жми!' }, [shard, label, timer, pieces]);
    el.addEventListener('click', () => {
      const reward = G.cracks.crack(G.state);
      if (reward > 0) {
        G.ui.toast('⟁ Трещина сломана: +' + G.fmt.num(reward) + ' Ψ · плоскость ×' +
          G.cracks.spanMult(G.state).toFixed(3), 'good', 2600);
        el.classList.remove('shatter');
        void el.offsetWidth;
        el.classList.add('shatter');
        if (G.ui.fx && G.ui.fx.pop) G.ui.fx.pop(el, '⧉');
      }
      S.update(G.state);
    });

    const host = G.ui.fxDock ? G.ui.fxDock() : document.body;
    host.appendChild(el);
    return el;
  }

  const S = {
    mount() { ensure(); },

    update(state) {
      if (!state || !G.cracks) return;
      if (!G.cracks.visible(state)) {
        if (el) el.classList.remove('visible', 'shatter');
        seedShown = -1;
        return;
      }
      ensure();
      const d = G.cracks.data(state);
      /* новая трещина (новое зерно) — переезжает в случайную точку и «прорезается» */
      if (d.seed !== seedShown) {
        seedShown = d.seed;
        lastLife = G.cracks.life(state);
        placeRandom();
        el.classList.remove('visible');
        void el.offsetWidth;
        el.classList.add('visible');
      }
      const left = G.cracks.left(state);
      const life = Math.max(1, G.cracks.life(state));
      label.textContent = '⧉ +' + G.fmt.num(G.cracks.reward(state)) + ' Ψ';
      timer.style.transform = 'scaleX(' + Math.max(0, Math.min(1, left / life)).toFixed(3) + ')';
      el.classList.toggle('fading', left < 3.2);
    },

    /* для тестов */
    seed() { return seedShown; }
  };

  G.ui.cracks = S;
})(window.G = window.G || {});
