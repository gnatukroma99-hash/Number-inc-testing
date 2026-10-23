/* systems/measure.js — МЕРА ⁿ (Ярус 3): считает свойства ПОКАЗАТЕЛЯ числа D
   и перемножает то, что объявлено в content/measure.js (props[]).
   Скан 4 раза в секунду: показатель меняется медленно, чаще незачем.

   «Красивые» порядки (круглый или палиндром) запоминаются навсегда:
   каждый даёт span через апгрейд «Красота навсегда». */
(function (G) {
  'use strict';

  const cfg = () => (G.content && G.content.measure) || {};

  /* простые до 997 — быстрый отсев перед дорогой проверкой */
  const SMALL = (function () {
    const out = [];
    for (let n = 2; n <= 997; n++) {
      let p = true;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; }
      if (p) out.push(n);
    }
    return out;
  })();

  function isPrime(n) {
    if (!isFinite(n) || n < 2) return false;
    n = Math.floor(n);
    for (let i = 0; i < SMALL.length; i++) {
      if (n === SMALL[i]) return true;
      if (n % SMALL[i] === 0) return false;
    }
    /* дороже sqrt — но скан идёт только при смене показателя */
    const lim = Math.min(Math.floor(Math.sqrt(n)), 5000);
    for (let d = 1009; d <= lim; d += 2) if (n % d === 0) return false;
    return true;
  }

  function data(state) {
    const m = state.mech || (state.mech = {});
    if (!m.measure) {
      m.measure = { clock: 0, lastScan: -1e9, e: 0, beauty: {}, beautyCount: 0, props: null };
    }
    const d = m.measure;
    if (!d.beauty) d.beauty = {};
    return d;
  }

  /* разбор показателя: цифры, сумма, нули, чётность, простота, палиндром, круглость */
  function profile(e) {
    const s = String(Math.floor(Math.max(0, e)));
    let sum = 0, zeros = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i) - 48;
      sum += c;
      if (c === 0) zeros++;
    }
    const rev = s.split('').reverse().join('');
    let sig = 0;
    for (let i = 0; i < s.length; i++) if (s[i] !== '0') sig++;
    return {
      e: Math.floor(Math.max(0, e)),
      text: s,
      len: s.length,
      sum: sum,
      zeros: zeros,
      last: s.length ? (s.charCodeAt(s.length - 1) - 48) : 0,
      even: Math.floor(Math.max(0, e)) % 2 === 0 ? 1 : 0,
      prime: isPrime(e) ? 1 : 0,
      pal: s.length > 1 && s === rev ? 1 : 0,
      round: s.length > 1 && sig === 1 ? 1 : 0
    };
  }

  const M = {
    data: data,
    profile: profile,
    isPrime: isPrime,

    open(state) {
      return (state.res.psi || 0) > 0 || (state.meta.breaks || 0) > 0 ||
        G.growth.D(state) >= (cfg().minD || 1000);
    },

    /* текущий снимок: раз в scanEvery секунд, чтобы не дёргать простоту каждый кадр */
    snapshot(state) {
      const d = data(state);
      if (d.props) return d.props;
      d.props = profile(G.growth.D(state));
      return d.props;
    },

    /* одно свойство: множитель (1, если свойство неактивно) */
    propMult(state, p) {
      const lvl = G.lvl(state, p.upg);
      if (!lvl) return 1;
      const vars = Object.assign({ lvl: lvl }, M.snapshot(state));
      let on = false;
      try { on = !!G.formula(p.test || '1', vars); } catch (e) { on = false; }
      if (!on) return 1;
      const v = G.formula(p.formula || '1', vars);
      return isFinite(v) && v > 0 ? v : 1;
    },

    /* все свойства → множитель M */
    mult(state) {
      let m = 1;
      for (const p of (cfg().props || [])) {
        const v = M.propMult(state, p);
        if (isFinite(v) && v > 0) m *= v;
      }
      /* страховка от переполнения: мера — не причина потерять рост */
      if (!isFinite(m) || m <= 0) return 1;
      return m > 1e300 ? 1e300 : m;
    },

    /* постоянный бонус к плоскости: 1 + 0.002·ур.·красивых порядков */
    spanMult(state) {
      const d = data(state);
      const lvl = G.lvl(state, 'ms_beauty');
      if (!lvl || !d.beautyCount) return 1;
      const v = 1 + 0.002 * lvl * d.beautyCount;
      return isFinite(v) && v > 0 ? v : 1;
    },

    /* какие свойства сейчас активны (для доски) */
    active(state) {
      const out = {};
      for (const p of (cfg().props || [])) {
        const vars = Object.assign({ lvl: G.lvl(state, p.upg) }, M.snapshot(state));
        let on = false;
        try { on = !!G.formula(p.test || '1', vars); } catch (e) { on = false; }
        out[p.id] = on;
      }
      return out;
    },

    /* тик: скан показателя и запоминание «красивых» порядков */
    tick(state, dt) {
      if (!M.open(state)) return 0;
      const c = cfg();
      const d = data(state);
      d.clock = (d.clock || 0) + (dt || 0);
      if (d.clock - (d.lastScan || 0) < (c.scanEvery || 0.25)) return 0;
      d.lastScan = d.clock;

      const e = Math.floor(G.growth.D(state));
      if (e === d.e) return 0;
      d.e = e;
      d.props = profile(e);

      let fresh = 0;
      if (d.props.round || d.props.pal) {
        const key = String(e);
        if (!d.beauty[key]) {
          d.beauty[key] = 1;
          d.beautyCount = (d.beautyCount || 0) + 1;
          fresh = 1;
          G.bus.emit('measure:beauty', { e: e, count: d.beautyCount, round: d.props.round, pal: d.props.pal });
        }
      }
      return fresh;
    }
  };

  G.measure = M;
})(window.G = window.G || {});
