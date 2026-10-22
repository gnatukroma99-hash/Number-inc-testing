/* mechanics/duplicator/board.js — доска «Дубликатор ⧉»: тень числа и кнопка слияния. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('duplicator');
  const C = G.ui.components;
  const CFG = G.content.duplicator;

  mech.board = {
    mount(root) {
      const tShadow = C.tile('Тень, цифр', 'accent');
      const tRate = C.tile('Тень, цифр/с', '');
      const tMerges = C.tile('Слияний', 'good');
      const tPenalty = C.tile('Штраф ΔT', '');
      const bar = C.bar('тень');

      const toggleBtn = G.h('button', { class: 'btn dup-btn', type: 'button' });
      toggleBtn.addEventListener('click', () => {
        if (!G.duplicator.bought(G.state)) {
          if (G.duplicator.buy(G.state)) G.ui.toast('⧉ Дубликатор куплен, тень пошла', 'good', 3000);
          return;
        }
        const on = G.duplicator.toggle(G.state);
        G.ui.toast(on ? '⧉ Тень копится (M слабее)' : '⧉ Тень на паузе', 'info', 2200);
      });

      const mergeBtn = G.h('button', { class: 'btn dup-merge', type: 'button', text: 'СЛИТЬ ТЕНЬ' });
      mergeBtn.addEventListener('click', () => {
        const add = G.duplicator.merge(G.state);
        if (add > 0) G.ui.toast('⧉ Слияние: +' + add.toFixed(1) + ' цифр', 'ach', 3000);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tShadow.el, tRate.el, tMerges.el, tPenalty.el]),
        toggleBtn,
        mergeBtn,
        bar.el
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.duplicator.data(state);
          const shadow = G.duplicator.shadow(state);
          const pen = G.duplicator.penalty(state);
          tShadow.set(shadow.toFixed(2));
          tRate.set(G.duplicator.rate(state).toFixed(3));
          tMerges.set(String(d.merges || 0));
          tPenalty.set(pen > 0 ? '×' + CFG.penaltyDt + ' · ' + Math.ceil(pen) + 'с' : '—');
          bar.set(shadow / (CFG.capDigits || 40), shadow.toFixed(1) + ' / ' + CFG.capDigits + ' цифр');
          if (!G.duplicator.bought(state)) {
            toggleBtn.textContent = 'КУПИТЬ ДУБЛИКАТОР · ' + CFG.cost + ' Δ';
            toggleBtn.disabled = (state.res.delta || 0) < CFG.cost;
            mergeBtn.disabled = true;
          } else {
            toggleBtn.textContent = G.duplicator.isOn(state) ? 'ОСТАНОВИТЬ ТЕНЬ' : 'ЗАПУСТИТЬ ТЕНЬ';
            toggleBtn.disabled = false;
            mergeBtn.disabled = shadow <= 0;
          }
        }
      };
    }
  };
})(window.G = window.G || {});
