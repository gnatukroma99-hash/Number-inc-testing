/* ui/menu.js — МЕНЮ «Все доски» (v0.22.0): большой хаб-экран поверх игры.
   Вдохновение: карты слоёв в Really Grass Cutting Incremental и главное меню Shark Incremental —
   вместо ленты мелких вкладок игрок видит крупные карточки по группам с иконкой, названием,
   статусом и подсказкой, если доска ещё закрыта. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  let overlay = null;
  let body = null;
  let open = false;

  function docksOf(group) {
    const out = [];
    for (const id of (group.mechs || [])) {
      const m = id === 'core'
        ? { id: 'core', name: 'Рост', short: 'Рост', icon: '×', always: true }
        : G.registry.mechanic(id);
      if (m) out.push(m);
    }
    return out;
  }

  function statusOf(m) {
    if (m.always) return 'базовый рост числа';
    if (m.isUnlocked && !m.isUnlocked(G.state)) return m.lockHint || 'закрыто';
    return (typeof m.status === 'function' ? m.status(G.state) : '') || 'открыто';
  }

  function card(m, group) {
    const unlocked = m.always ? true : (!m.isUnlocked || m.isUnlocked(G.state));
    const el = G.h('button', {
      class: 'menu-card' + (unlocked ? '' : ' locked'), type: 'button',
      dataset: { id: m.id }
    }, [
      G.h('span', { class: 'menu-card-glow' }),
      G.h('span', { class: 'menu-card-ico' }, [G.ui.icons.node(m.icon || 'diamond')]),
      G.h('span', { class: 'menu-card-name', text: m.name || m.short || m.id }),
      G.h('span', { class: 'menu-card-status', text: statusOf(m) })
    ]);
    el.style.setProperty('--grp', group.color || '#35e2c0');
    el.addEventListener('click', () => {
      if (!unlocked) { G.ui.toast('Доска закрыта: ' + statusOf(m), 'warn'); return; }
      S.close();
      G.ui.docks.select(m.id);
    });
    return el;
  }

  function build() {
    body = G.h('div', { class: 'menu-body' });
    overlay = G.h('div', { class: 'menu-overlay', role: 'dialog', 'aria-label': 'Все доски' }, [
      G.h('div', { class: 'menu-panel' }, [
        G.h('div', { class: 'menu-head' }, [
          G.h('div', { class: 'menu-title', text: 'Все доски' }),
          G.h('div', { class: 'menu-sub', text: 'три слоя игры: забег, мета, Ярус 2' }),
          G.h('button', { class: 'menu-close', type: 'button', text: '×', title: 'Закрыть (Esc)' })
        ]),
        body
      ])
    ]);
    overlay.querySelector('.menu-close').addEventListener('click', () => S.close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) S.close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) S.close();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function paint() {
    G.dom.clear(body);
    const groups = (G.content && G.content.groups) || [];
    const activeId = document.body.dataset.board || 'core';
    let idx = 0;
    for (const g of groups) {
      const list = docksOf(g);
      if (!list.length) continue;
      const sec = G.h('div', { class: 'menu-group' }, [
        G.h('div', { class: 'menu-group-head' }, [
          G.h('span', { class: 'menu-group-dot' }),
          G.h('span', { class: 'menu-group-name', text: g.name }),
          G.h('span', { class: 'menu-group-hint', text: g.hint || '' }),
          G.h('span', { class: 'menu-group-count', text: list.filter((m) => m.always || !m.isUnlocked || m.isUnlocked(G.state)).length + '/' + list.length })
        ]),
        G.h('div', { class: 'menu-grid' }, list.map((m) => {
          const el = card(m, g);
          el.style.animationDelay = (idx++ * 18) + 'ms';
          if (m.id === activeId) el.classList.add('current');
          return el;
        }))
      ]);
      sec.style.setProperty('--grp', g.color || '#35e2c0');
      body.appendChild(sec);
    }
  }

  const S = {
    init() {
      if (!overlay) build();
      const btn = document.getElementById('btn-menu');
      if (btn) btn.addEventListener('click', () => S.toggle());
    },

    toggle() { open ? S.close() : S.open(); },

    open() {
      if (!overlay) build();
      paint();
      open = true;
      overlay.classList.add('on');
      document.body.classList.add('menu-open');
    },

    close() {
      if (!overlay) return;
      open = false;
      overlay.classList.remove('on');
      document.body.classList.remove('menu-open');
    },

    isOpen() { return open; }
  };

  G.ui.menu = S;
})(window.G = window.G || {});
