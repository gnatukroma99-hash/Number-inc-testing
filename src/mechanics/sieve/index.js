/* mechanics/sieve — «Решето» (v0.5.0).
   Пассивно просеивает простые числа: каждое найденное даёт ❖ и линейно усиливает M.
   Открывается ТОЛЬКО узлом дерева ◆ «Решето» (tree_sieve, 80 ◆) — id узла лежит в данных
   (G.content.sieve.gate), движок имён не знает.
   Вся механика в одной папке: добавление не требует правок в других системах. */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.sieve = {
    gate: 'tree_sieve',                       // узел дерева ◆, открывающий доску
    startIdx: 0,                              // с какого простого начинаем (0 -> «2»)
    rateFormula: '0.40 * (1 + 0.25 * lvl)',   // простых в секунду
    multFormula: '1 + 0.01 * found * lvl',    // M-бонус от найденных
    yieldFormula: '2 ** lvl'                  // ❖ за каждое найденное простое
  };

  function data(state) {
    if (!state.mech.sieve) {
      state.mech.sieve = { idx: G.content.sieve.startIdx, found: 0, acc: 0 };
    }
    return state.mech.sieve;
  }

  function rate(state) {
    const v = G.formula(G.content.sieve.rateFormula, { lvl: G.lvl(state, 'sv_rate') });
    return isFinite(v) && v > 0 ? v : 0;
  }

  function yieldPer(state) {
    const v = G.formula(G.content.sieve.yieldFormula, { lvl: G.lvl(state, 'sv_yield') });
    return isFinite(v) && v >= 1 ? Math.floor(v) : 1;
  }

  function mult(state) {
    const d = data(state);
    const lvl = G.lvl(state, 'sv_power');
    if (!d.found || !lvl) return 1;
    const v = G.formula(G.content.sieve.multFormula, { found: d.found, lvl: lvl });
    return isFinite(v) && v > 0 ? v : 1;
  }

  /* ---------- апгрейды (⚡ и ❖) ---------- */
  G.registry.addUpgrades([
    {
      id: 'sv_rate', icon: '⏩', mech: 'sieve', name: 'Ход решета', res: 'energy',
      base: 5e5, growth: 2.6, max: 15,
      formula: '0.40 * (1 + 0.25 * lvl)', fmt: 'num',
      note: 'скорость = 0.40 · (1 + 0.25·lvl) простых/с',
      desc: 'Сколько чисел просеивается в секунду.'
    },
    {
      id: 'sv_power', icon: '🎯', mech: 'sieve', name: 'Плотность решета', res: 'energy',
      base: 2e6, growth: 3.0, max: 12,
      effect(state) { return mult(state); }, fmt: 'x',
      note: 'M ×= 1 + 0.01·найдено·lvl',
      desc: 'Каждое найденное простое даёт больше к M.'
    },
    {
      id: 'sv_yield', icon: '💎', mech: 'sieve', name: 'Урожай ❖', res: 'prime',
      base: 2, growth: 2.2, max: 10,
      formula: '2 ** lvl', fmt: 'x',
      note: '❖ за простое ×= 2^lvl',
      desc: 'Одно и то же решето приносит вдвое больше ❖ за уровень.'
    }
  ]);

  /* ---------- механика ---------- */
  G.registry.addMechanic({
    id: 'sieve',
    order: 5,
    name: 'Решето',
    short: 'Решето',
    icon: '⌗',
    scope: 'run',
    lockHint: 'дерево ◆ → узел «Решето» (80 ◆)',
    hint: 'Решето само гоняет простые числа по кругу: каждое найденное приносит ❖ ' +
          'и навсегда усиливает M. Открывается узлом дерева ◆ за 80 ядер.',

    isUnlocked(state) {
      return G.lvl(state, G.content.sieve.gate) > 0;
    },

    data: data,
    mult: mult,
    rate: rate,
    yieldPer: yieldPer,

    tick(state, dt) {
      const d = data(state);
      d.acc += rate(state) * dt;
      const gained = Math.floor(d.acc);
      if (gained <= 0) return;
      d.acc -= gained;
      d.found += gained;
      d.idx += gained;

      const per = yieldPer(state);
      state.res.prime = (state.res.prime || 0) + gained * per;
      state.stats.sieveFound = (state.stats.sieveFound || 0) + gained;

      G.bus.emit('sieve:found', { gained: gained, total: d.found });
    },

    onReset(state) {
      state.mech.sieve = { idx: G.content.sieve.startIdx, found: 0, acc: 0 };
    },

    status(state) {
      return '⌗' + data(state).found;
    }
  });
})(window.G = window.G || {});
