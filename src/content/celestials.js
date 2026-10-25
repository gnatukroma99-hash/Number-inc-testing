/* content/celestials.js — HALL OF CELESTIALS (Фаза 2, v0.37.0): данные 8 целестиалов.
   Целестиал — это галерейная сущность D2: у каждого одно испытание (условие на состояние)
   и одна ВЕЧНАЯ награда-правило к D2. Данные читают systems/celestials.js (счётчики/сигилы),
   systems/celestial-trials.js (проверка и завершение) и mechanics/celestials/board.js (экран);
   сами они список не знают и новых целестиалов не требуют правок кода.

   Контракт записи (ТЗ docs/CELESTIALS.md §3):
     id, name, symbol, color — уникальные лицо и цвет карточки;
     lore      — 1–2 предложения, свои (тексты референса не копируем);
     trial     — { id, name, desc, check(state) }; check — ЧИСТАЯ функция без DOM,
                 возвращает boolean (false на отсутствующем/битом состоянии);
     reward    — { field, mult | add, text }: РОВНО одно из mult/add;
                 field — одно из d2StartAdd | d2RateMult | d2XiMult | d2CollapseMult | d2SpanMult.
   Награды аддитивные (add) складываются, множители (mult) перемножаются — это делает
   G.celestials.bonusSum/bonusMult, а D2-системы умножают/прибавляют их под typeof-guard.

   Состояние читается по форме ТЗ docs/DIMENSION2.md §5.1: state.d2.stats.{collapses,bestD,
   totalEssence}, state.d2.axes[].lvl, state.d2.links/upgrades (мешки «id → уровень»),
   сигилы — state.cel.sigils (docs/CELESTIALS.md §2). */
