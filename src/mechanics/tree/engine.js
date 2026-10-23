/* mechanics/tree/engine.js — ДВИЖОК карты-созвездия (v0.26.0).
   Раньше это была доска «Дерева ◆» целиком; теперь — фабрика: один и тот же
   экран рисует и ◆-дерево, и Ψ-дерево (и любое следующее).
   Только карта: ни плиток, ни легенды. Имя и описание узла — по наведению (мышь)
   или по тапу (телефон, карточка внизу с кнопкой «купить»).
   Ветви = углы (branch.angle), глубина = радиус. Узел следующей глубины СКРЫТ,
   пока не куплен предыдущий (`requires` в данных).
   Панорама: зажать и везти можно ГДЕ УГОДНО (в т.ч. по узлам); покупка — клик
   без движения. Покупка — общий systems/upgrades.js, имён узлов в движке нет.

   Как завести новое дерево:
     content/<x>.js  → G.content.<x> = { res, hint, branches: [...], tiers: [...] }
     mechanics/<x>/index.js → addMechanic({ id:'<x>', ... })
     mechanics/<x>/board.js → G.treeBoard.build({ mech:'<x>', content:'<x>',
                                                 res:'cores', unit:'◆', icon:'core', close:'core' }) */
(function (G) {
  'use strict';

  /* ui/components подключается позже (bench.js поднимает только логику), поэтому берём лениво */
  const C = () => G.ui.components;

  /* круговая геометрия: сторона карты, центр, радиусы колец, дрейф угла по глубине */
  const SIZE = 2200;
  const HUB = SIZE / 2;
  const R0 = 210;
  const RSTEP = 138;
  const DRIFT = 5;

  const ZMIN = 0.6;
  const ZMAX = 4;
  const ZSTART = 1.6;
  const PAD = 120;            /* сколько карты обязано остаться в кадре */
  const DRAG_SLOP = 5;        /* сдвиг в px, после которого это уже панорама, а не клик */
  const DRAG_SLOP_TOUCH = 12; /* палец «дрожит» сильнее: тап на телефоне не должен стать панорамой */
  const HOLD_DELAY = 380;     /* зажатие на узле → повторные покупки */
  const HOLD_EVERY = 150;

  const TIER_LABEL = { t1: 'I', t2: 'II', t3: 'III', t4: 'IV' };
  /* ---------- фабрика: одна карта на любое «дерево-валюту» ----------
     opts: { mech, content, res, unit, icon, close }
       mech    — id механики: её узлы = registry.upgradesOf(mech)
       content — ключ G.content с { branches, tiers }
       res     — ресурс-валюта узлов ('cores' для ◆, 'psi' для Ψ)
       unit    — значок валюты в HUD ('◆' / 'Ψ')
       icon    — иконка хаба и кнопки покупки
       close   — куда уводит крестик/Esc (id доски)
     Тело доски ниже оставлено почти дословно — чтобы дифф при выносе был минимальным. */
  function build(opts) {
    opts = opts || {};
    const mech = G.registry.mechanic(opts.mech);
    const res = opts.res || 'cores';
    const unit = opts.unit || '◆';
    const ico = opts.icon || 'core';
    const closeId = opts.close || 'core';

    /* геометрия карты наружу — чтобы тесты ловили выход узлов за край и перекрытие ветвей */
    mech.geometry = { SIZE: SIZE, HUB: HUB, R0: R0, RSTEP: RSTEP, DRIFT: DRIFT };

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function nextValue(state, u, lvl) {
    const before = state.upg[u.id];
    state.upg[u.id] = lvl + 1;
    const v = G.upgrades.value(state, u);
    state.upg[u.id] = before;
    return v;
  }

  /* ---------- узел: орб + скрытая подпись ---------- */
  function nodeCard(u) {
    const orb = G.h('button', { class: 'node-orb', type: 'button', 'aria-label': u.name });
    const icoEl = G.h('span', { class: 'orb-ico' }, [G.ui.icons.node(u.icon || 'diamond')]);
    const priceEl = G.h('span', { class: 'orb-price' });
    const ring = G.h('span', { class: 'orb-ring', 'aria-hidden': 'true' });
    orb.appendChild(ring);
    orb.appendChild(icoEl);
    orb.appendChild(priceEl);

    const nameEl = G.h('div', { class: 'node-name', text: u.name });
    const lvlEl = G.h('div', { class: 'node-lvl' });
    const el = G.h('div', { class: 'node' }, [orb, G.h('div', { class: 'node-label' }, [nameEl, lvlEl])]);

    const unknown = G.h('div', { class: 'node unknown' }, [
      G.h('span', { class: 'node-orb', 'aria-hidden': 'true' }, [G.h('span', { class: 'orb-ico' }, [G.ui.icons.node('lock')])])
    ]);

    let flashTimer = null;
    function flash() {
      if (G.animationsOff && G.animationsOff()) return;
      el.classList.remove('bought');
      void el.offsetWidth;
      el.classList.add('bought');
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => el.classList.remove('bought'), 460);
    }

    function visible(s) {
      return G.upgrades.requirementsMet(s, u) || G.lvl(s, u.id) > 0;
    }

    function update(s) {
      const on = visible(s);
      el.style.display = on ? '' : 'none';
      unknown.style.display = on ? 'none' : '';
      if (!on) return;

      const lvl = G.lvl(s, u.id);
      const maxed = lvl >= u.max;
      lvlEl.textContent = maxed ? 'макс' : 'ур. ' + lvl + (isFinite(u.max) ? '/' + u.max : '');

      if (maxed) {
        priceEl.textContent = '';
        orb.disabled = true;
        el.className = 'node maxed done';
        return;
      }
      const can = G.upgrades.canBuy(s, u);
      priceEl.textContent = G.fmt.num(G.upgrades.currentCost(s, u));
      orb.disabled = !can;
      el.className = 'node' + (lvl > 0 ? ' done' : '') + (can ? ' ready' : '');
    }

    return { el: el, unknown: unknown, orb: orb, update: update, flash: flash, visible: visible, u: u };
  }

  /* ---------- доска ---------- */
    mech.board = {
    mount(root) {
      const cfg = G.content[opts.content] || {};
      const branches = cfg.branches || [];
      const all = G.registry.upgradesOf(opts.mech);

      /* слой глубины: звёзды/туманность едут медленнее карты — глаз читает объём */
      const parallax = G.h('div', { class: 'tree-parallax', 'aria-hidden': 'true' }, [
        G.h('div', { class: 'tree-nebula' }),
        G.h('div', { class: 'tree-stars' })
      ]);

      const map = G.h('div', { class: 'tree-map' });
      /* подписи ветвей по кругу: видно, где какая ветвь, без наведения на узел */
      const branchLabels = G.h('div', { class: 'tree-labels', 'aria-hidden': 'true' });
      map.appendChild(branchLabels);
      map.style.width = SIZE + 'px';
      map.style.height = SIZE + 'px';

      /* кольца глубины + лучи ветвей — фон карты */
      const rings = svgEl('svg', { class: 'tree-rings', viewBox: '0 0 ' + SIZE + ' ' + SIZE });
      const lines = svgEl('svg', { class: 'tree-lines', viewBox: '0 0 ' + SIZE + ' ' + SIZE });
      map.appendChild(rings);
      map.appendChild(lines);

      let maxDepth = 0;
      for (const u of all) maxDepth = Math.max(maxDepth, u.depth || 0);

      for (let d = 0; d <= maxDepth; d++) {
        rings.appendChild(svgEl('circle', {
          cx: HUB, cy: HUB, r: R0 + d * RSTEP, class: 'tring' + (d === 0 ? ' base' : '')
        }));
      }
      branches.forEach((b) => {
        const a = (Number(b.angle) || 0) * Math.PI / 180;
        const rad = R0 + maxDepth * RSTEP;
        rings.appendChild(svgEl('line', {
          x1: HUB, y1: HUB,
          x2: HUB + Math.cos(a) * rad, y2: HUB + Math.sin(a) * rad,
          class: 'tray', stroke: b.color || '#35e2c0'
        }));
      });

      /* центральный хаб: ◆ и сколько ядер */
      const hubLabel = G.h('div', { class: 'hub-label' });
      const hub = G.h('div', { class: 'tree-hub' }, [
        G.h('div', { class: 'hub-ring' }),
        G.h('div', { class: 'hub-core' }, [G.ui.icons.node(ico)]),
        hubLabel
      ]);
      hub.style.left = HUB + 'px';
      hub.style.top = HUB + 'px';
      map.appendChild(hub);

      const cards = [];
      const links = [];

      const branchInfo = [];
      branches.forEach((b, i) => {
        const base = Number(b.angle) || 0;
        const color = b.color || '#35e2c0';
        const list = all.filter((u) => u.branch === b.id).sort((x, y) => (x.depth || 0) - (y.depth || 0));
        let prev = { x: HUB, y: HUB };

        list.forEach((u) => {
          const d = u.depth || 0;
          const a = (base + Math.sin(d * 0.8 + i * 1.9) * DRIFT) * Math.PI / 180;
          const rad = R0 + d * RSTEP;
          const x = HUB + Math.cos(a) * rad;
          const y = HUB + Math.sin(a) * rad;

          const ln = svgEl('line', { x1: prev.x, y1: prev.y, x2: x, y2: y, class: 'tline', stroke: color });
          const flow = svgEl('line', { x1: prev.x, y1: prev.y, x2: x, y2: y, class: 'tline flow', stroke: color });
          lines.appendChild(ln);
          lines.appendChild(flow);
          links.push({ el: ln, flow: flow, u: u });

          const card = nodeCard(u);
          const cell = G.h('div', { class: 'tree-cell' }, [card.el, card.unknown]);
          cell.style.left = x + 'px';
          cell.style.top = y + 'px';
          cell.style.setProperty('--branch', color);
          map.appendChild(cell);

          cards.push({ u: u, card: card, cell: cell });
          prev = { x: x, y: y };
        });
      });

      /* узлы без известной ветви — чтобы ничего не потерялось */
      const orphans = all.filter((u) => !branches.some((b) => b.id === u.branch));
      /* строим подписи: имя ветви + куплено узлов, на внешнем радиусе */
      branches.forEach((br, i) => {
        const list = cards.filter((c) => c.u.branch === br.id);
        let maxDepth = 0;
        for (const c of list) maxDepth = Math.max(maxDepth, c.u.depth || 0);
        const rad = R0 + maxDepth * RSTEP + 96;
        const a = ((Number(br.angle) || 0)) * Math.PI / 180;
        const x = HUB + Math.cos(a) * rad;
        const y = HUB + Math.sin(a) * rad;
        const el = G.h('div', { class: 'tree-branch-label' }, [
          G.h('span', { class: 'tbl-dot' }),
          G.h('span', { class: 'tbl-name', text: br.name }),
          G.h('span', { class: 'tbl-count', text: '' })
        ]);
        el.style.left = x.toFixed(0) + 'px';
        el.style.top = y.toFixed(0) + 'px';
        el.style.setProperty('--branch', br.color || '#35e2c0');
        branchLabels.appendChild(el);
        branchInfo.push({ id: br.id, el: el, count: el.querySelector('.tbl-count'), total: list.length });
      });

      if (orphans.length) {
        const box = G.h('div', { class: 'tree-orphans' });
        orphans.forEach((u) => {
          const card = nodeCard(u);
          cards.push({ u: u, card: card, cell: null });
          box.appendChild(G.h('div', { class: 'tree-cell' }, [card.el, card.unknown]));
        });
        map.appendChild(box);
      }

      /* ---------- карточка узла: по наведению (мышь) или по тапу (телефон) ---------- */
      const tipTitle = G.h('div', { class: 'tip-title' });
      const tipSub = G.h('div', { class: 'tip-sub' });
      const tipDesc = G.h('div', { class: 'tip-desc' });
      const tipEff = G.h('div', { class: 'tip-eff' });
      const tipBuy = G.h('button', { class: 'tip-buy', type: 'button' });
      const tip = G.h('div', { class: 'tree-tip' }, [tipTitle, tipSub, tipDesc, tipEff, tipBuy]);
      tipBuy.addEventListener('click', () => {
        /* selected — это сам апгрейд (так его ставит selectNode), а не запись карточки,
           поэтому .u здесь нет: раньше кнопка в листе молча не покупала НА ТЕЛЕФОНЕ. */
        if (selected) buyOnce(selected);
      });

      let selected = null;      /* узел, закреплённый тапом */
      let hovered = null;       /* узел под мышью */
      let hideTimer = null;

      function buyOnce(u) {
        const ok = G.upgrades.buy(G.state, u);
        const c = cards.find((x) => x.u === u);
        if (c && ok) c.card.flash();
        if (tip.classList.contains('on')) fillTip(u);
      }

      function fillTip(u) {
        const s = G.state;
        const lvl = G.lvl(s, u.id);
        const maxed = lvl >= u.max;
        const cur = G.upgrades.value(s, u);
        tipTitle.textContent = u.name;
        tipSub.textContent = 'ярус ' + (TIER_LABEL[u.tier] || '?') + ' · ур. ' + lvl + ' / ' + u.max;
        tipDesc.textContent = (u.desc || '') + (u.note ? ' (' + u.note + ')' : '');
        tipEff.textContent = maxed
          ? 'сейчас: ' + C().fmtEffect(u, cur) + ' · максимум'
          : 'сейчас: ' + C().fmtEffect(u, cur) + ' → ' + C().fmtEffect(u, nextValue(s, u, lvl));
        if (maxed) {
          tipBuy.textContent = 'максимум';
          tipBuy.disabled = true;
          tipBuy.classList.add('maxed');
        } else {
          tipBuy.disabled = !G.upgrades.canBuy(s, u);
          tipBuy.classList.remove('maxed');
          G.dom.clear(tipBuy);
          tipBuy.appendChild(G.ui.icons.node(ico));
          tipBuy.appendChild(G.h('span', { text: G.fmt.num(G.upgrades.currentCost(s, u)) }));
        }
      }

      /* поставить карточку у узла (мышь) либо внизу листом (телефон) */
      function placeTip(u, cell) {
        if (!cell || document.body.classList.contains('tree-sheet-mode')) {
          tip.classList.add('sheet');
          tip.style.left = '';
          tip.style.top = '';
          return;
        }
        tip.classList.remove('sheet');
        const sr = stage.getBoundingClientRect();
        const r = cell.getBoundingClientRect();
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const half = Math.min(160, Math.max(80, w / 2 - 10));
        let x = r.left - sr.left + r.width / 2;
        let y = r.top - sr.top - 14;
        x = x < half + 8 ? half + 8 : x > w - half - 8 ? w - half - 8 : x;
        tip.classList.remove('below');
        if (y < 90) { tip.classList.add('below'); y = r.bottom - sr.top + 14; }
        if (y > h - 40) y = h - 40;
        tip.style.left = x.toFixed(1) + 'px';
        tip.style.top = y.toFixed(1) + 'px';
      }

      function showTip(u, cell) {
        selected = null;
        hovered = u;
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        fillTip(u);
        tip.classList.add('on');
        placeTip(u, cell);
      }

      function hideTip(now) {
        hovered = null;
        if (hideTimer) clearTimeout(hideTimer);
        const run = () => { if (!hovered && !selected) tip.classList.remove('on'); };
        if (now) run(); else hideTimer = setTimeout(run, 130);
      }

      function selectNode(u, cell) {
        selected = u;
        hovered = null;
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        fillTip(u);
        tip.classList.add('on');
        placeTip(u, cell);
        stage.classList.add('picking');
        for (const c of cards) if (c.cell) c.cell.classList.toggle('sel', c.u === u);
      }

      function clearSelection() {
        selected = null;
        stage.classList.remove('picking');
        for (const c of cards) if (c.cell) c.cell.classList.remove('sel');
        tip.classList.remove('on');
      }

      tip.addEventListener('pointerenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
      tip.addEventListener('pointerleave', (e) => { if (!selected && e.pointerType !== 'touch') hideTip(); });

      /* ---------- минимальная шапка: ядра, узлы, выход ---------- */
      const hudCores = G.h('span', { class: 'tree-hud-cores' });
      const hudNodes = G.h('span', { class: 'tree-hud-nodes' });
      const closeBtn = G.h('button', { class: 'tree-close', type: 'button', title: 'Закрыть (Esc)' }, [G.ui.icons.node('close')]);
      closeBtn.addEventListener('click', () => G.ui.docks.select(closeId));
      const hud = G.h('div', { class: 'tree-hud' }, [
        G.h('div', { class: 'tree-hud-left' }, [hudCores, G.h('span', { class: 'tree-hud-sep' }), hudNodes]),
        closeBtn
      ]);

      /* ---------- кнопки зума ---------- */
      const mkBtn = (icon, title) => G.h('button', { class: 'tree-zoom-btn', type: 'button', title: title }, [G.ui.icons.node(icon)]);
      const zoomIn = mkBtn('plus', 'Приблизить');
      const zoomOut = mkBtn('minus', 'Отдалить');
      const zoomFit = mkBtn('fit', 'Вся карта');
      const zoomCenter = mkBtn('center', 'К центру');
      const zoomBar = G.h('div', { class: 'tree-zoom' }, [zoomIn, zoomOut, zoomFit, zoomCenter]);

      const stage = G.h('div', { class: 'tree-stage' }, [parallax, map, hud, zoomBar, tip]);
      const el = G.h('div', { class: 'board-body tree-board' }, [stage]);
      root.appendChild(el);

      /* ---------- масштаб и панорама ----------
         baseK — «вписать карту целиком», view.z — зум пользователя. */
      const view = { z: ZSTART, tx: 0, ty: 0 };
      let baseK = 1;
      const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
      const contentSize = () => ({ w: SIZE * baseK * view.z, h: SIZE * baseK * view.z });

      function clampPan() {
        const cw = stage.clientWidth;
        const ch = stage.clientHeight;
        const c = contentSize();
        view.tx = clamp(view.tx, PAD - c.w, cw - PAD);
        view.ty = clamp(view.ty, PAD - c.h, ch - PAD);
      }

      function applyView() {
        clampPan();
        const k = baseK * view.z;
        map.style.transformOrigin = 'top left';
        map.style.transform = 'translate(' + view.tx.toFixed(1) + 'px,' + view.ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
        /* фон-параллакс: 35 % сдвига и 20 % масштаба — ощущение глубины без тормозов */
        if (parallax) {
          const pk = 1 + (k - 1) * 0.2;
          parallax.style.transform = 'translate(' + (view.tx * 0.35).toFixed(1) + 'px,' +
            (view.ty * 0.35).toFixed(1) + 'px) scale(' + pk.toFixed(4) + ')';
        }
        stage.classList.toggle('far', view.z < 1.15);
        zoomOut.disabled = view.z <= ZMIN + 1e-6;
        zoomIn.disabled = view.z >= ZMAX - 1e-6;
      }

      function centerView() {
        view.tx = stage.clientWidth / 2 - HUB * baseK * view.z;
        view.ty = stage.clientHeight / 2 - HUB * baseK * view.z;
        applyView();
      }

      function zoomAt(z, px, py) {
        const oldK = baseK * view.z;
        const newZ = clamp(z, ZMIN, ZMAX);
        if (Math.abs(newZ - view.z) < 1e-6) return;
        const newK = baseK * newZ;
        const ax = px === undefined ? stage.clientWidth / 2 : px;
        const ay = py === undefined ? stage.clientHeight / 2 : py;
        const lx = (ax - view.tx) / oldK;
        const ly = (ay - view.ty) / oldK;
        view.z = newZ;
        view.tx = ax - lx * newK;
        view.ty = ay - ly * newK;
        applyView();
      }

      /* базовый масштаб под размер области — без сброса зума и центра */
      function refit() {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!w || !h) return;
        const oldK = baseK * view.z;
        const mx = (w / 2 - view.tx) / oldK;
        const my = (h / 2 - view.ty) / oldK;
        baseK = Math.min(w / SIZE, h / SIZE);
        const newK = baseK * view.z;
        view.tx = w / 2 - mx * newK;
        view.ty = h / 2 - my * newK;
        applyView();
      }

      function fit() {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!w || !h) return;
        baseK = Math.min(w / SIZE, h / SIZE);
        view.z = ZMIN;
        centerView();
      }

      zoomIn.addEventListener('click', () => zoomAt(view.z * 1.35));
      zoomOut.addEventListener('click', () => zoomAt(view.z / 1.35));
      zoomFit.addEventListener('click', fit);
      zoomCenter.addEventListener('click', () => { centerView(); });

      stage.addEventListener('wheel', (e) => {
        if (!e.deltaY) return;
        e.preventDefault();
        const r = stage.getBoundingClientRect();
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt(view.z * f, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });

      /* ---------- единая обработка указателей: панорама, щипок, клик, зажатие ---------- */
      const ptrs = new Map();       /* pointerId → {x, y} */
      let pan = null;               /* {id, sx, sy, tx, ty, moved} */
      let pinch = null;             /* {d, z, cx, cy} */
      let hold = null;              /* {u, timer, repeat} */
      let tapCell = null;           /* узел, на котором началось нажатие */

      function stopHold() {
        if (!hold) return;
        clearTimeout(hold.delay);
        clearInterval(hold.repeat);
        hold = null;
      }

      function cellOf(target) {
        const cell = target && target.closest ? target.closest('.tree-cell') : null;
        if (!cell) return null;
        const orb = cell.querySelector('.node-orb');
        if (!orb || orb.disabled) return null;
        return cards.find((c) => c.cell === cell) || null;
      }

      function twoPointers() {
        const it = ptrs.values();
        const a = it.next().value;
        const b = it.next().value;
        return { a: a, b: b };
      }

      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.tree-zoom') || e.target.closest('.tree-hud') || e.target.closest('.tree-tip')) return;
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (ptrs.size === 2) {
          stopHold();
          const p = twoPointers();
          pinch = {
            d: Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) || 1,
            z: view.z
          };
          pan = null;
          hideTip(true);
          return;
        }
        if (ptrs.size > 2) return;

        pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty, moved: false };
        tapCell = cellOf(e.target);

        /* зажатие на узле — повторные покупки (только мышь/перо) */
        if (tapCell && e.pointerType !== 'touch') {
          const u = tapCell.u;
          hold = { u: u, delay: null, repeat: null, moved: false };
          hold.delay = setTimeout(() => {
            if (!hold || hold.moved) return;
            buyOnce(u);
            hold.repeat = setInterval(() => buyOnce(u), HOLD_EVERY);
          }, HOLD_DELAY);
        }
      });

      stage.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pinch && ptrs.size >= 2) {
          e.preventDefault();
          const p = twoPointers();
          const d = Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) || 1;
          const r = stage.getBoundingClientRect();
          const mx = (p.a.x + p.b.x) / 2 - r.left;
          const my = (p.a.y + p.b.y) / 2 - r.top;
          zoomAt(pinch.z * (d / pinch.d), mx, my);
          return;
        }
        if (!pan || pan.id !== e.pointerId) return;

        const dx = e.clientX - pan.sx;
        const dy = e.clientY - pan.sy;
        const slop = e.pointerType === 'touch' ? DRAG_SLOP_TOUCH : DRAG_SLOP;
        if (!pan.moved && Math.abs(dx) + Math.abs(dy) < slop) return;
        if (!pan.moved) {
          pan.moved = true;
          stage.classList.add('grabbing');
          if (hold) { hold.moved = true; stopHold(); }
          hideTip(true);
        }
        e.preventDefault();
        view.tx = pan.tx + dx;
        view.ty = pan.ty + dy;
        applyView();
      });

      function endPointer(e, cancelled) {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2 && pinch) pinch = null;
        const wasPan = pan && pan.id === e.pointerId ? pan : null;
        if (wasPan) {
          pan = null;
          stage.classList.remove('grabbing');
        }
        if (hold) {
          const held = hold;
          stopHold();
          if (!held.moved) buyOnce(held.u);       /* короткое нажатие без движения = покупка */
          tapCell = null;
          return;
        }
        if (cancelled || !wasPan || wasPan.moved) { tapCell = null; return; }

        /* нажатие без движения */
        if (tapCell) {
          const c = tapCell;
          tapCell = null;
          if (e.pointerType === 'touch') {
            document.body.classList.add('tree-sheet-mode');
            selectNode(c.u, c.cell);
          } else {
            buyOnce(c.u);
            showTip(c.u, c.cell);
          }
          return;
        }
        if (e.pointerType === 'touch') clearSelection();
        tapCell = null;
      }

      stage.addEventListener('pointerup', (e) => endPointer(e, false));
      stage.addEventListener('pointercancel', (e) => endPointer(e, true));

      /* наведение мышью: карточка узла, без покупки */
      stage.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const c = cellOf(e.target);
        if (c) { document.body.classList.remove('tree-sheet-mode'); showTip(c.u, c.cell); }
      });
      stage.addEventListener('pointerout', (e) => {
        if (e.pointerType === 'touch') return;
        const c = cellOf(e.target);
        if (c && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.tree-tip'))) hideTip();
      });

      const onKey = (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('board-full')) {
          if (selected) { clearSelection(); return; }
          G.ui.docks.select(closeId);
        }
      };
      window.addEventListener('keydown', onKey);

      /* ---------- размеры и первый кадр ---------- */
      let lastSize = { w: 0, h: 0 };
      const onResize = () => {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!w || !h || (w === lastSize.w && h === lastSize.h)) return;
        lastSize = { w: w, h: h };
        if (w < 720) document.body.classList.add('tree-sheet-mode');
        refit();
      };
      window.addEventListener('resize', onResize);

      baseK = Math.min((stage.clientWidth || 1200) / SIZE, (stage.clientHeight || 700) / SIZE) || 0.4;
      refit();
      centerView();
      setTimeout(() => { onResize(); centerView(); }, 60);

      return {
        destroy() {
          window.removeEventListener('resize', onResize);
          window.removeEventListener('keydown', onKey);
          stopHold();
          document.body.classList.remove('tree-sheet-mode');
        },

        update(state) {
          onResize();
          /* счётчики в подписях ветвей: «куплено/всего» */
          for (const info of branchInfo) {
            let bought = 0;
            for (const c of cards) {
              if (c.u.branch === info.id && G.lvl(state, c.u.id) > 0) bought++;
            }
            const txt = bought + '/' + info.total;
            if (info.txt !== txt) { info.txt = txt; info.count.textContent = txt; }
          }
          hudCores.textContent = G.fmt.num(state.res[res] || 0) + ' ' + unit;
          hudNodes.textContent = mech.bought(state) + ' / ' + mech.total();
          hubLabel.textContent = G.fmt.num(state.res[res] || 0);

          for (const c of cards) {
            c.card.update(state);
            if (c.cell) {
              const on = c.card.visible(state);
              c.cell.classList.toggle('is-hidden', !on);
              c.cell.classList.toggle('ready', G.upgrades.canBuy(state, c.u));
            }
          }
          for (const l of links) {
            const on = G.upgrades.requirementsMet(state, l.u) || G.lvl(state, l.u.id) > 0;
            const done = G.lvl(state, l.u.id) > 0;
            l.el.classList.toggle('is-hidden', !on);
            l.el.classList.toggle('done', done);
            l.flow.classList.toggle('is-hidden', !on);
            l.flow.classList.toggle('done', done);
          }
          /* открытая карточка узла должна обновлять числа */
          if ((hovered || selected) && tip.classList.contains('on')) fillTip(hovered || selected);
          if (selected && G.upgrades.isMaxed(state, selected)) clearSelection();
        }
      };
    }
    };

    return mech;
  }

  G.treeBoard = { build: build };
})(window.G = window.G || {});
