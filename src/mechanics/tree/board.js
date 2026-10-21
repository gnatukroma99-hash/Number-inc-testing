/* mechanics/tree/board.js — доска «Дерево ◆» в стиле звёздной карты (референс — PoE-skilltree):
   светящиеся круглые узлы, тонкие линии-связки, тёмный фон со звёздами, центральный хаб.
   Ветви = направления (углы), глубина = радиус. Узел следующей глубины СКРЫТ,
   пока не куплен предыдущий (`requires` в данных).
   Покупка — общий systems/upgrades.js, в движке нет имён узлов. */
(function (G) {
  'use strict';

  const mech = G.registry.mechanic('tree');
  const C = G.ui.components;

  /* геометрия карты: ветви расходятся ВЛЕВО и ВПРАВО от центрального хаба,
     глубина — шаг по горизонтали, ветви разнесены по двум «полосам» + лёгкий зигзаг */
  const W = 1360;
  const H = 440;
  const X_STEP = 112;
  const LANE = 120;
  const ZIG = 14;

  const TIER_LABEL = { t1: 'I', t2: 'II', t3: 'III' };

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

  /* ---------- узел ---------- */
  function nodeCard(u) {
    const orb = G.h('button', { class: 'node-buy node-orb', type: 'button' });
    const iconEl = G.h('span', { class: 'orb-icon', text: u.icon || '●' });
    const priceEl = G.h('span', { class: 'orb-price' });
    orb.appendChild(iconEl);
    orb.appendChild(priceEl);

    const nameEl = G.h('div', { class: 'node-name', text: u.name });
    const lvlEl = G.h('div', { class: 'node-lvl' });
    const effEl = G.h('div', { class: 'node-eff' });

    /* частицы вокруг купленного узла (чистый CSS, без JS в кадре) */
    const orbit = G.h('div', { class: 'orb-orbit', 'aria-hidden': 'true' }, [
      G.h('span', { class: 'orbit-spin' }, [
        G.h('i', { class: 'spark s1' }),
        G.h('i', { class: 'spark s2' }),
        G.h('i', { class: 'spark s3' })
      ])
    ]);

    const real = G.h('div', { class: 'node' }, [
      orbit,
      orb,
      G.h('div', { class: 'node-label' }, [nameEl, lvlEl, effEl])
    ]);

    /* заглушка: «ты не видишь, что там дальше» */
    const unknown = G.h('div', { class: 'node unknown' }, [
      G.h('button', { class: 'node-buy node-orb', type: 'button', disabled: 'disabled' }, [
        G.h('span', { class: 'orb-icon', text: '?' }),
        G.h('span', { class: 'orb-price', text: '—' })
      ]),
      G.h('div', { class: 'node-label' }, [
        G.h('div', { class: 'node-name', text: '???' }),
        G.h('div', { class: 'node-lvl', text: 'скрыто' }),
        G.h('div', { class: 'node-eff' })
      ])
    ]);

    /* покупка: клик + зажатие */
    let hold = null;
    const stop = () => { if (hold) { clearInterval(hold); hold = null; } };
    let flashTimer = null;
    const flash = (bought) => {
      if (!bought || (G.animationsOff && G.animationsOff())) return;
      real.classList.remove('bought');
      void real.offsetWidth;
      real.classList.add('bought');
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => real.classList.remove('bought'), 460);
    };
    orb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      flash(G.upgrades.buy(G.state, u));
      stop();
      hold = setInterval(() => flash(G.upgrades.buy(G.state, u)), 140);
    });
    orb.addEventListener('pointerup', stop);
    orb.addEventListener('pointerleave', stop);
    orb.addEventListener('pointercancel', stop);

    function update(s) {
      const visible = G.upgrades.requirementsMet(s, u) || G.lvl(s, u.id) > 0;
      real.style.display = visible ? '' : 'none';
      unknown.style.display = visible ? 'none' : '';
      if (!visible) return;

      const lvl = G.lvl(s, u.id);
      const maxed = lvl >= u.max;
      const cur = G.upgrades.value(s, u);

      lvlEl.textContent = maxed ? 'макс · ' + TIER_LABEL[u.tier] : 'ур. ' + lvl + ' / ' + u.max;
      effEl.textContent = maxed ? C.fmtEffect(u, cur) : C.fmtEffect(u, cur) + ' → ' + C.fmtEffect(u, nextValue(s, u, lvl));

      if (maxed) {
        priceEl.textContent = 'max';
        orb.disabled = true;
        orb.className = 'node-buy node-orb maxed';
        real.className = 'node maxed done';
        real.title = u.name + ' — максимум';
        return;
      }
      const can = G.upgrades.canBuy(s, u);
      priceEl.textContent = G.fmt.num(G.upgrades.currentCost(s, u)) + ' ◆';
      orb.disabled = !can;
      orb.className = 'node-buy node-orb' + (can ? ' can' : ' cant');
      real.className = 'node' + (lvl > 0 ? ' done' : '') + (can ? ' ready' : '');
      real.title = u.name + ' · ' + u.note + '\n' + (u.desc || '') + ' · ' + TIER_LABEL[u.tier];
    }

    return { real: real, unknown: unknown, update: update, u: u };
  }

  /* ---------- доска ---------- */
  mech.board = {
    mount(root) {
      const tCores = C.tile('◆ Ядра', 'accent');
      const tNodes = C.tile('Узлов', 'good');
      const tGain = C.tile('Дадут за забег', 'good');
      const tNext = C.tile('Следующий узел', '');

      const cfg = G.content.tree || {};
      const branches = cfg.branches || [];
      const all = G.registry.upgradesOf('tree');

      const map = G.h('div', { class: 'tree-map' });
      const svg = svgEl('svg', {
        class: 'tree-lines',
        viewBox: '0 0 ' + W + ' ' + H,
        preserveAspectRatio: 'none'
      });
      map.appendChild(svg);

      /* центральный хаб */
      const hub = G.h('div', { class: 'tree-hub' }, [
        G.h('div', { class: 'hub-ring' }),
        G.h('div', { class: 'hub-core', text: '◆' }),
        G.h('div', { class: 'hub-label' })
      ]);
      map.appendChild(hub);

      const cards = [];
      const lines = [];

      branches.forEach((b, i) => {
        const dir = b.dir === 'left' ? -1 : 1;                 /* в какую сторону растёт ветвь */
        const lane = (b.lane === 'down' ? 1 : b.lane === 'up' ? -1 : Number(b.lane) || 0);  /* полоса */
        const list = all.filter((u) => u.branch === b.id)
          .sort((x, y) => (x.depth || 0) - (y.depth || 0));

        let prev = { x: W / 2, y: H / 2 };

        list.forEach((u, idx) => {
          const d = u.depth || 0;
          const x = W / 2 + dir * X_STEP * (d + 1);
          const y = H / 2 + lane * LANE + Math.sin(d * 1.1 + i * 1.7) * ZIG;

          /* линия от предыдущего узла ветви */
          const ln = svgEl('line', {
            x1: prev.x, y1: prev.y, x2: x, y2: y,
            class: 'tline',
            stroke: b.color || '#35e2c0'
          });
          svg.appendChild(ln);
          const flow = svgEl('line', {
            x1: prev.x, y1: prev.y, x2: x, y2: y,
            class: 'tline flow',
            stroke: b.color || '#35e2c0'
          });
          svg.appendChild(flow);
          lines.push({ el: ln, flow: flow, u: u });

          const card = nodeCard(u);
          const cell = G.h('div', {
            class: 'tree-cell' + (d === 0 ? ' root' : ''),
            style: {
              left: (x / W * 100).toFixed(3) + '%',
              top: (y / H * 100).toFixed(3) + '%'
            }
          }, [card.real, card.unknown]);
          cell.style.setProperty('--branch', b.color || '#35e2c0');
          cell.dataset.depth = String(d);
          cell.addEventListener('mouseenter', () => showInfo(card.u));
          map.appendChild(cell);

          cards.push({ u: u, card: card, cell: cell });
          prev = { x: x, y: y };
        });
      });

      /* узлы без известной ветви — чтобы ничего не потерялось */
      const orphans = all.filter((u) => !branches.some((b) => b.id === u.branch));
      if (orphans.length) {
        const box = G.h('div', { class: 'tree-orphans' });
        orphans.forEach((u) => {
          const card = nodeCard(u);
          cards.push({ u: u, card: card, cell: null });
          box.appendChild(G.h('div', { class: 'tree-cell root' }, [card.real, card.unknown]));
        });
        map.appendChild(box);
      }

      /* легенда-ветви */
      const legend = G.h('div', { class: 'tree-legend' }, branches.map((b) => {
        const chip = G.h('div', { class: 'tree-branch-head', title: (b.name || b.id) + ' — ' + (b.note || '') }, [
          G.h('span', { class: 'branch-icon', text: b.icon || '•' }),
          G.h('span', { class: 'branch-name', text: b.name || b.id }),
          G.h('span', { class: 'branch-note', text: b.note || '' })
        ]);
        chip.style.setProperty('--branch', b.color || 'var(--accent)');
        return chip;
      }));

      /* панель подробностей узла */
      const infoTitle = G.h('div', { class: 'info-title', text: 'Наведи на узел' });
      const infoDesc = G.h('div', { class: 'info-desc', text: 'Шесть ветвей расходятся от центра; дальше от центра — глубже. Карту можно приближать.' });
      const infoEff = G.h('div', { class: 'info-eff' });
      const info = G.h('div', { class: 'tree-info' }, [infoTitle, infoDesc, infoEff]);

      function showInfo(u) {
        if (!u) return;
        const s = G.state;
        const lvl = G.lvl(s, u.id);
        infoTitle.textContent = u.name + ' · ярус ' + (TIER_LABEL[u.tier] || '?') +
          ' · ур. ' + lvl + ' / ' + u.max;
        infoDesc.textContent = (u.desc || '') + ' ' + (u.note || '');
        infoEff.textContent = lvl >= u.max
          ? 'сейчас: ' + C.fmtEffect(u, G.upgrades.value(s, u))
          : 'сейчас: ' + C.fmtEffect(u, G.upgrades.value(s, u)) +
            ' → ' + C.fmtEffect(u, nextValue(s, u, lvl)) +
            '   ·   цена: ' + G.fmt.num(G.upgrades.currentCost(s, u)) + ' ◆';
      }

      /* ---- управление видом: приближение/отдаление (колесо, щипок, кнопки) ---- */
      const view = { z: 1, tx: 0, ty: 0 };
      const ZMIN = 1;
      const ZMAX = 6;
      let baseK = 1;

      const zoomIn = G.h('button', { class: 'tree-zoom-btn', type: 'button', title: 'Приблизить', text: '+' });
      const zoomOut = G.h('button', { class: 'tree-zoom-btn', type: 'button', title: 'Отдалить', text: '−' });
      const zoomFit = G.h('button', { class: 'tree-zoom-btn', type: 'button', title: 'Вписать', text: '⤢' });
      const zoomBar = G.h('div', { class: 'tree-zoom' }, [zoomIn, zoomOut, zoomFit]);

      const stage = G.h('div', { class: 'tree-stage' }, [map, zoomBar]);

      const el = G.h('div', { class: 'board-body tree-board' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCores.el, tNodes.el, tGain.el, tNext.el]),
        legend,
        stage,
        info
      ]);
      root.appendChild(el);

      /* ---------- масштаб и панорама ----------
         baseK — «вписать карту в область», view.z — пользовательский зум (1…6).
         Итоговый масштаб = baseK * z, сдвиг = view.tx/ty, всё в CSS transform. */
      function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

      function contentSize() { return { w: W * baseK * view.z, h: H * baseK * view.z }; }

      /* держим карту в кадре: если она меньше области — центрируем, если больше — не даём утащить */
      function clampPan() {
        const cw = stage.clientWidth;
        const ch = stage.clientHeight;
        const c = contentSize();
        view.tx = (c.w <= cw) ? (cw - c.w) / 2 : clamp(view.tx, cw - c.w, 0);
        view.ty = (c.h <= ch) ? (ch - c.h) / 2 : clamp(view.ty, ch - c.h, 0);
      }

      function applyView() {
        clampPan();
        const k = baseK * view.z;
        map.style.transformOrigin = 'top left';
        map.style.transform = 'translate(' + view.tx.toFixed(1) + 'px,' + view.ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
        stage.classList.toggle('zoomed', view.z > 1.01);
        zoomOut.disabled = view.z <= ZMIN + 1e-6;
        zoomIn.disabled = view.z >= ZMAX - 1e-6;
      }

      /* масштабирование относительно точки (px от левого верхнего края области) */
      function zoomAt(z, px, py) {
        const oldK = baseK * view.z;
        const newZ = clamp(z, ZMIN, ZMAX);
        if (Math.abs(newZ - view.z) < 1e-6) return;
        const newK = baseK * newZ;
        const cx = stage.clientWidth / 2;
        const cy = stage.clientHeight / 2;
        const ax = (px === undefined ? cx : px);
        const ay = (py === undefined ? cy : py);
        /* сохраняем точку под курсором/пальцем */
        const lx = (ax - view.tx) / oldK;
        const ly = (ay - view.ty) / oldK;
        view.z = newZ;
        view.tx = ax - lx * newK;
        view.ty = ay - ly * newK;
        applyView();
      }

      /* пересчёт базового масштаба под текущий размер области — БЕЗ сброса зума */
      function refit() {
        const h = stage.clientHeight;
        const w = stage.clientWidth;
        if (!h || !w) return;
        baseK = Math.max(0.12, Math.min(w / W, h / H));
        applyView();
      }

      /* «Вписать»: базовый масштаб + зум = 1 (кнопка ⤢) */
      function fit() {
        const h = stage.clientHeight;
        const w = stage.clientWidth;
        if (!h || !w) return;
        baseK = Math.max(0.12, Math.min(w / W, h / H));
        view.z = 1;
        applyView();
      }

      applyView();
      window.addEventListener('resize', refit);
      setTimeout(refit, 60);

      /* ---------- кнопки ---------- */
      zoomIn.addEventListener('click', () => zoomAt(view.z * 1.35));
      zoomOut.addEventListener('click', () => zoomAt(view.z / 1.35));
      zoomFit.addEventListener('click', fit);

      /* ---------- колесо мыши / трекпад ---------- */
      stage.addEventListener('wheel', (e) => {
        if (!e.deltaY) return;
        e.preventDefault();
        const r = stage.getBoundingClientRect();
        const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAt(view.z * f, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });

      /* ---------- тач: щипок = зум, один палец = панорама ---------- */
      let pinch = null;
      let drag = null;
      let lastTap = 0;

      const dist = (t) => {
        const dx = t[0].clientX - t[1].clientX;
        const dy = t[0].clientY - t[1].clientY;
        return Math.sqrt(dx * dx + dy * dy) || 1;
      };
      const mid = (t) => {
        const r = stage.getBoundingClientRect();
        return {
          x: (t[0].clientX + t[1].clientX) / 2 - r.left,
          y: (t[0].clientY + t[1].clientY) / 2 - r.top
        };
      };

      stage.addEventListener('touchstart', (e) => {
        const tt = e.touches;
        if (!tt || !tt.length) return;
        if (tt.length === 2) {
          pinch = { d: dist(e.touches), z: view.z };
          drag = null;
          stage.classList.add('grabbing');
        } else if (tt.length === 1) {
          const now = Date.now();
          if (now - lastTap < 300) {           /* двойной тап — приблизить/сбросить */
            lastTap = 0;
            if (view.z > 1.01) fit(); else zoomAt(2, tt[0].clientX - stage.getBoundingClientRect().left, tt[0].clientY - stage.getBoundingClientRect().top);
            return;
          }
          lastTap = now;
          drag = { x: tt[0].clientX, y: tt[0].clientY, tx: view.tx, ty: view.ty };
          if (view.z > 1.01) stage.classList.add('grabbing');
        }
      }, { passive: true });

      stage.addEventListener('touchmove', (e) => {
        const tt = e.touches;
        if (!tt || !tt.length) return;
        if (tt.length === 2 && pinch) {
          e.preventDefault();
          const z = pinch.z * (dist(tt) / pinch.d);
          const m = mid(tt);
          zoomAt(z, m.x, m.y);
        } else if (drag && tt.length === 1 && view.z > 1.01) {
          e.preventDefault();
          view.tx = drag.tx + (tt[0].clientX - drag.x);
          view.ty = drag.ty + (tt[0].clientY - drag.y);
          applyView();
        }
      }, { passive: false });

      const endTouch = () => {
        pinch = null;
        drag = null;
        stage.classList.remove('grabbing');
      };
      stage.addEventListener('touchend', endTouch);
      stage.addEventListener('touchcancel', endTouch);

      let lastSize = { w: 0, h: 0 };
      const onResize = () => {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!w || !h) return;
        if (w !== lastSize.w || h !== lastSize.h) {
          lastSize = { w: w, h: h };
          refit();          /* размер изменился — пересчитываем базу, зум сохраняем */
        }
      };
      setTimeout(onResize, 80);

      return {
        update(state) {
          onResize();
          tCores.set(G.fmt.num(state.res.cores || 0));
          tNodes.set(mech.bought(state) + ' / ' + mech.total());
          tGain.set('+' + G.prestige.gain(state) + ' ◆');
          hub.querySelector('.hub-label').textContent = G.fmt.num(state.res.cores || 0) + ' ◆';

          let next = null;
          for (const c of cards) {
            if (!G.upgrades.requirementsMet(state, c.u)) continue;
            if (G.upgrades.isMaxed(state, c.u)) continue;
            const cost = G.upgrades.currentCost(state, c.u);
            if (!next || cost < next.cost) next = { u: c.u, cost: cost };
          }
          tNext.set(next ? next.u.name + ' · ' + G.fmt.num(next.cost) + ' ◆' : 'всё куплено');

          for (const c of cards) {
            c.card.update(state);
            if (c.cell) {
              const visible = G.upgrades.requirementsMet(state, c.u) || G.lvl(state, c.u.id) > 0;
              c.cell.classList.toggle('is-hidden', !visible);
              c.cell.classList.toggle('ready', G.upgrades.canBuy(state, c.u));
            }
          }
          for (const l of lines) {
            const visible = G.upgrades.requirementsMet(state, l.u) || G.lvl(state, l.u.id) > 0;
            const done = G.lvl(state, l.u.id) > 0;
            l.el.classList.toggle('is-hidden', !visible);
            l.el.classList.toggle('done', done);
            if (l.flow) {
              l.flow.classList.toggle('is-hidden', !visible);
              l.flow.classList.toggle('done', done);
            }
          }
        }
      };
    }
  };
})(window.G = window.G || {});
