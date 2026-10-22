/* mechanics/shop — «Магазин цифр»: тратим само число (цифры D) на постоянные баффы.
   Цены задаются в цифрах: costD = сколько цифр списать с N.
   У каждого предмета есть max — он не может расти бесконечно и сломать движок. */
(function (G) {
  'use strict';

  G.registry.addUpgrades([
    {
      id: 'shop_plus', icon: 'plus', mech: 'shop', name: 'Жирный плюс', res: 'number',
      costD: '0.80 * 1.80 ** lvl', minD: 18, max: 6,
      formula: '500 * lvl', addM: '500 * lvl', fmt: 'num',
      note: 'M_base += 500·lvl',
      desc: 'Флэт-плюс к базовому множителю. Особенно жирно на старте.'
    },
    {
      id: 'shop_mult', icon: '✦', mech: 'shop', name: 'Жирный множитель', res: 'number',
      costD: '2.50 * 2.00 ** lvl', minD: 80, max: 4,
      formula: '2 ** lvl', fmt: 'x', Mmult: '2 ** lvl',
      note: 'M ×= 2^lvl (за цифры)',
      desc: 'Плоский ×2 к M за каждые 2.5 цифры. Дорого, но всегда полезно.'
    },
    {
      id: 'shop_tempo', icon: 'clock', mech: 'shop', name: 'Хроно-скидка', res: 'number',
      costD: '1.00 * 1.90 ** lvl', minD: 30, max: 8,
      formula: '0.95 ** lvl', dtMult: '0.95 ** lvl', fmt: 'x',
      note: 'ΔT ×= 0.95^lvl',
      desc: 'Каждый уровень ускоряет рост на 5%.'
    },
    {
      id: 'shop_pow', icon: '^', mech: 'shop', name: 'Показатель', res: 'number',
      costD: '1.00 * 1.60 ** lvl', minD: 60, max: 6,
      formula: '1.05 ** lvl', powM: '1.05 ** lvl', fmt: 'x',
      note: 'бонус механик ^ (1.05^lvl), степень ≤ 1.5',
      desc: 'Бонусы всех механик возводятся в степень. Дорого, но масштабируется.'
    },
    {
      id: 'shop_battery', icon: 'battery', mech: 'shop', name: 'Батарейка', res: 'number',
      costD: '0.30 * 1.80 ** lvl', minD: 8, max: 6,
      formula: '1.5 ** lvl', energyMult: '1.5 ** lvl', fmt: 'x',
      note: '⌁ ×= 1.5^lvl',
      desc: 'Больше энергии за те же нули.'
    }
  ]);

  G.registry.addMechanic({
    id: 'shop',
    order: 4,
    name: 'Магазин цифр',
    short: 'Магазин',
    icon: 'cart',
    scope: 'run',
    noBulk: true,          // цены в цифрах — покупка строго по одной
    hint: 'Единственное место, где тратится само число: цена указана в цифрах (D). ' +
          'Покупка уменьшает N, но даёт постоянный бафф до максимума.',

    isUnlocked(state) {
      return G.growth.D(state) >= 2;
    },

    /* суммарно потрачено цифр на все покупки — для статистики */
    spentD(state) {
      let total = 0;
      for (const u of G.registry.upgradesOf('shop')) {
        const lvl = G.lvl(state, u.id);
        for (let i = 0; i < lvl; i++) total += G.formula(u.costD, { lvl: i });
      }
      return total;
    },

    status(state) {
      let levels = 0;
      let max = 0;
      for (const u of G.registry.upgradesOf('shop')) {
        levels += G.lvl(state, u.id);
        max += u.max;
      }
      return levels + '/' + max;
    }
  });
})(window.G = window.G || {});
