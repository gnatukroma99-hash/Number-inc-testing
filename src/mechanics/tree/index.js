/* mechanics/tree — доска «Дерево ◆». Логики здесь нет: узлы — это данные
   (content/tree.js), покупка — общий systems/upgrades.js (res: 'cores').
   Доска только рисует узлы по ярусам и показывает требования. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'tree',
    order: 10,
    name: 'Дерево ◆',
    short: 'Дерево',
    icon: '◆',
    scope: 'meta',
    lockHint: 'нужно ◆ хотя бы 1 (переродись)',
    hint: 'Куда тратить ◆ Ядра. Каждый узел — навсегда: темп, энергия, ' +
          'множители и автоматизация.',

    isUnlocked(state) {
      return (state.res.cores || 0) > 0 || (state.meta.totalRuns || 0) > 0;
    },

    /* сколько узлов куплено (для бейджа и плиток) */
    bought(state) {
      let n = 0;
      for (const u of G.registry.upgradesOf('tree')) if (G.lvl(state, u.id) > 0) n++;
      return n;
    },

    total() {
      return G.registry.upgradesOf('tree').length;
    },

    status(state) {
      return '◆ ' + G.fmt.num(state.res.cores || 0);
    }
  });
})(window.G = window.G || {});
