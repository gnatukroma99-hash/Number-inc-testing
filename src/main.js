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

    /* D2: старый сейв получает state.d2 с дефолтами; без модуля — no-op */
    if (G.d2 && typeof G.d2.ensure === 'function') G.d2.ensure(state);

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
        G.fmt.num(offline.energy, state.settings.numberFormat) + ' ⌁',
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
      if (G.history) G.history.tick(s, dt);
      G.growth.tick(s, dt);
      /* D2 идёт своим тиком; D1-поля не трогает. Тикает и в фоне, чтобы оси не стояли. */
      if (G.d2Growth && G.d2 && G.d2.unlocked(s)) {
        try { G.d2Growth.tick(s, dt); } catch (e) { console.error('[d2]', e); }
      }

      for (const m of G.registry.mechanics()) {
        if (typeof m.isUnlocked === 'function' && !m.isUnlocked(s)) continue;
        /* механика, выключенная испытанием, не тикает вообще (например эхо не добавляет D) */
        if (G.challenges && typeof G.challenges.blocked === 'function' && G.challenges.blocked(s, m.id)) continue;
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
      /* отладка D2: открыть второе измерение, не проходя 10 ⧜ вручную */
      unlockD2() {
        const s = G.state;
        if (!s || !G.d2) return false;
        G.d2.ensure(s);
        s.d2.unlocked = true;
        s.res.turns = Math.max(s.res.turns || 0, 10);
        if (G.ui.d2World) G.ui.d2World.update(s);
        return true;
      },
      summary: () => G.registry.summary(),
      /* из чего собрался M: если число вдруг «замерло» — видно, какой слой виноват */
      mParts() {
        const s = G.state;
        const out = {
          M: G.growth.M(s), base: G.growth.baseM(s),
          powM: G.growth.upgProduct(s, 'powM'), Mmult: G.growth.upgProduct(s, 'Mmult'),
          rate: G.growth.rate(s), dt: G.growth.dt(s), mech: {}
        };
        for (const m of G.registry.mechanics()) {
          if (typeof m.mult !== 'function') continue;
          if (m.isUnlocked && !m.isUnlocked(s)) continue;
          try { out.mech[m.id] = m.mult(s); } catch (e) { out.mech[m.id] = 'ERR ' + e.message; }
        }
        return out;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.G = window.G || {});
