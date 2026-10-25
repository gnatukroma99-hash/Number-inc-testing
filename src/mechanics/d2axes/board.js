/* mechanics/d2axes/board.js — доска «Оси Ξ» (Измерение 2).
   Вся математика — systems/d2-growth.js; здесь только текст и классы.
   DOM строится один раз, update() меняет только содержимое уже созданных узлов. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('d2axes');
  const C = () => G.ui.components;
  const cfg = () => G.content.d2 || { axes: [], boost: {} };

  /* режимы массовой покупки оси — контракт G.d2Growth.buyAxis: '1' | '10' | 'max'.
     Настройка общая (settings.buyMode), но ×100 у D2 нет: он считается за ×10. */
  const MODES = [
    { v: '1', label: '×1' },
    { v: '10', label: '×10' },
    { v: 'max', label: 'MAX' }
  ];

  function modeOf(state) {
    const m = (state && state.settings && state.settings.buyMode) || '1';
    if (m === 'max' || m === '10') return m;
    return m === '100' ? '10' : '1';
  }

  function modeTitle(mode) {
    return mode === 'max' ? 'MAX' : '×' + mode;
  }

  /* любое нечисловое значение показываем нулём: Infinity/NaN в тексте доски запрещены */
  function num(state, x) {
    const n = (typeof x === 'number' && isFinite(x)) ? x : 0;
    return G.fmt.num(n, (state && state.settings && state.settings.numberFormat) || 'short');
  }

  function lvlText(lvl, max) {
    return isFinite(max) ? 'ур. ' + lvl + ' / ' + max : 'ур. ' + lvl;
  }

  /* карточка одной оси: имя, уровень, amount, rate, цена, кнопка покупки.
     Клик навешивает mount (ему нужен paint) — так обработчик видит свежий режим покупки. */
  function axisCard(a, i) {
    const shortEl = G.h('span', { class: 'd2-axis-short', text: a.short || '' });
    const nameEl = G.h('span', { class: 'd2-axis-name', text: a.name || a.id });
    const lvlEl = G.h('span', { class: 'd2-axis-lvl' });
    const amountEl = G.h('span', { class: 'd2-axis-amount' });
    const rateEl = G.h('span', { class: 'd2-axis-rate' });
    const btn = G.h('button', { class: 'upg-buy d2-axis-buy', type: 'button' });

    const el = G.h('div', { class: 'd2-axis-card', dataset: { axis: a.id || String(i) } }, [
      G.h('div', { class: 'd2-axis-head' }, [shortEl, nameEl, lvlEl]),
      G.h('div', { class: 'd2-axis-stats' }, [amountEl, rateEl]),
      btn
    ]);
    return { a: a, i: i, el: el, lvlEl: lvlEl, amountEl: amountEl, rateEl: rateEl, btn: btn };
  }

  /* карточка Boost: цена в Ξ, уровень, максимум из данных */
  function boostCard() {
    const lvlEl = G.h('span', { class: 'd2-boost-lvl' });
    const btn = G.h('button', { class: 'upg-buy d2-boost-buy', type: 'button', text: 'Boost' });
    const el = G.h('div', { class: 'd2-boost-card' }, [
      G.h('div', { class: 'd2-boost-head' }, [
        G.h('span', { class: 'd2-boost-name', text: 'Boost' }),
        lvlEl
      ]),
      G.h('div', { class: 'd2-boost-note', text: 'Поднимает производство всех осей и Ξ' }),
      btn
    ]);
    return { el: el, lvlEl: lvlEl, btn: btn };
  }

  mech.board = {
    mount(root) {
      const tXi = C().tile('Ξ · оси', 'accent');
      const tXiRate = C().tile('Ξ/с', 'good');
      const tD = C().tile('D₂ · цифры', 'accent');
      const tM = C().tile('M₂ · объём', '');
      const soft = C().bar('софткап D₂');

      const cards = (cfg().axes || []).map((a, i) => axisCard(a, i));
      const boost = boostCard();

      const modeBtns = MODES.map((m) => {
        const b = G.h('button', { class: 'buy-mode', type: 'button', dataset: { mode: m.v }, text: m.label });
        b.addEventListener('click', () => {
          const s = G.state;
          if (!s) return;
          s.settings.buyMode = m.v;
          paint(s);
        });
        return { v: m.v, el: b };
      });

      const el = G.h('div', { class: 'board-body d2-axes-board' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C().grid([tXi.el, tXiRate.el, tD.el, tM.el]),
        G.h('div', { class: 'd2-softcap' }, [
          G.h('div', { class: 'block-label', text: 'Софткап объёма D₂' }),
          soft.el
        ]),
        boost.el,
        C().section('Оси Ξ (8 измерений)', [
          G.h('div', { class: 'buy-modes d2-axis-modes' }, [G.h('span', { class: 'toolbar-hint', text: 'Покупка' })].concat(modeBtns.map((b) => b.el))),
          G.h('div', { class: 'tile-grid d2-axis-grid' }, cards.map((c) => c.el))
        ]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: 'rate_i = baseRate · (1 + 0.25·ур.) · (1 + 0.05·amount_{i+1}) · 2^boost · (1 + 0.02·Σур.)' }),
          G.h('code', { text: 'Ξ/с = rate₀ · (1 + 0.02·Σур.) · множители связей' }),
          G.h('code', { text: 'M₂ = Π (1 + amount_i) ** 0.2 · софткап = 1 / (1 + ((D₂ − 50) / 25) ** 1.5)' })
        ])
      ]);
      root.appendChild(el);

      for (const c of cards) {
        c.btn.addEventListener('click', () => {
          const s = G.state;
          if (!s) return;
          const bought = G.d2Growth.buyAxis(s, c.i, modeOf(s));
          if (bought > 0) {
            G.ui.toast('Ось ' + (c.a.name || c.a.id) + ': +' + bought + ' ур.', 'good', 1400);
          }
          paint(s);
        });
      }
      boost.btn.addEventListener('click', () => {
        const s = G.state;
        if (!s) return;
        if (G.d2Growth.buyBoost(s)) G.ui.toast('Boost: +1 ур.', 'ach', 1600);
        paint(s);
      });

      function paint(state) {
        if (!state || !state.d2) return;
        const G2 = G.d2Growth;
        const res = state.d2.res || {};
        const axisBal = (typeof res.axis === 'number' && isFinite(res.axis)) ? res.axis : 0;
        const d = G.d2.D(state);
        const dNum = (typeof d === 'number' && isFinite(d)) ? d : 0;
        const mode = modeOf(state);

        tXi.set(num(state, axisBal));
        tXiRate.set('+' + num(state, G2.xiRate(state)) + '/с');
        tD.set(num(state, dNum));
        tM.set(num(state, G2.M2(state)));

        /* полоса софткапа: 1 = роста нет (D₂ ниже порога), 0 = рост режется почти в ноль */
        const bRaw = G2.barrier(state, dNum);
        const b = (typeof bRaw === 'number' && isFinite(bRaw)) ? bRaw : 0;
        const clamped = Math.max(0, Math.min(1, b));
        soft.set(1 - clamped, 'множитель роста ×' + num(state, clamped) + ' · D₂ ' + num(state, dNum));
        soft.el.classList.toggle('capped', clamped < 0.99);

        for (const mb of modeBtns) mb.el.classList.toggle('active', mb.v === mode);

        const axesState = state.d2.axes || [];
        for (const c of cards) {
          const st = axesState[c.i] || {};
          const lvl = (typeof st.lvl === 'number' && isFinite(st.lvl)) ? Math.floor(st.lvl) : 0;
          const max = (typeof c.a.max === 'number' && isFinite(c.a.max)) ? c.a.max : Infinity;
          const maxed = lvl >= max;
          const cost = G2.axisCost(state, c.i, lvl);
          const costNum = (typeof cost === 'number' && isFinite(cost)) ? cost : 0;
          const can = !maxed && axisBal >= costNum;

          c.lvlEl.textContent = lvlText(lvl, max);
          c.amountEl.textContent = num(state, st.amount);
          c.rateEl.textContent = '+' + num(state, G2.axisRate(state, c.i)) + '/с';
          /* цена — следующего уровня; режим массовой покупки подписан на кнопке */
          c.btn.textContent = maxed
            ? 'максимум'
            : 'Ξ ' + num(state, costNum) + (mode === '1' ? '' : ' · ' + modeTitle(mode));
          c.btn.disabled = maxed;
          c.btn.className = 'upg-buy d2-axis-buy ' + (maxed ? 'maxed' : (can ? 'can' : 'cant'));
          c.el.classList.toggle('maxed', maxed);
        }

        const boostMax = (cfg().boost && typeof cfg().boost.max === 'number') ? cfg().boost.max : Infinity;
        const blvl = (typeof state.d2.boost === 'number' && isFinite(state.d2.boost)) ? Math.floor(state.d2.boost) : 0;
        const bMaxed = blvl >= boostMax;
        const bCost = G2.boostCost(state);
        const bCostNum = (typeof bCost === 'number' && isFinite(bCost)) ? bCost : 0;
        boost.lvlEl.textContent = lvlText(blvl, boostMax);
        boost.btn.textContent = bMaxed ? 'максимум' : 'Ξ ' + num(state, bCostNum);
        boost.btn.disabled = bMaxed;
        boost.btn.className = 'upg-buy d2-boost-buy ' +
          (bMaxed ? 'maxed' : (axisBal >= bCostNum ? 'can' : 'cant'));
      }

      return { update: paint };
    }
  };
})(window.G = window.G || {});
