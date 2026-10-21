/* mechanics/shop/board.js — доска магазина «за само число». */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('shop');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tD = C.tile('Цифр в числе (D)', 'accent');
      const tSpent = C.tile('Потрачено цифр');
      const tLevels = C.tile('Предметов', 'good');

      const upgrades = G.registry.upgradesOf('shop').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tD.el, tSpent.el, tLevels.el]),
        G.h('div', { class: 'formula-card shop-rules' }, [
          G.h('div', { class: 'block-label', text: 'Как платить' }),
          G.h('code', { text: 'цена = base · growth^lvl  (в цифрах D)' }),
          G.h('code', { text: 'N_новое = 10 ^ (D − цена)' }),
          G.h('code', { text: 'нельзя опустить число ниже 2 цифр' })
        ]),
        C.section('Товары', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          tD.set(G.growth.displayD(state).toFixed(2));
          tSpent.set(mech.spentD(state).toFixed(2));
          tLevels.set(String(mech.status(state)));
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
