/* systems/sfx.js — звук интерфейса на WebAudio: НИКАКИХ файлов и сетевых запросов.
   Клик по кнопке покупки = короткий блип, перерождение = низкий свип.
   Включается настройкой settings.sound. Если AudioContext недоступен (jsdom, старый
   браузер) — система просто молчит, ошибок не бросает.
   UI звук не вызывает: подписка на события шины (системы не знают про UI). */
(function (G) {
  'use strict';

  let ctx = null;
  let failed = false;

  const PRESETS = {
    buy: { type: 'triangle', from: 640, to: 900, dur: 0.09, gain: 0.05, sweep: true },
    node: { type: 'triangle', from: 420, to: 700, dur: 0.16, gain: 0.07, sweep: true },
    prestige: { type: 'sine', from: 200, to: 80, dur: 0.5, gain: 0.09, sweep: true }
  };

  function ensureCtx() {
    if (ctx || failed) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { failed = true; return null; }
    try {
      ctx = new AC();
    } catch (e) {
      failed = true;
      return null;
    }
    return ctx;
  }

  const S = {
    /* выключен ли звук в настройках (по умолчанию — включён) */
    enabled(state) {
      const s = (state && state.settings) || {};
      return s.sound !== false;
    },

    play(kind) {
      if (!S.enabled(G.state)) return false;
      const c = ensureCtx();
      if (!c) return false;
      if (c.state === 'suspended' && typeof c.resume === 'function') c.resume();

      const p = PRESETS[kind] || PRESETS.buy;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();

      osc.type = p.type;
      /* лёгкий разброс высоты — чтобы зажатая кнопка не «строчила» одинаково */
      osc.frequency.setValueAtTime(p.from * (0.98 + Math.random() * 0.04), now);
      if (p.sweep) osc.frequency.exponentialRampToValueAtTime(p.to, now + p.dur);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(p.gain, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(now);
      osc.stop(now + p.dur + 0.02);
      return true;
    },

    /* для отладки/тестов: можно принудительно выключить */
    reset() { ctx = null; failed = false; }
  };

  G.bus.on('upgrade:bought', () => S.play('buy'));
  G.bus.on('prestige:done', () => S.play('prestige'));

  G.sfx = S;
})(window.G = window.G || {});
