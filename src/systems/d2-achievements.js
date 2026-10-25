/* systems/d2-achievements.js — D2-достижения (ТЗ docs/CELESTIALS.md §5).
   Обходит список из content/d2-achievements.js и проверяет УСЛОВИЯ-формулы
   общим парсером G.formula. Движок не знает ни одного id: новое достижение —
   строка в данных.

   Состояние: state.d2.achievements — массив id (новых полей сейва нет, §5).
   Массив не сбрасывает ни D1, ни Схлопывание: scope 'meta-d2'.
   Награда: mult(state) — множитель к СКОРОСТИ ОСЕЙ D2 (его читает d2-growth),
   к D1 он не применяется (ТЗ §9).

   Тест: tools/tests/d2-achievements.test.js */
(function (G) {
  'use strict';

  const CHECK_PERIOD = 1;   // сек — как часто проверяем условия в update()

  let acc = 0;

  function cfg() {
    return (G.content && G.content.d2Achievements) || { list: [] };
  }

  function num(v) {
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  function d2(state) {
    return (state && state.d2) || null;
  }

  /* Открытые id — в state.d2.achievements. Без state.d2 отдаём пустой массив:
     система не создаёт второй мир сама (это делает systems/d2.js). */
  function doneList(state) {
    const s = d2(state);
    if (!s) return [];
    if (!Array.isArray(s.achievements)) s.achievements = [];
    return s.achievements;
  }

  /* сколько уровней куплено в мешке state.d2.upgrades / state.d2.links
     (id не важны — считаем только «куплено», ТЗ §5: links >= 2, upgrades >= 3) */
  function boughtCount(bag) {
    if (!bag || typeof bag !== 'object') return 0;
    let n = 0;
    for (const id in bag) {
      const v = bag[id];
      if (typeof v === 'number' && isFinite(v) && v > 0) n++;
    }
    return n;
  }

  /* min/max уровня по восьми осям: axesMin >= 1 = «открыты все оси»,
     axesMax — самая прокачанная. Пустой массив осей — оба 0. */
  function axesBounds(state) {
    const s = d2(state);
    const axes = (s && Array.isArray(s.axes)) ? s.axes : [];
    let min = 0;
    let max = 0;
    for (let i = 0; i < axes.length; i++) {
      const lvl = num(axes[i] && axes[i].lvl);
      if (i === 0 || lvl < min) min = lvl;
      if (lvl > max) max = lvl;
    }
    return { min: min, max: max };
  }

  function emitUnlocked(a) {
    if (G.bus && typeof G.bus.emit === 'function') G.bus.emit('d2achievement:unlocked', a);
  }

  const A = {
    list() { return cfg().list || []; },
    total() { return A.list().length; },
    count(state) { return doneList(state).length; },
    has(state, id) { return doneList(state).indexOf(id) >= 0; },

    /* все переменные для условий (§5). Стоимость — один обход осей и двух мешков. */
    vars(state) {
      const s = d2(state);
      const res = (s && s.res) || {};
      const stats = (s && s.stats) || {};
      const bounds = axesBounds(state);
      return {
        D2: num(s && s.D),
        collapses: num(stats.collapses),
        bestD: num(stats.bestD),
        essence: num(res.essence),
        xi: num(res.axis),
        axesMin: bounds.min,
        axesMax: bounds.max,
        boost: num(s && s.boost),
        links: boughtCount(s && s.links),
        upgrades: boughtCount(s && s.upgrades),
        /* ☉ Сигилы — счётчик завершённых целестиалов (state.cel, §2).
           До Hall там 0: без модуля целестиалов условие просто не срабатывает. */
        sigils: num(state && state.cel && state.cel.sigils)
      };
    },

    /* проверить все условия; открыть новые; вернуть массив новых.
       Идемпотентно: уже открытые пропускаются, повторный вызов даёт []. */
    check(state) {
      if (!d2(state)) return [];
      const vars = A.vars(state);
      const done = doneList(state);
      const fresh = [];
      for (const a of A.list()) {
        if (!a || !a.id || !a.cond) continue;
        if (done.indexOf(a.id) >= 0) continue;
        let ok = false;
        try {
          ok = !!G.formula(a.cond, vars);
        } catch (e) {
          console.warn('[d2achievements] плохое условие', a.id, e.message);
        }
        if (ok) {
          done.push(a.id);
          fresh.push(a);
        }
      }
      for (const a of fresh) emitUnlocked(a);
      return fresh;
    },

    /* Тик (main.js зовёт update(state, dt)). Без dt (ручной вызов из UI) проверяем сразу,
       иначе накопитель никогда не дойдёт до периода. */
    update(state, dt) {
      acc += (typeof dt === 'number' && isFinite(dt) && dt > 0) ? dt : CHECK_PERIOD;
      if (acc < CHECK_PERIOD) return null;
      acc = 0;
      return A.check(state);
    },

    /* множитель к скорости осей D2: 1 + 0.01 * count (формула — в данных) */
    mult(state) {
      const n = A.count(state);
      if (!n) return 1;
      const v = G.formula(cfg().multFormula || '1 + 0.01 * count', { count: n });
      return (isFinite(v) && v > 0) ? v : 1;
    },

    /* строка бейджа дока: «7/12» */
    status(state) {
      return A.count(state) + '/' + A.total();
    }
  };

  G.d2Achievements = A;
})(window.G = window.G || {});
