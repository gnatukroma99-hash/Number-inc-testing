/* main.js — точка входа и игровой цикл.
   Логика 20 Гц, отрисовка ~30 Гц. Вся арифметика — через G.BN. */
(function (G) {
  'use strict';

  const TICK_MS = 50;
  const RENDER_MS = 33;

  function boot() {
    let state = null;

    const loaded = G.save.loadLocal();
    if (loaded) {
      state = loaded;
      G.initResources(state);
      state.D = G.growth.D(state);
    } else {
      state = G.newState();
      G.initResources(state);
    }

    /* оффлайн-прогресс */
    let offline = null;
    if (loaded) {
      offline = G.save.applyOffline(state);
    }

    G.ui.app.init(state);

    if (offline && offline.gainedD > 0.01) {
      G.ui.toast(
        'Пока тебя не было (' + G.fmt.time(offline.seconds) + '): +' +
        offline.gainedD.toFixed(1) + ' цифр, +' +
        G.fmt.num(offline.energy, state.settings.numberFormat) + ' ⚡',
        'accent',
        6000
      );
    }

    /* ---------- логика ---------- */
    let last = performance.now();
    let saveAcc = 0;

    setInterval(() => {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 1) dt = 1;              // защита от «долгого таба»

      const s = G.state;

      /* режим разработчика: ускоряем ВСЁ, кроме таймеров сейва —
         иначе автосейв на ×100 писал бы в localStorage 10 раз в секунду */
      const realDt = dt;
      dt = G.timescale.apply(s, dt);

      G.sampling.update(s, dt);
      G.growth.tick(s, dt);

      for (const m of G.registry.mechanics()) {
        if (typeof m.isUnlocked === 'function' && !m.isUnlocked(s)) continue;
        if (typeof m.tick === 'function') {
          try { m.tick(s, dt); } catch (e) { console.error('[mech]', m.id, e); }
        }
      }

      try { G.automation.update(s, dt); } catch (e) { console.error('[auto]', e); }
      try { G.achievements.update(s, dt); } catch (e) { console.error('[ach]', e); }

      s.lastSeen = Date.now();

      if (s.settings.autosave) {
        saveAcc += realDt;
        if (saveAcc >= s.settings.autosaveInterval) {
          saveAcc = 0;
          G.save.saveLocal(s);
        }
      }

      /* автосинхронизация с облаком (если включена) */
      try { G.cloud.maybeAuto(s, realDt); } catch (e) { console.error('[cloud]', e); }
    }, TICK_MS);

    /* ---------- отрисовка ---------- */
    let lastRender = 0;
    function frame(t) {
      if (t - lastRender >= RENDER_MS) {
        lastRender = t;
        try { G.ui.app.render(G.state); } catch (e) { console.error('[render]', e); }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* ---------- отладка в консоли ---------- */
    G.debug = {
      state: () => G.state,
      give(n) { G.state.res.energy += n; },
      setD(d) { G.state.N = G.BN.fromLog10(d); G.state.D = d; G.state.disp = null; },
      summary: () => G.registry.summary()
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.G = window.G || {});
