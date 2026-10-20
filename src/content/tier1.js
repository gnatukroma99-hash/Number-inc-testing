/* content/tier1.js — данные Яруса 1: ресурсы, базовые апгрейды, ярусы, барьеры.
   Никакой логики. Добавление контента = правка/новый файл здесь. */
(function (G) {
  'use strict';

  /* ============ РЕСУРСЫ ============ */
  G.registry.addResource({ id: 'energy', name: '⚡ Энергия', scope: 'run', value: 0 });
  G.registry.addResource({ id: 'prime', name: '❖ ПРАЙМ', scope: 'tier', value: 0 });

  /* ============ БАЗОВЫЕ АПГРЕЙДЫ РОСТА ============ */
  G.registry.addUpgrades([
    {
      id: 'mult1', mech: 'core', name: 'Множитель', res: 'energy',
      base: 8, growth: 1.55, max: Infinity,
      formula: '2 + lvl', fmt: 'x',
      note: 'M_base = 2 + lvl'
    },
    {
      id: 'speed1', mech: 'core', name: 'Разгон', res: 'energy',
      base: 5, growth: 1.65, max: Infinity,
      formula: '0.1 * lvl', fmt: 'pct',
      note: 'ΔT = 60 / (1 + speedBonus)'
    },
    {
      id: 'energy1', mech: 'core', name: 'Поток', res: 'energy',
      base: 40, growth: 1.8, max: Infinity,
      formula: '1.25 ** lvl', fmt: 'x',
      note: 'E = 0.4·(1+log10 N)² · 1.25^lvl'
    }
  ]);

  /* ============ ЯРУСЫ ============ */
  G.registry.addTier({
    id: 'tier1', name: 'Арифметика', op: '×', range: [0, 308],
    desc: 'Число умножается. Цифры дают бонусы.'
  });
  G.registry.addTier({
    id: 'tier2', name: 'Экспонента', op: '^', range: [308, 1000], locked: true,
    desc: 'Открывается БОЛЬШИМ БУМОМ на стене 1e308.'
  });

  /* ============ БАРЬЕРЫ (софткапы) ============ */
  G.content = G.content || {};
  G.content.barriers = [
    {
      id: 'wall_308',
      wall: 308,
      taper: 10,              // ширина зоны затухания в цифрах
      grantsTier: 'tier2',
      title: 'Стена порядка',
      hint: 'Дальше нужен БОЛЬШОЙ БУМ (в следующей версии)'
    },
    {
      id: 'wall_1000',
      wall: 1000,
      taper: 25,
      grantsTier: 'tier3',
      title: 'Стена экспоненты',
      hint: 'Пробой показателя (в следующей версии)'
    }
  ];
})(window.G = window.G || {});
