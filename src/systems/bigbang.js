/* systems/bigbang.js — БОЛЬШОЙ БУМ: второй престиж (Ярус 2).
   Логика отдельно от доски: доска вызывает canDo/gain/perform.
   Всё из данных: content/tier2.js (формула Δ, стена, что сбрасывается). */
(function (G) {
  'use strict';

  const B = {
    cfg() { return (G.content && G.content.bigbang) || {}; },

    /* сколько Δ даст БУМ прямо сейчас */
    gain(state) {
      const c = B.cfg();
      const v = G.formula(c.gainFormula || 'pow(max(0, D - 300), 0.9)', {
        D: G.growth.D(state),
        minD: c.minD !== undefined ? c.minD : 300,
        runs: state.meta.totalRuns || 0,
        bangs: state.meta.bangs || 0,
        cores: state.res.cores || 0
      });
      const base = isFinite(v) ? Math.floor(v) : 0;
      if (base <= 0) return 0;
      /* усиление добычи Δ из дерева ◆ / будущих механик — общий свип, без имён */
      let mult = G.growth.upgProduct(state, 'deltaGainMult');
      if (!isFinite(mult) || mult <= 0) mult = 1;
      const add = G.growth.upgSum(state, 'deltaGainAdd');
      const total = Math.floor(base * mult + (isFinite(add) ? add : 0));
      return total > 0 ? total : 0;
    },

    canDo(state) { return B.gain(state) > 0; },

    /* стена уже снята? */
    wallPassed(state) {
      const id = B.cfg().barrier;
      return !id || (state.meta.passedBarriers || []).indexOf(id) >= 0;
    },

    /* ярус 2 открыт? (Δ копились или стена снята) */
    tierOpen(state) {
      return B.wallPassed(state) || (state.res.delta || 0) > 0;
    },

    perform(state) {
      const gain = B.gain(state);
      if (gain <= 0) return 0;
      const c = B.cfg();

      state.res.delta = (state.res.delta || 0) + gain;
      state.meta.bangs = (state.meta.bangs || 0) + 1;
      state.meta.bestD = Math.max(state.meta.bestD || 0, G.growth.D(state));
      state.meta.bestDelta = Math.max(state.meta.bestDelta || 0, state.res.delta);

      /* стена снимается навсегда */
      const passed = state.meta.passedBarriers || (state.meta.passedBarriers = []);
      if (c.barrier && passed.indexOf(c.barrier) < 0) passed.push(c.barrier);
      if (c.tier) state.meta.tier = c.tier;

      /* забег схлопывается; ◆/Δ/дерево/достижения (scope meta/tier) остаются */
      G.resetScopes(state, c.resetScopes || ['run']);
      state.meta.totalRuns = (state.meta.totalRuns || 0) + 1;

      G.bus.emit('bigbang:done', { gain: gain, delta: state.res.delta });
      return gain;
    }
  };

  G.bigbang = B;
})(window.G = window.G || {});
