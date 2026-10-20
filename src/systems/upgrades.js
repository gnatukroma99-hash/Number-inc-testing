/* systems/upgrades.js — покупка и расчёт эффектов. Формулы — только из данных. */
(function (G) {
  'use strict';

  function costOf(u, lvl) {
    if (u.costFormula) {
      const c = G.formula(u.costFormula, { lvl: lvl });
      return isFinite(c) ? c : Number.MAX_VALUE;
    }
    const base = u.base || 1;
    const growth = u.growth || 2;
    const c = base * Math.pow(growth, lvl);
    return isFinite(c) ? c : Number.MAX_VALUE;
  }

  const U = {
    level(state, id) { return G.lvl(state, id); },

    cost(u, lvl) { return costOf(u, lvl); },

    /* текущая цена (для UI) */
    currentCost(state, u) { return costOf(u, G.lvl(state, u.id)); },

    isMaxed(state, u) { return G.lvl(state, u.id) >= u.max; },

    canBuy(state, u) {
      if (U.isMaxed(state, u)) return false;
      const price = costOf(u, G.lvl(state, u.id));
      return (state.res[u.res] || 0) >= price;
    },

    buy(state, u, times) {
      times = times || 1;
      let bought = 0;
      for (let i = 0; i < times; i++) {
        if (!U.canBuy(state, u)) break;
        const price = costOf(u, G.lvl(state, u.id));
        state.res[u.res] -= price;
        state.upg[u.id] = G.lvl(state, u.id) + 1;
        bought++;
      }
      if (bought) {
        G.bus.emit('upgrade:bought', { id: u.id, count: bought, level: G.lvl(state, u.id) });
      }
      return bought;
    },

    /* значение эффекта апгрейда по его формуле: vars = { lvl, D, S, q, prime, ... } */
    value(state, u) {
      if (typeof u.effect === 'function') return u.effect(state);
      if (!u.formula) return 0;
      const v = Object.assign(G.growth.vars(state), { lvl: G.lvl(state, u.id) });
      return G.formula(u.formula, v);
    },

    /* описание эффекта «как есть» для UI: lvl -> число */
    describe(u) {
      if (!u.formula) return '—';
      const v = G.formula(u.formula, { lvl: 0 });
      return u.desc || String(v);
    }
  };

  G.upgrades = U;
})(window.G = window.G || {});
