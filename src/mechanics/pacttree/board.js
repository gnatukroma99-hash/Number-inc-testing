/* mechanics/pacttree/board.js — доска «Пакт-дерево ⌁»: 4 ветви по 5 узлов, развилки. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('pacttree');
  const C = G.ui.components;
  const CFG = G.content.pacttree;

  mech.board = {
    mount(root) {
      const tNodes = C.tile('Узлов куплено', 'good');
      const tForks = C.tile('Развилок выбрано', 'accent');
      const tDelta = C.tile('Δ осколки', '');

      const blocks = (CFG.branches || []).map((b) => {
        const nodes = G.registry.upgradesOf('pacttree').filter((u) => u.branch === b.id)
          .sort((x, y) => (x.depth || 0) - (y.depth || 0));
        const cards = nodes.map((u) => {
          const name = G.h('div', { class: 'pt-name', text: u.name });
          const note = G.h('div', { class: 'pt-note', text: u.note || '' });
          const btn = G.h('button', { class: 'btn pt-buy', type: 'button' });
          btn.addEventListener('click', () => {
            if (G.pacttree.buy(G.state, u)) G.ui.toast('⌁ ' + u.name + ' — куплено', 'good', 2200);
          });
          const el = G.h('div', { class: 'pt-node' }, [name, note, btn]);
          el.style.setProperty('--pt', b.color || '#35e2c0');
          return { u: u, el: el, btn: btn };
        });
        return { b: b, el: G.h('div', { class: 'pt-branch' }, [
          G.h('div', { class: 'pt-branch-name', text: b.name }),
          G.h('div', { class: 'pt-nodes' }, cards.map((c) => c.el))
        ]), cards: cards };
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tNodes.el, tForks.el, tDelta.el]),
        C.section('Ветви', blocks.map((b) => b.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          let bought = 0;
          for (const u of G.registry.upgradesOf('pacttree')) if (G.lvl(state, u.id) > 0) bought++;
          tNodes.set(bought + ' / ' + G.registry.upgradesOf('pacttree').length);
          tForks.set(String(G.pacttree.chosen(state)));
          tDelta.set('Δ ' + G.fmt.num(state.res.delta || 0));

          for (const block of blocks) {
            for (const c of block.cards) {
              const lvl = G.lvl(state, c.u.id);
              const blockedBy = G.pacttree.blockedBy(state, c.u);
              const maxed = lvl >= c.u.max;
              c.el.classList.toggle('done', lvl > 0 && !blockedBy);
              c.el.classList.toggle('blocked', !!blockedBy);
              if (blockedBy) {
                const other = G.registry.upgrade(blockedBy);
                c.btn.textContent = 'закрыто: ' + (other ? other.name : blockedBy);
                c.btn.disabled = true;
              } else if (maxed) {
                c.btn.textContent = 'максимум';
                c.btn.disabled = true;
              } else {
                const cost = G.upgrades.currentCost(state, c.u);
                c.btn.textContent = (lvl > 0 ? lvl + ' → ' : '') + G.fmt.num(cost) + ' Δ';
                c.btn.disabled = !G.pacttree.canBuy(state, c.u);
              }
            }
          }
        }
      };
    }
  };
})(window.G = window.G || {});
