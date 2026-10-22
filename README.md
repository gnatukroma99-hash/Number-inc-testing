# Telegram-бот (remote listener)

Управление ПК с телефона через Telegram: приоритеты процессов, Excel, Chrome и т.п.
Жил в репозитории [Number-inc-testing](https://github.com/gnatukroma99-hash/Number-inc-testing)
вместе с игрой и в v0.12.6 вынесен в эту ветку — как затравка отдельного репозитория.

## Файлы

| Файл | Что внутри |
|---|---|
| `bot.py` | бот на `python-telegram-bot`: `_set_excel_priority`, `_set_chrome_priority`, psutil-команды |
| `remote_listener.spec` | PyInstaller-спек для сборки одного `.exe` |

## Запуск

```bash
pip install python-telegram-bot psutil
export BOT_TOKEN="..."        # Windows: set BOT_TOKEN=...
python bot.py
```

Сборка в exe: `pyinstaller remote_listener.spec`

## ⚠️ Токен

В исходной истории репозитория игры (`5f31323`, v0.1.1) `BOT_TOKEN` лежал **открытым текстом**
в публичном репозитории. Здесь он читается из окружения, но:

1. **Старый токен нужно перевыпустить** — `@BotFather` → `/revoke`.
2. Из истории git игры он не исчезает (чистка истории — отдельное решение).
3. Никогда не коммитить токен: только `os.environ`.

## Сделать из этой ветки отдельный репозиторий

```bash
git clone https://github.com/gnatukroma99-hash/Number-inc-testing.git bot
cd bot
git checkout bot
git remote set-url origin https://github.com/<ник>/<новый-репо>.git
git push -u origin bot:main
```
