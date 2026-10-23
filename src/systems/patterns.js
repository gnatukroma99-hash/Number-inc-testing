/* systems/patterns.js — ПАТТЕРНЫ МАНТИССЫ (v0.27.0).
   Число растёт непрерывно, и его мантисса всё время разная. Иногда в ней складывается
   узор: 777, 4321, 12321. Игра смотрит на 15 значащих цифр 4 раза в секунду и, когда
   узор сложился, «забирает» его: +1 к счётчику типа и короткий буфф к M.
   Кликать не надо — паттерны ловятся сами, пока число растёт (правило «чисто идл»).

   Всё настраивается данными: G.content.patterns (типы, пороги, формулы). */
(function (G) {
  'use strict';

  const cfg = () => (G.content && G.content.patterns) || {};

  /* ---------- поиск узоров в строке цифр ---------- */
  function sameRuns(s) {
    const out = [];
    let n = 1;
    for (let i = 1; i <= s.length; i++) {
      if (i < s.length && s[i] === s[i - 1]) { n++; continue; }
      if (n >= 3) out.push({ type: n >= 4 ? 'quad' : 'triple', at: i - n, len: n, text: s.substr(i - n, n) });
      n = 1;
    }
    return out;
  }

  function steps(s, dir) {
    const out = [];
    let n = 1;
    for (let i = 1; i <= s.length; i++) {
      const step = i < s.length ? (s.charCodeAt(i) - s.charCodeAt(i - 1)) : 99;
      if (step === dir) { n++; continue; }
      if (n >= 3) out.push({ type: n >= 4 ? 'run4' : 'run3', at: i - n, len: n, text: s.substr(i - n, n) });
      n = 1;
    }
    return out;
  }

  /* самый длинный палиндром (не короче minLen) */
  function palindrome(s, minLen) {
    let best = { at: -1, len: 0 };
    for (let c = 0; c < s.length; c++) {
      for (let k = 0; k < 2; k++) {
        let l = c;
        let r = c + k;
        while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }
        const len = r - l - 1;
        if (len > best.len) best = { at: l + 1, len: len };
      }
    }
    if (best.len < (minLen || 5)) return [];
    return [{ type: 'pal', at: best.at, len: best.len, text: s.substr(best.at, best.len) }];
  }

  const P = {
    /* все узоры в строке цифр (первые вхождения каждого типа) */
    scan(str) {
      const s = String(str || '');
      if (s.length < 3) return [];
      const all = sameRuns(s).concat(steps(s, 1), steps(s, -1), palindrome(s, (cfg().palMinLen || 5)));
      const seen = {};
      const out = [];
      /* сильные узоры первыми: quad → triple → run4 → run3 → pal */
      const rank = { quad: 0, triple: 1, run4: 2, run3: 3, pal: 4 };
      all.sort((a, b) => (rank[a.type] - rank[b.type]) || (a.at - b.at));
      for (const h of all) {
        if (seen[h.type]) continue;
        seen[h.type] = 1;
        out.push(h);
      }
      return out;
    },

    /* состояние механики в сейве (без новых полей схемы: живёт в state.mech.patterns) */
    data(state) {
      const m = state.mech || (state.mech = {});
      if (!m.patterns) {
        m.patterns = {
          count: {}, last: {}, total: 0, clock: 0, lastScan: 0,
          buffUntil: 0, streak: 0, lastClaim: -1e9, lastType: null, lastText: '', bestLen: 0
        };
      }
      const d = m.patterns;
      if (!d.count) d.count = {};
      if (!d.last) d.last = {};
      return d;
    },

    /* параметры буффа с учётом апгрейдов (⌁); базовые числа — из данных */
    buff(state) {
      const c = cfg();
      const baseSec = c.buffSec || 12;
      const baseMult = c.buffMult || 1.5;
      return {
        sec: baseSec + 6 * G.lvl(state, 'pt_long'),
        mult: baseMult + 0.25 * G.lvl(state, 'pt_power'),
        cooldown: Math.max(1.5, (c.cooldownSec || 6) - 1 * G.lvl(state, 'pt_scan'))
      };
    },

    /* сколько секунд буффа осталось */
    left(state) {
      const d = P.data(state);
      const b = P.buff(state);
      return Math.max(0, (d.buffUntil || 0) - (d.clock || 0));
    },

    /* сколько типов уже поймано */
    typesFound(state) {
      const d = P.data(state);
      let n = 0;
      for (const t of (cfg().types || [])) if ((d.count[t.id] || 0) > 0) n++;
      return n;
    },

    /* множитель к M: маленький постоянный + буфф, пока узор «горит» */
    mult(state) {
      const c = cfg();
      const d = P.data(state);
      const types = P.typesFound(state);
      const catches = Math.min(d.total || 0, c.maxPermCatches || 40);
      let m = 1 + (c.permPerType || 0.01) * types + (c.permPerCatch || 0.004) * catches;
      if (P.left(state) > 0) m *= P.buff(state).mult;
      return isFinite(m) && m > 0 ? m : 1;
    },

    /* один тик: скан мантиссы, поимка узоров */
    tick(state, dt) {
      const c = cfg();
      const gate = c.gateD || 10;
      if (!G.growth || G.growth.D(state) < gate) return;
      const d = P.data(state);
      d.clock = (d.clock || 0) + (dt || 0);

      /* скан 4 раза в секунду — чаще незачем, мантисса меняется медленно */
      if (d.clock - (d.lastScan || 0) < 0.25) return;
      d.lastScan = d.clock;

      const hits = P.scan(G.BN.digits(state.N).join(''));
      if (!hits.length) return;

      const b = P.buff(state);
      for (const h of hits) {
        if (d.clock - (d.last[h.type] || -1e9) < b.cooldown) continue;
        d.last[h.type] = d.clock;
        d.count[h.type] = (d.count[h.type] || 0) + 1;
        const first = d.count[h.type] === 1;
        d.total = (d.total || 0) + 1;
        d.lastType = h.type;
        d.lastText = h.text;
        d.bestLen = Math.max(d.bestLen || 0, h.len || 0);
        /* серия: узоры подряд (в пределах streakResetSec) дают право на длинный буфф */
        d.streak = (d.clock - (d.lastClaim || -1e9) < (c.streakResetSec || 45)) ? (d.streak || 0) + 1 : 1;
        d.lastClaim = d.clock;
        d.buffUntil = d.clock + b.sec;

        const type = (c.types || []).find((t) => t.id === h.type) || {};
        G.bus.emit('pattern:found', {
          type: h.type, name: type.name || h.type, text: h.text,
          color: type.color, first: first, streak: d.streak,
          sec: b.sec, mult: b.mult
        });
      }
    }
  };

  G.patterns = P;
})(window.G = window.G || {});
