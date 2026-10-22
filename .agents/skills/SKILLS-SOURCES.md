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

Не ставили: React/Next/Tailwind/Capacitor/Ionic/Python/NestJS-скиллы — в проекте их нет;
`skill-creator` — не нужен (решение юзера, сессия №8).
`ponytail*` — наши, отдельно (MIT, `PONYTAIL-LICENSE`).

Правки при установке: у `code-review` поле `argument-hint` перенесено в `metadata`
(в спеке такого ключа нет) и убрана ссылка на отсутствующий `CONNECTORS.md`.
