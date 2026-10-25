/* tools/tests/tree-engine.test.js — карта-созвездие после разреза engine.js (v0.35.0).
   Запуск: NODE_PATH=<node_modules> node tools/tests/tree-engine.test.js
   Что проверяет:
     1) index.html подключает geometry.js и node.js ДО engine.js, у всех трёх ?v=VERSION;
     2) G.treeGeometry — чистые функции: radius / nodeAngle / point / nodePos / labelPos
        дают те же координаты, что раньше считал движок (дрейф угла, шаг колец, подпись ветви);
     3) четыре дерева (◆ tree, Ψ psitree, ⧜ turntree, ⌁ pacttree) открываются одним движком:
        клеток = числу узлов, скрытых = узлам без купленных предков, mech.geometry на месте,
        узлы не вылезают за карту;
     4) покупка кликом по орбу работает у каждого дерева (в т.ч. через хук pacttree.buy);
     5) в логе jsdom нет ошибок. */
'use strict';
require('../_limit')(180);

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const TREES = ['tree', 'psitree', 'turntree', 'pacttree'];
const RES = { tree: 'cores', psitree: 'psi', turntree: 'turns', pacttree: 'delta' };

let fails = 0;
const errors = [];
const okS = (n, e) => console.log('  \u2713 ' + n + (e ? '  — ' + e : ''));
const bad = (n, e) => { fails++; console.log('  \u2717 ' + n + (e ? '  — ' + e : '')); };
const check = (n, cond, e) => { (cond ? okS : bad)(n, e); return cond; };
const section = (t) => console.log('\n' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- загрузка страницы (как в tools/domtest.js) ---------- */
function loadPage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [];
  let m;
  const re = /<script\s+src="([^"]+)"/g;
  while ((m = re.exec(html))) srcs.push(m[1]);

  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  /* скрипты грузим сами: resources='usable' тянет файлы по file:// и падает */
  const cleanHtml = html.replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(cleanHtml, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  win.addEventListener('error', (e) => errors.push('window.error: ' + (e && (e.message || e.error))));

  for (const src of srcs) {
    const file = path.join(ROOT, src.split('?')[0]);
    if (!fs.existsSync(file)) { errors.push('нет файла: ' + src); continue; }
    try {
      win.eval(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push('скрипт ' + src + ': ' + e.message);
    }
  }
  return { dom, win, G: win.G, srcs };
}

/* main.js вешает boot на DOMContentLoaded — он срабатывает уже после eval всех скриптов */
async function waitBoot(win, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 3000)) {
    if (win.G && win.G.debug && win.G.state) return true;
    await sleep(25);
  }
  return false;
}

/* событие-указатель: доска читает pointerId / pointerType, у MouseEvent их нет */
function makePtr(win) {
  return function ptr(type, x, y, id, pointerType) {
    const ev = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    const extra = { pointerId: id === undefined ? 1 : id, pointerType: pointerType || 'mouse' };
    for (const k in extra) Object.defineProperty(ev, k, { value: extra[k], configurable: true });
    return ev;
  };
}

/* координаты узла так, как их считает карта: ветвь = индекс в content.branches */
function nodePositions(geo, content, nodes) {
  const branches = content.branches || [];
  const out = [];
  for (const u of nodes) {
    const bi = branches.findIndex((b) => b.id === u.branch);
    if (bi < 0) continue;
    const p = geo.nodePos(branches[bi].angle, bi, u.depth || 0, u.angleOffset);
    out.push({ u: u, x: p.x, y: p.y });
  }
  return out;
}

