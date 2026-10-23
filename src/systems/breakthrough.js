/* systems/breakthrough.js — ПРОБОЙ (Ярус 3): третий престиж.
   Логика как у БУМА: canDo → gain → perform. Всё из данных content/tier3.js. */
(function (G) {
  'use strict';

  const B = {
    cfg() { return (G.content && G.content.breakthrough) || {}; },

    gain(state) {
      const c = B.cfg();
      const v = G.formula(c.gainFormula || 'pow(max(0, D - 1000), 0.85)', {
        D: G.growth.D(state),
        minD: c.minD !== undefined ? c.minD : 1000,
        runs: state.meta.totalRuns || 0,
        breaks: state.meta.breaks || 0,
        cores: state.res.cores || 0,
        delta: state.res.delta || 0
      });
      const base = isFinite(v) ? Math.floor(v) : 0;
      if (base <= 0) return 0;
      let mult = G.growth.upgProduct(state, 'psiGainMult');
      if (!isFinite(mult) || mult <= 0) mult = 1;
      /* × от механик (общий хук) */
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.psiGainMult !== 'function') continue;
        const k = m.psiGainMult(state);
        if (isFinite(k) && k > 0) mult *= k;
      }
      const add = G.growth.upgSum(state, 'psiGainAdd');
      const total = Math.floor(base * mult + (isFinite(add) ? add : 0));
      return total > 0 ? total : 0;
    },

    canDo(state) { return B.gain(state) > 0; },

    wallPassed(state) {
      const id = B.cfg().barrier;
      return !id || (state.meta.passedBarriers || []).indexOf(id) >= 0;
    },

    tierOpen(state) {
      return B.wallPassed(state) || (state.res.psi || 0) > 0;
    },

    perform(state) {
      const gain = B.gain(state);
      if (gain <= 0) return 0;
      const c = B.cfg();

      state.res.psi = (state.res.psi || 0) + gain;
      state.meta.breaks = (state.meta.breaks || 0) + 1;
      state.meta.bestD = Math.max(state.meta.bestD || 0, G.growth.D(state));
      state.meta.bestPsi = Math.max(state.meta.bestPsi || 0, state.res.psi);

      const passed = state.meta.passedBarriers || (state.meta.passedBarriers = []);
      if (c.barrier && passed.indexOf(c.barrier) < 0) passed.push(c.barrier);
      if (c.tier) state.meta.tier = c.tier;

      G.resetScopes(state, c.resetScopes || ['run', 'tier']);
      state.meta.totalRuns = (state.meta.totalRuns || 0) + 1;

      G.bus.emit('breakthrough:done', { gain: gain, psi: state.res.psi });
      return gain;
    }
  };

  G.breakthrough = B;
})(window.G = window.G || {});
