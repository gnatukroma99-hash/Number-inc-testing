/* mechanics/d2axes/index.js — механика «Оси Ξ» (Измерение 2, v0.36.0).
   Паспорт доски: id, порядок, разблокировка, бейдж, переменные для условий.
   Логика — systems/d2-growth.js, данные — content/d2.js.
   Апгрейдов у механики нет намеренно: D2-апгрейды живут в content/d2.js и читаются
   системами (G.d2Collapse/G.d2Links), а не реестром этой доски. */
(function (G) {
  'use strict';

  /* сумма уровней всех осей (тот же Σ, что `lvlSum` в d2-growth) — только для бейджа */
  function axisLvlSum(state) {
    const axes = (state && state.d2 && state.d2.axes) || [];
    let n = 0;
    for (const a of axes) {
      if (a && typeof a.lvl === 'number' && isFinite(a.lvl)) n += a.lvl;
    }
    return n;
  }

  function xi(state) {
    const v = state && state.d2 && state.d2.res && state.d2.res.axis;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  G.registry.addMechanic({
    id: 'd2axes',
    order: 10.1,
    name: 'Оси Ξ',
    short: 'Оси Ξ',
    icon: 'grain',
    scope: 'meta-d2',
    /* массовая покупка у осей своя (G.d2Growth.buyAxis), общая панель upgrades.js не подходит */
    noBulk: true,
    lockHint: 'нужен Ярус 4 и 10 ⧜',
    hint: 'Восемь осей D2: каждая качает Ξ и объём M₂. Уровни осей покупаются за Ξ.',

    /* система D2 подключается отдельным файлом — без неё доска закрыта, а не падает */
    isUnlocked(state) {
      return !!(G.d2 && typeof G.d2.unlocked === 'function' && G.d2.unlocked(state));
    },

    status(state) {
      return 'Ξ ' + G.fmt.num(Math.floor(xi(state)));
    },

    vars(state) {
      const d2 = (state && state.d2) || {};
      const d = d2.D;
      return {
        d2Xi: xi(state),
        d2D: (typeof d === 'number' && isFinite(d)) ? d : 0,
        d2Axes: axisLvlSum(state),
        d2Boost: (typeof d2.boost === 'number' && isFinite(d2.boost)) ? d2.boost : 0
      };
    }
  });
})(window.G = window.G || {});