async function main() {
  section('1. Разрез движка: файлы и порядок подключения');
  const page = loadPage();
  const dom = page.dom;
  try {
    const { win, G, srcs } = page;
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const iGeo = html.indexOf('src/mechanics/tree/geometry.js');
    const iNode = html.indexOf('src/mechanics/tree/node.js');
    const iEngine = html.indexOf('src/mechanics/tree/engine.js');
    check('geometry.js и node.js подключены', iGeo > 0 && iNode > 0, 'geometry@' + iGeo + ', node@' + iNode);
    check('geometry.js и node.js ДО engine.js', iGeo < iEngine && iNode < iEngine,
      'engine@' + iEngine);
    check('у трёх карт-файлов ?v=' + VERSION,
      ['geometry', 'node', 'engine'].every((f) => html.indexOf('src/mechanics/tree/' + f + '.js?v=' + VERSION) >= 0));
    check('engine.js больше не держит карточку узла и геометрию',
      !/function nodeCard/.test(fs.readFileSync(path.join(ROOT, 'src/mechanics/tree/engine.js'), 'utf8')));

    const booted = await waitBoot(win, 3000);
    check('boot() отработал', booted);
    check('ошибок при загрузке нет', errors.length === 0, errors.join(' | '));

    const geo = G.treeGeometry;
    check('G.treeGeometry есть', !!geo);
    check('G.treeNode.card есть', !!(G.treeNode && typeof G.treeNode.card === 'function'));

    section('2. Геометрия: чистые функции');
    check('SIZE / HUB', geo.SIZE === 2200 && geo.HUB === geo.SIZE / 2, geo.SIZE + ' / ' + geo.HUB);
    check('radius(0)=R0, radius(3)=R0+3·RSTEP',
      geo.radius(0) === geo.R0 && geo.radius(3) === geo.R0 + 3 * geo.RSTEP,
      geo.R0 + ' · ' + geo.radius(3));
    const p0 = geo.point(0, 100);
    check('point(0°, r) — вправо от хаба',
      Math.abs(p0.x - (geo.HUB + 100)) < 1e-9 && Math.abs(p0.y - geo.HUB) < 1e-9,
      p0.x.toFixed(2) + ',' + p0.y.toFixed(2));
    const ang = geo.nodeAngle(90, 2, 3, 0);
    const angWant = 90 + Math.sin(3 * 0.8 + 2 * 1.9) * geo.DRIFT;
    check('nodeAngle = база + sin(d·0.8 + i·1.9)·DRIFT', Math.abs(ang - angWant) < 1e-9,
      ang.toFixed(4) + '°');
    const pn = geo.nodePos(90, 2, 3, 12);
    const pw = geo.point(geo.nodeAngle(90, 2, 3, 12), geo.radius(3));
    check('nodePos = point(nodeAngle, radius)', Math.abs(pn.x - pw.x) < 1e-9 && Math.abs(pn.y - pw.y) < 1e-9,
      pn.x.toFixed(2) + ',' + pn.y.toFixed(2));
    const pl = geo.labelPos(0, 3);
    check('labelPos — за последним узлом на LABEL_PAD',
      Math.abs(pl.x - (geo.HUB + geo.radius(3) + geo.LABEL_PAD)) < 1e-9,
      pl.x.toFixed(1));
    check('LABEL_PAD = 96 (бывшее магическое число движка)', geo.LABEL_PAD === 96);

    section('3. Четыре дерева одной картой');
    const state = G.state;
    const ptr = makePtr(win);
    const doc = win.document;
    for (const id of TREES) {
      const nodes = G.registry.upgradesOf(id);
      const content = G.content[id] || {};
      const branches = content.branches || [];
      const withReq = nodes.filter((u) => u.requires && u.requires.length);
      const roots = nodes.filter((u) => !u.requires || !u.requires.length);

      /* все монеты на месте: доска должна быть доступна и узлы — покупаемы */
      state.res[RES[id]] = 1e9;
      for (const u of nodes) state.upg[u.id] = 0;
      G.ui.docks.select(id);
      G.ui.app.render(state);

      const mech = G.registry.mechanic(id);
      const mg = mech.geometry;
      check('[' + id + '] mech.geometry на месте',
        !!mg && mg.SIZE === geo.SIZE && mg.HUB === geo.HUB && mg.R0 === geo.R0 &&
        mg.RSTEP === geo.RSTEP && mg.DRIFT === geo.DRIFT,
        mg ? JSON.stringify(mg) : 'нет');

      const cells = Array.from(doc.querySelectorAll('#board .tree-cell'));
      check('[' + id + '] клеток = числу узлов', cells.length === nodes.length,
        cells.length + ' / ' + nodes.length + ', ветвей ' + branches.length);
      check('[' + id + '] карта собрана', !!doc.querySelector('#board .tree-map') &&
        !!doc.querySelector('#board .tree-hub') && !!doc.querySelector('#board .tree-zoom') &&
        doc.querySelectorAll('#board .tree-branch-label').length === branches.length,
        'подписей ветвей: ' + doc.querySelectorAll('#board .tree-branch-label').length);
      let maxDepth = 0;
      for (const u of nodes) maxDepth = Math.max(maxDepth, u.depth || 0);
      check('[' + id + '] колец глубины = maxDepth+1',
        doc.querySelectorAll('#board .tree-rings .tring').length === maxDepth + 1,
        doc.querySelectorAll('#board .tree-rings .tring').length + ' при глубине ' + maxDepth);

      /* карточка узла (node.js): орб, иконка, цена — и отдельный замок у скрытых */
      const orbs = doc.querySelectorAll('#board .tree-cell > .node:not(.unknown) > .node-orb');
      check('[' + id + '] у каждой клетки орб с ценой и иконкой',
        orbs.length === cells.length &&
        doc.querySelectorAll('#board .tree-cell > .node:not(.unknown) > .node-orb > .orb-price').length === cells.length &&
        doc.querySelectorAll('#board .tree-cell > .node:not(.unknown) > .node-orb > .orb-ico').length === cells.length,
        'орбов: ' + orbs.length + ' на ' + cells.length + ' клеток');
      check('[' + id + '] у каждой клетки есть замок',
        doc.querySelectorAll('#board .tree-cell > .node.unknown > .node-orb > .orb-ico').length === cells.length,
        'замков: ' + doc.querySelectorAll('#board .tree-cell > .node.unknown > .node-orb > .orb-ico').length);

      /* на нулях видно только корни: скрытых = узлам с requires */
      const hidden = doc.querySelectorAll('#board .tree-cell.is-hidden');
      check('[' + id + '] на старте скрыто = узлов с предками',
        hidden.length === withReq.length,
        'скрыто ' + hidden.length + ' из ' + nodes.length + ', корней ' + roots.length);
      const mismatch = [];
      for (const cell of cells) {
        const card = cell.querySelector('.node');
        const unknown = cell.querySelector('.node.unknown');
        const off = !!(card && card.style.display === 'none');
        if (off !== cell.classList.contains('is-hidden')) mismatch.push(cell.style.left + ',' + cell.style.top);
        if (!!unknown && unknown.style.display === 'none' && off) mismatch.push('замок+скрытая');
      }
      check('[' + id + '] класс is-hidden совпадает с карточкой узла',
        mismatch.length === 0, mismatch.slice(0, 3).join(' · '));

      /* узлы не вылезают за карту */
      const outside = nodePositions(geo, content, nodes)
        .filter((p) => p.x < 0 || p.y < 0 || p.x > geo.SIZE || p.y > geo.SIZE);
      check('[' + id + '] все узлы внутри карты', outside.length === 0,
        outside.length ? outside.slice(0, 3).map((p) => p.u.id).join(',') : nodes.length + ' узлов');

      /* покупка кликом по орбу корня: через canBuy/buy-хуки дерева */
      const root = roots[0];
      const rootCell = cells.find((c) => {
        const label = c.querySelector('.node-name');
        return label && label.textContent === root.name;
      });
      const orb = rootCell ? rootCell.querySelector('.node-orb') : null;
      if (check('[' + id + '] клетка корня «' + root.name + '» найдена', !!orb)) {
        const before = G.lvl(state, root.id);
        orb.dispatchEvent(ptr('pointerdown', 10, 10, 7, 'mouse'));
        orb.dispatchEvent(ptr('pointerup', 10, 10, 7, 'mouse'));
        G.ui.app.render(state);
        const after = G.lvl(state, root.id);
        check('[' + id + '] клик по орбу покупает узел', after === before + 1,
          root.id + ': ' + before + ' → ' + after);
        const boughtCell = Array.from(doc.querySelectorAll('#board .tree-cell'))
          .find((c) => {
            const label = c.querySelector('.node-name');
            return label && label.textContent === root.name;
          });
        check('[' + id + '] купленный узел помечен done',
          !!boughtCell && boughtCell.querySelector('.node').classList.contains('done'),
          boughtCell ? boughtCell.querySelector('.node').className : 'клетки нет');
        const hiddenAfter = doc.querySelectorAll('#board .tree-cell.is-hidden').length;
        check('[' + id + '] после покупки открылся следующий узел',
          hiddenAfter < hidden.length, 'скрыто ' + hidden.length + ' → ' + hiddenAfter);
      }

      G.ui.docks.select('core');
    }

    section('4. Ошибки в логе');
    check('ошибок нет', errors.length === 0, errors.slice(0, 4).join(' | '));
  } finally {
    try { dom.window.close(); } catch (e) { /* уже закрыт */ }
  }

  console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => {
  console.log('\n\u2717 тест упал: ' + (e && e.stack || e));
  process.exitCode = 1;
});
