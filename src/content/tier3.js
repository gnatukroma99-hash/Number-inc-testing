/* content/tier3.js — ЯРУС 3 «ПРОБОЙ» (v0.24.0).
   Третий престиж: снимает стену 1e1000 навсегда и даёт Ψ (пси).
   Сбрасывает забег И ярус 2 (Δ, глифы, пакты — заново, но быстрее), оставляет ◆, дерево, Ψ,
   достижения и знаки.

   Чтобы до стены вообще можно было дойти, в Ярусе 2 есть «Плоскость» (апгрейд за Δ, spanMult)
   и правило мира Ω «Плоский мир» — без них рост за 1e308 почти останавливается. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  /* Ψ — валюта Яруса 3: не сбрасывается НИКОГДА */
  G.registry.addResource({ id: 'psi', name: 'Ψ Пси', scope: 'meta', value: 0 });

  G.content.breakthrough = {
    id: 'breakthrough',
    minD: 1000,
    gainFormula: 'pow(max(0, D - 1000), 0.85) * (1 + 0.1 * breaks)',
    barrier: 'wall_1000',
    tier: 'tier3',
    resetScopes: ['run', 'tier'],
    hint: 'ПРОБОЙ — третий слой. Число ломает стену 1e1000, и из него выжимаются Ψ. ' +
      'Сгорит забег И весь Ярус 2 (Δ, глифы, пакты, испытания заново), а останутся ◆, дерево, Ψ, ' +
      'достижения и знаки. Ψ тратятся на ускорение Яруса 2 — следующий проход будет короче.',
    keeps: ['Ψ Пси', '◆ Ядра и дерево', 'достижения и знаки', 'настройки и облако'],
    loses: ['Δ и весь Ярус 2', '⌁ энергия, ❖ ПРАЙМ', 'апгрейды забега']
  };

  G.registry.addTier({
    id: 'tier3', name: 'Логарифм', op: 'log', range: [1000, 10000], locked: true,
    desc: 'Открывается ПРОБОЕМ на стене 1e1000.'
  });

  /* --- Ψ-апгрейды: ускоряют следующий проход Яруса 2 --- */
  G.registry.addUpgrades([
    {
      id: 'psi_start', mech: 'breakthrough', scope: 'meta', res: 'psi', icon: 'rocket',
      name: 'Ψ-рывок', base: 2, growth: 2.1, max: 6,
      formula: '20 * lvl', fmt: 'num', addM: '20 * lvl',
      note: '+20·lvl к базовому множителю M',
      desc: 'После ПРОБОЯ забег начинается злее.'
    },
    {
      id: 'psi_delta', mech: 'breakthrough', scope: 'meta', res: 'psi', icon: '◈',
      name: 'Ψ-осколки', base: 3, growth: 2.2, max: 6,
      formula: '2 ** lvl', fmt: 'x', deltaGainMult: '2 ** lvl',
      note: 'Δ за БУМ ×= 2^lvl',
      desc: 'Ярус 2 проходится быстрее: осколков больше.'
    },
    {
      id: 'psi_cores', mech: 'breakthrough', scope: 'meta', res: 'psi', icon: 'core',
      name: 'Ψ-ядра', base: 4, growth: 2.3, max: 6,
      formula: '2 ** lvl', fmt: 'x', coreGainMult: '2 ** lvl',
      note: '◆ за перерождение ×= 2^lvl',
      desc: 'Дерево качается заметно быстрее.'
    },
    {
      id: 'psi_span', mech: 'breakthrough', scope: 'meta', res: 'psi', icon: 'axe',
      name: 'Ψ-плоскость', base: 5, growth: 2.4, max: 5,
      formula: '1.8 ** lvl', fmt: 'x', spanMult: '1.8 ** lvl',
      note: 'span (плоскость софткапа) ×= 1.8^lvl',
      desc: 'Стена 1e1000 приближается — следующий ПРОБОЙ будет легче.'
    },
    {
      id: 'psi_speed', mech: 'breakthrough', scope: 'meta', res: 'psi', icon: 'fast',
      name: 'Ψ-темп', base: 3, growth: 2.2, max: 5,
      formula: '0.3 * lvl', fmt: 'num', speedBonus: '0.3 * lvl',
      note: 'скорость +0.3·lvl',
      desc: 'Всё, что живёт на ΔT, идёт быстрее.'
    }
  ]);
})(window.G = window.G || {});
