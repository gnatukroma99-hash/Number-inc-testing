/* systems/achievements.js — проверка достижений по формулам-условиям из данных.
   Движок не знает названий достижений: он обходит список из content.achievements.list.
   Открытие: состояние meta.achievements (никогда не сбрасывается) + событие bus. */
(function (G) {
  'use strict';

  const CHECK_PERIOD = 1;   // сек — как часто проверяем условия

  let acc = 0;

  function cfg() {
    return (G.content && G.content.achievements) || { list: [] };
  }

  function unlockedList(state) {
    const m = state.meta || (state.meta = {});
    if (!Array.isArray(m.achievements)) m.achievements = [];
    return m.achievements;
  }

  const A = {
    list() { return cfg().list || []; },
    total() { return A.list().length; },
    count(state) { return unlockedList(state).length; },
    has(state, id) { return unlockedList(state).indexOf(id) >= 0; },

    /* все переменные для условий (считать недорого: один обход апгрейдов) */
    vars(state) {
      let upg = 0;
      for (const id in state.upg) {
        const v = state.upg[id];
        if (typeof v === 'number' && isFinite(v)) upg += v;
      }
      let tree = 0;
      for (const u of G.registry.upgradesOf('tree')) if (G.lvl(state, u.id) > 0) tree++;
      const mirror = state.mech && state.mech.mirror;
      return {
        D: G.growth.D(state),
        bestD: state.stats.bestD || 0,
        cores: state.res.cores || 0,
        runs: state.meta.totalRuns || 0,
        prime: state.res.prime || 0,
        energy: state.res.energy || 0,
        sieveFound: state.stats.sieveFound || 0,
        mirrors: (mirror && mirror.bestSym) || 0,
        treeNodes: tree,
        upgrades: upg,
        playtime: state.stats.playtime || 0,
        achievements: unlockedList(state).length
      };
    },

    /* проверить все условия; открыть новые; вернуть массив новых */
    check(state) {
      const vars = A.vars(state);
      const done = unlockedList(state);
      const fresh = [];
      for (const a of A.list()) {
        if (done.indexOf(a.id) >= 0) continue;
        if (!a.cond) continue;
        let ok = false;
        try {
          ok = !!G.formula(a.cond, vars);
        } catch (e) {
          console.warn('[achievements] плохое условие', a.id, e.message);
        }
        if (ok) {
          done.push(a.id);
          fresh.push(a);
        }
      }
      for (const a of fresh) {
        G.bus.emit('achievement:unlocked', a);
      }
      return fresh;
    },

    update(state, dt) {
      acc += dt || 0;
      if (acc < CHECK_PERIOD) return null;
      acc = 0;
      return A.check(state);
    },

    /* постоянный множитель к M от коллекции */
    mult(state) {
      const n = A.count(state);
      if (!n) return 1;
      const v = G.formula(cfg().multFormula || '1 + 0.01 * count', { count: n });
      return isFinite(v) && v > 0 ? v : 1;
    },

    /* для отладки/тестов */
    reset(state) {
      state.meta.achievements = [];
      acc = 0;
    }
  };

  G.achievements = A;
})(window.G = window.G || {});
