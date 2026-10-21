/* mechanics/tree/board.js — доска дерева ◆: узлы по ярусам, требования, цена в ядрах. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('tree');
  const C = G.ui.components;

  /* значение эффекта на следующем уровне (без изменения состояния) */
  function nextValue(state, u, lvl) {
    const before = state.upg[u.id];
    state.upg[u.id] = lvl + 1;
    const v = G.upgrades.value(state, u);
    state.upg[u.id] = before;
    return v;
  }

  function nodeCard(u) {
    const lvlEl = G.h('div', { class: 'node-lvl' });
    const effEl = G.h('div', { class: 'node-eff' });
    const btn = G.h('button', { class: 'node-buy', type: 'button' });

    const el = G.h('div', { class: 'node' }, [
      G.h('div', { class: 'node-head' }, [
        G.h('span', { class: 'node-icon', text: u.icon || '●' }),
        G.h('span', { class: 'node-name', text: u.name }),
        lvlEl
      ]),
      G.h('div', { class: 'node-desc', text: u.desc || '' }),
      effEl,
      G.h('div', { class: 'node-note', text: u.note || '' }),
      btn
    ]);

    /* покупка: клик + зажатие (как у обычных апгрейдов) */
    let hold = null;
    const stop = () => { if (hold) { clearInterval(hold); hold = null; } };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      G.upgrades.buy(G.state, u);
      stop();
      hold = setInterval(() => G.upgrades.buy(G.state, u), 140);
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);

    function update(s) {
      const lvl = G.lvl(s, u.id);
      const maxed = lvl >= u.max;
      const met = G.upgrades.requirementsMet(s, u);

      lvlEl.textContent = maxed ? 'макс' : 'ур. ' + lvl + ' / ' + u.max;
      effEl.textContent = maxed
        ? C.fmtEffect(u, G.upgrades.value(s, u))
        : C.fmtEffect(u, G.upgrades.value(s, u)) + ' → ' + C.fmtEffect(u, nextValue(s, u, lvl));

      el.className = 'node' + (maxed ? ' maxed' : '') + (met ? '' : ' locked');

      if (maxed) {
        btn.textContent = 'куплено';
        btn.disabled = true;
        btn.className = 'node-buy maxed';
        return;
      }
      if (!met) {
        const need = (u.requires || [])
          .filter((id) => G.lvl(s, id) <= 0)
          .map((id) => (G.registry.upgrade(id) || {}).name || id);
        btn.textContent = 'нужно: ' + need.join(', ');
        btn.disabled = true;
        btn.className = 'node-buy locked';
        return;
      }
      const can = G.upgrades.canBuy(s, u);
      btn.textContent = G.fmt.num(G.upgrades.currentCost(s, u)) + ' ◆';
      btn.disabled = !can;
      btn.className = 'node-buy' + (can ? ' can' : ' cant');
    }

    return { el: el, update: update };
  }

  mech.board = {
    mount(root) {
      const tCores = C.tile('◆ Ядра', 'accent');
      const tNodes = C.tile('Узлов', 'good');
      const tGain = C.tile('Дадут за забег', 'good');

      const cards = G.registry.upgradesOf('tree').map((u) => ({ u: u, card: nodeCard(u) }));

      const tiers = (G.content.tree && G.content.tree.tiers) || [];
      const sections = tiers.map((t) => {
        const inTier = cards.filter((c) => (c.u.tier || '') === t.id);
        return C.section(t.name + (t.note ? ' — ' + t.note : ''),
          [G.h('div', { class: 'tree-grid' }, inTier.map((c) => c.card.el))]);
      });
      /* узлы без tier — чтобы ничего не пропало */
      const orphans = cards.filter((c) => !tiers.some((t) => t.id === c.u.tier));
      if (orphans.length) {
        sections.push(C.section('Прочее', [G.h('div', { class: 'tree-grid' }, orphans.map((c) => c.card.el))]));
      }

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCores.el, tNodes.el, tGain.el]),
        G.h('div', { class: 'formula-card tree-rules' }, [
          G.h('div', { class: 'block-label', text: 'Правила' }),
          G.h('code', { text: 'цена узла = base · growth^lvl  (в ◆)' }),
          G.h('code', { text: '◆ не сбрасываются перерождением и ярусом' }),
          G.h('code', { text: '◆ = floor(((D − 10) / 4)^0.75)' })
        ]),
        ...sections
      ]);
      root.appendChild(el);

      return {
        update(state) {
          tCores.set(G.fmt.num(state.res.cores || 0));
          tNodes.set(mech.bought(state) + ' / ' + mech.total());
          tGain.set('+' + G.prestige.gain(state) + ' ◆');
          cards.forEach((c) => c.card.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
