/* tools/tests/fixtures/checkcontent/_base.js — минимальный КОРРЕКТНЫЙ граф контента.
   Каждый фикстур проверки линтера начинается с него (../_base.js), а его content.js
   добавляет ровно одно нарушение. Подключается после настоящих core/formula.js
   и core/registry.js из репозитория — фикстуры проверяют проверки, а не движок. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.registry.addResource({ id: 'energy', name: '⌁', scope: 'run' });
  G.registry.addResource({ id: 'cores', name: '◆', scope: 'meta' });

  G.registry.addMechanic({ id: 'runboard', order: 1, name: 'Доска забега', scope: 'run' });
  G.registry.addMechanic({ id: 'tree', order: 2, name: 'Дерево ◆', scope: 'meta' });

  G.registry.addTier({ id: 'tier1', name: 'Арифметика', range: [0, 308] });

  G.registry.addUpgrades([
    { id: 'base_mult', mech: 'runboard', res: 'energy', base: 8, growth: 1.5, max: 5, formula: '2 + lvl', Mmult: '2 ** lvl' },
    { id: 'base_auto', mech: 'core', res: 'energy', base: 5, growth: 1, max: 1, costFormula: '5', formula: 'lvl' },
    { id: 'base_shop', mech: 'runboard', costD: '0.8 * 1.8 ** lvl', minD: 2, max: 3, formula: 'lvl' }
  ]);

  G.content.groups = [{ id: 'run', name: 'Забег', mechs: ['core', 'runboard', 'tree'] }];

  /* дерево ◆: одна ветвь, корень + дочерний узел */
  G.content.tree = { res: 'cores', branches: [{ id: 'start', name: 'Старт' }] };
  G.registry.addUpgrades([
    { id: 'tr_root', mech: 'tree', branch: 'start', depth: 0, scope: 'meta', res: 'cores', base: 1, growth: 2, max: 3, formula: '2 * lvl' },
    { id: 'tr_leaf', mech: 'tree', branch: 'start', depth: 1, scope: 'meta', res: 'cores', base: 2, growth: 2, max: 3, formula: '4 * lvl', requires: ['tr_root'] }
  ]);

  G.content.turn = { startVars: { lvl2: 'tr_leaf' } };
  G.content.omega = { rules: [{ id: 'w_one', cost: 1, text: 'одно правило' }] };
  G.content.patterns = { types: [{ id: 'triple', name: 'Трипл' }] };
})(window.G = window.G || {});
