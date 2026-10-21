/* systems/prestige.js — первое перерождение (P1).
   Логика отдельно от доски: доска только показывает и вызывает perform(). */
(function (G) {
  'use strict';

  const P = {
    cfg() { return (G.content && G.content.prestige) || {}; },

    /* сколько ◆ дадут за текущее состояние */
    gain(state) {
      const c = P.cfg();
      const v = G.formula(c.gainFormula || 'floor(max(0, D - minD) / 4)', {
        D: G.growth.D(state),
        minD: c.minD !== undefined ? c.minD : 10,
        cores: state.res.cores || 0
      });
      return isFinite(v) && v > 0 ? Math.floor(v) : 0;
    },

    /* постоянный множитель к M от ◆ */
    mult(state) {
      const cores = state.res.cores || 0;
      if (!cores) return 1;
      const v = G.formula(P.cfg().coreMultFormula || '1.5 ** cores', { cores: cores });
      return isFinite(v) && v > 0 ? v : 1;
    },

    can(state) { return P.gain(state) > 0; },

    /* стартовые цифры после перерождения — данные: content.prestige.start
       { node, formula } или { vars: {lvl: 'id', lvl2: 'id'}, formula } */
    applyStart(state) {
      const st = P.cfg().start;
      if (!st) return 0;
      const vars = {};
      if (st.vars) {
        for (const k in st.vars) vars[k] = G.lvl(state, st.vars[k]);
      } else if (st.node) {
        vars.lvl = G.lvl(state, st.node);
      } else {
        return 0;
      }
      const d = G.formula(st.formula || '0', vars);
      if (!isFinite(d) || d <= 0) return 0;
      state.N = G.BN.fromLog10(d);
      state.D = d;
      state.disp = null;
      return d;
    },

    perform(state) {
      const gain = P.gain(state);
      if (gain <= 0) return 0;

      state.res.cores = (state.res.cores || 0) + gain;
      state.meta.totalRuns = (state.meta.totalRuns || 0) + 1;
      state.meta.bestD = Math.max(state.meta.bestD || 0, G.growth.D(state));

      G.resetScopes(state, P.cfg().resetScopes || ['run']);

      /* стартовый рывок из дерева ◆: после сброса поднимаем N до стартовых цифр */
      P.applyStart(state);

      G.bus.emit('prestige:done', { gain: gain, cores: state.res.cores });
      return gain;
    }
  };

  G.prestige = P;
})(window.G = window.G || {});
