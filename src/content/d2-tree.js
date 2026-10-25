/* content/d2-tree.js — ДРЕВО D2 (Измерение 2, первый срез): 16 узлов за ⌬, 4 ветви по 4.
   То же созвездие, что у ◆/Ψ/⧜/⌁-деревьев (mechanics/tree/engine.js), но валюта — эссенция ⌬
   (вечная валюта D2), оформление — тема 'd2', и оно усиливает ТОЛЬКО Измерение 2.

   Ветви и их единственный хук (см. docs/DIMENSION2.md §8):
     start «Старт» — d2StartAdd  (сумма цифр к старту D₂ после Схлопывания);
     power «Сила»  — d2RateMult  (скорость осей Ξ);
     flow  «Поток» — d2XiMult    (доход Ξ);
     reset «Сброс» — d2CollapseMult (⌬ за Схлопывание) и d2SpanMult (плоскость софткапа D₂).

   Хуки читаются общими свипами G.growth.upgSum / upgProduct в d2-growth / d2-collapse —
   новых полей в движке нет. Mmult/spanMult здесь НЕ используются: они усилили бы D1,
   то есть дублировали бы связи (docs/DIMENSION2.md §7).

   Уровни узлов живут в обычном state.upg, поэтому сейву новых полей не нужно.
   Как добавить узел: одна строка в addUpgrades() ниже (branch / depth / requires — как в
   остальных деревьях). */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.d2tree = {
    id: 'd2tree',
    theme: 'd2',
    hint: 'Древо Измерения 2: ⌬ (эссенция) вкладывается навсегда и работает только в D2 — ' +
      'старт после Схлопывания, скорость осей, доход Ξ и глубина сброса. ⌬ даётся Схлопыванием ' +
      'и не сгорает. Следующий узел ветви виден после покупки предыдущего.',

    branches: [
      { id: 'start', name: 'Старт', color: '#ff9de2', angle: -90 },
      { id: 'power', name: 'Сила', color: '#ffd166', angle: 0 },
      { id: 'flow', name: 'Поток', color: '#7fd1ff', angle: 90 },
      { id: 'reset', name: 'Сброс', color: '#c9a0ff', angle: 180 }
    ]
  };

  /* helper: n(id, branch, depth, цена, имя, эффект, поля)
     tier 'd2' — ценовой ярус Измерения 2 (у D1 это t1..t4), fmt 'num' для прибавок, 'x' для множителей */
  function n(id, branch, depth, base, name, desc, fields) {
    return Object.assign({
      id: id, mech: 'd2tree', branch: branch, depth: depth, tier: 'd2',
      scope: 'meta-d2', res: 'essence', icon: 'facet',
      name: name, base: base, growth: 2.0, max: 2, desc: desc, autoBuy: false
    }, fields);
  }

  G.registry.addUpgrades([
    /* ---------- ветвь «Старт»: старт D₂ после Схлопывания ---------- */
    n('d2t_s1', 'start', 0, 1, 'Точка отсчёта', 'Схлопывание возвращает не в ноль, а на шаг вперёд.',
      { formula: '10 * lvl', fmt: 'num', d2StartAdd: '10 * lvl', note: 'старт D₂ +10·ур.' }),
    n('d2t_s2', 'start', 1, 2, 'Шаг вперёд', 'Каждое Схлопывание начинается выше предыдущего.',
      { formula: '25 * lvl', fmt: 'num', d2StartAdd: '25 * lvl', note: 'старт D₂ +25·ур.',
        requires: ['d2t_s1'] }),
    n('d2t_s3', 'start', 2, 4, 'Разбег', 'До первой оси — рукой подать.',
      { formula: '60 * lvl', fmt: 'num', d2StartAdd: '60 * lvl', note: 'старт D₂ +60·ур.',
        requires: ['d2t_s2'] }),
    n('d2t_s4', 'start', 3, 8, 'Запас хода', 'Старт такой высоты, что Ξ капает сразу.',
      { formula: '150 * lvl', fmt: 'num', d2StartAdd: '150 * lvl', note: 'старт D₂ +150·ур.',
        requires: ['d2t_s3'] }),

    /* ---------- ветвь «Сила»: скорость восьми осей ---------- */
    n('d2t_p1', 'power', 0, 1, 'Плотность', 'Оси набирают объём плотнее.',
      { formula: '1.25 ** lvl', fmt: 'x', d2RateMult: '1.25 ** lvl', note: 'скорость осей ×= 1.25^ур.' }),
    n('d2t_p2', 'power', 1, 2, 'Напор', 'Тот же объём — вдвое быстрее.',
      { formula: '1.4 ** lvl', fmt: 'x', d2RateMult: '1.4 ** lvl', note: 'скорость осей ×= 1.4^ур.',
        requires: ['d2t_p1'] }),
    n('d2t_p3', 'power', 2, 4, 'Сцепка', 'Оси тянут друг друга, а не сами по себе.',
      { formula: '1.6 ** lvl', fmt: 'x', d2RateMult: '1.6 ** lvl', note: 'скорость осей ×= 1.6^ур.',
        requires: ['d2t_p2'] }),
    n('d2t_p4', 'power', 3, 8, 'Перегрузка', 'Восемь осей работают на пределе.',
      { formula: '2 ** lvl', fmt: 'x', d2RateMult: '2 ** lvl', note: 'скорость осей ×= 2^ур.',
        requires: ['d2t_p3'] }),

    /* ---------- ветвь «Поток»: доход Ξ ---------- */
    n('d2t_f1', 'flow', 0, 1, 'Течение', 'Ξ капает ровнее.',
      { formula: '1.25 ** lvl', fmt: 'x', d2XiMult: '1.25 ** lvl', note: 'Ξ ×= 1.25^ур.' }),
    n('d2t_f2', 'flow', 1, 2, 'Приток', 'Больше Ξ — больше осей.',
      { formula: '1.4 ** lvl', fmt: 'x', d2XiMult: '1.4 ** lvl', note: 'Ξ ×= 1.4^ур.',
        requires: ['d2t_f1'] }),
    n('d2t_f3', 'flow', 2, 4, 'Русло', 'Поток Ξ больше не расплёскивается.',
      { formula: '1.6 ** lvl', fmt: 'x', d2XiMult: '1.6 ** lvl', note: 'Ξ ×= 1.6^ур.',
        requires: ['d2t_f2'] }),
    n('d2t_f4', 'flow', 3, 8, 'Водоворот', 'Ξ возвращается в оси с избытком.',
      { formula: '2 ** lvl', fmt: 'x', d2XiMult: '2 ** lvl', note: 'Ξ ×= 2^ур.',
        requires: ['d2t_f3'] }),

    /* ---------- ветвь «Сброс»: ⌬ за Схлопывание и плоскость софткапа ---------- */
    n('d2t_r1', 'reset', 0, 1, 'Глубина', 'Схлопывание платит эссенцией щедрее.',
      { formula: '1.25 ** lvl', fmt: 'x', d2CollapseMult: '1.25 ** lvl', note: '⌬ за Схлопывание ×= 1.25^ур.' }),
    n('d2t_r2', 'reset', 1, 2, 'Плоскость', 'Тормоз роста D₂ отодвигается.',
      { formula: '1.5 ** lvl', fmt: 'x', d2SpanMult: '1.5 ** lvl', note: 'плоскость софткапа ×= 1.5^ур.',
        requires: ['d2t_r1'] }),
    n('d2t_r3', 'reset', 2, 4, 'Тяжёлый сброс', 'Каждое Схлопывание — заметно больше ⌬.',
      { formula: '1.5 ** lvl', fmt: 'x', d2CollapseMult: '1.5 ** lvl',
        note: '⌬ за Схлопывание ×= 1.5^ур.', requires: ['d2t_r2'] }),
    n('d2t_r4', 'reset', 3, 8, 'Дальняя плоскость', 'D₂ уходит за 100 без обрыва скорости.',
      { formula: '1.8 ** lvl', fmt: 'x', d2SpanMult: '1.8 ** lvl', note: 'плоскость софткапа ×= 1.8^ур.',
        requires: ['d2t_r3'] })
  ]);
})(window.G = window.G || {});
