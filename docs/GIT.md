# GIT — версионирование и публикация

Всё делается двумя `.bat` файлами в корне проекта. Git должен быть установлен
(**Git for Windows**: https://git-scm.com/download/win — он же даёт `bash`, после этого агент сможет запускать команды).

---

## 0. Если `.bat` закрывается сразу или не работает

**Вариант 1 (самый надёжный) — PowerShell вручную.**
Нажми `Win + X` → **Терминал** (или PowerShell), затем построчно вставь:

```powershell
cd "C:\Users\HomePC\Desktop\my adblock"
git --version
git config --global user.name "Твой Ник"
git config --global user.email "твой@email"
git init
git branch -M main
git add -A
git commit -m "v0.1.1 - первый коммит"
git remote add origin https://github.com/ТВОЙ_НИК/ИМЯ_РЕПО.git
git push -u origin main
```

Сообщения об ошибках видно полностью — легко починить.

**Вариант 2 — открыть `.bat` как текст и запустить вручную.**
Правый клик → «Изменить» — прочитать, что там, и повторить в терминале.

**Вариант 3 — GitHub Desktop.** Скачать, `File → Add local repository` → выбрать папку → Publish repository.
Никаких консолей вообще.

Почему `.bat` мог упасть: скобки `(` `)` внутри подсказок `set /p`, не-ASCII символы,
либо отсутствие Git. Текущие версии скриптов очищены от скобок и запускаются через `cmd /k`,
так что окно больше не должно исчезать.

---

## 1. Первый раз — `PUBLISH_SETUP.bat`

1. На GitHub: **New repository** → имя → **не** добавляй README/.gitignore → **Create**.
2. Двойной клик по `PUBLISH_SETUP.bat`.
3. Ввести: имя, e-mail (если git ещё не настроен), **GitHub username**, **имя репозитория**.
4. Скрипт сам: `git init` → `add` → `commit` → `remote add` → `push -u origin main`.

После этого репозиторий живой: `https://github.com/<username>/<repo>`

## 2. Каждая новая версия — `PUSH_VERSION.bat`

Перед публикацией (это же делает агент, но проверяй):
1. Обновить `VERSION` (например `0.1.2`).
2. Добавить запись в `docs/CHANGELOG.md`.
3. Запустить `PUSH_VERSION.bat` → спросит комментарий → сделает коммит, тег `v0.1.2` и запушит.

## 3. Посмотреть состояние — `GIT_STATUS.bat`

Показывает `status`, последние 10 коммитов, теги версий и remote.

## 4. Онлайн-версия (GitHub Pages)

Settings → Pages → Source: **Deploy from a branch** → Branch: **main** / **root** → Save.

Игра откроется по адресу `https://<username>.github.io/<repo>/`

⚠️ Если ты запускал `MOVE_TO_GAME.bat`, `index.html` лежит в `game/` — тогда адрес
`https://<username>.github.io/<repo>/game/`. Проще **не** переносить в `game/`, пока не настроен Pages.

⚠️ GitHub Pages **не поддерживает `localStorage` одинаково** — сейв работает, но облачный Gist лучше проверять локально.

## 5. Что коммитится, а что нет

`.gitignore` исключает: системный мусор, `.vscode/`, `node_modules/`, логи, локальные сейвы
(`chislo-save*.json`), `.env`, `refs/` (склонированные референсы).

**Токен GitHub НЕ попадает в репозиторий** — он живёт только в `localStorage` браузера
(ключи `chislo_gh_token` / `chislo_gh_gist`).

## 6. Альтернативы, если `.bat` не нравится

| Способ | Как |
|---|---|
| **GitHub Desktop** | Add local repository → каждый раз Commit + Push в два клика |
| **gh CLI** | `gh repo create <имя> --private --source=. --push` |
| **VS Code** | вкладка Source Control → Commit → Sync |
| **Вручную** | `git add -A && git commit -m "..." && git tag v0.1.2 && git push && git push --tags` |

## 7. Модель версий

Семантическая, но с поправкой на игру:

- `0.x.0` — новая механика/ярус (контент)
- `0.x.y` — баланс, баги, косметика
- `1.0.0` — Ярус 1 стабилен: 20 механик, перерождения, автоматизация, ачивки

Каждая версия = тег в git + запись в `CHANGELOG.md` + строка в `VERSION`.
