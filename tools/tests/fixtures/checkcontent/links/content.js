/* Фикстур: висячие ссылки — механика, ресурс, requires, группа, узел startVars,
   и механика, забытая в навигации. */
(function (G) {
  'use strict';

  G.registry.addMechanic({ id: 'lonely', order: 9, name: 'Одинокая доска', scope: 'run' });

  G.registry.addUpgrades([
    { id: 'ref_mech', mech: 'ghost_mech', res: 'energy', formula: 'lvl' },
    { id: 'ref_res', mech: 'runboard', res: 'ghost_res', formula: 'lvl' },
    { id: 'ref_requires', mech: 'runboard', res: 'energy', formula: 'lvl', requires: ['ghost_upg'] }
  ]);

  G.content.groups[0].mechs.push('ghost_board');
  G.content.turn.startVars.lvl3 = 'ghost_node';
})(window.G = window.G || {});
