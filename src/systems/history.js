/* systems/history.js — короткая история показателей для спарклайнов (v0.23.0).
   Каждые HISTORY_STEP секунд игрового времени кладём в кольцо:
     • D (рост числа) — для спарклайна в меню/на доске «Рост»;
     • первый числовой счётчик механики из её vars() — для мини-графика в её карточке.
   Кольцо короткое (24 точки ≈ 48 с), поэтому и память, и цена копеечные. */
(function (G) {
  'use strict';

  const STEP = 2;        /* сек игрового времени между точками */
  const LEN = 24;        /* сколько точек храним */

  let acc = 0;

  function push(arr, v) {
    arr.push(v);
    if (arr.length > LEN) arr.splice(0, arr.length - LEN);
    return arr;
  }

  const H = {
    STEP: STEP,
    LEN: LEN,

    /* подготовить структуры в state.stats (сейв их не теряет: это обычный объект) */
    ensure(state) {
      const st = state.stats || (state.stats = {});
      if (!Array.isArray(st.histD)) st.histD = [];
      if (!st.histMech || typeof st.histMech !== 'object') st.histMech = {};
      return st;
    },

    tick(state, dt) {
      const st = H.ensure(state);
      acc += dt || 0;
      if (acc < STEP) return null;
      acc = 0;

      push(st.histD, Number(G.growth.D(state).toFixed(3)));

      for (const m of G.registry.mechanics()) {
        if (typeof m.vars !== 'function') continue;
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        let v = null;
        try { v = m.vars(state); } catch (e) { continue; }
        if (!v) continue;
        let num = null;
        for (const k in v) {
          if (typeof v[k] === 'number' && isFinite(v[k])) { num = v[k]; break; }
        }
        if (num === null) continue;
        const arr = st.histMech[m.id] || (st.histMech[m.id] = []);
        push(arr, num);
      }
      return st.histD.length;
    },

    /* серия для механики: берём первый числовой счётчик (тот же, что писали) */
    series(state, id) {
      const st = H.ensure(state);
      if (id === 'core') return st.histD || [];
      return (st.histMech && st.histMech[id]) || [];
    },

    /* SVG-путь спарклайна по серии (ширина/высота в px) */
    path(values, w, h, pad) {
      const arr = (values || []).filter((v) => typeof v === 'number' && isFinite(v));
      if (arr.length < 2) return '';
      const p = pad === undefined ? 2 : pad;
      const min = Math.min.apply(null, arr);
      const max = Math.max.apply(null, arr);
      const span = max - min || 1;
      const stepX = (w - p * 2) / (arr.length - 1);
      const pts = arr.map((v, i) => {
        const x = p + i * stepX;
        const y = h - p - ((v - min) / span) * (h - p * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      });
      return 'M' + pts.join(' L');
    },

    restart(state) {
      if (!state.stats) return;
      state.stats.histD = [];
      state.stats.histMech = {};
      acc = 0;
    }
  };

  G.history = H;
})(window.G = window.G || {});
