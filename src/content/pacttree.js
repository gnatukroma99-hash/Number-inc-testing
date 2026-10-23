/* content/pacttree.js — ПАКТ-ДЕРЕВО ⌁ (Ярус 2, v0.18.0): 20 узлов за Δ, 4 ветви.
   В каждой ветви на одной глубине стоят ДВА взаимоисключающих узла: купил один — второй
   закрыт (и его эффект не работает). Это не «ещё бонусы», а выбор билда.

   Поля — общие поля движка (Mmult / energyMult / dtMult / speedBonus / coreGainMult /
   deltaGainMult / slotGapMult / slotPayMult / sparkPower / sparkGap), поэтому в core/ и systems/
   ничего не меняется. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.pacttree = {
    id: 'pacttree',
    hint: 'Гнилое дерево Яруса 2: те же ветви, что у ◆-дерева, но валюта — Δ осколки, ' +
      'а на каждой глубине развилка: берёшь одно, соседнее сохнет навсегда. ' +
      'Что не взял — то и не было.',

    /* оформление карты — только CSS: .tree-stage.theme-rot (файл style.css) */
    theme: 'rot',

    /* на сколько градусов расходятся два узла развилки на одной глубине */
    forkSpread: 9,

    branches: [
      { id: 'growth', name: 'Рост', color: '#a6d13f', angle: -90 },
      { id: 'speed', name: 'Скорость', color: '#5fc79a', angle: -22 },
      { id: 'meta', name: 'Мета', color: '#e0b344', angle: -158 },
      { id: 'lucky', name: 'Удача', color: '#c962a6', angle: 96 }
    ]
  };

  /* helper для краткости: n(id, branch, depth, цена, имя, эффект, поля) */
  function n(id, branch, depth, base, name, note, fields, excludes) {
    return Object.assign({
      id: id, mech: 'pacttree', branch: branch, depth: depth, tier: 't2',
      scope: 'tier', res: 'delta', icon: branch === 'meta' ? 'core' : (branch === 'lucky' ? 'slot' : '◈'),
      name: name, base: base, growth: 1.9, max: 3, note: note,
      autoBuy: false,
      requires: depth > 0 ? [] : [],
      excludes: excludes || [],
      /* закрытая развилкой ветка не даёт эффекта, даже если узел был куплен */
      isUnlocked: function (state) {
        return !(G.pacttree && G.pacttree.blockedBy(state, this));
      }
    }, fields);
  }

  G.registry.addUpgrades([
    /* --- ветвь «Рост» --- */
    n('pt_g1', 'growth', 0, 3, 'Плотность', 'M ×= 1.4^lvl', { formula: '1.4 ** lvl', fmt: 'x', Mmult: '1.4 ** lvl' }),
    n('pt_g2a', 'growth', 1, 6, 'Рост: тяга', 'M ×= 1.6^lvl', { formula: '1.6 ** lvl', fmt: 'x', Mmult: '1.6 ** lvl', requires: ['pt_g1'] }, ['pt_g2b']),
    n('pt_g2b', 'growth', 1, 6, 'Рост: опора', '⌁ ×= 1.6^lvl', { formula: '1.6 ** lvl', fmt: 'x', energyMult: '1.6 ** lvl', requires: ['pt_g1'] }, ['pt_g2a']),
    n('pt_g3a', 'growth', 2, 12, 'Сверхплотность', 'M ×= 2^lvl', { formula: '2 ** lvl', fmt: 'x', Mmult: '2 ** lvl', requires: ['pt_g2a'] }, ['pt_g3b']),
    n('pt_g3b', 'growth', 2, 12, 'Энергосеть', '⌁ ×= 2^lvl', { formula: '2 ** lvl', fmt: 'x', energyMult: '2 ** lvl', requires: ['pt_g2b'] }, ['pt_g3a']),

    /* --- ветвь «Скорость» --- */
    n('pt_s1', 'speed', 0, 3, 'Разгон пакта', 'скорость +0.12', { formula: '0.12 * lvl', fmt: 'num', speedBonus: '0.12 * lvl' }),
    n('pt_s2a', 'speed', 1, 6, 'Скорость: рывок', 'ΔT ×= 0.95^lvl', { formula: '1 / (0.95 ** lvl)', fmt: 'x', dtMult: '0.95 ** lvl', requires: ['pt_s1'] }, ['pt_s2b']),
    n('pt_s2b', 'speed', 1, 6, 'Скорость: тягач', 'скорость +0.2', { formula: '0.2 * lvl', fmt: 'num', speedBonus: '0.2 * lvl', requires: ['pt_s1'] }, ['pt_s2a']),
    n('pt_s3a', 'speed', 2, 12, 'Сверхрывок', 'ΔT ×= 0.93^lvl', { formula: '1 / (0.93 ** lvl)', fmt: 'x', dtMult: '0.93 ** lvl', requires: ['pt_s2a'] }, ['pt_s3b']),
    n('pt_s3b', 'speed', 2, 12, 'Сверхтяга', 'скорость +0.35', { formula: '0.35 * lvl', fmt: 'num', speedBonus: '0.35 * lvl', requires: ['pt_s2b'] }, ['pt_s3a']),

    /* --- ветвь «Мета» --- */
    n('pt_m1', 'meta', 0, 4, 'Осколочный сбор', 'Δ за БУМ ×= 1.25^lvl', { formula: '1.25 ** lvl', fmt: 'x', deltaGainMult: '1.25 ** lvl' }),
    n('pt_m2a', 'meta', 1, 8, 'Мета: ядра', '◆ за P1 ×= 1.35^lvl', { formula: '1.35 ** lvl', fmt: 'x', coreGainMult: '1.35 ** lvl', requires: ['pt_m1'] }, ['pt_m2b']),
    n('pt_m2b', 'meta', 1, 8, 'Мета: осколки', 'Δ за БУМ ×= 1.4^lvl', { formula: '1.4 ** lvl', fmt: 'x', deltaGainMult: '1.4 ** lvl', requires: ['pt_m1'] }, ['pt_m2a']),
    n('pt_m3a', 'meta', 2, 16, 'Ядерный завод', '◆ ×= 1.6^lvl', { formula: '1.6 ** lvl', fmt: 'x', coreGainMult: '1.6 ** lvl', requires: ['pt_m2a'] }, ['pt_m3b']),
    n('pt_m3b', 'meta', 2, 16, 'Осколочный завод', 'Δ ×= 1.7^lvl', { formula: '1.7 ** lvl', fmt: 'x', deltaGainMult: '1.7 ** lvl', requires: ['pt_m2b'] }, ['pt_m3a']),

    /* --- ветвь «Удача» --- */
    n('pt_l1', 'lucky', 0, 4, 'Крупье', 'пауза автомата ×= 0.92^lvl', { formula: '1 / (0.92 ** lvl)', fmt: 'x', slotGapMult: '0.92 ** lvl' }),
    n('pt_l2a', 'lucky', 1, 8, 'Удача: джекпот', 'выплата 777 ×= 1 + 0.3·lvl', { formula: '1 + 0.3 * lvl', fmt: 'x', slotJackPay: '1 + 0.3 * lvl', requires: ['pt_l1'] }, ['pt_l2b']),
    n('pt_l2b', 'lucky', 1, 8, 'Удача: искра', 'сила искры ×= 1.4^lvl', { formula: '1.4 ** lvl', fmt: 'x', sparkPower: '1.4 ** lvl', requires: ['pt_l1'] }, ['pt_l2a']),
    n('pt_l3a', 'lucky', 2, 14, 'Джекпот-мастер', 'M за джекпот +1·lvl', { formula: '1 * lvl', fmt: 'num', slotJackAdd: '1 * lvl', requires: ['pt_l2a'] }, ['pt_l3b']),
    n('pt_l3b', 'lucky', 2, 14, 'Искро-мастер', 'искры чаще ×= 0.8^lvl', { formula: '1 / (0.8 ** lvl)', fmt: 'x', sparkGap: '0.8 ** lvl', requires: ['pt_l2b'] }, ['pt_l3a'])
  ]);

  /* Развилки на карте: два узла одной ветви и одной глубины разводим по углу,
     иначе карта рисует их в одной точке. Расхождение — из данных (forkSpread). */
  (function () {
    const spread = Number(G.content.pacttree.forkSpread) || 9;
    const groups = {};
    for (const u of G.registry.upgradesOf('pacttree')) {
      const key = u.branch + ':' + (u.depth || 0);
      (groups[key] = groups[key] || []).push(u);
    }
    for (const key in groups) {
      const g = groups[key];
      if (g.length < 2) continue;
      g.forEach((u, i) => { u.angleOffset = (i % 2 ? 1 : -1) * spread; });
    }
  })();
})(window.G = window.G || {});
