/* systems/primes.js — простые числа: разряды (для ПРАЙМ-валюты) и утилиты. */
(function (G) {
  'use strict';

  const LIMIT = 2000;
  const primes = (() => {
    const sieve = new Uint8Array(LIMIT + 1).fill(1);
    sieve[0] = sieve[1] = 0;
    for (let i = 2; i * i <= LIMIT; i++) {
      if (sieve[i]) for (let j = i * i; j <= LIMIT; j += i) sieve[j] = 0;
    }
    const out = [];
    for (let i = 2; i <= LIMIT; i++) if (sieve[i]) out.push(i);
    return out;
  })();

  G.primes = {
    list(n) {
      n = Math.min(n, LIMIT);
      return primes.filter((p) => p <= n);
    },
    /* сколько простых чисел <= x */
    countUpTo(x) {
      x = Math.floor(x);
      if (x < 2) return 0;
      let c = 0;
      for (let i = 0; i < primes.length; i++) { if (primes[i] <= x) c++; else break; }
      return c;
    },
    isPrime(n) {
      n = Math.floor(n);
      if (n < 2) return false;
      for (let i = 0; i < primes.length; i++) {
        if (primes[i] === n) return true;
        if (primes[i] > n) return false;
      }
      return false;
    },
    /* простое по индексу (0 -> 2) */
    nth(i) { return primes[i] || primes[primes.length - 1]; },
    total: primes.length
  };
})(window.G = window.G || {});
