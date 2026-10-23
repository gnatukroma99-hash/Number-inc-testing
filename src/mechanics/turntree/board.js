/* mechanics/turntree/board.js — доска «Дерево ⧜».
   Карта — общий движок mechanics/tree/engine.js (G.treeBoard);
   здесь только «какое это дерево»: ⧜ вместо ◆/Ψ, свой контент и тема «живой росток». */
(function (G) {
  'use strict';

  G.treeBoard.build({
    mech: 'turntree',
    content: 'turntree',
    res: 'turns',
    unit: '⧜',
    icon: 'cycle',
    close: 'turn',
    theme: 'bloom'
  });
})(window.G = window.G || {});
