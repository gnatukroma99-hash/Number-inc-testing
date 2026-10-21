/* content/automation.js — «Авто»-апгрейды. Купил один раз (scope meta) —
   доска сама покупает свои апгрейды, вкладку можно не открывать.
   Авто-апгрейды живут на доске «Рост», чтобы не плодить новые вкладки. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    { id: 'auto_core', mech: 'core', scope: 'meta', name: 'Авто: Рост', res: 'energy', base: 500, growth: 1, max: 1, autoMech: 'core', formula: 'lvl', fmt: 'pct', note: 'сам покупает апгрейды доски «Рост»' },
    { id: 'auto_digitsum', mech: 'core', scope: 'meta', name: 'Авто: Цифры', res: 'energy', base: 1200, growth: 1, max: 1, autoMech: 'digitsum', formula: 'lvl', fmt: 'pct', note: 'сам покупает апгрейды доски «Сумма цифр»' },
    { id: 'auto_primefit', mech: 'core', scope: 'meta', name: 'Авто: Прайм-цифры', res: 'energy', base: 4000, growth: 1, max: 1, autoMech: 'primefit', formula: 'lvl', fmt: 'pct', note: 'сам покупает апгрейды доски «Прайм-стайл»' },
    { id: 'auto_analysis', mech: 'core', scope: 'meta', name: 'Авто: Анализ', res: 'energy', base: 25000, growth: 1, max: 1, autoMech: 'analysis', formula: 'lvl', fmt: 'pct', note: 'сам покупает апгрейды доски «Цифровой анализ»' },
    { id: 'auto_primeranks', mech: 'core', scope: 'meta', name: 'Авто: ПРАЙМ', res: 'prime', base: 4, growth: 1, max: 1, autoMech: 'primeranks', formula: 'lvl', fmt: 'pct', note: 'сам покупает апгрейды за ❖' },
    { id: 'auto_shop', mech: 'core', scope: 'meta', name: 'Авто: Магазин', res: 'energy', base: 150000, growth: 1, max: 1, autoMech: 'shop', formula: 'lvl', fmt: 'pct', note: 'сам покупает товары магазина (не чаще 1 раза в 10 с)' }
  ]);
})(window.G = window.G || {});
