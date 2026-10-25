/* mechanics/d2achievements/index.js — механика «Достижения D2» (ТЗ docs/CELESTIALS.md §5).
   Логики нет: список и условия — в content/d2-achievements.js, проверка —
   systems/d2-achievements.js, доска — board.js рядом.
   Множитель достижений идёт в скорость ОСЕЙ D2 (его читает systems/d2-growth.js),
   поэтому у механики НЕТ mult(): иначе второй мир качал бы M первого (ТЗ §9). */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'd2achievements',
    order: 10.5,             // после d2tree (10.4): коллекция закрывает список доков D2
    name: 'Достижения D2',
    short: 'Достижения',
    icon: 'trophy',
    scope: 'meta-d2',        // коллекция не сбрасывается ни Схлопыванием, ни D1
    noBulk: true,            // покупать нечего: панель массовых покупок не нужна
    lockHint: 'нужен Ярус 4 и 10 ⧜',
    hint: 'Достижения второго мира открываются сами, когда оси, Ξ и ⌬ проходят пороги. ' +
          'Каждое даёт +1% к скорости осей D2 навсегда.',

    isUnlocked(state) {
      return !!(G.d2 && typeof G.d2.unlocked === 'function' && G.d2.unlocked(state));
    },

    status(state) {
      if (!G.d2Achievements) return '0/0';
      return G.d2Achievements.status(state);
    },

    /* переменная для условий D1-достижений (движок собирает vars всех механик) */
    vars(state) {
      return { d2Achievements: G.d2Achievements ? G.d2Achievements.count(state) : 0 };
    }
  });
})(window.G = window.G || {});
