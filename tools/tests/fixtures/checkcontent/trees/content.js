/* Фикстур: Ψ-дерево с нарушениями — неизвестная ветвь, отрицательная глубина,
   requires на узел той же глубины, requires из другой ветви, несимметричные
   excludes и объявленная, но пустая ветвь. */
(function (G) {
  'use strict';

  G.registry.addMechanic({ id: 'psitree', order: 5, name: 'Ψ-дерево', scope: 'meta' });
  G.content.groups[0].mechs.push('psitree');

  G.content.psitree = {
    res: 'cores',
    branches: [
      { id: 'plane', name: 'Плоскость' },
      { id: 'boom', name: 'Взрыв' },
      { id: 'empty', name: 'Пустая' }
    ]
  };

  G.registry.addUpgrades([
    { id: 'bb_branch', mech: 'psitree', branch: 'ghost_branch', depth: 0, scope: 'meta', res: 'cores', formula: 'lvl' },
    { id: 'bb_depth', mech: 'psitree', branch: 'plane', depth: -1, scope: 'meta', res: 'cores', formula: 'lvl' },
    { id: 'bb_boom', mech: 'psitree', branch: 'boom', depth: 0, scope: 'meta', res: 'cores', formula: 'lvl' },
    { id: 'bb_deep', mech: 'psitree', branch: 'plane', depth: 2, scope: 'meta', res: 'cores', formula: 'lvl' },
    { id: 'bb_same', mech: 'psitree', branch: 'plane', depth: 2, scope: 'meta', res: 'cores', formula: 'lvl', requires: ['bb_deep'] },
    { id: 'bb_cross', mech: 'psitree', branch: 'plane', depth: 3, scope: 'meta', res: 'cores', formula: 'lvl', requires: ['bb_boom'] },
    { id: 'bb_ex', mech: 'psitree', branch: 'plane', depth: 0, scope: 'meta', res: 'cores', formula: 'lvl', excludes: ['bb_same'] }
  ]);
})(window.G = window.G || {});
