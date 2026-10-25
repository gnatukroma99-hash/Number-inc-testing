/* mechanics/d2tree/index.js — механика «Древо D2» (Измерение 2, первый срез).
   Логики почти нет: узлы — данные (content/d2-tree.js), покупка — общий systems/upgrades.js
   (res: 'essence'), карта — общий mechanics/tree/engine.js. Сами эффекты узлов собирают
   общими свипами d2-growth / d2-collapse: d2StartAdd (upgSum), d2RateMult / d2XiMult /
   d2CollapseMult / d2SpanMult (upgProduct) — см. docs/DIMENSION2.md §8.

   Валюта узлов — ⌬, а она по ТЗ §5.1 живёт в state.d2.res.essence, тогда как общий
   systems/upgrades.js читает валюту из state.res[u.res]. Поэтому ⌬ зеркалится одним числом:
   перед чтением цены/покупкой — state.d2 → state.res.essence, после покупки — обратно.
   Источник правды остаётся один: state.d2 (сброс D1 и оффлайн его не трогают).

   Древо открывается после ПЕРВОГО Схлопывания (ТЗ §8): до него ⌬ ещё не существует. */
(function (G) {
  'use strict';

  const cfg = () => G.content.d2tree || {};
  const list = () => G.registry.upgradesOf('d2tree');

  const T = {
    list: list,
    branches() { return cfg().branches || []; },

    /* ⌬ из состояния D2; D2 ещё нет — 0 (дерево в этот момент и не открыто) */
    essence(state) {
      const d2 = state && state.d2;
      const v = d2 && d2.res ? d2.res.essence : 0;
      return typeof v === 'number' && isFinite(v) ? v : 0;
    },

    /* ⌬ → state.res.essence (туда смотрит systems/upgrades.js и счётчик карты) */
    syncIn(state) {
      if (!state) return 0;
      const v = T.essence(state);
      state.res.essence = v;
      return v;
    },

    /* и обратно после покупки: upgrades.js списал цену из state.res.essence */
    syncOut(state) {
      const d2 = state && state.d2;
      if (!d2 || !d2.res) return 0;
      const v = state.res.essence;
      d2.res.essence = typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
      return d2.res.essence;
    },

    /* после первого Схлопывания (state.d2.stats.collapses) */
    unlocked(state) {
      const d2 = state && state.d2;
      const st = d2 && d2.stats;
      return !!(st && st.collapses > 0);
    },

    canBuy(state, u) {
      T.syncIn(state);
      return G.upgrades.canBuy(state, u);
    },

    buy(state, u) {
      T.syncIn(state);
      const n = G.upgrades.buy(state, u);
      T.syncOut(state);
      return n;
    },

    /* сколько узлов куплено (читает общий движок карты) */
    bought(state) {
      let n = 0;
      for (const u of list()) if (G.lvl(state, u.id) > 0) n++;
      return n;
    },

    total() { return list().length; }
  };

  G.d2Tree = T;

  G.registry.addMechanic({
    id: 'd2tree',
    order: 10.4,
    name: 'Древо D2',
    short: 'Древо ⌬',
    icon: 'facet',
    scope: 'meta-d2',      // Схлопывание и сбросы D1 дерево не трогают
    noBulk: true,          // у узлов своя цена, массовая покупка не нужна
    fullscreen: true,      // карта на весь экран, как у остальных деревьев
    lockHint: 'нужно первое Схлопывание (D2)',
    hint: cfg().hint,

    isUnlocked(state) { return T.unlocked(state); },

    bought(state) { return T.bought(state); },

    total() { return T.total(); },

    vars(state) {
      return { d2Nodes: T.bought(state) };
    },

    status(state) {
      return '⌬ ' + T.bought(state) + '/' + T.total();
    }
  });
})(window.G = window.G || {});
