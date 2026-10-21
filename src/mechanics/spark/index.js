/* mechanics/spark — «Золотая искра» ✦: активный контент между перерождениями.
   Логика в systems/spark.js, данные в content/spark.js. Здесь только механика-обёртка:
   тик таймеров + временные буффы (mult / dtMult), которые growth.M собирает автоматически. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'spark',
    order: 0,                     // первая в списке: работает всегда
    name: 'Золотая искра',
    short: 'Искра',
    icon: '✦',
    scope: 'run',                 // таймеры/буффы сбрасываются перерождением
    noBulk: true,
    lockHint: 'нужно 3 цифры (N ≥ 1000)',
    hint: G.content.spark.hint,

    isUnlocked(state) {
      return G.growth.D(state) >= 3;
    },

    tick(state, dt) {
      G.spark.tick(state, dt);
    },

    mult(state) {
      return G.spark.mult(state);
    },

    dtMult(state) {
      return G.spark.dtMult(state);
    },

    onReset(state) {
      G.spark.onReset(state);
    },

    status(state) {
      const now = G.spark.current(state);
      if (now) return now.icon + ' лови!';
      return '✦' + Math.ceil(G.spark.nextIn(state)) + 'с';
    }
  });
})(window.G = window.G || {});
