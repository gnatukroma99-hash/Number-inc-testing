/* mechanics/d2milestones/board.js — доска «Пороги D₂»: полоса до следующего порога
   и список вечных наград. Все числа — из G.d2Milestones и state.d2.stats.bestD;
   DOM строится один раз, update() меняет только текст и классы (без innerHTML). */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('d2milestones');
  const C = () => G.ui.components;

  function list() {
    return (G.d2Milestones && typeof G.d2Milestones.list === 'function') ? G.d2Milestones.list() : [];
  }

  /* рекорд D₂ — тот же критерий, по которому G.d2Milestones считает reached() */
  function bestD(state) {
    const stats = state && state.d2 && state.d2.stats;
    const v = stats ? stats.bestD : 0;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  function num(state, x) {
    const n = (typeof x === 'number' && isFinite(x)) ? x : 0;
    return G.fmt.num(n, (state && state.settings && state.settings.numberFormat) || 'short');
  }

  /* строка награды: «D₂ ≥ 100 · Чистый сброс · ⌬ за Схлопывание ×1.10» + метка done/next */
  function rewardRow(m) {
    const markEl = G.h('span', { class: 'd2-milestone-mark' });
    const el = G.h('div', { class: 'd2-milestone', dataset: { milestone: m.id } }, [
      G.h('span', { class: 'd2-milestone-req', text: 'D₂ ≥ ' + m.reqD }),
      G.h('span', { class: 'd2-milestone-name', text: m.name || m.id }),
      G.h('span', { class: 'd2-milestone-reward', text: (m.reward && m.reward.text) || '' }),
      markEl
    ]);
    return { m: m, el: el, markEl: markEl };
  }

  mech.board = {
    mount(root) {
      const tBest = C().tile('Рекорд D₂', 'accent');
      const tDone = C().tile('Порогов пройдено', 'good');
      const tNext = C().tile('Следующий порог');
      const bar = C().bar('до следующего порога');

      const rows = list().map(rewardRow);

      const el = G.h('div', { class: 'board-body d2-milestones-board' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C().grid([tBest.el, tDone.el, tNext.el]),
        G.h('div', { class: 'd2-milestone-progress' }, [
          G.h('div', { class: 'block-label', text: 'Путь до следующего порога' }),
          bar.el
        ]),
        C().section('Награды D₂ (вечные)', rows.map((r) => r.el))
      ]);
      root.appendChild(el);

      function paint(state) {
        const best = bestD(state);
        const milestones = list();
        const nxt = (G.d2Milestones && typeof G.d2Milestones.next === 'function')
          ? G.d2Milestones.next(state)
          : null;
        const done = (G.d2Milestones && typeof G.d2Milestones.reached === 'function')
          ? G.d2Milestones.reached(state).length
          : 0;

        tBest.set(num(state, best));
        tDone.set(done + ' / ' + milestones.length);
        tNext.set(nxt ? 'D₂ ≥ ' + num(state, nxt.reqD) : 'все пройдены');

        /* полоса: от предыдущего пройденного порога к следующему (0 → первый порог) */
        if (nxt) {
          let prevReq = 0;
          for (const m of milestones) {
            if (m.reqD <= best && m.reqD > prevReq) prevReq = m.reqD;
          }
          const span = nxt.reqD - prevReq;
          const frac = span > 0 ? (best - prevReq) / span : 1;
          bar.set(frac, 'до D₂ ' + num(state, nxt.reqD) +
            ' · осталось ' + num(state, Math.max(0, nxt.reqD - best)));
        } else {
          bar.set(1, 'все ' + milestones.length + ' порогов пройдены');
        }

        for (const r of rows) {
          const isDone = best >= r.m.reqD;
          const isNext = !isDone && !!nxt && r.m.id === nxt.id;
          r.el.classList.toggle('done', isDone);
          r.el.classList.toggle('next', isNext);
          /* текст метки пишем только при изменении: render() зовётся ~30 раз в секунду */
          const mark = isDone ? '✓' : (isNext ? '→' : '');
          if (r.markEl.textContent !== mark) r.markEl.textContent = mark;
        }
      }

      return { update: paint };
    }
  };
})(window.G = window.G || {});
