/* mechanics/digitsum — «Сумма цифр, брат».
   Логика механики. Доска (UI) — в board.js, чтобы логика не знала про DOM. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    {
      id: 'sd', icon: 'Σ', mech: 'digitsum', name: 'Сумма цифр, брат', res: 'energy',
      base: 60, growth: 1.9, max: 20,
      formula: '1 + 0.005 * S * lvl', fmt: 'x',
      note: 'M ×= 1 + 0.005·S·lvl',
      desc: 'Множитель от суммы значащих цифр'
    },
    {
      id: 'sd2', icon: 'Σ', mech: 'digitsum', name: 'Сумма цифр II', res: 'energy',
      base: 5e3, growth: 2.6, max: 12,
      formula: '1 + 0.02 * S * lvl', fmt: 'x',
      note: 'M ×= 1 + 0.02·S·lvl',
      desc: 'Второй слой: работает на той же сумме цифр, но дешевле за уровень.'
    },
    {
      id: 'sd_stab', icon: 'ice', mech: 'digitsum', name: 'Стабилизатор', res: 'energy',
      base: 300, growth: 2.5, max: 10,
      formula: '4 + 2 * lvl', fmt: 'num',
      note: 'Δt сэмпла = 4 + 2·lvl',
      desc: 'Дольше держит удачные цифры'
    }
  ]);

  G.registry.addMechanic({
    id: 'digitsum',
    order: 1,
    name: 'Сумма цифр, брат',
    short: 'Цифры',
    icon: 'Σ',
    scope: 'run',
    hint: 'Сумма значащих цифр мантиссы даёт множитель. Статистика обновляется «сэмплами».',

    isUnlocked(state) {
      return G.growth.D(state) >= 0.5;
    },

    /* множитель к M_total */
    mult(state) {
      const lvl = G.lvl(state, 'sd');
      if (!lvl) return 1;
      const s = G.sampling.get(state);
      const v = G.formula('1 + 0.005 * S * lvl', { S: s.S, lvl: lvl });
      return isFinite(v) && v > 0 ? v : 1;
    },

    /* то, что показывает доска в «шапке» */
    status(state) {
      const s = G.sampling.get(state);
      return 'S = ' + s.S + ' → ×' + this.mult(state).toFixed(2);
    }
  });
})(window.G = window.G || {});
