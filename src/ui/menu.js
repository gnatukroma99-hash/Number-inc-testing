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

  /* поиск и фильтр по группам (v0.27.0) */
  let query = '';
  let filterGroup = 'all';
  let searchEl = null;
  let chipEls = [];

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

  /* прогресс по счётчикам механики (vars) и итогам из данных */
  const PROGRESS = [
    { key: 'challenges', total: () => ((G.content.challenges || {}).list || []).length },
    { key: 'pactNodes', total: () => G.registry.upgradesOf('pacttree').length },
    { key: 'omegaRules', total: () => ((G.content.omega || {}).rules || []).length },
    { key: 'signs', total: () => ((G.content.constellations || {}).list || []).length },
    { key: 'glyphs', total: () => ((G.content.glyphs || {}).slots || 3) },
    { key: 'treeNodes', total: () => G.registry.upgradesOf('tree').length },
    { key: 'patternTypes', total: () => ((G.content.patterns || {}).types || []).length },
    { key: 'achievements', total: () => (G.achievements ? G.achievements.total() : 0) },
    { key: 'comboBest', total: () => ((G.content.combo || {}).maxCombo || 12) }
  ];

  function progressOf(m) {
    if (!m.vars || typeof m.vars !== 'function') return null;
    let v = null;
    try { v = m.vars(G.state); } catch (e) { return null; }
    if (!v) return null;
    for (const p of PROGRESS) {
      if (typeof v[p.key] !== 'number') continue;
      const total = p.total() || 0;
      if (!total) continue;
      return { frac: Math.max(0, Math.min(1, v[p.key] / total)), text: v[p.key] + ' / ' + total };
    }
    return null;
  }

  /* убираем из статуса ведущие символы-иконки, чтобы в карточке был чистый текст */
  function cleanStatus(t) {
    return String(t || '').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, 34);
  }

  function statusOf(m) {
    if (m.always) return 'базовый рост числа';
    if (m.isUnlocked && !m.isUnlocked(G.state)) return m.lockHint || 'закрыто';
    return (typeof m.status === 'function' ? m.status(G.state) : '') || 'открыто';
  }

  const SPARK_W = 100;
  const SPARK_H = 26;

  function sparkline(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'menu-spark');
    svg.setAttribute('viewBox', '0 0 ' + SPARK_W + ' ' + SPARK_H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const series = G.history ? G.history.series(G.state, id) : [];
    const d = G.history ? G.history.path(series, SPARK_W, SPARK_H, 3) : '';
    if (d) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.6');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('stroke-linecap', 'round');
      svg.appendChild(p);
    } else {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '3'); line.setAttribute('x2', SPARK_W - 3);
      line.setAttribute('y1', SPARK_H - 4); line.setAttribute('y2', SPARK_H - 4);
      line.setAttribute('stroke', 'currentColor');
      line.setAttribute('stroke-opacity', '.25');
      line.setAttribute('stroke-width', '1.2');
      svg.appendChild(line);
    }
    return svg;
  }

  function isPinned(id) {
    const pins = (G.state && G.state.meta && G.state.meta.pins) || [];
    return pins.indexOf(id) >= 0;
  }

  function togglePin(id) {
    if (!G.state || !G.state.meta) return;
    const pins = G.state.meta.pins || [];
    const i = pins.indexOf(id);
    if (i >= 0) pins.splice(i, 1);
    else { pins.unshift(id); if (pins.length > 6) pins.length = 6; }
    G.state.meta.pins = pins;
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
      G.h('span', { class: 'menu-card-status', text: cleanStatus(statusOf(m)) }),
      (function () {
        const pr = progressOf(m);
        if (!pr) return G.h('span', { class: 'menu-card-bar-empty' });
        return G.h('span', { class: 'menu-card-bar' }, [
          G.h('span', { class: 'menu-card-bar-fill', style: 'width:' + (pr.frac * 100).toFixed(1) + '%' }),
          G.h('span', { class: 'menu-card-bar-text', text: pr.text })
        ]);
      })()
    ]);
    el.style.setProperty('--grp', group.color || '#35e2c0');

    /* звезда «закрепить» — отдельная кнопка, клик по ней не открывает доску */
    const pin = G.h('span', {
      class: 'menu-card-pin' + (isPinned(m.id) ? ' on' : ''),
      role: 'button',
      title: isPinned(m.id) ? 'Открепить' : 'Закрепить',
      text: '★'
    });
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePin(m.id);
      S.open();
    });
    el.appendChild(pin);

    el.appendChild(sparkline(m.id));

    el.addEventListener('click', () => {
      if (!unlocked) { G.ui.toast('Доска закрыта: ' + statusOf(m), 'warn'); return; }
      S.close();
      G.ui.docks.select(m.id);
    });
    return el;
  }

  /* строка инструментов: поиск + чипы групп */
  function buildTools() {
    searchEl = G.h('input', {
      class: 'menu-search', type: 'search', 'aria-label': 'Поиск доски',
      placeholder: 'поиск: дерево, глифы, Ψ, хроно…'
    });
    searchEl.addEventListener('input', () => {
      query = String(searchEl.value || '').trim().toLowerCase();
      paint();
    });
    searchEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (searchEl.value) { searchEl.value = ''; query = ''; paint(); }
      else S.close();
    });

    const mk = (id, name) => {
      const b = G.h('button', { class: 'menu-chip' + (filterGroup === id ? ' on' : ''), type: 'button', dataset: { group: id } }, [
        G.h('span', { class: 'menu-chip-text', text: name })
      ]);
      b.addEventListener('click', () => {
        filterGroup = id;
        for (const el of chipEls) el.classList.toggle('on', el.dataset.group === id);
        paint();
      });
      chipEls.push(b);
      return b;
    };
    const chips = G.h('div', { class: 'menu-chips' }, [mk('all', 'Все')].concat(
      ((G.content && G.content.groups) || []).map((g) => mk(g.id, g.name))
    ));
    return G.h('div', { class: 'menu-tools' }, [searchEl, chips]);
  }

  function build() {
    body = G.h('div', { class: 'menu-body' });
    overlay = G.h('div', { class: 'menu-overlay', role: 'dialog', 'aria-label': 'Все доски' }, [
      G.h('div', { class: 'menu-panel' }, [
        G.h('div', { class: 'menu-head' }, [
          G.h('div', { class: 'menu-title', text: 'Все доски' }),
          G.h('div', { class: 'menu-sub', text: 'четыре слоя игры: забег, мета, Ярус 2, Ярус 3' }),
          G.h('button', { class: 'menu-close', type: 'button', text: '×', title: 'Закрыть (Esc)' })
        ]),
        buildTools(),
        body
      ])
    ]);
    overlay.querySelector('.menu-close').addEventListener('click', () => S.close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) S.close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) S.close();
      /* Ctrl+K / Cmd+K и «/» — меню с поиском; в полях ввода не перехватываем */
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (!typing && (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault();
        S.openSearch();
      }
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  /* совпадает ли доска с поиском/фильтром */
  function matches(m, g) {
    if (filterGroup !== 'all' && (!g || g.id !== filterGroup)) return false;
    if (!query) return true;
    const alias = {
      'пси': 'psitree ψ', 'psi': 'psitree ψ', 'ядр': 'cores ◆', 'ядра': 'cores ◆',
      'дерево': 'tree psitree', 'деревья': 'tree psitree'
    };
    const q = alias[query] || query;
    /* ищем по имени, короткому имени, id и названию группы.
       lockHint НЕ ищем: «…нужен узел дерева» находил Решето и Зеркало на запрос «дерево». */
    const hay = [
      m.name || '', m.short || '', m.id || '',
      (g && g.name) || '', (g && g.hint) || ''
    ].join(' ').toLowerCase();
    return q.split(' ').some((part) => part && hay.indexOf(part) >= 0);
  }

  /* плоский экран результатов: одна сетка без секций */
  function paintSearch(activeId) {
    const groups = (G.content && G.content.groups) || [];
    const hits = [];
    for (const g of groups) {
      for (const m of docksOf(g)) if (matches(m, g)) hits.push({ m: m, g: g });
    }
    /* «Рост» живёт в группе «Забег», но проверяем всегда: он есть только там */
    const gName = filterGroup === 'all'
      ? null
      : ((groups.find((x) => x.id === filterGroup) || {}).name || filterGroup);
    const headTxt = query
      ? 'Найдено: ' + hits.length + (query ? ' · «' + query + '»' : '')
      : (gName || 'Все') + ' · ' + hits.length;
    const sec = G.h('div', { class: 'menu-group menu-found' }, [
      G.h('div', { class: 'menu-group-head' }, [
        G.h('span', { class: 'menu-group-dot' }),
        G.h('span', { class: 'menu-group-name', text: headTxt })
      ])
    ]);
    if (!hits.length) {
      sec.appendChild(G.h('div', { class: 'menu-empty' }, [
        G.h('div', { class: 'menu-empty-title', text: 'Ничего не нашлось' }),
        G.h('div', { class: 'menu-empty-hint', text: 'попробуй «дерево», «глифы», «хроно», «пси» или сбрось фильтр' })
      ]));
      body.appendChild(sec);
      return;
    }
    sec.appendChild(G.h('div', { class: 'menu-grid' }, hits.map((h) => {
      const el = card(h.m, h.g);
      if (h.m.id === activeId) el.classList.add('current');
      return el;
    })));
    body.appendChild(sec);
  }

  function paint() {
    G.dom.clear(body);
    const activeId = document.body.dataset.board || 'core';
    if (query || filterGroup !== 'all') { paintSearch(activeId); return; }
    const pins = ((G.state && G.state.meta && G.state.meta.pins) || []).filter((id) => id);
    if (pins.length) {
      const sec = G.h('div', { class: 'menu-group menu-pins' }, [
        G.h('div', { class: 'menu-group-head' }, [
          G.h('span', { class: 'menu-group-dot' }),
          G.h('span', { class: 'menu-group-name', text: 'Закреплённые' }),
          G.h('span', { class: 'menu-group-hint', text: 'звезда на карточке' })
        ]),
        G.h('div', { class: 'menu-grid' }, pins.map((id) => {
          const mm = id === 'core'
            ? { id: 'core', name: 'Рост', icon: '×', always: true }
            : G.registry.mechanic(id);
          if (!mm) return null;
          const g = (G.content.groups || []).find((x) => (x.mechs || []).indexOf(id) >= 0) || {};
          const el = card(mm, g);
          if (id === activeId) el.classList.add('current');
          return el;
        }).filter(Boolean))
      ]);
      sec.classList.add('pins');
      sec.style.setProperty('--grp', '#8ada6a');
      body.appendChild(sec);
    }

    const recent = ((G.state && G.state.meta && G.state.meta.recent) || []).filter((id) => id);
    if (recent.length) {
      const sec = G.h('div', { class: 'menu-group menu-recent' }, [
        G.h('div', { class: 'menu-group-head' }, [
          G.h('span', { class: 'menu-group-dot' }),
          G.h('span', { class: 'menu-group-name', text: 'Недавние' }),
          G.h('span', { class: 'menu-group-hint', text: 'последние доски' })
        ]),
        G.h('div', { class: 'menu-grid' }, recent.map((id) => {
          const mm = id === 'core'
            ? { id: 'core', name: 'Рост', icon: '×', always: true }
            : G.registry.mechanic(id);
          if (!mm) return null;
          const g = (G.content.groups || []).find((x) => (x.mechs || []).indexOf(id) >= 0) || {};
          const el = card(mm, g);
          if (id === activeId) el.classList.add('current');
          return el;
        }).filter(Boolean))
      ]);
      sec.classList.add('recent');
      body.appendChild(sec);
    }
    const groups = (G.content && G.content.groups) || [];
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

    /* закрепление доски (звезда в меню и в полоске над доской) */
    pinned(id) { return isPinned(id); },

    pin(id) {
      togglePin(id);
      return isPinned(id);
    },

    /* открыть меню сразу с фокусом в поиске (Ctrl+K или «/» в игре) */
    openSearch() {
      S.open();
      if (searchEl) {
        try { searchEl.focus(); } catch (e) { /* не критично */ }
      }
    },

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
