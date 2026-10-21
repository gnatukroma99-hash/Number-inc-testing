/* mechanics/primefit — «Прайм-стайл»: простые цифры в мантиссе. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    {
      id: 'pq', icon: '⧉', mech: 'primefit', name: 'Прайм-стайл', res: 'energy',
      base: 500, growth: 2.0, max: 15,
      formula: '1 + 0.12 * q * lvl', fmt: 'x',
      note: 'M ×= 1 + 0.12·q·lvl,  q = цифр из {2,3,5,7}',
      desc: 'Множитель от количества простых цифр в мантиссе'
    },
    {
      id: 'pq_jack', icon: '🎰', mech: 'primefit', name: 'Джекпот-стайл', res: 'energy',
      base: 5000, growth: 3.2, max: 5,
      formula: '1 + 2 * lvl', fmt: 'x',
      note: 'при q = 15: M ×= 1 + 2·lvl',
      desc: 'Бонус, когда ВСЕ значимые цифры простые'
    }
  ]);

  G.registry.addMechanic({
    id: 'primefit',
    order: 2,
    name: 'Прайм-стайл',
    short: 'Прайм-цифры',
    icon: '◈',
    scope: 'run',
    hint: 'Цифры 2, 3, 5, 7 в мантиссе — простые. Чем их больше, тем больше множитель.',

    isUnlocked(state) {
      return G.growth.D(state) >= 1.0;
    },

    mult(state) {
      const lvl = G.lvl(state, 'pq');
      if (!lvl) return 1;
      const s = G.sampling.get(state);
      let v = G.formula('1 + 0.12 * q * lvl', { q: s.q, lvl: lvl });
      /* джекпот: все 15 цифр простые */
      if (s.q === s.digits.length) {
        const j = G.lvl(state, 'pq_jack');
        if (j) v *= G.formula('1 + 2 * lvl', { lvl: j });
      }
      return isFinite(v) && v > 0 ? v : 1;
    },

    status(state) {
      const s = G.sampling.get(state);
      return 'q = ' + s.q + '/15 → ×' + this.mult(state).toFixed(2);
    }
  });
})(window.G = window.G || {});
