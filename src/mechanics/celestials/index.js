/* mechanics/celestials/index.js — HALL OF CELESTIALS (фаза 2, docs/CELESTIALS.md §3/§10).
   Механика без логики: список/испытания — content/celestials.js, проверка — systems/celestial-trials.js,
   счётчики — systems/celestials.js, доска — board.js рядом. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'celestials',
    order: 10.3,
    name: 'Hall of Celestials',
    short: 'Целестиалы',
    icon: 'star',
    scope: 'meta',           // сигилы/завершения вечные, не сбрасываются ни D1, ни D2
    noBulk: true,
    lockHint: 'нужно первое Схлопывание (D2)',
    hint: 'Восемь сущностей второго мира. Выполни испытание — предъяви его здесь и получи ' +
      'вечную награду-правило. Сигил ☉ остаётся навсегда.',

    isUnlocked(state) {
      return !!(G.celestials && typeof G.celestials.unlocked === 'function' && G.celestials.unlocked(state));
    },

    status(state) {
      return G.celestials && G.celestials.status ? G.celestials.status(state) : '☉ 0/8';
    },

    vars(state) {
      const p = G.celestialTrials && G.celestialTrials.progress
        ? G.celestialTrials.progress(state)
        : { done: 0, total: 0, sigils: 0 };
      return { celestials: p.done, celestialSigils: p.sigils };
    }
  });
})(window.G = window.G || {});
