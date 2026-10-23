/* mechanics/cracks/board.js — доска «Трещины ⟁»: осколок стены, награда, апгрейды.
   Ничего не считает: всё в systems/cracks.js. Оформление — «стекло и трещины». */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('cracks');
  /* C берём ЛЕНИВО: доски грузятся и без UI (bench.js), G.ui.components там нет */
  const C = () => G.ui.components;

  mech.board = {
    mount(root) {
      const tBroken = C().tile('Сломано трещин', 'good');
      const tReward = C().tile('Ψ за трещину', 'accent');
      const tSpan = C().tile('Плоскость от трещин', 'good');
      const tWait = C().tile('Следующая', '');

      /* «осколок»: большая цифра сломанных трещин + полоска жизни следующей */
      const heroNum = G.h('div', { class: 'crack-hero-num', text: '0' });
      const heroSub = G.h('div', { class: 'crack-hero-sub', text: 'трещин сломано' });
      const heroWhen = G.h('div', { class: 'crack-hero-when', text: '' });
      const heroLine = G.h('div', { class: 'crack-hero-line' });
      const heroFill = G.h('div', { class: 'crack-hero-fill' });
      heroLine.appendChild(heroFill);
      const hero = G.h('div', { class: 'crack-hero' }, [
        G.h('div', { class: 'crack-hero-shard', 'aria-hidden': 'true' }),
        G.h('div', { class: 'crack-hero-body' }, [heroNum, heroSub, heroWhen, heroLine])
      ]);

      const rows = G.registry.upgradesOf('cracks').map((u) => C().upgradeRow(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        hero,
        C().grid([tBroken.el, tReward.el, tSpan.el, tWait.el]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: 'Ψ за трещину = ' + (G.content.cracks.rewardPsi || 2) + ' · 1.6^«Ψ из трещины»' }),
          G.h('code', { text: 'span = 1 + 0.004 · трещины · (1 + 0.5·«Раскол»)' }),
          G.h('code', { text: 'пауза = ' + (G.content.cracks.spawnEvery || 26) + ' с · 0.85^«Частые трещины»' })
        ]),
        C().section('Ψ в трещины (покупки за Ψ)', rows.map((r) => r.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const broken = G.cracks.broken(state);
          const left = G.cracks.left(state);
          const next = G.cracks.nextIn(state);
          heroNum.textContent = String(broken);
          tBroken.set(String(broken));
          tReward.set('Ψ ' + G.fmt.num(G.cracks.reward(state)));
          tSpan.set('×' + G.cracks.spanMult(state).toFixed(3));
          tWait.set(left > 0 ? 'открыта ' + Math.ceil(left) + ' с' : 'через ' + Math.ceil(next) + ' с');
          if (left > 0) {
            heroWhen.textContent = 'трещина открыта — жми ⟁ на экране · ' + Math.ceil(left) + ' с';
            hero.classList.add('open');
            heroFill.style.width = Math.max(0, Math.min(1, left / G.cracks.life(state))) * 100 + '%';
          } else {
            heroWhen.textContent = 'следующая через ' + Math.ceil(next) + ' с';
            hero.classList.remove('open');
            heroFill.style.width = Math.max(0, Math.min(1, 1 - next / G.cracks.gap(state))) * 100 + '%';
          }
          rows.forEach((r) => r.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
