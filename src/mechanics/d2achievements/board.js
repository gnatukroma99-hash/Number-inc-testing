/* mechanics/d2achievements/board.js — доска «Достижения D2»: плитки и коллекция карточек.
   Логики нет: список — content/d2-achievements.js, открытие и множитель —
   systems/d2-achievements.js. Вёрстка переиспользует классы D1-достижений
   (ach / ach-grid / ach-icon / ach-name / ach-desc / ach-mark), новых стилей не нужно. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('d2achievements');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tCount = C.tile('Открыто', 'accent');
      const tMult = C.tile('Скорость осей', 'good');
      const tLeft = C.tile('Осталось', '');

      const cards = G.d2Achievements.list().map((a) => {
        const icon = G.h('div', { class: 'ach-icon' }, [G.ui.icons.node(a.icon || 'star')]);
        const name = G.h('div', { class: 'ach-name', text: a.name });
        const desc = G.h('div', { class: 'ach-desc', text: a.desc || '' });
        const mark = G.h('div', { class: 'ach-mark' }, [G.ui.icons.node('check')]);
        const el = G.h('div', { class: 'ach', dataset: { ach: a.id } },
          [icon, G.h('div', { class: 'ach-body' }, [name, desc]), mark]);
        return { a: a, el: el };
      });

      const grid = G.h('div', { class: 'ach-grid' }, cards.map((c) => c.el));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCount.el, tMult.el, tLeft.el]),
        G.h('div', { class: 'section' }, [
          G.h('h3', { class: 'section-title', text: 'Коллекция D2' }),
          grid
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const done = G.d2Achievements.count(state);
          const total = G.d2Achievements.total();
          tCount.set(done + ' / ' + total);
          tMult.set('×' + G.fmt.num(G.d2Achievements.mult(state), state.settings.numberFormat));
          tLeft.set(String(total - done));

          for (const c of cards) {
            const now = G.d2Achievements.has(state, c.a.id);
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
