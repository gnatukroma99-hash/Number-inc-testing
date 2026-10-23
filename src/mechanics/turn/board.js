/* mechanics/turn/board.js — доска «ОБОРОТ ⧜»: кнопка сворачивания, трамплин, покупки за ⧜. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('turn');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tNow = C.tile('Цифр сейчас', 'accent');
      const tGain = C.tile('⧜ за ОБОРОТ', 'good');
      const tTurns = C.tile('ОБОРОТОВ', '');
      const tStart = C.tile('Трамплин', '');
      const tSpan = C.tile('ΔT / span', '');
      const tRate = C.tile('⧜-накат', 'good');

      const btn = G.h('button', { class: 'btn bigbang-btn', type: 'button', text: 'ОБОРОТ' });
      btn.addEventListener('click', () => {
        const gain = G.turn.perform(G.state);
        if (gain > 0) {
          G.ui.toast('⧜ ОБОРОТ: +' + G.fmt.num(gain) + ' · забег начался с ' +
            G.fmt.num(G.growth.D(G.state)) + ' цифр', 'ach', 5000);
        }
      });

      const rows = G.registry.upgradesOf('turn').map((u) => C.upgradeRow(G.state, u));

      const list = (title, items, cls) => G.h('div', { class: 'bb-col ' + (cls || '') }, [
        G.h('div', { class: 'bb-col-title', text: title }),
        G.h('ul', { class: 'bb-list' }, (items || []).map((t) => G.h('li', { text: t })))
      ]);

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNow.el, tGain.el, tRate.el, tTurns.el, tStart.el, tSpan.el]),
        btn,
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: '⧜ = floor(((D − 10000) / 50) ** 0.45)' }),
          G.h('code', { text: 'старт следующего забега: 40 + 20·⧜ + 60·ур. «Трамплин»' })
        ]),
        C.section('⧜ в постройки (покупки за Обороты)', rows.map((r) => r.el)),
        C.section('Что происходит', [
          G.h('div', { class: 'bb-cols' }, [
            list('Останется', G.content.turn.keeps || [], 'good'),
            list('Сгорит', G.content.turn.loses || [], 'bad')
          ])
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.growth.D(state);
          const gain = G.turn.gain(state);
          tNow.set(d.toFixed(1));
          tGain.set('⧜ ' + G.fmt.num(gain));
          tTurns.set(String(Math.floor(state.res.turns || 0)));
          tRate.set('+' + G.fmt.num(G.turn.rate(state)) + '/с');
          tStart.set(Math.round(G.turn.startDigits(state)) + ' цифр');
          tSpan.set('×' + G.fmt.num(G.growth.dt(state)) + ' / ×' + G.fmt.num(G.growth.upgProduct(state, 'spanMult')));
          rows.forEach((r) => r.update(state));
          btn.disabled = gain <= 0;
          btn.textContent = gain > 0
            ? 'ОБОРОТ · +' + G.fmt.num(gain) + ' ⧜'
            : 'нужно ' + (G.content.turn.minD || 10000) + ' цифр';
        }
      };
    }
  };
})(window.G = window.G || {});
