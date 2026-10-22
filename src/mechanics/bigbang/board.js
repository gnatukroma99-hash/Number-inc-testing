/* mechanics/bigbang/board.js — доска «БОЛЬШОЙ БУМ»: схлопывание числа в Δ и снятие стены. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('bigbang');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tNow = C.tile('Цифр сейчас', 'accent');
      const tGain = C.tile('Δ за БУМ', 'good');
      const tBangs = C.tile('БУМов', '');
      const tWall = C.tile('Стена 1e308', '');

      const btn = G.h('button', { class: 'btn bigbang-btn', type: 'button', text: 'БОЛЬШОЙ БУМ' });
      btn.addEventListener('click', () => {
        const gain = G.bigbang.perform(G.state);
        if (gain > 0) {
          G.ui.toast('💥 БОЛЬШОЙ БУМ: +' + G.fmt.num(gain) + ' Δ · стена 1e308 снята навсегда', 'good', 5000);
        }
      });

      const list = (title, items, cls) => G.h('div', { class: 'bb-col ' + (cls || '') }, [
        G.h('div', { class: 'bb-col-title', text: title }),
        G.h('ul', { class: 'bb-list' }, items.map((t) => G.h('li', { text: t })))
      ]);

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNow.el, tGain.el, tBangs.el, tWall.el]),
        btn,
        C.section('Что происходит', [
          G.h('div', { class: 'bb-cols' }, [
            list('Останется', G.content.bigbang.keeps || [], 'good'),
            list('Сгорит', G.content.bigbang.loses || [], 'bad')
          ])
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.growth.D(state);
          const gain = G.bigbang.gain(state);
          tNow.set(d.toFixed(1));
          tGain.set('Δ ' + G.fmt.num(gain));
          tBangs.set(String(state.meta.bangs || 0));
          tWall.set(G.bigbang.wallPassed(state) ? 'снята' : 'держится');
          tWall.setClass('tile ' + (G.bigbang.wallPassed(state) ? 'good' : 'bad'));
          btn.disabled = gain <= 0;
          btn.textContent = gain > 0
            ? 'БОЛЬШОЙ БУМ · +' + G.fmt.num(gain) + ' Δ'
            : 'нужно ' + (G.content.bigbang.minD || 300) + ' цифр';
        }
      };
    }
  };
})(window.G = window.G || {});
