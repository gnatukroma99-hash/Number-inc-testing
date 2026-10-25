/* ui/main-number.js — главное число. Всегда на экране, позиция из настроек. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SPARK_W = 64;   /* система координат микро-графиков шапки (масштаб — через CSS) */
  const SPARK_H = 22;

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
    buildSparks();
  }

  /* микро-графики M и ΔT: SVG строятся ОДИН раз, в update() правится только атрибут `d`.
     Контейнер создаём здесь, а не в index.html — шапку не переписываем. */
  function buildSparks() {
    refs.sparks = document.getElementById('heroSparks');
    if (!refs.sparks) {
      refs.sparks = G.h('div', { class: 'hero-sparks', id: 'heroSparks', 'aria-hidden': 'true' });
      const before = refs.hero.querySelector('.icon-btn');
      if (before) refs.hero.insertBefore(refs.sparks, before);
      else refs.hero.appendChild(refs.sparks);
    }
    G.dom.clear(refs.sparks);
    refs.sparkM = spark(refs.sparks, 'M', 'micro-m', 'Множитель M');
    refs.sparkDt = spark(refs.sparks, 'ΔT', 'micro-dt', 'Интервал ΔT, секунды');
  }

  function spark(host, label, cls, title) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.6');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'hero-spark');
    svg.setAttribute('viewBox', '0 0 ' + SPARK_W + ' ' + SPARK_H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.appendChild(path);
    host.appendChild(G.h('span', { class: 'hero-spark-box ' + cls, title: title }, [
      G.h('span', { class: 'hero-spark-tag', text: label }),
      svg
    ]));
    return path;
  }

  /* перерисовываем путь только когда он реально изменился (30 fps и так хватает) */
  function drawSpark(pathEl, values) {
    const d = G.history.path(values, SPARK_W, SPARK_H, 3);
    if (pathEl.getAttribute('d') === d) return;
    if (d) pathEl.setAttribute('d', d);
    else pathEl.removeAttribute('d');
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

    if (refs.sparkM && G.history) {
      drawSpark(refs.sparkM, G.history.series(state, 'M'));
      drawSpark(refs.sparkDt, G.history.series(state, 'dT'));
    }

    const r = G.growth.rate(state);
    /* маленький, но живой темп нельзя показывать как «0 цифр/с» — игрок читает это
       как «число замерло». Ниже 0.01 цифр/с печатаем значащие цифры. */
    const rTxt = (r > 0 && r < 0.01) ? r.toPrecision(2).replace('e-', 'e-') : G.fmt.num(r, mode);
    refs.dps.textContent = rTxt + ' цифр/с';

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
