/* Фикстур: цикл в requires (cyc_a → cyc_b → cyc_a) и узел, который требует
   потомка (глубина 2 требует глубину 3) — дерево так раскрыть нельзя. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    { id: 'cyc_a', mech: 'tree', branch: 'start', depth: 2, scope: 'meta', res: 'cores', formula: 'lvl', requires: ['cyc_b'] },
    { id: 'cyc_b', mech: 'tree', branch: 'start', depth: 3, scope: 'meta', res: 'cores', formula: 'lvl', requires: ['cyc_a'] }
  ]);
})(window.G = window.G || {});
