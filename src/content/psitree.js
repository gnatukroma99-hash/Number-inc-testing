/* content/psitree.js — Ψ-ДЕРЕВО (Ярус 3, v0.26.0): 12 узлов, 4 ветви.
   Второе дерево на том же движке, что и «Дерево ◆» (mechanics/tree/engine.js):
   узлы — обычные апгрейды с res:'psi' и scope:'meta', поэтому новых полей
   в сейве НЕ нужно (уровни живут в state.upg, Ψ — в state.res.psi).

   Эффекты — общие хуки движка: spanMult / powM / deltaGainMult / coreGainMult /
   dtMult / speedBonus / energyMult / psiGainMult / psiGainAdd / shopCostMult.

   Как добавить узел: одна строка в addUpgrades() ниже.
     branch   — id из G.content.psitree.branches
     depth    — глубина в ветви (0 — у центра, радиус кольца)
     requires — предки; пока не куплены, узел СКРЫТ
     tier     — ярус по цене (бейдж): t1 / t2 / t3 */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.psitree = {
    res: 'psi',
    hint: 'Ψ копятся с каждым ПРОБОЕМ и не сгорают. Четыре ветви: плоскость (дорога к 1e1000), ' +
      'взрыв (быстрее Ярус 2), темп и выход Ψ. Следующий узел ветви виден после покупки предыдущего.',
    branches: [
      { id: 'plane', name: 'Плоскость', icon: 'chartUp', color: '#7fd1ff', note: 'дорога к 1e1000', angle: -135 },
      { id: 'boom', name: 'Взрыв', icon: 'burst', color: '#c9a0ff', note: 'Ярус 2 быстрее', angle: -45 },
      { id: 'tempo', name: 'Темп', icon: 'fast', color: '#2bb5ff', note: 'ΔT и скорость', angle: 45 },
      { id: 'psi', name: 'Пси', icon: 'sparkle', color: '#ff9de2', note: 'больше Ψ за ПРОБОЙ', angle: 135 }
    ],
    tiers: [
      { id: 't1', name: 'I' },
      { id: 't2', name: 'II' },
      { id: 't3', name: 'III' }
    ]
  };

  G.registry.addUpgrades([
    /* ================= ветвь «Плоскость» ================= */
    {
      id: 'ps_cut', mech: 'psitree', branch: 'plane', depth: 0, tier: 't1',
      scope: 'meta', res: 'psi', icon: 'facet',
      name: 'Ψ-срез', base: 3, growth: 1.60, max: 2,
      formula: '1.35 ** lvl', fmt: 'x', spanMult: '1.35 ** lvl',
      note: 'плоскость софткапа ×= 1.35^lvl',
      desc: 'Тормоз роста отодвигается — до стены 1e1000 ближе.'
    },
    {
      id: 'ps_stretch', mech: 'psitree', branch: 'plane', depth: 1, tier: 't2',
      scope: 'meta', res: 'psi', icon: 'sigma',
      name: 'Ψ-растяжение', base: 10, growth: 1.70, max: 2,
      formula: '1.03 ** lvl', fmt: 'x', powM: '1.03 ** lvl',
      requires: ['ps_cut'],
      note: 'бонус механик ^ (1.03^lvl), степень ≤ 1.5',
      desc: 'Степень над всем, что дают доски. Дорого и очень зло.'
    },
    {
      id: 'ps_horizon', mech: 'psitree', branch: 'plane', depth: 2, tier: 't3',
      scope: 'meta', res: 'psi', icon: 'chartUp',
      name: 'Ψ-горизонт', base: 34, growth: 2.00, max: 1,
      formula: '2', fmt: 'x', spanMult: '2',
      requires: ['ps_stretch'],
      note: 'плоскость софткапа ×2 (разово)',
      desc: 'Стена 1e1000 видна с балкона: следующий ПРОБОЙ вдвое ближе.'
    },

    /* ================= ветвь «Взрыв» ================= */
    {
      id: 'ps_shard', mech: 'psitree', branch: 'boom', depth: 0, tier: 't1',
      scope: 'meta', res: 'psi', icon: 'delta',
      name: 'Ψ-осколок', base: 3, growth: 1.60, max: 2,
      formula: '1.6 ** lvl', fmt: 'x', deltaGainMult: '1.6 ** lvl',
      note: 'Δ за БУМ ×= 1.6^lvl',
      desc: 'БОЛЬШОЙ БУМ платит больше — Ярус 2 проходится быстрее.'
    },
    {
      id: 'ps_chain', mech: 'psitree', branch: 'boom', depth: 1, tier: 't2',
      scope: 'meta', res: 'psi', icon: 'link',
      name: 'Ψ-цепь', base: 10, growth: 1.70, max: 2,
      formula: '1.4 ** lvl', fmt: 'x', coreGainMult: '1.4 ** lvl',
      requires: ['ps_shard'],
      note: '◆ за перерождение ×= 1.4^lvl',
      desc: 'Ядра капают гуще — дерево ◆ качается быстрее.'
    },
    {
      id: 'ps_doubleboom', mech: 'psitree', branch: 'boom', depth: 2, tier: 't3',
      scope: 'meta', res: 'psi', icon: 'burst',
      name: 'Двойной БУМ', base: 40, growth: 2.00, max: 1,
      formula: '2', fmt: 'x', deltaGainMult: '2',
      requires: ['ps_chain'],
      note: 'Δ за БУМ ×2 (разово)',
      desc: 'Один БУМ, два мешка осколков. Скидки нет.'
    },

    /* ================= ветвь «Темп» ================= */
    {
      id: 'ps_freq', mech: 'psitree', branch: 'tempo', depth: 0, tier: 't1',
      scope: 'meta', res: 'psi', icon: 'clock',
      name: 'Ψ-частота', base: 2, growth: 1.70, max: 3,
      formula: '1 / (0.93 ** lvl)', fmt: 'x', dtMult: '0.93 ** lvl',
      note: 'ΔT ×= 0.93^lvl',
      desc: 'Умножения идут чаще. Тихо, но каждый тик.'
    },
    {
      id: 'ps_pace', mech: 'psitree', branch: 'tempo', depth: 1, tier: 't2',
      scope: 'meta', res: 'psi', icon: 'fast',
      name: 'Ψ-темп', base: 8, growth: 1.70, max: 2,
      formula: '0.25 * lvl', fmt: 'num', speedBonus: '0.25 * lvl',
      requires: ['ps_freq'],
      note: 'скорость +0.25·lvl',
      desc: 'Всё живёт на ΔT — и живёт быстрее.'
    },
    {
      id: 'ps_charge', mech: 'psitree', branch: 'tempo', depth: 2, tier: 't3',
      scope: 'meta', res: 'psi', icon: 'battery',
      name: 'Ψ-заряд', base: 36, growth: 1.80, max: 2,
      formula: '1.3 ** lvl', fmt: 'x', energyMult: '1.3 ** lvl',
      requires: ['ps_pace'],
      note: 'энергия ×= 1.3^lvl',
      desc: 'Больше ⚡ — больше одноразовых ×2 из ветви энергии.'
    },

    /* ================= ветвь «Пси» ================= */
    {
      id: 'ps_yield', mech: 'psitree', branch: 'psi', depth: 0, tier: 't1',
      scope: 'meta', res: 'psi', icon: 'sparkle',
      name: 'Ψ-выход', base: 4, growth: 1.60, max: 2,
      formula: '1.5 ** lvl', fmt: 'x', psiGainMult: '1.5 ** lvl',
      note: 'Ψ за ПРОБОЙ ×= 1.5^lvl',
      desc: 'Каждый следующий ПРОБОЙ платит больше.'
    },
    {
      id: 'ps_rest', mech: 'psitree', branch: 'psi', depth: 1, tier: 't2',
      scope: 'meta', res: 'psi', icon: 'gem',
      name: 'Ψ-остаток', base: 12, growth: 1.70, max: 2,
      formula: '6 * lvl', fmt: 'num', psiGainAdd: '6 * lvl',
      requires: ['ps_yield'],
      note: 'Ψ за ПРОБОЙ += 6·lvl',
      desc: 'Плоская прибавка — работает даже на голом пороге.'
    },
    {
      id: 'ps_budget', mech: 'psitree', branch: 'psi', depth: 2, tier: 't3',
      scope: 'meta', res: 'psi', icon: 'hundred',
      name: 'Ψ-смета', base: 45, growth: 2.00, max: 1,
      formula: '0.7', fmt: 'x', shopCostMult: '0.7',
      requires: ['ps_rest'],
      note: 'цены магазина за цифры ×0.7 (разово)',
      desc: 'Магазин в забеге дешевле: число не так жалко.'
    }
  ]);
})(window.G = window.G || {});
