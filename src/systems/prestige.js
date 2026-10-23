/* systems/prestige.js — первое перерождение (P1).
   Логика отдельно от доски: доска только показывает и вызывает perform(). */
(function (G) {
  'use strict';

  const P = {
    cfg() { return (G.content && G.content.prestige) || {}; },

    /* сколько ◆ дадут за текущее состояние (с бонусами дерева ◆) */
    gain(state) {
      const c = P.cfg();
      const v = G.formula(c.gainFormula || 'floor(max(0, D - minD) / 4)', {
        D: G.growth.D(state),
        minD: c.minD !== undefined ? c.minD : 10,
        cores: state.res.cores || 0,
        runs: state.meta.totalRuns || 0
      });
      const base = isFinite(v) ? Math.floor(v) : 0;
      if (base <= 0) return 0;
      let mult = G.growth.upgProduct(state, 'coreGainMult');
      if (!isFinite(mult) || mult <= 0) mult = 1;
      const add = G.growth.upgSum(state, 'coreGainAdd');
      /* множители от механик (созвездия «Дракон» и будущие) — общий хук coreGainMult */
      let mechK = 1;
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.coreGainMult !== 'function') continue;
        const k = m.coreGainMult(state);
        if (isFinite(k) && k > 0) mechK *= k;
      }
      let total = Math.floor(base * mult * mechK + (isFinite(add) ? add : 0));
      /* «Узловая награда»: +◆ за каждый купленный узел дерева */
      const perNode = G.growth.upgSum(state, 'coreGainPerNode');
      if (perNode > 0) total += Math.floor(P.treeNodes(state) * perNode);
      return total > 0 ? total : 0;
    },

    /* сколько узлов дерева ◆ куплено (для узла «Узловая награда») */
    treeNodes(state) {
      let n = 0;
      for (const u of G.registry.upgradesOf('tree')) if (G.lvl(state, u.id) > 0) n++;
      return n;
    },

    /* постоянный множитель к M от ◆; узел «Ядра не сгорают» считает по рекорду */
    mult(state) {
      let cores = state.res.cores || 0;
      if (P.keepCores(state)) cores = Math.max(cores, state.meta.coresBest || 0);
      if (!cores) return 1;
      const v = G.formula(P.cfg().coreMultFormula || '1.5 ** cores', { cores: cores });
      if (isFinite(v) && v > 0) return v > 1e300 ? 1e300 : v;
      /* G.formula отдаёт 0, когда результат переполнил double (1.5^cores при больших
         ядрах). Это «множитель больше представимого», а не «множителя нет»:
         раньше на 6 млн ◆ весь вклад ядер молча исчезал, и M падал в 1. */
      return 1e300;
    },

    can(state) { return P.gain(state) > 0; },

    /* куплен ли узел «Ядра не сгорают» */
    keepCores(state) {
      return G.lvl(state, 'tree_corekeep') > 0;
    },

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
      state.meta.coresBest = Math.max(state.meta.coresBest || 0, state.res.cores);
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
