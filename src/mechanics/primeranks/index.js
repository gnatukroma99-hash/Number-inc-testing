/* mechanics/primeranks — «Простые разряды» / ПРАЙМ (❖).
   Каждый раз, когда D пересекает простое число (2, 3, 5, 7, 11, ...), начисляется ❖. */
(function (G) {
  'use strict';

  function data(state) {
    if (!state.mech.primeranks) {
      state.mech.primeranks = { lastIdx: 0, earned: 0 };
    }
    return state.mech.primeranks;
  }

  G.registry.addUpgrades([
    {
      id: 'pm_base', mech: 'primeranks', name: 'Основание прайма', res: 'prime',
      base: 1, growth: 2.0, max: 25,
      formula: '1.25 + 0.03 * lvl', fmt: 'x',
      note: 'M ×= (1.25 + 0.03·lvl)^❖',
      desc: 'Усиливает вклад каждого простого разряда'
    },
    {
      id: 'pm_speed', mech: 'primeranks', name: 'Прайм-разгон', res: 'prime',
      base: 2, growth: 2.4, max: 15,
      formula: '0.95 ** lvl', fmt: 'x',
      note: 'ΔT ×= 0.95^lvl',
      desc: 'Каждый уровень ускоряет рост на 5%'
    }
  ]);

  G.registry.addMechanic({
    id: 'primeranks',
    order: 3,
    name: 'Простые разряды',
    short: 'ПРАЙМ',
    icon: '❖',
    scope: 'run',            // сбрасывается перерождением, но ❖ живут в ресурсе scope:'tier'
    hint: 'Пересекаешь простой разряд (D = 2, 3, 5, 7, 11, ...) — получаешь ❖. Чем больше ❖, тем сильнее множитель.',

    isUnlocked(state) {
      return G.growth.D(state) >= 2;
    },

    /* начисление ❖ — каждый тик проверяем, не пройден ли новый простой разряд */
    tick(state) {
      const d = data(state);
      const idx = G.primes.countUpTo(Math.floor(G.growth.D(state)));
      if (idx > d.lastIdx) {
        const gained = idx - d.lastIdx;
        d.lastIdx = idx;
        d.earned += gained;
        state.res.prime = (state.res.prime || 0) + gained;
        state.stats.primesFound = (state.stats.primesFound || 0) + gained;
        G.bus.emit('prime:gained', { gained: gained, total: d.earned });
      }
    },

    onReset(state) {
      state.mech.primeranks = { lastIdx: 0, earned: 0 };
    },

    mult(state) {
      const d = data(state);
      if (!d.earned) return 1;
      const base = G.formula('1.25 + 0.03 * lvl', { lvl: G.lvl(state, 'pm_base') });
      const v = Math.pow(base, d.earned);
      return isFinite(v) && v > 0 ? v : 1;
    },

    dtMult(state) {
      const lvl = G.lvl(state, 'pm_speed');
      if (!lvl) return 1;
      const v = G.formula('0.95 ** lvl', { lvl: lvl });
      return isFinite(v) && v > 0 ? v : 1;
    },

    status(state) {
      const d = data(state);
      return '❖' + d.earned + ' → ×' + G.fmt.num(this.mult(state));
    }
  });
})(window.G = window.G || {});
