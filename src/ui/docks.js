/* ui/docks.js — список «доков» (досок) слева и хост активной доски. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};
  const C = () => G.ui.components;

  let state = null;
  let navEl = null;
  let boardEl = null;
  let activeId = null;
  let activeBoard = null;
  let activeToolbar = null;
  let stateMech = null;      // id механики активной доски (для «купить всё» и прогресса)
  let lastSort = '';
  let buttons = {};       // id -> {el, badgeEl}
  let unlockedSnapshot = '';

  /* ---------- встроенная доска «Рост» ---------- */
  function mountCore(root) {
    const tDt = C().tile('Интервал ΔT');
    const tM = C().tile('Множитель за тик', 'good');
    const tRate = C().tile('Скорость роста', 'accent');
    const tBest = C().tile('Рекорд цифр');

    const all = G.registry.upgradesOf('core');
    const baseUpg = all.filter((u) => !u.autoMech && !u.energyMult).map((u) => C().upgradeRow(state, u));
    const x2Upg = all.filter((u) => u.energyMult && !u.autoMech).map((u) => C().upgradeRow(state, u));
    const autoUpg = all.filter((u) => u.autoMech).map((u) => C().upgradeRow(state, u));

    const el = G.h('div', { class: 'board-body' }, [
      G.h('p', { class: 'board-hint', text: 'Базовый рост числа. Всё остальное — надстройки над ним.' }),
      C().grid([tDt.el, tM.el, tRate.el, tBest.el]),
      G.h('div', { class: 'formula-card' }, [
        G.h('div', { class: 'block-label', text: 'Как это работает' }),
        G.h('code', { text: 'раз в ΔT:  N = N × M_total' }),
        G.h('code', { text: 'ΔT = 60 / (1 + speedBonus) · dtMult' }),
        G.h('code', { text: 'E = 0.4 · (1 + log10 N)² · 1.25^lvl' })
      ]),
      C().section('Рост', baseUpg.map((u) => u.el)),
      C().section('Одноразовые ×2 ⌁', x2Upg.map((u) => u.el)),
      C().section('Автоматизация (навсегда, покупается вручную)', autoUpg.map((u) => u.el))
    ]);
    root.appendChild(el);

    const upg = baseUpg.concat(x2Upg, autoUpg);

    return {
      update(s) {
        const dT = G.growth.dt(s);
        tDt.set(dT.toFixed(3) + ' с');
        tM.set('×' + G.fmt.num(G.growth.M(s), s.settings.numberFormat));
        tRate.set(G.fmt.num(G.growth.rate(s), s.settings.numberFormat) + ' цифр/с');
        tBest.set(G.fmt.digitsLabel(s.stats.bestD || 0));
        upg.forEach((u) => u.update(s));
      }
    };
  }

  /* ---------- сборка навигации ---------- */
  function docks() {
    const list = [{ id: 'core', name: 'Рост', short: 'Рост', icon: '×', always: true }];
    for (const m of G.registry.mechanics()) list.push(m);
    return list;
  }

  function isAvailable(d) {
    if (d.always) return true;
    return d.isUnlocked ? d.isUnlocked(state) : true;
  }

  function describeLock(d) {
    if (d.lockHint) return d.lockHint;
    if (d.id === 'primefit') return 'нужно 1 цифра (N ≥ 10)';
    if (d.id === 'primeranks') return 'нужно 2 цифры (N ≥ 100)';
    if (d.id === 'digitsum') return 'нужно 0.5 цифры (N ≥ 3)';
    if (d.id === 'shop') return 'нужно 2 цифры (N ≥ 100)';
    if (d.id === 'analysis') return 'нужно 3 цифры (N ≥ 1000)';
    if (d.id === 'prestige') return 'нужно 8 цифр';
    return 'заблокировано';
  }

  /* какие механики в какой группе (данные — content/groups.js) */
  function groups() {
    const all = docks();
    const byId = {};
    for (const d of all) byId[d.id] = d;
    const out = [];
    const used = {};
    for (const g of (G.content.groups || [])) {
      const list = (g.mechs || []).map((id) => byId[id]).filter(Boolean);
      list.forEach((d) => { used[d.id] = true; });
      if (list.length) out.push({ g: g, list: list });
    }
    const rest = all.filter((d) => !used[d.id]);
    if (rest.length) out.push({ g: { id: 'other', name: 'Прочее', color: '#7d94a6' }, list: rest });
    return out;
  }

  function mkDock(d) {
    const badge = G.h('span', { class: 'dock-badge' });
    const btn = G.h('button', { class: 'dock', dataset: { id: d.id }, title: d.name || '' }, [
      G.h('span', { class: 'dock-bar' }),
      G.h('span', { class: 'dock-icon' }, [G.ui.icons.node(d.icon || 'diamond')]),
      G.h('span', { class: 'dock-text', text: d.short || d.name }),
      badge
    ]);
    btn.style.setProperty('--mech', C().mechColor(d.id));
    btn.addEventListener('click', () => select(d.id));
    buttons[d.id] = { el: btn, badge: badge, def: d };
    return btn;
  }

  function build() {
    G.dom.clear(navEl);
    buttons = {};

    /* шапка меню: название + версия */
    navEl.appendChild(G.h('div', { class: 'docks-head' }, [
      G.h('div', { class: 'docks-logo', text: 'ЧИСЛО' }),
      G.h('div', { class: 'docks-ver', text: 'v' + (G.VERSION || '?') })
    ]));

    /* группы вместо одного длинного списка: забег → мета → ярус 2 */
    navEl.appendChild(G.h('div', { class: 'dock-groups' }, groups().map((block) => {
      const head = G.h('div', { class: 'dock-group-head' }, [
        G.h('span', { class: 'dock-group-dot' }),
        G.h('span', { class: 'dock-group-name', text: block.g.name }),
        G.h('span', { class: 'dock-group-hint', text: block.g.hint || '' })
      ]);
      head.style.setProperty('--grp', block.g.color || '#7d94a6');
      return G.h('div', { class: 'dock-group', dataset: { group: block.g.id } }, [
        head,
        G.h('div', { class: 'dock-group-items' }, block.list.map(mkDock))
      ]);
    })));

    for (const k in buttons) buttons[k].el.classList.toggle('active', k === activeId);
  }

  function select(id) {
    const d = docks().find((x) => x.id === id);
    if (!d) return;
    if (!isAvailable(d)) {
      G.ui.toast('Доска закрыта: ' + describeLock(d), 'warn');
      return;
    }
    activeId = id;
    stateMech = id;
    if (activeBoard && activeBoard.destroy) activeBoard.destroy();
    activeBoard = null;
    G.dom.clear(boardEl);

    /* полноэкранные доски (карта дерева): прячем число и меню */
    document.body.classList.toggle('board-full', !!d.fullscreen);

    let mount = null;
    if (id === 'core') mount = mountCore;
    else if (d.board && typeof d.board.mount === 'function') mount = d.board.mount;

    /* панель покупок (доски с ценами в цифрах её не показывают) */
    activeToolbar = null;
    if (!d.noBulk) {
      activeToolbar = C().boardToolbar(state, {
        onBuyAll() {
          const s = G.state;
          if (!s || !stateMech) return;
          const n = G.upgrades.buyAllAvailable(s, stateMech);
          G.ui.toast(n ? 'Куплено всё доступное' : 'Покупать нечего', n ? 'good' : 'warn', 1400);
          orderRows();
        },
        onOrderChange() { orderRows(); }
      });
      boardEl.appendChild(activeToolbar.el);
    }
    const content = G.h('div', { class: 'board-content' + (G.animationsOff && G.animationsOff() ? '' : ' anim-in') });
    boardEl.appendChild(content);

    if (mount) {
      activeBoard = mount(content);
    } else {
      activeBoard = null;
      content.appendChild(G.h('div', { class: 'empty', text: 'У этой механики пока нет доски' }));
    }
    for (const k in buttons) buttons[k].el.classList.toggle('active', k === id);
    if (activeToolbar) activeToolbar.update(state);
    if (activeBoard && activeBoard.update) activeBoard.update(state);
  }

  /* ---------- сортировка и фильтр строк апгрейдов (без пересборки DOM) ---------- */
  const COMPARE = {
    price(a, b) { return (a.price || 0) - (b.price || 0); },
    level(a, b) { return (a.lvl || 0) - (b.lvl || 0); },
    name(a, b) { return String(a.name).localeCompare(String(b.name)); }
  };

  function orderRows(s) {
    const st = s || state;
    if (!st || !G.state) return;
    const mode = st.settings.buySort || 'price';
    const onlyAvail = !!st.settings.buyFilter;
    lastSort = mode;

    for (const sec of boardEl.querySelectorAll('.section')) {
      const rows = Array.prototype.slice.call(sec.querySelectorAll(':scope > .upg'));
      if (rows.length < 2 && !onlyAvail) continue;

      const meta = rows.map((row) => {
        const u = G.registry.upgrade(row.dataset.upgrade);
        return {
          row: row,
          price: u ? (u.costD ? G.upgrades.digitsCost(st, u) : G.upgrades.currentCost(st, u)) : 0,
          lvl: u ? G.lvl(st, u.id) : 0,
          name: u ? u.name : ''
        };
      });

      if (onlyAvail) {
        for (const m of meta) {
          const u = G.registry.upgrade(m.row.dataset.upgrade);
          const can = u ? G.upgrades.plan(st, u, '1').count > 0 : true;
          m.row.classList.toggle('upg-off', !can);
        }
      } else {
        for (const m of meta) m.row.classList.remove('upg-off');
      }

      meta.sort(COMPARE[mode] || COMPARE.price);
      for (const m of meta) sec.appendChild(m.row);
    }
  }

  /* ---------- публичный API ---------- */
  const D = {
    init(s) {
      state = s;
      navEl = document.getElementById('docks');
      boardEl = document.getElementById('board');
      build();
      G.bus.on('state:reset', () => { activeBoard = null; select('core'); });
      select('core');
      /* горячие клавиши 1..9 */
      window.addEventListener('keydown', (e) => {
        const i = '123456789'.indexOf(e.key);
        if (i < 0) return;
        if (document.body.classList.contains('modal-open')) return;
        const list = docks().filter(isAvailable);
        if (list[i]) select(list[i].id);
      });
    },

    update(s) {
      state = s;
      /* пересобрать навигацию, если набор открытых досок изменился */
      const snap = docks().map((d) => d.id + (isAvailable(d) ? '1' : '0')).join('|');
      if (snap !== unlockedSnapshot) {
        unlockedSnapshot = snap;
        build();
        for (const k in buttons) buttons[k].el.classList.toggle('active', k === activeId);
      }

      /* бейджи и состояния */
      for (const d of docks()) {
        const b = buttons[d.id];
        if (!b) continue;
        const avail = isAvailable(d);
        b.el.classList.toggle('locked', !avail);
        b.el.title = avail ? (d.name || '') : 'Закрыто: ' + describeLock(d);
        if (d.status) b.badge.textContent = avail ? d.status(state) : '';
        else b.badge.textContent = '';
      }

      if (activeToolbar) activeToolbar.update(s, stateMech);
      if (activeBoard && activeBoard.update) activeBoard.update(s);
      if ((s.settings.buySort || 'price') !== lastSort || s.settings.buyFilter) orderRows(s);
    },

    select,

    /* сбросить кэш навигации (например, после импорта сейва) */
    refresh(s) {
      if (s) state = s;
      if (!navEl) return;      // ещё не инициализировано
      unlockedSnapshot = '';
      activeBoard = null;
      select('core');
    }
  };

  G.ui.docks = D;
})(window.G = window.G || {});
