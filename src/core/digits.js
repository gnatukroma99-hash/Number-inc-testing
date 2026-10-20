/* core/digits.js — статистики значащих цифр мантиссы.
   Вся «цифровая» часть игры живёт здесь. */
(function (G) {
  'use strict';

  const PRIME_DIGITS = { 2: 1, 3: 1, 5: 1, 7: 1 };

  G.digits = {
    PRIME_DIGITS,

    /* полный набор статистик по BigNum */
    stats(a) {
      const d = G.BN.digits(a);
      let S = 0, q = 0, z = 0;
      for (let i = 0; i < d.length; i++) {
        S += d[i];
        if (PRIME_DIGITS[d[i]]) q++;
        if (d[i] === 0) z++;
      }
      const rho = 1 + ((S - 1 + 900) % 9);      // цифровой корень 1..9
      return {
        digits: d,
        S: S,
        q: q,
        z: z,
        d1: d[0],
        rho: rho,
        len: d.length
      };
    },

    /* паттерн текущей мантиссы (для будущих досок) */
    pattern(st) {
      const d = st.digits;
      const head = d.slice(0, 8).join('');
      const rev = d.slice(0, 8).reverse().join('');
      if (head === rev) return 'palindrome';
      if (st.q === st.len) return 'allprime';
      if (st.S % 9 === 0) return 'even';
      return null;
    },

    describe(p) {
      return {
        palindrome: 'Палиндром',
        allprime: 'Все простые',
        even: 'Ровный'
      }[p] || '—';
    }
  };
})(window.G = window.G || {});
