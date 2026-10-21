/* systems/upgrades.js — покупка и расчёт эффектов. Формулы — только из данных.
   Два типа цены:
     base/growth/costFormula — обычная цена в ресурсе u.res (⚡, ❖, ...)
     costD — цена в ЦИФРАХ (D): платим частью главного числа N. */
(function (G) {
  'use strict';

  function costOf(u, lvl) {
    if (u.costFormula) {
      const c = G.formula(u.costFormula, { lvl: lvl });
      return isFinite(c) ? c : Number.MAX_VALUE;
    }
    const base = u.base || 1;
    const growth = u.growth || 2;
    const c = base * Math.pow(growth, lvl);
    return isFinite(c) ? c : Number.MAX_VALUE;
  }

  /* цена в цифрах (для магазина «за само число»); дерево ◆ может её снижать (shopCostMult) */
  function costDigits(state, u) {
    const d = G.formula(u.costD, { lvl: G.lvl(state, u.id), D: G.growth.D(state) });
    if (!isFinite(d) || d < 0) return Number.MAX_VALUE;
    let mult = G.growth.upgProduct(state, 'shopCostMult');
    if (!isFinite(mult) || mult <= 0) mult = 1;
    return Math.max(0, d * mult);
  }

  const U = {
    level(state, id) { return G.lvl(state, id); },

    cost(u, lvl) { return costOf(u, lvl); },

    /* текущая цена в ресурсе (для UI) */
    currentCost(state, u) { return costOf(u, G.lvl(state, u.id)); },

    /* текущая цена в цифрах (для магазина) */
    digitsCost(state, u) { return u.costD ? costDigits(state, u) : 0; },

    isMaxed(state, u) { return G.lvl(state, u.id) >= u.max; },

    /* требования-предки (дерево прокачки): массив id, у каждого уровень > 0 */
    requirementsMet(state, u) {
      if (!u.requires || !u.requires.length) return true;
      for (const id of u.requires) if (G.lvl(state, id) <= 0) return false;
      return true;
    },

    canBuy(state, u) {
      if (U.isMaxed(state, u)) return false;
      if (!U.requirementsMet(state, u)) return false;

      if (u.costD) {
        const price = costDigits(state, u);
        /* нельзя опустить число ниже minD цифр — движок не должен уйти в 0 */
        return isFinite(price) && (G.growth.D(state) - price) >= (u.minD !== undefined ? u.minD : 2);
      }

      const price = costOf(u, G.lvl(state, u.id));
      return (state.res[u.res] || 0) >= price;
    },

    buy(state, u, times) {
      times = times || 1;
      let bought = 0;
      for (let i = 0; i < times; i++) {
        if (!U.canBuy(state, u)) break;

        if (u.costD) {
          const price = costDigits(state, u);
          const d = Math.max(0, G.growth.D(state) - price);
          state.N = G.BN.fromLog10(d);
          state.D = d;
          /* число уменьшилось — показываем новое значение сразу */
          state.disp = null;
        } else {
          const price = costOf(u, G.lvl(state, u.id));
          state.res[u.res] -= price;
        }

        state.upg[u.id] = G.lvl(state, u.id) + 1;
        bought++;
      }
      if (bought) {
        G.bus.emit('upgrade:bought', { id: u.id, count: bought, level: G.lvl(state, u.id) });
      }
      return bought;
    },

    /* ---------- массовая покупка (×1 / ×10 / ×100 / MAX) ---------- */
    /* сколько уровней реально можно купить подряд прямо сейчас */
    affordable(state, u) {
      if (u.costD) return U.canBuy(state, u) ? 1 : 0;   // «за цифры» — строго по одному
      const res = state.res[u.res] || 0;
      const base = G.lvl(state, u.id);
      let spent = 0;
      let n = 0;
      while (n < 1000) {
        if (base + n >= u.max) break;
        const c = costOf(u, base + n);
        if (!isFinite(c) || spent + c > res) break;
        spent += c;
        n++;
      }
      return n;
    },

    /* суммарная цена n уровней подряд */
    bulkCost(state, u, n) {
      const base = G.lvl(state, u.id);
      let spent = 0;
      for (let i = 0; i < n; i++) spent += costOf(u, base + i);
      return spent;
    },

    /* сколько купим и за сколько по выбранному режиму */
    plan(state, u, mode) {
      const can = U.affordable(state, u);
      if (u.costD) {
        return { count: can, cost: can ? U.digitsCost(state, u) : 0, digits: true };
      }
      const want = mode === 'max' ? can : Math.min(Number(mode) || 1, can);
      return { count: want, cost: want ? U.bulkCost(state, u, want) : 0, digits: false };
    },

    buyBulk(state, u, mode) {
      const p = U.plan(state, u, mode);
      if (!p.count) return 0;
      return U.buy(state, u, p.count);
    },

    /* купить ВСЁ доступное на доске (кнопка «Купить всё») */
    buyAllAvailable(state, mechId) {
      let batches = 0;
      for (let pass = 0; pass < 40; pass++) {
        let any = false;
        for (const u of G.registry.upgradesOf(mechId)) {
          if (U.buyBulk(state, u, 'max') > 0) any = true;
        }
        if (!any) break;
        batches++;
      }
      return batches;
    },

    /* самый дешёвый доступный к покупке апгрейд доски (для прогресс-бара) */
    nextTarget(state, mechId) {
      let best = null;
      for (const u of G.registry.upgradesOf(mechId)) {
        if (U.isMaxed(state, u)) continue;
        if (!U.requirementsMet(state, u)) continue;
        const plan = U.plan(state, u, '1');
        const price = u.costD ? (U.digitsCost(state, u) || 0) : U.currentCost(state, u);
        if (!best || price < best.price) best = { u: u, price: price, plan: plan };
      }
      return best;
    },

    /* значение эффекта апгрейда по его формуле: vars = { lvl, D, S, q, prime, ... } */
    value(state, u) {
      if (typeof u.effect === 'function') return u.effect(state);
      if (!u.formula) return 0;
      const v = Object.assign(G.growth.vars(state), { lvl: G.lvl(state, u.id) });
      return G.formula(u.formula, v);
    },

    /* описание эффекта «как есть» для UI: lvl -> число */
    describe(u) {
      if (!u.formula) return '—';
      const v = G.formula(u.formula, { lvl: 0 });
      return u.desc || String(v);
    }
  };

  G.upgrades = U;
})(window.G = window.G || {});
