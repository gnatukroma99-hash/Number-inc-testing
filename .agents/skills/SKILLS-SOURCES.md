# Откуда взяты скиллы

Источник: https://github.com/Aver005/agent-skills (сборник скиллов, Agent Skills spec).

| Скилл | Зачем в проекте «ЧИСЛО» |
|---|---|
| `ui-design` | правила UI/UX (доступность, контраст, раскладка) — у нас ручной HTML/CSS |
| `frontend-design` | «не как у ИИ» внешний вид; лицензия: `frontend-design/LICENSE.txt` |
| `web-design-guidelines` | быстрый аудит вёрстки по Web Interface Guidelines |
| `responsive-design` | мобильная раскладка (дерево, доски, тулбары) |
| `code-review` | разбор диффа перед выпуском версии |
| `refactor` | каталог Фаулера: разбиение длинных файлов (§3.4 «>250 строк — повод разбить») |
| `changelog-automation` | Keep a Changelog + версии (`VERSION`, `?v=`, `docs/CHANGELOG.md`) |
| `design-system-patterns` | токены/шкалы/слои — основа CSS-рефакторинга (сессия №22) |

Не ставили: React/Next/Tailwind/Capacitor/Ionic/Python/NestJS-скиллы — в проекте их нет;
`skill-creator` — не нужен (решение юзера, сессия №8).
`ponytail*` — наши, отдельно (MIT, `PONYTAIL-LICENSE`).

Правки при установке: у `code-review` поле `argument-hint` перенесено в `metadata`
(в спеке такого ключа нет) и убрана ссылка на отсутствующий `CONNECTORS.md`.

## Добавлено сессией №22 (по запросу юзера «UI на уровне»)

| Скилл | Источник | Зачем |
|---|---|---|
| `design-system-patterns` | Aver005/agent-skills | дизайн-токены и системность в CSS |
| `game-ui-motion` | **свой** (свод правил) | в источнике был только React-скилл `motion` (Framer Motion) — для vanilla он бесполезен, поэтому правила движения собраны вручную: токены, кривые, stagger, hover/press, тосты, модалки, reduced-motion |

Скилл `motion` **не ставим**: он про React + пакет `motion`, у нас классические скрипты и чистый CSS.
