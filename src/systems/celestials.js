/* systems/celestials.js — «Зал Целестиалов»: состояние мета-слоя над D2 (docs/CELESTIALS.md §2).
   Здесь только state.cel и G.celestials. Данные (список целестиалов, лоры, награды) —
   content/celestials.js, испытания — systems/celestial-trials.js, доска — mechanics/celestials/*.
   state.cel не сбрасывается ни D1, ни D2, ни Схлопыванием: сигилы и вечные награды живут
   вне раунда — как meta у D1. */
(function (G) {
  'use strict';

  /* Гейт Зала (§2): открыт после первого Схлопывания D2. Счётчик collapses вечный
     (resetD2 его не трогает), поэтому защёлка unlocked не может «закрыться» обратно. */
  const COLLAPSES_GATE = 1;

  function stateShape() {
    return {
      v: 1,
      unlocked: false,
      active: false,          // открыт ли Hall (для UI/статуса)
      sigils: 0,              // ☉ — счётчик завершённых целестиалов
      completed: {},          // id целестиала -> true
      stats: { attempts: 0, completions: 0 },
      seen: []                // прочитанные лоры (id)
    };
  }

  function num(v, def) {
    return (typeof v === 'number' && isFinite(v)) ? v : def;
  }

  /* Список целестиалов из данных. Модуля контента может не быть (тесты, порядок загрузки) —
     тогда пустой список: награды не применяются, счётчики нулевые, падений нет. */
  function contentList() {
    const c = G.content && G.content.celestials;
    return (c && Array.isArray(c.list)) ? c.list : [];
  }

  const CEL = {
    /* пустой state.cel */
    newState: stateShape,

    /* Добавить/починить state.cel: новый state, старый сейв без него, импорт, битые поля.
       На здоровом состоянии ничего не аллоцирует (вызывается из сейва/тика/UI). */
    ensure(state) {
      if (!state) return null;
      let cel = state.cel;
      if (!cel || typeof cel !== 'object') {
        cel = state.cel = stateShape();
        return cel;
      }

      if (typeof cel.v !== 'number') cel.v = 1;
      if (typeof cel.unlocked !== 'boolean') cel.unlocked = false;
      if (typeof cel.active !== 'boolean') cel.active = false;
      cel.sigils = num(cel.sigils, 0);

      if (!cel.completed || typeof cel.completed !== 'object' || Array.isArray(cel.completed)) {
        cel.completed = {};
      }

      if (!cel.stats || typeof cel.stats !== 'object') {
        cel.stats = { attempts: 0, completions: 0 };
      } else {
        cel.stats.attempts = num(cel.stats.attempts, 0);
        cel.stats.completions = num(cel.stats.completions, 0);
      }

      if (!Array.isArray(cel.seen)) cel.seen = [];
      return cel;
    },

    /* Гейт §2: после первого Схлопывания. Флаг — защёлка, как у D2. */
    unlocked(state) {
      const cel = CEL.ensure(state);
      if (cel.unlocked) return true;
      const collapses = (state.d2 && state.d2.stats) ? num(state.d2.stats.collapses, 0) : 0;
      if (collapses < COLLAPSES_GATE) return false;
      cel.unlocked = true;
      return true;
    },

    active(state) {
      return !!CEL.ensure(state).active;
    },

    /* Открыть Зал можно только после гейта; закрыть — всегда. */
    setActive(state, on) {
      const cel = CEL.ensure(state);
      cel.active = !!on && CEL.unlocked(state);
      return cel.active;
    },

    isDone(state, id) {
      return CEL.ensure(state).completed[id] === true;
    },

    /* Завершить целестиал. Идемпотентно: повторный вызов ничего не начисляет
       и возвращает false (награду дважды не получить). */
    markDone(state, id) {
      if (typeof id !== 'string' || !id) return false;
      const cel = CEL.ensure(state);
      if (cel.completed[id] === true) return false;
      cel.completed[id] = true;
      cel.sigils = num(cel.sigils, 0) + 1;
      cel.stats.completions = num(cel.stats.completions, 0) + 1;
      return true;
    },

    /* Произведение reward.mult завершённых целестиалов с данным полем (по умолчанию 1). */
    bonusMult(state, field) {
      const cel = CEL.ensure(state);
      let mult = 1;
      for (const c of contentList()) {
        if (!c || !c.reward || c.reward.field !== field) continue;
        if (cel.completed[c.id] !== true) continue;
        const m = c.reward.mult;
        if (typeof m === 'number' && isFinite(m) && m > 0) mult *= m;
      }
      return (isFinite(mult) && mult > 0) ? mult : 1;
    },

    /* Сумма reward.add завершённых целестиалов с данным полем (по умолчанию 0). */
    bonusSum(state, field) {
      const cel = CEL.ensure(state);
      let sum = 0;
      for (const c of contentList()) {
        if (!c || !c.reward || c.reward.field !== field) continue;
        if (cel.completed[c.id] !== true) continue;
        const a = c.reward.add;
        if (typeof a === 'number' && isFinite(a)) sum += a;
      }
      return isFinite(sum) ? sum : 0;
    },

    /* Строка для бейджа доска: «☉ 2/8». До гейта — «закрыто». */
    status(state) {
      if (!CEL.unlocked(state)) return 'закрыто';
      const cel = CEL.ensure(state);
      const list = contentList();
      let done = 0;
      for (const c of list) {
        if (c && cel.completed[c.id] === true) done++;
      }
      return '☉ ' + done + '/' + list.length;
    }
  };

  G.celestials = CEL;
})(window.G = window.G || {});
