/* content/automation.js — «Авто»-апгрейды. Купил один раз (scope meta) —
   доска сама покупает свои апгрейды, вкладку можно не открывать.

   ВАЖНО (v0.4.0): autoBuy:false значит «эту покупку автоматизация НЕ делает сама».
   Раньше auto_core (500 ⌁) скупал все авто других досок и игра автоматизировалась
   к 1e60. Теперь право автоматизировать сами авто-апгрейды даёт только
   узел дерева ◆ «Главный автоматизатор» (25 ◆):
   id узла задаётся в G.content.automation.autoAllGate — движок id не знает. */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.automation = {
    autoAllGate: 'tree_auto_all'
  };

  G.registry.addUpgrades([
    { id: 'auto_core', icon: 'robot', mech: 'core', scope: 'meta', name: 'Авто: Рост', res: 'energy', base: 500, growth: 1, max: 1, autoMech: 'core', formula: 'lvl', fmt: 'pct', note: 'сам покупает базовые апгрейды роста (не автоматизацию других досок)' },
    { id: 'auto_digitsum', icon: 'Σ', mech: 'core', scope: 'meta', name: 'Авто: Цифры', res: 'energy', base: 1200, growth: 1, max: 1, autoMech: 'digitsum', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает апгрейды доски «Сумма цифр»' },
    { id: 'auto_primefit', icon: '⧉', mech: 'core', scope: 'meta', name: 'Авто: Прайм-цифры', res: 'energy', base: 4000, growth: 1, max: 1, autoMech: 'primefit', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает апгрейды доски «Прайм-стайл»' },
    { id: 'auto_analysis', icon: 'Δ', mech: 'core', scope: 'meta', name: 'Авто: Анализ', res: 'energy', base: 25000, growth: 1, max: 1, autoMech: 'analysis', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает апгрейды доски «Цифровой анализ»' },
    { id: 'auto_primeranks', icon: '❖', mech: 'core', scope: 'meta', name: 'Авто: ПРАЙМ', res: 'prime', base: 4, growth: 1, max: 1, autoMech: 'primeranks', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает апгрейды за ❖' },
    { id: 'auto_sieve', icon: '⌗', mech: 'core', scope: 'meta', name: 'Авто: Решето', res: 'energy', base: 3e6, growth: 1, max: 1, autoMech: 'sieve', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает апгрейды решета' },
    { id: 'auto_mirror', icon: '⧗', mech: 'core', scope: 'meta', name: 'Авто: Зеркало', res: 'energy', base: 6e6, growth: 1, max: 1, autoMech: 'mirror', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает апгрейды зеркала' },
    { id: 'auto_shop', icon: 'cart', mech: 'core', scope: 'meta', name: 'Авто: Магазин', res: 'energy', base: 150000, growth: 1, max: 1, autoMech: 'shop', formula: 'lvl', fmt: 'pct', autoBuy: false, note: 'сам покупает товары магазина (не чаще 1 раза в 10 с)' }
  ]);
})(window.G = window.G || {});
