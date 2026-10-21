/* ui/components.js — переиспользуемые куски интерфейса.
   Правило: DOM строится один раз, update() только меняет текст/классы (без перерисовки innerHTML). */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  const RES_ICON = { energy: '⚡', prime: '❖', cores: '◆', delta: 'Δ', psi: 'Ψ', omega: 'Ω', crystal: '◈', number: 'D' };
  const RES_NAME = { energy: 'энергии', prime: 'ПРАЙМ', cores: 'Ядер', delta: 'Осколков' };

  function fmtEffect(u, val) {
    const mode = (G.state && G.state.settings.numberFormat) || 'short';
    switch (u.fmt) {
      case 'pct': return G.fmt.pct(val);
      case 'num': return G.fmt.num(val, mode);
      case 'x':
      default: return '×' + G.fmt.num(val, mode);
    }
  }

  const C = {
    RES_ICON: RES_ICON,

    /* форматирование значения эффекта — общее для всех досок */
    fmtEffect: fmtEffect,

    resIcon(res) { return RES_ICON[res] || '•'; },
    resName(res) { return RES_NAME[res] || res; },

    /**
     * Строка апгрейда: название, «сейчас → станет», цена, кнопка.
     * Возвращает { el, update(state) }.
     */
    upgradeRow(state, u) {
      const lvlEl = G.h('span', { class: 'upg-lvl' });
      const effEl = G.h('div', { class: 'upg-eff' });
      const noteEl = G.h('div', { class: 'upg-note', text: u.note || '' });
      const costEl = G.h('span', { class: 'upg-cost' });
      const btn = G.h('button', { class: 'upg-buy' }, [costEl]);

      const el = G.h('div', { class: 'upg' }, [
        G.h('div', { class: 'upg-main' }, [
          G.h('div', { class: 'upg-head' }, [
            G.h('span', { class: 'upg-name', text: u.name }),
            lvlEl
          ]),
          effEl,
          noteEl
        ]),
        btn
      ]);

      /* покупка: клик + зажатие */
      let holdTimer = null;
      const stopHold = () => {
        if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        G.upgrades.buy(G.state, u);
        stopHold();
        holdTimer = setInterval(() => {
          if (!G.upgrades.buy(G.state, u)) { /* продолжаем, апгрейд может стать доступным */ }
        }, 120);
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
        effEl.textContent = maxed
          ? fmtEffect(u, cur)
          : fmtEffect(u, cur) + ' → ' + fmtEffect(u, next);

        if (maxed) {
          costEl.textContent = 'макс';
          btn.disabled = true;
          btn.className = 'upg-buy maxed';
        } else if (u.costD) {
          /* цена в цифрах: платим частью самого числа */
          const price = G.upgrades.digitsCost(s, u);
          const can = G.upgrades.canBuy(s, u);
          const need = price + (u.minD !== undefined ? u.minD : 2);
          costEl.textContent = (!can && G.growth.D(s) < need)
            ? 'D ≥ ' + need.toFixed(1)
            : '−' + price.toFixed(2) + ' цифр';
          btn.disabled = !can;
          btn.className = 'upg-buy' + (can ? ' can shop' : ' cant');
        } else {
          const price = G.upgrades.currentCost(s, u);
          costEl.textContent = G.fmt.num(price, s.settings.numberFormat) + ' ' + C.resIcon(u.res);
          const can = G.upgrades.canBuy(s, u);
          btn.disabled = !can;
          btn.className = 'upg-buy' + (can ? ' can' : ' cant');
        }
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
      return { el: el, set(v) { val.textContent = v; }, setClass(c) { el.className = 'tile ' + c; } };
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

    /* секция с заголовком */
    section(title, children) {
      return G.h('div', { class: 'section' }, [
        title ? G.h('h3', { class: 'section-title', text: title }) : null,
        ...([]).concat(children)
      ]);
    }
  };

  G.ui.components = C;
})(window.G = window.G || {});
