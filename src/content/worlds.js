/* content/worlds.js — карта миров D1/D2 (+ закрытый D3). ТЗ: docs/CELESTIALS.md §8.
   Данные, а не логика: `world` — какой мир включает узел (переключает ui/d2-world.js),
   `locked: true` — узел-витрина, который ещё не существует. Карта миров (ui/world-map.js)
   читает только этот список; порядок узлов = порядок линий на карте. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.worlds = [
    { id: 'd1', name: 'Цифры', symbol: '∞', world: 'd1', color: '#35e2c0' },
    { id: 'd2', name: 'Оси Ξ', symbol: 'Ξ', world: 'd2', color: '#ff9de2' },
    { id: 'd3', name: '???', symbol: '∅', locked: true, color: '#7d94a6' }
  ];
})(window.G = window.G || {});
