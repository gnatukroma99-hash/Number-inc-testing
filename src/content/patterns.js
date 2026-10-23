/* content/patterns.js — ПАТТЕРНЫ МАНТИССЫ (v0.27.0): данные + апгрейды.
   Система (systems/patterns.js) ищет узоры в 15 значащих цифрах числа и «забирает» их
   автоматически. Здесь — какие бывают узоры, как долго и насколько они усиливают M,
   и три апгрейда за ⚡.

   Как добавить узор: сначала научить systems/patterns.js его находить (scan),
   потом строка в types ниже. */
(function (G) {
  'use strict';

  G.content = G.content || {};

  G.content.patterns = {
    gateD: 10,             // с какого D механика открывается
    buffSec: 12,           // сколько секунд горит буфф после поимки
    buffMult: 1.5,         // ×M, пока буфф горит
    cooldownSec: 6,        // один и тот же тип не чаще, чем раз в N игровых секунд
    streakResetSec: 45,    // серия считается, если между поимками меньше N секунд
    palMinLen: 5,          // палиндром не короче 5 цифр
    permPerType: 0.01,     // +1 % к M за каждый открытый тип (макс 5 типов = +5 %)
    permPerCatch: 0.004,   // +0.4 % к M за каждую поимку
    maxPermCatches: 40,    // … но не больше 40 поимок (итого ≤ +16 %)

    types: [
      { id: 'triple', name: 'Трипл', icon: 'diamond', color: '#ffd166', sample: '777', desc: 'три одинаковые цифры подряд' },
      { id: 'quad', name: 'Квадро', icon: 'crystal', color: '#ff9de2', sample: '1111', desc: 'четыре одинаковые цифры подряд' },
      { id: 'run3', name: 'Лесенка', icon: 'chartUp', color: '#7cf7b0', sample: '123', desc: 'три цифры подряд по порядку — вверх или вниз' },
      { id: 'run4', name: 'Штурвал', icon: 'sigma', color: '#7fd1ff', sample: '4321', desc: 'четыре цифры подряд по порядку' },
      { id: 'pal', name: 'Палиндром', icon: 'recycle', color: '#c9a0ff', sample: '12321', desc: 'пять и больше цифр, читаются одинаково в обе стороны' }
    ]
  };

  /* --- апгрейды (⌁ энергия, scope: run — сбрасываются перерождением) --- */
  G.registry.addUpgrades([
    {
      id: 'pt_long', mech: 'patterns', scope: 'run', res: 'energy', icon: 'clock',
      name: 'Долгое эхо', base: 120, growth: 2.20, max: 5,
      effect(state) { return G.patterns.buff(state).sec; }, fmt: 'num',
      note: 'буфф +6 с за уровень',
      desc: 'Пойманный узор горит дольше — множитель успевает поработать.'
    },
    {
      id: 'pt_power', mech: 'patterns', scope: 'run', res: 'energy', icon: 'sparkle',
      name: 'Яркий узор', base: 600, growth: 2.60, max: 4,
      effect(state) { return G.patterns.buff(state).mult; }, fmt: 'x',
      note: '×M во время буффа +0.25 за уровень',
      desc: 'Один и тот же узор, но бьёт сильнее.'
    },
    {
      id: 'pt_scan', mech: 'patterns', scope: 'run', res: 'energy', icon: 'lens',
      name: 'Зоркий скан', base: 2000, growth: 2.80, max: 4,
      effect(state) { return G.patterns.buff(state).cooldown; }, fmt: 'num',
      note: 'перезарядка типа −1 с за уровень (минимум 1.5 с)',
      desc: 'Тот же узор можно поймать снова быстрее.'
    }
  ]);
})(window.G = window.G || {});
