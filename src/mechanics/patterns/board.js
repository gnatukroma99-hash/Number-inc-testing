/* mechanics/patterns/board.js — доска «Паттерны»: мантисса, найденный узор, коллекция, апгрейды.
   Ничего не считает само: логика в systems/patterns.js, здесь только показ. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('patterns');
  const C = G.ui.components;
  const cfg = () => (G.content && G.content.patterns) || {};

  mech.board = {
    mount(root) {
      const tTypes = C.tile('Типов открыто', 'good');
      const tCatch = C.tile('Поймано', '');
      const tStreak = C.tile('Серия', 'accent');
      const tMult = C.tile('Множитель от узоров', 'good');

      const digits = C.digitRow(15);
      const buffBar = C.bar('буфф');
      const lastEl = G.h('div', { class: 'pattern-last' });

      /* карточки типов узоров */
      const cards = (cfg().types || []).map((t) => {
        const count = G.h('span', { class: 'pattern-count', text: '0' });
        const el = G.h('div', { class: 'pattern-card' }, [
          G.h('span', { class: 'pattern-ico' }, [G.ui.icons.node(t.icon || 'diamond')]),
          G.h('span', { class: 'pattern-name', text: t.name }),
          G.h('span', { class: 'pattern-sample', text: t.sample || '' }),
          count,
          G.h('span', { class: 'pattern-desc', text: t.desc || '' })
        ]);
        el.style.setProperty('--pat', t.color || '#a3e635');
        return { t: t, el: el, count: count };
      });
      const cardsGrid = G.h('div', { class: 'pattern-grid' }, cards.map((c) => c.el));

      const upgrades = G.registry.upgradesOf('patterns').map((u) => C.upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tTypes.el, tCatch.el, tStreak.el, tMult.el]),
        G.h('div', { class: 'digits-block' }, [
          G.h('div', { class: 'block-label', text: 'Мантисса: подсвечен узор, если он есть прямо сейчас' }),
          digits.el,
          buffBar.el,
          lastEl
        ]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: 'типы: ' + (cfg().types || []).map((t) => t.name.toLowerCase()).join(' · ') }),
          G.h('code', { text: 'M ×= 1 + 0.01·типы + 0.004·поймано (≤ 40)' }),
          G.h('code', { text: 'пока горит буфф: M ×= (1.5 + 0.25·lvl(pt_power)) · buffMultX типа' })
        ]),
        G.h('div', { class: 'block-label', text: 'Коллекция узоров' }),
        cardsGrid,
        C.section('Апгрейды паттернов', upgrades.map((u) => u.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.patterns.data(state);
          const b = G.patterns.active(state);
          const left = G.patterns.left(state);
          const types = cfg().types || [];

          tTypes.set(G.patterns.typesFound(state) + ' / ' + types.length);
          tCatch.set(String(d.total || 0));
          tStreak.set('×' + (d.streak || 0));
          tMult.set('×' + G.fmt.num(G.patterns.mult(state), state.settings.numberFormat));

          for (const c of cards) c.count.textContent = String((d.count || {})[c.t.id] || 0);

          const s = G.BN.digits(state.N);
          digits.set(s);

          /* подсветка узора, который виден сейчас (и того, что поймали последним) */
          const hits = G.patterns.scan(s.join(''));
          const mark = {};
          for (const h of hits) for (let i = h.at; i < h.at + h.len; i++) mark[i] = 1;
          const chips = digits.el.children;
          for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('pattern-ok', !!mark[i]);

          if (left > 0) {
            const frac = Math.min(1, left / Math.max(0.001, b.sec));
            buffBar.set(frac, 'буфф ×' + G.fmt.num(b.mult) + ' · ' + left.toFixed(1) + ' с');
          } else {
            buffBar.set(0, 'буфф не горит');
          }

          if (d.lastText) {
            const t = types.find((x) => x.id === d.lastType) || {};
            lastEl.textContent = 'последний узор: ' + d.lastText + (t.name ? ' · ' + t.name : '');
            lastEl.style.setProperty('--pat', t.color || '#a3e635');
          } else {
            lastEl.textContent = 'узоров ещё не было — просто подожди, число растёт';
          }

          upgrades.forEach((u) => u.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
