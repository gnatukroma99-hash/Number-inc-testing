/* mechanics/primefit/board.js — доска «Прайм-стайл». */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('primefit');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tQ = C.tile('Простых цифр', 'accent');
      const tMult = C.tile('Множитель', 'good');
      const tJack = C.tile('Джекпот (15/15)', '');
      const digits = C.digitRow(15);
      const bar = C.bar('сэмпл');

      const upgrades = G.registry.upgradesOf('primefit').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tQ.el, tMult.el, tJack.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Простые цифры подсвечены · 2, 3, 5, 7' }),
          digits.el,
          bar.el
        ]),
        C.section('Апгрейды', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const s = G.sampling.get(state);
          tQ.set(s.q + ' / ' + s.digits.length);
          tMult.set('×' + G.fmt.num(mech.mult(state), state.settings.numberFormat));
          tMult.setClass('tile good' + (s.q >= 6 ? ' glow' : ''));
          const jack = s.q === s.digits.length;
          tJack.set(jack ? 'АКТИВЕН' : '—');
          tJack.setClass('tile' + (jack ? ' glow good' : ''));
          digits.set(s.digits);
          bar.set(G.sampling.progress(state), 'сэмпл · ' + s.remaining.toFixed(1) + ' с');
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
