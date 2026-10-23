/* mechanics/turn/index.js — механика «ОБОРОТ ⧜» (Ярус 4, v0.30.0).
   Четвёртый слой прогресса: сворачивает число в ⧜ Обороты и поднимает трамплин.
   Сама ничего не считает — логика в systems/turn.js, апгрейды в content/turn.js. */
(function (G) {
  'use strict';

  const cfg = () => G.content.turn;

  G.registry.addMechanic({
    id: 'turn',
    order: 8.07,
    name: 'ОБОРОТ',
    short: 'ОБОРОТ',
    icon: 'cycle',
    scope: 'run',
    hint: cfg().hint,
    lockHint: 'нужно 10000 цифр (N ≥ 1e10000)',

    isUnlocked(state) {
      return G.turn.tierOpen(state);
    },

    status(state) {
      const gain = G.turn.gain(state);
      if (gain > 0) return '⧜ +' + G.fmt.num(gain);
      return '⧜ ' + G.fmt.num(Math.floor(state.res.turns || 0));
    },

    vars(state) {
      return {
        turns: Math.floor(state.res.turns || 0),
        turnStart: G.turn.startDigits(state),
        turnGain: G.turn.gain(state)
      };
    }
  });
})(window.G = window.G || {});
