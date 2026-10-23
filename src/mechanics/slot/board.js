/* mechanics/slot/board.js — доска «Автомат ⌾»: три барабана, доли ставки, таблица выплат, история.
   DOM строится один раз, update() меняет только текст/классы (как требует ARCHITECTURE §1.5). */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('slot');
  const C = G.ui.components;
  const CFG = G.content.slot;

  mech.board = {
    mount(root) {
      const tStake = C.tile('Ставка', '');
      const tCold = C.tile('Холодных подряд', '');
      const tJack = C.tile('Джекпотов', 'good');
      const tBest = C.tile('Лучший выигрыш', 'accent');

      /* барабаны */
      const reelDigits = [];
      const reels = G.h('div', { class: 'slot-reels' }, [0, 1, 2].map(() => {
        const d = G.h('span', { class: 'slot-digit', text: '0' });
        reelDigits.push(d);
        return G.h('div', { class: 'slot-reel' }, [d]);
      }));

      const outcome = G.h('div', { class: 'slot-outcome', text: 'готов к прокрутке' });
      const machine = G.h('div', { class: 'slot-machine' }, [reels, outcome]);

      /* чем ставим: ⌁ энергия / ❖ ПРАЙМ / ◆ ядра (данные: content.slot.stakes) */
      const resBtns = (CFG.stakes || ['energy']).map((id) => {
        const b = G.h('button', { class: 'slot-share slot-res', type: 'button' },
          [G.h('span', { text: (C.RES_ICON && C.RES_ICON[id]) || id })]);
        b.addEventListener('click', () => {
          const d = G.slot.data(G.state);
          d.stakeRes = id;
          paintShares();
        });
        return { id: id, el: b };
      });
      const resRow = G.h('div', { class: 'slot-shares slot-res-row' }, resBtns.map((b) => b.el));

      /* доли ставки */
      const shareBtns = CFG.shares.map((s) => {
        const b = G.h('button', { class: 'slot-share', type: 'button', text: Math.round(s * 100) + '%' });
        b.addEventListener('click', () => {
          const d = G.slot.data(G.state);
          d.share = s;
          paintShares();
        });
        return { s: s, el: b };
      });
      const shareRow = G.h('div', { class: 'slot-shares' }, shareBtns.map((b) => b.el));

      const spinBtn = G.h('button', { class: 'btn slot-spin', type: 'button', text: 'КРУТИТЬ' });
      const bar = C.bar('перезарядка');

      spinBtn.addEventListener('click', () => {
        const res = G.slot.spin(G.state);
        if (!res) return;
        spinBtn.classList.remove('hit');
        void spinBtn.offsetWidth;
        if (!G.animationsOff()) spinBtn.classList.add('hit');
        for (let i = 0; i < 3; i++) {
          if (!G.animationsOff()) {
            reelDigits[i].classList.remove('roll');
            void reelDigits[i].offsetWidth;
            reelDigits[i].classList.add('roll');
          }
          reelDigits[i].textContent = String(res.digits[i]);
        }
        outcome.textContent = res.name + ' · ×' + res.mult +
          (res.pity ? ' (гарант)' : '') +
          (res.reson ? ' · РЕЗОНАНС ×' + ((CFG.resonance && CFG.resonance.payMult) || 2) : '') +
          ' · ' + G.fmt.num(res.payout) + ' ' + ((C.RES_ICON && C.RES_ICON[res.res]) || '');
        outcome.className = 'slot-outcome ' + (res.mult > 0 ? 'win' : 'lose') +
          (res.rule === 'jack' ? ' jack' : '') + (res.reson ? ' reson' : '');
        if (res.reson) {
          G.ui.toast('⌾ РЕЗОНАНС: барабаны собрали первую цифру твоего числа (' + res.lead + ')', 'good', 3500);
        }
        if (res.rule === 'jack' && G.ui.fx) {
          G.ui.fx.flash('rgba(255, 209, 102, .5)');
          G.ui.fx.shake();
          G.ui.fx.banner('⌾ ДЖЕКПОТ 777');
        }
        if (res.reson && G.ui.fx) G.ui.fx.flash('rgba(201, 160, 255, .38)');
        if (res.rule === 'jack') {
          G.ui.toast('⌾ ДЖЕКПОТ 777: +' + CFG.jackpot.cores + ' ◆ и M ×' +
            CFG.jackpot.mult + ' на ' + CFG.jackpot.dur + ' с', 'good', 4000);
        }
        paintHistory(true);
      });

      /* таблица выплат — шансы посчитаны перебором 1000 комбинаций */
      const oddsRows = G.slot.odds().map((o) => G.h('div', { class: 'slot-row' }, [
        G.h('span', { class: 'slot-row-name', text: o.name }),
        G.h('span', { class: 'slot-row-note', text: G.slot.rule(o.id) ? G.slot.rule(o.id).note : '' }),
        G.h('span', { class: 'slot-row-p', text: G.fmt.pct(o.p) }),
        G.h('span', { class: 'slot-row-mult', text: '×' + o.mult })
      ]));
      const table = G.h('div', { class: 'slot-table' }, oddsRows);
      const resonNote = G.h('div', { class: 'slot-note', text:
        'РЕЗОНАНС: если триплет совпал с первой цифрой твоего числа — выплата ×' +
        ((CFG.resonance && CFG.resonance.payMult) || 2) + ' и +' +
        ((CFG.resonance && CFG.resonance.cores) || 0) + ' ◆.' });

      const historyEl = G.h('div', { class: 'slot-history' });

      const el = G.h('div', { class: 'board-body' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tStake.el, tCold.el, tJack.el, tBest.el]),
        machine,
        resRow,
        shareRow,
        spinBtn,
        bar.el,
        C.section('Выплаты', [table, resonNote]),
        C.section('Последние прокрутки', [historyEl])
      ]);
      root.appendChild(el);

      function paintShares() {
        const d = G.slot.data(G.state);
        const cur = G.slot.stakeRes(G.state);
        shareBtns.forEach((b) => b.el.classList.toggle('on', b.s === d.share));
        resBtns.forEach((b) => b.el.classList.toggle('on', b.id === cur));
      }

      let historySig = null;
      function paintHistory(force) {
        const d = G.slot.data(G.state);
        const sig = d.history.join(',') + '|' + d.spins;
        if (!force && sig === historySig) return;
        historySig = sig;
        G.dom.clear(historyEl);
        if (!d.history.length) {
          historyEl.appendChild(G.h('span', { class: 'slot-empty', text: 'пока ни одной' }));
          return;
        }
        for (const id of d.history) {
          const r = G.slot.rule(id);
          const chip = G.h('span', { class: 'slot-chip ' + (id === 'none' ? 'lose' : 'win'), text: r ? r.name : id });
          if (r && r.color) chip.style.setProperty('--chip', r.color);
          historyEl.appendChild(chip);
        }
      }

      paintShares();
      paintHistory(true);

      return {
        update(state) {
          const d = G.slot.data(state);
          const stake = G.slot.stake(state);
          const resId = G.slot.stakeRes(state);
          tStake.set(G.fmt.num(stake) + ' ' + ((C.RES_ICON && C.RES_ICON[resId]) || ''));
          tCold.set(String(d.cold) + ' / ' + G.slot.pity(state));
          tJack.set(String(d.jackpots || 0));
          tBest.set(G.fmt.num(d.best) + ' ' + ((C.RES_ICON && C.RES_ICON[resId]) || ''));

          const ready = G.slot.ready(state);
          spinBtn.disabled = !ready;
          bar.set(d.cd > 0 ? 1 - d.cd / G.slot.gap(state) : 1,
            d.buff > 0 ? 'M ×' + G.slot.jackMult(state) + ' · ' + Math.ceil(d.buff) + ' с'
              : (ready ? 'готов' : 'нужна ставка: ' + (C.RES_NAME && C.RES_NAME[resId] || resId)));
          paintShares();
          paintHistory(false);
        }
      };
    }
  };
})(window.G = window.G || {});
