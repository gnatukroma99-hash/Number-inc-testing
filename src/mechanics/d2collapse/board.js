/* mechanics/d2collapse/board.js — доска «Схлопывание»: кнопка престижа D2 и 6 апгрейдов за ⌬.
   Апгрейды D2 не лежат в реестре (у них своя валюта ⌬ и своё дерево состояния
   state.d2.upgrades), поэтому общий C.upgradeRow не подходит — карточки собираются здесь,
   а цена/уровень/покупка берутся из G.d2Collapse. DOM строится один раз. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('d2collapse');
  const C = G.ui.components;

  const data = () => (G.content.d2 || {});
  const upgrades = () => (data().upgrades || []);
  const collapseCfg = () => (data().collapse || {});

  function essence(state) {
    const v = state && state.d2 && state.d2.res ? state.d2.res.essence : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }
  function lvlOf(state, id) {
    const upg = state && state.d2 ? state.d2.upgrades : null;
    const v = upg ? upg[id] : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  /* карточка апгрейда за ⌬: имя, уровень, описание, цена, кнопка покупки */
  function upgCard(state, u) {
    const max = u.max || 1;
    const lvlEl = G.h('span', { class: 'upg-lvl' });
    const costEl = G.h('span', { class: 'upg-cost' });
    const btn = G.h('button', { class: 'upg-buy', type: 'button' }, [costEl]);
    const lvlFill = G.h('i');
    const el = G.h('div', { class: 'upg', dataset: { upgrade: u.id, mech: 'd2collapse' } }, [
      G.h('div', { class: 'upg-ico' }, [G.ui.icons.node(u.icon || '⌬')]),
      G.h('div', { class: 'upg-main' }, [
        G.h('div', { class: 'upg-head' }, [
          G.h('span', { class: 'upg-name', text: u.name }),
          lvlEl
        ]),
        G.h('div', { class: 'upg-lvlbar' }, [lvlFill]),
        G.h('div', { class: 'upg-eff', text: u.desc || '' })
      ]),
      btn
    ]);

    btn.addEventListener('click', () => {
      const s = G.state;
      if (!s) return;
      if (G.d2Collapse.buyUpgrade(s, u.id)) {
        G.ui.toast('⌬ ' + u.name + ' · ур. ' + lvlOf(s, u.id), 'good', 1600);
      }
      update(s);
    });

    function update(s) {
      const lvl = lvlOf(s, u.id);
      const maxed = lvl >= max;
      lvlEl.textContent = 'ур. ' + lvl + ' / ' + max;
      lvlFill.style.width = (Math.min(1, lvl / max) * 100).toFixed(1) + '%';
      if (maxed) {
        costEl.textContent = 'макс';
        btn.disabled = true;
        btn.className = 'upg-buy maxed';
        return;
      }
      const cost = G.d2Collapse.upgradeCost(s, u.id);
      const can = isFinite(cost) && cost <= essence(s);
      costEl.textContent = G.fmt.num(cost, s.settings.numberFormat) + ' ⌬';
      btn.disabled = !can;
      btn.className = 'upg-buy' + (can ? ' can' : ' cant');
    }

    update(state);
    return { el: el, update: update };
  }

  mech.board = {
    mount(root) {
      const tD = C.tile('D₂ сейчас', 'accent');
      const tEssence = C.tile('⌬ Эссенция', 'accent');
      const tGain = C.tile('⌬ за Схлопывание', 'good');
      const tCollapses = C.tile('Схлопываний');
      const tBest = C.tile('Рекорд D₂');

      const btn = G.h('button', { class: 'btn d2-collapse-btn', type: 'button', text: 'Схлопнуть' });
      btn.addEventListener('click', () => {
        const s = G.state;
        if (!s) return;
        const gain = G.d2Collapse.perform(s);
        if (gain > 0) {
          G.ui.toast('Схлопывание: +' + G.fmt.num(gain) + ' ⌬ (всего ' +
            G.fmt.num(essence(s)) + ')', 'ach', 5000);
        }
      });

      const cards = upgrades().map((u) => upgCard(G.state, u));

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tD.el, tEssence.el, tGain.el, tCollapses.el, tBest.el]),
        btn,
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Формулы' }),
          G.h('code', { text: '⌬ = ' + (collapseCfg().gainFormula || '0') }),
          G.h('code', { text: 'старт D₂ = ' + (collapseCfg().startFormula || '0') })
        ]),
        C.section('⌬ в апгрейды Схлопывания', cards.map((c) => c.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.d2.D(state);
          const gain = G.d2Collapse.gain(state);
          const can = G.d2Collapse.can(state);
          const stats = (state.d2 && state.d2.stats) || {};
          tD.set(d.toFixed(1));
          tEssence.set('⌬ ' + G.fmt.num(essence(state)));
          tGain.set('+' + G.fmt.num(gain) + ' ⌬');
          tCollapses.set(String(stats.collapses || 0));
          tBest.set(Math.max(stats.bestD || 0, d).toFixed(1));
          cards.forEach((c) => c.update(state));
          btn.disabled = !can;
          btn.className = 'btn d2-collapse-btn' + (can ? ' can' : ' cant');
          btn.textContent = can
            ? 'СХЛОПНУТЬ  +' + G.fmt.num(gain) + ' ⌬'
            : 'НУЖНО D₂ ≥ ' + (collapseCfg().minD || 0);
        }
      };
    }
  };
})(window.G = window.G || {});
