/* mechanics/measure/index.js — механика «Мера ⁿ» (Ярус 3, v0.34.0).
   Логика в systems/measure.js; здесь паспорт механики и хуки mult/spanMult/tick. */
(function (G) {
  'use strict';

  const cfg = () => G.content.measure;

  G.registry.addMechanic({
    id: 'measure',
    order: 8.08,
    name: 'Мера ⁿ',
    short: 'Мера',
    icon: 'chart',
    scope: 'meta',
    hint: cfg().hint,
    lockHint: 'нужен ПРОБОЙ (Ярус 3)',

    isUnlocked(state) { return G.measure.open(state); },

    tick(state, dt) { G.measure.tick(state, dt); },

    mult(state) { return G.measure.mult(state); },

    spanMult(state) { return G.measure.spanMult(state); },

    status(state) {
      const p = G.measure.snapshot(state);
      return 'ⁿ ' + p.text;
    },

    vars(state) {
      const p = G.measure.snapshot(state);
      return {
        measure: 1,
        measureLen: p.len,
        measureSum: p.sum,
        measureZeros: p.zeros,
        measurePrime: p.prime,
        measurePal: p.pal,
        measureRound: p.round,
        measureBeauty: G.measure.data(state).beautyCount || 0,
        measureMult: G.measure.mult(state)
      };
    }
  });
})(window.G = window.G || {});
