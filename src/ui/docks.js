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
      C().section('Одноразовые ×2 ⚡', x2Upg.map((u) => u.el)),
      C().section('Автоматизация (навсегда)', autoUpg.map((u) => u.el))
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
    if (d.id === 'primefit') return 'нужно 1 цифра (N ≥ 10)';
    if (d.id === 'primeranks') return 'нужно 2 цифры (N ≥ 100)';
    if (d.id === 'digitsum') return 'нужно 0.5 цифры (N ≥ 3)';
    if (d.id === 'shop') return 'нужно 2 цифры (N ≥ 100)';
    if (d.id === 'analysis') return 'нужно 3 цифры (N ≥ 1000)';
    if (d.id === 'prestige') return 'нужно 8 цифр';
    return 'заблокировано';
  }

  function build() {
    G.dom.clear(navEl);
    buttons = {};
    for (const d of docks()) {
      const badge = G.h('span', { class: 'dock-badge' });
      const btn = G.h('button', { class: 'dock', dataset: { id: d.id } }, [
        G.h('span', { class: 'dock-icon', text: d.icon || '•' }),
        G.h('span', { class: 'dock-text', text: d.short || d.name }),
        badge
      ]);
      btn.addEventListener('click', () => select(d.id));
      navEl.appendChild(btn);
      buttons[d.id] = { el: btn, badge: badge, def: d };
    }
  }

  function select(id) {
    const d = docks().find((x) => x.id === id);
    if (!d) return;
    if (!isAvailable(d)) {
      G.ui.toast('Доска закрыта: ' + describeLock(d), 'warn');
      return;
    }
    activeId = id;
    G.dom.clear(boardEl);

    let mount = null;
    if (id === 'core') mount = mountCore;
    else if (d.board && typeof d.board.mount === 'function') mount = d.board.mount;

    if (mount) {
      activeBoard = mount(boardEl);
    } else {
      activeBoard = null;
      boardEl.appendChild(G.h('div', { class: 'empty', text: 'У этой механики пока нет доски' }));
    }
    for (const k in buttons) buttons[k].el.classList.toggle('active', k === id);
    if (activeBoard && activeBoard.update) activeBoard.update(state);
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

      if (activeBoard && activeBoard.update) activeBoard.update(s);
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
