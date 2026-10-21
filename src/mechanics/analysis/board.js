/* mechanics/analysis/board.js — доска «Цифровой анализ». */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('analysis');
  const C = G.ui.components;

  function bfdMult(state, s) {
    const lvl = G.lvl(state, 'bfd');
    if (!lvl) return 1;
    return G.formula('1 + 0.5 * lvl * log10(1 + 1 / d1) / log10(2)', { lvl: lvl, d1: s.d1 });
  }
  function rhoMult(state, s) {
    const lvl = G.lvl(state, 'rho_root');
    return lvl ? G.formula('1 + 0.06 * rho * lvl', { lvl: lvl, rho: s.rho }) : 1;
  }
  function zMult(state, s) {
    const lvl = G.lvl(state, 'zero_leak');
    return lvl ? G.formula('1 + 0.03 * z * lvl', { lvl: lvl, z: s.z }) : 1;
  }

  mech.board = {
    mount(root) {
      const tD1 = C.tile('Первая цифра d1', 'accent');
      const tBf = C.tile('Бенфорд', 'good');
      const tRho = C.tile('Корень ρ / бонус');
      const tZ = C.tile('Нулей z / бонус');
      const tAll = C.tile('Итого от анализа', 'good');
      const digits = C.digitRow(15);
      const bar = C.bar('сэмпл');

      const upgrades = G.registry.upgradesOf('analysis').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tD1.el, tBf.el, tRho.el, tZ.el, tAll.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Мантисса: d1 · цифровой корень · нули' }),
          digits.el,
          bar.el
        ]),
        C.section('Апгрейды анализа', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const s = G.sampling.get(state);
          tD1.set(String(s.d1));
          tBf.set('×' + G.fmt.num(bfdMult(state, s)));
          tRho.set(s.rho + ' → ×' + G.fmt.num(rhoMult(state, s)));
          tZ.set(s.z + ' → ×' + G.fmt.num(zMult(state, s)));
          tAll.set('×' + G.fmt.num(mech.mult(state)));
          digits.set(s.digits);
          bar.set(G.sampling.progress(state), 'сэмпл · ' + s.remaining.toFixed(1) + ' с');
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
