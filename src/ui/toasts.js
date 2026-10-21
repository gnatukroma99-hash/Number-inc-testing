/* ui/toasts.js — всплывающие сообщения. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};
  const root = () => document.getElementById('toasts');

  function toast(text, kind, ms) {
    const el = G.h('div', { class: 'toast ' + (kind || '') , text: text });
    const r = root();
    if (!r) return;
    r.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, ms || 3200);
    /* не даём тостам разрастаться */
    while (r.children.length > 4) r.removeChild(r.firstChild);
  }

  G.ui.toast = toast;

  /* подписки на игровые события */
  /* Достижения — попап-награда (как в инкременталках). Обычные тики ❖ не спамим:
     прогресс виден на доске ПРАЙМ. */
  G.bus.on('achievement:unlocked', (a) => {
    toast('🏆 ' + a.name + ' · ' + (a.desc || '') + ' · +1% к M', 'ach', 4200);
  });

  G.bus.on('mechanic:unlocked', (e) => {
    toast('Открыта доска: ' + e.name, 'accent');
  });

  G.bus.on('state:reset', () => toast('Состояние сброшено', 'warn'));
})(window.G = window.G || {});
