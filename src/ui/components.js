/* ui/components.js — переиспользуемые куски интерфейса.
   Правило: DOM строится один раз, update() только меняет текст/классы (без перерисовки innerHTML). */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  const RES_ICON = { energy: '⌁', prime: '❖', cores: '◆', delta: 'Δ', psi: 'Ψ', omega: 'Ω', crystal: '◈', number: 'D' };
  const RES_NAME = { energy: 'энергии', prime: 'ПРАЙМ', cores: 'Ядер', delta: 'Осколков' };

  /* иконки-медальоны на карточках апгрейдов (можно переопределить полем u.icon) */
  /* акцентный цвет механики — для рамок карточек и иконок (данные-оформление) */
  const MECH_COLOR = {
    /* Ярус 1 «Арифметика» — холодная гамма (голубой → бирюза → мятный) */
    core: '#35e2c0',
    digitsum: '#3fa9ff',
    primefit: '#6f8dff',
    primeranks: '#9d7bff',
    analysis: '#22d3ee',
    shop: '#4ade80',
    sieve: '#7cf7b0',
    mirror: '#2dd4bf',
    combo: '#38bdf8',
    slot: '#f0b429',
    spark: '#ffd166',
    patterns: '#a3e635',
    /* Мета «Ядра» — золото и янтарь */
    prestige: '#ffb14d',
    tree: '#ffcc4d',
    achievements: '#ffd97a',
    /* Ярус 2 «Экспонента» — фиолет и маджента */
    bigbang: '#c084fc',
    constellations: '#a78bfa',
    glyphs: '#d8b4fe',
    pacttree: '#8b5cf6',
    challenges: '#e879f9',
    pacts: '#f472b6',
    duplicator: '#c4b5fd',
    echo: '#a5b4fc',
    chrono: '#818cf8',
    rift: '#f0abfc',
    /* Ярус 3 «Логарифм/ПРОБОЙ» — розовый неон */
    cracks: '#ff8f5e',
    measure: '#38bdf8',
    turn: '#a3e635',
    turntree: '#7cf7b0',
    breakthrough: '#ff5fd2',
    psitree: '#ff8fa8',
    omega: '#ff9de2'
  };

  /* какой ярус у доски — для общей цветовой темы */
  const MECH_TIER = {
    core: '1', digitsum: '1', primefit: '1', primeranks: '1', analysis: '1', shop: '1',
    sieve: '1', mirror: '1', combo: '1', slot: '1', spark: '1', patterns: '1',
    prestige: 'meta', tree: 'meta', achievements: 'meta',
    bigbang: '2', constellations: '2', glyphs: '2', pacttree: '2', challenges: '2',
    pacts: '2', duplicator: '2', echo: '2', chrono: '2', rift: '2',
    breakthrough: '3', cracks: '3', measure: '3', psitree: '3', omega: '3',
    turn: '4', turntree: '4'
  };

  const MECH_ICON = {
    core: '×', digitsum: 'Σ', primefit: '⧉', primeranks: '❖', analysis: 'Δ',
    shop: 'cart', sieve: '⌗', mirror: '⧗', tree: '◆', slot: 'slot'
  };

  function fmtEffect(u, val) {
    const mode = (G.state && G.state.settings.numberFormat) || 'short';
    switch (u.fmt) {
      case 'pct': return G.fmt.pct(val);
      case 'num': return G.fmt.num(val, mode);
      case 'x':
      default: return '×' + G.fmt.num(val, mode);
    }
  }

  /* режим покупки из настроек ('1' | '10' | '100' | 'max') */
  function buyMode(state) {
    const m = (state && state.settings && state.settings.buyMode) || '1';
    return (m === '10' || m === '100' || m === 'max') ? m : '1';
  }

  const C = {
    RES_ICON: RES_ICON,
    MECH_ICON: MECH_ICON,
    MECH_COLOR: MECH_COLOR,

    /* форматирование значения эффекта — общее для всех досок */
    fmtEffect: fmtEffect,

    resIcon(res) { return RES_ICON[res] || '•'; },
    resName(res) { return RES_NAME[res] || res; },
    mechIcon(mech) { return MECH_ICON[mech] || '•'; },
    mechColor(mech) { return MECH_COLOR[mech] || 'var(--accent)'; },
    MECH_TIER: MECH_TIER,
    mechTier(mech) { return MECH_TIER[mech] || '1'; },
    buyMode: buyMode,

    /**
     * Панель над доской (как в инкременталках):
     * режим покупки ×1/×10/×100/MAX, «купить всё», фильтр доступных,
     * сортировка и прогресс до следующей покупки.
     * hooks: { onBuyAll(), onOrderChange() }
     */
    boardToolbar(state, hooks) {
      hooks = hooks || {};
      const modes = [
        { v: '1', label: '×1' },
        { v: '10', label: '×10' },
        { v: '100', label: '×100' },
        { v: 'max', label: 'MAX' }
      ];
      const btns = modes.map((m) => {
        const b = G.h('button', { class: 'buy-mode', type: 'button', dataset: { mode: m.v }, text: m.label });
        b.addEventListener('click', () => {
          const s = G.state;
          if (!s) return;
          s.settings.buyMode = m.v;
          G.ui.toast('Покупка: ' + (m.v === 'max' ? 'MAX' : '×' + m.v), 'accent', 1200);
          toolbarUpdate(s, toolbarMech);
        });
        return { v: m.v, el: b };
      });

      const buyAll = G.h('button', { class: 'toolbar-btn buy-all', type: 'button' }, [G.ui.icons.node('cart'), G.h('span', { text: 'Купить всё' })]);
      buyAll.addEventListener('click', () => {
        if (hooks.onBuyAll) hooks.onBuyAll();
      });

      const filterBox = G.h('input', { type: 'checkbox', checked: (state && state.settings.buyFilter) ? 'checked' : null });
      filterBox.addEventListener('change', () => {
        const s = G.state;
        if (!s) return;
        s.settings.buyFilter = !!filterBox.checked;
        if (hooks.onOrderChange) hooks.onOrderChange();
      });
      const filterLabel = G.h('label', { class: 'toolbar-check' }, [filterBox, G.h('span', { text: 'только доступные' })]);

      const sortSel = G.h('select', { class: 'toolbar-select' });
      [
        { v: 'price', t: 'по цене' },
        { v: 'level', t: 'по уровню' },
        { v: 'name', t: 'по названию' }
      ].forEach((o) => {
        sortSel.appendChild(G.h('option', { value: o.v, selected: (state && state.settings.buySort) === o.v ? 'selected' : null, text: o.t }));
      });
      sortSel.addEventListener('change', () => {
        const s = G.state;
        if (!s) return;
        s.settings.buySort = sortSel.value;
        if (hooks.onOrderChange) hooks.onOrderChange();
      });

      const fill = G.h('i', { class: 'tp-fill' });
      const lab = G.h('span', { class: 'tp-label' });
      const progress = G.h('div', { class: 'toolbar-progress' }, [G.h('div', { class: 'tp-bar' }, [fill]), lab]);

      const el = G.h('div', { class: 'board-toolbar' }, [
        G.h('span', { class: 'toolbar-hint', text: 'Покупка' }),
        G.h('div', { class: 'buy-modes' }, btns.map((b) => b.el)),
        buyAll,
        filterLabel,
        G.h('label', { class: 'toolbar-sort' }, [G.h('span', { text: 'сортировка' }), sortSel]),
        progress
      ]);

      let toolbarMech = null;

      function toolbarUpdate(s, mechId) {
        if (mechId !== undefined) toolbarMech = mechId;
        if (!s) return;
        const cur = buyMode(s);
        for (const b of btns) b.el.classList.toggle('active', b.v === cur);
        filterBox.checked = !!s.settings.buyFilter;
        sortSel.value = s.settings.buySort || 'price';

        const target = toolbarMech ? G.upgrades.nextTarget(s, toolbarMech) : null;
        if (!target) {
          fill.style.width = '100%';
          lab.textContent = toolbarMech ? 'всё куплено' : '';
          progress.style.opacity = toolbarMech ? '1' : '0';
          return;
        }
        progress.style.opacity = '1';
        const u = target.u;
        const have = u.costD ? G.growth.D(s) : (s.res[u.res] || 0);
        const need = u.costD ? (G.upgrades.digitsCost(s, u) + (u.minD !== undefined ? u.minD : 2)) : target.price;
        const frac = need > 0 ? Math.max(0, Math.min(1, have / need)) : 1;
        fill.style.width = (frac * 100).toFixed(1) + '%';
        lab.textContent = u.name + ' · ' + Math.round(frac * 100) + '%';
        progress.classList.toggle('ready', frac >= 1);
      }

      return { el: el, update: toolbarUpdate };
    },

    /**
     * Карточка апгрейда: иконка-медальон, название, уровень, «сейчас → станет», цена.
     * Возвращает { el, update(state) }.
     */
    upgradeRow(state, u) {
      const lvlEl = G.h('span', { class: 'upg-lvl' });
      const effEl = G.h('div', { class: 'upg-eff' });
      const noteEl = G.h('div', { class: 'upg-note', text: u.note || '' });
      const costEl = G.h('span', { class: 'upg-cost' });
      const qtyEl = G.h('span', { class: 'upg-qty' });
      const btn = G.h('button', { class: 'upg-buy', type: 'button' }, [costEl, qtyEl]);
      const icoEl = G.h('div', { class: 'upg-ico' }, [G.ui.icons.node(u.icon || C.mechIcon(u.mech))]);

      const lvlFill = G.h('i');
      const lvlBar = G.h('div', { class: 'upg-lvlbar' }, [lvlFill]);

      const el = G.h('div', { class: 'upg', dataset: { upgrade: u.id, mech: u.mech || '' } }, [
        icoEl,
        G.h('div', { class: 'upg-main' }, [
          G.h('div', { class: 'upg-head' }, [
            G.h('span', { class: 'upg-name', text: u.name }),
            lvlEl
          ]),
          lvlBar,
          effEl,
          noteEl
        ]),
        btn
      ]);
      el.style.setProperty('--mech', C.mechColor(u.mech));

      /* покупка: клик + зажатие (зажатие уважает выбранный режим) */
      let holdTimer = null;
      const stopHold = () => {
        if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
      };
      const buyNow = () => {
        const s = G.state;
        if (!s) return 0;
        return G.upgrades.buyBulk(s, u, buyMode(s));
      };
      let flashTimer = null;
      const flash = (bought) => {
        if (!bought || G.animationsOff()) return;
        el.classList.remove('bought');
        void el.offsetWidth;
        el.classList.add('bought');
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => el.classList.remove('bought'), 420);
      };

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        flash(buyNow());
        stopHold();
        holdTimer = setInterval(() => flash(buyNow()), 120);
      });
      btn.addEventListener('pointerup', stopHold);
      btn.addEventListener('pointerleave', stopHold);
      btn.addEventListener('pointercancel', stopHold);

      function update(s) {
        const lvl = G.lvl(s, u.id);
        const maxed = lvl >= u.max;
        const cur = G.upgrades.value(s, u);
        const next = maxed ? null : (function () {
          const before = s.upg[u.id];
          s.upg[u.id] = lvl + 1;
          const v = G.upgrades.value(s, u);
          s.upg[u.id] = before;
          return v;
        })();

        lvlEl.textContent = 'ур. ' + lvl + (isFinite(u.max) ? ' / ' + u.max : '');
        /* полоса уровней — как в RCGI/PT: видно, сколько осталось до максимума */
        if (isFinite(u.max) && u.max > 1) {
          lvlBar.style.display = '';
          lvlFill.style.width = (Math.min(1, lvl / u.max) * 100).toFixed(1) + '%';
          lvlBar.classList.toggle('full', maxed);
        } else {
          lvlBar.style.display = 'none';
        }
        effEl.textContent = maxed
          ? fmtEffect(u, cur)
          : fmtEffect(u, cur) + ' → ' + fmtEffect(u, next);

        if (maxed) {
          costEl.textContent = 'макс';
          qtyEl.textContent = '';
          btn.disabled = true;
          btn.className = 'upg-buy maxed';
          return;
        }

        const plan = G.upgrades.plan(s, u, buyMode(s));

        if (u.costD) {
          /* цена в цифрах: платим частью самого числа */
          const price = G.upgrades.digitsCost(s, u);
          const can = plan.count > 0;
          const need = price + (u.minD !== undefined ? u.minD : 2);
          costEl.textContent = (!can && G.growth.D(s) < need)
            ? 'D ≥ ' + need.toFixed(1)
            : '−' + price.toFixed(2) + ' цифр';
          qtyEl.textContent = '';
          btn.disabled = !can;
          btn.className = 'upg-buy' + (can ? ' can shop' : ' cant');
          return;
        }

        const can = plan.count > 0;
        costEl.textContent = can
          ? G.fmt.num(plan.cost, s.settings.numberFormat) + ' ' + C.resIcon(u.res)
          : G.fmt.num(G.upgrades.currentCost(s, u), s.settings.numberFormat) + ' ' + C.resIcon(u.res);
        qtyEl.textContent = plan.count > 1 ? '×' + plan.count : '';
        btn.disabled = !can;
        btn.className = 'upg-buy' + (can ? ' can' : ' cant');
      }

      return { el: el, update: update };
    },

    /* плитка «подпись / значение» */
    tile(label, cls) {
      const val = G.h('div', { class: 'tile-val' });
      const el = G.h('div', { class: 'tile ' + (cls || '') }, [
        val,
        G.h('div', { class: 'tile-label', text: label })
      ]);
      let last = null;
      let bumpTimer = null;
      return {
        el: el,
        set(v) {
          const str = String(v);
          if (str === last) return;
          last = str;
          val.textContent = str;
          /* анимация «число изменилось» (как в инкременталках) */
          if (!G.animationsOff()) {
            val.classList.remove('bump');
            void val.offsetWidth;
            val.classList.add('bump');
            if (bumpTimer) clearTimeout(bumpTimer);
            bumpTimer = setTimeout(() => val.classList.remove('bump'), 320);
          }
        },
        setClass(c) { el.className = 'tile ' + c; }
      };
    },

    /* полоска прогресса */
    bar(label) {
      const fill = G.h('div', { class: 'bar-fill' });
      const lab = G.h('span', { class: 'bar-label', text: label || '' });
      const el = G.h('div', { class: 'bar-wrap' }, [
        G.h('div', { class: 'bar' }, [fill]),
        lab
      ]);
      return {
        el: el,
        set(frac, text) {
          fill.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
          if (text !== undefined) lab.textContent = text;
        }
      };
    },

    /* ряд цифр мантиссы с подсветкой простых */
    digitRow(count) {
      const chips = [];
      const el = G.h('div', { class: 'digit-row' });
      for (let i = 0; i < count; i++) {
        const c = G.h('span', { class: 'digit' });
        chips.push(c);
        el.appendChild(c);
      }
      return {
        el: el,
        set(digits) {
          for (let i = 0; i < chips.length; i++) {
            const d = digits[i];
            const c = chips[i];
            if (d === undefined) {
              c.textContent = '';
              c.className = 'digit empty';
              continue;
            }
            c.textContent = String(d);
            c.className = 'digit' + (G.digits.PRIME_DIGITS[d] ? ' prime' : '') + (i === 0 ? ' first' : '');
          }
        }
      };
    },

    /* сетка плиток */
    grid(tiles) {
      return G.h('div', { class: 'tile-grid' }, tiles);
    },

    /* секция с полосатым заголовком (как «Common/Uncommon» в PT/RCGI) */
    section(title, children) {
      const kids = ([]).concat(children);
      const count = kids.filter((k) => k && k.classList && k.classList.contains('upg')).length;
      const head = title
        ? G.h('h3', { class: 'section-title' }, [
            G.h('span', { class: 'section-name', text: title }),
            count ? G.h('span', { class: 'section-count', text: String(count) }) : null
          ])
        : null;
      return G.h('div', { class: 'section' }, [head, ...kids]);
    }
  };

  G.ui.components = C;
})(window.G = window.G || {});
