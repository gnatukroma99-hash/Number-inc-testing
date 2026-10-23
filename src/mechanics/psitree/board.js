/* mechanics/psitree/board.js — доска «Ψ-дерево».
   Карта-созвездие — общий движок mechanics/tree/engine.js (G.treeBoard);
   здесь только «какое это дерево»: Ψ вместо ◆, свой контент, крестик ведёт к ПРОБОЮ. */
(function (G) {
  'use strict';

  G.treeBoard.build({
    mech: 'psitree',
    content: 'psitree',
    res: 'psi',
    unit: 'Ψ',
    icon: 'facet',
    close: 'breakthrough'
  });
})(window.G = window.G || {});
