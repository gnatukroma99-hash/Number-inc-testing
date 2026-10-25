/* mechanics/patterns/index.js — механика «Паттерны» (v0.27.0).
   Читает мантиссу числа и ловит визуальные узоры (777, 4321, 12321). Кликать не надо:
   число растёт — узоры появляются сами и сразу дают буфф. Логика — systems/patterns.js. */
(function (G) {
  'use strict';

  const cfg = () => (G.content && G.content.patterns) || {};

  G.registry.addMechanic({
    id: 'patterns',
    order: 6.5,
    name: 'Паттерны узора',
    short: 'Паттерны',
    icon: 'recycle',
    scope: 'run',
    hint: 'Мантисса числа всё время разная. Иногда в ней складывается узор: 777, 4321, 12321. ' +
      'Игра ловит их сама (кликать не надо) и даёт буфф к M. Постоянный бонус — за каждый ' +
      'открытый тип узора.',
    lockHint: 'нужно 10 цифр (D ≥ 10)',

    isUnlocked(state) {
      return G.growth.D(state) >= (cfg().gateD || 10);
    },

    tick(state, dt) {
      G.patterns.tick(state, dt);
    },

    /* общий хук: множитель к M (постоянный бонус + буфф) */
    mult(state) {
      return G.patterns.mult(state);
    },

    vars(state) {
      const d = G.patterns.data(state);
      return { patternTypes: G.patterns.typesFound(state), patternTotal: d.total || 0 };
    },

    status(state) {
      const left = G.patterns.left(state);
      if (left > 0) return '×' + G.fmt.num(G.patterns.active(state).mult) + ' · ' + left.toFixed(1) + ' с';
      const d = G.patterns.data(state);
      return 'поймано ' + (d.total || 0) + ' · типов ' + G.patterns.typesFound(state) + '/' + (cfg().types || []).length;
    }
  });
})(window.G = window.G || {});
