/* mechanics/glyphs/board.js — доска «Глифы ◈»: три слота, прокрутка за Δ, резонанс с числом. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('glyphs');
  const C = G.ui.components;
  const CFG = G.content.glyphs;

  mech.board = {
    mount(root) {
      const tDelta = C.tile('Δ осколки', 'accent');
      const tRolled = C.tile('Прокруток', '');
      const tReson = C.tile('Резонансов', 'good');
      const tLead = C.tile('Первая цифра числа', '');

      const slotsEl = G.h('div', { class: 'glyph-slots' });
      const slotViews = [];
      for (let i = 0; i < (CFG.slots || 3); i++) {
        const digit = G.h('div', { class: 'glyph-digit', text: '·' });
        const name = G.h('div', { class: 'glyph-name', text: 'пусто' });
        const text = G.h('div', { class: 'glyph-text', text: 'нажми, чтобы выбрать слот' });
        const badge = G.h('div', { class: 'glyph-badge', text: '' });
        const el = G.h('div', { class: 'glyph-card' }, [badge, digit, name, text]);
        el.addEventListener('click', () => {
          G.glyphs.setActive(G.state, i);
          paintSlots(true);
        });
        slotsEl.appendChild(el);
        slotViews.push({ el: el, digit: digit, name: name, text: text, badge: badge });
      }

      const rollBtn = G.h('button', { class: 'btn glyph-roll', type: 'button' });
      rollBtn.addEventListener('click', () => {
        const res = G.glyphs.roll(G.state);
        if (!res) return;
        paintSlots(true);
        const g = res.glyph;
        const rar = G.glyphs.rarity(g.rarity);
        G.ui.toast('◈ ' + g.digit + ' · ' + G.glyphs.profile(g.profile).name + ' (' + rar.name + ')',
          res.reson ? 'ach' : 'good', 3200);
      });

      const leadEl = G.h('div', { class: 'glyph-lead' });
      const effectEl = G.h('div', { class: 'glyph-effect' });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tDelta.el, tRolled.el, tReson.el, tLead.el]),
        slotsEl,
        rollBtn,
        leadEl,
        C.section('Что дают глифы сейчас', [effectEl])
      ]);
      root.appendChild(el);

      let sig = null;
      function paintSlots(force) {
        const d = G.glyphs.data(G.state);
        const lead = G.glyphs.leadDigit(G.state);
        const state = G.state;
        const next = d.slots.map((g) => (g ? g.id + ':' + g.digit + ':' + g.profile + ':' + g.rarity : '-'))
          .join('|') + '#' + d.active + '@' + lead;
        if (!force && next === sig) return;
        sig = next;

        for (let i = 0; i < slotViews.length; i++) {
          const v = slotViews[i];
          const g = d.slots[i];
          v.el.classList.toggle('on', d.active === i);
          if (!g) {
            v.el.classList.remove('reson');
            v.el.style.removeProperty('--glyph');
            v.digit.textContent = '·';
            v.name.textContent = 'пусто';
            v.text.textContent = 'нажми, чтобы выбрать слот';
            v.badge.textContent = '';
            continue;
          }
          const rar = G.glyphs.rarity(g.rarity);
          const prof = G.glyphs.profile(g.profile);
          const pw = G.glyphs.power(state, g);
          v.digit.textContent = String(g.digit);
          v.name.textContent = prof.name;
          v.text.textContent = prof.text;
          v.badge.textContent = rar.name + (pw.reson ? ' · резонанс' : '');
          v.el.style.setProperty('--glyph', rar.color || '#7d94a6');
          v.el.classList.toggle('reson', pw.reson);
        }
      }

      function paintEffects(state) {
        const e = G.glyphs.effects(state);
        const mode = state.settings && state.settings.numberFormat;
        const fmt = (k, name, invert) => {
          if (Math.abs(k - 1) < 1e-9) return null;
          const pct = Math.round((k - 1) * 100);
          return (invert ? (pct > 0 ? '−' : '+') : (pct > 0 ? '+' : '')) + Math.abs(pct) + '% ' + name;
        };
        const parts = [
          fmt(e.M, 'M'),
          fmt(e.energy, '⌁'),
          Math.abs(e.dt - 1) > 1e-9 ? (e.dt < 1 ? 'ΔT быстрее на ' : 'ΔT медленнее на ') +
            Math.round(Math.abs(e.dt - 1) * 100) + '%' : null,
          Math.abs(e.speed) > 1e-9 ? 'скорость ' + (e.speed > 0 ? '+' : '') + e.speed.toFixed(2) : null
        ].filter(Boolean);
        effectEl.textContent = parts.length ? parts.join(' · ') : 'глифов нет — прокрути первый';
        return mode;
      }

      paintSlots(true);

      return {
        update(state) {
          const d = G.glyphs.data(state);
          const e = G.glyphs.effects(state);
          tDelta.set('Δ ' + G.fmt.num(state.res.delta || 0));
          tRolled.set(String(d.rolled || 0));
          tReson.set(String(e.reson));
          tLead.set(String(G.glyphs.leadDigit(state)));
          rollBtn.textContent = 'ПРОКРУТИТЬ ГЛИФ · ' + CFG.rollCost + ' Δ';
          rollBtn.disabled = !G.glyphs.canRoll(state);
          const lead = G.glyphs.leadDigit(state);
          leadEl.textContent = 'Резонанс: глиф с цифрой ' + lead +
            ' работает ×' + CFG.resonance + ' (сейчас таких: ' + e.reson + ')';
          paintSlots(false);
          paintEffects(state);
        }
      };
    }
  };
})(window.G = window.G || {});
