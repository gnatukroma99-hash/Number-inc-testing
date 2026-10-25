/* mechanics/d2collapse/index.js — механика «Схлопывание» (Измерение 2).
   Престиж D2: сбрасывает оси Ξ, Ξ и Boost, даёт ⌬ Эссенцию — вечную валюту D2.
   Логики здесь нет: считает systems/d2-collapse.js, рисует board.js. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'd2collapse',
    order: 10.1,
    name: 'Схлопывание',
    short: 'Схлопывание',
    icon: '⌬',
    scope: 'meta-d2',        // ⌬, апгрейды, связи и дерево Схлопывание не сбрасывает
    noBulk: true,            // апгрейды D2 — данные G.content.d2, а не записи реестра
    lockHint: 'нужен Ярус 4 и 10 ⧜',
    hint: 'Схлопывание сбрасывает оси Ξ, Ξ и Boost, но даёт ⌬ Эссенцию — вечную валюту ' +
          'второго измерения. Апгрейды, связи и дерево D2 остаются навсегда.',

    isUnlocked(state) {
      return !!(G.d2 && G.d2.unlocked(state));
    },

    status(state) {
      const res = state && state.d2 && state.d2.res;
      if (!res) return '⌬ 0';
      const ess = '⌬ ' + G.fmt.num(res.essence || 0);
      const gain = G.d2Collapse.gain(state);
      return gain > 0 ? ess + ' · +' + G.fmt.num(gain) : ess;
    }
  });
})(window.G = window.G || {});
