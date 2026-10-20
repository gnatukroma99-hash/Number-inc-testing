/* core/dom.js — минимальный помощник для построения DOM без фреймворка. */
(function (G) {
  'use strict';

  /**
   * h('div', {class:'x', text:'hi', onclick:fn, dataset:{id:1}}, [child, 'строка'])
   */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') { for (const d in v) el.dataset[d] = v[d]; }
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined || c === false) continue;
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      }
    }
    return el;
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  /* «дыхание» числа при тике (отключается настройкой) */
  function pulse(el) {
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  G.h = h;
  G.$ = $;
  G.$$ = $$;
  G.dom = { clear: clear, pulse: pulse };
})(window.G = window.G || {});
