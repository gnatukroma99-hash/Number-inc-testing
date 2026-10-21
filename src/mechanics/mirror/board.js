/* mechanics/mirror/board.js — доска «Зеркало»: пары цифр, симметрия, накоплено, апгрейды. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('mirror');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tPairs = C.tile('Проверяем пар', 'accent');
      const tSym = C.tile('Симметрия сейчас', 'good');
      const tGrain = C.tile('Накоплено', '');
      const tMult = C.tile('Итого от зеркала', 'good');
      const digits = C.digitRow(15);
      const bar = C.bar('сэмпл мантиссы');

      const upgrades = G.registry.upgradesOf('mirror').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tPairs.el, tSym.el, tGrain.el, tMult.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Мантисса: подсвечены совпавшие пары' }),
          digits.el,
          bar.el
        ]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: 'пар = 2 + lvl(mr_deep), максимум 7' }),
          G.h('code', { text: 'M ×= (1 + 0.25·lvl(mr_power))^симметрия' }),
          G.h('code', { text: 'M ×= 1 + 0.01·накоплено·lvl(mr_echo)' })
        ]),
        C.section('Апгрейды зеркала', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = state.mech.mirror || { sym: 0, grain: 0, pairs: 0 };
          const s = G.sampling.get(state);
          const w = d.pairs || mech.pairs(state);
          const last = (s.digits || []).length - 1;
          const ok = [];
          for (let i = 0; i < w; i++) {
            if (s.digits && s.digits[i] === s.digits[last - i]) { ok.push(i); ok.push(last - i); }
          }

          tPairs.set(String(w));
          tSym.set(d.sym + ' / ' + w);
          tGrain.set(String(d.grain));
          tMult.set('×' + G.fmt.num(mech.mult(state), state.settings.numberFormat));

          digits.set(s.digits);
          /* подсветка симметричных пар */
          const chips = digits.el.children;
          for (let i = 0; i < chips.length; i++) {
            if (ok.indexOf(i) >= 0) chips[i].classList.add('mirror-ok');
            else chips[i].classList.remove('mirror-ok');
          }
          bar.set(G.sampling.progress(state), 'сэмпл · ' + s.remaining.toFixed(1) + ' с');
          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
