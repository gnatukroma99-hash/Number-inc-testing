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
        id: 'ch_noglyph', name: 'Без глифов', goal: 130, cost: 12,
        blockMech: ['glyphs'],
        text: 'Награда: Δ за БУМ ×1.3 навсегда',
        reward: { text: 'Δ ×1.3', deltaGainMult: '1.3' }
      },
      {
        id: 'ch_nopact', name: 'Без сделок', goal: 150, cost: 12,
        blockMech: ['pacts'],
        text: 'Награда: ◆ за перерождение ×1.5 навсегда',
        reward: { text: '◆ ×1.5', coreGainMult: '1.5' }
      },
      {
        id: 'ch_noecho', name: 'Без эха', goal: 175, cost: 14,
        blockMech: ['echo'],
        text: 'Награда: скорость +0.2 навсегда',
        reward: { text: 'скорость +0.2', speedBonus: '0.2' }
      },
      {
        id: 'ch_noslot', name: 'Без автомата', goal: 200, cost: 16,
        blockMech: ['slot', 'glyphs'],
        dtMult: 1.25,
        text: 'Награда: M ×1.7 навсегда',
        reward: { text: 'M ×1.7', Mmult: '1.7' }
      },
      {
        id: 'ch_numb', name: 'Онемение', goal: 130, cost: 10,
        blockMech: ['digitsum', 'primefit', 'shop'],
        dtMult: 1.5,
        text: 'Награда: ◆ за перерождение ×1.4 навсегда',
        reward: { text: '◆ ×1.4', coreGainMult: '1.4' }
      }
    ]
  };
})(window.G = window.G || {});
