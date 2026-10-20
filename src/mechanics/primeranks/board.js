/* mechanics/primeranks/board.js — доска «Простые разряды» (ПРАЙМ). */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('primeranks');
  const C = G.ui.components;

  const SHOW_UP_TO = 100;   // сколько разрядов показывать на доске

  mech.board = {
    mount(root) {
      const tEarned = C.tile('Пройдено разрядов', 'accent');
      const tAvail = C.tile('❖ свободно', 'good');
      const tMult = C.tile('Множитель', 'good');
      const tNext = C.tile('Следующий разряд', '');
      const bar = C.bar('до следующего простого разряда');

      /* лента простых разрядов */
      const primes = G.primes.list(SHOW_UP_TO);
      const chips = primes.map((p) => G.h('span', { class: 'prime-chip', text: String(p) }));
      const chipRow = G.h('div', { class: 'prime-row' }, chips);

      const upgrades = G.registry.upgradesOf('primeranks').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tEarned.el, tAvail.el, tMult.el, tNext.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Простые разряды (D = log10 N)' }),
          chipRow,
          bar.el
        ]),
        C.section('Апгрейды за ❖', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = state.mech.primeranks || { lastIdx: 0, earned: 0 };
          const D = G.growth.D(state);
          tEarned.set(d.earned + ' / ' + G.primes.countUpTo(1000));
          tAvail.set(G.fmt.num(state.res.prime || 0, state.settings.numberFormat));
          tMult.set('×' + G.fmt.num(mech.mult(state), state.settings.numberFormat));

          /* следующий непройденный простой разряд */
          const nextPrime = primes.find((p) => p > D);
          if (nextPrime === undefined) {
            tNext.set('все пройдены');
            bar.set(1, 'дальше — новые ярусы');
          } else {
            const prev = d.lastIdx > 0 ? G.primes.nth(d.lastIdx - 1) : 0;
            const frac = (D - prev) / Math.max(1, nextPrime - prev);
            tNext.set('D = ' + nextPrime);
            bar.set(frac, 'D ' + D.toFixed(2) + ' → ' + nextPrime);
          }

          for (let i = 0; i < chips.length; i++) {
            chips[i].className = 'prime-chip' + (primes[i] <= D ? ' reached' : '');
          }
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
