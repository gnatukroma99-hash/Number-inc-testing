/* core/format.js — три формата вывода чисел (настраивается игроком). */
(function (G) {
  'use strict';

  const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];

  function groupExp(e) {
    const s = String(Math.abs(e));
    if (s.length < 4) return (e < 0 ? '-' : '') + s;
    return (e < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function sciStr(m, e) {
    return m.toFixed(2) + 'e' + groupExp(e);
  }

  function groupInt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  const F = {
    /* BigNum -> строка */
    bn(a, mode) {
      if (!a) return '0';
      mode = mode || 'short';
      const l = G.BN.log10(a);
      if (l < 0) return '0';

      if (mode === 'full') {
        if (l < 15) return groupInt(G.BN.toNumber(a));
        return sciStr(a.m, a.e);
      }

      if (mode === 'sci') {
        if (l < 6) return groupInt(G.BN.toNumber(a));
        return sciStr(a.m, a.e);
      }

      /* short (по умолчанию): малые числа с дробной частью — иначе рост «скачет» 1→2 */
      if (l < 3) {
        const v = G.BN.toNumber(a);
        if (v < 10) return v.toFixed(2);
        if (v < 100) return v.toFixed(1);
        return String(Math.round(v));
      }
      const tier = Math.floor(l / 3);
      if (tier < SHORT.length && l < 100) {
        const v = G.BN.toNumber(a) / Math.pow(10, tier * 3);
        return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' ' + SHORT[tier];
      }
      return sciStr(a.m, a.e);
    },

    /* обычное число (энергия, осколки, ключи) */
    num(n, mode) {
      if (typeof n !== 'number' || !isFinite(n)) return '∞';
      if (mode === 'full' || mode === 'sci') {
        if (Math.abs(n) < 1e6) return n < 100 ? (Math.round(n * 100) / 100).toString() : groupInt(n);
        return sciStr(n / Math.pow(10, Math.floor(Math.log10(n))), Math.floor(Math.log10(n)));
      }
      if (Math.abs(n) < 1e4) {
        if (n < 100 && n % 1 !== 0) return (Math.round(n * 100) / 100).toString();
        return groupInt(n);
      }
      const tier = Math.floor(Math.log10(Math.abs(n)) / 3);
      if (tier < SHORT.length) {
        const v = n / Math.pow(10, tier * 3);
        return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' ' + SHORT[tier];
      }
      return sciStr(n / Math.pow(10, Math.floor(Math.log10(n))), Math.floor(Math.log10(n)));
    },

    /* проценты */
    pct(x) { return (x * 100).toFixed(x * 100 >= 100 ? 0 : 1) + '%'; },

    /* «137 цифр» */
    digitsLabel(d) {
      const n = Math.floor(d);
      return n + ' ' + plural(n, ['цифра', 'цифры', 'цифр']);
    },

    /* секунды -> человеческое время */
    time(sec) {
      sec = Math.max(0, sec);
      if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + ' с';
      const m = Math.floor(sec / 60);
      if (m < 60) return m + ' мин ' + Math.floor(sec % 60) + ' с';
      const hh = Math.floor(m / 60);
      return hh + ' ч ' + (m % 60) + ' мин';
    }
  };

  function plural(n, forms) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  G.fmt = F;
})(window.G = window.G || {});
