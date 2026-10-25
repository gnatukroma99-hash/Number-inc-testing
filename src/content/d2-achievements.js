/* content/d2-achievements.js — 12 достижений ИЗМЕРЕНИЯ 2 (ТЗ docs/CELESTIALS.md §5).
   Никакой логики: id, иконка, название, подсказка и УСЛОВИЕ строкой-формулой.
   Переменные условий: D2, collapses, bestD, essence, xi, axesMin, axesMax, boost,
   links, upgrades, sigils (sigils живут в state.cel — до целестиалов там 0).

   Открытые достижения дают постоянный множитель к СКОРОСТИ ОСЕЙ D2
   (его читает systems/d2-growth.js через G.d2Achievements.mult), а не к M D1:
   второй мир не качает первый ничем, кроме связей (ТЗ §9).
   Открытие — systems/d2-achievements.js, доска — mechanics/d2achievements/.
   Новое достижение = одна строка в list ниже; код трогать не нужно. */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.d2Achievements = {
    id: 'd2achievements',

    /* бонус к скорости осей D2 от числа открытых достижений */
    multFormula: '1 + 0.01 * count',
    hint: 'Достижения второго мира открываются сами, когда оси, Ξ и ⌬ проходят важные пороги. ' +
          'Каждое даёт +1% к скорости осей D2 навсегда — второй мир растёт быстрее от собственных заслуг.',

    list: [
      /* --- Схлопывание и оси --- */
      { id: 'd2a_first', icon: 'core', name: 'Первый Схлоп', desc: 'Схлопнуть второй мир первый раз',
        cond: 'collapses >= 1' },
      { id: 'd2a_axes4', icon: 'grid', name: 'Четыре', desc: 'Поднять любую ось до 4 уровня',
        cond: 'axesMax >= 4' },
      { id: 'd2a_axes8', icon: 'grid', name: 'Все восемь', desc: 'Открыть все 8 осей хотя бы по уровню',
        cond: 'axesMin >= 1' },

      /* --- валюты D2 --- */
      { id: 'd2a_xi1k', icon: 'crystal', name: 'Тысяча Ξ', desc: 'Накопить 1 000 Ξ',
        cond: 'xi >= 1000' },
      { id: 'd2a_ess10', icon: 'facet', name: 'Эссенция', desc: 'Накопить 10 ⌬',
        cond: 'essence >= 10' },
      { id: 'd2a_coll3', icon: 'recycle', name: 'Трижды', desc: 'Схлопнуть второй мир 3 раза',
        cond: 'collapses >= 3' },

      /* --- рекорд D₂ --- */
      { id: 'd2a_best150', icon: 'star', name: 'Рекорд 150', desc: 'Дойти до D₂ ≥ 150',
        cond: 'bestD >= 150' },
      { id: 'd2a_best300', icon: 'gem', name: 'Рекорд 300', desc: 'Дойти до D₂ ≥ 300',
        cond: 'bestD >= 300' },

      /* --- мета-слой D2 --- */
      { id: 'd2a_boost5', icon: 'fast', name: 'Разгон', desc: 'Взять Boost до 5 уровня',
        cond: 'boost >= 5' },
      { id: 'd2a_links2', icon: 'link', name: 'Два моста', desc: 'Купить 2 связи D1 ↔ D2',
        cond: 'links >= 2' },
      { id: 'd2a_upg3', icon: 'cart', name: 'Три апгрейда', desc: 'Купить 3 апгрейда Схлопывания',
        cond: 'upgrades >= 3' },
      { id: 'd2a_sigil4', icon: 'trophy', name: 'Четыре сигила', desc: 'Собрать 4 сигила ☉',
        cond: 'sigils >= 4' }
    ]
  };
})(window.G = window.G || {});
