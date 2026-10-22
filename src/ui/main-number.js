/* ui/main-number.js — главное число. Всегда на экране, позиция из настроек. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  const refs = {};
  let lastDrawn = '';

  function init() {
    refs.n = document.getElementById('heroN');
    refs.digits = document.getElementById('heroDigits');
    refs.rate = document.getElementById('heroRate');
    refs.dps = document.getElementById('heroDps');
    refs.res = document.getElementById('heroRes');
    refs.hero = document.getElementById('hero');
    buildRes();
  }

  function buildRes() {
    G.dom.clear(refs.res);
    refs.resMap = {};
    for (const r of G.registry.allResources()) {
      const icon = G.ui.components.resIcon(r.id);
      const val = G.h('span', { class: 'res-val' });
      const box = G.h('div', { class: 'res' + (r.id === 'prime' ? ' prime' : '') + (r.id === 'cores' ? ' cores' : ''), title: r.name }, [
        G.h('span', { class: 'res-icon', text: icon }),
        val
      ]);
      refs.res.appendChild(box);
      refs.resMap[r.id] = box;
      refs.resMap[r.id + ':val'] = val;
    }
  }

  function applySettings(state) {
    const s = state.settings;
    document.body.classList.remove('pos-top', 'pos-bottom', 'pos-minimal');
    document.body.classList.add('pos-' + (s.numberPosition || 'top'));
    document.body.classList.toggle('no-anim', !s.animations);
    document.body.classList.toggle('dev-on', !!(s.devMode && G.timescale.scale(state) > 1));
  }

  function update(state, opts) {
    const mode = state.settings.numberFormat;
    const txt = G.fmt.bn(G.growth.displayN(state), mode);
    if (txt !== lastDrawn) {
      refs.n.textContent = txt;
      lastDrawn = txt;
    }

    const D = G.growth.displayD(state);
    refs.digits.textContent = G.fmt.digitsLabel(D);

    const M = G.growth.M(state);
    const dT = G.growth.dt(state);
    const spd = G.timescale.scale(state);
    refs.rate.textContent = '×' + G.fmt.num(M, mode) + ' / ' + (dT < 1 ? dT.toFixed(3) : dT.toFixed(2)) + ' с' +
      (spd > 1 ? '  ≫×' + spd : '');

    const r = G.growth.rate(state);
    refs.dps.textContent = G.fmt.num(r, mode) + ' цифр/с';

    /* ресурсы */
    for (const res of G.registry.allResources()) {
      const val = refs.resMap[res.id + ':val'];
      if (!val) continue;
      const v = state.res[res.id] || 0;
      val.textContent = G.fmt.num(v, mode) +
        (res.id === 'energy' ? ' (+' + G.fmt.num(G.growth.energyRate(state), mode) + '/с)' : '');
      /* v0.19.0: редкие валюты (Δ, Ω) подсвечиваются, когда их вообще есть */
      const box = val.closest ? val.closest('.res') : null;
      if (box && (res.id === 'delta' || res.id === 'omega')) box.classList.toggle('hot', v > 0);
    }

    /* индикация барьера */
    const bf = G.growth.wallFactor(state);
    refs.hero.classList.toggle('near-barrier', bf < 0.95);
    if (opts && opts.unlocked !== undefined) refs.hero.dataset.unlocked = opts.unlocked;
  }

  G.ui.mainNumber = { init, update, applySettings };
})(window.G = window.G || {});
