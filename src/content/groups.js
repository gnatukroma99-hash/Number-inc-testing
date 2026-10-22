/* content/groups.js — группы досок для навигации (v0.18.0).
   Раньше все 24 доски висели одним списком — к середине игры в нём теряешься.
   Теперь они разложены по жизненному циклу: забег → мета → Ярус 2.
   Это данные: порядок и состав групп правится здесь, движок их не знает. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.groups = [
    {
      id: 'run', name: 'Забег', hint: 'сбрасывается перерождением',
      color: '#2bb5ff',
      mechs: ['core', 'slot', 'digitsum', 'primefit', 'primeranks', 'analysis', 'shop', 'sieve', 'mirror']
    },
    {
      id: 'meta', name: 'Мета', hint: 'не сбрасывается никогда',
      color: '#ffd166',
      mechs: ['spark', 'prestige', 'tree', 'achievements']
    },
    {
      id: 'tier2', name: 'Ярус 2', hint: 'после БОЛЬШОГО БУМА',
      color: '#c9a0ff',
      mechs: ['bigbang', 'constellations', 'glyphs', 'pacttree', 'omega',
        'challenges', 'pacts', 'duplicator', 'echo', 'chrono', 'rift']
    }
  ];
})(window.G = window.G || {});
