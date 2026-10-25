/* mechanics/d2links/index.js — механика «Связи» (Измерение 2).
   Постоянные бонусы D1 ↔ D2. Логика — systems/d2-links.js; механика только
   отдаёт общий множитель M для D1 (до открытия D2 он равен 1) и строку бейджа. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'd2links',
    order: 10.2,
    name: 'Связи',
    short: 'Связи',
    icon: 'link',
    scope: 'meta-d2',        // купленные связи не сбрасываются ни Схлопыванием, ни D1
    noBulk: true,            // связи — данные G.content.d2.links, а не записи реестра
    lockHint: 'нужен Ярус 4 и 10 ⧜',
    hint: 'Связи — мосты между мирами: D1 даёт D2 стартовый рывок, D2 возвращает ' +
          'множитель к M первого мира. Покупаются за ⌬ и не сбрасываются.',

    isUnlocked(state) {
      return !!(G.d2 && G.d2.unlocked(state));
    },

    /* D2 → D1: множитель к M (до открытия D2 и без связей — ровно 1) */
    mult(state) {
      return G.d2Links.d1Mult(state);
    },

    status(state) {
      if (!(G.d2 && G.d2.unlocked(state))) return 'мосты закрыты';
      return 'D1 ×' + G.fmt.num(G.d2Links.d1Mult(state));
    }
  });
})(window.G = window.G || {});
