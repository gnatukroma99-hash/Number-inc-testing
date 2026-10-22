# AdBlock Plus Custom — MV3-расширение

Расширение Chrome/Edge (Manifest V3) на `declarativeNetRequest`. Жило в репозитории
[Number-inc-testing](https://github.com/gnatukroma99-hash/Number-inc-testing) вместе с игрой
и в v0.12.6 вынесено в эту ветку — как затравка отдельного репозитория.

## Файлы

| Файл | Что внутри |
|---|---|
| `manifest.json` | MV3-манифест: `declarativeNetRequest`, `scripting`, `activeTab`, `host_permissions: <all_urls>` |
| `rules.json` | статический набор DNR-правил (~356 КБ) |
| `_metadata/generated_indexed_rulesets/_ruleset1` | сгенерированный индекс правил (создаёт Chrome при загрузке) |
| `abp-background.js` | service worker: установка, обновление вкладок, счётчики блокировок |
| `background.js` | ранний вариант того же воркера (оставлен как есть) |
| `content.js` | content-script в `world: MAIN`, `run_at: document_start`, все фреймы |
| `scriptlets.js` | scriptlet-инъекции (анти-адблок-детект и т.п.) |
| `IndexedDB.js` | кэш `AdBlockerCacheDB` для быстрых проверок |
| `build.ps1` | сборка списка домены → `rules.json` (PowerShell) |
| `validate.ps1` | проверка `rules.json` на дубли `id` |
| `.agents/rules/mv3-adblocker.md` | памятка агенту: как довести расширение до 100 % в adblock-тестах |

## Как поставить (unpacked)

1. `chrome://extensions` → **Developer mode**.
2. **Load unpacked** → выбрать папку с `manifest.json`.
3. Проверить: `adblock-tester.com`, `d3ward.github.io/toolz/adblock`, `turtlecute.org/block_ads_test`.

## Сделать из этой ветки отдельный репозиторий

```bash
git clone https://github.com/gnatukroma99-hash/Number-inc-testing.git adblock
cd adblock
git checkout adblock
git remote set-url origin https://github.com/<ник>/<новый-репо>.git
git push -u origin adblock:main
```

## История

- v0.1.1 — расширение попалo в репозиторий игры вместе с первым коммитом (`5f31323`).
- v0.12.6 игры — вынесено в ветку `adblock`, из `main` удалено (12 файлов, ~410 КБ).
