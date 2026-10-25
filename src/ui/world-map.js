/* ui/world-map.js — карта миров D1/D2 (+ закрытый D3). ТЗ: docs/CELESTIALS.md §8.
   Зачем: переключатель D1|D2 в шапке — две пилюли (ui/d2-world.js), а карта объясняет
   игроку, где он вообще находится и что за пределами ещё не открыто.
   Кнопка #btn-worldmap и оверлей строятся в JS: index.html правит только директор.
   Карта ничего не переключает сама — она выбирает узел и зовёт `G.ui.d2World.set(state, world)`,
   затем закрывается. Оформление — assets/css/style.css (классы world-map-*, map-node, map-line),
   здесь только структура и состояние узлов. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  /* Миры, которые умеет включать G.ui.d2World (ТЗ §8: D1 и D2).
     Узел с другим `world` — витрина: клик ничего не переключает, чтобы будущий D3
     не «проваливался» в D1 через запасное значение d2World.set. */
  const SWITCHABLE = ['d1', 'd2'];

  let overlay = null;
  let nodesEl = null;
  let nodes = {};          // id узла -> button
  let data = {};           // id узла -> запись content.worlds
  let state = null;
  let isOpen = false;
  let ready = false;

  function worlds() {
    const list = G.content && G.content.worlds;
    return Array.isArray(list) ? list : [];
  }

  function toast(msg) {
    if (G.ui && typeof G.ui.toast === 'function') G.ui.toast(msg, 'accent', 1500);
  }

  /* Открыт ли узел: D1 — всегда, D2 — по гейту, `locked` и незнакомый world — никогда. */
  function canOpen(s, node) {
    if (!node || node.locked === true) return false;
    if (SWITCHABLE.indexOf(node.world) < 0) return false;
    if (node.world !== 'd2') return true;
    if (G.d2 && typeof G.d2.unlocked === 'function') return !!G.d2.unlocked(s);
    if (G.ui.d2World && typeof G.ui.d2World.open === 'function') return !!G.ui.d2World.open(s);
    return !!(s && s.d2 && s.d2.unlocked);
  }

  /* Мир, в котором игрок сейчас: источник правды — ui/d2-world.js. */
  function current(s) {
    if (G.ui.d2World && typeof G.ui.d2World.world === 'function') {
      try {
        const w = G.ui.d2World.world(s);
        if (typeof w === 'string' && w) return w;
      } catch (e) { /* мир неизвестен — считаем D1 */ }
    }
    return (s && s.d2 && s.d2.active) ? 'd2' : 'd1';
  }

  function pick(node) {
    if (!state || !node) return;
    if (G.ui.d2World && typeof G.ui.d2World.set === 'function') G.ui.d2World.set(state, node.world);
    close();
    toast('Мир · ' + (node.name || node.id));
  }

  /* ---------- DOM ---------- */
  function nodeEl(node) {
    const el = G.h('button', {
      class: 'map-node', type: 'button', dataset: { world: node.id },
      title: node.name || node.id, 'aria-label': 'Мир: ' + (node.name || node.id)
    }, [
      G.h('span', { class: 'map-node-symbol', text: node.symbol || '·' }),
      G.h('span', { class: 'map-node-name', text: node.name || node.id }),
      G.h('span', { class: 'map-node-state', text: '' })
    ]);
    if (node.color) el.style.setProperty('--map-color', node.color);
    el.addEventListener('click', () => {
      if (!canOpen(state, node)) {
        toast(node.locked === true
          ? 'Этот мир ещё закрыт'
          : (node.world === 'd2' ? 'D2 откроется после Схлопывания' : 'Мир пока недоступен'));
        return;
      }
      pick(node);
    });
    nodes[node.id] = el;
    return el;
  }

  /* Пересобрать узлы из данных: node, line, node, line, node. */
  function fill() {
    while (nodesEl.firstChild) nodesEl.removeChild(nodesEl.firstChild);
    nodes = {};
    data = {};
    worlds().forEach((node, i) => {
      if (i > 0) nodesEl.appendChild(G.h('div', { class: 'map-line', 'aria-hidden': 'true' }));
      data[node.id] = node;
      nodesEl.appendChild(nodeEl(node));
    });
  }

  /* Состояние узлов от state: закрыт / открыт / здесь. */
  function refresh(s) {
    if (!nodesEl) return;
    const cur = current(s);
    for (const id in nodes) {
      const node = data[id] || {};
      const el = nodes[id];
      const ok = canOpen(s, node);
      const here = ok && node.world === cur;
      el.classList.toggle('map-node-locked', !ok);
      el.classList.toggle('map-node-current', here);
      el.setAttribute('aria-disabled', ok ? 'false' : 'true');
      el.dataset.locked = ok ? 'false' : 'true';
      const label = el.querySelector('.map-node-state');
      if (label) label.textContent = here ? 'здесь' : (ok ? 'открыт' : 'закрыт');
    }
  }

  function buildButton(hero) {
    const btn = G.h('button', {
      class: 'icon-btn', id: 'btn-worldmap', type: 'button',
      title: 'Карта миров', 'aria-label': 'Карта миров', text: '◎'
    });
    btn.addEventListener('click', () => { if (isOpen) close(); else open(state); });
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn && settingsBtn.parentNode === hero) hero.insertBefore(btn, settingsBtn);
    else hero.appendChild(btn);
  }

  /* В мире D2 шапка D1 (#hero) скрыта CSS — кнопка из неё недоступна.
     Вторая такая же кнопка (без id) живёт в шапке D2: карта открывается из обоих миров. */
  function buildTwin(heroD2) {
    const btn = G.h('button', {
      class: 'icon-btn world-map-twin', type: 'button',
      title: 'Карта миров', 'aria-label': 'Карта миров', text: '◎'
    });
    btn.addEventListener('click', () => { if (isOpen) close(); else open(state); });
    heroD2.appendChild(btn);
  }

  function buildPanel() {
    nodesEl = G.h('div', { class: 'world-map-nodes' });
    overlay = G.h('div', {
      class: 'world-map-overlay', id: 'worldMapOverlay', role: 'dialog',
      'aria-modal': 'true', 'aria-label': 'Карта миров'
    }, [
      G.h('div', { class: 'world-map-panel' }, [
        G.h('div', { class: 'world-map-head' }, [
          G.h('div', { class: 'world-map-title', text: 'Карта миров' }),
          G.h('button', { class: 'world-map-close', type: 'button', text: '×', title: 'Закрыть (Esc)' })
        ]),
        nodesEl,
        G.h('div', {
          class: 'world-map-hint',
          text: 'D1 — цифры. D2 — оси Ξ. Дальше пока пусто.'
        })
      ])
    ]);
    overlay.querySelector('.world-map-close').addEventListener('click', () => close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  /* ---------- API (ТЗ §8) ---------- */
  function init(s) {
    if (s) state = s;
    if (ready) { refresh(state); return true; }
    const hero = document.getElementById('hero');
    if (!hero) return false;         // шапки нет (страница без разметки) — молча выходим
    buildButton(hero);
    const heroD2 = document.getElementById('heroD2');
    if (heroD2) buildTwin(heroD2);
    buildPanel();
    fill();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close();
    });
    ready = true;
    refresh(state);
    return true;
  }

  function open(s) {
    if (s) state = s;
    if (!ready) init(state);
    if (!overlay) return false;
    refresh(state);
    isOpen = true;
    overlay.classList.add('on');
    document.body.classList.add('world-map-open');
    return true;
  }

  function close() {
    isOpen = false;
    if (overlay) overlay.classList.remove('on');
    document.body.classList.remove('world-map-open');
  }

  G.ui.worldMap = {
    init: init,
    open: open,
    close: close,
    toggle(s) { if (isOpen) close(); else open(s || state); }
  };
})(window.G = window.G || {});
