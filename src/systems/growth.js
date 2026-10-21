/* systems/growth.js — ядро: множитель, интервал, тик роста, энергия, барьеры.
   Механики НЕ правят этот файл: они отдают множители через свой API.
   Апгрейды и предметы магазина тоже отдают эффекты данными:
   поля addM / powM / dtMult / energyMult — строки-формулы от lvl. */
(function (G) {
  'use strict';

  const MIN_DT = 0.033;     // 30 тиков/с — предел скорости
  const MAX_EXP = 1.5;      // предел степени бонуса (защита движка)
  const MIN_DT_MULT = 0.02; // предел множителя интервала
  const MAX_SUBSTEPS = 400; // защита от фриза при огромном dt (×100 и т.п.)

  const W = {
    /* все переменные для строк-формул */
    vars(state) {
      const s = state.sample || { S: 0, q: 0, z: 0, d1: 1, rho: 1 };
      return {
        D: W.D(state),
        S: s.S,
        q: s.q,
        z: s.z,
        d1: s.d1,
        rho: s.rho,
        prime: state.res.prime || 0,
        t: state.stats.playtime || 0
      };
    },

    D(state) { return G.BN.log10(state.N); },

    /* ---- эффекты апгрейдов и предметов магазина (данные) ---- */
    upgSum(state, field) {
      let sum = 0;
      for (const u of G.registry.allUpgrades()) {
        if (!u[field]) continue;
        if (typeof u.isUnlocked === 'function' && !u.isUnlocked(state)) continue;
        const lvl = G.lvl(state, u.id);
        if (lvl <= 0) continue;
        const v = G.formula(u[field], Object.assign(W.vars(state), { lvl: lvl }));
        if (isFinite(v)) sum += v;
      }
      return sum;
    },

    upgProduct(state, field) {
      let p = 1;
      for (const u of G.registry.allUpgrades()) {
        if (!u[field]) continue;
        if (typeof u.isUnlocked === 'function' && !u.isUnlocked(state)) continue;
        const lvl = G.lvl(state, u.id);
        if (lvl <= 0) continue;
        const v = G.formula(u[field], Object.assign(W.vars(state), { lvl: lvl }));
        if (isFinite(v) && v > 0) p *= v;
      }
      return p;
    },

    /* --- интервал между умножениями --- */
    speedBonus(state) {
      let bonus = 0.10 * G.lvl(state, 'speed1');
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.speedBonus === 'function') bonus += m.speedBonus(state) || 0;
      }
      return bonus;
    },

    dtMult(state) {
      let mult = W.upgProduct(state, 'dtMult');
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.dtMult === 'function') mult *= (m.dtMult(state) || 1);
      }
      if (!isFinite(mult) || mult <= 0) return 1;
      return Math.max(MIN_DT_MULT, mult);
    },

    dt(state) {
      return Math.max(MIN_DT, (60 / (1 + W.speedBonus(state))) * W.dtMult(state));
    },

    /* --- множитель --- */
    baseM(state) {
      return 2 + G.lvl(state, 'mult1') + W.upgSum(state, 'addM');
    },

    M(state) {
      const base = W.baseM(state);
      let mech = 1;
      for (const m of G.registry.mechanics()) {
        if (m.isUnlocked && !m.isUnlocked(state)) continue;
        if (typeof m.mult === 'function') {
          const v = m.mult(state);
          if (isFinite(v) && v > 0) mech *= v;
        }
        if (!isFinite(mech) || mech <= 0) { mech = 1; break; }
      }

      /* «показатель» из магазина: бонус механик возводится в степень.
         Степень ограничена MAX_EXP, чтобы движок нельзя было сломать. */
      let exp = W.upgProduct(state, 'powM');
      if (!isFinite(exp) || exp < 1) exp = 1;
      exp = Math.min(exp, MAX_EXP);

      let m = base * (exp > 1 ? Math.pow(mech, exp) : mech);
      /* плоские множители из дерева ◆ (данные: поле Mmult) */
      m *= W.upgProduct(state, 'Mmult');
      if (!isFinite(m) || m <= 0) return 1;
      return m > 1e300 ? 1e300 : m;
    },

    /* --- барьеры (софткапы). Пройденные исчезают навсегда --- */
    passed(state, id) {
      return (state.meta.passedBarriers || []).indexOf(id) >= 0;
    },

    /* Невидимый софткап: усиливается с ростом D, в интерфейсе не показывается.
       Данные — G.content.hiddenSoftcap (knee / span / power / formula). */
    hiddenFactor(state, dOverride, spanMultCache) {
      const hs = G.content && G.content.hiddenSoftcap;
      if (!hs) return 1;
      /* spanMult — узлы дерева ◆ могут отодвигать knee-зону (данные).
         В горячем цикле (подшаги тика) значение передаётся кэшем, чтобы не
         перебирать все апгрейды на каждом подшаге. */
      let spanMult = spanMultCache;
      if (!(isFinite(spanMult) && spanMult > 0)) {
        spanMult = W.upgProduct(state, 'spanMult');
        if (!isFinite(spanMult) || spanMult <= 0) spanMult = 1;
      }
      const v = G.formula(hs.formula, {
        D: dOverride !== undefined ? dOverride : W.D(state),
        knee: hs.knee,
        span: hs.span * spanMult,
        power: hs.power
      });
      if (!isFinite(v) || v <= 0) return 0;
      return Math.max(0.001, Math.min(1, v));
    },

    /* видимые барьеры, без невидимого софткапа (для индикации в UI) */
    wallFactor(state) {
      let g = 1;
      const list = (G.content && G.content.barriers) || [];
      const d = W.D(state);
      for (const b of list) {
        if (W.passed(state, b.id)) continue;
        if (typeof b.requires === 'function' && !b.requires(state)) continue;

        if (b.formula) {
          const v = G.formula(b.formula, Object.assign(W.vars(state), {
            wall: b.wall, D: d, width: b.width || b.taper
          }));
          g *= isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
          continue;
        }
        const taper = G.formula(b.taper || 10, Object.assign(W.vars(state), { wall: b.wall }));
        g *= G.formula('taper(D, wall, width)', { D: d, wall: b.wall, width: taper });
        if (g <= 0) return 0;
      }
      return g;
    },

    barrierFactor(state, dOverride, spanMultCache) {
      return W.hiddenFactor(state, dOverride, spanMultCache) * W.wallFactor(state);
    },

    /* цифр в секунду (для отображения) */
    rate(state) {
      const M = W.M(state);
      const dt = W.dt(state);
      return (Math.log10(M) / dt) * W.barrierFactor(state);
    },

    /* --- энергия: зависит от количества нулей (D), линейно, не квадратично --- */
    energyRate(state) {
      const D = W.D(state);
      const cfg = (G.content && G.content.energy) || {};
      const lvl = G.lvl(state, 'energy1');
      let e = G.formula(cfg.formula || 'base * (1 + perDigit * D) * pow(growE, lvl)', {
        D: D,
        lvl: lvl,
        base: cfg.base !== undefined ? cfg.base : 1,
        perDigit: cfg.perDigit !== undefined ? cfg.perDigit : 1,
        growE: cfg.growE !== undefined ? cfg.growE : 1.25
      });
      e *= W.upgProduct(state, 'energyMult');
      return isFinite(e) && e > 0 ? e : 0;
    },

    /* --- плавное отображение: интерполируем D между шагами роста --- */
    displayD(state) {
      const d = state.disp;
      if (!d) return W.D(state);
      const t = (state.stats.playtime || 0) - d.t0;
      let k = d.dur > 0 ? t / d.dur : 1;
      if (!isFinite(k) || k < 0) k = 0;
      if (k > 1) k = 1;
      return d.from + (d.to - d.from) * k;
    },

    displayN(state) {
      return G.BN.fromLog10(Math.max(0, W.displayD(state)));
    },

    /* --- один шаг симуляции ---
       Рост НЕПРЕРЫВНЫЙ, как в референсе «Watch Numbers Grow»:
       за dt число умножается на M^(dt/ΔT), а не скачком раз в ΔT.
       Средний темп тот же, но число и его цифры меняются каждый кадр. */
    tick(state, dt) {
      const t0 = state.stats.playtime || 0;
      state.stats.playtime = t0 + dt;

      const dT = W.dt(state);
      const M = W.M(state);
      const logM = Math.log10(M);

      const dBefore = W.D(state);
      let dAfter = dBefore;

      /* ВАЖНО: большой dt (режим разработчика ×100, лаг, долгий кадр) режем на
         подшаги не длиннее SUB_STEP. Иначе число за один тик перелетает всю зону
         софткапа и барьер считается по старому D → число «залипает».
         M и ΔT считаем один раз (они не зависят от D), барьер — на каждом подшаге. */
      const SUB_STEP = 0.1;
      let spanMult = W.upgProduct(state, 'spanMult');
      if (!isFinite(spanMult) || spanMult <= 0) spanMult = 1;

      let left = dt;
      let guard = 0;
      while (left > 1e-9 && guard++ < MAX_SUBSTEPS) {
        const step = Math.min(left, SUB_STEP);
        left -= step;
        const b = W.barrierFactor(state, dAfter, spanMult);
        if (b <= 0) break;
        dAfter = Math.max(0, dAfter + logM * (step / dT) * b);
        /* N обновляем, чтобы следующий подшаг считал стену по новому D */
        state.N = G.BN.fromLog10(dAfter);
      }
      if (guard > 1) state.stats.substeps = (state.stats.substeps || 0) + guard - 1;

      state.D = dAfter;
      if (state.D > (state.stats.bestD || 0)) state.stats.bestD = state.D;

      if (dAfter > dBefore) state.stats.steps = (state.stats.steps || 0) + 1;

      /* между тиками логики (20 Гц) дорисовываем плавно на 30 Гц */
      state.disp = { from: dBefore, to: dAfter, t0: t0, dur: Math.max(0.03, dt) };

      /* энергия всегда капает — старт не должен быть мёртвым */
      state.res.energy = (state.res.energy || 0) + W.energyRate(state) * dt;
    }
  };

  G.growth = W;
})(window.G = window.G || {});
