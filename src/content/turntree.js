/* content/turntree.js — ДЕРЕВО ⧜ (Ярус 4, v0.31.0): 24 узла за Обороты, 4 ветви по 6.
   То же созвездие, что у ◆-дерева и Ψ-дерева (mechanics/tree/engine.js), но своё:
   валюта — ⧜, оформление — «живой росток» (theme: 'bloom'), и оно усиливает ВСЕ слои:
   старт забега, M, ΔT, плоскости, Ψ-поток, ядра и осколки.

   Поля — общие хуки движка (Mmult / dtMult / speedBonus / spanMult / powM / coreGainMult /
   deltaGainMult / autoStepMult / psiRateMult / turnGainMult / turnGainAdd), поэтому в ядре
   ничего не меняется. Трамплин-узлы читаются формулой старта в content/turn.js (lvl2/lvl3),
   а узлы «Разбега» глубже 3-й — уже нет: они дают ⧜ за ОБОРОТ (turnGainAdd) и M (Mmult),
   поэтому новые узлы не требуют правок formula старта. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.turntree = {
    id: 'turntree',
    theme: 'bloom',
    hint: 'Дерево Оборотов: ⧜ вкладываются навсегда и усиливают всё сразу — трамплин старта, ' +
      'множители, темп, плоскости и Ψ-поток. Ветви раскрываются по глубине: купи предка, ' +
      'откроется следующий узел.',

    branches: [
      { id: 'start', name: 'Разбег', color: '#a3e635', angle: -90 },
      { id: 'power', name: 'Сила', color: '#fbbf24', angle: 0 },
      { id: 'tempo', name: 'Темп', color: '#34d399', angle: 90 },
      { id: 'deep', name: 'Глубина', color: '#22d3ee', angle: 180 }
    ]
  };

  /* helper: n(id, branch, depth, цена, имя, эффект, поля) */
  function n(id, branch, depth, base, name, note, fields) {
    return Object.assign({
      id: id, mech: 'turntree', branch: branch, depth: depth, tier: 't4',
      scope: 'meta', res: 'turns', icon: 'cycle',
      name: name, base: base, growth: 2.0, max: 2, note: note, autoBuy: false
    }, fields);
  }

  G.registry.addUpgrades([
    /* ---------- ветвь «Разбег» (синяя: старт забега) ---------- */
    n('tt_s1', 'start', 0, 3, 'Ноги', 'старт +100 цифр',
      { formula: '100 * lvl', fmt: 'num', note: 'старт следующего забега +100·ур.' }),
    n('tt_s2', 'start', 1, 6, 'Второе дыхание', 'старт +400 цифр',
      { formula: '400 * lvl', fmt: 'num', note: 'старт +400·ур.', requires: ['tt_s1'] }),
    n('tt_s3', 'start', 2, 12, 'Третье дыхание', 'старт +1500 цифр',
      { formula: '1500 * lvl', fmt: 'num', note: 'старт +1500·ур.', requires: ['tt_s2'] }),
    n('tt_s4', 'start', 3, 24, 'Оборотный выход', '⧜ за ОБОРОТ +1',
      { formula: '1 * lvl', fmt: 'num', turnGainAdd: '1 * lvl', note: '⧜ за ОБОРОТ +1·ур.', requires: ['tt_s3'] }),
    n('tt_s5', 'start', 4, 48, 'Разгонный круг', '⧜ за ОБОРОТ +2',
      { formula: '2 * lvl', fmt: 'num', turnGainAdd: '2 * lvl', note: '⧜ за ОБОРОТ +2·ур.', requires: ['tt_s4'] }),
    n('tt_s6', 'start', 5, 96, 'Маховик', 'M ×= 2^ур',
      { formula: '2 ** lvl', fmt: 'x', Mmult: '2 ** lvl', note: 'M ×= 2^ур.', requires: ['tt_s5'] }),

    /* ---------- ветвь «Сила» (жёлтая: M) ---------- */
    n('tt_p1', 'power', 0, 4, 'Толчок', 'M ×= 1.6^ур',
      { formula: '1.6 ** lvl', fmt: 'x', Mmult: '1.6 ** lvl', note: 'M ×= 1.6^ур.' }),
    n('tt_p2', 'power', 1, 8, 'Разгон силы', 'M ×= 2^ур',
      { formula: '2 ** lvl', fmt: 'x', Mmult: '2 ** lvl', note: 'M ×= 2^ур.', requires: ['tt_p1'] }),
    n('tt_p3', 'power', 2, 16, 'Давление', 'степень M ×= 1.02^ур',
      { formula: '1.02 ** lvl', fmt: 'x', powM: '1.02 ** lvl', note: 'степень M ×= 1.02^ур.', requires: ['tt_p2'] }),
    n('tt_p4', 'power', 3, 28, 'Сверхдавление', 'M ×= 4^ур',
      { formula: '4 ** lvl', fmt: 'x', Mmult: '4 ** lvl', note: 'M ×= 4^ур.', requires: ['tt_p3'] }),
    n('tt_p5', 'power', 4, 56, 'Гидравлика', 'M ×= 6^ур',
      { formula: '6 ** lvl', fmt: 'x', Mmult: '6 ** lvl', note: 'M ×= 6^ур.', requires: ['tt_p4'] }),
    n('tt_p6', 'power', 5, 112, 'Предел прочности', 'степень M ×= 1.03^ур',
      { formula: '1.03 ** lvl', fmt: 'x', powM: '1.03 ** lvl', note: 'степень M ×= 1.03^ур.', requires: ['tt_p5'] }),

    /* ---------- ветвь «Темп» (зелёная: ΔT, авто, Ψ-поток) ---------- */
    n('tt_t1', 'tempo', 0, 4, 'Часы', 'ΔT ×= 0.96^ур',
      { formula: '1 / (0.96 ** lvl)', fmt: 'x', dtMult: '0.96 ** lvl', note: 'ΔT ×= 0.96^ур.' }),
    n('tt_t2', 'tempo', 1, 8, 'Разгон', 'скорость +0.2·ур',
      { formula: '0.2 * lvl', fmt: 'num', speedBonus: '0.2 * lvl', note: 'скорость +0.2·ур.', requires: ['tt_t1'] }),
    n('tt_t3', 'tempo', 2, 14, 'Автопилот', 'шаг автопокупок ×= 1.4^ур',
      { formula: '1.4 ** lvl', fmt: 'x', autoStepMult: '1.4 ** lvl', note: 'авто ×= 1.4^ур.', requires: ['tt_t2'] }),
    n('tt_t4', 'tempo', 3, 26, 'Ψ-насос', 'Ψ-поток ×= 1.5^ур',
      { formula: '1.5 ** lvl', fmt: 'x', psiRateMult: '1.5 ** lvl', note: 'Ψ/с ×= 1.5^ур.', requires: ['tt_t3'] }),
    n('tt_t5', 'tempo', 4, 52, 'Конвейер', 'скорость +0.5·ур',
      { formula: '0.5 * lvl', fmt: 'num', speedBonus: '0.5 * lvl', note: 'скорость +0.5·ур.', requires: ['tt_t4'] }),
    n('tt_t6', 'tempo', 5, 104, 'Маятник', 'ΔT ×= 0.94^ур',
      { formula: '1 / (0.94 ** lvl)', fmt: 'x', dtMult: '0.94 ** lvl', note: 'ΔT ×= 0.94^ур.', requires: ['tt_t5'] }),

    /* ---------- ветвь «Глубина» (голубая: плоскости и валюты) ---------- */
    n('tt_d1', 'deep', 0, 5, 'Плоскость', 'span ×= 1.5^ур',
      { formula: '1.5 ** lvl', fmt: 'x', spanMult: '1.5 ** lvl', note: 'span ×= 1.5^ур.' }),
    n('tt_d2', 'deep', 1, 10, 'Ядерный ток', '◆ за P1 ×= 1.4^ур',
      { formula: '1.4 ** lvl', fmt: 'x', coreGainMult: '1.4 ** lvl', note: '◆ ×= 1.4^ур.', requires: ['tt_d1'] }),
    n('tt_d3', 'deep', 2, 16, 'Осколочный ток', 'Δ за БУМ ×= 1.4^ур',
      { formula: '1.4 ** lvl', fmt: 'x', deltaGainMult: '1.4 ** lvl', note: 'Δ ×= 1.4^ур.', requires: ['tt_d2'] }),
    n('tt_d4', 'deep', 3, 30, 'Оборотный поток', '⧜ за ОБОРОТ ×= 1.3^ур',
      { formula: '1.3 ** lvl', fmt: 'x', turnGainMult: '1.3 ** lvl', note: '⧜ за ОБОРОТ ×= 1.3^ур.', requires: ['tt_d3'] }),
    n('tt_d5', 'deep', 4, 60, 'Глубинная плоскость', 'span ×= 1.8^ур',
      { formula: '1.8 ** lvl', fmt: 'x', spanMult: '1.8 ** lvl', note: 'span ×= 1.8^ур.', requires: ['tt_d4'] }),
    n('tt_d6', 'deep', 5, 120, 'Оборотный вихрь', '⧜ за ОБОРОТ ×= 1.5^ур',
      { formula: '1.5 ** lvl', fmt: 'x', turnGainMult: '1.5 ** lvl', note: '⧜ за ОБОРОТ ×= 1.5^ур.', requires: ['tt_d5'] })
  ]);

  /* Узлы «Разбег» подмешиваются в формулу старта (content/turn.js). Здесь только карта:
     id узлов → переменные формулы, чтобы данные оставались данными. */
  G.content.turn.startVars = { lvl2: 'tt_s1', lvl3: 'tt_s2', lvl4: 'tt_s3' };
})(window.G = window.G || {});
