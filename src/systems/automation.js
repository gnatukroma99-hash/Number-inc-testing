/* systems/automation.js — автопокупки по флагу autoMech у апгрейда.
   Никаких имён механик: система обходит реестр и покупает то, что разрешено. */
(function (G) {
  'use strict';

  const STEP = 0.5;        // как часто пробуем покупать
  const SHOP_PERIOD = 10;  // магазин — реже, чтобы не сливать число
  const MAX_PER_PASS = 20;

  let acc = 0;
  let shopAcc = 0;

  const A = {
    /* какие доски автоматизированы (по купленным auto-апгрейдам) */
    active(state) {
      const out = {};
      for (const u of G.registry.allUpgrades()) {
        if (!u.autoMech) continue;
        if (G.lvl(state, u.id) > 0) out[u.autoMech] = true;
      }
      return out;
    },

    /* Разрешена ли автопокупка САМИХ авто-апгрейдов (autoBuy:false).
       По умолчанию — нет: автоматизация одной доски не должна автоматизировать другие.
       Право даёт узел дерева ◆ (id — в данных: content.automation.autoAllGate). */
    autoAllOpen(state) {
      const cfg = (G.content && G.content.automation) || {};
      return cfg.autoAllGate ? G.lvl(state, cfg.autoAllGate) > 0 : false;
    },

    buyCheapest(state, mech) {
      const open = A.autoAllOpen(state);
      for (let n = 0; n < MAX_PER_PASS; n++) {
        let best = null;
        let bestCost = Infinity;
        for (const u of G.registry.upgradesOf(mech)) {
          if (u.autoBuy === false && !open) continue;
          if (!G.upgrades.canBuy(state, u)) continue;
          const c = G.upgrades.currentCost(state, u);
          if (c < bestCost) { best = u; bestCost = c; }
        }
        if (!best) return;
        G.upgrades.buy(state, best);
      }
    },

    buyOneShop(state) {
      for (const u of G.registry.upgradesOf('shop')) {
        if (G.upgrades.canBuy(state, u)) { G.upgrades.buy(state, u); return; }
      }
    },

    run(state) {
      const act = A.active(state);
      for (const id in act) {
        if (id === 'shop') continue;
        A.buyCheapest(state, id);
      }
      if (act.shop && shopAcc >= SHOP_PERIOD) {
        shopAcc = 0;
        A.buyOneShop(state);
      }
    },

    update(state, dt) {
      acc += dt;
      shopAcc += dt;
      if (acc < STEP) return;
      acc = 0;
      A.run(state);
    }
  };

  G.automation = A;
})(window.G = window.G || {});
