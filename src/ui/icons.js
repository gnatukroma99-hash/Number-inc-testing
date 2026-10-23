/* ui/icons.js — СОБСТВЕННЫЙ набор иконок (inline SVG, без эмоджи и без файлов).
   Данные ссылаются на иконку ключом: `icon: 'bolt'`. Порядок разрешения:
     1) ключ из набора ниже → SVG (цвет = currentColor, масштаб = font-size);
     2) односимвольный знак (`◆`, `❖`, `⧗`, `Σ`…) → обычный текст (монохром, не эмоджи);
     3) ничего → ромб ◆.
   Все контуры рисуются линией 1.7 в сетке 24×24 — единый «чертёжный» стиль.
   Новые иконки добавляются в ICONS, ничего в других файлах менять не нужно. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  /* d — контур (stroke), f — заливка (fill). Можно несколько путей через '|'. */

  /* символьные иконки механик (◆ ⌗ ⧗ ⌘ …) -> имя SVG, чтобы не было «тофу»-квадратов */
  const ALIAS = {
    '⌘': 'cycle', '⧗': 'cycle', '⟲': 'recycle', '⧉': 'branch', '⌗': 'grid',
    '◆': 'core', '⌁': 'bolt', '⌾': 'target', '⚑': 'target', '✍': 'facet',
    'Ω': 'crystal', '✧': 'star', '✦': 'sparkle', '💥': 'burst', '◈': 'diamond',
    'Σ': 'sigma', 'Δ': 'delta', '❖': 'prime', '×': 'plus', '✧✦': 'star'
  };

  const ICONS = {
    /* ресурсы и валюта */
    bolt: 'M13.5 2.5 5.5 13.5H11l-1.5 8 8.5-11.5H12l1.5-7.5z',
    burst: 'M12 3v3.4|M12 17.6V21|M3 12h3.4|M17.6 12H21|M5.6 5.6l2.4 2.4|M16 16l2.4 2.4|M18.4 5.6 16 8|M8 16l-2.4 2.4',
    core: 'M12 3 21 12l-9 9-9-9z|M12 8l4 4-4 4-4-4z',
    prime: 'M12 3 15 9l6 1.5-4.5 4.5 1 6L12 18l-5.5 3 1-6L3 10.5 9 9z',
    crystal: 'M12 2.5 19.5 8v8L12 21.5 4.5 16V8z|M4.5 8 12 12.5 19.5 8|M12 12.5v9',
    diamond: 'M7 3h10l4 6-9 12L3 9z|M3 9h18|M9.5 9 12 21|M14.5 9 12 21|M7 3l2.5 6|M17 3l-2.5 6',

    /* темп и скорость */
    fast: 'M5 5l6 7-6 7|M13 5l6 7-6 7',
    slow: 'M9 5 3 12l6 7|M19 5l-6 7 6 7',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 7.5V12l3.2 2',
    cycle: 'M20.5 12a8.5 8.5 0 0 1-14.6 5.9|M3.5 12a8.5 8.5 0 0 1 14.6-5.9|M20.5 4.5V10h-5.5|M3.5 19.5V14H9',

    /* рост и числа */
    chartUp: 'M4 4v16h16|M7 15l4-4 3 2.5L19 8|M15.5 8H19v3.5',
    chart: 'M4 20V4|M4 20h16|M8 20v-6|M12.5 20V9|M17 20v-8',
    sigma: 'M17.5 4H7l5.5 8L7 20h10.5',
    delta: 'M12 4 20.5 19.5H3.5z',
    hundred: 'M4 19 20 5|M6.5 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z|M17.5 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    grain: 'M12 3v18|M3 12h18|M6 6l12 12|M18 6 6 18',

    /* дерево и структура */
    tree: 'M12 3.5 17 11h-3.2l4 6H6.2l4-6H7z|M12 17v4',
    branch: 'M12 21V12|M12 12 5 5|M12 12l7-7|M5 5h3.5|M16 5h3.5',
    grid: 'M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z',
    link: 'M9.5 14.5 14.5 9.5|M7 12 4.5 14.5a3.5 3.5 0 0 0 5 5L12 17|M17 12l2.5-2.5a3.5 3.5 0 0 0-5-5L12 7',

    /* предметы интерфейса */
    cart: 'M3 4h2.2l2.3 11h9.4L19 7H6.4|M9 19.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z|M17 19.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0z|M8 5.5H5v2a3 3 0 0 0 3 3|M16 5.5h3v2a3 3 0 0 1-3 3|M12 13v4|M8.5 20h7',
    gem: 'M7 3.5h10L21 9l-9 11.5L3 9z|M3 9h18|M9.5 9 12 20.5|M14.5 9 12 20.5',
    axe: 'M4 20.5 10.5 14|M10.5 14 8 11.5 13.5 6l4.5 4.5L13 15z|M13.5 6 19 3.5 20.5 9l-2.5 1.5',
    robot: 'M5 8.5h14v8H5z|M9 16.5v3|M15 16.5v3|M12 4v4.5|M9 11.5h.01|M15 11.5h.01|M2.5 11.5v3|M21.5 11.5v3',
    battery: 'M3 8h14v8H3z|M17 11h2.5v2H17|M6.5 11v2|M10 11v2',
    bell: 'M6.5 17V10.5a5.5 5.5 0 0 1 11 0V17l2 2H4.5z|M10 20.5a2 2 0 0 0 4 0',
    lens: 'M11 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z|M15.5 15.5 20.5 20.5',
    target: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z|M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M12 11.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z',
    slot: 'M4 5h16v14H4z|M9 9h.01|M15 9h.01|M9 15h.01|M15 15h.01|M12 12h.01',
    ice: 'M12 2.5 20 7v10l-8 4.5L4 17V7z|M4 7l8 4.5L20 7|M12 11.5v10',
    rocket: 'M12 2.5c3 2.5 4.5 6 4.5 9.5L14 15h-4l-2.5-3c0-3.5 1.5-7 4.5-9.5z|M8 12.5 5 16l3.5-.5|M16 12.5 19 16l-3.5-.5|M10.5 18.5 12 21.5l1.5-3|M12 7.5h.01',
    brick: 'M3 6h18v12H3z|M3 11h18|M9 6v5|M15 11v7|M9 16v2',
    lock: 'M6 11h12v9H6z|M8.5 11V8a3.5 3.5 0 0 1 7 0v3|M12 15v2',
    warn: 'M12 3.5 21 19.5H3z|M12 9v4.5|M12 16.5h.01',
    sparkle: 'M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9z',
    star: 'M12 3 15 9.2l6.5 1-4.7 4.6 1.1 6.6L12 18.3 6.1 21.4l1.1-6.6L2.5 10.2l6.5-1z',
    recycle: 'M7.5 8.5 4 14.5h4|M16.5 15.5 20 9.5l-3.5-2|M9.5 20h7l-2-3.5|M12 4.5 9.5 8h5z',
    facet: 'M12 2.5 20 12l-8 9.5L4 12z|M12 7 16.5 12 12 17l-4.5-5z',
    plus: 'M12 5v14|M5 12h14',
    minus: 'M5 12h14',
    close: 'M6 6l12 12|M18 6 6 18',
    up: 'M12 20V4|M6 10l6-6 6 6',
    down: 'M12 4v16|M6 14l6 6 6-6',
    left: 'M20 12H4|M10 6l-6 6 6 6',
    right: 'M4 12h16|M14 6l6 6-6 6',
    gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z|M19.5 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.7 3h-4l-.4 2.7a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
    check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
    save: 'M4 4h12l4 4v12H4z|M8 4v6h8V4|M8 20v-6h8v6',
    trash: 'M4 7h16|M9 7V4h6v3|M6.5 7l1 13h9l1-13|M10 11v6|M14 11v6',
    fit: 'M4 9V4h5|M20 9V4h-5|M4 15v5h5|M20 15v5h-5',
    center: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z|M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z|M12 1.5v3|M12 19.5v3|M1.5 12h3|M19.5 12h3'
  };

  /* односимвольные «знаки» — остаются текстом (монохром, без эмоджи-начертания) */
  const GLYPH = /^\P{Extended_Pictographic}{1,3}$/u;

  const SVGNS = 'http://www.w3.org/2000/svg';

  function pathEl(d, filled) {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    if (filled) {
      p.setAttribute('fill', 'currentColor');
      p.setAttribute('stroke', 'none');
    }
    return p;
  }

  function svgEl(name, cls) {
    const def = ICONS[name];
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'ico-svg' + (cls ? ' ' + cls : ''));
    const parts = String(def).split('|');
    for (const part of parts) svg.appendChild(pathEl(part));
    return svg;
  }

  const I = {
    ICONS: ICONS,

    has(name) { return Object.prototype.hasOwnProperty.call(ICONS, name); },

    /* элемент иконки: SVG для ключа, текст для моносимвола, ◆ по умолчанию */
    node(name, cls) {
      const box = G.h('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
      const real = ALIAS[name] || name;
      if (I.has(real)) {
        box.appendChild(svgEl(real));
        box.classList.add('ico-svg-box');
        return box;
      }
      const txt = (name === undefined || name === null || name === '') ? '◆' : String(name);
      box.textContent = GLYPH.test(txt) ? txt : '◆';
      box.classList.add('ico-text');
      return box;
    },

    /* заменить иконку у готового элемента (без пересборки DOM) */
    set(el, name) {
      if (!el) return;
      const fresh = I.node(name);
      el.className = fresh.className;
      G.dom.clear(el);
      while (fresh.firstChild) el.appendChild(fresh.firstChild);
    },

    /* чистка строки от эмоджи (для текстов, попавших в textContent) */
    clean(str) {
      return String(str)
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '')
        .replace(/\s{2,}/g, ' ').trim();
    }
  };

  G.ui.icons = I;
})(window.G = window.G || {});
