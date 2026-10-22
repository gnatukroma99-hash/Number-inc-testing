/* systems/timescale.js — глобальный множитель СКОРОСТИ ИГРЫ (режим разработчика).
   Ускоряет всё, что живёт на dt: рост числа, энергию, сэмплы, тики механик,
   авто-покупки, отображение. Один множитель — один источник правды.
   Ограничение MAX защищает движок от безумного dt. */
(function (G) {
  'use strict';

  const MIN = 1;
  const MAX = 100;

  const T = {
    MIN: MIN,
    MAX: MAX,

    /* привести значение к допустимому: целое 1..MAX */
    clamp(v) {
      const n = Number(v);
      if (!isFinite(n)) return MIN;
      return Math.max(MIN, Math.min(MAX, Math.round(n)));
    },

    /* во сколько раз ускоряем игру сейчас (настройки — данные в state.settings) */
    scale(state) {
      const s = (state && state.settings) || {};
      if (!s.devMode) return 1;
      return T.clamp(s.devSpeed);
    },

    /* ускорение от механик (Хроно и любые будущие): общий хук timeScale, имён движок не знает */
    mechScale(state) {
      let k = 1;
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.timeScale !== 'function') continue;
        const v = m.timeScale(state);
        if (isFinite(v) && v > 0) k *= v;
      }
      return isFinite(k) && k > 0 ? k : 1;
    },

    /* применить к шагу времени (dt уже ограничен вызывающим кодом) */
    apply(state, dt) {
      const k = T.scale(state) * T.mechScale(state);
      return k === 1 ? dt : dt * k;
    }
  };

  G.timescale = T;
})(window.G = window.G || {});
