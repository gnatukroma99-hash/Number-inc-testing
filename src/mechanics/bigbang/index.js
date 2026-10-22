/* mechanics/bigbang/index.js — механика-обёртка БОЛЬШОГО БУМА (второй престиж, Ярус 2).
   Логика — systems/bigbang.js, данные — content/tier2.js. Здесь только регистрация
   и строка статуса для дока. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'bigbang',
    order: 8,                     /* между автоматом (7) и перерождением (9) */
    name: 'БОЛЬШОЙ БУМ',
    short: 'БУМ',
    icon: 'burst',
    scope: 'run',                 /* сама механика без состояния; сброс забега делает perform() */
    hint: G.content.bigbang.hint,
    lockHint: 'нужно 300 цифр (N ≥ 1e300)',

    isUnlocked(state) {
      return G.growth.D(state) >= (G.content.bigbang.minD || 300) ||
        G.bigbang.wallPassed(state);
    },

    status(state) {
      const gain = G.bigbang.gain(state);
      if (gain > 0) return 'Δ +' + G.fmt.num(gain);
      return G.bigbang.wallPassed(state) ? 'стена снята' : 'Δ 0';
    },

    /* условия достижений видят счётчики БУМА */
    vars(state) {
      return {
        bangs: state.meta.bangs || 0,
        delta: state.res.delta || 0,
        wallPassed: G.bigbang.wallPassed(state) ? 1 : 0
      };
    }
  });
})(window.G = window.G || {});
