/* content/tier2.js — ЯРУС 2 «Экспонента» (v0.14.0).
   БОЛЬШОЙ БУМ: единственный способ снять стену 1e308 навсегда. Забег схлопывается в Δ осколки.
   Здесь только данные: валюта, формула, что сбрасывается, какую стену снимаем. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  /* валюта Яруса 2: scope 'tier' — переживает обычное перерождение (run), сбрасывается ярусом */
  G.registry.addResource({ id: 'delta', name: 'Δ Осколки', scope: 'tier', value: 0 });

  G.content.bigbang = {
    id: 'bigbang',

    /* минимальный D, с которого БУМ вообще считается */
    minD: 300,

    /* сколько Δ даёт схлопывание числа */
    gainFormula: 'pow(max(0, D - 300), 0.9) * (1 + 0.05 * runs)',

    /* стена, которую снимаем НАВСЕГДА (id из content.barriers) */
    barrier: 'wall_308',

    /* ярус, который открывается (id из registry.addTier) */
    tier: 'tier2',

    /* что сбрасывается: только забег — ◆, Δ, дерево и достижения остаются */
    resetScopes: ['run'],

    hint: 'Число схлопывается в Δ осколки, стена 1e308 снимается навсегда, и открывается Ярус 2. ' +
      'Ядра ◆, дерево и достижения не тратятся. Δ — валюта второго слоя: в следующих версиях ' +
      'на неё покупаются глифы, испытания и правила мира.',

    /* что игрок теряет и что сохраняет (для честной подписи на доске) */
    keeps: ['◆ Ядра и дерево', 'Δ Осколки', 'достижения и рекорды', 'настройки и облако'],
    loses: ['⌁ энергия, ❖ ПРАЙМ', 'все апгрейды забега', 'автомат и искры забега']
  };

  /* ============ АПГРЕЙДЫ ЯРУСА 2 (за Δ) ============
     Покупаются только осколками Δ, поэтому на первый забег не влияют.
     Поля — общие поля движка (coreGainMult/coreGainAdd/coreGainPerNode/deltaGainMult):
     их собирают systems/prestige.js и systems/bigbang.js, имён механик движок не знает. */
  G.registry.addUpgrades([
    {
      id: 't2_corebase', mech: 'bigbang', scope: 'tier', res: 'delta', icon: 'core',
      name: 'Осколки в ядра', base: 3, growth: 2.20, max: 8,
      formula: '1.6 ** lvl', fmt: 'x', coreGainMult: '1.6 ** lvl',
      note: '◆ за перерождение ×= 1.6^lvl'
    },
    {
      id: 't2_coreadd', mech: 'bigbang', scope: 'tier', res: 'delta', icon: '◆',
      name: 'Ядро сверху', base: 5, growth: 2.40, max: 6,
      formula: '5 * lvl', fmt: 'num', coreGainAdd: '5 * lvl',
      note: '+5·lvl ◆ к каждому перерождению',
      requires: ['t2_corebase']
    },
    {
      id: 't2_corepernode', mech: 'bigbang', scope: 'tier', res: 'delta', icon: 'tree',
      name: 'Узел = ядро', base: 8, growth: 2.60, max: 4,
      formula: 'lvl', fmt: 'num', coreGainPerNode: '1 * lvl',
      note: '+1·lvl ◆ за каждый купленный узел дерева',
      requires: ['t2_coreadd']
    },
    {
      id: 't2_span', mech: 'bigbang', scope: 'tier', res: 'delta', icon: 'axe',
      name: 'Плоскость', base: 6, growth: 2.20, max: 8,
      formula: '2 ** lvl', fmt: 'x', spanMult: '2 ** lvl',
      note: 'span (плоскость софткапа) ×= 2^lvl — открывает путь к 1e1000',
      desc: 'Без этого рост за 1e308 почти останавливается.'
    },
    {
      id: 't2_delta', mech: 'bigbang', scope: 'tier', res: 'delta', icon: '◈',
      name: 'Глубокий БУМ', base: 4, growth: 2.30, max: 8,
      formula: '1.3 ** lvl', fmt: 'x', deltaGainMult: '1.3 ** lvl',
      note: 'Δ за БУМ ×= 1.3^lvl'
    }
  ]);
})(window.G = window.G || {});
