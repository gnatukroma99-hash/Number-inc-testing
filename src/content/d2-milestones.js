/* content/d2-milestones.js — ПОРОГИ D₂ (Измерение 2, фаза 2 «Hall of Celestials»).
   Восемь вечных наград за рекорд D₂ (`state.d2.stats.bestD`). Схлопывание сбрасывает
   D₂/оси/Ξ, но рекорд `bestD` не сбрасывается никогда — поэтому пороги «вечные»
   и новых полей сейва не требуют (docs/CELESTIALS.md §6).

   Читает systems/d2-milestones.js (`G.d2Milestones.mult/sum`); системы D2 подмешивают
   результат по контракту docs/CELESTIALS.md §9:
     d2RateMult     — скорость осей (d2-growth.axisRate);
     d2XiMult       — доход Ξ (d2-growth.xiRate);
     d2StartAdd     — прибавка цифр к старту D₂ (d2-collapse.startD2);
     d2CollapseMult — ⌬ за Схлопывание (d2-collapse.gain);
     d2SpanMult     — плоскость софткапа D₂ (d2-growth.barrier).
   У награды ровно одно из полей `mult` / `add` — та же форма, что у целестиалов
   (docs/CELESTIALS.md §3). `text` — готовая строка для доски.

   Как добавить порог: строка в `list` ниже (по возрастанию `reqD`); код читает
   только `reqD` и `reward`, своих чисел не знает. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.d2milestones = {
    id: 'd2milestones',
    list: [
      {
        id: 'd2m_25', reqD: 25, name: 'Первый разгон',
        reward: { field: 'd2RateMult', mult: 1.10, text: 'скорость осей ×1.10' }
      },
      {
        id: 'd2m_50', reqD: 50, name: 'Ровный поток',
        reward: { field: 'd2XiMult', mult: 1.10, text: 'доход Ξ ×1.10' }
      },
      {
        id: 'd2m_75', reqD: 75, name: 'Высокий старт',
        reward: { field: 'd2StartAdd', add: 5, text: 'старт D₂ +5 цифр' }
      },
      {
        id: 'd2m_100', reqD: 100, name: 'Чистый сброс',
        reward: { field: 'd2CollapseMult', mult: 1.10, text: '⌬ за Схлопывание ×1.10' }
      },
      {
        id: 'd2m_150', reqD: 150, name: 'Широкий коридор',
        reward: { field: 'd2SpanMult', mult: 1.10, text: 'плоскость софткапа ×1.10' }
      },
      {
        id: 'd2m_200', reqD: 200, name: 'Двойной разгон',
        reward: { field: 'd2RateMult', mult: 1.15, text: 'скорость осей ×1.15' }
      },
      {
        id: 'd2m_300', reqD: 300, name: 'Плотный поток',
        reward: { field: 'd2XiMult', mult: 1.15, text: 'доход Ξ ×1.15' }
      },
      {
        id: 'd2m_500', reqD: 500, name: 'Тяжёлый сброс',
        reward: { field: 'd2CollapseMult', mult: 1.20, text: '⌬ за Схлопывание ×1.20' }
      }
    ]
  };
})(window.G = window.G || {});
