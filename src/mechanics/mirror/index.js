/* mechanics/mirror — «Зеркало» (v0.6.0).
   Смотрит на мантиссу и считает СИММЕТРИЮ: сколько пар цифр совпало,
   если мантиссу сложить пополам (i и последняя−i).
   Открывается только узлом дерева ◆ «Зеркало» (tree_mirror, 150 ◆) — id узла в данных.
   Всё в одной папке: другие системы править не нужно. */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.mirror = {
    gate: 'tree_mirror',                    // узел дерева ◆
    basePairs: 2,                           // сколько пар проверяем без апгрейдов
    maxPairs: 7,                            // больше 7 пар у 15 цифр нет
    powerFormula: '(1 + 0.25 * lvl) ** sym',
    grainFormula: '1 + 0.01 * grain * lvl'
  };

  function data(state) {
    if (!state.mech.mirror) {
      state.mech.mirror = { sym: 0, grain: 0, bestSym: 0, pairs: 0, lastSample: -1 };
    }
    return state.mech.mirror;
  }

  /* окно: сколько пар проверяем */
  function pairs(state) {
    const c = G.content.mirror;
    const w = c.basePairs + G.lvl(state, 'mr_deep');
    return Math.max(1, Math.min(c.maxPairs, Math.round(w)));
  }

  function power(state) {
    const lvl = G.lvl(state, 'mr_power');
    const d = data(state);
    if (!lvl || !d.sym) return 1;
    const v = G.formula(G.content.mirror.powerFormula, { lvl: lvl, sym: d.sym });
    return isFinite(v) && v > 0 ? v : 1;
  }

  function grainMult(state) {
    const lvl = G.lvl(state, 'mr_echo');
    const d = data(state);
    if (!lvl || !d.grain) return 1;
    const v = G.formula(G.content.mirror.grainFormula, { lvl: lvl, grain: d.grain });
    return isFinite(v) && v > 0 ? v : 1;
  }

  /* ---------- апгрейды (⚡) ---------- */
  G.registry.addUpgrades([
    {
      id: 'mr_deep', mech: 'mirror', name: 'Глубина зеркала', res: 'energy',
      base: 8e5, growth: 2.7, max: 5,
      formula: '2 + lvl', fmt: 'num',
      note: 'пар = 2 + lvl (максимум 7)',
      desc: 'Проверяем больше пар цифр — симметрия попадается чаще.'
    },
    {
      id: 'mr_power', mech: 'mirror', name: 'Яркость отражения', res: 'energy',
      base: 3e6, growth: 3.1, max: 12,
      effect(state) { return power(state); }, fmt: 'x',
      note: 'M ×= (1 + 0.25·lvl)^симметрия',
      desc: 'Каждая совпавшая пара усиливает множитель.'
    },
    {
      id: 'mr_echo', mech: 'mirror', name: 'Эхо зеркала', res: 'energy',
      base: 6e6, growth: 3.4, max: 8,
      effect(state) { return grainMult(state); }, fmt: 'x',
      note: 'M ×= 1 + 0.01·накоплено·lvl',
      desc: 'Симметрия копится в «накоплено» и работает даже без удачи.'
    }
  ]);

  /* ---------- механика ---------- */
  G.registry.addMechanic({
    id: 'mirror',
    order: 6,
    name: 'Зеркало',
    short: 'Зеркало',
    icon: '⧗',
    scope: 'run',
    lockHint: 'дерево ◆ → узел «Зеркало» (150 ◆)',
    hint: 'Мантисса складывается пополам: совпавшие пары цифр дают множитель, ' +
          'а вся симметрия копится в «накоплено». Открывается узлом дерева ◆ за 150 ядер.',

    isUnlocked(state) {
      return G.lvl(state, G.content.mirror.gate) > 0;
    },

    data: data,
    pairs: pairs,
    power: power,
    grainMult: grainMult,

    /* пересчёт симметрии на каждом новом сэмпле мантиссы */
    tick(state) {
      const d = data(state);
      const key = state.stats.samples || 0;
      if (d.lastSample === key) return;

      const s = G.sampling.get(state);
      const dig = s.digits || [];
      const w = pairs(state);
      const last = dig.length - 1;
      let sym = 0;
      for (let i = 0; i < w; i++) {
        if (dig[i] === dig[last - i]) sym++;
      }

      d.lastSample = key;
      d.pairs = w;
      d.sym = sym;
      d.grain += sym;
      if (sym > d.bestSym) d.bestSym = sym;
      if (sym > 0) G.bus.emit('mirror:sym', { sym: sym, pairs: w, grain: d.grain });
    },

    mult(state) {
      return power(state) * grainMult(state);
    },

    onReset(state) {
      state.mech.mirror = { sym: 0, grain: 0, bestSym: 0, pairs: 0, lastSample: -1 };
    },

    status(state) {
      const d = data(state);
      return '⧗' + d.sym + '/' + (d.pairs || pairs(state));
    }
  });
})(window.G = window.G || {});
