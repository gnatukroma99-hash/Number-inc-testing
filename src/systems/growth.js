/* systems/growth.js — ядро: множитель, интервал, тик роста, энергия.
   Механики НЕ правят этот файл: они отдают множители через свой API. */
(function (G) {
  'use strict';

  const MIN_DT = 0.033;     // 30 тиков/с — предел скорости

  const W = {
    /* все переменные для строк-формул */
    vars(state) {
      const s = state.sample || { S: 0, q: 0, z: 0, d1: 1, rho: 1 };
      return {
        D: W.D(state),
        S: s.S,
        q: s.q,
        z: s.z,
        d1: s.d1,
        rho: s.rho,
        prime: state.res.prime || 0,
        t: state.stats.playtime || 0
      };
    },

    D(state) { return G.BN.log10(state.N); },

    /* --- интервал между умножениями --- */
    speedBonus(state) {
      let bonus = 0.10 * G.lvl(state, 'speed1');
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.speedBonus === 'function') bonus += m.speedBonus(state) || 0;
      }
      return bonus;
    },

    dtMult(state) {
      let mult = 1;
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.dtMult === 'function') mult *= (m.dtMult(state) || 1);
      }
      return mult;
    },

    dt(state) {
      return Math.max(MIN_DT, (60 / (1 + W.speedBonus(state))) * W.dtMult(state));
    },

    /* --- множитель --- */
    baseM(state) {
      return 2 + G.lvl(state, 'mult1');
    },

    M(state) {
      let m = W.baseM(state);
      for (const mech of G.registry.mechanics()) {
        if (mech.isUnlocked && !mech.isUnlocked(state)) continue;
        if (typeof mech.mult === 'function') {
          const v = mech.mult(state);
          if (isFinite(v) && v > 0) m *= v;
        }
      }
      return isFinite(m) && m > 0 ? m : 1;
    },

    /* --- барьеры (софткапы). Пройденные исчезают навсегда --- */
    passed(state, id) {
      return (state.meta.passedBarriers || []).indexOf(id) >= 0;
    },

    barrierFactor(state) {
      const list = (G.content && G.content.barriers) || [];
      if (!list.length) return 1;
      const d = W.D(state);
      let g = 1;
      for (const b of list) {
        if (W.passed(state, b.id)) continue;
        if (typeof b.requires === 'function' && !b.requires(state)) continue;
        const taper = G.formula(b.taper || 10, Object.assign(W.vars(state), { wall: b.wall }));
        g *= G.formula('taper(D, wall, width)', { D: d, wall: b.wall, width: taper });
        if (g <= 0) return 0;
      }
      return g;
    },

    /* цифр в секунду (для отображения) */
    rate(state) {
      const M = W.M(state);
      const dt = W.dt(state);
      return (Math.log10(M) / dt) * W.barrierFactor(state);
    },

    /* --- энергия: 0.4 * (1 + log10(N + 10))^2 * множители --- */
    energyRate(state) {
      const D = W.D(state);
      /* при D >= 15 log10(10^D + 10) ~= D, но 10^D уже не влезает в double */
      const l = D < 15 ? Math.log10(Math.pow(10, D) + 10) : D;
      return 0.4 * Math.pow(1 + l, 2) * Math.pow(1.25, G.lvl(state, 'energy1'));
    },

    /* --- один шаг симуляции --- */
    tick(state, dt) {
      state.stats.playtime = (state.stats.playtime || 0) + dt;

      const dT = W.dt(state);
      const M = W.M(state);

      state.tickAcc += dt;
      let guard = 0;
      while (state.tickAcc >= dT && guard < 500) {
        state.tickAcc -= dT;
        /* барьер плавно «сжимает» множитель к 1, а не режет его в ноль */
        const b = W.barrierFactor(state);
        if (b > 0) state.N = G.BN.mulNum(state.N, 1 + (M - 1) * b);
        guard++;
      }

      state.D = W.D(state);
      if (state.D > (state.stats.bestD || 0)) state.stats.bestD = state.D;

      /* энергия всегда капает — старт не должен быть мёртвым */
      state.res.energy = (state.res.energy || 0) + W.energyRate(state) * dt;
    }
  };

  G.growth = W;
})(window.G = window.G || {});
