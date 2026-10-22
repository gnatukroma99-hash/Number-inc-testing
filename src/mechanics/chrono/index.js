/* mechanics/chrono/index.js — ХРОНО ⏱: сжатие времени за Δ (активная механика).
   Движок спрашивает у механик общий хук timeScale(state) — см. systems/timescale.js. */
(function (G) {
  'use strict';

  const cfg = () => G.content.chrono;

  const Ch = {
    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.chrono) m.chrono = { left: 0, cd: 0, used: 0 };
      return m.chrono;
    },

    left(state) { return Math.max(0, Ch.data(state).left || 0); },
    cooldown(state) { return Math.max(0, Ch.data(state).cd || 0); },

    ready(state) {
      return Ch.cooldown(state) <= 0 && (state.res.delta || 0) >= (cfg().cost || 10);
    },

    start(state) {
      if (!Ch.ready(state)) return null;
      const c = cfg();
      const d = Ch.data(state);
      state.res.delta = Math.max(0, (state.res.delta || 0) - (c.cost || 10));
      d.left = c.duration || 20;
      d.cd = (c.duration || 20) + (c.cooldown || 90);
      d.used = (d.used || 0) + 1;
      G.bus.emit('chrono:start', { scale: c.scale || 3, duration: d.left });
      return d.left;
    },

    tick(state, dt) {
      const d = Ch.data(state);
      if (d.left > 0) d.left = Math.max(0, d.left - dt);
      if (d.cd > 0) d.cd = Math.max(0, d.cd - dt);
    },

    /* общий хук движка: во сколько раз ускоряем мир */
    timeScale(state) {
      return Ch.left(state) > 0 ? (cfg().scale || 3) : 1;
    },

    restart(state) {
      if (state.mech) state.mech.chrono = null;
    }
  };

  G.chrono = Ch;

  G.registry.addMechanic({
    id: 'chrono',
    order: 8.4,
    name: 'Хроно',
    short: 'Хроно',
    icon: '⏱',
    scope: 'tier',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    tick(state, dt) { Ch.tick(state, dt); },
    timeScale(state) { return Ch.timeScale(state); },
    onReset(state) { Ch.restart(state); },

    status(state) {
      const l = Ch.left(state);
      if (l > 0) return '⏱ ×' + (cfg().scale || 3) + ' ' + Math.ceil(l) + 'с';
      const cd = Ch.cooldown(state);
      return cd > 0 ? '⏱ ' + Math.ceil(cd) + 'с' : '⏱ готов';
    },

    vars(state) {
      return { chronoUsed: Ch.data(state).used || 0, chronoOn: Ch.left(state) > 0 ? 1 : 0 };
    }
  });
})(window.G = window.G || {});
