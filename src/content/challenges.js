/* content/challenges.js — ИСПЫТАНИЯ ⚑ (Ярус 2, v0.15.0).
   Забег с ЗАПРЕТОМ за постоянную награду. Это не бонус: сначала играешь хуже, потом проще.

   Поля испытания:
     goal        — до скольких цифр D надо дойти, чтобы пройти
     cost        — сколько Δ стоит вход
     blockMech   — какие механики отключены на время забега (id механик)
     dtMult      — множитель к ΔT, пока испытание идёт (2 = вдвое медленнее)
     energyMult  — множитель к ⌁
     reward      — постоянная награда: { text, Mmult?, dtMult?, energyMult?, speedBonus? }
                   Формулы строкой, lvl = 1 если пройдено. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.challenges = {
    id: 'challenges',
    hint: 'Испытание — это забег с запретом. Прошёл до нужных цифр — запрет снимается, ' +
      'а награда остаётся навсегда (даже после перерождения и БУМА). Выйти можно в любой момент, ' +
      'но награды не будет, а Δ за вход не вернётся.',

    list: [
      {
        id: 'ch_nosum', name: 'Без суммы цифр', goal: 40, cost: 5,
        blockMech: ['digitsum'],
        text: 'Награда: M ×1.25 навсегда',
        reward: { text: 'M ×1.25', Mmult: '1.25' }
      },
      {
        id: 'ch_slow', name: 'Тяжёлый темп', goal: 60, cost: 6,
        dtMult: 2,
        text: 'Награда: ΔT ×0.95 навсегда',
        reward: { text: 'ΔT ×0.95', dtMult: '0.95' }
      },
      {
        id: 'ch_dry', name: 'Сухой воздух', goal: 80, cost: 7,
        energyMult: 0.25,
        text: 'Награда: ⌁ ×1.5 навсегда',
        reward: { text: '⌁ ×1.5', energyMult: '1.5' }
      },
      {
        id: 'ch_noshop', name: 'Без магазина', goal: 100, cost: 8,
        blockMech: ['shop'],
        text: 'Награда: скорость +0.15 навсегда',
        reward: { text: 'скорость +0.15', speedBonus: '0.15' }
      },
      {
        id: 'ch_numb', name: 'Онемение', goal: 130, cost: 10,
        blockMech: ['digitsum', 'primefit', 'shop'],
        dtMult: 1.5,
        text: 'Награда: M ×1.5 навсегда',
        reward: { text: 'M ×1.5', Mmult: '1.5' }
      }
    ]
  };
})(window.G = window.G || {});
