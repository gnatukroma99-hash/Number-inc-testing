/* mechanics/cracks/index.js — механика «Трещины ⟁» (Ярус 3, v0.33.0).
   Логика в systems/cracks.js; здесь только паспорт механики и хук spanMult,
   чтобы сломанные трещины навсегда расширяли плоскость софткапа. */
(function (G) {
  'use strict';

  const cfg = () => G.content.cracks;

  G.registry.addMechanic({
    id: 'cracks',
    order: 8.06,
    name: 'Трещины',
    short: 'Трещины',
    icon: 'brick',
    scope: 'meta',
    hint: cfg().hint,
    lockHint: 'нужен ПРОБОЙ (стена 1e1000)',

    isUnlocked(state) { return G.cracks.open(state); },

    /* трещина спавнится сама — через общий цикл механик */
    tick(state, dt) { G.cracks.tick(state, dt); },

    /* каждая сломанная трещина расширяет плоскость навсегда */
    spanMult(state) { return G.cracks.spanMult(state); },

    status(state) {
      const left = G.cracks.left(state);
      if (left > 0) return '⟁ ' + Math.ceil(left) + ' с';
      return '⟁ ' + G.cracks.broken(state);
    },

    vars(state) {
      return {
        cracks: G.cracks.broken(state),
        crackLeft: G.cracks.left(state),
        crackReward: G.cracks.reward(state),
        crackSpan: G.cracks.spanMult(state)
      };
    }
  });
})(window.G = window.G || {});
