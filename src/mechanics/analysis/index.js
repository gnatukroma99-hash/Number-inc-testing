/* mechanics/analysis — «Цифровой анализ»: три бонуса по цифрам в одной доске.
   Бенфорд (первая цифра), цифровой корень (rho) и нули (z).
   Одна вкладка — три источника множителя, чтобы не плодить доски. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    {
      id: 'bfd', mech: 'analysis', name: 'Бенфорд не одобряет', res: 'energy',
      base: 800, growth: 2.0, max: 15,
      formula: '1 + 0.5 * lvl * log10(1 + 1 / d1) / log10(2)', fmt: 'x',
      note: 'M ×= 1 + 0.5·lvl·log10(1+1/d1)/log10(2)',
      desc: 'Чем меньше первая цифра, тем больше бонус. Единица — джекпот.'
    },
    {
      id: 'rho_root', mech: 'analysis', name: 'Корень зла', res: 'energy',
      base: 1200, growth: 2.1, max: 15,
      formula: '1 + 0.06 * rho * lvl', fmt: 'x',
      note: 'M ×= 1 + 0.06·rho·lvl',
      desc: 'Цифровой корень мантиссы 1…9 усиливает множитель.'
    },
    {
      id: 'zero_leak', mech: 'analysis', name: 'Ноль-утечка', res: 'energy',
      base: 2500, growth: 2.2, max: 10,
      formula: '1 + 0.03 * z * lvl', fmt: 'x',
      note: 'M ×= 1 + 0.03·z·lvl',
      desc: 'Нули в мантиссе — тоже ресурс.'
    }
  ]);

  G.registry.addMechanic({
    id: 'analysis',
    order: 3,
    name: 'Цифровой анализ',
    short: 'Анализ',
    icon: 'Δ',
    scope: 'run',
    hint: 'Три взгляда на мантиссу: первая цифра (Бенфорд), цифровой корень и нули. ' +
          'Источники множителя перемножаются.',

    isUnlocked(state) {
      return G.growth.D(state) >= 3;
    },

    mult(state) {
      const s = G.sampling.get(state);
      let m = 1;

      const b = G.lvl(state, 'bfd');
      if (b) m *= G.formula('1 + 0.5 * lvl * log10(1 + 1 / d1) / log10(2)', { lvl: b, d1: s.d1 });

      const r = G.lvl(state, 'rho_root');
      if (r) m *= G.formula('1 + 0.06 * rho * lvl', { lvl: r, rho: s.rho });

      const zl = G.lvl(state, 'zero_leak');
      if (zl) m *= G.formula('1 + 0.03 * z * lvl', { lvl: zl, z: s.z });

      return isFinite(m) && m > 0 ? m : 1;
    },

    status(state) {
      return '×' + G.fmt.num(this.mult(state));
    }
  });
})(window.G = window.G || {});
