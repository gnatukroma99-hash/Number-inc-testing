/* systems/d2-growth.js — производство ИЗМЕРЕНИЯ 2 (оси Ξ): docs/DIMENSION2.md §5.3/§5.4.
   Считает скорость осей, доход Ξ, объём M₂, интервал ΔT₂ и объём D₂, а также покупки
   осей и Boost. Работает только с state.d2 — state.N / state.D (D1) не трогает.

   Множители («Π link/upgrade-множителей» из §5.3) приходят из трёх мест:
     • узлы дерева D2 — общий свип G.growth.upgProduct(state, field) (уровни в state.upg);
     • апгрейды Схлопывания и связи — свой свип по G.content.d2.upgrades/links
       (уровни в state.d2.upgrades / state.d2.links), поля те же, что у дерева:
       d2RateMult / d2XiMult / d2SpanMult / d2BoostCostMult (docs/DIMENSION2.md §8);
     • награды фазы 2 — целестиалы (state.cel), D2-милстоуны и D2-достижения
       (docs/CELESTIALS.md §9): G.celestials.bonusMult / G.d2Milestones.mult /
       G.d2Achievements.mult.
   Нет данных или модуля — множитель 1. */
(function (G) {
  'use strict';

  /* ---- константы формул §5.3 (данные осей приходят из G.content.d2.axes) ---- */
  const C = {
    perLvl: 0.25,      /* +25% к своей оси за уровень */
    chain: 0.05,       /* +5% к оси от amount следующей оси */
    lvlSum: 0.02,      /* +2% на сумму уровней — в темпе оси, в Ξ и в ΔT₂ */
    boostBase: 2,      /* скорость осей ×2^boost */
    amountExp: 0.2,    /* M₂ = Π (1 + amount_i)^0.2 */
    dtBase: 60,        /* ΔT₂ = 60 / (1 + 0.02·lvlSum) */
    dtMin: 0.1,
    knee: 50,          /* софткап начинается с D₂ = 50 */
    span: 25,          /* ширина плоскости софткапа */
    power: 1.5,
    maxAmount: 1e300,  /* мягкий кламп amount_i и Ξ (§5.3) */
    minBarrier: 1e-9   /* темп не умирает насовсем: «число всегда растёт» */
  };
  const MAX_LG = Math.log10(C.maxAmount);

  function cfg() { return (G.content && G.content.d2) || {}; }
  function axesData() { return cfg().axes || []; }
  function axesState(state) { return (state && state.d2 && state.d2.axes) || null; }

  function lvlOf(a) { return a && isFinite(a.lvl) ? a.lvl : 0; }
  function amountOf(a) { return a && isFinite(a.amount) && a.amount > 0 ? a.amount : 0; }
  function boostOf(state) {
    const b = state && state.d2 && state.d2.boost;
    return isFinite(b) ? b : 0;
  }
  function dOf(state) {
    const d = state && state.d2 && state.d2.D;
    return isFinite(d) ? d : 0;
  }
  function resOf(state) {
    if (!state.d2.res) state.d2.res = { axis: 0, essence: 0 };
    if (!isFinite(state.d2.res.axis)) state.d2.res.axis = 0;
    return state.d2.res;
  }

  function lvlSum(state) {
    const list = axesState(state) || [];
    let s = 0;
    for (let i = 0; i < list.length; i++) s += lvlOf(list[i]);
    return s;
  }

  /* 10^lg с мягким клампом: переполнение ведёт к 1e300, а не к Infinity */
  function fromLog(lg) {
    if (!isFinite(lg)) return 0;
    if (lg >= MAX_LG) return C.maxAmount;
    if (lg <= -MAX_LG) return 0;
    const v = Math.pow(10, lg);
    return isFinite(v) ? v : C.maxAmount;
  }
  function logMul(p) { return isFinite(p) && p > 0 ? Math.log10(p) : 0; }

  /* Множители апгрейдов/связей D2: их уровни живут в state.d2, поэтому общий
     G.growth.upgProduct их не видит — свип по данным G.content.d2. */
  function d2UpgProduct(state, field) {
    const c = cfg();
    const stores = [
      { list: c.upgrades, lvls: state.d2.upgrades },
      { list: c.links, lvls: state.d2.links }
    ];
    let p = 1;
    for (let s = 0; s < stores.length; s++) {
      const list = stores[s].list || [];
      const lvls = stores[s].lvls || {};
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        if (!u || !u[field]) continue;
        const lvl = lvls[u.id];
        if (!isFinite(lvl) || lvl <= 0) continue;
        const v = G.formula(u[field], { lvl: lvl });
        if (isFinite(v) && v > 0) p *= v;
      }
    }
    return isFinite(p) && p > 0 ? p : 1;
  }

  /* ---- награды фазы 2 (docs/CELESTIALS.md §9) ----
     Целестиалы, милстоуны и достижения живут в отдельных файлах, которых может не быть
     в сборке; поэтому только typeof-guard: нет модуля/метода или вернулся не-множитель — 1. */
  function celestialMult(state, field) {
    const c = G.celestials;
    if (!c || typeof c.bonusMult !== 'function') return 1;
    const v = c.bonusMult(state, field);
    return isFinite(v) && v > 0 ? v : 1;
  }

  function milestoneMult(state, field) {
    const m = G.d2Milestones;
    if (!m || typeof m.mult !== 'function') return 1;
    const v = m.mult(state, field);
    return isFinite(v) && v > 0 ? v : 1;
  }

  function achievementMult(state) {
    const a = G.d2Achievements;
    if (!a || typeof a.mult !== 'function') return 1;
    const v = a.mult(state);
    return isFinite(v) && v > 0 ? v : 1;
  }

  /* общий свип (узлы дерева D2) × апгрейды/связи D2 */
  function mult(state, field) {
    let p = d2UpgProduct(state, field);
    if (G.growth && typeof G.growth.upgProduct === 'function') {
      const v = G.growth.upgProduct(state, field);
      if (isFinite(v) && v > 0) p *= v;
    }
    return isFinite(p) && p > 0 ? p : 1;
  }

  /* ---------- скорость оси, §5.3 ---------- */
  function axisRate(state, i) {
    const data = axesData()[i];
    const list = axesState(state);
    const a = list && list[i];
    if (!data || !a) return 0;
    const base = data.baseRate;
    if (!isFinite(base) || base <= 0) return 0;

    const next = i + 1 < list.length ? amountOf(list[i + 1]) : 0;
    let lg = Math.log10(base)
      + logMul(1 + C.perLvl * lvlOf(a))
      + (i + 1 < list.length ? logMul(1 + C.chain * next) : 0)
      + boostOf(state) * Math.log10(C.boostBase)
      + logMul(1 + C.lvlSum * lvlSum(state))
      + logMul(mult(state, 'd2RateMult'))
      + logMul(celestialMult(state, 'd2RateMult'))
      + logMul(milestoneMult(state, 'd2RateMult'))
      + logMul(achievementMult(state));
    return fromLog(lg);
  }

  /* Ξ в секунду: от нулевой оси, с бонусом суммы уровней и множителями (§5.3) */
  function xiRate(state) {
    const r0 = axisRate(state, 0);
    if (!(r0 > 0)) return 0;
    return fromLog(Math.log10(r0) + logMul(1 + C.lvlSum * lvlSum(state)) +
      logMul(mult(state, 'd2XiMult')) +
      logMul(celestialMult(state, 'd2XiMult')) +
      logMul(milestoneMult(state, 'd2XiMult')));
  }

  /* log10(M₂): объём собирается в логарифмах, иначе 8 осей по 1e300 дают Infinity */
  function logM2(state) {
    const list = axesState(state) || [];
    let s = 0;
    for (let i = 0; i < list.length; i++) s += Math.log10(1 + amountOf(list[i]));
    return C.amountExp * s;
  }

  function M2(state) { return fromLog(logM2(state)); }

  /* ΔT₂ = max(0.1, 60 / (1 + 0.02·lvlSum)) */
  function deltaT(state) {
    const v = C.dtBase / (1 + C.lvlSum * lvlSum(state));
    return isFinite(v) && v > C.dtMin ? v : C.dtMin;
  }

  /* softcap: 1 / (1 + pow(max(0, D₂ - 50) / (25·spanMult), 1.5)) */
  function barrier(state, d) {
    const D = isFinite(d) ? d : dOf(state);
    /* награды §9 расширяют плоскость софткапа: span × целестиалы */
    const span = C.span * mult(state, 'd2SpanMult') * celestialMult(state, 'd2SpanMult') * milestoneMult(state, 'd2SpanMult');
    const x = Math.max(0, D - C.knee) / (isFinite(span) && span > 0 ? span : C.span);
    const v = 1 / (1 + Math.pow(x, C.power));
    if (!isFinite(v) || v <= 0) return C.minBarrier;
    return Math.max(C.minBarrier, Math.min(1, v));
  }

  /* ---------- один шаг симуляции ----------
     amount_i += rate_i·dt;  Ξ += xiRate·dt;  D₂ += log10(M₂)/ΔT₂·barrier·dt.
     Возвращает прирост D₂ за шаг (0, если шага нет). */
  function tick(state, dt) {
    const list = axesState(state);
    if (!list || !list.length) return 0;
    if (!isFinite(dt) || dt <= 0) return 0;

    if (!state.d2.stats) state.d2.stats = {};
    const st = state.d2.stats;
    st.playtime = (isFinite(st.playtime) ? st.playtime : 0) + dt;

    /* Ξ считаем до сдвига amount: это темп начала шага, иначе Ξ/с зависел бы от
       того, в каком порядке обновляются оси. */
    const res = resOf(state);
    const xi = res.axis + xiRate(state) * dt;
    res.axis = isFinite(xi) ? Math.min(Math.max(0, xi), C.maxAmount) : C.maxAmount;

    for (let i = 0; i < list.length; i++) {
      const r = axisRate(state, i);
      if (!(r > 0)) continue;
      const sum = amountOf(list[i]) + r * dt;
      list[i].amount = isFinite(sum) ? Math.min(sum, C.maxAmount) : C.maxAmount;
    }

    const before = dOf(state);
    const inc = (logM2(state) / deltaT(state)) * barrier(state, before) * dt;
    let after = before + (isFinite(inc) ? inc : 0);
    if (!isFinite(after) || after < 0) after = before;

    state.d2.D = after;
    state.d2.N = G.BN.fromLog10(after);
    state.d2.disp = { from: before, to: after, t0: st.playtime, dur: Math.max(0.03, dt) };
    if (after > (isFinite(st.bestD) ? st.bestD : 0)) st.bestD = after;

    return after - before;
  }

  /* ---------- покупки, §5.4 ---------- */
  function axisMax(data) {
    return isFinite(data.max) && data.max > 0 ? data.max : Infinity;
  }

  /* цена уровня lvl оси i в Ξ: baseCost · costGrowth^lvl */
  function axisCost(state, i, lvl) {
    const data = axesData()[i];
    const a = axesState(state);
    if (!data || !a || !a[i]) return Number.MAX_VALUE;
    const l = isFinite(lvl) ? lvl : lvlOf(a[i]);
    const base = data.baseCost;
    if (!isFinite(base) || base < 0) return Number.MAX_VALUE;
    const growth = isFinite(data.costGrowth) && data.costGrowth > 0 ? data.costGrowth : 1;
    const c = base * Math.pow(growth, l);
    return isFinite(c) && c >= 0 ? c : Number.MAX_VALUE;
  }

  /* сколько уровней оси купим по режиму ('1' | '10' | 'max'): {count, cost} —
     форма как у G.upgrades.plan, чтобы доска показывала цену пачки. */
  function axisPlan(state, i, mode) {
    const data = axesData()[i];
    const a = axesState(state);
    if (!data || !a || !a[i]) return { count: 0, cost: 0 };
    const lvl = lvlOf(a[i]);
    const max = axisMax(data);
    const have = resOf(state).axis;
    const want = String(mode) === 'max'
      ? Math.max(0, max - lvl)
      : Math.max(1, Math.floor(Number(mode) || 1));
    let count = 0;
    let spent = 0;
    while (count < want && lvl + count < max) {
      const c = axisCost(state, i, lvl + count);
      if (!isFinite(c) || spent + c > have) break;
      spent += c;
      count++;
    }
    return { count: count, cost: spent };
  }

  /* купить уровни оси; возвращает число купленных. Ξ в минус не уходит. */
  function buyAxis(state, i, mode) {
    const plan = axisPlan(state, i, mode);
    if (!plan.count) return 0;
    const a = axesState(state);
    a[i].lvl = lvlOf(a[i]) + plan.count;
    const left = resOf(state).axis - plan.cost;
    resOf(state).axis = left > 0 ? left : 0;
    return plan.count;
  }

  /* цена Boost в Ξ: boost.base · boost.growth^boost · множители d2BoostCostMult */
  function boostCost(state) {
    const b = cfg().boost || {};
    if (!isFinite(b.base) || !isFinite(b.growth) || b.base < 0 || b.growth <= 0) {
      return Number.MAX_VALUE;
    }
    const c = b.base * Math.pow(b.growth, boostOf(state)) * mult(state, 'd2BoostCostMult');
    return isFinite(c) && c >= 0 ? c : Number.MAX_VALUE;
  }

  /* купить уровень Boost; возвращает 1/0. Не хватает Ξ — ничего не меняем. */
  function buyBoost(state) {
    const d2 = state && state.d2;
    if (!d2) return 0;
    const max = cfg().boost && isFinite(cfg().boost.max) ? cfg().boost.max : Infinity;
    if (boostOf(state) >= max) return 0;
    const cost = boostCost(state);
    const have = resOf(state).axis;
    if (!(cost <= have)) return 0;
    d2.res.axis = Math.max(0, have - cost);
    d2.boost = boostOf(state) + 1;
    return 1;
  }

  G.d2Growth = {
    axisRate: axisRate,
    xiRate: xiRate,
    M2: M2,
    dt: deltaT,
    barrier: barrier,
    tick: tick,
    axisCost: axisCost,
    axisPlan: axisPlan,
    buyAxis: buyAxis,
    boostCost: boostCost,
    buyBoost: buyBoost
  };
})(window.G = window.G || {});
