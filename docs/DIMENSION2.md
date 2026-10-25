# ТЗ — ИЗМЕРЕНИЕ 2 (D2): «ОСИ Ξ»

Статус: проектирование первого вертикального среза. Версия-цель — `0.36.0` (minor).
Референс: [Icecreamdudes/celestial_incremental](https://github.com/Icecreamdudes/celestial_incremental)
(мод на The Modding Tree; автор разрешил использовать код и идеи; лицензия TMT — MIT).
Мы берём **идеи структуры** (мультивселенная, 8 измерений, buyables, softcaps, Hall of Celestials),
но пишем **свои формулы, данные, тексты и UI** под наш `window.G`-движок. Чужие картинки/музыку не тащим;
в README и в этом файле сохраняем атрибуцию TMT/MIT.

---

## 1. Зачем это

Сейчас «ЧИСЛО» — одна числовая линия: цифры `D`, мантисса, Ярусы 1–4, престижи ◆/Ψ/⧜.
D2 — **второе измерение**: не «ещё одна доска», а параллельный мир, в котором число растёт
не цифрами, а **осями**. У D2 свой счёт, свои ресурсы, свой сброс и своя карта. D1 и D2
усиливают друг друга, но не ломают друг друга.

Фантазия: «ты вырастил число до предела цифр — и открыл не следующую цифру, а следующее
пространство, в котором это число существует». Почти новая игра внутри игры.

---

## 2. Что берём из Celestial Incremental

| Приём из референса | Как используем у нас |
|---|---|
| `universe`/карта миров (`Hall of Celestials/multiverseMap.js`) | Переключатель миров D1/D2, карта измерений (позже) |
| 8 Infinity/Star Dimensions | 8 осей D2, каждая со своим уровнем, производством и ценой |
| `buyables` + buy max + softcap | Оси: уровни, массовая покупка, невидимый софткап |
| dimension power / boost | `M₂` (объём) и `Boost` за Ξ |
| `startData` + `update(delta)` | Отдельный `state.d2`, отдельный тик |
| Hall of Celestials | Древо D2 / Целестиалы — **фаза 2**, не в первом срезе |
| TMT-контракт слоя | Наш контракт: данные → система → механика → доска |

Не копируем: названия валют/персонажей, арт, музыку, точные формулы, тексты, структуру Vue-компонентов.
Если берём фрагмент кода — сохраняем MIT-заголовок и указываем источник в комментарии.

---

## 3. Словарь

| Термин | Символ | Смысл |
|---|---|---|
| D1 | — | текущий мир «ЧИСЛО» (цифры, ◆/Ψ/⧜) |
| D2 | — | второе измерение |
| Оси | `Ξ` | основная валюта D2; тратится на уровни осей и Boost |
| Эссенция | `⌬` | вечная валюта D2; даётся Схлопыванием, тратится на апгрейды/связи/дерево |
| Объём | `N₂` | «число» D2; `D₂ = log10(N₂)` |
| Схлопывание | — | престиж D2: сбрасывает оси/Ξ/Boost, даёт `⌬` |
| Связи | — | постоянные бонусы D1↔D2 (покупаются за `⌬`) |

`Ξ` и `⌬` — **разные** ресурсы. `Ξ` сбрасывается Схлопыванием, `⌬` — никогда.

---

## 4. Разблокировка

D2 открывается, когда одновременно:

```text
G.turn.tierOpen(state)                 // Ярус 4 уже доступен
state.res.turns >= 10                  // сделано/накоплено 10 ⧜
```

До этого `state.d2.unlocked = false`, никакие хуки D2 не влияют на D1.
Для отладки: `G.debug.unlockD2()` (директор добавит в `src/main.js`).

После открытия в шапке появляется переключатель `D1 | D2`.
Первый вход в D2 показывает короткий онбординг-тост и доску «Оси Ξ».

---

## 5. Ядро D2: 8 осей

### 5.1. Состояние

```js
state.d2 = {
  v: 1,
  unlocked: false,
  active: false,                 // открыт ли мир D2 в UI
  N: { m: 1, e: 0 },             // N₂, BigNum
  D: 0,                          // D₂ = log10(N₂)
  disp: null,                    // плавное отображение
  res: { axis: 0, essence: 0 },  // Ξ, ⌬
  axes: [                        // 8 осей, индекс 0..7
    { lvl: 0, amount: 0 },
    // ...
  ],
  boost: 0,                      // уровень Boost
  upgrades: {},                  // уровни d2-апгрейдов (ключ → число)
  links: {},                     // уровни связей
  stats: { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 },
  lastSeen: 0
};
```

`state.d2` живёт **отдельно** от `state.N`/`state.D`. Сброс D1 не трогает D2 и наоборот.

### 5.2. Данные осей

`src/content/d2.js`:

```js
G.content.d2 = {
  id: 'd2',
  gate: { turns: 10 },
  axes: [
    { id: 'axis1', idx: 1, name: 'Длина',  short: 'I',   icon: 'x',
      baseCost: 10,  costGrowth: 1.80, max: 100, baseRate: 0.10, unlockD: 0 },
    { id: 'axis2', idx: 2, name: 'Ширина', short: 'II',  icon: 'y',
      baseCost: 40,  costGrowth: 1.85, max: 100, baseRate: 0.08, unlockD: 5 },
    { id: 'axis3', idx: 3, name: 'Высота', short: 'III', icon: 'z',
      baseCost: 160, costGrowth: 1.90, max: 100, baseRate: 0.06, unlockD: 10 },
    { id: 'axis4', idx: 4, name: 'Глубина', short: 'IV', icon: 'd',
      baseCost: 640, costGrowth: 1.95, max: 100, baseRate: 0.05, unlockD: 15 },
    { id: 'axis5', idx: 5, name: 'Время',  short: 'V',   icon: 'clock',
      baseCost: 2.5e3, costGrowth: 2.00, max: 100, baseRate: 0.04, unlockD: 20 },
    { id: 'axis6', idx: 6, name: 'Порядок', short: 'VI', icon: 'sigma',
      baseCost: 1e4, costGrowth: 2.05, max: 100, baseRate: 0.03, unlockD: 25 },
    { id: 'axis7', idx: 7, name: 'Хаос',   short: 'VII', icon: 'sparkle',
      baseCost: 4e4, costGrowth: 2.10, max: 100, baseRate: 0.02, unlockD: 30 },
    { id: 'axis8', idx: 8, name: 'Предел', short: 'VIII', icon: 'star',
      baseCost: 1.6e5, costGrowth: 2.15, max: 100, baseRate: 0.015, unlockD: 35 }
  ],
  boost: { base: 50, growth: 4, max: 20 },
  collapse: {
    minD: 100,
    gainFormula: 'floor(pow(max(0, D - 100) / 10, 0.8) * (1 + 0.1 * collapses))',
    startFormula: '10 + 5 * essence + 20 * lvlLinkStart + 10 * lvlStart'
  },
  upgrades: [
    { id: 'd2_start',   name: 'Стартовая ось',  desc: 'старт D₂ +10·ур.', base: 1, growth: 2.0, max: 10, res: 'essence' },
    { id: 'd2_rate',    name: 'Ускорение осей', desc: 'скорость осей ×1.5^ур.', base: 1, growth: 2.2, max: 8,  res: 'essence' },
    { id: 'd2_xi',      name: 'Плотность Ξ',    desc: 'Ξ ×1.5^ур.', base: 1, growth: 2.4, max: 8,  res: 'essence' },
    { id: 'd2_boost',   name: 'Дешёвый Boost',  desc: 'цена Boost ×0.8^ур.', base: 2, growth: 2.5, max: 6,  res: 'essence' },
    { id: 'd2_collapse',name: 'Глубокий сброс', desc: '⌬ ×1.25^ур.', base: 3, growth: 2.6, max: 6,  res: 'essence' },
    { id: 'd2_soft',    name: 'Плоскость D2',   desc: 'span софткапа ×1.5^ур.', base: 2, growth: 2.3, max: 5, res: 'essence' }
  ],
  links: [
    { id: 'link_start',    name: 'Мост старта',  desc: 'старт D₂ +20·ур.', base: 2, growth: 2.0, max: 5, res: 'essence' },
    { id: 'link_m',        name: 'Отражение M',  desc: 'M D1 ×(1 + 0.05·ур.)', base: 3, growth: 2.3, max: 6, res: 'essence' },
    { id: 'link_xi',       name: 'Течение Ξ',    desc: 'Ξ ×1.25^ур.', base: 2, growth: 2.2, max: 6, res: 'essence' },
    { id: 'link_collapse', name: 'Глубина связи',desc: '⌬ ×1.2^ур.', base: 4, growth: 2.5, max: 4, res: 'essence' }
  ]
};
```

`G.content.groups` получает группу:

```js
{ id: 'd2', name: 'Измерение 2', color: '#ff9de2', world: 'd2',
  mechs: ['d2axes', 'd2collapse', 'd2links', 'd2tree'] }
```

Группы D1 не меняются. `docks.js` фильтрует группы по `world`.

### 5.3. Производство

`src/systems/d2-growth.js`:

```text
lvlSum      = Σ axes[i].lvl
axisRate(i) = axes[i].baseRate
            × (1 + 0.25·lvl_i)
            × (1 + 0.05·amount_{i+1})       // для i=7 множитель 1
            × 2^boost
            × (1 + 0.02·lvlSum)
            × Π link/upgrade-множителей
amount_i   += axisRate(i) · dt
Ξ/с         = axisRate(0) × (1 + 0.02·lvlSum) × Π link/upgrade-множителей
M₂          = Π (1 + amount_i)^0.2
ΔT₂         = max(0.1, 60 / (1 + 0.02·lvlSum))
D₂         += log10(M₂) / ΔT₂ · barrier₂ · dt
N₂          = 10^D₂
barrier₂    = 1 / (1 + pow(max(0, D₂ - 50) / (25·spanMult), 1.5))
```

Ограничения: все `amount_i`, `Ξ` — конечные числа; `N₂` — через `G.BN`; никаких `Infinity/NaN`.
При переполнении `amount_i` — мягкий кламп `1e300` (не «навсегда 0»).

### 5.4. Покупки

- Ось: цена `baseCost_i · costGrowth_i^lvl` в `Ξ`; `max = 100`; массовая покупка `×1/×10/MAX`
  через общий `systems/upgrades.js` **нельзя** (другая валюта/структура) — сделать
  `G.d2Growth.buyAxis(state, i, mode)` с `plan`/`buy`.
- Boost: цена `boost.base · boost.growth^boost` в `Ξ`; `max = 20`; `G.d2Growth.buyBoost(state)`.
- Апгрейды/связи: цена `base · growth^lvl` в `⌬`; `G.d2Collapse.buyUpgrade`,
  `G.d2Links.buyLink`; `scope: 'meta-d2'` (не сбрасываются Схлопыванием).

---

## 6. Схлопывание (престиж D2)

`src/systems/d2-collapse.js`:

```text
gain      = floor(pow(max(0, D₂ - 100)/10, 0.8) · (1 + 0.1·collapses) · collapseMult)
can       = D₂ >= 100
perform   = добавить gain к ⌬; collapses++; bestD = max(bestD, D₂);
            сбросить D₂/N₂/disp, axes[].lvl/amount, Ξ, boost;
            НЕ трогать ⌬, upgrades, links, stats, D1;
            применить старт: D₂ = startFormula, N₂ = 10^D₂
```

`startFormula` использует `essence` (⌬ после начисления), `lvlStart` (`d2_start`),
`lvlLinkStart` (`link_start`). Старт не выше `1e300`.

Кнопка «Схлопнуть» активна только при `can`; после сброса — тост и обновление доски.
Автосхлопывание — не в первом срезе.

---

## 7. Связи D1 ↔ D2

`src/systems/d2-links.js`:

- **D1 → D2:** стартовый бонус `min(50, 2·log10(1 + D1))` цифр к `startFormula`.
- **D2 → D1:** `G.d2Links.d1Mult(state) = 1 + 0.05·lvl(link_m) + 0.01·min(D₂, 1000)`;
  максимум `×11`; применяется как `mult(state)` механики `d2links` к D1 `M`.
  До `state.d2.unlocked` возвращает `1`.
- **D2 → D2:** `link_xi` и `link_collapse` — множители Ξ и ⌬.
- Все связи — `scope: 'meta-d2'`, покупаются за `⌬`, не сбрасываются Схлопыванием.
- Никаких прямых вызовов D1-механик: только общий хук `mult` и `G.d2Links` API.

---

## 8. Древо D2 (первый срез — 16 узлов)

`src/content/d2-tree.js` + `src/mechanics/d2tree/`:

- 4 ветви × 4 узла, `res: 'essence'`, `scope: 'meta-d2'`, тема `d2` (CSS).
- Ветви: **Старт** (start D₂), **Поток** (Ξ/оси), **Сброс** (⌬/collapse), **Связь** (D1↔D2).
- Использовать общий `mechanics/tree/engine.js` (`G.treeBoard.build`) без правок движка.
- Узлы — данные; D2-хуки читаются **общими свипами** `G.growth.upgSum/upgProduct`:
  `d2StartAdd` (сумма к старту D₂), `d2RateMult` (скорость осей), `d2XiMult` (доход Ξ),
  `d2CollapseMult` (⌬ за Схлопывание), `d2SpanMult` (плоскость софткапа).
  `Mmult`/`spanMult` использовать только если их реально читает D1/D2; не дублировать эффект.
- Древо открывается после первого Схлопывания. До этого — locked.

---

## 9. UI/UX

### 9.1. Переключатель мира

- В шапке рядом с настройками: две пилюли `D1` / `D2`; видны только после `unlocked`.
- `G.ui.d2World.set(state, 'd1'|'d2')`:
  - ставит `state.d2.active`;
  - `body.classList.toggle('world-d2', ...)`;
  - пересобирает доки (группы с `world`);
  - выбирает первую доступную доску мира;
  - сохраняет последнюю D1-доску в `state.d2.lastD1Board` (не обязательно в первом срезе).
- `G.ui.d2World.update(state)` обновляет счётчики D2 в шапке; вызывается из `G.ui.app.render`.

### 9.2. Шапка D2

- Второй hero-блок `#heroD2` (создаётся в JS, не в `index.html`):
  `N₂`, `D₂`, `Ξ`, `Ξ/с`, `⌬`, `M₂`.
- В мире D2 `#hero` (D1) скрыт/приглушён, `#heroD2` показан. В D1 — наоборот.
- Мобильный вид: heroD2 переносится, не ломает высоту.

### 9.3. Доски

1. **Оси Ξ** (`d2axes`): 8 карточек (название, ур., amount, rate, цена, кнопка покупки),
   плитки `Ξ`, `Ξ/с`, `D₂`, `M₂`, кнопка Boost, полоса софткапа.
2. **Схлопывание** (`d2collapse`): `D₂`, `⌬`, gain, кнопка, 6 апгрейдов.
3. **Связи** (`d2links`): 4 связи + текущие бонусы D1↔D2.
4. **Древо D2** (`d2tree`): общий движок карты.

Все доски — `mount() -> {update(state)}`, без innerHTML в update, классы `d2-*` для CSS.

---

## 10. Архитектура и контракты

### 10.1. Новые файлы

```
src/systems/d2.js            G.d2: состояние, ensure, unlock, active, resetD2, status
src/systems/d2-growth.js     G.d2Growth: rate/amount/M2/dt/tick/buyAxis/buyBoost
src/systems/d2-collapse.js   G.d2Collapse: gain/can/perform/buyUpgrade
src/systems/d2-links.js      G.d2Links: d1Mult/d2StartBonus/buyLink
src/content/d2.js            данные осей, boost, collapse, upgrades, links
src/content/d2-collapse.js   данные апгрейдов Схлопывания (если не в d2.js)
src/content/d2-links.js      данные связей
src/content/d2-tree.js       дерево D2
src/mechanics/d2axes/{index,board}.js
src/mechanics/d2collapse/{index,board}.js
src/mechanics/d2links/{index,board}.js
src/mechanics/d2tree/{index,board}.js
src/ui/d2-world.js
tools/tests/d2-*.test.js
tools/sim-d2.js              офлайн-симулятор D2 (директор/тесты)
```

`index.html`, `src/main.js`, `tools/verify.js`, `.github/workflows/ci.yml`, `CONTEXT.md`,
`README.md`, `docs/*` — **только директор**. Агенты их не трогают.

### 10.2. Контракты

```js
G.d2.newState()                    // state.d2
G.d2.ensure(state)                 // добавить/мигрировать d2 в старом сейве
G.d2.unlocked(state)               // gate
G.d2.active(state)                 // state.d2.active
G.d2.setActive(state, bool)
G.d2.D(state) / N(state) / rate(state)
G.d2.resetD2(state)                // сброс только D2 (Схлопывание)
G.d2.status(state)                 // строка для бейджа дока

G.d2Growth.axisRate(state, i)
G.d2Growth.xiRate(state)
G.d2Growth.M2(state)
G.d2Growth.dt(state)
G.d2Growth.barrier(state, d)
G.d2Growth.tick(state, dt)
G.d2Growth.axisCost(state, i, lvl)
G.d2Growth.buyAxis(state, i, mode) // '1'|'10'|'max'
G.d2Growth.boostCost(state)
G.d2Growth.buyBoost(state)

G.d2Collapse.gain(state)
G.d2Collapse.can(state)
G.d2Collapse.perform(state)
G.d2Collapse.startD2(state)
G.d2Collapse.upgradeCost(state, id)
G.d2Collapse.buyUpgrade(state, id)

G.d2Links.d1Mult(state)            // 1, если D2 закрыт
G.d2Links.d2StartBonus(state)
G.d2Links.linkCost(state, id)
G.d2Links.buyLink(state, id)

// D2-tree: данные узлов читаются общими свипами в d2-growth/d2-collapse:
// d2StartAdd (upgSum), d2RateMult/d2XiMult/d2CollapseMult/d2SpanMult (upgProduct).

G.ui.d2World.init(state)
G.ui.d2World.set(state, 'd1'|'d2')
G.ui.d2World.update(state)
```

Все системы читают только `state`, `G.content.d2`, `G.BN`, `G.formula`. Никаких DOM.
Механики только регистрируются в реестре и отдают `mult`/`status`/`vars`; доски — UI.

### 10.3. Сбросы

- D1 `resetScopes` **не трогает** `state.d2`.
- D2 `G.d2.resetD2(state)` сбрасывает только D2-поля; `⌬`, upgrades, links, stats — остаются.
- `scope: 'meta-d2'` — новый строковый scope для D2-апгрейдов/связей/дерева; он не входит
  в `G.resetScopes` D1 и не должен случайно сбрасываться.

### 10.4. Сейв

- `G.SAVE_VERSION = 3`.
- `serialize` включает `d2: state.d2` (снимок, не ссылку).
- `deserialize`/`migrate`: старый сейв v2 получает `state.d2 = G.d2.newState()`.
- `G.d2.ensure(state)` вызывается в `G.applyState`/`main.boot` и после импорта.
- Экспорт/импорт строкой сохраняет D2.
- Оффлайн D2 — **не в первом срезе** (D1-оффлайн не ломаем).

---

## 11. Баланс первого среза

Ориентиры (проверить `tools/sim-d2.js` и плейтестом):

- первый вход в D2 → первое Схлопывание: **10–20 минут** игры в D2;
- после Схлопывания следующий D₂=100 — заметно быстрее;
- D2 не ускоряет D1 больше чем ×2 на первом Схлопывании;
- D1 не даёт D2 старт выше 50 цифр;
- нет `Infinity/NaN`, нет «замерло навсегда»;
- старый сейв v2 открывается без потерь.

Числа в данных — стартовые; после первого симулятора их можно двигать только данными.

---

## 12. Тесты и приёмка

Каждый агент добавляет свой тест в `tools/tests/d2-*.test.js` (Node `vm` без DOM, где можно;
jsdom — для досок/переключателя). Директор после слияния добавляет скрипты в `index.html`
и jobs в `tools/verify.js`.

Обязательные проверки:

1. `node tools/checkall.js` — синтаксис/подключения.
2. `node tools/checkcontent.js` — старый контент не сломан.
3. `node tools/unit.js` — ядро.
4. `node tools/tests/d2-*.test.js` — новые тесты.
5. `PERF_MS=40 node tools/domtest.js` — старый UI не сломан.
6. `node tools/sim.js 160 900` — D1-баланс не поехал.
7. `node tools/sim-d2.js` — время до первого Схлопывания и динамика.
8. `git diff --check`.

---

## 13. Разбиение на 9 задач (first slice)

| # | Ключ | Цель | Файлы (только владелец) |
|---|---|---|---|
| 1 | `d2-state` | `state.d2`, unlock, active, save v3/миграция | `src/systems/d2.js`, `src/systems/state.js`, `src/systems/save.js`, `tools/tests/d2-state.test.js` |
| 2 | `d2-content` | данные 8 осей, boost, collapse, upgrades, links, группа d2 | `src/content/d2.js`, `src/content/groups.js`, `tools/tests/d2-content.test.js` |
| 3 | `d2-growth` | производство осей, Ξ, M₂, D₂, софткап, покупки осей/boost | `src/systems/d2-growth.js`, `tools/tests/d2-growth.test.js` |
| 4 | `d2-collapse` | Схлопывание, ⌬, старт, апгрейды | `src/systems/d2-collapse.js`, `src/content/d2-collapse.js`, `tools/tests/d2-collapse.test.js` |
| 5 | `d2-links` | D1↔D2 бонусы, 4 связи | `src/systems/d2-links.js`, `src/content/d2-links.js`, `tools/tests/d2-links.test.js` |
| 6 | `d2-world` | переключатель D1/D2, фильтр доков, D2 hero, CSS | `src/ui/d2-world.js`, `src/ui/docks.js`, `src/ui/app.js`, `assets/css/style.css`, `tools/tests/d2-world.test.js` |
| 7 | `d2-axes-board` | доска 8 осей, Boost, плитки | `src/mechanics/d2axes/index.js`, `board.js`, `tools/tests/d2-axes-board.test.js` |
| 8 | `d2-boards` | доски Схлопывания и Связей | `src/mechanics/d2collapse/{index,board}.js`, `src/mechanics/d2links/{index,board}.js`, `tools/tests/d2-boards.test.js` |
| 9 | `d2-tree` | дерево D2 16 узлов на общем движке | `src/content/d2-tree.js`, `src/mechanics/d2tree/{index,board}.js`, `tools/tests/d2-tree.test.js` |

Директор: `index.html`, `src/main.js`, `src/content/achievements.js`, `tools/verify.js`,
CI, `package.json`, `CONTEXT.md`, `README.md`, `docs/*`, `tools/sim-d2.js`, финальная сборка.

---

## 14. Не входит в первый срез

- Hall of Celestials / целестиалы, боссы, рейды.
- Мультивселенная-карта миров, D3+.
- Оффлайн D2, облако D2.
- Отдельные D2-достижения и секреты (добавим после стабилизации).
- Чужие ассеты/музыка/тексты.
- Автосхлопывание, автопокупка D2 (сначала ручная, потом автоматизация).
