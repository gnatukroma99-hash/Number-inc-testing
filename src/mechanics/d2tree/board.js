/* mechanics/d2tree/board.js — доска «Древо D2».
   Карта — общий движок mechanics/tree/engine.js (G.treeBoard); здесь только «какое это дерево»:
   ⌬ вместо ◆/Ψ/⧜/⌁, свой контент и тема «d2» (CSS — assets/css/style.css).
   Покупка — через G.d2Tree: он зеркалит ⌬ в state.res.essence, потому что общий
   systems/upgrades.js читает валюту оттуда (см. index.js).

   Крестик/Esc уводят на доску Схлопывания: из D2 выходят не «в пустоту», а к своему сбросу. */
(function (G) {
  'use strict';

  G.treeBoard.build({
    mech: 'd2tree',
    content: 'd2tree',
    res: 'essence',
    unit: '⌬',
    icon: 'facet',
    close: 'd2collapse',
    theme: 'd2',

    canBuy(state, u) { return G.d2Tree.canBuy(state, u); },
    buy(state, u) { return G.d2Tree.buy(state, u); }
  });

  /* Счётчик валюты в шапке карты движок берёт из state.res[res], а ⌬ живёт в state.d2
     (ТЗ §5.1). Поэтому каждый кадр доски обёрнут: сначала ⌬ подкладывается в state.res.essence,
     иначе шапка показывала бы 0. Обёртка вокруг экземпляра карты — самого движка не трогаем. */
  const board = G.registry.mechanic('d2tree').board;
  const mount = board.mount;
  board.mount = function (root) {
    const view = mount(root);
    const update = view.update;
    view.update = function (state) {
      G.d2Tree.syncIn(state);
      update(state);
    };
    return view;
  };
})(window.G = window.G || {});
