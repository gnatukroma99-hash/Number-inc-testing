/* mechanics/pacts/index.js — СДЕЛКИ ✍: благословение + проклятие навсегда, одна активная.
   Данные — content/pacts.js. Логика отдаётся как G.pacts (для тестов без DOM). */
(function (G) {
  'use strict';

  const cfg = () => G.content.pacts;
  const list = () => cfg().list || [];

  function find(id) {
    const l = list();
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  const P = {
    rng: Math.random,
    setRng(fn) { P.rng = typeof fn === 'function' ? fn : Math.random; return P; },
    list: list,
    find: find,

    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.pacts) m.pacts = { offers: [], active: null, taken: 0, rerolls: 0, roll: 0 };
      if (!Array.isArray(m.pacts.offers)) m.pacts.offers = [];
      return m.pacts;
    },

    /* сила предложения: у каждого шаблона ±15 % случайности — одна и та же сделка бывает лучше/хуже */
    makeOffer(seedIdx) {
      const l = list();
      if (!l.length) return null;
      const tpl = l[Math.abs(seedIdx) % l.length];
      const k = 0.85 + 0.30 * P.rng();
      return { tpl: tpl.id, k: Math.round(k * 1000) / 1000 };
    },

    reroll(state, force) {
      const d = P.data(state);
      const c = cfg();
      if (!force) {
        if ((state.res.delta || 0) < (c.rerollCost || 2)) return null;
        state.res.delta = Math.max(0, (state.res.delta || 0) - (c.rerollCost || 2));
        d.rerolls = (d.rerolls || 0) + 1;
      }
      const n = c.offers || 3;
      d.offers = [];
      for (let i = 0; i < n; i++) {
        const o = P.makeOffer(Math.floor(P.rng() * list().length * 1000) + i);
        if (o) d.offers.push(o);
      }
      d.roll = (d.roll || 0) + 1;
      return d.offers;
    },

    /* принять сделку: старая (если была) снимается вместе с проклятием */
    accept(state, i) {
      const d = P.data(state);
      if (d.offers.length > (i || 0) && d.offers[i]) {
        d.active = d.offers[i];
        d.taken = (d.taken || 0) + 1;
        d.offers = [];
        return d.active;
      }
      const first = d.offers[0];
      d.active = first || null;
      if (first) { d.taken = (d.taken || 0) + 1; d.offers = []; }
      return d.active;
    },

    drop(state) {
      const d = P.data(state);
      const old = d.active;
      d.active = null;
      return old;
    },

    /* числовые эффекты активной сделки с учётом её силы k */
    effects(state) {
      const d = P.data(state);
      const out = { M: 1, energy: 1, dt: 1, speed: 0, active: null };
      if (!d.active) return out;
      const tpl = find(d.active.tpl);
      if (!tpl) return out;
      const k = (d.active.k || 1) * (tpl.scale || 1);
      out.active = tpl;
      const plus = tpl.plus || {};
      const minus = tpl.minus || {};
      if (plus.M) out.M *= 1 + plus.M * k;
      if (plus.energy) out.energy *= 1 + plus.energy * k;
      if (plus.speed) out.speed += plus.speed * k;
      if (plus.dt) out.dt *= Math.pow(plus.dt, k);
      if (minus.M) out.M *= Math.max(0.15, 1 - minus.M * k);
      if (minus.energy) out.energy *= Math.max(0.15, 1 - minus.energy * k);
      if (minus.speed) out.speed -= minus.speed * k;
      if (minus.dt) out.dt *= Math.pow(minus.dt, k);
      return out;
    },

    restart(state) {
      if (state.mech) state.mech.pacts = null;
    }
  };

  G.pacts = P;

  G.registry.addMechanic({
    id: 'pacts',
    order: 8.8,
    name: 'Сделки',
    short: 'Сделки',
    icon: '✍',
    scope: 'tier',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    mult(state) { return P.effects(state).M; },
    dtMult(state) { return P.effects(state).dt; },
    energyMult(state) { return P.effects(state).energy; },
    speedBonus(state) { return P.effects(state).speed; },
    onReset(state) { P.restart(state); },

    status(state) {
      const e = P.effects(state);
      return e.active ? '✍ ' + e.active.name : '✍ нет';
    },

    vars(state) {
      const e = P.effects(state);
      return { pact: e.active ? 1 : 0, pacts: P.data(state).taken || 0 };
    }
  });
})(window.G = window.G || {});
