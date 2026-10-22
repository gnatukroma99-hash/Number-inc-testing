/* content/constellations.js — СОЗВЕЗДИЯ ✧ (Ярус 2, v0.16.0).
   Знак открывается СВЯЗКОЙ достижений (2 штуки) — Ярус 1 и Ярус 2 наконец связаны.
   Активен один знак: это выбор «под какой забег собраться», а не ещё один множитель.
   Поля effect читаются общими хуками движка: Mmult / dtMult / energyMult / speedBonus /
   coreGainMult / deltaGainMult. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.constellations = {
    id: 'constellations',
    hint: 'Созвездие — это знак, который открывается связкой двух достижений. Активен один знак, ' +
      'но переключать можно бесплатно в любой момент: под рост, под перерождение или под автомат.',
    /* requires — какие достижения должны быть открыты (связка Яруса 1 и 2) */
    list: [
      {
        id: 'c_scales', name: 'Весы', icon: '⚖', requires: ['a_100', 'a_run1'],
        effect: { Mmult: 1.15, energyMult: 1.15 }, text: 'M ×1.15 · ⌁ ×1.15',
        desc: 'Симметрия роста: и число, и энергия.'
      },
      {
        id: 'c_orion', name: 'Орион', icon: '✧', requires: ['a_308', 'a_wall'],
        effect: { deltaGainMult: 1.5 }, text: 'Δ за БУМ ×1.5',
        desc: 'Охотник за стеной: каждый БУМ даёт больше осколков.'
      },
      {
        id: 'c_lyra', name: 'Лира', icon: '♪', requires: ['a_ch5', 'a_hour'],
        effect: { dtMult: 0.92 }, text: 'ΔT ×0.92',
        desc: 'Ритм: интервал между умножениями короче.'
      },
      {
        id: 'c_whale', name: 'Кит', icon: '✦', requires: ['a_collector', 'a_slot_jack'],
        effect: { speedBonus: 0.25 }, text: 'скорость +0.25',
        desc: 'Медленный и огромный: разгон без сжатия.'
      },
      {
        id: 'c_phoenix', name: 'Феникс', icon: '✧', requires: ['a_bang', 'a_glyphres'],
        effect: { Mmult: 1.5 }, text: 'M ×1.5',
        desc: 'Возрождение в огне: чистый множитель к числу.'
      },
      {
        id: 'c_dragon', name: 'Дракон', icon: '◆', requires: ['a_tree13', 'a_ch1'],
        effect: { coreGainMult: 1.3 }, text: '◆ за перерождение ×1.3',
        desc: 'Копит ядра: каждый P1 приносит больше ◆.'
      }
    ]
  };
})(window.G = window.G || {});
