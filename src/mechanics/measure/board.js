/* mechanics/measure/board.js — доска «Мера ⁿ»: показатель числа, его свойства, апгрейды. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('measure');
  const C = () => G.ui.components;
  const CFG = () => G.content.measure || {};

  mech.board = {
    mount(root) {
      const tExp = C().tile('Показатель (D)', 'accent');
      const tSum = C().tile('Сумма / нули', '');
      const tMult = C().tile('M от меры', 'good');
      const tBeauty = C().tile('Красивых порядков', 'accent');

      const expEl = G.h('div', { class: 'measure-exp' });
      const cards = (CFG().props || []).map((p) => {
        const name = G.h('span', { class: 'measure-name', text: p.name });
        const val = G.h('span', { class: 'measure-val' });
        const el = G.h('div', { class: 'measure-card' }, [
          G.h('span', { class: 'measure-tag', text: p.tag }),
          name,
          val,
          G.h('span', { class: 'measure-desc', text: p.desc })
        ]);
        el.style.setProperty('--ms', p.color || '#38bdf8');
        return { p: p, el: el, val: val };
      });

      const rows = G.registry.upgradesOf('measure').map((u) => C().upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C().grid([tExp.el, tSum.el, tMult.el, tBeauty.el]),
        G.h('div', { class: 'measure-plate' }, [
          G.h('div', { class: 'block-label', text: 'Порядок числа (10^D) и его свойства' }),
          expEl
        ]),
        C().section('Свойства порядка', [
          G.h('div', { class: 'tile-grid measure-grid' }, cards.map((c) => c.el))
        ]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: 'M ×= Π (свойство: 1 + коэф · величина · ур.)' }),
          G.h('code', { text: 'span = 1 + 0.002 · ур. «Красота навсегда» · красивых порядков' })
        ]),
        C().section('Ψ в меру (покупки за Ψ)', rows.map((r) => r.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const p = G.measure.snapshot(state);
          const act = G.measure.active(state);
          const d = G.measure.data(state);
          tExp.set('ⁿ ' + p.text);
          tSum.set(p.sum + ' / ' + p.zeros);
          tMult.set('×' + G.fmt.num(G.measure.mult(state)));
          tBeauty.set(String(d.beautyCount || 0));

          /* показатель — по цифре на плитку, свойства красят */
          G.dom.clear(expEl);
          for (let i = 0; i < p.text.length; i++) {
            const ch = p.text[i];
            const cell = G.h('span', { class: 'measure-digit', text: ch });
            if (ch === '0') cell.classList.add('zero');
            expEl.appendChild(cell);
          }
          expEl.classList.toggle('round', !!p.round);
          expEl.classList.toggle('pal', !!p.pal);
          expEl.classList.toggle('prime', !!p.prime);

          for (const c of cards) {
            const on = !!act[c.p.id];
            const lvl = G.lvl(state, c.p.upg);
            c.el.classList.toggle('on', on && lvl > 0);
            c.el.classList.toggle('idle', !on);
            c.el.classList.toggle('owned', lvl > 0);
            c.val.textContent = lvl > 0
              ? (on ? '×' + G.fmt.num(G.measure.propMult(state, c.p)) : 'ждёт показатель')
              : 'не куплено';
          }
          rows.forEach((r) => r.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
