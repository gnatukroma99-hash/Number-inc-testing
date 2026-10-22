/* mechanics/challenges/index.js — ИСПЫТАНИЯ ⚑: забег с запретом за постоянную награду.
   Данные — content/challenges.js. Логика отдаётся как G.challenges.
   Награды и запреты идут через ОБЩИЕ хуки движка (mult / dtMult / energyMult / speedBonus)
   и общий блокировщик механик G.challenges.blocked(state, id) (его спрашивает growth). */
(function (G) {
  'use strict';

  const cfg = () => G.content.challenges;
  const list = () => cfg().list || [];

  function find(id) {
    const l = list();
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  const C = {
    rng: Math.random,      /* не используется, но оставляем единый интерфейс рандома */
    list: list,
    find: find,

    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.challenges) m.challenges = { done: [], active: null };
      if (!Array.isArray(m.challenges.done)) m.challenges.done = [];
      return m.challenges;
    },

    /* пройденные живут в meta (не сбрасываются никогда) */
    done(state) {
      const m = state.meta || (state.meta = {});
      if (!Array.isArray(m.challenges)) m.challenges = [];
      return m.challenges;
    },

    isDone(state, id) { return C.done(state).indexOf(id) >= 0; },

    active(state) {
      const id = state.meta && state.meta.challenge;
      return id ? find(id) : null;
    },

    /* механика отключена активным испытанием? (спрашивает growth) */
    blocked(state, mechId) {
      const a = C.active(state);
      if (!a || !a.blockMech) return false;
      return a.blockMech.indexOf(mechId) >= 0;
    },

    /* прогресс до цели: 0..1 */
    progress(state) {
      const a = C.active(state);
      if (!a) return 0;
      const d = G.growth.D(state);
      return Math.max(0, Math.min(1, d / (a.goal || 1)));
    },

    canStart(state, id) {
      const c = find(id);
      if (!c || C.isDone(state, id)) return false;
      if (C.active(state)) return false;
      return (state.res.delta || 0) >= (c.cost || 0);
    },

    /* войти в испытание: платим Δ и схлопываем забег */
    start(state, id) {
      const c = find(id);
      if (!c || !C.canStart(state, id)) return null;
      state.res.delta = Math.max(0, (state.res.delta || 0) - (c.cost || 0));
      state.meta.challenge = id;
      G.resetScopes(state, ['run']);
      G.bus.emit('challenge:start', { id: id });
      return c;
    },

    /* выйти без награды */
    stop(state) {
      if (!state.meta.challenge) return false;
      const id = state.meta.challenge;
      state.meta.challenge = null;
      G.resetScopes(state, ['run']);
      G.bus.emit('challenge:stop', { id: id });
      return true;
    },

    /* проверка цели — вызывается на тике */
    check(state) {
      const a = C.active(state);
      if (!a) return null;
      if (G.growth.D(state) < (a.goal || Infinity)) return null;
      const done = C.done(state);
      if (done.indexOf(a.id) < 0) done.push(a.id);
      state.meta.challenge = null;
      const best = state.stats.bestD || 0;
      G.resetScopes(state, ['run']);
      state.stats.bestD = Math.max(best, state.stats.bestD || 0);
      G.bus.emit('challenge:done', { id: a.id });
      return a;
    },

    /* --- эффекты: запреты активного + награды пройденных (общие формулы) --- */
    mult(state) {
      let m = 1;
      for (const id of C.done(state)) {
        const c = find(id);
        if (c && c.reward && c.reward.Mmult) {
          const v = G.formula(c.reward.Mmult, { lvl: 1 });
          if (isFinite(v) && v > 0) m *= v;
        }
      }
      return m;
    },

    dtMult(state) {
      let m = 1;
      const a = C.active(state);
      if (a && a.dtMult) m *= a.dtMult;
      for (const id of C.done(state)) {
        const c = find(id);
        if (c && c.reward && c.reward.dtMult) {
          const v = G.formula(c.reward.dtMult, { lvl: 1 });
          if (isFinite(v) && v > 0) m *= v;
        }
      }
      return m;
    },

    energyMult(state) {
      let m = 1;
      const a = C.active(state);
      if (a && a.energyMult) m *= a.energyMult;
      for (const id of C.done(state)) {
        const c = find(id);
        if (c && c.reward && c.reward.energyMult) {
          const v = G.formula(c.reward.energyMult, { lvl: 1 });
          if (isFinite(v) && v > 0) m *= v;
        }
      }
      return m;
    },

    speedBonus(state) {
      let b = 0;
      for (const id of C.done(state)) {
        const c = find(id);
        if (c && c.reward && c.reward.speedBonus) {
          const v = G.formula(c.reward.speedBonus, { lvl: 1 });
          if (isFinite(v)) b += v;
        }
      }
      return b;
    },

    restart(state) {
      if (state.mech) state.mech.challenges = null;
    }
  };

  G.challenges = C;

  G.registry.addMechanic({
    id: 'challenges',
    order: 8.7,
    name: 'Испытания',
    short: 'Испытания',
    icon: '⚑',
    scope: 'tier',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    tick(state) { C.check(state); },
    mult(state) { return C.mult(state); },
    dtMult(state) { return C.dtMult(state); },
    energyMult(state) { return C.energyMult(state); },
    speedBonus(state) { return C.speedBonus(state); },
    onReset(state) { C.restart(state); },

    status(state) {
      const a = C.active(state);
      if (a) return '⚑ ' + Math.floor(G.growth.D(state)) + '/' + a.goal;
      return '⚑' + C.done(state).length + '/' + list().length;
    },

    vars(state) {
      const a = C.active(state);
      return {
        challenges: C.done(state).length,
        challengeActive: a ? 1 : 0,
        challengeGoal: a ? (a.goal || 0) : 0
      };
    }
  });
})(window.G = window.G || {});
