/* mechanics/glyphs/index.js — ГЛИФЫ ◈: рандомные артефакты Яруса 2 с плюсом и минусом.
   Данные — content/glyphs.js. Логика отдаётся как G.glyphs (тесты гоняют без DOM).
   Движок собирает эффекты общими хуками механик: mult / dtMult / energyMult / speedBonus. */
(function (G) {
  'use strict';

  const cfg = () => G.content.glyphs;

  function rarity(id) {
    const list = cfg().rarities || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }
  function profile(id) {
    const list = cfg().profiles || [];
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  /* первая цифра мантиссы — «цифра, на которой сейчас стоит число» */
  function leadDigit(state) {
    const digs = G.BN && G.BN.digits ? G.BN.digits(state.N) : null;
    return digs && digs.length ? digs[0] : -1;
  }

  const S = {
    rng: Math.random,
    setRng(fn) { S.rng = typeof fn === 'function' ? fn : Math.random; return S; },
    rarity: rarity,
    profile: profile,
    leadDigit: leadDigit,

    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.glyphs) {
        const n = cfg().slots || 3;
        m.glyphs = { slots: new Array(n).fill(null), active: 0, rolled: 0, nextId: 1 };
      }
      const d = m.glyphs;
      if (!Array.isArray(d.slots)) d.slots = new Array(cfg().slots || 3).fill(null);
      return d;
    },

    /* сила конкретного глифа с учётом редкости и резонанса с числом */
    power(state, g) {
      if (!g) return { power: 0, reson: false };
      const rar = rarity(g.rarity);
      const lead = leadDigit(state);
      const reson = lead >= 0 && g.digit === lead;
      return {
        power: (rar ? rar.power : 1) * (reson ? cfg().resonance : 1),
        reson: reson
      };
    },

    /* суммарные эффекты всех надетых глифов */
    effects(state) {
      const d = S.data(state);
      let M = 1, dt = 1, energy = 1, speed = 0, reson = 0, used = 0;
      for (let i = 0; i < d.slots.length; i++) {
        const g = d.slots[i];
        if (!g) continue;
        used++;
        const p = profile(g.profile) || {};
        const k = S.power(state, g).power;
        if (S.power(state, g).reson) reson++;
        const plus = p.plus || {};
        const minus = p.minus || {};
        if (plus.M) M *= 1 + plus.M * k;
        if (plus.energy) energy *= 1 + plus.energy * k;
        if (plus.speed) speed += plus.speed * k;
        if (plus.dt) dt *= Math.pow(plus.dt, k);
        if (minus.M) M *= Math.max(0.15, 1 - minus.M * k);
        if (minus.energy) energy *= Math.max(0.15, 1 - minus.energy * k);
        if (minus.speed) speed -= minus.speed * k;
        if (minus.dt) dt *= Math.pow(minus.dt, k);
      }
      return { M: M, dt: dt, energy: energy, speed: speed, reson: reson, used: used };
    },

    /* можно ли крутить */
    canRoll(state) {
      return (state.res.delta || 0) >= (cfg().rollCost || 3);
    },

    /* прокрутка: тратит Δ и ставит глиф в активный слот (старый сгорает) */
    roll(state) {
      const c = cfg();
      if (!S.canRoll(state)) return null;
      const d = S.data(state);
      state.res.delta = Math.max(0, (state.res.delta || 0) - (c.rollCost || 3));

      const digit = Math.floor(S.rng() * 10);
      let r = S.rng();
      const list = c.rarities || [];
      let rar = list.length ? list[list.length - 1] : { id: 'common' };
      for (let i = 0; i < list.length; i++) {
        if (r < list[i].chance) { rar = list[i]; break; }
        r -= list[i].chance;
      }
      const profs = c.profiles || [];
      const prof = profs.length ? profs[Math.floor(S.rng() * profs.length)] : { id: 'greed' };

      const idx = d.active >= 0 && d.active < d.slots.length ? d.active : 0;
      const replaced = d.slots[idx];
      const g = { id: d.nextId++, digit: digit, rarity: rar.id, profile: prof.id };
      d.slots[idx] = g;
      d.rolled = (d.rolled || 0) + 1;
      return { glyph: g, slot: idx, replaced: replaced, reson: S.power(state, g).reson };
    },

    setActive(state, i) {
      const d = S.data(state);
      if (i >= 0 && i < d.slots.length) d.active = i;
      return d.active;
    },

    clear(state, i) {
      const d = S.data(state);
      if (i >= 0 && i < d.slots.length) {
        const old = d.slots[i];
        d.slots[i] = null;
        return old;
      }
      return null;
    },

    restart(state) {
      if (state.mech) state.mech.glyphs = null;
    }
  };

  G.glyphs = S;

  G.registry.addMechanic({
    id: 'glyphs',
    order: 8.5,
    name: 'Глифы',
    short: 'Глифы',
    icon: '◈',
    scope: 'tier',                 /* живут, пока не сброшен ярус */
    hint: cfg().hint,
    lockHint: 'нужен БОЛЬШОЙ БУМ (Ярус 2)',

    isUnlocked(state) {
      return G.bigbang && G.bigbang.tierOpen ? G.bigbang.tierOpen(state)
        : (state.res.delta || 0) > 0;
    },

    mult(state) { return S.effects(state).M; },
    dtMult(state) { return S.effects(state).dt; },
    energyMult(state) { return S.effects(state).energy; },
    speedBonus(state) { return S.effects(state).speed; },

    onReset(state) { S.restart(state); },

    status(state) {
      const e = S.effects(state);
      return '◈' + e.used + (e.reson ? ' ✦' + e.reson : '');
    },

    vars(state) {
      const e = S.effects(state);
      const d = S.data(state);
      return {
        glyphs: e.used,
        glyphReson: e.reson,
        glyphRolls: d.rolled || 0
      };
    }
  });
})(window.G = window.G || {});
