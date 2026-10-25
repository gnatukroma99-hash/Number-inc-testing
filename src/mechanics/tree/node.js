/* mechanics/tree/node.js — карточка узла на карте-созвездии (v0.35.0).
   Один узел = орб с иконкой и ценой + скрытая подпись с именем и уровнем,
   плюс «неизвестная» карточка с замком (узел следующей глубины, пока не куплен предок).
   Классы (.node, .node-orb, .orb-ico, .orb-price, .orb-ring, .node-label, .node-name,
   .node-lvl, .node.unknown, .maxed, .done, .ready, .blocked, .bought) — контракт с style.css.

   Хуки приходят снаружи, карточка про правила дерева ничего не знает:
     visible(s, u) — узел уже открыт (иначе показывается замок);
     blocked(s, u) — какая ветвь отсохла (пакт-дерево) либо null;
     canBuy(s, u)  — цена и требования сходятся. */
(function (G) {
  'use strict';

  function card(u, hooks) {
    const orb = G.h('button', { class: 'node-orb', type: 'button', 'aria-label': u.name });
    const icoEl = G.h('span', { class: 'orb-ico' }, [G.ui.icons.node(u.icon || 'diamond')]);
    const priceEl = G.h('span', { class: 'orb-price' });
    const ring = G.h('span', { class: 'orb-ring', 'aria-hidden': 'true' });
    orb.appendChild(ring);
    orb.appendChild(icoEl);
    orb.appendChild(priceEl);

    const nameEl = G.h('div', { class: 'node-name', text: u.name });
    const lvlEl = G.h('div', { class: 'node-lvl' });
    const el = G.h('div', { class: 'node' }, [orb, G.h('div', { class: 'node-label' }, [nameEl, lvlEl])]);

    const unknown = G.h('div', { class: 'node unknown' }, [
      G.h('span', { class: 'node-orb', 'aria-hidden': 'true' }, [G.h('span', { class: 'orb-ico' }, [G.ui.icons.node('lock')])])
    ]);

    let flashTimer = null;
    function flash() {
      if (G.animationsOff && G.animationsOff()) return;
      el.classList.remove('bought');
      void el.offsetWidth;
      el.classList.add('bought');
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => el.classList.remove('bought'), 460);
    }

    function visible(s) {
      return hooks.visible(s, u) || G.lvl(s, u.id) > 0;
    }

    function update(s) {
      const on = visible(s);
      el.style.display = on ? '' : 'none';
      unknown.style.display = on ? 'none' : '';
      if (!on) return;

      const lvl = G.lvl(s, u.id);
      const maxed = lvl >= u.max;
      const blocker = hooks.blocked ? hooks.blocked(s, u) : null;
      lvlEl.textContent = maxed ? 'макс' : 'ур. ' + lvl + (isFinite(u.max) ? '/' + u.max : '');

      if (blocker) {
        /* развилка пакт-дерева: ветвь отсохла, узел не покупается */
        priceEl.textContent = '';
        lvlEl.textContent = 'закрыто';
        orb.disabled = true;
        el.className = 'node blocked' + (lvl > 0 ? ' done' : '');
        return;
      }

      if (maxed) {
        priceEl.textContent = '';
        orb.disabled = true;
        el.className = 'node maxed done';
        return;
      }
      const can = hooks.canBuy(s, u);
      priceEl.textContent = G.fmt.num(G.upgrades.currentCost(s, u));
      orb.disabled = !can;
      el.className = 'node' + (lvl > 0 ? ' done' : '') + (can ? ' ready' : '');
    }

    return { el: el, unknown: unknown, orb: orb, update: update, flash: flash, visible: visible, u: u };
  }

  G.treeNode = { card: card };
})(window.G = window.G || {});
