/* mechanics/duplicator/index.js — ДУБЛИКАТОР ⧉: тень числа и слияние.
   Данные — content/duplicator.js. Логика отдаётся как G.duplicator (тесты без DOM). */
(function (G) {
  'use strict';

  const cfg = () => G.content.duplicator;

  const D = {
    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.duplicator) {
        m.duplicator = { bought: false, on: false, shadow: 0, penalty: 0, merges: 0, best: 0 };
      }
      return m.duplicator;
    },

    bought(state) { return !!D.data(state).bought; },
    isOn(state) { return !!D.data(state).on; },
    shadow(state) { return Math.max(0, D.data(state).shadow || 0); },
    penalty(state) { return Math.max(0, D.data(state).penalty || 0); },

    buy(state) {
      const d = D.data(state);
      if (d.bought) return false;
      const c = cfg().cost || 15;
      if ((state.res.delta || 0) < c) return false;
      state.res.delta = Math.max(0, (state.res.delta || 0) - c);
      d.bought = true;
      d.on = true;
      return true;
    },

    toggle(state) {
      const d = D.data(state);
      if (!d.bought) return false;
      d.on = !d.on;
      return d.on;
    },

    /* обычный рост D в секунду (цифр/с) — то же, что даёт движок */
    organic(state) {
      const M = G.growth.M(state);
      const dt = Math.max(0.001, G.growth.dt(state));
      const v = Math.log10(Math.max(1, M)) / dt;
      return isFinite(v) && v > 0 ? v : 0;
    },

    /* сколько цифр в секунду копит тень */
    rate(state) {
      if (!D.isOn(state)) return 0;
      return D.organic(state) * (cfg().shadowRate || 0.2);
    },

    tick(state, dt) {
      const d = D.data(state);
      if (d.penalty > 0) d.penalty = Math.max(0, d.penalty - (dt || 0));
      if (!d.on) return 0;
      const cap = cfg().capDigits || 40;
      if (d.shadow >= cap) return 0;
      const add = D.rate(state) * (dt || 0);
      if (!(add > 0)) return 0;
      d.shadow = Math.min(cap, d.shadow + add);
      if (d.shadow > (d.best || 0)) d.best = d.shadow;
      return add;
    },

    /* слияние: D += тень × mergeShare, тень в ноль, штраф ΔT */
    merge(state) {
      const c = cfg();
      const d = D.data(state);
      const shadow = Math.max(0, d.shadow || 0);
      if (shadow <= 0) return 0;
      const add = shadow * (c.mergeShare || 2);
      const dNow = G.growth.D(state);
      const dNew = dNow + add;
      state.N = G.BN.fromLog10(dNew);
      state.D = dNew;
      state.disp = null;
      if (dNew > (state.stats.bestD || 0)) state.stats.bestD = dNew;
      d.shadow = 0;
      d.merges = (d.merges || 0) + 1;
      d.penalty = c.penaltyTime || 20;
      G.bus.emit('duplicator:merge', { add: add });
      return add;
    },

    mult(state) { return D.isOn(state) ? (cfg().multWhileShadow || 0.6) : 1; },
    dtMult(state) { return D.penalty(state) > 0 ? (cfg().penaltyDt || 1.25) : 1; },

    restart(state) { if (state.mech) state.mech.duplicator = null; }
  };

  G.duplicator = D;

  G.registry.addMechanic({
    id: 'duplicator',
    order: 8.1,
    name: 'Дубликатор',
    short: 'Дубликатор',
    icon: '⧉',
    scope: 'tier',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    tick(state, dt) { D.tick(state, dt); },
    mult(state) { return D.mult(state); },
    dtMult(state) { return D.dtMult(state); },
    onReset(state) { D.restart(state); },

    status(state) {
      if (!D.bought(state)) return '⧉ ' + (cfg().cost || 15) + 'Δ';
      if (D.penalty(state) > 0) return '⧉ штраф ' + Math.ceil(D.penalty(state)) + 'с';
      return D.isOn(state) ? '⧉ ' + D.shadow(state).toFixed(1) + ' цифр' : '⧉ выкл';
    },

    vars(state) {
      const d = D.data(state);
      return { dupShadow: Math.floor(d.shadow || 0), dupMerges: d.merges || 0 };
    }
  });
})(window.G = window.G || {});
