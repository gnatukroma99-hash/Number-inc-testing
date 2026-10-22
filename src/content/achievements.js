/* content/achievements.js — ДОСТИЖЕНИЯ (v0.8.1).
   Никакой логики: id, иконка, название, подсказка и УСЛОВИЕ строкой-формулой.
   Переменные условия: D, bestD, cores, runs, prime, energy, sieveFound, mirrors,
   treeNodes, upgrades, playtime, achievements.
   Открытые достижения дают постоянный бонус к M (meta, никогда не сбрасывается). */
(function (G) {
  'use strict';

  G.content = G.content || {};
  G.content.achievements = {
    /* бонус к M от числа открытых достижений */
    multFormula: '1 + 0.01 * count',
    hint: 'Достижения открываются сами, когда в игре происходит что-то важное. ' +
          'Каждое даёт +1% к M навсегда — коллекция это тоже сила.',

    list: [
      { id: 'a_first', icon: '1', name: 'Первые цифры', desc: 'Дойти до 10 цифр',
        cond: 'D >= 10' },
      { id: 'a_100', icon: 'hundred', name: 'Сотка', desc: 'Дойти до 100 цифр',
        cond: 'D >= 100' },
      { id: 'a_200', icon: 'rocket', name: 'Двести', desc: 'Дойти до 200 цифр',
        cond: 'D >= 200' },
      { id: 'a_308', icon: 'brick', name: 'Стена пробита', desc: 'Дойти до 308 цифр (1e308)',
        cond: 'D >= 308' },

      { id: 'a_run1', icon: 'cycle', name: 'Новая жизнь', desc: 'Переродиться первый раз',
        cond: 'runs >= 1' },
      { id: 'a_run10', icon: 'recycle', name: 'Круговерть', desc: 'Переродиться 10 раз',
        cond: 'runs >= 10' },
      { id: 'a_cores25', icon: '◆', name: 'Первый капитал', desc: 'Накопить 25 ◆',
        cond: 'cores >= 25' },
      { id: 'a_cores150', icon: 'facet', name: 'Ядерный банк', desc: 'Накопить 150 ◆',
        cond: 'cores >= 150' },

      { id: 'a_prime10', icon: '❖', name: 'Прайм-старт', desc: 'Получить 10 ❖',
        cond: 'prime >= 10' },
      { id: 'a_prime1m', icon: 'star', name: 'Прайм-миллион', desc: '1 000 000 ❖',
        cond: 'prime >= 1e6' },
      { id: 'a_energy1m', icon: 'bolt', name: 'Энергетик', desc: '1 000 000 ⌁ на счету',
        cond: 'energy >= 1e6' },
      { id: 'a_upg100', icon: 'cart', name: 'Оптовик', desc: '100 уровней апгрейдов суммарно',
        cond: 'upgrades >= 100' },

      { id: 'a_tree3', icon: 'tree', name: 'Ветка выросла', desc: 'Купить 3 узла дерева ◆',
        cond: 'treeNodes >= 3' },
      { id: 'a_tree13', icon: 'tree', name: 'Всё дерево', desc: 'Купить все 13 узлов дерева ◆',
        cond: 'treeNodes >= 13' },
      { id: 'a_sieve', icon: '⌗', name: 'Решето поработало', desc: 'Найти 100 простых решетом',
        cond: 'sieveFound >= 100' },
      { id: 'a_mirror', icon: '⧗', name: 'Полное зеркало', desc: 'Поймать 7 совпавших пар в мантиссе',
        cond: 'mirrors >= 7' },

      /* --- автомат ⌾ (v0.12.9) --- */
      { id: 'a_slot1', icon: 'slot', name: 'Руки чешутся', desc: 'Прокрутить барабаны первый раз',
        cond: 'slotSpins >= 1' },
      { id: 'a_slot_jack', icon: 'slot', name: '777', desc: 'Сорвать джекпот автомата',
        cond: 'slotJacks >= 1' },
      { id: 'a_slot_reso', icon: '◆', name: 'Резонанс', desc: 'Собрать триплет, равный первой цифре числа',
        cond: 'slotReso >= 1' },
      { id: 'a_slot_pity', icon: '★', name: 'Всё равно заплатит', desc: 'Дожить до гаранта ×2',
        cond: 'slotPities >= 1' },
      { id: 'a_slot_streak', icon: 'sparkle', name: 'Горячая рука', desc: '5 выигрышей подряд',
        cond: 'slotStreak >= 5' },

      { id: 'a_hour', icon: 'clock', name: 'Час в игре', desc: 'Час суммарного времени',
        cond: 'playtime >= 3600' },
      { id: 'a_collector', icon: 'trophy', name: 'Коллекционер', desc: 'Открыть 12 достижений',
        cond: 'achievements >= 12' }
    ]
  };
})(window.G = window.G || {});
