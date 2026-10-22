---
name: game-ui-motion
description: "Ванильные CSS/JS-анимации для браузерной игры без фреймворков: токены движения, кривые, длительности, stagger-входы, hover/press, тосты, модалки, 60 fps и prefers-reduced-motion. Для проектов на чистом HTML+CSS+IIFE (как «ЧИСЛО»)."
---

# Движение в интерфейсе без фреймворков

Скилл для игр/приложений на чистом HTML/CSS/JS. Источник принципов: Material Motion, web.dev
(animations guide), Motion/Framer Motion docs, Apple HIG (motion), референсы инкременталок
(Antimatter Dimensions, Cookie Clicker, NGU Idle, The Prettier Tree).

## 1. Токены движения (обязательно первым делом)

Завести переменные и больше не писать «магические» 0.2s/ease в правилах:

```css
:root{
  --t-fast: 120ms;  --t-base: 200ms;  --t-slow: 320ms;  --t-enter: 420ms;
  --e-out: cubic-bezier(.22,1,.36,1);        /* вход: быстрый старт, мягкий хвост */
  --e-in: cubic-bezier(.4,0,1,1);            /* выход */
  --e-spring: cubic-bezier(.34,1.56,.64,1);  /* «пружина» для попов/тостов */
  --e-inout: cubic-bezier(.65,0,.35,1);
}
```

Правила:

1. **Длительность по весу**: hover/press — 120 мс, смена состояния — 200 мс, вход панели — 320 мс,
   большой экран/тост/модалка — до 420 мс. Больше 500 мс в UI — почти всегда ошибка.
2. **Вход длиннее выхода**: появление 320 мс, исчезновение 160–200 мс.
3. **Одна метафора**: если появление «снизу вверх» — везде снизу вверх, не мешать направления.
4. **Смещение при входе** 8–16 px, не больше: 40 px выглядит как баг.

## 2. Что анимировать (и что нельзя)

| Можно (GPU) | Нельзя (layout/paint, дёргается) |
|---|---|
| `transform: translate/scale/rotate` | `top/left/width/height/margin/padding` |
| `opacity` | `box-shadow` (в больших списках), `filter: blur` в цикле |
| `filter` короткими вспышками | `background-position` в длинных списках |

- `will-change` — только на время анимации (класс добавляем/снимаем), иначе съест память.
- Любая анимация > 200 мс в списке карточек — повод анимировать только `transform`/`opacity`.
- Никаких `setInterval`-анимаций: только CSS или `requestAnimationFrame`.

## 3. Вход доски/экрана: stagger

```css
.board-body > * { animation: enterUp var(--t-enter) var(--e-out) both; }
.board-body > *:nth-child(1){ animation-delay: 0ms }
.board-body > *:nth-child(2){ animation-delay: 40ms }
/* … шаг 40 мс, максимум 6 элементов (дальше не заметно) */
@keyframes enterUp { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform:none } }
```

- Шаг 30–50 мс; больше 6 шагов не нужно — суммарно не длиннее 420 мс.
- Если контент подгружается позже (карточки в списке), проще одна анимация контейнера.

## 4. Нажатие и наведение

```css
.btn, .upg-buy { transition: transform var(--t-fast) var(--e-out), border-color var(--t-fast), background-color var(--t-fast); }
.btn:hover { border-color: var(--accent) }
.btn:active { transform: scale(.97) }
```

- Нажатие — `scale(.97)`, отпускание — назад (сама transition сделает).
- **Ripple** делать только для больших кнопок (делегированный `pointerdown` → span → `animationend` удалить).
- Для «дорогих» покупок — вспышка `box-shadow` 1 раз (а не постоянное свечение).
- Отключённая кнопка: `opacity .45` + `cursor: default`, без hover-эффектов.

## 5. Уведомления (тосты)

- Появление: `translateY(16px) + scale(.96)` → `none`, кривая `--e-spring`, 260 мс.
- Исчезновение: `opacity 0 + translateX(12px)`, 180 мс.
- Стак: новые сверху/снизу, но не «прыгают» — фиксированный угол, `pointer-events:none` на контейнере.
- Не больше 4 на экране; длительность 2.5–4 с; важные (джекпот, достижение) — 4–5 с.

## 6. Модалки и оверлеи

```
backdrop: opacity 0 → .55, 180–220 мс
panel:    translateY(12px) + scale(.98) → none, 240–300 мс, --e-out
закрытие — быстрее и без scale(.98) (не «сжимать» экран)
```

- Фокус переводить в модалку, `Escape` — закрыть, `body` не скроллится.
- Фон под модалкой — `backdrop-filter: blur(6px)` только если открывается редко.

## 7. Числа и прогресс

- **Не анимировать текст числа** через CSS transition (невозможно). Вместо этого:
  короткий `keyframes` «bump» (`scale 1.04 → 1`) при изменении значения — 180–260 мс.
- Прогресс-бары: `width` меняется мгновенно, но с `transition: width 200ms linear` на внутреннем
  элементе — это допустимо (один элемент, не список).
- Счётчики ресурсов: bump + короткая подсветка при росте, **без** анимации при падении.

## 8. Игровые события (активный контент)

- «Поймай»-элементы: вход `scale(.6)+opacity 0` → `1` c `--e-spring` (320 мс), пульс `scale 1↔1.03`
  1.2–1.8 с `ease-in-out infinite`, исчезновение — быстрый `scale(.8)+opacity 0` (160 мс).
- Поймал → «pop» (scale 1 → 1.12 → 1, 280 мс) + тост. Не совмещать pop и пульс на одном элементе.
- Редкое событие должно **выглядеть** редким: свечение/цвет, а не просто ещё одна кнопка.

## 9. Доступность и производительность

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
body.no-anim *, body.no-anim *::before, body.no-anim *::after {
  animation: none !important; transition: none !important;
}
```

- Настройка «выключить анимации» в игре должна гасить **всё**, включая пульсы и тряску.
- Не анимировать больше 3–4 элементов одновременно; stagger вместо «всё сразу».
- После правок проверять на телефоне (там же и 30 fps реальность), и `Performance` — не должно быть
  layout thrash (`getBoundingClientRect` в цикле анимации).

## 10. Чек-лист перед выпуском

1. Все длительности/кривые — из токенов.
2. Вход доски — stagger, не дольше 420 мс суммарно.
3. `:active` есть у каждой кликабельной штуки.
4. Тосты появляются «пружиной», исчезают быстрее появления.
5. Модалка: backdrop + spring-панель + Escape + блокировка скролла.
6. `prefers-reduced-motion` и `body.no-anim` гасят всё.
7. Нет анимаций `width/height/top/left` в списках.
8. Проверено на телефоне и в CI-прогоне (`domtest`), ошибок в консоли нет.
