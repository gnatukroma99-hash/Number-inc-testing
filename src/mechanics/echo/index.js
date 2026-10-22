/* mechanics/echo/index.js — ЭХО ⟲: лучшее число возвращается само, но ΔT медленнее.
   Данные — content/echo.js. Выбор «эхо ИЛИ скорость» — и есть суть механики. */
(function (G) {
  'use strict';

  const cfg = () => G.content.echo;

  const E = {
    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.echo) m.echo = { bought: false, on: false, gained: 0 };
      return m.echo;
    },

    bought(state) { return !!E.data(state).bought; },
    isOn(state) { return !!E.data(state).on; },

    buy(state) {
      const d = E.data(state);
      if (d.bought) return false;
      const c = cfg().cost || 12;
      if ((state.res.delta || 0) < c) return false;
      state.res.delta = Math.max(0, (state.res.delta || 0) - c);
      d.bought = true;
      d.on = true;
      return true;
    },

    toggle(state) {
      const d = E.data(state);
      if (!d.bought) return false;
      d.on = !d.on;
      return d.on;
    },

    /* сколько цифр в секунду даёт эхо (0, если выключено) */
    rate(state) {
      const d = E.data(state);
      if (!d.on) return 0;
      const c = cfg();
      const best = state.stats.bestD || 0;
      if (best <= 0) return 0;
      const flat = (c.ratePerSec || 0.0015) * best;
      /* не больше доли обычного роста: log10(M)/ΔT */
      const M = G.growth.M(state);
      const dt = Math.max(0.001, G.growth.dt(state));
      const organic = Math.log10(Math.max(1, M)) / dt;
      const cap = (c.maxShare || 0.5) * organic;
      const r = Math.min(flat, cap);
      return isFinite(r) && r > 0 ? r : 0;
    },

    /* применение эха за тик: D += rate·dt */
    tick(state, dt) {
      const r = E.rate(state);
      if (r <= 0) return 0;
      const add = r * (dt || 0);
      if (!(add > 0)) return 0;
      const d0 = G.growth.D(state);
      const d1 = d0 + add;
      state.N = G.BN.fromLog10(d1);
      state.D = d1;
      state.disp = null;
      if (d1 > (state.stats.bestD || 0)) state.stats.bestD = d1;
      const d = E.data(state);
      d.gained = (d.gained || 0) + add;
      return add;
    },

    restart(state) {
      if (state.mech) state.mech.echo = null;
    }
  };

  G.echo = E;

  G.registry.addMechanic({
    id: 'echo',
    order: 8.6,
    name: 'Эхо',
    short: 'Эхо',
    icon: '⟲',
    scope: 'tier',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    tick(state, dt) { E.tick(state, dt); },

    /* цена включённого эха: ΔT медленнее */
    dtMult(state) { return E.isOn(state) ? (cfg().dtMult || 1.15) : 1; },

    onReset(state) { E.restart(state); },

    status(state) {
      if (!E.isOn(state)) return E.bought(state) ? '⟲ выкл' : '⟲ ' + (cfg().cost || 12) + 'Δ';
      return '⟲ +' + E.rate(state).toFixed(2) + '/с';
    },

    vars(state) {
      return {
        echoOn: E.isOn(state) ? 1 : 0,
        echoGain: Math.floor(E.data(state).gained || 0)
      };
    }
  });
})(window.G = window.G || {});
