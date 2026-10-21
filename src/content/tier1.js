/* content/tier1.js — данные Яруса 1: ресурсы, базовые апгрейды, ярусы, барьеры.
   Никакой логики. Добавление контента = правка/новый файл здесь. */
(function (G) {
  'use strict';

  /* ============ РЕСУРСЫ ============ */
  G.registry.addResource({ id: 'energy', name: '⚡ Энергия', scope: 'run', value: 0 });
  G.registry.addResource({ id: 'prime', name: '❖ ПРАЙМ', scope: 'tier', value: 0 });
  G.registry.addResource({ id: 'cores', name: '◆ Ядра', scope: 'meta', value: 0 });

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
      note: 'E = 1 · (1 + D) · 1.25^lvl'
    }
  ]);

  /* ============ ОДНОРАЗОВОЕ УСИЛЕНИЕ ЭНЕРГИИ (×2 каждое) ============
     Купил один раз — навсегда. Цены растут, поэтому брать их выгодно
     на разных этапах. Компенсируют линейную (а не квадратичную) энергию. */
  G.registry.addUpgrades([
    { id: 'energy_x2_1', mech: 'core', name: 'Форсаж I', res: 'energy', base: 150, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_2', mech: 'core', name: 'Форсаж II', res: 'energy', base: 900, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_3', mech: 'core', name: 'Форсаж III', res: 'energy', base: 5e3, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_4', mech: 'core', name: 'Форсаж IV', res: 'energy', base: 3e4, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_5', mech: 'core', name: 'Форсаж V', res: 'energy', base: 2e5, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_6', mech: 'core', name: 'Форсаж VI', res: 'energy', base: 1.5e6, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_7', mech: 'core', name: 'Форсаж VII', res: 'energy', base: 1e7, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' },
    { id: 'energy_x2_8', mech: 'core', name: 'Форсаж VIII', res: 'energy', base: 8e7, growth: 1, max: 1, formula: '2', energyMult: '2', fmt: 'x', note: '⚡ ×2 (разово)' }
  ]);

  /* ============ ЭНЕРГИЯ (данные формулы) ============
     E = base · (1 + perDigit · D) · growE^lvl(energy1) · Π(energyMult)
     «Количество нулей» = D = floor(log10 N). Раньше было D² — скейлинг уменьшен. */
  G.content = G.content || {};
  G.content.energy = {
    base: 1,
    perDigit: 1,
    growE: 1.25,
    formula: 'base * (1 + perDigit * D) * pow(growE, lvl)'
  };

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

  /* ============ НЕВИДИМЫЙ СОФТКАП ============
     Не показывается игроку. Мягко замедляет рост, начиная с knee цифр.
     factor = 1 / (1 + (max(0, D − knee)/span)^power)
     Балансируется так, чтобы 1e308 достигалось за ~85 минут со всеми механиками. */
  G.content.hiddenSoftcap = {
    knee: 5,
    span: 17.5,
    power: 1.5,
    formula: '1 / (1 + pow(max(0, D - knee) / span, power))'
  };
})(window.G = window.G || {});
