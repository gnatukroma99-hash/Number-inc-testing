/* mechanics/d2links/board.js — доска «Связи»: 4 моста D1 ↔ D2 за ⌬ и текущие бонусы.
   Связи лежат в данных (G.content.d2.links), покупка — G.d2Links, состояние — state.d2.links. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('d2links');
  const C = G.ui.components;

  const data = () => (G.content.d2 || {});
  const links = () => (data().links || []);

  function essence(state) {
    const v = state && state.d2 && state.d2.res ? state.d2.res.essence : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }
  function lvlOf(state, id) {
    const lv = state && state.d2 ? state.d2.links : null;
    const v = lv ? lv[id] : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  /* карточка связи: имя, уровень, описание, цена в ⌬, кнопка покупки */
  function linkCard(state, l) {
    const max = l.max || 1;
    const lvlEl = G.h('span', { class: 'upg-lvl' });
    const costEl = G.h('span', { class: 'upg-cost' });
    const btn = G.h('button', { class: 'upg-buy', type: 'button' }, [costEl]);
    const lvlFill = G.h('i');
    const el = G.h('div', { class: 'upg', dataset: { link: l.id, mech: 'd2links' } }, [
      G.h('div', { class: 'upg-ico' }, [G.ui.icons.node(l.icon || 'link')]),
      G.h('div', { class: 'upg-main' }, [
        G.h('div', { class: 'upg-head' }, [
          G.h('span', { class: 'upg-name', text: l.name }),
          lvlEl
        ]),
        G.h('div', { class: 'upg-lvlbar' }, [lvlFill]),
        G.h('div', { class: 'upg-eff', text: l.desc || '' })
      ]),
      btn
    ]);

    btn.addEventListener('click', () => {
      const s = G.state;
      if (!s) return;
      if (G.d2Links.buyLink(s, l.id)) {
        G.ui.toast('⌬ ' + l.name + ' · ур. ' + lvlOf(s, l.id), 'good', 1600);
      }
      update(s);
    });

    function update(s) {
      const lvl = lvlOf(s, l.id);
      const maxed = lvl >= max;
      lvlEl.textContent = 'ур. ' + lvl + ' / ' + max;
      lvlFill.style.width = (Math.min(1, lvl / max) * 100).toFixed(1) + '%';
      if (maxed) {
        costEl.textContent = 'макс';
        btn.disabled = true;
        btn.className = 'upg-buy maxed';
        return;
      }
      const cost = G.d2Links.linkCost(s, l.id);
      const can = isFinite(cost) && cost <= essence(s);
      costEl.textContent = G.fmt.num(cost, s.settings.numberFormat) + ' ⌬';
      btn.disabled = !can;
      btn.className = 'upg-buy' + (can ? ' can' : ' cant');
    }

    update(state);
    return { id: l.id, el: el, update: update };
  }

  mech.board = {
    mount(root) {
      const tStart = C.tile('Старт D₂ от D1', 'good');
      const tMult = C.tile('M D1 от D2', 'good');
      const tEssence = C.tile('⌬ Эссенция', 'accent');
      const tD = C.tile('D₂ сейчас');
      const tBought = C.tile('Связей куплено');

      const cards = links().map((l) => linkCard(G.state, l));

      /* живые бонусы мостов: ни одного числа в тексте — только то, что отдаёт G.d2Links */
      const codeStart = G.h('code');
      const codeMult = G.h('code');
      let codeStartText = '';
      let codeMultText = '';

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tStart.el, tMult.el, tEssence.el, tD.el, tBought.el]),
        G.h('div', { class: 'formula-card' }, [
          G.h('div', { class: 'block-label', text: 'Мосты сейчас' }),
          codeStart,
          codeMult
        ]),
        C.section('⌬ в связи', cards.map((c) => c.el))
      ]);
      root.appendChild(el);

      return {
        update(state) {
          const d = G.d2.D(state);
          const start = G.d2Links.d2StartBonus(state);
          const mult = G.d2Links.d1Mult(state);
          tStart.set('+' + G.fmt.num(start) + ' цифр');
          tMult.set('×' + G.fmt.num(mult));
          tEssence.set('⌬ ' + G.fmt.num(essence(state)));
          tD.set(d.toFixed(1));
          tBought.set(cards.filter((c) => lvlOf(state, c.id) > 0).length + ' / ' + cards.length);
          /* текст пишем только при изменении: render() зовётся ~30 раз в секунду */
          const startText = 'D1 → D2: старт D₂ +' + G.fmt.num(start) + ' цифр';
          if (startText !== codeStartText) { codeStartText = startText; codeStart.textContent = startText; }
          const multText = 'D2 → D1: множитель M ×' + G.fmt.num(mult);
          if (multText !== codeMultText) { codeMultText = multText; codeMult.textContent = multText; }
          cards.forEach((c) => c.update(state));
        }
      };
    }
  };
})(window.G = window.G || {});
