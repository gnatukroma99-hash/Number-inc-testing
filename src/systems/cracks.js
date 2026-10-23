/* systems/cracks.js — ТРЕЩИНЫ ⟁ (Ярус 3): логика активной механики.
   Спавн по таймеру → игрок жмёт → Ψ + постоянный span. Всё из данных content/cracks.js.
   Система не знает про UI: трещину рисует ui/cracks.js. */
(function (G) {
  'use strict';

  const cfg = () => (G.content && G.content.cracks) || {};

  function data(state) {
    const m = state.mech || (state.mech = {});
    if (!m.cracks) {
      m.cracks = { nextIn: 16, left: 0, broken: 0, best: 0, spawns: 0, seed: 0 };
    }
    const d = m.cracks;
    if (typeof d.nextIn !== 'number' || !isFinite(d.nextIn)) d.nextIn = 16;
    if (typeof d.left !== 'number' || !isFinite(d.left)) d.left = 0;
    if (typeof d.broken !== 'number' || !isFinite(d.broken)) d.broken = 0;
    return d;
  }

  function prod(state, field) {
    const v = G.growth.upgProduct(state, field);
    return isFinite(v) && v > 0 ? v : 1;
  }

  const C = {
    data: data,

    open(state) {
      return (state.res.psi || 0) > 0 || (state.meta.breaks || 0) > 0 ||
        G.growth.D(state) >= (cfg().minD || 1000);
    },

    /* пауза между трещинами, сек */
    gap(state) {
      const c = cfg();
      const base = (c.spawnEvery || 26) * prod(state, 'crackGap');
      return Math.max(6, base);
    },

    /* сколько живёт трещина, сек */
    life(state) {
      const c = cfg();
      const v = (c.life || 12) + (G.growth.upgSum(state, 'crackLife') || 0);
      return Math.max(4, v);
    },

    /* Ψ за одну трещину */
    reward(state) {
      const c = cfg();
      const v = (c.rewardPsi || 2) * prod(state, 'crackPower');
      return isFinite(v) && v > 0 ? v : 0;
    },

    /* множитель плоскости от сломанных трещин: 1 + perBreak·broken·«Раскол» */
    spanMult(state) {
      const c = cfg();
      const d = data(state);
      if (!d.broken) return 1;
      const per = (c.spanPerBreak || 0.004) * prod(state, 'crackSpan');
      const v = 1 + per * d.broken;
      return isFinite(v) && v > 0 ? v : 1;
    },

    visible(state) { return data(state).left > 0; },
    left(state) { return Math.max(0, data(state).left); },
    broken(state) { return data(state).broken || 0; },
    nextIn(state) { return Math.max(0, data(state).nextIn); },

    /* один тик: либо тикает жизнь открытой трещины, либо ждёт следующую */
    tick(state, dt) {
      if (!C.open(state)) return 0;
      const d = data(state);
      const step = dt || 0;
      if (d.left > 0) {
        d.left = Math.max(0, d.left - step);
        if (d.left <= 0) d.nextIn = C.gap(state);
        return 0;
      }
      d.nextIn -= step;
      if (d.nextIn > 0) return 0;
      /* открываем новую трещину: жизнь + случайное зерно для формы в UI */
      const c = cfg();
      d.left = C.life(state);
      d.spawns = (d.spawns || 0) + 1;
      d.seed = Math.random();
      d.nextIn = 0;
      G.bus.emit('crack:spawn', { left: d.left, seed: d.seed });
      return dt;
    },

    /* сломать трещину (тап): Ψ + постоянный span через счётчик */
    crack(state) {
      const d = data(state);
      if (d.left <= 0) return 0;
      const reward = C.reward(state);
      d.left = 0;
      d.broken = (d.broken || 0) + 1;
      d.best = Math.max(d.best || 0, d.broken);
      d.nextIn = C.gap(state);
      if (reward > 0) {
        state.res.psi = (state.res.psi || 0) + reward;
        if (!isFinite(state.res.psi)) state.res.psi = 0;
        state.meta.bestPsi = Math.max(state.meta.bestPsi || 0, state.res.psi);
      }
      G.bus.emit('crack:broken', { reward: reward, broken: d.broken, span: C.spanMult(state) });
      return reward;
    }
  };

  G.cracks = C;
})(window.G = window.G || {});
