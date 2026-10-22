/* mechanics/chrono/board.js — доска «Хроно ⏱»: кнопка сжатия времени за Δ. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('chrono');
  const C = G.ui.components;
  const CFG = G.content.chrono;

  mech.board = {
    mount(root) {
      const tState = C.tile('Сжатие', 'accent');
      const tCd = C.tile('Перезарядка', '');
      const tDelta = C.tile('Δ осколки', 'good');
      const tSpeed = C.tile('Скорость мира', '');
      const bar = C.bar('сжатие');

      const btn = G.h('button', { class: 'btn chrono-btn', type: 'button' });
      btn.addEventListener('click', () => {
        const left = G.chrono.start(G.state);
        if (left) G.ui.toast('⏱ Сжатие времени: ×' + CFG.scale + ' на ' + left + ' с', 'good', 3200);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tState.el, tCd.el, tDelta.el, tSpeed.el]),
        btn,
        bar.el
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const left = G.chrono.left(state);
          const cd = G.chrono.cooldown(state);
          const on = left > 0;
          tState.set(on ? '×' + CFG.scale : 'выкл');
          tCd.set(cd > 0 ? Math.ceil(cd) + ' с' : 'готова');
          tDelta.set('Δ ' + G.fmt.num(state.res.delta || 0));
          tSpeed.set('×' + (on ? CFG.scale : 1));
          const ready = G.chrono.ready(state);
          btn.disabled = !ready;
          btn.textContent = on ? 'ИДЁТ · ' + Math.ceil(left) + ' с'
            : (cd > 0 ? 'ПЕРЕЗАРЯДКА · ' + Math.ceil(cd) + ' с' : 'СЖАТЬ ВРЕМЯ · ' + CFG.cost + ' Δ');
          bar.set(on ? left / (CFG.duration || 20) : 0,
            on ? '×' + CFG.scale + ' ещё ' + Math.ceil(left) + ' с' : 'ожидание');
        }
      };
    }
  };
})(window.G = window.G || {});
