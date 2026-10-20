/* core/bignum.js — число вида {m, e} = m * 10^e, m в [1, 10).
   Единственное место, где делается арифметика над N. */
(function (G) {
  'use strict';

  const SIG = 15;

  function norm(m, e) {
    if (!isFinite(m) || !isFinite(e) || m === 0) return { m: 0, e: 0 };
    const sign = m < 0 ? -1 : 1;
    m = Math.abs(m);
    // нормализация без циклов (быстрее и без риска зависания)
    if (m >= 10 || m < 1) {
      e += Math.floor(Math.log10(m));
      m = m / Math.pow(10, Math.floor(Math.log10(m)));
    }
    if (m >= 10) { m /= 10; e += 1; }
    if (m < 1) { m *= 10; e -= 1; }
    return { m: sign * m, e: e };
  }

  const BN = {
    SIG: SIG,

    one() { return { m: 1, e: 0 }; },
    zero() { return { m: 0, e: 0 }; },
    clone(a) { return { m: a.m, e: a.e }; },

    fromNumber(n) {
      if (!isFinite(n)) return { m: 1, e: 308 };
      return norm(n, 0);
    },

    fromLog10(l) {
      if (!isFinite(l)) return { m: 0, e: 0 };
      const e = Math.floor(l);
      return norm(Math.pow(10, l - e), e);
    },

    isZero(a) { return !a || a.m === 0; },
    isValid(a) { return !!a && isFinite(a.m) && isFinite(a.e); },

    log10(a) {
      if (!a || a.m <= 0) return 0;
      return Math.log10(a.m) + a.e;
    },

    /* N может быть больше 1e308 — toNumber тогда вернёт Infinity, это нормально */
    toNumber(a) { return a.m * Math.pow(10, a.e); },

    mul(a, b) { return norm(a.m * b.m, a.e + b.e); },

    mulNum(a, k) {
      if (!(k > 0)) return { m: 0, e: 0 };
      if (k > 1e100) return BN.fromLog10(BN.log10(a) + Math.log10(k));
      return norm(a.m * k, a.e);
    },

    divNum(a, k) {
      if (!(k > 0)) return { m: 0, e: 0 };
      return norm(a.m / k, a.e);
    },

    powNum(a, p) {
      if (a.m <= 0) return { m: 0, e: 0 };
      return BN.fromLog10(BN.log10(a) * p);
    },

    /* 15 значащих цифр мантиссы как массив цифр */
    digits(a) {
      if (!a || a.m === 0) return [0];
      let s;
      try { s = a.m.toPrecision(SIG); } catch (e) { return [0]; }
      s = s.replace('.', '').replace(/e.*$/, '');
      const out = [];
      for (let i = 0; i < s.length && out.length < SIG; i++) {
        const c = s.charCodeAt(i) - 48;
        if (c >= 0 && c <= 9) out.push(c);
      }
      return out.length ? out : [0];
    },

    /* "1.24e137" — для отладки и сейва */
    raw(a) {
      if (!a) return '0';
      return a.m.toFixed(SIG - 1) + 'e' + a.e;
    }
  };

  G.BN = BN;
})(window.G = window.G || {});
