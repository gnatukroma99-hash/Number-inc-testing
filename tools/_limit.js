'use strict';
/* tools/_limit.js — сторожевой таймер, чтобы инструмент НИКОГДА не висел.
   Подключается первой строкой в bench/sim/domtest/shot/checkall:
       require('./_limit')(300);   // лимит в секундах
   Перебивается переменной окружения TOOL_LIMIT (в секундах).
   По истечении — печатает строку и выходит с кодом 3, чтобы агент увидел «завис» сразу. */
module.exports = function limit(sec) {
  const s = Number(process.env.TOOL_LIMIT || 0) || sec || 600;
  const t = setTimeout(() => {
    console.error('watchdog: лимит ' + s + ' с истёк — принудительный выход');
    process.exit(3);
  }, s * 1000);
  if (t.unref) t.unref();
  return t;
};
