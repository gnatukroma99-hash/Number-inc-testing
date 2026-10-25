/* systems/d2.js — «Измерение 2» (D2 «Оси Ξ»): состояние, гейт открытия, мир D1/D2, сброс D2.
   Здесь только state: производство осей — systems/d2-growth.js, Схлопывание —
   systems/d2-collapse.js, связи D1↔D2 — systems/d2-links.js, данные — content/d2.js.
   Контракт API — docs/DIMENSION2.md §10.2, форма state.d2 — §5.1. */
(function (G) {
  'use strict';

  /* Форма state.d2 фиксирована ТЗ §5.1: ровно 8 осей. Данные осей (имена/цены/ставки)
     живут в content/d2.js — здесь только длина массива состояния. */
  const AXES = 8;

  /* Гейт открытия (§4): 10 ⧜. Значение приходит из content/d2.js (`gate.turns`),
     константа — дефолт, чтобы модуль работал до подключения контента (тесты, порядок загрузки). */
  const GATE_TURNS = 10;

  function stateShape() {
    const axes = [];
    for (let i = 0; i < AXES; i++) axes.push({ lvl: 0, amount: 0 });
    return {
      v: 1,
      unlocked: false,
      active: false,                 // открыт ли мир D2 (переключатель D1|D2)
      N: { m: 1, e: 0 },             // N₂ через G.BN
      D: 0,                          // D₂ = log10(N₂)
      disp: null,                    // плавное отображение
      res: { axis: 0, essence: 0 },  // Ξ, ⌬
      axes: axes,
      boost: 0,
      upgrades: {},                  // уровни d2-апгрейдов (ключ → число)
      links: {},                     // уровни связей D1↔D2
      stats: { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 },
      lastSeen: 0
    };
  }

  function num(v, def) {
    return (typeof v === 'number' && isFinite(v)) ? v : def;
  }

  function gateTurns() {
    const c = G.content && G.content.d2;
    const t = c && c.gate && c.gate.turns;
    return (typeof t === 'number' && isFinite(t)) ? t : GATE_TURNS;
  }

  function fmtNum(n) {
    if (G.fmt && typeof G.fmt.num === 'function') return G.fmt.num(n);
    return String(Math.round(n * 100) / 100);
  }

  const D2 = {
    /* пустой state.d2 */
    newState: stateShape,

    /* Добавить/починить state.d2: новый state, старый сейв без D2, импорт, битые поля.
       На здоровом состоянии ничего не аллоцирует (вызывается из тика/UI). */
    ensure(state) {
      if (!state) return null;
      let d2 = state.d2;
      if (!d2 || typeof d2 !== 'object') {
        d2 = state.d2 = stateShape();
        return d2;
      }

      if (typeof d2.v !== 'number') d2.v = 1;
      if (typeof d2.unlocked !== 'boolean') d2.unlocked = false;
      if (typeof d2.active !== 'boolean') d2.active = false;
      if (!G.BN.isValid(d2.N)) d2.N = { m: 1, e: 0 };
      if (typeof d2.D !== 'number' || !isFinite(d2.D)) d2.D = G.BN.log10(d2.N);
      if (d2.disp === undefined) d2.disp = null;

      if (!d2.res || typeof d2.res !== 'object') d2.res = { axis: 0, essence: 0 };
      d2.res.axis = num(d2.res.axis, 0);
      d2.res.essence = num(d2.res.essence, 0);

      if (!Array.isArray(d2.axes)) d2.axes = [];
      while (d2.axes.length < AXES) d2.axes.push({ lvl: 0, amount: 0 });
      for (let i = 0; i < AXES; i++) {
        const a = d2.axes[i];
        if (!a || typeof a !== 'object') { d2.axes[i] = { lvl: 0, amount: 0 }; continue; }
        a.lvl = num(a.lvl, 0);
        a.amount = num(a.amount, 0);
      }

      d2.boost = num(d2.boost, 0);
      if (!d2.upgrades || typeof d2.upgrades !== 'object') d2.upgrades = {};
      if (!d2.links || typeof d2.links !== 'object') d2.links = {};

      if (!d2.stats || typeof d2.stats !== 'object') {
        d2.stats = { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 };
      } else {
        const st = d2.stats;
        st.bestD = num(st.bestD, 0);
        st.collapses = num(st.collapses, 0);
        st.totalEssence = num(st.totalEssence, 0);
        st.playtime = num(st.playtime, 0);
        st.lastCollapse = num(st.lastCollapse, 0);
      }

      d2.lastSeen = num(d2.lastSeen, 0);
      return d2;
    },

    /* Гейт §4. Открытый D2 обратно не закрывается: ⧜ тратятся на дерево Яруса 4,
       а G.debug.unlockD2() ставит защёлку напрямую — значит state.d2.unlocked и есть ответ. */
    unlocked(state) {
      const d2 = D2.ensure(state);
      if (d2.unlocked) return true;
      const turns = (state.res && state.res.turns) || 0;
      const tierOpen = !!(G.turn && typeof G.turn.tierOpen === 'function' && G.turn.tierOpen(state));
      if (!tierOpen || turns < gateTurns()) return false;
      d2.unlocked = true;
      return true;
    },

    active(state) {
      return !!D2.ensure(state).active;
    },

    /* Войти в D2 можно только после открытия; выход — всегда. */
    setActive(state, on) {
      const d2 = D2.ensure(state);
      d2.active = !!on && D2.unlocked(state);
      return d2.active;
    },

    /* D₂ (цифры). Кэш держит d2-growth на каждом тике; при отсутствии — считаем из N₂. */
    D(state) {
      return D2.ensure(state).D;
    },

    /* N₂ — BigNum ({m,e}); отдаём живой объект, как и G.state.N (копируйте сами, если нужно). */
    N(state) {
      return D2.ensure(state).N;
    },

    /* Скорость D₂ в цифрах/с: log10(M₂)/ΔT₂ (§5.3). Считают d2-growth/dt, здесь только
       сводим их в одно число; без модуля роста — 0 (не NaN и не исключение). */
    rate(state) {
      const g = G.d2Growth;
      if (!g || typeof g.M2 !== 'function' || typeof g.dt !== 'function') return 0;
      const m2 = g.M2(state);
      const dt = g.dt(state);
      const v = Math.log10(m2 > 0 ? m2 : 1) / (dt > 0 ? dt : 1);
      return (isFinite(v) && v > 0) ? v : 0;
    },

    /* Сброс D2 (его делает Схлопывание): N₂/D₂/оси/Ξ/Boost.
       ⌬ (essence), upgrades, links, stats, флаги unlocked/active и весь D1 — НЕ трогаются.
       Стартовые цифры после сброса ставит G.d2Collapse (§6), здесь их нет. */
    resetD2(state) {
      const d2 = D2.ensure(state);
      d2.N = G.BN.one();
      d2.D = 0;
      d2.disp = null;
      d2.res.axis = 0;
      d2.boost = 0;
      for (let i = 0; i < AXES; i++) {
        d2.axes[i].lvl = 0;
        d2.axes[i].amount = 0;
      }
      return d2;
    },

    /* Строка для бейджа дока: «D₂ 12.4 · Ξ 1.2K» */
    status(state) {
      if (!D2.unlocked(state)) return 'закрыто';
      const d2 = D2.ensure(state);
      return 'D₂ ' + fmtNum(d2.D) + ' · Ξ ' + fmtNum(d2.res.axis);
    }
  };

  G.d2 = D2;
})(window.G = window.G || {});
