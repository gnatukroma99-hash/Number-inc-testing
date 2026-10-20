/* systems/sampling.js — «сэмпл» цифровых статистик.
   Мантисса меняется каждый тик, поэтому статистики замораживаются на окно.
   Это превращает случайные цифры в ресурс, которым можно управлять (апгрейд «Стабилизатор»). */
(function (G) {
  'use strict';

  const BASE_PERIOD = 4;      // сек
  const STAB_BONUS = 2;       // +2 сек за уровень sd_stab

  const S = {
    period(state) {
      return BASE_PERIOD + STAB_BONUS * G.lvl(state, 'sd_stab');
    },

    refresh(state) {
      const st = G.digits.stats(state.N);
      state.sample = {
        S: st.S,
        q: st.q,
        z: st.z,
        d1: st.d1,
        rho: st.rho,
        digits: st.digits,
        pattern: G.digits.pattern(st),
        duration: S.period(state),
        remaining: S.period(state)
      };
      state.stats.samples = (state.stats.samples || 0) + 1;
      G.bus.emit('sample:new', state.sample);
      return state.sample;
    },

    get(state) {
      return state.sample || S.refresh(state);
    },

    update(state, dt) {
      if (!state.sample) { S.refresh(state); return; }
      state.sample.remaining -= dt;
      /* окно могло вырасти апгрейдом — не даём таймеру «убежать» */
      if (state.sample.remaining > state.sample.duration) {
        state.sample.remaining = state.sample.duration;
      }
      if (state.sample.remaining <= 0) S.refresh(state);
    },

    progress(state) {
      const s = S.get(state);
      return Math.max(0, Math.min(1, 1 - s.remaining / s.duration));
    }
  };

  G.sampling = S;
})(window.G = window.G || {});
