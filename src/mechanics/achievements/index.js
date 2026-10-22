/* mechanics/achievements — доска «Достижения».
   Логики нет: список и условия — в content/achievements.js, проверка — systems/achievements.js.
   Механика только отдаёт бонус к M и статус для бейджа. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'achievements',
    order: 11,
    name: 'Достижения',
    short: 'Награды',
    icon: 'trophy',
    scope: 'meta',
    noBulk: true,          // тут нет апгрейдов — панель покупок не нужна
    hint: 'Открываются сами, когда в игре происходит важное. Каждое даёт +1% к M навсегда.',

    isUnlocked() {
      return true;
    },

    mult(state) {
      return G.achievements.mult(state);
    },

    status(state) {
      return '' + G.achievements.count(state) + '/' + G.achievements.total();
    }
  });
})(window.G = window.G || {});
