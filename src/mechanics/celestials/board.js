/* mechanics/celestials/board.js — доска Hall of Celestials: 8 карточек, испытания, сигилы.
   Логики нет: условия/награды — content/celestials.js, проверка — systems/celestial-trials.js. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('celestials');
  const C = G.ui.components;

  function fmt(state, v) {
    return (G.fmt && G.fmt.num) ? G.fmt.num(v, state && state.settings && state.settings.numberFormat) : String(v);
  }

  mech.board = {
    mount(root) {
      const tSigils = C.tile('Сигилы ☉', 'accent');
      const tDone = C.tile('Завершено', 'good');
      const tTry = C.tile('Попыток', '');

      const list = (G.celestialTrials && G.celestialTrials.list)
        ? G.celestialTrials.list()
        : [];

      const cards = list.map((c) => {
        const symbol = G.h('span', { class: 'cel-symbol', text: c.symbol || '☉' });
        const name = G.h('div', { class: 'cel-name', text: c.name || c.id });
        const lore = G.h('div', { class: 'cel-lore', text: c.lore || '' });
        const trial = G.h('div', { class: 'cel-trial', text: (c.trial && c.trial.name) || 'испытание' });
        const desc = G.h('div', { class: 'cel-desc', text: (c.trial && c.trial.desc) || '' });
        const reward = G.h('div', { class: 'cel-reward', text: '☉ ' + ((c.reward && c.reward.text) || '') });
        const btn = G.h('button', { class: 'btn cel-claim', type: 'button', dataset: { cel: c.id } });
        btn.addEventListener('click', () => {
          if (!G.celestialTrials || !G.celestialTrials.complete) return;
          if (G.celestialTrials.complete(G.state, c.id)) {
            if (G.ui.toast) G.ui.toast('Целестиал: ' + (c.name || c.id) + ' · ☉ +1', 'ach', 3200);
            update(G.state);
          }
        });
        const el = G.h('div', { class: 'cel-card', dataset: { cel: c.id } }, [
          G.h('div', { class: 'cel-head' }, [symbol, name]),
          lore, trial, desc, reward, btn
        ]);
        el.style.setProperty('--cel', c.color || '#ffd166');
        return { c: c, el: el, btn: btn };
      });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tSigils.el, tDone.el, tTry.el]),
        G.h('div', { class: 'section' }, [
          G.h('h3', { class: 'section-title', text: 'Зал целестиалов' }),
          G.h('div', { class: 'cel-grid' }, cards.map((c) => c.el))
        ])
      ]);
      root.appendChild(el);

      function update(state) {
        const p = (G.celestialTrials && G.celestialTrials.progress)
          ? G.celestialTrials.progress(state)
          : { done: 0, total: cards.length, sigils: 0 };
        tSigils.set(String(p.sigils || 0));
        tDone.set((p.done || 0) + ' / ' + (p.total || cards.length));
        tTry.set(String((state && state.cel && state.cel.stats && state.cel.stats.attempts) || 0));

        for (const card of cards) {
          const done = !!(G.celestials && G.celestials.isDone && G.celestials.isDone(state, card.c.id));
          const can = !!(G.celestialTrials && G.celestialTrials.check && G.celestialTrials.check(state, card.c.id));
          card.el.classList.toggle('done', done);
          card.el.classList.toggle('ready', !done && can);
          card.btn.disabled = done || !can;
          card.btn.textContent = done ? 'готово' : (can ? 'Предъявить' : 'не выполнено');
        }
      }

      return { update };
    }
  };
})(window.G = window.G || {});
