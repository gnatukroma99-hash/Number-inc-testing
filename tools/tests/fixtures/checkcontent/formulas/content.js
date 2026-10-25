/* Фикстур: битые строки-формулы — неизвестная переменная, переполнение
   в Infinity (на lvl 0 даёт NaN) и цена в цифрах, уходящая в бесконечность. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    { id: 'f_broken', mech: 'runboard', res: 'energy', formula: 'bogus * lvl' },
    { id: 'f_inf', mech: 'runboard', res: 'energy', formula: '2 ** 2000 * lvl' },
    { id: 'f_costd', mech: 'runboard', costD: '1e400 * lvl' }
  ]);
})(window.G = window.G || {});
