/* mechanics/digitsum/board.js — доска «Сумма цифр, брат». */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('digitsum');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tS = C.tile('Сумма значащих цифр', 'accent');
      const tMult = C.tile('Множитель от цифр', 'good');
      const tRho = C.tile('Цифровой корень ρ');
      const digits = C.digitRow(15);
      const bar = C.bar('сэмпл');

      const upgrades = G.registry.upgradesOf('digitsum').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tS.el, tMult.el, tRho.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Значащие цифры мантиссы' }),
          digits.el,
          bar.el
        ]),
        C.section('Апгрейды', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const s = G.sampling.get(state);
          tS.set(String(s.S));
          tMult.set('×' + G.fmt.num(mech.mult(state), state.settings.numberFormat));
          tRho.set(String(s.rho));
          tMult.setClass('tile good' + (mech.mult(state) > 1.5 ? ' glow' : ''));
          digits.set(s.digits);
          bar.set(G.sampling.progress(state), 'сэмпл · ' + s.remaining.toFixed(1) + ' с');
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
