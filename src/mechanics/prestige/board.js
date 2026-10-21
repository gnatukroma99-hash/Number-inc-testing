/* mechanics/prestige/board.js — доска перерождения. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('prestige');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tCores = C.tile('◆ Ядра', 'accent');
      const tMult = C.tile('Бонус ядер', 'good');
      const tGain = C.tile('Дадут сейчас', 'good');
      const tRuns = C.tile('Перерождений');

      const btn = G.h('button', { class: 'prestige-btn', type: 'button', text: 'ПЕРЕРОДИТЬСЯ' });
      btn.addEventListener('click', () => {
        const gain = G.prestige.perform(G.state);
        if (gain > 0) {
          G.ui.toast('Перерождение! +' + gain + ' ◆ (всего ' + (G.state.res.cores || 0) + ')', 'good', 3500);
        }
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCores.el, tMult.el, tGain.el, tRuns.el]),
        G.h('div', { class: 'prestige-card' }, [
          btn,
          G.h('div', { class: 'prestige-hint', text: G.content.prestige.keepHint }),
          G.h('div', { class: 'prestige-hint danger', text: G.content.prestige.resetHint })
        ]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: '◆ = floor(((D − ' + G.content.prestige.minD + ') / 4)^0.75)' }),
          G.h('code', { text: 'M ×= 1.5^◆' })
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const gain = G.prestige.gain(state);
          tCores.set(String(state.res.cores || 0));
          tMult.set('×' + G.fmt.num(G.prestige.mult(state)));
          tGain.set('+' + gain + ' ◆');
          tRuns.set(String(state.meta.totalRuns || 0));
          btn.disabled = gain <= 0;
          btn.className = 'prestige-btn' + (gain > 0 ? ' can' : ' cant');
          btn.textContent = gain > 0 ? 'ПЕРЕРОДИТЬСЯ  +' + gain + ' ◆' : 'НУЖНО БОЛЬШЕ ЦИФР';
        }
      };
    }
  };
})(window.G = window.G || {});
