/* ui/fx.js — общие «сочные» эффекты действий (v0.25.0).
   Всё через CSS-классы, без библиотек; при выключенных анимациях — молчит.
   API: pop(el, text) · flash(color) · shake() · banner(text) · chrono(on) */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  function off() {
    return typeof G.animationsOff === 'function' && G.animationsOff();
  }

  /* настройка «всплывающие подписи на экране» (settings.fxPops):
     выключена — уведомления (узоры мантиссы, «+1 ур.», «⧉») на экран не лезут,
     сами механики работают как обычно. */
  function notices() {
    const s = G.state && G.state.settings;
    return !s || s.fxPops !== false;
  }

  function once(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms || 800);
  }

  const F = {
    /* всплывающий текст над элементом (покупка, выигрыш) */
    pop(el, text) {
      if (off() || !notices() || !el) return;
      const r = el.getBoundingClientRect();
      /* если у элемента нет размеров (скрыт/ещё не отрисован) — показываем по центру */
      const has = (r.width > 0 || r.height > 0);
      const node = G.h('div', { class: 'fx-pop', text: text });
      node.style.left = (has ? r.left + r.width / 2 : window.innerWidth / 2) + 'px';
      node.style.top = (has ? r.top + r.height * 0.28 : window.innerHeight * 0.32) + 'px';
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 820);
    },

    /* вспышка экрана */
    flash(color) {
      if (off()) return;
      const node = G.h('div', { class: 'fx-flash' });
      if (color) node.style.setProperty('--flash', color);
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 560);
    },

    /* тряска интерфейса на большом событии */
    shake(el) {
      if (off()) return;
      once(el || document.getElementById('app'), 'fx-shake', 460);
    },

    /* баннер события (испытание, ПРОБОЙ, джекпот) */
    banner(text, color) {
      if (off() || !text) return;
      const node = G.h('div', { class: 'fx-banner', text: text });
      if (color) node.style.setProperty('--mech', color);
      document.body.appendChild(node);
      setTimeout(() => node.remove(), 1900);
    },

    /* режим «сжатия времени» — винетка + линии, пока хроно активно */
    chrono(on) {
      document.body.classList.toggle('fx-chrono', !!on && !off());
    },

    /* обвязка: эффекты на игровые события (подписывается один раз) */
    init() {
      if (F.inited) return;
      F.inited = true;

      /* покупка апгрейда: «+1 ур.» над строкой */
      G.bus.on('upgrade:bought', (e) => {
        if (off() || !e || !e.id) return;
        const row = document.querySelector('.upg[data-upgrade="' + e.id + '"] .upg-buy');
        const u = G.registry.upgrade(e.id);
        const lvl = G.lvl(G.state, e.id);
        F.pop(row, (u && u.fmt === 'x' ? '' : '+') + (e.count > 1 ? '×' + e.count : 'ур.' + lvl));
      });

      /* джекпот автомата — золотая вспышка и баннер */
      G.bus.on('duplicator:merge', () => F.pop(document.getElementById('heroN'), '⧉'));
      G.bus.on('bigbang:done', () => { F.flash('rgba(255, 209, 102, .55)'); F.shake(); F.banner('💥 БОЛЬШОЙ БУМ'); });
      G.bus.on('breakthrough:done', () => { F.flash('rgba(255, 95, 210, .55)'); F.shake(); F.banner('Ψ ПРОБОЙ'); });
      G.bus.on('rift:open', () => F.banner('⌁⃠ РАЗЛОМ ОТКРЫТ', '#ff9de2'));
      G.bus.on('chrono:start', () => { F.chrono(true); F.banner('⏱ СЖАТИЕ ВРЕМЕНИ', '#818cf8'); });
      G.bus.on('challenge:start', (e) => {
        const c = G.challenges.find(e && e.id);
        F.banner('⚑ ' + (c ? c.name : 'ИСПЫТАНИЕ') + ' · до ' + (c ? c.goal : '?') + ' цифр', '#e879f9');
      });
      G.bus.on('challenge:done', () => { F.flash('rgba(232, 121, 249, .45)'); F.shake(); F.banner('⚑ ИСПЫТАНИЕ ПРОЙДЕНО'); });
      /* узор мантиссы: цифры всплывают над числом, первый раз — баннер */
      G.bus.on('pattern:found', (e) => {
        if (!e || !notices()) return;
        F.pop(document.getElementById('heroN'), e.text || '');
        if (e.first) { F.flash('rgba(163, 230, 53, .32)'); F.banner((e.name || 'УЗОР') + ' · ' + e.text, e.color || '#a3e635'); }
      });
    },

    /* на каждом кадре: гасим винетку, когда хроно закончилось */
    update(state) {
      if (!G.chrono || !state) return;
      F.chrono(G.chrono.left(state) > 0);
    }
  };

  G.ui.fx = F;
})(window.G = window.G || {});
