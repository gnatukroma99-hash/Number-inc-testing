/* mechanics/breakthrough/index.js — механика «ПРОБОЙ» (Ярус 3). */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'breakthrough',
    order: 8.05,
    name: 'ПРОБОЙ',
    short: 'ПРОБОЙ',
    icon: 'burst',
    scope: 'run',
    hint: G.content.breakthrough.hint,
    lockHint: 'нужно 1000 цифр (N ≥ 1e1000)',

    isUnlocked(state) {
      return G.growth.D(state) >= (G.content.breakthrough.minD || 1000) ||
        G.breakthrough.wallPassed(state);
    },

    status(state) {
      const gain = G.breakthrough.gain(state);
      if (gain > 0) return 'Ψ +' + G.fmt.num(gain);
      return G.breakthrough.wallPassed(state) ? 'стена 1e1000 снята' : 'Ψ 0';
    },

    vars(state) {
      return {
        breaks: state.meta.breaks || 0,
        psi: Math.floor(state.res.psi || 0),
        wall1000: G.breakthrough.wallPassed(state) ? 1 : 0
      };
    }
  });
})(window.G = window.G || {});
