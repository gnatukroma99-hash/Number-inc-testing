/* mechanics/pacts/board.js — доска «Сделки ✍»: благословение и проклятие навсегда. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('pacts');
  const C = G.ui.components;
  const CFG = G.content.pacts;

  mech.board = {
    mount(root) {
      const tActive = C.tile('Активная сделка', 'accent');
      const tDelta = C.tile('Δ осколки', 'good');
      const tTaken = C.tile('Сделок принято', '');

      const activeBox = G.h('div', { class: 'pact-active' });
      const dropBtn = G.h('button', { class: 'btn pact-drop', type: 'button', text: 'Отказаться от сделки' });
      dropBtn.addEventListener('click', () => { G.pacts.drop(G.state); });

      const offersEl = G.h('div', { class: 'pact-offers' });
      const rerollBtn = G.h('button', { class: 'btn pact-reroll', type: 'button' });
      rerollBtn.addEventListener('click', () => {
        G.pacts.reroll(G.state);
        paintOffers(true);
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tActive.el, tDelta.el, tTaken.el]),
        C.section('Активная сделка', [activeBox, dropBtn]),
        C.section('Предложения', [offersEl, rerollBtn])
      ]);
      root.appendChild(el);

      function card(o, onAccept) {
        const tpl = G.pacts.find(o.tpl) || { name: '?', text: '' };
        const k = Math.round((o.k || 1) * 100) + '%';
        const btn = G.h('button', { class: 'btn pact-take', type: 'button', text: 'ВЗЯТЬ' });
        btn.addEventListener('click', onAccept);
        return G.h('div', { class: 'pact-card' }, [
          G.h('div', { class: 'pact-name', text: tpl.name }),
          G.h('div', { class: 'pact-text', text: tpl.text }),
          G.h('div', { class: 'pact-k', text: 'сила ' + k }),
          btn
        ]);
      }

      let sig = null;
      function paintOffers(force) {
        const d = G.pacts.data(G.state);
        const next = d.offers.map((o) => o.tpl + ':' + o.k).join('|') + '#' + d.roll;
        if (!force && next === sig) return;
        sig = next;
        G.dom.clear(offersEl);
        if (!d.offers.length) {
          offersEl.appendChild(G.h('div', { class: 'pact-empty', text: 'нажми «Новые предложения»' }));
          return;
        }
        d.offers.forEach((o, i) => {
          offersEl.appendChild(card(o, () => {
            G.pacts.accept(G.state, i);
            G.ui.toast('✍ Сделка принята: ' + (G.pacts.find(o.tpl) || {}).name, 'good', 3200);
          }));
        });
      }

      /* первые предложения — бесплатно */
      if (!G.pacts.data(G.state).offers.length) G.pacts.reroll(G.state, true);
      paintOffers(true);

      return {
        update(state) {
          const e = G.pacts.effects(state);
          const d = G.pacts.data(state);
          tActive.set(e.active ? e.active.name : '—');
          tDelta.set('Δ ' + G.fmt.num(state.res.delta || 0));
          tTaken.set(String(d.taken || 0));

          G.dom.clear(activeBox);
          if (!e.active) {
            activeBox.appendChild(G.h('div', { class: 'pact-empty', text: 'сделки нет — возьми из предложений' }));
          } else {
            const bits = [];
            const pct = (k, name) => {
              if (Math.abs(k - 1) < 1e-9) return;
              const v = Math.round((k - 1) * 100);
              bits.push((v > 0 ? '+' : '') + v + '% ' + name);
            };
            pct(e.M, 'M');
            pct(e.energy, '⌁');
            if (Math.abs(e.dt - 1) > 1e-9) bits.push('ΔT ×' + e.dt.toFixed(2));
            if (Math.abs(e.speed) > 1e-9) bits.push('скорость ' + (e.speed > 0 ? '+' : '') + e.speed.toFixed(2));
            activeBox.appendChild(G.h('div', { class: 'pact-name', text: e.active.name }));
            activeBox.appendChild(G.h('div', { class: 'pact-text', text: e.active.text }));
            activeBox.appendChild(G.h('div', { class: 'pact-k', text: 'итог: ' + bits.join(' · ') }));
          }
          dropBtn.disabled = !e.active;
          rerollBtn.textContent = 'НОВЫЕ ПРЕДЛОЖЕНИЯ · ' + (CFG.rerollCost || 2) + ' Δ';
          rerollBtn.disabled = (state.res.delta || 0) < (CFG.rerollCost || 2);
          paintOffers(false);
        }
      };
    }
  };
})(window.G = window.G || {});
