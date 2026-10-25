# ТЗ — ФАЗА 2: HALL OF CELESTIALS (ЦЕЛЕСТИАЛЫ)

Статус: проектирование. Версия-цель — `0.37.0` (minor).
База: `v0.36.1` (D2 уже работает). Референс: [Icecreamdudes/celestial_incremental](https://github.com/Icecreamdudes/celestial_incremental)
(MIT/TMT; автор разрешил код и идеи). Берём идеи **Hall of Celestials**: галерея сущностей,
испытания, вечные награды-правила, карта миров. Свои имена, формулы, тексты; чужие ассеты не тащим.

---

## 1. Что добавляем

D2 — «Оси Ξ»: 8 осей, Схлопывание, связи, дерево. Фаза 2 добавляет **мета-слой над D2**:

1. **Hall of Celestials** — 8 целестиалов, у каждого испытание и вечная награда-правило.
2. **Сигилы `☉`** — счётчик завершённых целестиалов (не ресурс D1/D2, живёт в `state.cel`).
3. **D2-достижения** — 12 штук, +1% к скорости осей за каждое.
4. **D2-милстоуны** — 8 порогов D₂, дают старт/множители.
5. **Оффлайн D2** — 50% / 8 ч, без покупок, D1 не трогает.
6. **Карта миров** — экран D1/D2 (+ locked D3) с переключением.

Всё data-driven, отдельными системами; D1-сбросы не трогают `state.cel` и D2.

---

## 2. Состояние и сейв

`src/systems/celestials.js`:

```js
state.cel = {
  v: 1,
  unlocked: false,
  active: false,          // открыт ли Hall (для UI/статуса)
  sigils: 0,
  completed: {},          // id целестиала -> true
  stats: { attempts: 0, completions: 0 },
  seen: []                 // прочитанные лоры (id)
};
```

- `G.SAVE_VERSION = 4`; `serialize` включает `cel`; `migrate` v3→v4 создаёт `state.cel`.
- `G.celestials.newState/ensure/unlocked/active/setActive/isDone/markDone/bonusMult/bonusSum/status`.
- `unlocked(state) = state.d2.stats.collapses >= 1` (после первого Схлопывания).
- `markDone(state,id)` идемпотентен: ставит `completed[id]=true`, `sigils++`, `stats.completions++`.
- `bonusMult(state, field)` — произведение `reward.mult` завершённых; `bonusSum(field)` — сумма `reward.add`.
- `state.cel` **не сбрасывается** ни D1, ни D2, ни Схлопыванием.

---

## 3. Данные целестиалов

`src/content/celestials.js`:

| id | Имя | Символ | Испытание (check) | Награда |
|---|---|---|---|---|
| `c_sun` | Солнце | ☉ | первое Схлопывание (`collapses >= 1`) | `d2StartAdd +10` |
| `c_mercury` | Меркурий | ☿ | всего ⌬ ≥ 10 (`totalEssence >= 10`) | `d2XiMult ×1.10` |
| `c_venus` | Венера | ♀ | все 8 осей ур. ≥ 5 | `d2RateMult ×1.10` |
| `c_mars` | Марс | ♂ | 3 Схлопывания (`collapses >= 3`) | `d2CollapseMult ×1.15` |
| `c_jupiter` | Юпитер | ♃ | рекорд `bestD >= 250` | `d2StartAdd +25` |
| `c_saturn` | Сатурн | ♄ | 2 купленные связи (`links >= 2`) | `d2SpanMult ×1.20` |
| `c_uranus` | Уран | ♅ | 3 апгрейда Схлопывания (`upgrades >= 3`) | `d2RateMult ×1.15` |
| `c_neptune` | Нептун | ♆ | 4 сигила (`sigils >= 4`) | `d2XiMult ×1.25` |

```js
G.content.celestials = {
  id: 'celestials',
  list: [{
    id: 'c_sun', name: 'Солнце', symbol: '☉', color: '#ffd166',
    lore: '...', // 1–2 предложения, свои
    trial: { id: 't_first', name: 'Первый Схлоп', desc: 'Сделать первое Схлопывание',
             check(state) { return (state.d2.stats.collapses || 0) >= 1; } },
    reward: { field: 'd2StartAdd', add: 10, text: 'старт D₂ +10' }
  }]
};
```

Правила:
- `trial.check(state)` — чистая функция, без DOM; возвращает boolean.
- Ровно одна из `mult`/`add` в `reward`; `field` — одно из `d2StartAdd`, `d2RateMult`,
  `d2XiMult`, `d2CollapseMult`, `d2SpanMult`.
- Лоры — короткие, мемные, без мата; имена/ассеты не копировать из референса.
- `src/content/groups.js`: в группу `d2` добавить `celestials`, `d2achievements`, `d2milestones`.
  D1-группы не менять.

---

## 4. Испытания

`src/systems/celestial-trials.js`:

```js
G.celestialTrials.list()
G.celestialTrials.get(id)
G.celestialTrials.check(state, id)     // trial.check + D2 unlocked + не завершён
G.celestialTrials.complete(state, id)  // проверка + G.celestials.markDone; true/false
G.celestialTrials.progress(state)      // {done, total, sigils}
```

- Завершение — по кнопке в Hall; авто-завершения нет (игрок сам «предъявляет» условие).
- `complete` не начисляет награду дважды.
- Испытания не меняют правила мира; это цели-достижения с вечной наградой.
- До первого Схлопывания Hall закрыт.

---

## 5. D2-достижения

`src/content/d2-achievements.js` + `src/systems/d2-achievements.js` +
`src/mechanics/d2achievements/{index,board}.js`.

12 достижений, условия строками (`G.formula`), переменные:
`D2, collapses, bestD, essence, xi, axesMin, axesMax, boost, links, upgrades, sigils`.

Список:

```text
d2a_first   collapses >= 1
d2a_axes4   axesMax >= 4
d2a_axes8   axesMin >= 1
d2a_xi1k    xi >= 1000
d2a_ess10   essence >= 10
d2a_coll3   collapses >= 3
d2a_best150 bestD >= 150
d2a_best300 bestD >= 300
d2a_boost5  boost >= 5
d2a_links2  links >= 2
d2a_upg3    upgrades >= 3
d2a_sigil4  sigils >= 4
```

- `G.d2Achievements`: `list/total/count/has/update/check/mult/status`.
- `mult(state) = 1 + 0.01 * count` (множитель к скорости осей D2).
- Достижения вечные, в `state.d2` (новых полей сейва нет; `state.d2.achievements` — массив id).
- Доска: плитка «открыто N/12», сетка карточек, бонус.

---

## 6. D2-милстоуны

`src/content/d2-milestones.js` + `src/systems/d2-milestones.js` +
`src/mechanics/d2milestones/{index,board}.js`.

8 порогов D₂:

| D₂ | Награда |
|---|---|
| 25 | `d2RateMult ×1.10` |
| 50 | `d2XiMult ×1.10` |
| 75 | `d2StartAdd +5` |
| 100 | `d2CollapseMult ×1.10` |
| 150 | `d2SpanMult ×1.10` |
| 200 | `d2RateMult ×1.15` |
| 300 | `d2XiMult ×1.15` |
| 500 | `d2CollapseMult ×1.20` |

- `G.d2Milestones`: `list/reached(state)/mult(state,field)/sum(state,field)/next(state)/status`.
- Пройденные — по `state.d2.stats.bestD`; вечные (лучший D₂ не сбрасывается Схлопыванием).
- Доска: полоса до следующего, список наград.

---

## 7. Оффлайн D2

`src/systems/d2-offline.js`:

```js
G.d2Offline.apply(state, seconds) -> { seconds, gainedD2, xi } | null
```

- Только если `G.d2.unlocked(state)` и `seconds >= 30`.
- Эффективность 50%, потолок 8 ч.
- Шаги по 60 с: `G.d2Growth.tick(state, step * 0.5)` без покупок осей/Boost.
- D1 (`state.N/D/res`) не трогать; `state.d2.stats.playtime` не должен прыгать дважды.
- Возвращает прирост D₂ и Ξ. Директор вызывает после D1-оффлайна с тем же `elapsed`.

---

## 8. Карта миров

`src/content/worlds.js` + `src/ui/world-map.js` + `src/ui/app.js` (только init-хук).

```js
G.content.worlds = [
  { id: 'd1', name: 'Цифры', symbol: '∞', world: 'd1', color: '#35e2c0' },
  { id: 'd2', name: 'Оси Ξ', symbol: 'Ξ', world: 'd2', color: '#ff9de2' },
  { id: 'd3', name: '???', symbol: '∅', locked: true, color: '#7d94a6' }
];
G.ui.worldMap.init(state) / open() / close() / toggle()
```

- Кнопка `#btn-worldmap` создаётся в JS в шапке; оверлей — карта с 2–3 узлами и линиями.
- D1/D2 кликабельны; D2 — только если `G.d2.unlocked`; D3 locked.
- Клик D1/D2 вызывает `G.ui.d2World.set(state,'d1'|'d2')` и закрывает карту.
- `app.js` вызывает `G.ui.worldMap.init` в `App.init` (с guard).
- CSS — директор; использовать классы `world-map-*`, `map-node`, `map-line`.

---

## 9. Интеграция наград в D2

`src/systems/d2-growth.js`, `d2-collapse.js`, `d2-links.js`:

- `axisRate`: `× G.celestials.bonusMult(state,'d2RateMult')` × `G.d2Milestones.mult(state,'d2RateMult')`
  × `G.d2Achievements.mult(state)`.
- `xiRate`: `× bonusMult('d2XiMult')` × milestone.
- `barrier`: `span × bonusMult('d2SpanMult')`.
- `d2Collapse.gain`: `× bonusMult('d2CollapseMult')` × milestone.
- `startD2`: `+ bonusSum('d2StartAdd') + milestone sum('d2StartAdd')`.
- `d2Links.d1Mult`: без изменений (связи отдельно).
- Все вызовы — через `typeof` guard: если модуля нет, множитель 1 / прибавка 0.
- D1 не должен меняться от этих интеграций (кроме существующего `d2links`).

---

## 10. Файлы и границы

| # | Ключ | Файлы (только владелец) |
|---|---|---|
| 1 | `celestials-state` | `src/systems/celestials.js`, `src/systems/state.js`, `src/systems/save.js`, `tools/tests/celestials-state.test.js` |
| 2 | `celestials-content` | `src/content/celestials.js`, `src/content/groups.js`, `tools/tests/celestials-content.test.js` |
| 3 | `celestial-trials` | `src/systems/celestial-trials.js`, `tools/tests/celestial-trials.test.js` |
| 4 | `celestial-hall` | `src/mechanics/celestials/{index,board}.js`, `tools/tests/celestial-hall.test.js` |
| 5 | `d2-achievements` | `src/content/d2-achievements.js`, `src/systems/d2-achievements.js`, `src/mechanics/d2achievements/{index,board}.js`, `tools/tests/d2-achievements.test.js` |
| 6 | `d2-milestones` | `src/content/d2-milestones.js`, `src/systems/d2-milestones.js`, `src/mechanics/d2milestones/{index,board}.js`, `tools/tests/d2-milestones.test.js` |
| 7 | `d2-offline` | `src/systems/d2-offline.js`, `tools/tests/d2-offline.test.js` |
| 8 | `d2-rewards` | `src/systems/d2-growth.js`, `src/systems/d2-collapse.js`, `src/systems/d2-links.js`, `tools/tests/d2-rewards.test.js` |
| 9 | `world-map` | `src/content/worlds.js`, `src/ui/world-map.js`, `src/ui/app.js`, `tools/tests/world-map.test.js` |

Директор: `index.html`, `src/main.js`, `tools/verify.js`, CI, `package.json`,
`tools/checkscontent.js`/`tools/checkcontent.js`, `assets/css/style.css`, `CONTEXT.md`, README, docs,
`tools/tests/run-celestials.js`, финальная сборка.

---

## 11. Приёмка

1. `node tools/checkall.js` — ОК.
2. `node tools/checkcontent.js` — старый контент не сломан; группа D2 знает новые доски.
3. `node tools/unit.js` — ОК.
4. `node tools/tests/run-d2.js` — старые 10 D2-тестов ОК.
5. `node tools/tests/run-celestials.js` — новые 9 тестов ОК.
6. `PERF_MS=120 node tools/domtest.js` — старый UI ОК.
7. `node tools/sim.js 160 900` — D1 77.7 мин (не хуже).
8. `node tools/sim-d2.js 60 0.25` — D₂=100 ~14 мин (награды не ломают первый цикл).
9. Переключение D1/D2, Hall, достижения, милстоуны, карта — без `NaN/Infinity`, сейв v4.
