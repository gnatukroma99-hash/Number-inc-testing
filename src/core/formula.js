/* core/formula.js — строки-формулы из данных. Новая механика = новая строка, а не новый код.
   Все формулы проекта свои, поэтому Function допустим и быстр. */
(function (G) {
  'use strict';

  const cache = new Map();

  const helpers = {
    log10: Math.log10,
    log: Math.log,
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    lerp: (a, b, t) => a + (b - a) * t,
    /* потолок с прогрессивным затуханием: возвращает множитель 0..1 */
    taper: (x, wall, width) => Math.max(0, Math.min(1, (wall + width - x) / width))
  };

  function compile(src) {
    let f = cache.get(src);
    if (!f) {
      f = new Function('v', 'with(Math){with(v){return (' + src + ');}}');
      cache.set(src, f);
    }
    return f;
  }

  /**
   * G.formula('1 + 0.005*S*lvl', { S: 42, lvl: 3 }) -> 2.13
   * Возвращает number. Для BigNum-операций используйте G.BN.
   */
  G.formula = function (src, vars) {
    if (typeof src === 'number') return src;
    if (!src) return 0;
    const scope = Object.assign({ lvl: 0, D: 0, S: 0, q: 0, z: 0, d1: 1, rho: 1, prime: 0, t: 0 }, helpers, vars || {});
    try {
      const out = compile(src)(scope);
      return isFinite(out) ? out : 0;
    } catch (e) {
      console.error('[formula] "' + src + '"', e);
      return 0;
    }
  };

  /* заранее скомпилировать — чтобы первый тик не тормозил */
  G.formula.precompile = function (src) {
    if (typeof src === 'string' && src) compile(src);
  };
})(window.G = window.G || {});
