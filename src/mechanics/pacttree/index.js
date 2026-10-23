/* mechanics/pacttree/index.js — ПАКТ-ДЕРЕВО ⌁: 20 узлов за Δ, взаимоисключающие развилки.
   Узлы — обычные апгрейды (res: 'delta', scope: 'tier'), поэтому эффекты собираются
   существующими свипами движка. Здесь только логика «какой узел закрыт из-за развилки». */
(function (G) {
  'use strict';

  const cfg = () => G.content.pacttree;
  const list = () => G.registry.upgradesOf('pacttree');

  const P = {
    list: list,
    branches() { return cfg().branches || []; },

    /* куплен ли сосед по развилке */
    blockedBy(state, u) {
      const ex = u.excludes || [];
      for (let i = 0; i < ex.length; i++) {
        if (G.lvl(state, ex[i]) > 0) return ex[i];
      }
      return null;
    },

    isBlocked(state, id) {
      const u = G.registry.upgrade(id);
      return !!(u && P.blockedBy(state, u));
    },

    /* покупка: обычные правила + развилка */
    canBuy(state, u) {
      if (!u || P.blockedBy(state, u)) return false;
      return G.upgrades.canBuy(state, u);
    },

    buy(state, u) {
      if (!P.canBuy(state, u)) return 0;
      return G.upgrades.buy(state, u);
    },

    /* сколько развилок уже выбрано (для статуса) */
    chosen(state) {
      let n = 0;
      for (const u of list()) if ((u.excludes || []).length && G.lvl(state, u.id) > 0) n++;
      return n;
    }
  };

  G.pacttree = P;

  G.registry.addMechanic({
    id: 'pacttree',
    order: 8.9,
    name: 'Пакт-дерево',
    short: 'Пакт-дерево',
    icon: '⌁',
    scope: 'tier',
    noBulk: true,          // у узлов дерева своя цена, массовая покупка не нужна
    fullscreen: true,      // доска — карта на весь экран (тот же движок, что у ◆-дерева)
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    /* сколько узлов куплено / всего — читает общий движок карты */
    bought(state) {
      let n = 0;
      for (const u of list()) if (G.lvl(state, u.id) > 0) n++;
      return n;
    },

    total() { return list().length; },

    /* эффекты собираются свипами: upgProduct/upgSum берут только isUnlocked-узлы,
       поэтому закрытый развилкой узел не даёт бонуса, даже если его когда-то купили. */
    status(state) {
      let bought = 0;
      for (const u of list()) if (G.lvl(state, u.id) > 0) bought++;
      return '⌁ ' + bought + '/' + list().length;
    },

    vars(state) {
      let bought = 0;
      for (const u of list()) if (G.lvl(state, u.id) > 0) bought++;
      return { pactNodes: bought, pactForks: P.chosen(state) };
    }
  });
})(window.G = window.G || {});
