/* systems/turn.js — ОБОРОТ (Ярус 4): четвёртый престиж.
   Логика как у БУМА и ПРОБОЯ: canDo → gain → perform. Всё из данных content/turn.js.
   Ничего не нерфит: это размен «сейчас много цифр» → «навсегда выше старт». */
(function (G) {
  'use strict';

  const T = {
    cfg() { return (G.content && G.content.turn) || {}; },

    gain(state) {
      const c = T.cfg();
      const v = G.formula(c.gainFormula || '0', {
        D: G.growth.D(state),
        minD: c.minD !== undefined ? c.minD : 10000,
        turns: state.res.turns || 0,
        runs: state.meta.totalRuns || 0,
        breaks: state.meta.breaks || 0,
        cores: state.res.cores || 0,
        delta: state.res.delta || 0,
        psi: state.res.psi || 0
      });
      const base = isFinite(v) ? Math.floor(v) : 0;
      if (base <= 0) return 0;
      let mult = G.growth.upgProduct(state, 'turnGainMult');
      if (!isFinite(mult) || mult <= 0) mult = 1;
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.turnGainMult !== 'function') continue;
        const k = m.turnGainMult(state);
        if (isFinite(k) && k > 0) mult *= k;
      }
      const add = G.growth.upgSum(state, 'turnGainAdd');
      const total = Math.floor(base * mult + (isFinite(add) ? add : 0));
      return total > 0 ? total : 0;
    },

    canDo(state) { return T.gain(state) > 0; },

    tierOpen(state) {
      return (state.res.turns || 0) > 0 || G.growth.D(state) >= (T.cfg().minD || 10000);
    },

    /* стартовые цифры следующего забега (данные, с учётом апгрейда «Трамплин») */
    startDigits(state, turnsAfter) {
      const c = T.cfg();
      const turns = turnsAfter !== undefined ? turnsAfter : (state.res.turns || 0);
      /* переменные старта объявлены данными: startVars { имя → id узла } */
      const vars = { turns: turns, lvl: G.lvl(state, 'tr_start') };
      const sv = c.startVars || {};
      for (const k in sv) vars[k] = G.lvl(state, sv[k]);
      const v = G.formula(c.startFormula || '0', vars);
      if (!isFinite(v) || v <= 0) return 0;
      return Math.min(v, 1e300);
    },

    applyStart(state) {
      const d = T.startDigits(state);
      if (!(d > 0)) return 0;
      state.N = G.BN.fromLog10(d);
      state.D = d;
      state.disp = null;
      return d;
    },

    perform(state) {
      const gain = T.gain(state);
      if (gain <= 0) return 0;
      const c = T.cfg();

      state.res.turns = (state.res.turns || 0) + gain;
      state.meta.turnsTotal = (state.meta.turnsTotal || 0) + gain;
      state.meta.bestD = Math.max(state.meta.bestD || 0, G.growth.D(state));
      if (c.tier) state.meta.tier = c.tier;

      G.resetScopes(state, c.resetScopes || ['run', 'tier']);
      state.meta.totalRuns = (state.meta.totalRuns || 0) + 1;

      /* трамплин: после сброса поднимаем число до стартовых цифр */
      T.applyStart(state);

      G.bus.emit('turn:done', { gain: gain, turns: state.res.turns });
      return gain;
    }
  };

  G.turn = T;
})(window.G = window.G || {});
