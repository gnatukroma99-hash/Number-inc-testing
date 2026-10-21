/* mechanics/spark/board.js — доска «Золотая искра»: таймер, коллекция типов, активные буффы. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('spark');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tNext = C.tile('До искры', 'accent');
      const tCaught = C.tile('Поймано', 'good');
      const tNow = C.tile('Сейчас на экране', '');
      const bar = C.bar('искра');

      /* карточки типов: что можно поймать */
      const cards = G.spark.types().map((t) => {
        const icon = G.h('div', { class: 'spark-ico', text: t.icon || '✦' });
        icon.style.setProperty('--spark', t.color || '#ffd166');
        return G.h('div', { class: 'spark-card' }, [
          icon,
          G.h('div', { class: 'spark-body' }, [
            G.h('div', { class: 'spark-name', text: t.name }),
            G.h('div', { class: 'spark-text', text: t.text || '' })
          ])
        ]);
      });

      const buffsEl = G.h('div', { class: 'spark-buffs' });
      const catchBtn = G.h('button', { class: 'btn spark-catch', type: 'button', text: '✦ Поймать' });
      catchBtn.addEventListener('click', () => {
        const t = G.spark.catchSpark(G.state);
        if (t) G.ui.toast('✦ ' + t.name + ': ' + t.text, 'good', 2500);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNext.el, tCaught.el, tNow.el]),
        G.h('div', { class: 'section' }, [
          G.h('h3', { class: 'section-title' }, [G.h('span', { class: 'section-name', text: 'Что можно поймать' })]),
          G.h('div', { class: 'spark-grid' }, cards)
        ]),
        G.h('div', { class: 'section' }, [
          G.h('h3', { class: 'section-title' }, [G.h('span', { class: 'section-name', text: 'Активные буффы' })]),
          buffsEl
        ]),
        catchBtn,
        bar.el
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const now = G.spark.current(state);
          const next = G.spark.nextIn(state);
          tNext.set(Math.ceil(next) + ' с');
          tCaught.set(String((state.mech.spark && state.mech.spark.caught) || 0));
          tNow.set(now ? now.icon + ' ' + now.name : '—');
          catchBtn.disabled = !now;
          catchBtn.textContent = now ? now.icon + ' Поймать: ' + now.name : '✦ Подожди искру';

          const active = G.spark.active(state);
          buffsEl.textContent = active.length
            ? active.map((b) => b.icon + ' ' + b.name + ' · ' + b.text + ' · ' + Math.ceil(b.left) + ' с').join('   |   ')
            : 'сейчас пусто';
          const d = state.mech.spark || {};
          const life = (G.content.spark && G.content.spark.lifetime) || 15;
          bar.set(now ? Math.max(0, Math.min(1, (d.left || 0) / life)) : 0,
            now ? 'лови, пока не исчезла (' + Math.ceil(d.left || 0) + ' с)'
                : 'до искры ' + Math.ceil(next) + ' с');
        }
      };
    }
  };
})(window.G = window.G || {});
