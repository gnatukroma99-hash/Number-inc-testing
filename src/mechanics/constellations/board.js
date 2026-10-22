/* mechanics/constellations/board.js — доска «Созвездия ✧»: знаки за связки достижений. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('constellations');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tOpen = C.tile('Открыто знаков', 'good');
      const tActive = C.tile('Активный знак', 'accent');
      const tAch = C.tile('Достижений', '');

      const grid = G.h('div', { class: 'sign-grid' });
      const cards = (G.constellations.list() || []).map((s) => {
        const name = G.h('div', { class: 'sign-name', text: s.name });
        const eff = G.h('div', { class: 'sign-eff', text: s.text || '' });
        const req = G.h('div', { class: 'sign-req' });
        const el = G.h('div', { class: 'sign-card' }, [
          G.h('div', { class: 'sign-ico', text: s.icon || '✧' }), name, eff, req
        ]);
        el.addEventListener('click', () => {
          const act = G.constellations.active(G.state);
          if (act && act.id === s.id) { G.constellations.clear(G.state); return; }
          const ok = G.constellations.choose(G.state, s.id);
          if (ok) G.ui.toast('✧ Знак активен: ' + ok.name + ' · ' + ok.text, 'ach', 3000);
        });
        return { s: s, el: el, req: req, eff: eff };
      });
      cards.forEach((c) => grid.appendChild(c.el));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tOpen.el, tActive.el, tAch.el]),
        C.section('Знаки', [grid])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const un = G.constellations.unlocked(state);
          const act = G.constellations.active(state);
          const opened = Object.keys(un).filter((k) => un[k]).length;
          tOpen.set(opened + ' / ' + cards.length);
          tActive.set(act ? act.name : '—');
          tAch.set(G.achievements ? G.achievements.count(state) + ' / ' + G.achievements.total() : '0');
          for (const c of cards) {
            const isOpen = !!un[c.s.id];
            c.el.classList.toggle('locked', !isOpen);
            c.el.classList.toggle('on', !!act && act.id === c.s.id);
            c.req.textContent = (c.s.requires || []).map((id) => {
              const okAch = G.achievements && G.achievements.has(state, id);
              const a = G.achievements ? G.achievements.list().find((x) => x.id === id) : null;
              return (okAch ? '✓ ' : '· ') + ((a && a.name) || id);
            }).join(' + ');
          }
        }
      };
    }
  };
})(window.G = window.G || {});
