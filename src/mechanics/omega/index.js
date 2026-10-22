/* mechanics/omega/index.js — КРИСТАЛЛ Ω: финальная валюта и ПРАВИЛА МИРА.
   Ω копится пассивно, правила — разовые покупки, которые меняют поведение других механик.
   Механики спрашивают G.omega.has(state, 'w_...') и подстраивают свои числа. */
(function (G) {
  'use strict';

  const cfg = () => G.content.omega;

  const O = {
    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.omega) m.omega = { omega: 0, rules: [], bought: 0 };
      if (!Array.isArray(m.omega.rules)) m.omega.rules = [];
      return m.omega;
    },

    balance(state) { return Math.max(0, O.data(state).omega || 0); },

    /* Ω в секунду по данным */
    rate(state) {
      const v = G.formula(cfg().rateFormula || '0', {
        bestD: state.stats.bestD || 0,
        bangs: state.meta.bangs || 0,
        delta: state.res.delta || 0,
        cores: state.res.cores || 0
      });
      return isFinite(v) && v > 0 ? v : 0;
    },

    tick(state, dt) {
      const r = O.rate(state);
      if (r <= 0) return 0;
      const d = O.data(state);
      d.omega = (d.omega || 0) + r * (dt || 0);
      return r;
    },

    rules() { return cfg().rules || []; },
    rule(id) {
      const l = O.rules();
      for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
      return null;
    },

    /* куплено ли правило */
    has(state, id) { return O.data(state).rules.indexOf(id) >= 0; },

    canBuy(state, id) {
      const r = O.rule(id);
      if (!r || O.has(state, id)) return false;
      return O.balance(state) >= (r.cost || 0);
    },

    buy(state, id) {
      if (!O.canBuy(state, id)) return false;
      const r = O.rule(id);
      const d = O.data(state);
      d.omega = Math.max(0, d.omega - (r.cost || 0));
      d.rules.push(id);
      d.bought = (d.bought || 0) + 1;
      G.bus.emit('omega:rule', { id: id });
      return true;
    },

    /* --- значения правил для других механик --- */
    slotPity(state, base) {
      return O.has(state, 'w_pity') ? Math.min(base, 5) : base;
    },
    sparkGapMult(state) {
      return O.has(state, 'w_spark') ? 0.5 : 1;
    },
    chronoScale(state, base) {
      return O.has(state, 'w_chrono') ? Math.max(base, 5) : base;
    },
    coreGainMult(state) { return O.has(state, 'w_core') ? 1.5 : 1; },
    deltaGainMult(state) { return O.has(state, 'w_delta') ? 1.5 : 1; },

    restart(state) { if (state.mech) state.mech.omega = null; }
  };

  G.omega = O;

  G.registry.addMechanic({
    id: 'omega',
    order: 9.5,
    name: 'Кристалл Ω',
    short: 'Ω',
    icon: 'Ω',
    scope: 'meta',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    tick(state, dt) { O.tick(state, dt); },
    coreGainMult(state) { return O.coreGainMult(state); },
    deltaGainMult(state) { return O.deltaGainMult(state); },
    onReset(state) { O.restart(state); },

    status(state) {
      return 'Ω ' + O.balance(state).toFixed(1) + ' · ' + O.data(state).rules.length + '/' + O.rules().length;
    },

    vars(state) {
      return { omega: Math.floor(O.balance(state)), omegaRules: O.data(state).rules.length };
    }
  });
})(window.G = window.G || {});
