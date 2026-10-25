/* systems/celestial-trials.js — испытания целестиалов (docs/CELESTIALS.md §4).
   Тонкая прослойка между данными испытаний (content/celestials.js) и состоянием
   (systems/celestials.js): список, проверка условия, «предъявление» условия игроком,
   прогресс Hall. Своих полей состояния не заводит — пишет только через G.celestials.markDone.
   Без DOM: всё, что нужно, — state и G.* по контракту §4. */
(function (G) {
  'use strict';

  const EMPTY = [];

  /* Список целестиалов из данных. Нет контента (тесты, порядок загрузки) — пустой список. */
  function contentList() {
    const c = G.content && G.content.celestials;
    const list = c && c.list;
    return Array.isArray(list) ? list : EMPTY;
  }

  /* G.celestials целиком нужен только тем методам, что читают/пишут state.cel.
     Нет модуля или он не той формы — отдаём null и работаем «безопасными» значениями. */
  function celestials() {
    const c = G.celestials;
    if (!c || typeof c.unlocked !== 'function' || typeof c.isDone !== 'function' ||
        typeof c.markDone !== 'function') return null;
    return c;
  }

  /* Гейт мира: испытания существуют только в D2 (до первого Схлопывания Hall закрыт). */
  function d2Open(state) {
    return !!(G.d2 && typeof G.d2.unlocked === 'function' && G.d2.unlocked(state));
  }

  const Trials = {
    /* Все целестиалы с их испытаниями (живые объекты контента, не копии). */
    list() {
      return contentList();
    },

    /* Целестиал по id или null. */
    get(id) {
      const list = contentList();
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) return list[i];
      }
      return null;
    },

    /* Условие «можно предъявить»: D2 открыт, Hall открыт, испытание не завершено,
       и чистая trial.check(state) истинна. Недостающие модули/данные — false, не исключение. */
    check(state, id) {
      if (!state) return false;
      const cel = celestials();
      if (!cel) return false;
      const entry = Trials.get(id);
      if (!entry || !entry.trial || typeof entry.trial.check !== 'function') return false;
      if (!d2Open(state)) return false;
      if (!cel.unlocked(state)) return false;
      if (cel.isDone(state, id)) return false;
      return !!entry.trial.check(state);
    },

    /* Предъявить условие: только при check() завершает целестиал и начисляет сигил.
       Повторный вызов на завершённом — false и без второго сигила.
       Каждое предъявление незавершённого целестиала считается попыткой (state.cel.stats.attempts). */
    complete(state, id) {
      if (!state) return false;
      const cel = celestials();
      if (!cel) return false;
      const entry = Trials.get(id);
      if (!entry) return false;
      if (cel.isDone(state, id)) return false;

      const stats = state.cel && state.cel.stats;
      if (stats && typeof stats.attempts === 'number' && isFinite(stats.attempts)) stats.attempts += 1;

      if (!Trials.check(state, id)) return false;
      cel.markDone(state, id);
      return cel.isDone(state, id) === true;
    },

    /* Прогресс Hall: сколько завершено из скольких и сколько сигилов ☉ накоплено. */
    progress(state) {
      const list = contentList();
      const cel = celestials();
      let done = 0;
      if (cel && state) {
        for (let i = 0; i < list.length; i++) {
          const entry = list[i];
          if (entry && cel.isDone(state, entry.id)) done += 1;
        }
      }
      const sig = state && state.cel && state.cel.sigils;
      return {
        done: done,
        total: list.length,
        sigils: (typeof sig === 'number' && isFinite(sig)) ? sig : 0
      };
    }
  };

  G.celestialTrials = Trials;
})(window.G = window.G || {});
