/* content/groups.js — группы досок для навигации (v0.18.0).
   Раньше все 24 доски висели одним списком — к середине игры в нём теряешься.
   Теперь они разложены по жизненному циклу: забег → мета → Ярус 2.
   Это данные: порядок и состав групп правится здесь, движок их не знает.
   С v0.36.0 у группы есть world: 'd2' — доски второго измерения (доки
   фильтруют группы по миру, см. docs/DIMENSION2.md §5.2). */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.groups = [
    {
      id: 'run', name: 'Забег', hint: 'сбрасывается перерождением',
      color: '#2bb5ff',
      mechs: ['core', 'combo', 'slot', 'digitsum', 'primefit', 'primeranks', 'analysis', 'shop', 'sieve', 'mirror', 'patterns']
    },
    {
      id: 'meta', name: 'Мета', hint: 'не сбрасывается никогда',
      color: '#ffd166',
      mechs: ['spark', 'prestige', 'tree', 'achievements']
    },
    {
      id: 'tier2', name: 'Ярус 2', hint: 'после БОЛЬШОГО БУМА',
      color: '#c9a0ff',
      mechs: ['bigbang', 'constellations', 'glyphs', 'pacttree',
        'challenges', 'pacts', 'duplicator', 'echo', 'chrono', 'rift']
    },
    {
      id: 'tier3', name: 'Ярус 3', hint: 'после ПРОБОЯ',
      color: '#ff9de2',
      mechs: ['breakthrough', 'cracks', 'measure', 'psitree', 'omega']
    },
    {
      id: 'tier4', name: 'Ярус 4', hint: 'после ОБОРОТА',
      color: '#a3e635',
      mechs: ['turn', 'turntree']
    },
    {
      id: 'd2', name: 'Измерение 2',
      color: '#ff9de2', world: 'd2',
      mechs: ['d2axes', 'd2collapse', 'd2links', 'd2tree',
        'celestials', 'd2achievements', 'd2milestones']
    }
  ];
})(window.G = window.G || {});
