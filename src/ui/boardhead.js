/* ui/boardhead.js — «мини-карта» над доской (v0.21.0).
   Показывает, ГДЕ ты: группа › доска, и даёт чипы соседних досок той же группы,
   чтобы не ходить в длинный список слева. Плюс стрелки ← → по группе. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let el = null;
  let crumbGroup = null;
  let crumbBoard = null;
  let chipsEl = null;
  let sig = '';

  function groupOf(id) {
    const groups = (G.content && G.content.groups) || [];
    for (const g of groups) if ((g.mechs || []).indexOf(id) >= 0) return g;
    return null;
  }

  function docksOf(group) {
    if (!group) return [];
    const out = [];
    for (const id of group.mechs) {
      const m = id === 'core'
        ? { id: 'core', name: 'Рост', short: 'Рост', icon: '×' }
        : G.registry.mechanic(id);
      if (!m) continue;
      if (m.isUnlocked && !m.isUnlocked(G.state)) continue;
      out.push(m);
    }
    return out;
  }

  function build() {
    crumbGroup = G.h('span', { class: 'bh-group' });
    crumbBoard = G.h('span', { class: 'bh-board' });
    chipsEl = G.h('div', { class: 'bh-chips' });
    el = G.h('div', { class: 'board-head-bar' }, [
      G.h('div', { class: 'bh-crumb' }, [
        G.h('span', { class: 'bh-dot' }),
        crumbGroup,
        G.h('span', { class: 'bh-sep', text: '›' }),
        crumbBoard
      ]),
      chipsEl
    ]);
    attach();
    return el;
  }

  /* доска пересоздаётся при каждом select → возвращаем полоску внутрь #board */
  function attach() {
    const board = document.getElementById('board');
    if (!board) return false;
    if (el.parentNode !== board || board.firstChild !== el) {
      if (board.firstChild) board.insertBefore(el, board.firstChild);
      else board.appendChild(el);
    }
    return true;
  }

  const B = {
    render(state, activeId) {
      if (!state || !activeId) return;
      if (!el) build();
      else attach();
      const g = groupOf(activeId);
      if (!g) { el.classList.remove('on'); return; }
      el.classList.add('on');
      el.style.setProperty('--grp', g.color || '#7d94a6');

      const def = activeId === 'core'
        ? { name: 'Рост' }
        : (G.registry.mechanic(activeId) || { name: activeId });
      crumbGroup.textContent = g.name;
      crumbBoard.textContent = def.name || activeId;

      const list = docksOf(g);
      const next = g.id + '|' + activeId + '|' + list.map((d) => d.id + (d.status ? ':' + d.status(state) : '')).join(',');
      if (next === sig) return;
      sig = next;

      G.dom.clear(chipsEl);
      for (const d of list) {
        const isActive = d.id === activeId;
        const chip = G.h('button', {
          class: 'bh-chip' + (isActive ? ' on' : ''),
          type: 'button',
          title: d.name || d.id
        }, [
          G.h('span', { class: 'bh-chip-ico' }, [G.ui.icons.node(d.icon || 'diamond')]),
          G.h('span', { class: 'bh-chip-text', text: d.short || d.name || d.id })
        ]);
        chip.addEventListener('click', () => G.ui.docks.select(d.id));
        chipsEl.appendChild(chip);
      }
    },

    /* обновление статусов без перерисовки крошек */
    tick(state) {
      if (!el || !el.classList.contains('on')) return;
      const active = el.dataset.id;
      if (active) B.render(state, active);
    }
  };

  G.ui.boardhead = B;
})(window.G = window.G || {});
