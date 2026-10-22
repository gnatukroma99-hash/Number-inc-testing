/* mechanics/rift/index.js — РАЗЛОМ ⌁⃠: активное событие Яруса 2.
   Пока разлом открыт — M ×2 и ⌁ ×2. Тап по разлому продлевает его (+3 с, до 45). */
(function (G) {
  'use strict';

  const cfg = () => G.content.rift;

  const R = {
    rng: Math.random,
    setRng(fn) { R.rng = typeof fn === 'function' ? fn : Math.random; return R; },

    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.rift) {
        m.rift = {
          left: 0,
          nextIn: R.nextGap(),
          opened: 0,
          caught: 0,
          bestLeft: 0
        };
      }
      return m.rift;
    },

    nextGap() {
      const c = cfg();
      const a = c.gapMin || 100;
      const b = c.gapMax || 170;
      return a + R.rng() * Math.max(0, b - a);
    },

    visible(state) { return R.data(state).left > 0; },
    left(state) { return Math.max(0, R.data(state).left || 0); },

    /* открыть разлом сейчас (тик или тест) */
    open(state) {
      const c = cfg();
      const d = R.data(state);
      d.left = c.life || 15;
      d.bestLeft = Math.max(d.bestLeft || 0, d.left);
      d.nextIn = R.nextGap();
      d.opened = (d.opened || 0) + 1;
      G.bus.emit('rift:open', { life: d.left });
      return d.left;
    },

    /* тап по разлому: продлевает, но не больше maxLife */
    catchRift(state) {
      const c = cfg();
      const d = R.data(state);
      if (d.left <= 0) return 0;
      const before = d.left;
      d.left = Math.min(c.maxLife || 45, d.left + (c.extend || 3));
      d.caught = (d.caught || 0) + 1;
      d.bestLeft = Math.max(d.bestLeft || 0, d.left);
      return d.left - before;
    },

    tick(state, dt) {
      const d = R.data(state);
      if (d.left > 0) {
        d.left = Math.max(0, d.left - dt);
        return;
      }
      d.nextIn = Math.max(0, (d.nextIn || 0) - dt);
      if (d.nextIn <= 0) R.open(state);
    },

    mult(state) { return R.visible(state) ? (cfg().mult || 2) : 1; },
    energyMult(state) { return R.visible(state) ? (cfg().energyMult || 2) : 1; },

    restart(state) {
      if (state.mech) state.mech.rift = null;
    }
  };

  G.rift = R;

  G.registry.addMechanic({
    id: 'rift',
    order: 8.2,
    name: 'Разлом',
    short: 'Разлом',
    icon: '⌁',
    scope: 'tier',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    tick(state, dt) { R.tick(state, dt); },
    mult(state) { return R.mult(state); },
    energyMult(state) { return R.energyMult(state); },
    onReset(state) { R.restart(state); },

    status(state) {
      if (R.visible(state)) return '⌁⃠ открыт ' + Math.ceil(R.left(state)) + 'с';
      return '⌁⃠ ' + Math.ceil(R.data(state).nextIn) + 'с';
    },

    vars(state) {
      const d = R.data(state);
      return {
        riftsOpen: d.opened || 0,
        riftCaught: d.caught || 0,
        riftOn: R.visible(state) ? 1 : 0
      };
    }
  });
})(window.G = window.G || {});
