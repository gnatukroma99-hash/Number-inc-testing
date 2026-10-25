/* systems/d2-milestones.js — вечные награды за рекорд D₂ (docs/CELESTIALS.md §6).
   Пороги живут в данных (content/d2-milestones.js), пройденные определяются по
   `state.d2.stats.bestD`: Схлопывание сбрасывает D₂/оси/Ξ, но рекорд не трогает,
   поэтому награды вечные и новых полей сейва нет.

   Контракт: list / reached / mult / sum / next / status. Системы D2 подмешивают
   `mult(state, field)` (d2RateMult/d2XiMult/d2CollapseMult/d2SpanMult) и
   `sum(state, field)` (d2StartAdd) через `typeof`-guard — без этого модуля D2 работает как раньше. */
(function (G) {
  'use strict';

  function cfg() {
    return (G.content && G.content.d2milestones) || { list: [] };
  }

  function list() {
    return cfg().list || [];
  }

  /* рекорд D₂ — единственный критерий порога; битое/пустое состояние даёт 0 */
  function bestD(state) {
    const stats = state && state.d2 && state.d2.stats;
    const v = stats ? stats.bestD : 0;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  function rewardOf(m) {
    return (m && m.reward) || {};
  }

  function fmtNum(n) {
    if (G.fmt && typeof G.fmt.num === 'function') return G.fmt.num(n);
    return String(Math.round(n * 100) / 100);
  }

  const M = {
    list: list,

    /* пройденные пороги (объекты данных, по возрастанию reqD) */
    reached(state) {
      const best = bestD(state);
      return list().filter((m) => best >= m.reqD);
    },

    /* произведение наград-множителей поля; нет наград — ровно 1 */
    mult(state, field) {
      let out = 1;
      for (const m of M.reached(state)) {
        const r = rewardOf(m);
        if (r.field !== field) continue;
        const v = r.mult;
        if (typeof v === 'number' && isFinite(v) && v > 0) out *= v;
      }
      return (isFinite(out) && out > 0) ? out : 1;
    },

    /* сумма наград-прибавок поля; нет наград — ровно 0 */
    sum(state, field) {
      let out = 0;
      for (const m of M.reached(state)) {
        const r = rewardOf(m);
        if (r.field !== field) continue;
        const v = r.add;
        if (typeof v === 'number' && isFinite(v)) out += v;
      }
      return isFinite(out) ? out : 0;
    },

    /* ближайший непройденный порог (объект данных) или null, если пройдены все */
    next(state) {
      const best = bestD(state);
      for (const m of list()) {
        if (best < m.reqD) return m;
      }
      return null;
    },

    /* строка для бейджа дока: «3 / 8 · до 100» */
    status(state) {
      const total = list().length;
      const done = M.reached(state).length;
      const nxt = M.next(state);
      return nxt
        ? done + ' / ' + total + ' · до ' + fmtNum(nxt.reqD)
        : done + ' / ' + total + ' · все';
    }
  };

  G.d2Milestones = M;
})(window.G = window.G || {});
