/* mechanics/challenges/board.js — доска «Испытания ⚑»: список забегов с запретами и наградами. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('challenges');
  const C = G.ui.components;

  mech.board = {
    mount(root) {
      const tDone = C.tile('Пройдено', 'good');
      const tDelta = C.tile('Δ осколки', 'accent');
      const tActive = C.tile('Сейчас', '');
      const bar = C.bar('прогресс испытания');

      const rows = (G.challenges.list() || []).map((c) => {
        const name = G.h('div', { class: 'ch-name', text: c.name });
        const meta = G.h('div', { class: 'ch-meta' });
        const reward = G.h('div', { class: 'ch-reward', text: c.text || '' });
        const btn = G.h('button', { class: 'btn ch-btn', type: 'button' });
        btn.addEventListener('click', () => {
          const act = G.challenges.active(G.state);
          if (act && act.id === c.id) { G.challenges.stop(G.state); return; }
          const started = G.challenges.start(G.state, c.id);
          if (started) G.ui.toast('⚑ Испытание: ' + started.name + ' — до ' + started.goal + ' цифр', 'ach', 4200);
        });
        const el = G.h('div', { class: 'ch-card' }, [name, meta, reward, btn]);
        return { c: c, el: el, meta: meta, btn: btn, reward: reward };
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tDone.el, tDelta.el, tActive.el]),
        bar.el,
        C.section('Забеги с запретом', rows.map((r) => r.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const act = G.challenges.active(state);
          const done = G.challenges.done(state);
          tDone.set(done.length + ' / ' + rows.length);
          tDelta.set('Δ ' + G.fmt.num(state.res.delta || 0));
          tActive.set(act ? act.name : '—');
          bar.set(G.challenges.progress(state),
            act ? Math.floor(G.growth.D(state)) + ' / ' + act.goal + ' цифр' : 'испытание не идёт');

          for (const r of rows) {
            const isDone = done.indexOf(r.c.id) >= 0;
            const isActive = act && act.id === r.c.id;
            r.el.classList.toggle('done', isDone);
            r.el.classList.toggle('active', !!isActive);
            const parts = [];
            parts.push('цель: ' + r.c.goal + ' цифр');
            parts.push('вход: ' + r.c.cost + ' Δ');
            if (r.c.blockMech && r.c.blockMech.length) parts.push('выкл: ' + r.c.blockMech.join(', '));
            if (r.c.dtMult) parts.push('ΔT ×' + r.c.dtMult);
            if (r.c.energyMult) parts.push('⌁ ×' + r.c.energyMult);
            r.meta.textContent = parts.join(' · ');
            r.reward.textContent = (isDone ? '✓ ' : '') + (r.c.text || '');
            if (isDone) { r.btn.textContent = 'пройдено'; r.btn.disabled = true; }
            else if (isActive) { r.btn.textContent = 'ВЫЙТИ'; r.btn.disabled = false; }
            else if (act) { r.btn.textContent = 'идёт другое'; r.btn.disabled = true; }
            else {
              r.btn.textContent = 'НАЧАТЬ · ' + r.c.cost + ' Δ';
              r.btn.disabled = !G.challenges.canStart(state, r.c.id);
            }
          }
        }
      };
    }
  };
})(window.G = window.G || {});
