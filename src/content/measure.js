/* content/measure.js — МЕРА ⁿ (Ярус 3, v0.34.0): бонусы от ПОРЯДКА величины.
   Число N = 10^D, и до сих пор игра смотрела на мантиссу (цифры N). Мера смотрит
   на САМ ПОКАЗАТЕЛЬ D: его цифры, сумму, нули, чётность, простоту, палиндром,
   «круглость» (1000, 5000, 12000) — и каждый удачный показатель усиливает M.

   Все формулы свойств — строки в данных: движок ничего про «меру» не знает,
   systems/measure.js просто перемножает то, что здесь объявлено. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.measure = {
    id: 'measure',

    /* мера открывается вместе с Ярусом 3 */
    minD: 1000,

    /* скан показателя 4 раза в секунду (как у паттернов мантиссы) */
    scanEvery: 0.25,

    hint: 'Мера ⁿ — взгляд на САМ порядок числа (показатель D), а не на мантиссу. ' +
      'Чётный показатель, простой, палиндром, с нулями или «круглый» (1000, 5000) — ' +
      'каждое свойство множит M, если вложить в него Ψ. Лови удачные показатели: ' +
      'они меняются, пока растёт число.',

    /* --- свойства показателя. lvl — уровень привязанного апгрейда ---
       Возвращают true/false (активно ли свойство) и формулу множителя. */
    props: [
      {
        id: 'sum', upg: 'ms_sum', name: 'Сумма показателя', tag: 'Σ',
        test: 'sum > 0', formula: '1 + 0.006 * sum * lvl',
        desc: 'каждая единица суммы цифр показателя даёт +0.6 % за уровень',
        color: '#38bdf8'
      },
      {
        id: 'zeros', upg: 'ms_zero', name: 'Нули в показателе', tag: '0',
        test: 'zeros > 0', formula: '1 + 0.06 * zeros * lvl',
        desc: 'каждый нуль в показателе даёт +6 % за уровень',
        color: '#7cf7b0'
      },
      {
        id: 'even', upg: 'ms_even', name: 'Чётный порядок', tag: '2',
        test: 'even > 0', formula: '1 + 0.18 * lvl',
        desc: 'чётный показатель — +18 % за уровень',
        color: '#a78bfa'
      },
      {
        id: 'prime', upg: 'ms_prime', name: 'Простой порядок', tag: '❖',
        test: 'prime > 0', formula: '1 + 0.3 * lvl',
        desc: 'простой показатель — +30 % за уровень',
        color: '#ffd166'
      },
      {
        id: 'pal', upg: 'ms_pal', name: 'Палиндром порядка', tag: '⧗',
        test: 'pal > 0', formula: '1 + 0.5 * lvl',
        desc: 'показатель-палиндром (1221, 10001) — +50 % за уровень',
        color: '#c9a0ff'
      },
      {
        id: 'round', upg: 'ms_round', name: 'Круглый порядок', tag: '○',
        test: 'round > 0', formula: '1 + 0.35 * lvl',
        desc: 'показатель из одной значащей цифры (1000, 5000) — +35 % за уровень',
        color: '#ff9de2'
      },
      {
        id: 'len', upg: 'ms_len', name: 'Длина порядка', tag: 'ⁿ',
        test: 'len > 0', formula: '1 + 0.02 * len * lvl',
        desc: 'каждая цифра в показателе — +2 % за уровень',
        color: '#22d3ee'
      }
    ],

    /* --- апгрейды за Ψ --- */
    upgrades: [
      { id: 'ms_sum', mech: 'measure', scope: 'meta', res: 'psi', icon: 'sigma', name: 'Сумма меры',
        base: 3, growth: 2.0, max: 6, formula: '1 + 0.006 * lvl', fmt: 'x', note: 'свойство «сумма» × уровень' },
      { id: 'ms_zero', mech: 'measure', scope: 'meta', res: 'psi', icon: 'grain', name: 'Ноль в мере',
        base: 3, growth: 2.0, max: 6, formula: '1 + 0.06 * lvl', fmt: 'x', note: 'свойство «нули» × уровень' },
      { id: 'ms_even', mech: 'measure', scope: 'meta', res: 'psi', icon: 'cycle', name: 'Чёткая мера',
        base: 4, growth: 2.1, max: 5, formula: '1 + 0.18 * lvl', fmt: 'x', note: 'чётный показатель' },
      { id: 'ms_prime', mech: 'measure', scope: 'meta', res: 'psi', icon: 'prime', name: 'Простая мера',
        base: 5, growth: 2.2, max: 5, formula: '1 + 0.3 * lvl', fmt: 'x', note: 'простой показатель' },
      { id: 'ms_pal', mech: 'measure', scope: 'meta', res: 'psi', icon: 'link', name: 'Симметрия меры',
        base: 6, growth: 2.3, max: 4, formula: '1 + 0.5 * lvl', fmt: 'x', note: 'показатель-палиндром' },
      { id: 'ms_round', mech: 'measure', scope: 'meta', res: 'psi', icon: 'target', name: 'Круглая мера',
        base: 6, growth: 2.3, max: 4, formula: '1 + 0.35 * lvl', fmt: 'x', note: 'круглый показатель' },
      { id: 'ms_len', mech: 'measure', scope: 'meta', res: 'psi', icon: 'chart', name: 'Длинная мера',
        base: 4, growth: 2.1, max: 6, formula: '1 + 0.02 * lvl', fmt: 'x', note: 'каждая цифра порядка' },
      { id: 'ms_beauty', mech: 'measure', scope: 'meta', res: 'psi', icon: 'star', name: 'Красота навсегда',
        base: 7, growth: 2.4, max: 5, formula: '0.002 * lvl', fmt: 'num',
        note: 'span = 1 + 0.002·ур.·красивых порядков (постоянно)' },
      { id: 'ms_flow', mech: 'measure', scope: 'meta', res: 'psi', icon: 'fast', name: 'Мера потока',
        base: 8, growth: 2.4, max: 5, formula: '1 + 0.1 * lvl', fmt: 'x', psiRateMult: '1 + 0.1 * lvl',
        note: 'Ψ-поток ×= (1 + 0.1·ур.)' }
    ]
  };

  G.registry.addUpgrades(G.content.measure.upgrades);
})(window.G = window.G || {});
