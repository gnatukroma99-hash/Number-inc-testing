/* mechanics/achievements/board.js — доска «Достижения»: карточки-коллекция. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('achievements');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tCount = C.tile('Открыто', 'accent');
      const tMult = C.tile('Бонус к M', 'good');
      const tLeft = C.tile('Осталось', '');

      const cards = G.achievements.list().map((a) => {
        const icon = G.h('div', { class: 'ach-icon', text: a.icon || '★' });
        const name = G.h('div', { class: 'ach-name', text: a.name });
        const desc = G.h('div', { class: 'ach-desc', text: a.desc || '' });
        const mark = G.h('div', { class: 'ach-mark', text: '✔' });
        const el = G.h('div', { class: 'ach' }, [icon, G.h('div', { class: 'ach-body' }, [name, desc]), mark]);
        return { a: a, el: el };
      });

      const grid = G.h('div', { class: 'ach-grid' }, cards.map((c) => c.el));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCount.el, tMult.el, tLeft.el]),
        G.h('div', { class: 'section' }, [
          G.h('h3', { class: 'section-title', text: 'Коллекция' }),
          grid
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const done = G.achievements.count(state);
          const total = G.achievements.total();
          tCount.set(done + ' / ' + total);
          tMult.set('×' + G.fmt.num(G.achievements.mult(state), state.settings.numberFormat));
          tLeft.set(String(total - done));

          for (const c of cards) {
            const now = G.achievements.has(state, c.a.id);
            const was = c.el.classList.contains('unlocked');
            c.el.classList.toggle('unlocked', now);
            if (now && !was && !(G.animationsOff && G.animationsOff())) {
              c.el.classList.remove('justUnlocked');
              void c.el.offsetWidth;
              c.el.classList.add('justUnlocked');
            }
          }
        }
      };
    }
  };
})(window.G = window.G || {});
