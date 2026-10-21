/* mechanics/tree/board.js — доска «Дерево ◆» как НАСТОЯЩЕЕ дерево:
   ветви = колонки, глубина = ряды, между узлами — линии-связки.
   Узел следующей глубины СКРЫТ, пока не куплен предыдущий узел ветви
   (данные: у узла есть `requires`). Логики покупки здесь нет — общий systems/upgrades.js. */
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

  const TIER_LABEL = { t1: 'I', t2: 'II', t3: 'III' };

  /* ---------- карточка узла ---------- */
  function nodeCard(u) {
    const lvlEl = G.h('div', { class: 'node-lvl' });
    const effEl = G.h('div', { class: 'node-eff' });
    const btn = G.h('button', { class: 'node-buy', type: 'button' });

    const real = G.h('div', { class: 'node' }, [
      G.h('div', { class: 'node-head' }, [
        G.h('span', { class: 'node-icon', text: u.icon || '●' }),
        G.h('span', { class: 'node-name', text: u.name }),
        G.h('span', { class: 'node-tier', text: TIER_LABEL[u.tier] || '' }),
        lvlEl
      ]),
      G.h('div', { class: 'node-desc', text: u.desc || '' }),
      effEl,
      G.h('div', { class: 'node-note', text: u.note || '' }),
      btn
    ]);

    /* заглушка: «ты не видишь, что там дальше» */
    const unknown = G.h('div', { class: 'node unknown' }, [
      G.h('div', { class: 'node-head' }, [
        G.h('span', { class: 'node-icon', text: '?' }),
        G.h('span', { class: 'node-name', text: '???' }),
        G.h('div', { class: 'node-lvl', text: '' })
      ]),
      G.h('div', { class: 'node-desc', text: 'Скрыто: сначала купи предыдущий узел этой ветви.' }),
      G.h('div', { class: 'node-eff', text: '· · ·' }),
      G.h('div', { class: 'node-note', text: '' }),
      G.h('button', { class: 'node-buy locked', type: 'button', disabled: 'disabled', text: '—' })
    ]);

    /* покупка: клик + зажатие */
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
      const visible = G.upgrades.requirementsMet(s, u) || G.lvl(s, u.id) > 0;
      real.style.display = visible ? '' : 'none';
      unknown.style.display = visible ? 'none' : '';
      if (!visible) return;

      const lvl = G.lvl(s, u.id);
      const maxed = lvl >= u.max;

      lvlEl.textContent = maxed ? 'макс' : 'ур. ' + lvl + ' / ' + u.max;
      effEl.textContent = maxed
        ? C.fmtEffect(u, G.upgrades.value(s, u))
        : C.fmtEffect(u, G.upgrades.value(s, u)) + ' → ' + C.fmtEffect(u, nextValue(s, u, lvl));

      real.className = 'node' + (maxed ? ' maxed' : '');

      if (maxed) {
        btn.textContent = 'куплено';
        btn.disabled = true;
        btn.className = 'node-buy maxed';
        return;
      }
      const can = G.upgrades.canBuy(s, u);
      btn.textContent = G.fmt.num(G.upgrades.currentCost(s, u)) + ' ◆';
      btn.disabled = !can;
      btn.className = 'node-buy' + (can ? ' can' : ' cant');
    }

    return { real: real, unknown: unknown, update: update };
  }

  /* ---------- доска ---------- */
  mech.board = {
    mount(root) {
      const tCores = C.tile('◆ Ядра', 'accent');
      const tNodes = C.tile('Узлов', 'good');
      const tGain = C.tile('Дадут за забег', 'good');
      const tNext = C.tile('Следующий узел', '');

      const cfg = G.content.tree || {};
      const branches = cfg.branches || [];
      const all = G.registry.upgradesOf('tree');

      const map = G.h('div', { class: 'tree-map' });
      map.style.gridTemplateColumns = 'repeat(' + Math.max(1, branches.length) + ', minmax(190px, 1fr))';

      const cards = [];
      branches.forEach((b, col) => {
        const head = G.h('div', { class: 'tree-branch-head', style: { gridColumn: String(col + 1), gridRow: '1' } }, [
          G.h('span', { class: 'branch-icon', text: b.icon || '•' }),
          G.h('span', { class: 'branch-name', text: b.name || b.id }),
          G.h('span', { class: 'branch-note', text: b.note || '' })
        ]);
        head.style.setProperty('--branch', b.color || 'var(--accent)');
        map.appendChild(head);

        const list = all.filter((u) => u.branch === b.id)
          .sort((x, y) => (x.depth || 0) - (y.depth || 0));

        list.forEach((u) => {
          const card = nodeCard(u);
          const cell = G.h('div', {
            class: 'tree-cell' + ((u.depth || 0) === 0 ? ' root' : ''),
            style: { gridColumn: String(col + 1), gridRow: String((u.depth || 0) + 2) }
          }, [card.real, card.unknown]);
          cell.style.setProperty('--branch', b.color || 'var(--accent)');
          cell.dataset.depth = String(u.depth || 0);
          map.appendChild(cell);
          cards.push({ u: u, card: card, cell: cell });
        });
      });

      /* узлы без известной ветви — чтобы ничего не потерялось */
      const orphans = all.filter((u) => !branches.some((b) => b.id === u.branch));
      if (orphans.length) {
        const box = G.h('div', { class: 'tree-grid' });
        orphans.forEach((u) => {
          const card = nodeCard(u);
          cards.push({ u: u, card: card, cell: null });
          box.appendChild(G.h('div', { class: 'tree-cell root' }, [card.real, card.unknown]));
        });
        map.appendChild(G.h('div', { class: 'tree-orphans' }, [box]));
      }

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCores.el, tNodes.el, tGain.el, tNext.el]),
        G.h('div', { class: 'formula-card tree-rules' }, [
          G.h('div', { class: 'block-label', text: 'Правила' }),
          G.h('code', { text: 'цена узла = base · growth^lvl  (в ◆)' }),
          G.h('code', { text: '◆ не сбрасываются перерождением и ярусом' }),
          G.h('code', { text: '◆ = floor(((D − 10) / 4)^0.75)' })
        ]),
        map
      ]);
      root.appendChild(el);

      return {
        update(state) {
          tCores.set(G.fmt.num(state.res.cores || 0));
          tNodes.set(mech.bought(state) + ' / ' + mech.total());
          tGain.set('+' + G.prestige.gain(state) + ' ◆');

          /* ближайший доступный по цене узел — подсказка «куда копить» */
          let next = null;
          for (const c of cards) {
            if (!G.upgrades.requirementsMet(state, c.u)) continue;
            if (G.upgrades.isMaxed(state, c.u)) continue;
            const cost = G.upgrades.currentCost(state, c.u);
            if (!next || cost < next.cost) next = { u: c.u, cost: cost };
          }
          tNext.set(next ? next.u.name + ' · ' + G.fmt.num(next.cost) + ' ◆' : 'всё куплено');

          for (const c of cards) {
            c.card.update(state);
            if (c.cell) {
              const visible = G.upgrades.requirementsMet(state, c.u) || G.lvl(state, c.u.id) > 0;
              c.cell.classList.toggle('is-hidden', !visible);
            }
          }
        }
      };
    }
  };
})(window.G = window.G || {});
