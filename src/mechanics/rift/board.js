/* mechanics/rift/board.js — доска «Разлом ⌁⃠»: статистика и объяснение события. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('rift');
  const C = G.ui.components;
  const CFG = G.content.rift;

  mech.board = {
    mount(root) {
      const tNext = C.tile('До разлома', 'accent');
      const tLeft = C.tile('Открыт', 'good');
      const tOpen = C.tile('Разломов было', '');
      const tCaught = C.tile('Тапов по разлому', '');
      const bar = C.bar('разлом');

      const btn = G.h('button', { class: 'btn rift-btn', type: 'button', text: 'ПРОДЛИТЬ РАЗЛОМ' });
      btn.addEventListener('click', () => {
        const add = G.rift.catchRift(G.state);
        if (add > 0) G.ui.toast('⌁⃠ +' + add.toFixed(0) + ' с к разлому', 'good', 2000);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNext.el, tLeft.el, tOpen.el, tCaught.el]),
        btn,
        bar.el,
        C.section('Что даёт разлом', [
          G.h('div', { class: 'rift-note', text:
            'Пока разлом открыт: M ×' + CFG.mult + ' и ⌁ ×' + CFG.energyMult + '. ' +
            'Каждый тап: +' + CFG.extend + ' с (не больше ' + CFG.maxLife + ' с). ' +
            'Появляется раз в ' + CFG.gapMin + '–' + CFG.gapMax + ' с на любой вкладке.' })
        ])
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.rift.data(state);
          const left = G.rift.left(state);
          tNext.set(left > 0 ? 'открыт' : Math.ceil(d.nextIn) + ' с');
          tLeft.set(left > 0 ? Math.ceil(left) + ' с' : '—');
          tOpen.set(String(d.opened || 0));
          tCaught.set(String(d.caught || 0));
          btn.disabled = left <= 0;
          bar.set(left > 0 ? left / (CFG.maxLife || 45) : 0,
            left > 0 ? 'M ×' + CFG.mult + ' · ' + Math.ceil(left) + ' с' : 'ждём следующий');
        }
      };
    }
  };
})(window.G = window.G || {});
