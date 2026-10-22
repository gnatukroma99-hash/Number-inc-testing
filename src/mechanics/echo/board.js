/* mechanics/echo/board.js — доска «Эхо ⟲»: твоё лучшее число возвращается, но ΔT медленнее. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('echo');
  const C = G.ui.components;
  const CFG = G.content.echo;

  mech.board = {
    mount(root) {
      const tBest = C.tile('Лучшее число', 'accent');
      const tRate = C.tile('Эхо, цифр/с', 'good');
      const tOn = C.tile('Состояние', '');
      const tDt = C.tile('ΔT множитель', '');

      const buyBtn = G.h('button', { class: 'btn echo-btn', type: 'button' });
      buyBtn.addEventListener('click', () => {
        if (!G.echo.bought(G.state)) {
          if (G.echo.buy(G.state)) G.ui.toast('⟲ Эхо куплено и включено', 'good', 3000);
          return;
        }
        const on = G.echo.toggle(G.state);
        G.ui.toast(on ? '⟲ Эхо включено (ΔT медленнее)' : '⟲ Эхо выключено (ΔT обычный)', 'info', 2500);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tBest.el, tRate.el, tOn.el, tDt.el]),
        buyBtn,
        C.section('Как это работает', [
          G.h('div', { class: 'section' }, [
            G.h('div', { class: 'echo-note', text:
              'Скорость эха = min(' + (CFG.ratePerSec * 100).toFixed(2) + '% лучшего D, ' +
              Math.round((CFG.maxShare || 0.5) * 100) + '% обычного роста) в секунду. ' +
              'За включённое эхо ΔT ×' + CFG.dtMult + '.' })
          ])
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const best = state.stats.bestD || 0;
          const rate = G.echo.rate(state);
          tBest.set(G.fmt.num(best) + ' цифр');
          tRate.set(rate > 0 ? '+' + rate.toFixed(2) : '0');
          tOn.set(G.echo.isOn(state) ? 'включено' : (G.echo.bought(state) ? 'выключено' : 'не куплено'));
          tDt.set('×' + (G.echo.isOn(state) ? CFG.dtMult : 1));
          if (!G.echo.bought(state)) {
            buyBtn.textContent = 'КУПИТЬ ЭХО · ' + CFG.cost + ' Δ';
            buyBtn.disabled = (state.res.delta || 0) < CFG.cost;
          } else {
            buyBtn.textContent = G.echo.isOn(state) ? 'ВЫКЛЮЧИТЬ ЭХО' : 'ВКЛЮЧИТЬ ЭХО';
            buyBtn.disabled = false;
          }
        }
      };
    }
  };
})(window.G = window.G || {});
