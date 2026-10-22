/* mechanics/spark/board.js — доска «Золотая искра»: таймер, коллекция типов, активные буффы. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('spark');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      let lastNow = null;
      let buffSig = null;
      const tNext = C.tile('До искры', 'accent');
      const tCaught = C.tile('Поймано', 'good');
      const tNow = C.tile('Сейчас на экране', '');
      const bar = C.bar('искра');

      /* карточки типов: что можно поймать */
      const cards = G.spark.types().map((t) => {
        const icon = G.h('div', { class: 'spark-ico' }, [G.ui.icons.node(t.icon || 'sparkle')]);
        icon.style.setProperty('--spark', t.color || '#ffd166');
        return G.h('div', { class: 'spark-card' }, [
          icon,
          G.h('div', { class: 'spark-body' }, [
            G.h('div', { class: 'spark-name', text: t.name }),
            G.h('div', { class: 'spark-text', text: t.text || '' })
          ])
        ]);
      });

      const rushEl = G.h('div', { class: 'spark-rush' });
      const buffsEl = G.h('div', { class: 'spark-buffs' });
      const catchIco = G.h('span', { class: 'spark-catch-ico' });
      const catchTxt = G.h('span', { class: 'spark-catch-txt', text: 'Поймать' });
      const catchBtn = G.h('button', { class: 'btn spark-catch', type: 'button' }, [catchIco, catchTxt]);
      catchBtn.addEventListener('click', () => {
        const t = G.spark.catchSpark(G.state);
        if (t) G.ui.toast('✦ ' + t.name + ': ' + t.text, 'good', 2500);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNext.el, tCaught.el, tNow.el]),
        rushEl,
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
          tNow.set(now ? now.name : '—');
          catchBtn.disabled = !now;
          if (lastNow !== (now && now.id)) {
            lastNow = now && now.id;
            G.ui.icons.set(catchIco, now ? now.icon : 'sparkle');
            catchTxt.textContent = now ? 'Поймать: ' + now.name : 'Подожди искру';
          }

          const rush = G.spark.rush(state);
          const rushTxt = rush.active
            ? 'ИСКРОВОЙ РАЖ · осталось ' + Math.ceil(rush.left) + ' с · серия ' +
              rush.streak + '/' + rush.need + ' · каждая N-я поимка запускает раж заново'
            : 'Искровой раж запускается каждой ' + rush.cfg.every + '-й поимкой: ' +
              rush.need + ' искр подряд → ◆ и мощный буфф';
          if (rushEl.textContent !== rushTxt) rushEl.textContent = rushTxt;

          const active = G.spark.active(state);
          const sig = active.map((b) => b.id + ':' + Math.ceil(b.left) + ':' + b.text).join('|');
          if (sig !== buffSig) {
            buffSig = sig;
            G.dom.clear(buffsEl);
            if (!active.length) {
              buffsEl.textContent = 'сейчас пусто';
            } else {
              for (const b of active) {
                buffsEl.appendChild(G.h('div', { class: 'spark-buff' }, [
                  G.ui.icons.node(b.icon || 'sparkle'),
                  G.h('span', { class: 'spark-buff-name', text: b.name }),
                  G.h('span', { class: 'spark-buff-text', text: b.text }),
                  G.h('span', { class: 'spark-buff-left', text: Math.ceil(b.left) + ' с' })
                ]));
              }
            }
          }
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
