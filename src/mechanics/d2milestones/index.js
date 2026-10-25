/* mechanics/d2milestones/index.js — механика «Пороги D₂» (Измерение 2, фаза 2).
   Паспорт доски: id, порядок, разблокировка, бейдж. Данные — content/d2-milestones.js,
   логика — systems/d2-milestones.js (G.d2Milestones): доска только читает их API.
   Апгрейдов у механики нет намеренно: пороги не покупаются, они открываются рекордом D₂. */
(function (G) {
  'use strict';

  G.registry.addMechanic({
    id: 'd2milestones',
    order: 10.5,
    name: 'Пороги D₂',
    short: 'Пороги',
    icon: 'target',
    scope: 'meta-d2',        // награды вечные: рекорд D₂ не сбрасывает ни Схлопывание, ни D1
    noBulk: true,            // покупать нечего — это данные G.content.d2milestones
    lockHint: 'нужен Ярус 4 и 10 ⧜',
    hint: 'Восемь вечных наград за рекорд D₂. Схлопывание обнуляет оси и Ξ, но рекорд ' +
          'остаётся — пройденный порог работает всегда. Доска показывает путь до следующего.',

    /* система D2 подключается отдельным файлом — без неё доска закрыта, а не падает */
    isUnlocked(state) {
      return !!(G.d2 && typeof G.d2.unlocked === 'function' && G.d2.unlocked(state));
    },

    status(state) {
      if (!G.d2Milestones || typeof G.d2Milestones.status !== 'function') return 'порогов нет';
      return G.d2Milestones.status(state);
    }
  });
})(window.G = window.G || {});
