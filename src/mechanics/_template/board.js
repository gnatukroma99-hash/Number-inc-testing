/* mechanics/_template/board.js — ШАБЛОН доски. DOM строится один раз, update() меняет только текст. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('template');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tA = C.tile('Показатель', 'accent');
      const tB = C.tile('Множитель', 'good');
      const bar = C.bar('прогресс');

      const upgrades = G.registry.upgradesOf('template').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tA.el, tB.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Визуал механики' }),
          bar.el
        ]),
        C.section('Апгрейды', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = mech.data(state);
          tA.set(d.counter.toFixed(1));
          tB.set('×' + G.fmt.num(mech.mult(state), state.settings.numberFormat));
          bar.set((d.counter % 10) / 10, 'цикл');
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
