/* mechanics/omega/board.js — доска «Кристалл Ω»: пассивный доход и правила мира. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('omega');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tOmega = C.tile('Ω кристалл', 'accent');
      const tRate = C.tile('Ω в минуту', 'good');
      const tRules = C.tile('Правил куплено', '');
      const bar = C.bar('следующее правило');

      const cards = G.omega.rules().map((r) => {
        const name = G.h('div', { class: 'om-name', text: r.name });
        const text = G.h('div', { class: 'om-text', text: r.text });
        const btn = G.h('button', { class: 'btn om-buy', type: 'button' });
        btn.addEventListener('click', () => {
          if (G.omega.buy(G.state, r.id)) {
            G.ui.toast('Ω Правило мира: ' + r.name, 'ach', 3200);
          }
        });
        const el = G.h('div', { class: 'om-card' }, [name, text, btn]);
        return { r: r, el: el, btn: btn };
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tOmega.el, tRate.el, tRules.el]),
        bar.el,
        C.section('Правила мира', cards.map((c) => c.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const rules = G.omega.rules();
          const bought = G.omega.data(state).rules.length;
          const bal = G.omega.balance(state);
          tOmega.set(bal.toFixed(2));
          tRate.set((G.omega.rate(state) * 60).toFixed(2));
          tRules.set(bought + ' / ' + rules.length);
          const next = rules.filter((r) => !G.omega.has(state, r.id))
            .sort((a, b) => a.cost - b.cost)[0];
          bar.set(next ? Math.min(1, bal / next.cost) : 1,
            next ? 'до «' + next.name + '»: ' + (next.cost - bal).toFixed(2) + ' Ω' : 'все правила куплены');

          for (const c of cards) {
            const has = G.omega.has(state, c.r.id);
            c.el.classList.toggle('done', has);
            if (has) { c.btn.textContent = 'действует'; c.btn.disabled = true; }
            else {
              c.btn.textContent = c.r.cost + ' Ω';
              c.btn.disabled = !G.omega.canBuy(state, c.r.id);
            }
          }
        }
      };
    }
  };
})(window.G = window.G || {});
