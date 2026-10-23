/* mechanics/breakthrough/board.js — доска «ПРОБОЙ»: кнопка и Ψ-покупки. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('breakthrough');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tNow = C.tile('Цифр сейчас', 'accent');
      const tGain = C.tile('Ψ за ПРОБОЙ', 'good');
      const tBreaks = C.tile('ПРОБОЕВ', '');
      const tWall = C.tile('Стена 1e1000', '');

      const btn = G.h('button', { class: 'btn bigbang-btn', type: 'button', text: 'ПРОБОЙ' });
      btn.addEventListener('click', () => {
        const gain = G.breakthrough.perform(G.state);
        if (gain > 0) G.ui.toast('Ψ ПРОБОЙ: +' + G.fmt.num(gain) + ' Ψ · стена 1e1000 снята', 'ach', 5000);
      });

      const rows = G.registry.upgradesOf('breakthrough').map((u) => C.upgradeRow(G.state, u));

      const list = (title, items, cls) => G.h('div', { class: 'bb-col ' + (cls || '') }, [
        G.h('div', { class: 'bb-col-title', text: title }),
        G.h('ul', { class: 'bb-list' }, items.map((t) => G.h('li', { text: t })))
      ]);

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNow.el, tGain.el, tBreaks.el, tWall.el]),
        btn,
        C.section('Ψ в силу (покупки за Ψ)', rows.map((r) => r.el)),
        C.section('Что происходит', [
          G.h('div', { class: 'bb-cols' }, [
            list('Останется', G.content.breakthrough.keeps || [], 'good'),
            list('Сгорит', G.content.breakthrough.loses || [], 'bad')
          ])
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.growth.D(state);
          const gain = G.breakthrough.gain(state);
          tNow.set(d.toFixed(1));
          tGain.set('Ψ ' + G.fmt.num(gain));
          tBreaks.set(String(state.meta.breaks || 0));
          tWall.set(G.breakthrough.wallPassed(state) ? 'снята' : 'держится');
          tWall.setClass('tile ' + (G.breakthrough.wallPassed(state) ? 'good' : 'bad'));
          rows.forEach((r) => r.update(state));
          btn.disabled = gain <= 0;
          btn.textContent = gain > 0
            ? 'ПРОБОЙ · +' + G.fmt.num(gain) + ' Ψ'
            : 'нужно ' + (G.content.breakthrough.minD || 1000) + ' цифр';
        }
      };
    }
  };
})(window.G = window.G || {});
