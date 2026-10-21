/* mechanics/sieve/board.js — доска «Решето»: текущее простое, найденные, ❖/с, апгрейды. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('sieve');
  const C = G.ui.components;
  const CHIPS = 24;   // сколько простых показывать вокруг курсора

  mech.board = {
    mount(root) {
      const tFound = C.tile('Найдено простых', 'accent');
      const tPrime = C.tile('Сейчас в решете', 'good');
      const tRate = C.tile('Скорость', '');
      const tMult = C.tile('Бонус к M', 'good');
      const bar = C.bar('до следующего простого');

      const chips = [];
      const chipRow = G.h('div', { class: 'prime-row' });
      for (let i = 0; i < CHIPS; i++) {
        const c = G.h('span', { class: 'prime-chip' });
        chips.push(c);
        chipRow.appendChild(c);
      }

      const rateEl = G.h('span', { class: 'block-label' });
      const upgrades = G.registry.upgradesOf('sieve').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tFound.el, tPrime.el, tRate.el, tMult.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Лента решета (простые числа по кругу)' }),
          chipRow,
          bar.el
        ]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: 'найдено += 0.40 · (1 + 0.25·lvl(sv_rate)) · dt' }),
          G.h('code', { text: '❖ += найдено · 2^lvl(sv_yield)' }),
          G.h('code', { text: 'M ×= 1 + 0.01 · найдено · lvl(sv_power)' })
        ]),
        C.section('Апгрейды решета', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = state.mech.sieve || { idx: 0, found: 0, acc: 0 };
          const total = G.primes.total;
          const cur = G.primes.nth(d.idx % total);

          tFound.set(String(d.found));
          tPrime.set(String(cur));
          tRate.set(G.fmt.num(state.stats.playtime ? mech.rate(state) : 0) + ' /с');
          tMult.set('×' + G.fmt.num(mech.mult(state), state.settings.numberFormat));
          bar.set(Math.max(0, Math.min(1, d.acc)), 'просеяно ' + (d.acc * 100).toFixed(0) + '%');

          for (let i = 0; i < CHIPS; i++) {
            const idx = d.idx + i;
            const p = G.primes.nth(idx % total);
            chips[i].textContent = String(p);
            chips[i].className = 'prime-chip' + (i === 0 ? ' reached' : '');
          }
          rateEl.textContent = 'круг: ' + (d.idx % total) + ' / ' + total;
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
