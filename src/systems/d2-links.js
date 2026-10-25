/* systems/d2-links.js — связи D1 ↔ D2 (ТЗ docs/DIMENSION2.md §7, §10.2).
   Связи покупаются за ⌬ (essence) и живут в state.d2.links как уровни; scope 'meta-d2'
   (Схлопывание их не сбрасывает — сброс делает только systems/d2.js).
   Данные связей — G.content.d2.links (content/d2.js); система не знает их списка.
   Единственное исключение — id 'link_m': ТЗ §7 закрепляет за ним бонус M в D1.
   Никаких вызовов D1-механик: наружу отдаются только чистые функции. */
(function (G) {
  'use strict';

  const D1_MULT_CAP = 11;   // максимум бонуса D2 → D1 (ТЗ §7)
  const PER_LINK_M = 0.05;  // +5 % к M D1 за уровень link_m
  const PER_D2_DIGIT = 0.01; // +1 % к M D1 за цифру D₂
  const D2_DIGIT_CAP = 1000; // цифры D₂ сверх 1000 бонус не растят
  const START_CAP = 50;      // D1 → D2: не больше 50 стартовых цифр (ТЗ §7, §11)
  const LINK_M = 'link_m';

  function d2(state) { return (state && state.d2) || null; }

  function unlocked(state) {
    const d = d2(state);
    return !!(d && d.unlocked);
  }

  function linkData(id) {
    const d = G.content && G.content.d2;
    const list = (d && d.links) || [];
    for (const l of list) if (l && l.id === id) return l;
    return null;
  }

  function level(state, id) {
    const d = d2(state);
    const raw = d && d.links ? d.links[id] : 0;
    const n = Number(raw);
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function maxOf(link) {
    return link.max !== undefined ? link.max : Infinity;
  }

  /* цифры D₂ для бонуса: конечные и неотрицательные (иначе кривой сейв даёт NaN) */
  function d2Digits(state) {
    const d = d2(state);
    const v = d && isFinite(d.D) ? d.D : 0;
    if (!isFinite(v) || v <= 0) return 0;
    return v < D2_DIGIT_CAP ? v : D2_DIGIT_CAP;
  }

  const L = {
    /* D2 → D1: множитель M. Пока D2 закрыт — ровно 1 (D1 не видит D2 вообще). */
    d1Mult(state) {
      if (!unlocked(state)) return 1;
      const m = 1 + PER_LINK_M * level(state, LINK_M) + PER_D2_DIGIT * d2Digits(state);
      if (!isFinite(m) || m < 1) return 1;
      return m > D1_MULT_CAP ? D1_MULT_CAP : m;
    },

    /* D1 → D2: столько цифр к стартовому D₂ после Схлопывания. */
    d2StartBonus(state) {
      const d1 = G.growth.D(state);
      if (!isFinite(d1) || d1 <= 0) return 0;
      const v = 2 * Math.log10(1 + d1);
      if (!isFinite(v) || v <= 0) return 0;
      return v > START_CAP ? START_CAP : v;
    },

    /* цена связи в ⌬: base · growth^lvl; неизвестный id — Number.MAX_VALUE (не 0!). */
    linkCost(state, id) {
      const l = linkData(id);
      if (!l) return Number.MAX_VALUE;
      const base = l.base !== undefined ? l.base : 1;
      const growth = l.growth !== undefined ? l.growth : 2;
      const c = base * Math.pow(growth, level(state, id));
      return isFinite(c) && c >= 0 ? c : Number.MAX_VALUE;
    },

    /* покупка одного уровня связи за ⌬. true — куплено, false — не хватило/максимум/нет id. */
    buyLink(state, id) {
      const l = linkData(id);
      const d = d2(state);
      if (!l || !d) return false;
      if (level(state, id) >= maxOf(l)) return false;
      const cost = L.linkCost(state, id);
      if (!isFinite(cost)) return false;
      d.res = d.res || {};
      const have = Number(d.res.essence) || 0;
      if (!isFinite(have) || have < cost) return false;
      d.res.essence = have - cost;
      d.links = d.links || {};
      d.links[id] = level(state, id) + 1;
      G.bus.emit('d2link:bought', { id: id, level: d.links[id], cost: cost });
      return true;
    }
  };

  G.d2Links = L;
})(window.G);
