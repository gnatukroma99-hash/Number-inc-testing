/* systems/d2-collapse.js — Схлопывание D2 (престиж второго измерения).
   Даёт ⌬ (эссенцию), сбрасывает оси/Ξ/Boost и НЕ трогает ⌬, апгрейды, связи,
   статистику D2 и весь D1. Данные — G.content.d2.collapse / G.content.d2.upgrades.
   Апгрейды и связи живут в state.d2.upgrades / state.d2.links (scope meta-d2),
   поэтому G.lvl(state, ...) (state.upg) здесь не используется. */
(function (G) {
  'use strict';

  const LINK_COLLAPSE_ID = 'link_collapse';
  const LINK_COLLAPSE_POW = 1.2;  // связь link_collapse: ⌬ ×1.2^ур. (как в данных content/d2.js)
  const MAX_START_D = 300;        // старт N₂ не выше 1e300 (ТЗ §5.3/§6)

  function cfg() { return (G.content && G.content.d2 && G.content.d2.collapse) || {}; }

  function d2(state) { return (state && state.d2) || null; }

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }

  function res(state) {
    const s = d2(state);
    if (!s.res) s.res = { axis: 0, essence: 0 };
    s.res.essence = num(s.res.essence);
    return s.res;
  }

  function stats(state) {
    const s = d2(state);
    if (!s.stats) s.stats = { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 };
    return s.stats;
  }

  /* уровень из «мешка» state.d2.upgrades / state.d2.links */
  function bagLevel(bag, id) { return num(bag ? bag[id] : 0); }

  function upgrade(id) {
    const list = (G.content && G.content.d2 && G.content.d2.upgrades) || [];
    for (const u of list) if (u.id === id) return u;
    return null;
  }

  /* свипы дерева D2: узлы отдают d2StartAdd (сумма) и d2CollapseMult (произведение) */
  function upgSum(state, field) {
    const v = (G.growth && typeof G.growth.upgSum === 'function') ? G.growth.upgSum(state, field) : 0;
    return isFinite(v) ? v : 0;
  }

  function upgProduct(state, field) {
    const v = (G.growth && typeof G.growth.upgProduct === 'function') ? G.growth.upgProduct(state, field) : 1;
    return isFinite(v) && v > 0 ? v : 1;
  }

  /* Апгрейды/связи D2 живут в G.content.d2, а их уровни — в state.d2;
     общий G.growth.upgProduct видит только state.upg (дерево), поэтому свип локальный. */
  function contentProduct(state, field) {
    const c = cfg();
    const s = d2(state);
    const stores = [
      { list: c.upgrades, lvls: s.upgrades },
      { list: c.links, lvls: s.links }
    ];
    let p = 1;
    for (const store of stores) {
      for (const u of (store.list || [])) {
        if (!u || !u[field]) continue;
        const lvl = bagLevel(store.lvls, u.id);
        if (lvl <= 0) continue;
        const v = G.formula(u[field], { lvl: lvl });
        if (isFinite(v) && v > 0) p *= v;
      }
    }
    return isFinite(p) && p > 0 ? p : 1;
  }

  function emit(name, data) {
    if (G.bus && typeof G.bus.emit === 'function') G.bus.emit(name, data);
  }

  /* D₂ текущего состояния: кэш state.d2.D, иначе log10(N₂) */
  function d2D(state) {
    const s = d2(state);
    if (!s) return 0;
    if (isFinite(s.D)) return s.D;
    return s.N ? G.BN.log10(s.N) : 0;
  }

  function minD() {
    const c = cfg();
    return isFinite(c.minD) ? c.minD : 100;
  }

  /* множитель ⌬: узлы дерева/апгрейды (d2CollapseMult) и связь link_collapse */
  function collapseMult(state) {
    let mult = upgProduct(state, 'd2CollapseMult') * contentProduct(state, 'd2CollapseMult');
    const lvl = bagLevel(d2(state).links, LINK_COLLAPSE_ID);
    if (lvl > 0) mult *= Math.pow(LINK_COLLAPSE_POW, lvl);
    return isFinite(mult) && mult > 0 ? mult : 1;
  }

  const C = {
    /* ⌬ за одно Схлопывание (целое, 0 — если ещё рано).
       gainFormula из данных уже считает floor базы, поэтому множители применяются
       к целой базе — потеря на дробном множителе не больше 1 ⌬. */
    gain(state) {
      if (!d2(state)) return 0;
      if (d2D(state) < minD()) return 0;
      const c = cfg();
      const base = G.formula(
        c.gainFormula || 'floor(pow(max(0, D - 100) / 10, 0.8) * (1 + 0.1 * collapses))',
        {
          D: d2D(state),
          minD: minD(),
          collapses: num(stats(state).collapses),
          essence: res(state).essence
        }
      );
      const total = base * collapseMult(state);
      return isFinite(total) && total > 0 ? Math.floor(total) : 0;
    },

    can(state) {
      if (!d2(state)) return false;
      return d2D(state) >= minD();
    },

    /* Старт D₂ после сброса. Считается ПОСЛЕ начисления ⌬: эссенция уже в state.d2.res. */
    startD2(state) {
      const s = d2(state);
      const c = cfg();
      let start = G.formula(
        c.startFormula || '10 + 5 * essence + 20 * lvlLinkStart + 10 * lvlStart',
        {
          essence: res(state).essence,
          lvlStart: bagLevel(s.upgrades, 'd2_start'),
          lvlLinkStart: bagLevel(s.links, 'link_start'),
          collapses: num(stats(state).collapses),
          D: d2D(state)
        }
      );
      start += upgSum(state, 'd2StartAdd');                 // узлы дерева D2
      if (G.d2Links && typeof G.d2Links.d2StartBonus === 'function') {
        const bonus = G.d2Links.d2StartBonus(state);        // бонус D1 → D2
        if (isFinite(bonus) && bonus > 0) start += bonus;
      }
      if (!isFinite(start) || start < 0) start = 0;
      if (start > MAX_START_D) start = MAX_START_D;

      s.D = start;
      s.N = G.BN.fromLog10(start);
      s.disp = null;
      return start;
    },

    /* цена апгрейда в ⌬ (Number.MAX_VALUE — если куплен максимум/нет такого id) */
    upgradeCost(state, id) {
      const u = upgrade(id);
      if (!u) return Number.MAX_VALUE;
      const lvl = bagLevel(d2(state).upgrades, id);
      if (isFinite(u.max) && lvl >= u.max) return Number.MAX_VALUE;
      const cost = (u.base || 1) * Math.pow(u.growth || 2, lvl);
      return isFinite(cost) ? cost : Number.MAX_VALUE;
    },

    /* покупка за ⌬. Возвращает 1, если куплено, иначе 0. */
    buyUpgrade(state, id) {
      const u = upgrade(id);
      if (!u) return 0;
      const s = d2(state);
      const lvl = bagLevel(s.upgrades, id);
      if (isFinite(u.max) && lvl >= u.max) return 0;
      const cost = C.upgradeCost(state, id);
      const r = res(state);
      if (!isFinite(cost) || !(r.essence >= cost)) return 0;

      r.essence = Math.max(0, r.essence - cost);
      if (!s.upgrades) s.upgrades = {};
      s.upgrades[id] = lvl + 1;
      emit('d2:upgrade', { id: id, level: lvl + 1, cost: cost });
      return 1;
    },

    /* Схлопывание: ⌬ += gain, счётчики, сброс D2, старт по формуле.
       Возвращает начисленную ⌬ (0 — если Схлопывание недоступно). */
    perform(state) {
      if (!C.can(state)) return 0;
      const gained = C.gain(state);
      if (gained <= 0) return 0;

      const s = d2(state);
      const st = stats(state);
      const r = res(state);
      const bestD = d2D(state);

      r.essence = r.essence + gained;
      st.totalEssence = num(st.totalEssence) + gained;
      st.collapses = num(st.collapses) + 1;
      st.bestD = Math.max(num(st.bestD), bestD);
      st.lastCollapse = num(st.playtime);

      /* сброс только D2-полей (оси, Ξ, Boost, N₂/D₂); ⌬/upgrades/links/stats — стоят */
      if (G.d2 && typeof G.d2.resetD2 === 'function') G.d2.resetD2(state);
      const start = C.startD2(state);

      emit('d2:collapse', { gain: gained, essence: r.essence, collapses: st.collapses, start: start });
      return gained;
    }
  };

  G.d2Collapse = C;
})(window.G = window.G || {});
