/* content/cracks.js — ТРЕЩИНЫ ⟁ (Ярус 3, v0.33.0): активная механика ПРОБОЯ.
   После ПРОБОЯ стена 1e1000 уже сломана, но её осколки живут: время от времени
   в интерфейсе открывается трещина ⟁. Успел нажать — получаешь Ψ и навсегда
   расширяешь плоскость (span), не успел — трещина зарастает и ждёт следующей.

   Данные: интервалы, жизнь, награда, апгрейды за Ψ. Логика — systems/cracks.js. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.cracks = {
    id: 'cracks',

    /* открывается вместе с Ярусом 3 */
    minD: 1000,

    /* сколько секунд до следующей трещины (база и разброс) */
    spawnEvery: 26,
    spawnJitter: 12,

    /* сколько живёт открытая трещина */
    life: 12,

    /* базовая награда за трещину */
    rewardPsi: 2,

    /* сколько span даёт КАЖДАЯ сломанная трещина (навсегда, множится «Расколом») */
    spanPerBreak: 0.004,

    hint: 'Трещины ⟁ — осколки сломанной стены: открываются сами раз в полминуты и живут ~12 секунд. ' +
      'Жми по трещине — получишь Ψ и навсегда расширишь плоскость софткапа (span). ' +
      'Это единственный актив в Ярусе 3, но он же и кормит следующий ПРОБОЙ.',

    /* --- апгрейды за Ψ --- */
    upgrades: [
      {
        id: 'cr_rate', mech: 'cracks', scope: 'meta', res: 'psi', icon: 'fast',
        name: 'Частые трещины', base: 3, growth: 2.0, max: 6,
        formula: '1 / (0.85 ** lvl)', fmt: 'x', crackGap: '0.85 ** lvl',
        note: 'пауза между трещинами ×= 0.85^ур.'
      },
      {
        id: 'cr_life', mech: 'cracks', scope: 'meta', res: 'psi', icon: 'clock',
        name: 'Долгая трещина', base: 3, growth: 2.0, max: 5,
        formula: '4 * lvl', fmt: 'num', crackLife: '4 * lvl',
        note: 'трещина живёт +4·ур. с'
      },
      {
        id: 'cr_give', mech: 'cracks', scope: 'meta', res: 'psi', icon: 'facet',
        name: 'Ψ из трещины', base: 4, growth: 2.1, max: 6,
        formula: '1.6 ** lvl', fmt: 'x', crackPower: '1.6 ** lvl',
        note: 'Ψ за трещину ×= 1.6^ур.'
      },
      {
        id: 'cr_span', mech: 'cracks', scope: 'meta', res: 'psi', icon: 'axe',
        name: 'Раскол плоскостей', base: 5, growth: 2.2, max: 5,
        formula: '1 + 0.5 * lvl', fmt: 'x', crackSpan: '1 + 0.5 * lvl',
        note: 'span за каждую трещину ×= (1 + 0.5·ур.)'
      },
      {
        id: 'cr_burst', mech: 'cracks', scope: 'meta', res: 'psi', icon: 'burst',
        name: 'Землетрясение', base: 6, growth: 2.3, max: 4,
        formula: '1.5 * lvl', fmt: 'num', psiGainMult: '1 + 0.5 * lvl',
        note: 'Ψ за ПРОБОЙ ×= (1 + 0.5·ур.)'
      }
    ]
  };

  /* апгрейды — обычные записи реестра: эффекты собирают общие свипы движка */
  G.registry.addUpgrades(G.content.cracks.upgrades);
})(window.G = window.G || {});
