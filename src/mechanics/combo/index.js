/* mechanics/combo/index.js — КОМБО ⌘: тапы по числу копят серию и дают временный M.
   Данные — content/combo.js. Оптимизация: keep-alive серии не требует таймеров —
   серия просто медленно гаснет в tick, а тап её поднимает. */
(function (G) {
  'use strict';

  const cfg = () => G.content.combo;

  const Co = {
    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.combo) m.combo = { combo: 0, taps: 0, best: 0, lastTap: 0 };
      return m.combo;
    },

    value(state) { return Math.max(0, Co.data(state).combo || 0); },

    mult(state) {
      const v = Co.value(state);
      return v > 0 ? 1 + v * (cfg().multPer || 0.06) : 1;
    },

    /* тап: возвращает новое значение серии (или null, если это автоклик) */
    tap(state, nowMs) {
      const c = cfg();
      const d = Co.data(state);
      const now = typeof nowMs === 'number' ? nowMs : Date.now();
      if (d.lastTap && now - d.lastTap < (c.coolDown || 0.05) * 1000) return null;
      d.lastTap = now;
      d.taps = (d.taps || 0) + 1;
      d.combo = Math.min(c.maxCombo || 12, (d.combo || 0) + (c.tapGain || 0.08));
      if (d.combo > (d.best || 0)) d.best = d.combo;
      return d.combo;
    },

    tick(state, dt) {
      const d = Co.data(state);
      if (!d.combo) return;
      d.combo = Math.max(0, d.combo - (cfg().decayPerSec || 0.55) * (dt || 0));
    },

    restart(state) { if (state.mech) state.mech.combo = null; }
  };

  G.combo = Co;

  G.registry.addMechanic({
    id: 'combo',
    order: 0.5,
    name: 'Комбо',
    short: 'Комбо',
    icon: '⌘',
    scope: 'run',
    hint: cfg().hint,
    lockHint: 'нужно 2 цифры (N ≥ 100)',

    isUnlocked(state) {
      return G.growth.D(state) >= 2;
    },

    tick(state, dt) { Co.tick(state, dt); },
    mult(state) { return Co.mult(state); },
    onReset(state) { Co.restart(state); },

    status(state) {
      const v = Co.value(state);
      return v > 0 ? '⌘' + v.toFixed(1) + ' ×' + Co.mult(state).toFixed(2) : '⌘ тапай';
    },

    vars(state) {
      const d = Co.data(state);
      return { comboBest: Math.floor(d.best || 0), comboTaps: d.taps || 0 };
    }
  });
})(window.G = window.G || {});
