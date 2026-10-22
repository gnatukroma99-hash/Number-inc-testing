/* mechanics/slot/index.js — «АВТОМАТ ⌾»: активная механика с рандомом.
   Данные (правила, выплаты, пауза, гарант) — в content/slot.js, доска — board.js.
   Логика живёт здесь и отдаётся как G.slot, чтобы её можно было гонять без DOM (domtest, bench).

   Правила игры:
     • ставка = доля энергии ⌁ (кнопки 10/25/50/100 %), выплата = ставка × mult правила;
     • три честных барабана 0..9, правило выбирается первым совпадением (rules в данных);
     • после `pity` пустых подряд автомат обязан выдать ×2 (гарант, «холодная серия» сбрасывается);
     • джекпот 777 платит ◆ и включает M ×3 на 60 с (буфф виден через mult(), как у искры). */
(function (G) {
  'use strict';

  const cfg = () => G.content.slot;
  const rules = () => cfg().rules;

  /* --- эффективные числа с учётом узлов дерева ◆ (ветвь «Автомат», данные в content/tree.js).
     Движок сам обходит все апгрейды и суммирует/перемножает поля — механика просто читает. --- */
  const pick1 = (v, def) => (isFinite(v) && v > 0 ? v : def);

  function gap(state) {
    const mult = pick1(G.growth.upgProduct(state, 'slotGapMult'), 1);
    return Math.max(0.25, cfg().gap * mult);
  }
  function pity(state) {
    const add = G.growth.upgSum(state, 'slotPityAdd') || 0;
    return Math.max(5, Math.round(cfg().pity + add));
  }
  /* множитель ТОЛЬКО для джекпота: обычные выплаты не растим, иначе EV > 1 и автомат
     начинает печатать энергию (проверяется тестом на Монте-Карло) */
  function jackPay(state) {
    return pick1(G.growth.upgProduct(state, 'slotJackPay'), 1);
  }
  function jackMult(state) {
    return cfg().jackpot.mult + (G.growth.upgSum(state, 'slotJackAdd') || 0);
  }
  function jackCores(state) {
    return cfg().jackpot.cores + (G.growth.upgSum(state, 'slotCoreAdd') || 0);
  }

  function pick(digits) {
    const list = rules();
    for (let i = 0; i < list.length; i++) if (list[i].test(digits)) return list[i];
    return list[list.length - 1];
  }

  /* --- шансы: перебор всех 1000 комбинаций, без формул «на глаз» --- */
  let oddsCache = null;
  function odds() {
    if (oddsCache) return oddsCache;
    const total = 1000;
    const count = {};
    for (let a = 0; a < 10; a++) {
      for (let b = 0; b < 10; b++) {
        for (let c = 0; c < 10; c++) {
          const r = pick([a, b, c]);
          count[r.id] = (count[r.id] || 0) + 1;
        }
      }
    }
    oddsCache = rules().map((r) => ({
      id: r.id, name: r.name, mult: r.mult, color: r.color,
      n: count[r.id] || 0, p: (count[r.id] || 0) / total
    }));
    return oddsCache;
  }

  const S = {
    rng: Math.random,                       /* переопределяется в тестах: G.slot.setRng(() => 0.7) */

    setRng(fn) { S.rng = typeof fn === 'function' ? fn : Math.random; return S; },
    odds: odds,
    rules: rules,
    rule(id) {
      const list = rules();
      for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },

    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.slot) {
        m.slot = {
          share: 0.25, cd: 0, cold: 0, spins: 0, wins: 0, jackpots: 0,
          best: 0, buff: 0, last: null, history: []
        };
      }
      return m.slot;
    },

    stake(state) {
      const d = S.data(state);
      const have = state.res.energy || 0;
      const s = Math.floor(have * d.share);
      return isFinite(s) && s > 0 ? s : 0;
    },

    /* можно ли крутить прямо сейчас */
    ready(state) {
      const d = S.data(state);
      return d.cd <= 0 && S.stake(state) >= cfg().minStake;
    },

    /* холодная серия: сколько пустых осталось до гаранта */
    toPity(state) {
      const d = S.data(state);
      return Math.max(0, pity(state) - d.cold);
    },

    /* эффективные значения с узлами дерева (для доски и тестов) */
    gap: gap,
    pity: pity,
    jackPay: jackPay,
    jackMult: jackMult,
    jackCores: jackCores,

    buffLeft(state) { return Math.max(0, S.data(state).buff || 0); },

    /**
     * Одна прокрутка. Возвращает {digits, rule, stake, payout, pity} или null,
     * если крутить нельзя (пауза или ставка меньше minStake).
     */
    spin(state) {
      const c = cfg();
      const d = S.data(state);
      if (d.cd > 0) return null;
      const stake = S.stake(state);
      if (stake < c.minStake) return null;

      const digits = [
        Math.floor(S.rng() * 10),
        Math.floor(S.rng() * 10),
        Math.floor(S.rng() * 10)
      ];
      let rule = pick(digits);
      /* гарант: если это была бы пустая прокрутка, а холодная серия уже предел — платим ×2 */
      const pityLimit = pity(state);
      const isPity = rule.mult <= 0 && d.cold + 1 >= pityLimit;
      if (isPity) rule = S.rule('pair') || rule;

      const payK = rule.buff ? jackPay(state) : 1;
      const payout = stake * (rule.mult || 0) * payK;
      state.res.energy = Math.max(0, (state.res.energy || 0) - stake + payout);

      d.spins++;
      d.cd = gap(state);
      /* ◆ за джекпот растут от узла slotCoreAdd (база из данных — jackpot.cores) */
      if (rule.cores) {
        const coresGain = rule.buff ? jackCores(state) : rule.cores;
        state.res.cores = (state.res.cores || 0) + coresGain;
      }
      if (rule.buff) d.buff = cfg().jackpot.dur;
      if (rule.id === 'jack') d.jackpots++;
      if (payout > 0) {
        d.wins++;
        d.cold = 0;
        if (payout > d.best) d.best = payout;
      } else {
        d.cold++;
      }
      d.last = {
        digits: digits, rule: rule.id, name: rule.name, mult: rule.mult,
        stake: stake, payout: payout, pity: isPity, payK: payK
      };
      d.history.unshift(rule.id);
      if (d.history.length > 8) d.history.length = 8;
      return d.last;
    },

    /* тик: пауза и буфф тикают и без DOM */
    tick(state, dt) {
      const d = S.data(state);
      if (d.cd > 0) d.cd = Math.max(0, d.cd - dt);
      if (d.buff > 0) d.buff = Math.max(0, d.buff - dt);
    },

    /* буфф джекпота — множитель к M (growth.M собирает его из механик) */
    mult(state) {
      return S.buffLeft(state) > 0 ? jackMult(state) : 1;
    },

    restart(state) {
      if (state.mech) state.mech.slot = null;
    }
  };

  G.slot = S;

  /* ---------- механика для реестра ---------- */
  G.registry.addMechanic({
    id: 'slot',
    order: 7,
    name: 'Автомат',
    short: 'Автомат',
    icon: '⌾',
    scope: 'run',
    hint: G.content.slot.hint,
    lockHint: 'нужно 6 цифр (N ≥ 1e6)',

    isUnlocked(state) {
      return G.growth.D(state) >= 6;
    },

    tick(state, dt) {
      S.tick(state, dt);
    },

    mult(state) {
      return S.mult(state);
    },

    onReset(state) {
      S.restart(state);
    },

    status(state) {
      const d = S.data(state);
      if (d.buff > 0) return '⌾ ×' + G.content.slot.jackpot.mult + ' ' + Math.ceil(d.buff) + 'с';
      const left = S.toPity(state);
      return '⌾ гарант через ' + left;
    }
  });
})(window.G = window.G || {});
