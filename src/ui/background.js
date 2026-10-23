/* ui/background.js — живой фон: звёздное поле на canvas (v0.21.0).
   Дёшево по CPU: ~90 звёзд, кадр не чаще 30 Гц, пауза в скрытой вкладке и при выключенных анимациях.
   Скорость дрейфа и яркость мягко зависят от прогресса (D), поэтому фон «дышит» вместе с числом. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  const MAX_STARS = 110;
  const MAX_STARS_MOBILE = 55;

  let canvas = null;
  let ctx = null;
  let stars = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let speed = 1;
  let glow = 0.5;
  let inited = false;

  /* canvas есть не везде (jsdom, старые браузеры) — тогда фон просто не рисуем */
  function canUseCanvas() {
    if (typeof document === 'undefined' || !document.createElement) return false;
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/jsdom/i.test(ua)) return false;
    try {
      const c = document.createElement('canvas');
      return typeof c.getContext === 'function';
    } catch (e) { return false; }
  }

  function isMobile() {
    return (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches) ||
      (typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent || ''));
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    const n = isMobile() ? MAX_STARS_MOBILE : MAX_STARS;
    stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.25 + Math.random() * 0.75,      /* глубина: ближние ярче и быстрее */
        s: 0.6 + Math.random() * 1.6,
        tw: Math.random() * Math.PI * 2       /* фаза мерцания */
      });
    }
  }

  function draw(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    /* мягкая туманность — два радиальных пятна, без фильтров */
    const g1 = ctx.createRadialGradient(w * 0.5, -h * 0.15, 0, w * 0.5, -h * 0.15, h * 0.9);
    g1.addColorStop(0, 'rgba(43,181,255,' + (0.10 * glow).toFixed(3) + ')');
    g1.addColorStop(1, 'rgba(43,181,255,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      st.tw += 0.008 * (0.5 + st.z) * speed;
      const tw = 0.55 + 0.45 * Math.sin(st.tw);
      const a = (0.18 + 0.55 * st.z) * tw * (0.6 + 0.4 * glow);
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = st.z > 0.7 ? '#eaf7ff' : (st.z > 0.45 ? '#9fd8ff' : '#5c7f96');
      const size = st.s * st.z;
      ctx.fillRect(st.x, st.y, size, size);

      /* дрейф вниз-влево: дешёвый «полёт» через пространство */
      st.y += 0.06 * st.z * speed;
      st.x -= 0.02 * st.z * speed;
      if (st.y > h + 4) { st.y = -4; st.x = Math.random() * w; }
      if (st.x < -4) st.x = w + 4;
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = 0;
    if (!canvas) return;
    const dt = now - last;
    if (dt < 33) {                      /* не чаще 30 Гц: на телефоне это важно */
      raf = requestAnimationFrame(loop);
      return;
    }
    last = now;
    if (G.state && !off()) {
      const d = G.growth.D(G.state);
      speed = 1 + Math.min(2.5, d / 120);
      glow = Math.min(1, 0.35 + d / 400);
    }
    draw(now);
    if (!off()) raf = requestAnimationFrame(loop);
  }

  function off() {
    if (typeof G.animationsOff === 'function' && G.animationsOff()) return true;
    return document.hidden === true;
  }

  const B = {
    mount() {
      if (inited) return;
      inited = true;
      if (!canUseCanvas()) return;
      canvas = G.h('canvas', { class: 'bg-stars', 'aria-hidden': 'true' });
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resize();
      seed();
      window.addEventListener('resize', () => { resize(); seed(); }, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !raf) { last = 0; raf = requestAnimationFrame(loop); }
      });
      raf = requestAnimationFrame(loop);
    },

    /* перезапуск после выключения анимаций в настройках */
    refresh() {
      if (!canvas) return;
      if (off()) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (ctx) ctx.clearRect(0, 0, w, h);
      } else if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    },

    stars() { return stars.length; }
  };

  G.ui.background = B;
})(window.G = window.G || {});
