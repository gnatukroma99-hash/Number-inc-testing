/* mechanics/constellations/index.js — СОЗВЕЗДИЯ ✧: знак за связку достижений, активен один.
   Данные — content/constellations.js. Эффекты идут общими хуками движка. */
(function (G) {
  'use strict';

  const cfg = () => G.content.constellations;
  const list = () => cfg().list || [];

  function find(id) {
    const l = list();
    for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  const Co = {
    list: list,
    find: find,

    /* какие требования выполнены: { id: true/false } */
    unlocked(state) {
      const out = {};
      for (const s of list()) {
        out[s.id] = (s.requires || []).every((a) => G.achievements && G.achievements.has(state, a));
      }
      return out;
    },

    /* выбранный знак (мета: не сбрасывается) */
    active(state) {
      const id = state.meta && state.meta.sign;
      const s = id ? find(id) : null;
      if (!s) return null;
      return Co.unlocked(state)[s.id] ? s : null;
    },

    choose(state, id) {
      if (!state.meta) state.meta = {};
      const s = find(id);
      if (!s) { state.meta.sign = null; return null; }
      if (!Co.unlocked(state)[id]) return null;
      state.meta.sign = id;
      G.bus.emit('constellation:choose', { id: id });
      return s;
    },

    clear(state) {
      if (state.meta) state.meta.sign = null;
    },

    effect(state, field, def) {
      const s = Co.active(state);
      if (!s || !s.effect) return def;
      const v = s.effect[field];
      return v === undefined ? def : v;
    },

    restart(state) { /* знак живёт в meta — перерождение его не трогает */ }
  };

  G.constellations = Co;

  G.registry.addMechanic({
    id: 'constellations',
    order: 8.3,
    name: 'Созвездия',
    short: 'Созвездия',
    icon: '✧',
    scope: 'meta',
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    mult(state) { return Co.effect(state, 'Mmult', 1); },
    dtMult(state) { return Co.effect(state, 'dtMult', 1); },
    energyMult(state) { return Co.effect(state, 'energyMult', 1); },
    speedBonus(state) { return Co.effect(state, 'speedBonus', 0); },
    coreGainMult(state) { return Co.effect(state, 'coreGainMult', 1); },
    deltaGainMult(state) { return Co.effect(state, 'deltaGainMult', 1); },

    status(state) {
      const s = Co.active(state);
      return s ? '✧ ' + s.name : '✧ нет';
    },

    vars(state) {
      const un = Co.unlocked(state);
      const s = Co.active(state);
      return {
        signs: Object.keys(un).filter((k) => un[k]).length,
        sign: s ? 1 : 0
      };
    }
  });
})(window.G = window.G || {});
