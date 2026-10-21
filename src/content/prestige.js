/* content/prestige.js — данные первого перерождения (P1).
   ◆ Ядра — мета-ресурс: не сбрасываются никогда и дают постоянный множитель к M. */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.prestige = {
    id: 'p1',
    name: 'Перерождение P1',
    minD: 10,
    /* сколько ◆ даёт текущий D: floor(((D − minD) / 4)^0.75) */
    gainFormula: 'floor(pow(max(0, D - minD) / 4, 0.75))',
    /* постоянный множитель к M от ядер */
    coreMultFormula: '1.5 ** cores',
    resetScopes: ['run'],
    /* стартовые цифры после перерождения — узел дерева ◆ (данные) */
    start: { node: 'tree_headstart', formula: '2 * lvl' },
    keepHint: 'Остаются: ◆ Ядра, ❖ ПРАЙМ, авто-апгрейды (scope meta), дерево ◆, рекорды.',
    resetHint: 'Сбрасываются: N, ⚡, все раундовые апгрейды, магазин и данные механик.'
  };
})(window.G = window.G || {});
