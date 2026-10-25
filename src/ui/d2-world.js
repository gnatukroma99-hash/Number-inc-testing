/* ui/d2-world.js — переключатель миров D1 | D2, шапка D2 и пересборка доков.
   ТЗ: docs/DIMENSION2.md §9.1 (переключатель), §9.2 (шапка D2).
   Зачем: D2 — второй мир со своим числом N₂, осями Ξ и эссенцией ⌬. Шапка и доки
   показывают либо цифры D1, либо D2, но никогда оба мира сразу.
   Здесь нет ни одной формулы: значения читаются из G.d2 / G.d2Growth, а какие доски
   показывать — решает ui/docks.js (он знает про поле `world` у групп).
   Шапку и пилюли строим в JS: index.html правит только директор. */
(function (G) {
  'use strict';

  G.ui = G.ui || {};

  const WORLD_D1 = 'd1';
  const WORLD_D2 = 'd2';

  let lastState = null;
  let switchEl = null;
  let pills = {};          // 'd1' | 'd2' -> button
  let heroEl = null;
  let refs = {};
  let shown = WORLD_D1;    // какой мир уже применён к DOM
  let ready = false;

  /* ---------- мир и гейт (источник правды — docks: он же фильтрует группы) ---------- */
  function open(state) {
    if (G.ui.docks && typeof G.ui.docks.d2Open === 'function') return !!G.ui.docks.d2Open(state);
    return !!(state && state.d2 && state.d2.unlocked);
  }

  function worldOf(state) {
    if (G.ui.docks && typeof G.ui.docks.world === 'function') return G.ui.docks.world(state);
    return (state && state.d2 && state.d2.active && open(state)) ? WORLD_D2 : WORLD_D1;
  }

  /* ---------- чтение чисел D2 без жёсткой зависимости от его систем ---------- */
  /* вызвать метод D2-системы, если он есть; ошибка = запасное значение.
     Так шапка не ломает render(), пока D2-системы ещё не собраны. */
  function probe(owner, method, state, fallback) {
    const o = G[owner];
    if (!o || typeof o[method] !== 'function') return fallback;
    try {
      const v = o[method](state);
      return (v === undefined || v === null) ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function num(v, fallback) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!isFinite(n)) return (fallback === undefined ? 0 : fallback);
    return n;
  }

  function values(state) {
    const s = state && state.d2;
    const mode = (state && state.settings && state.settings.numberFormat) || 'short';
    const own = (s && G.BN.isValid(s.N)) ? s.N : null;
    const fromSystem = own || probe('d2', 'N', state, null);
    return {
      mode: mode,
      N: G.BN.isValid(fromSystem) ? fromSystem : G.BN.one(),
      D: num(probe('d2', 'D', state, s ? s.D : 0)),
      xi: num(s && s.res ? s.res.axis : 0),
      xiRate: num(probe('d2Growth', 'xiRate', state, probe('d2', 'rate', state, 0))),
      essence: num(s && s.res ? s.res.essence : 0),
      m2: num(probe('d2Growth', 'M2', state, 1), 1)
    };
  }

  /* ---------- DOM: пилюли D1|D2 и heroD2 ---------- */
  function pill(world, label, title) {
    const btn = G.h('button', {
      class: 'd2-world-pill', type: 'button', title: title,
      dataset: { world: world }, text: label
    });
    btn.addEventListener('click', () => {
      const s = G.state || lastState;
      if (!s || worldOf(s) === world) return;
      D.set(s, world);
      G.ui.toast(world === WORLD_D2 ? 'Измерение 2 · оси Ξ' : 'Мир цифр D1', 'accent', 1600);
    });
    pills[world] = btn;
    return btn;
  }

  function buildSwitch(hero) {
    switchEl = G.h('div', {
      class: 'd2-world-switch', id: 'd2WorldSwitch', role: 'group', hidden: true,
      'aria-label': 'Мир: цифры D1 или Измерение 2'
    }, [pill(WORLD_D1, 'D1', 'Мир цифр'), pill(WORLD_D2, 'D2', 'Измерение 2')]);
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn && settingsBtn.parentNode === hero) hero.insertBefore(switchEl, settingsBtn);
    else hero.appendChild(switchEl);
  }

  function resBox(icon, kids, title) {
    return G.h('div', { class: 'd2-res', title: title },
      [G.h('span', { class: 'd2-res-icon', text: icon })].concat(kids));
  }

  function buildHero(hero) {
    refs.n = G.h('div', { class: 'd2-hero-number', id: 'd2HeroN', text: '1' });
    refs.d = G.h('span', { class: 'd2-hero-metric', id: 'd2HeroD', text: 'D₂ 0 цифр' });
    refs.m2 = G.h('span', { class: 'd2-hero-metric', id: 'd2HeroM2', text: 'M₂ ×1' });
    refs.xi = G.h('span', { class: 'd2-res-val', id: 'd2HeroXi', text: '0' });
    refs.xiRate = G.h('span', { class: 'd2-res-rate', id: 'd2HeroXiRate', text: '+0/с' });
    refs.essence = G.h('span', { class: 'd2-res-val', id: 'd2HeroEssence', text: '0' });

    heroEl = G.h('header', { class: 'd2-hero', id: 'heroD2' }, [
      G.h('div', { class: 'd2-hero-main' }, [
        refs.n,
        G.h('div', { class: 'd2-hero-sub' }, [
          refs.d,
          G.h('span', { class: 'd2-hero-sep', text: '·' }),
          refs.m2
        ])
      ]),
      G.h('div', { class: 'd2-hero-res' }, [
        resBox('Ξ', [refs.xi, refs.xiRate], 'Оси: Ξ и Ξ/с'),
        resBox('⌬', [refs.essence], 'Эссенция — вечная валюта D2')
      ])
    ]);
    hero.parentNode.insertBefore(heroEl, hero.nextSibling);
  }

  function setText(el, text) {
    if (!el) return;
    const t = String(text);
    if (el.textContent === t) return;
    el.textContent = t;
  }

  function paint(state) {
    const v = values(state);
    setText(refs.n, G.fmt.bn(v.N, v.mode));
    setText(refs.d, 'D₂ ' + G.fmt.digitsLabel(v.D));
    setText(refs.m2, 'M₂ ×' + G.fmt.num(v.m2, v.mode));
    setText(refs.xi, G.fmt.num(v.xi, v.mode));
    setText(refs.xiRate, '+' + G.fmt.num(v.xiRate, v.mode) + '/с');
    setText(refs.essence, G.fmt.num(v.essence, v.mode));
  }

  /* ---------- переключение мира ---------- */
  function setActive(state, active) {
    const s = state && state.d2;
    if (!s) return;
    if (G.d2 && typeof G.d2.setActive === 'function') G.d2.setActive(state, !!active);
    else s.active = !!active;
  }

  /* применить мир к DOM: классы body, активная пилюля, доски, шапка */
  function apply(state) {
    const world = worldOf(state);
    const isD2 = world === WORLD_D2;

    document.body.classList.toggle('world-d2', isD2);
    if (switchEl) switchEl.hidden = !open(state);
    for (const k in pills) pills[k].classList.toggle('on', k === world);

    if (world !== shown) {
      shown = world;
      if (G.ui.docks && typeof G.ui.docks.rebuild === 'function') G.ui.docks.rebuild(state);
    }
    /* шапка D2 скрыта в мире D1 — не тратим кадр на её форматирование */
    if (isD2) paint(state);
  }

  const D = {
    init(state) {
      if (state) lastState = state;
      if (ready) {
        D.update(state || lastState);
        return;
      }
      const hero = document.getElementById('hero');
      if (!hero) return;           // шапки нет (страница без разметки) — молча выходим
      buildSwitch(hero);
      buildHero(hero);
      ready = true;
      D.update(state || lastState);
    },

    /* set(state, 'd1'|'d2'): включить мир. Закрытый D2 включить нельзя */
    set(state, world) {
      if (!state || !state.d2) return WORLD_D1;
      const want = (world === WORLD_D2 && open(state)) ? WORLD_D2 : WORLD_D1;
      setActive(state, want === WORLD_D2);
      if (!ready) return want;
      apply(state);
      return want;
    },

    /* update(state): из G.ui.app.render — держит шапку и мир в согласии с state */
    update(state) {
      if (state) lastState = state;
      if (!ready) return;
      if (!state || !state.d2) {
        document.body.classList.remove('world-d2');
        if (switchEl) switchEl.hidden = true;
        return;
      }
      /* мир закрыли, а он был активен (импорт сейва, сброс D2) — возвращаемся в D1 */
      if (state.d2.active && !open(state)) setActive(state, false);
      apply(state);
    },

    world(state) { return worldOf(state); },
    open(state) { return open(state); }
  };

  G.ui.d2World = D;
})(window.G = window.G || {});
