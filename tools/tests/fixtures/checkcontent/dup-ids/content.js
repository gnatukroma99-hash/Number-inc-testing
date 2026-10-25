/* Фикстур: повторные id. Реестр хранит записи в Map и молча затирает первый,
   поэтому линтер ловит повторы на входе в registry.add*(). */
(function (G) {
  'use strict';

  G.registry.addResource({ id: 'energy', name: '⌁ Второй', scope: 'run' });
  G.registry.addMechanic({ id: 'runboard', order: 3, name: 'Дубль доски', scope: 'run' });
  G.registry.addTier({ id: 'tier1', name: 'Дубль яруса' });
  G.registry.addUpgrades([
    { id: 'base_mult', mech: 'core', res: 'energy', formula: 'lvl' }
  ]);

  G.content.omega.rules.push({ id: 'w_one', cost: 2, text: 'дубль правила' });
  G.content.patterns.types.push({ id: 'triple', name: 'Дубль типа' });
})(window.G = window.G || {});
