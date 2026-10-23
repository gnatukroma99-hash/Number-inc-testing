/* mechanics/pacttree/board.js — доска «Гнилое дерево ⌁» (v0.28.0).
   Раньше это был список карточек, теперь — та же карта-созвездие, что у ◆-дерева
   (механика tree/engine.js), но с оформлением «гниль» (`theme: 'rot'` в content/pacttree.js)
   и развилками: закрытый развилкой узел виден, но мёртв (хук `blocked`).

   Отличие от ◆-дерева — только четыре хука движка, сам движок про пакты не знает:
     canBuy  — цена + требования + развилка;
     blocked — какая именно ветвь отсохла (для подписи «закрыто»);
     buy     — покупка через G.pacttree.buy;
     visible — глубину 2 видно, если куплен ЛЮБОЙ узел предыдущей глубины этой ветви. */
(function (G) {
  'use strict';

  const branchOf = (u) => u.branch || '';

  /* Узлы предыдущей глубины по каждой ветви — считаем ОДИН раз (карта спрашивает
     visible() для каждого узла на каждом кадре; перебор реестра там был бы дорогим). */
  const parents = {};
  for (const u of G.registry.upgradesOf('pacttree')) {
    const key = branchOf(u) + ':' + (u.depth || 0);
    (parents[key] = parents[key] || []).push(u.id);
  }
  const parentIds = (u) => parents[branchOf(u) + ':' + ((u.depth || 0) - 1)] || [];

  G.treeBoard.build({
    mech: 'pacttree',
    content: 'pacttree',
    res: 'delta',
    unit: 'Δ',
    icon: '⌁',
    close: 'bigbang',
    theme: 'rot',

    canBuy(state, u) { return G.pacttree.canBuy(state, u); },
    buy(state, u) { return G.pacttree.buy(state, u); },
    blocked(state, u) { return G.pacttree.blockedBy(state, u); },

    visible(state, u) {
      if (!u.requires || !u.requires.length) return true;
      if ((u.depth || 0) <= 0) return true;
      const ids = parentIds(u);
      for (let i = 0; i < ids.length; i++) if (G.lvl(state, ids[i]) > 0) return true;
      return false;
    }
  });
})(window.G = window.G || {});
