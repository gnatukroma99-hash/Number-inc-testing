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
  const W = 1200;
  const H = 440;
  const X_STEP = 128;
  const LANE = 104;
  const ZIG = 34;

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
    orb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      G.upgrades.buy(G.state, u);
      stop();
      hold = setInterval(() => G.upgrades.buy(G.state, u), 140);
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
        const lane = b.lane === 'down' ? 1 : -1;               /* верхняя или нижняя полоса */
        const list = all.filter((u) => u.branch === b.id)
          .sort((x, y) => (x.depth || 0) - (y.depth || 0));

        let prev = { x: W / 2, y: H / 2 };

        list.forEach((u, idx) => {
          const d = u.depth || 0;
          const x = W / 2 + dir * X_STEP * (d + 1);
          const y = H / 2 + lane * LANE + Math.sin(d * 1.25 + i * 1.7) * ZIG;

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
      const infoDesc = G.h('div', { class: 'info-desc', text: 'Ветви расходятся влево и вправо от центра, дальше от центра — глубже.' });
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

      const stage = G.h('div', { class: 'tree-stage' }, [map]);

      const el = G.h('div', { class: 'board-body tree-board' }, [
        G.h('p', { class: 'board-hint', text: mech.hint }),
        C.grid([tCores.el, tNodes.el, tGain.el, tNext.el]),
        legend,
        stage,
        info
      ]);
      root.appendChild(el);

      /* карта всегда целиком в кадре: масштабируем под размер области */
      function fit() {
        const h = stage.clientHeight;
        const w = stage.clientWidth;
        if (!h || !w) return;
        let k = Math.min(1, Math.min(w / W, h / H));
        /* на узких экранах не мельчим: карту можно пролистать пальцем */
        const minK = w < 700 ? 0.62 : 0.42;
        k = Math.max(minK, k);
        stage.style.overflowX = (W * k > w + 2) ? 'auto' : 'hidden';
        map.style.transformOrigin = 'top left';
        map.style.transform = 'scale(' + k.toFixed(4) + ')';
        map.style.marginLeft = Math.max(0, (w - W * k) / 2).toFixed(1) + 'px';
        map.style.marginTop = (W * k > w + 2) ? '0px' : Math.max(0, (h - H * k) / 2).toFixed(1) + 'px';
      }
      fit();
      window.addEventListener('resize', fit);
      setTimeout(fit, 60);

      return {
        update(state) {
          fit();
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
