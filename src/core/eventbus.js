/* core/eventbus.js — крошечная шина событий. Системы не знают про UI. */
(function (G) {
  'use strict';
  const map = new Map();

  G.bus = {
    on(ev, fn) {
      if (!map.has(ev)) map.set(ev, []);
      map.get(ev).push(fn);
      return () => {
        const a = map.get(ev);
        if (!a) return;
        const i = a.indexOf(fn);
        if (i >= 0) a.splice(i, 1);
      };
    },
    emit(ev, payload) {
      const a = map.get(ev);
      if (!a) return;
      for (const fn of a.slice()) {
        try { fn(payload); } catch (e) { console.error('[bus]', ev, e); }
      }
    }
  };
})(window.G = window.G || {});
