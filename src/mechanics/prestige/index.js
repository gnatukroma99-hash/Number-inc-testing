/* mechanics/prestige — доска первого перерождения.
   Ядра ◆ живут в ресурсе scope:'meta' и не сбрасываются никогда. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'prestige',
    order: 9,
    name: 'Перерождение',
    short: 'Перерождение',
    icon: '◆',
    scope: 'meta',            // у механики нет раундовых данных — ничего не сбрасываем
    noBulk: true,             // на доске нет апгрейдов
    hint: 'Перерождение сбрасывает N, ⌁ и раундовые апгрейды, но даёт ◆ Ядра — ' +
          'постоянный множитель к M. ❖ ПРАЙМ и авто-апгрейды сохраняются.',

    isUnlocked(state) {
      return G.growth.D(state) >= 8 || (state.res.cores || 0) > 0 || (state.meta.totalRuns || 0) > 0;
    },

    mult(state) {
      return G.prestige.mult(state);
    },

    status(state) {
      return '◆ ' + G.fmt.num(state.res.cores || 0);
    }
  });
})(window.G = window.G || {});