(function (G) {
  'use strict';

  G.content = G.content || {};

  /* Форма state.d2 фиксирована: ровно 8 осей (systems/d2.js AXES). Испытание «все оси»
     требует все восемь, а не «сколько нашлось». */
  const AXES = 8;
  const AXIS_LVL = 5;

  function d2(state) {
    return (state && state.d2 && typeof state.d2 === 'object') ? state.d2 : null;
  }

  /* число из stats — только конечное, иначе условие не выполнено (кривой сейв не пробивает) */
  function stat(state, key) {
    const d = d2(state);
    const s = d && d.stats;
    const v = s ? s[key] : 0;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  function axisLvl(axis) {
    const v = axis ? axis.lvl : 0;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  /* сколько записей «куплено»: уровень > 0. Новых покупок мешок не знает. */
  function bought(bag) {
    if (!bag || typeof bag !== 'object') return 0;
    let n = 0;
    for (const id in bag) {
      const v = bag[id];
      if (typeof v === 'number' && isFinite(v) && v > 0) n++;
    }
    return n;
  }

  function sigils(state) {
    const v = state && state.cel ? state.cel.sigils : 0;
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  }

  G.content.celestials = {
    id: 'celestials',

    hint: 'Целестиал — сущность D2 со своим испытанием. Условие выполнил — «предъявляешь» его ' +
      'кнопкой в зале и получаешь ВЕЧНУЮ награду-правило (Схлопывание её не снимает). ' +
      'Сигил ☉ — счётчик завершённых испытаний.',

    list: [
      {
        id: 'c_sun', name: 'Солнце', symbol: '☉', color: '#ffd166',
        lore: 'Светит всем сразу, но тебя заметило первым. Одно Схлопывание — и оно уже считает тебя роднёй.',
        trial: {
          id: 't_first', name: 'Первый Схлоп',
          desc: 'Сделать первое Схлопывание',
          check(state) { return stat(state, 'collapses') >= 1; }
        },
        reward: { field: 'd2StartAdd', add: 10, text: 'старт D₂ +10' }
      },
      {
        id: 'c_mercury', name: 'Меркурий', symbol: '☿', color: '#b8c4d0',
        lore: 'Самый мелкий и самый шустрый: пока остальные думают, он уже намотал десяток ⌬.',
        trial: {
          id: 't_ess10', name: 'Десять амфор',
          desc: 'Накопить всего ⌬ ≥ 10',
          check(state) { return stat(state, 'totalEssence') >= 10; }
        },
        reward: { field: 'd2XiMult', mult: 1.10, text: 'Ξ ×1.10' }
      },
      {
        id: 'c_venus', name: 'Венера', symbol: '♀', color: '#f4a3c0',
        lore: 'Любит симметрию до зубного скрежета: восемь осей — и у каждой пятёрка, иначе даже не смотрит.',
        trial: {
          id: 't_axes5', name: 'Восемь по пять',
          desc: 'Поднять все 8 осей до 5 уровня',
          check(state) {
            const d = d2(state);
            const axes = d && d.axes;
            if (!Array.isArray(axes) || axes.length < AXES) return false;
            for (let i = 0; i < axes.length; i++) {
              if (axisLvl(axes[i]) < AXIS_LVL) return false;
            }
            return true;
          }
        },
        reward: { field: 'd2RateMult', mult: 1.10, text: 'скорость осей ×1.10' }
      },
      {
        id: 'c_mars', name: 'Марс', symbol: '♂', color: '#ef5d5d',
        lore: 'Три Схлопывания — три кратера. Четвёртый он тоже примет, но ремонт твой.',
        trial: {
          id: 't_coll3', name: 'Третий кратер',
          desc: 'Сделать 3 Схлопывания',
          check(state) { return stat(state, 'collapses') >= 3; }
        },
        reward: { field: 'd2CollapseMult', mult: 1.15, text: '⌬ за Схлопывание ×1.15' }
      },
      {
        id: 'c_jupiter', name: 'Юпитер', symbol: '♃', color: '#e8b86d',
        lore: 'Гигант уважает только рекорды: двести пятьдесят цифр D₂ — и он открывает дверь с той стороны.',
        trial: {
          id: 't_best250', name: 'Рекорд глубины',
          desc: 'Дойти до рекорда D₂ ≥ 250',
          check(state) { return stat(state, 'bestD') >= 250; }
        },
        reward: { field: 'd2StartAdd', add: 25, text: 'старт D₂ +25' }
      },
      {
        id: 'c_saturn', name: 'Сатурн', symbol: '♄', color: '#d8c47a',
        lore: 'Держит кольца на двух связях. Одна связь — кольца висят криво, и он ворчит.',
        trial: {
          id: 't_links2', name: 'Два моста',
          desc: 'Купить 2 связи D1 ↔ D2',
          check(state) {
            const d = d2(state);
            return bought(d && d.links) >= 2;
          }
        },
        reward: { field: 'd2SpanMult', mult: 1.20, text: 'span софткапа ×1.20' }
      },
      {
        id: 'c_uranus', name: 'Уран', symbol: '♅', color: '#7fd8e8',
        lore: 'Холодный и кривой набок: три апгрейда Схлопывания — и лёд становится опорой.',
        trial: {
          id: 't_upg3', name: 'Три щелчка',
          desc: 'Купить 3 апгрейда Схлопывания',
          check(state) {
            const d = d2(state);
            return bought(d && d.upgrades) >= 3;
          }
        },
        reward: { field: 'd2RateMult', mult: 1.15, text: 'скорость осей ×1.15' }
      },
      {
        id: 'c_neptune', name: 'Нептун', symbol: '♆', color: '#6b8cf0',
        lore: 'Считает сигилы вместо рыб. Четыре и больше — и ты сосед по глубине, заходи.',
        trial: {
          id: 't_sigil4', name: 'Четыре сигила',
          desc: 'Получить 4 сигила ☉',
          check(state) { return sigils(state) >= 4; }
        },
        reward: { field: 'd2XiMult', mult: 1.25, text: 'Ξ ×1.25' }
      }
    ]
  };
})(window.G = window.G || {});
