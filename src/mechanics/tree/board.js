/* mechanics/tree/board.js — доска «Дерево ◆».
   Вся карта-созвездие живёт в общем движке mechanics/tree/engine.js (G.treeBoard);
   здесь только «какое это дерево»: валюта, содержимое, иконка, куда ведёт крестик. */
(function (G) {
  'use strict';

  G.treeBoard.build({
    mech: 'tree',
    content: 'tree',
    res: 'cores',
    unit: '◆',
    icon: 'core',
    close: 'core'
  });
})(window.G = window.G || {});
