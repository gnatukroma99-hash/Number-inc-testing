/* systems/d2-offline.js — оффлайн-прогресс ИЗМЕРЕНИЯ 2 (docs/CELESTIALS.md §7).

   D1-оффлайн (systems/save.js, applyOffline) считается закрытой формулой за один шаг.
   Для D2 так нельзя: темп оси зависит от amount всех осей, а рост D₂ — от софткапа
   barrier(D₂), поэтому оффлайн D2 идёт шагами по 60 с настоящим G.d2Growth.tick,
   только с половинной эффективностью и без покупок.

   Правила (§7):
     • считаем только если D2 открыт (G.d2.unlocked) и прошло >= 30 с;
     • эффективность 50 %, потолок 8 ч;
     • шаговый вызов G.d2Growth.tick(state, step * 0.5) — покупок осей/Boost нет;
     • D1 (state.N / state.D / state.res) не трогаем;
     • state.d2.stats.playtime растит сам tick на своё dt: своей прибавки здесь нет,
       иначе время D2 удвоилось бы относительно реального перерыва.

   Возврат: { seconds, gainedD2, xi } | null. */
(function (G) {
  'use strict';

  const MIN_SECONDS = 30;        /* короче — игрок просто мигнул, отчёт не нужен */
  const EFF = 0.5;               /* оффлайн даёт половину темпа */
  const CAP_SECONDS = 8 * 3600;  /* потолок оффлайн-прогресса D2 */
  const STEP = 60;               /* шаг симуляции, сек (реального времени) */

  function num(v, def) { return (typeof v === 'number' && isFinite(v)) ? v : def; }

  function d2Of(state) { return (state && state.d2 && typeof state.d2 === 'object') ? state.d2 : null; }

  function unlocked(state) {
    return !!(G.d2 && typeof G.d2.unlocked === 'function' && G.d2.unlocked(state));
  }

  /* без роста D2 симулировать нечем: молча возвращаем null, а не нулевой отчёт */
  function growth() {
    return (G.d2Growth && typeof G.d2Growth.tick === 'function') ? G.d2Growth : null;
  }

  /* Ξ (state.d2.res.axis): заводим поле при отсутствии, как это делает d2-growth */
  function axisRes(d2) {
    if (!d2.res || typeof d2.res !== 'object') d2.res = { axis: 0, essence: 0 };
    if (!isFinite(d2.res.axis)) d2.res.axis = 0;
    return d2.res.axis;
  }

  /* D₂: кэш state.d2.D; битый — считаем из N₂, иначе «до» совпало бы с нулём
     и отчёт приписал бы весь рост оффлайну. */
  function d2D(d2) {
    if (isFinite(d2.D)) return d2.D;
    return (G.BN && d2.N) ? num(G.BN.log10(d2.N), 0) : 0;
  }

  /* Симуляция шагами: последний шаг — остаток (< 60 с), чтобы 50 % применились
     ко всем оплаченным секундам, а не только к целым минутам. */
  function simulate(d2Growth, state, seconds) {
    let left = seconds;
    while (left > 0) {
      const step = left < STEP ? left : STEP;
      d2Growth.tick(state, step * EFF);
      left -= step;
    }
  }

  G.d2Offline = {
    /* Оффлайн D2 за перерыв seconds. Директор зовёт после D1-оффлайна с тем же elapsed. */
    apply(state, seconds) {
      const d2 = d2Of(state);
      if (!d2 || !unlocked(state)) return null;

      const elapsed = num(seconds, 0);
      if (elapsed < MIN_SECONDS) return null;

      const d2Growth = growth();
      if (!d2Growth) return null;

      const effective = Math.min(elapsed, CAP_SECONDS);
      const beforeD2 = d2D(d2);
      const beforeXi = axisRes(d2);

      simulate(d2Growth, state, effective);

      const gained = d2D(d2) - beforeD2;
      const xi = num(d2.res && d2.res.axis, beforeXi) - beforeXi;
      return {
        seconds: effective,
        gainedD2: isFinite(gained) && gained > 0 ? gained : 0,
        xi: isFinite(xi) && xi > 0 ? xi : 0
      };
    }
  };
})(window.G = window.G || {});
