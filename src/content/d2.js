/* content/d2.js — ИЗМЕРЕНИЕ 2 «ОСИ Ξ» (v0.36.0): данные первого среза.
   D2 — второе измерение: не «ещё одна доска», а параллельный мир, в котором число
   растёт осями. Здесь ТОЛЬКО данные (ТЗ docs/DIMENSION2.md §5.2): 8 осей, Boost,
   Схлопывание, 6 апгрейдов и 4 связи. Системы (G.d2Growth / G.d2Collapse / G.d2Links)
   читают их через G.content.d2 и G.formula, сами ничего не знают про имена.

   Валюты (ТЗ §3): Ξ (res.axis) — тратится на уровни осей и Boost, сбрасывается
   Схлопыванием; ⌬ (res.essence) — вечная, на неё покупаются upgrades и links.

   Ось: cost = baseCost * costGrowth ** lvl (в Ξ), потолок max уровней, unlockD —
   D₂, с которого ось открывается. boost: cost = base * growth ** lvl (в Ξ).
   collapse.gainFormula — ⌬ за Схлопывание (переменные: D, collapses),
   collapse.startFormula — старт D₂ после сброса (essence, lvlLinkStart, lvlStart).

   Как добавить ось: одна строка в axes ниже; idx идёт подряд с 1, unlockD — по возрастанию. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  /* ⌬ — вечная валюта D2. Регистрируем как ресурс, чтобы общий checkcontent видел
     ссылки d2tree-узлов (res: 'essence'), а G.initResources держал зеркало в state.res. */
  if (G.registry && typeof G.registry.addResource === 'function') {
    G.registry.addResource({ id: 'essence', name: '⌬ Эссенция', scope: 'meta-d2', value: 0 });
  }

  G.content.d2 = {
    id: 'd2',

    /* гейт открытия D2 поверх проверки Яруса 4 (ТЗ §4) */
    gate: { turns: 10 },

    /* 8 осей Ξ: уровни покупаются за Ξ, amount_i копится сама в systems/d2-growth.js */
    axes: [
      {
        id: 'axis1', idx: 1, name: 'Длина', short: 'I', icon: 'x',
        baseCost: 10, costGrowth: 1.80, max: 100, baseRate: 0.10, unlockD: 0
      },
      {
        id: 'axis2', idx: 2, name: 'Ширина', short: 'II', icon: 'y',
        baseCost: 40, costGrowth: 1.85, max: 100, baseRate: 0.08, unlockD: 5
      },
      {
        id: 'axis3', idx: 3, name: 'Высота', short: 'III', icon: 'z',
        baseCost: 160, costGrowth: 1.90, max: 100, baseRate: 0.06, unlockD: 10
      },
      {
        id: 'axis4', idx: 4, name: 'Глубина', short: 'IV', icon: 'd',
        baseCost: 640, costGrowth: 1.95, max: 100, baseRate: 0.05, unlockD: 15
      },
      {
        id: 'axis5', idx: 5, name: 'Время', short: 'V', icon: 'clock',
        baseCost: 2.5e3, costGrowth: 2.00, max: 100, baseRate: 0.04, unlockD: 20
      },
      {
        id: 'axis6', idx: 6, name: 'Порядок', short: 'VI', icon: 'sigma',
        baseCost: 1e4, costGrowth: 2.05, max: 100, baseRate: 0.03, unlockD: 25
      },
      {
        id: 'axis7', idx: 7, name: 'Хаос', short: 'VII', icon: 'sparkle',
        baseCost: 4e4, costGrowth: 2.10, max: 100, baseRate: 0.02, unlockD: 30
      },
      {
        id: 'axis8', idx: 8, name: 'Предел', short: 'VIII', icon: 'star',
        baseCost: 1.6e5, costGrowth: 2.15, max: 100, baseRate: 0.015, unlockD: 35
      }
    ],

    /* Boost Ξ: общий множитель скорости осей 2 ** lvl (ТЗ §5.3) */
    boost: { base: 50, growth: 4, max: 20 },

    /* Схлопывание — престиж D2: сбрасывает оси/Ξ/Boost, даёт вечные ⌬ */
    collapse: {
      minD: 100,
      gainFormula: 'max(1, floor(pow(max(0, D - 100) / 10, 0.8) * (1 + 0.1 * collapses)))',
      startFormula: '10 + 5 * essence + 20 * lvlLinkStart + 10 * lvlStart'
    },

    /* апгрейды Схлопывания: res 'essence' (⌬), scope 'meta-d2' — не сбрасываются */
    upgrades: [
      { id: 'd2_start', name: 'Стартовая ось', desc: 'старт D₂ +10·ур.', base: 1, growth: 2.0, max: 10, res: 'essence' },
      { id: 'd2_rate', name: 'Ускорение осей', desc: 'скорость осей ×1.5^ур.', base: 1, growth: 2.2, max: 8, res: 'essence', d2RateMult: '1.5 ** lvl' },
      { id: 'd2_xi', name: 'Плотность Ξ', desc: 'Ξ ×1.5^ур.', base: 1, growth: 2.4, max: 8, res: 'essence', d2XiMult: '1.5 ** lvl' },
      { id: 'd2_boost', name: 'Дешёвый Boost', desc: 'цена Boost ×0.8^ур.', base: 2, growth: 2.5, max: 6, res: 'essence', d2BoostCostMult: '0.8 ** lvl' },
      { id: 'd2_collapse', name: 'Глубокий сброс', desc: '⌬ ×1.25^ур.', base: 3, growth: 2.6, max: 6, res: 'essence', d2CollapseMult: '1.25 ** lvl' },
      { id: 'd2_soft', name: 'Плоскость D2', desc: 'span софткапа ×1.5^ур.', base: 2, growth: 2.3, max: 5, res: 'essence', d2SpanMult: '1.5 ** lvl' }
    ],

    /* связи D1 ↔ D2: тоже за ⌬ и тоже вечные */
    links: [
      { id: 'link_start', name: 'Мост старта', desc: 'старт D₂ +20·ур.', base: 2, growth: 2.0, max: 5, res: 'essence' },
      { id: 'link_m', name: 'Отражение M', desc: 'M D1 ×(1 + 0.05·ур.)', base: 3, growth: 2.3, max: 6, res: 'essence' },
      { id: 'link_xi', name: 'Течение Ξ', desc: 'Ξ ×1.25^ур.', base: 2, growth: 2.2, max: 6, res: 'essence', d2XiMult: '1.25 ** lvl' },
      { id: 'link_collapse', name: 'Глубина связи', desc: '⌬ ×1.2^ур.', base: 4, growth: 2.5, max: 4, res: 'essence' }
    ]
  };
})(window.G = window.G || {});
