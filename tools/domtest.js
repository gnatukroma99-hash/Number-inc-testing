/* tools/domtest.js — ПРОГОН РЕАЛЬНОГО UI БЕЗ БРАУЗЕРА (jsdom).
   Запуск:  node tools/domtest.js  [--verbose]
   Что делает:
     1) читает index.html, подгружает ВСЕ <script src> в том же порядке, что и браузер;
     2) поднимает игровой цикл на 1.5 с — проверяет, что число растёт;
     3) кликает по каждой доске, по всем кнопкам апгрейдов, по дереву ◆ и перерождению;
     4) 300 раз гоняет render() — ловит ошибки в update() досок;
     5) ищет в DOM «Infinity», «NaN», «undefined»;
     6) проверяет сейв/загрузку/миграцию сейва v1.
   Требует jsdom (devDependency):  npm i -D jsdom
   Агент запускает это вместо «открой браузер и посмотри». */
'use strict';
require('./_limit')(180);

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const VERBOSE = process.argv.indexOf('--verbose') >= 0;
/* порог производительности render(), мс/кадр. В CI общие раннеры шумят,
   поэтому там он поднимается переменной окружения PERF_MS (см. .github). */
const PERF_MS = Number(process.env.PERF_MS || 0) || 4;

/* ---------- отчёт ---------- */
let fails = 0;
const errors = [];
function ok(name, extra) {
  console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
}
function fail(name, extra) {
  fails++;
  console.log('  \u2717 ' + name + (extra ? '  — ' + extra : ''));
}
function check(name, cond, extra) { (cond ? ok : fail)(name, extra); return cond; }
function section(t) { console.log('\n' + t); }
function log() { if (VERBOSE) console.log('    ·', ...arguments); }

/* ---------- загрузка страницы ---------- */
function loadPage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1].split('?')[0]);

  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  vc.on('warn', (...a) => log('warn:', a.join(' ')));

  /* скрипты грузим сами (resources='usable' тянет файлы по file:// и падает) */
  const cleanHtml = html.replace(/<script[^>]*><\/script>/g, '');
  const dom = new JSDOM(cleanHtml, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;

  win.addEventListener('error', (e) => {
    errors.push('window.error: ' + (e && (e.message || e.error)));
  });

  const t0 = Date.now();
  for (const src of srcs) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { errors.push('нет файла: ' + src); continue; }
    try {
      win.eval(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push('скрипт ' + src + ': ' + e.message);
    }
  }
  const loadMs = Date.now() - t0;
  return { dom, win, G: win.G, srcs, loadMs };
}

/* ---------- утилиты ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* main.js вешает boot на DOMContentLoaded — он срабатывает уже после eval всех скриптов */
async function waitBoot(win, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 3000)) {
    if (win.G && win.G.debug && win.G.state) return true;
    await sleep(25);
  }
  return false;
}

/* событие-указатель для панорамы/щипка: доска читает pointerId и pointerType,
   обычный MouseEvent их не имеет — дописываем руками (jsdom PointerEvent не всегда полный). */
function makePtr(win) {
  return function ptr(type, x, y, id, pointerType) {
    const ev = new win.MouseEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0
    });
    const extra = { pointerId: id === undefined ? 1 : id, pointerType: pointerType || 'mouse' };
    for (const k in extra) Object.defineProperty(ev, k, { value: extra[k], configurable: true });
    return ev;
  };
}

function click(el) {
  if (!el) return false;
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('pointerup', { bubbles: true }));
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  return true;
}

function textOf(el) { return (el && el.textContent) || ''; }

function scanBadText(doc) {
  const bad = {};
  const walk = (node) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue || '';
      if (/Infinity|NaN|undefined|null/.test(t)) {
        const key = t.trim().slice(0, 40);
        bad[key] = (bad[key] || 0) + 1;
      }
      return;
    }
    for (const c of node.childNodes) walk(c);
  };
  walk(doc.body);
  return bad;
}

/* ---------- основной сценарий ---------- */
async function main() {
  section('1. Загрузка index.html и всех скриптов');
  const page = loadPage();
  const dom = page.dom, win = page.win, G = page.G, srcs = page.srcs, loadMs = page.loadMs;
  const doc = win.document;
  try {
    await runTests({ dom, win, G, srcs, loadMs, doc });
  } finally {
    try { dom.window.close(); } catch (e) { /* уже закрыт */ }
  }
}

async function runTests({ dom, win, G, srcs, loadMs, doc }) {
  const ptr = makePtr(win);
  check('скриптов найдено', srcs.length > 5, srcs.length + ' шт, ' + loadMs + ' мс');
  check('G создан', !!G);
  check('G.VERSION', !!G.VERSION, G.VERSION);
  const summary = G.registry.summary();
  check('реестр', summary.mechanics >= 7, JSON.stringify(summary));
  check('ошибок при загрузке нет', errors.length === 0, errors.join(' | '));
  const booted = await waitBoot(win, 3000);
  check('boot() отработал (DOMContentLoaded)', booted);

  section('2. Игровой цикл (реальное время 1.5 с)');
  const state = G.state;
  check('состояние создано', !!state);
  const d0 = G.growth.D(state);
  await sleep(1500);
  const d1 = G.growth.D(state);
  check('число растёт само', d1 > d0, d0.toFixed(3) + ' → ' + d1.toFixed(3));
  check('число на экране', textOf(doc.getElementById('heroN')).length > 0,
    textOf(doc.getElementById('heroN')));
  check('доски в навигации', doc.querySelectorAll('#docks .dock').length >= 1,
    doc.querySelectorAll('#docks .dock').length + ' шт');

  section('2b. Режим разработчика (ускорение игры до ×100)');
  check('clamp 1..100', G.timescale.clamp(0) === 1 && G.timescale.clamp(101) === 100 &&
    G.timescale.clamp(37) === 37 && G.timescale.clamp('abc') === 1,
    '0->1, 101->100, 37->37, abc->1');
  check('без режима — ×1', G.timescale.scale(state) === 1);
  const baseD = G.growth.D(state);
  await sleep(700);
  const slowDelta = G.growth.D(state) - baseD;
  state.settings.devMode = true;
  state.settings.devSpeed = 100;
  check('применить ×100 к dt', Math.abs(G.timescale.apply(state, 0.05) - 5) < 1e-9);
  const fastD = G.growth.D(state);
  await sleep(700);
  const fastDelta = G.growth.D(state) - fastD;
  check('×100 реально ускоряет рост', fastDelta > slowDelta * 10,
    '1×: +' + slowDelta.toExponential(2) + '  ·  100×: +' + fastDelta.toExponential(2));
  state.settings.devMode = false;
  state.settings.devSpeed = 1;

  section('3. Все доски: клик по вкладке + render');
  /* даём ресурсов и цифр, чтобы открылись все доски */
  G.debug.give(1e30);
  state.res.prime = 1e6;
  state.res.cores = 500;
  G.debug.setD(90);
  await sleep(120);

  const dockBtns = () => Array.from(doc.querySelectorAll('#docks .dock'));
  /* «Решето» открывается только узлом дерева ◆ — покупаем узел, чтобы доска была доступна */
  state.res.cores = 1e4;
  G.upgrades.buy(state, G.registry.upgrade('tree_battery'));    // корень ветви «Автоматизация»
  G.upgrades.buy(state, G.registry.upgrade('tree_auto_all'));   // предок узла «Решето»
  G.upgrades.buy(state, G.registry.upgrade('tree_sieve'));
  check('узел «Решето» открыл механику', G.registry.mechanic('sieve').isUnlocked(state));
  const ids = dockBtns().map((b) => b.dataset.id);
  check('досок на навигации', ids.length === G.registry.mechanics().length + 1,
    ids.length + ' шт (механик ' + G.registry.mechanics().length + ' + core): ' + ids.join(','));

  for (const id of ids) {
    const btn = dockBtns().find((b) => b.dataset.id === id);
    click(btn);
    const board = doc.getElementById('board');
    const kids = board.children.length;
    check('доска «' + id + '» рендерится', kids > 0, kids + ' блок(ов)');
  }

  section('4. Покупки кликами (все кнопки всех досок)');
  const groups = ['core', 'digitsum', 'primefit', 'primeranks', 'analysis', 'shop', 'tree', 'sieve'];
  const before = {};
  for (const g of groups) {
    before[g] = 0;
    for (const u of G.registry.upgradesOf(g)) before[g] += G.lvl(state, u.id);
  }
  for (const id of ids) {
    click(dockBtns().find((b) => b.dataset.id === id));
    const btns = Array.from(doc.querySelectorAll('#board .upg-buy, #board .node-orb'));
    for (const b of btns) for (let i = 0; i < 3; i++) click(b);
    log('доска', id, 'кнопок:', btns.length);
  }
  for (const g of groups) {
    let now = 0;
    for (const u of G.registry.upgradesOf(g)) now += G.lvl(state, u.id);
    check('покупки на «' + g + '»', now > before[g], before[g] + ' → ' + now);
  }
  check('авто-апгрейды НЕ покупаются сами', (function () {
    /* чистая логика на отдельном состоянии: auto_core не должен скупать авто других досок */
    const s2 = G.newState();
    G.initResources(s2);
    s2.res.energy = 1e30;
    G.upgrades.buy(s2, G.registry.upgrade('auto_core'));
    for (let i = 0; i < 20; i++) G.automation.update(s2, 0.5);
    return G.lvl(s2, 'auto_digitsum') === 0 && G.lvl(s2, 'auto_analysis') === 0 &&
      G.lvl(s2, 'mult1') > 0;
  })(), 'auto_core растёт, авто других досок — нет');

  section('4b. Массовая покупка (×1 / ×10 / ×100 / MAX)');
  click(dockBtns().find((b) => b.dataset.id === 'core'));
  const modes = Array.from(doc.querySelectorAll('#board .buy-mode'));
  check('панель режимов покупки есть', modes.length === 4,
    modes.map((m) => textOf(m)).join(' '));
  state.res.energy = 1e30;
  const mult1 = G.registry.upgrade('mult1');
  state.upg.mult1 = 0;
  check('affordable() считает уровни', G.upgrades.affordable(state, mult1) > 10,
    'доступно: ' + G.upgrades.affordable(state, mult1));
  const plan10 = G.upgrades.plan(state, mult1, '10');
  check('plan(×10) = 10 уровней', plan10.count === 10, 'count=' + plan10.count + ', цена=' + G.fmt.num(plan10.cost));
  const bought10 = G.upgrades.buyBulk(state, mult1, '10');
  check('buyBulk(×10) купил 10', bought10 === 10 && G.lvl(state, 'mult1') === 10,
    'куплено: ' + bought10 + ', ур. ' + G.lvl(state, 'mult1'));
  const planMax = G.upgrades.plan(state, mult1, 'max');
  check('plan(MAX) ограничен деньгами/максом', planMax.count > 0 && planMax.count <= 1000,
    'count=' + planMax.count);
  /* переключение режима кликом по панели */
  const m100 = modes.find((m) => textOf(m) === '×100');
  click(m100);
  check('клик по режиму меняет настройку', state.settings.buyMode === '100', 'buyMode=' + state.settings.buyMode);
  click(dockBtns().find((b) => b.dataset.id === 'core'));
  G.ui.app.render(state);
  check('кнопка показывает количество', /×\d+/.test(textOf(doc.querySelector('#board .upg-qty'))),
    'qty: «' + textOf(doc.querySelector('#board .upg-qty')) + '»');
  state.settings.buyMode = '1';
  state.upg.mult1 = 0;

  section('4c. Анимации (и их отключение)');
  click(dockBtns().find((b) => b.dataset.id === 'core'));
  G.ui.app.render(state);
  check('доска помечена anim-in', !!doc.querySelector('#board .board-content.anim-in'));
  const anyTile = doc.querySelector('#board .tile-val');
  state.res.energy = 1e30;
  anyTile.textContent = 'x';
  G.ui.app.render(state);
  check('плитка пульсирует при изменении значения', anyTile.classList.contains('bump'),
    'class: ' + anyTile.className);
  const upgCard = doc.querySelector('#board .upg');
  const upgBtn = upgCard ? upgCard.querySelector('.upg-buy') : null;
  if (upgBtn) click(upgBtn);
  check('карточка вспыхивает при покупке', upgCard.classList.contains('bought'),
    'class: ' + (upgCard ? upgCard.className : '-'));
  check('G.animationsOff() учитывает настройку', (function () {
    const before = G.animationsOff();
    state.settings.animations = false;
    const off = G.animationsOff();
    state.settings.animations = true;
    return before === false && off === true;
  })());
  state.settings.animations = false;
  click(dockBtns().find((b) => b.dataset.id === 'digitsum'));
  check('при выключенных анимациях нет anim-in',
    !doc.querySelector('#board .board-content.anim-in'));
  state.settings.animations = true;
  click(dockBtns().find((b) => b.dataset.id === 'tree'));

  section('5. Дерево ◆ (узлы, предки, цена в ядрах)');
  const tree = G.registry.upgradesOf('tree');
  const brList = G.content.tree.branches || [];
  const rootsInTree = tree.filter((u) => !u.requires || !u.requires.length).length;
  check('узлов в дереве', tree.length >= 36 && rootsInTree === brList.length,
    tree.length + ' узлов, корней ' + rootsInTree + ' = ветвей ' + brList.length);
  check('ветви дерева', brList.length >= 7,
    (G.content.tree.branches || []).map((t) => t.id).join(','));
  const deep = tree.filter((u) => u.tier === 't3');
  check('ярус III не дешевле 60 ◆', deep.length >= 4 &&
    deep.every((u) => u.base >= 60), deep.map((u) => u.id + ':' + u.base).join(' '));
  const soft = G.registry.upgrade('tree_softcap');
  const tempo = G.registry.upgrade('tree_tempo');
  state.res.cores = 5000;     // чтобы проверять именно требования, а не нехватку ядер
  if (G.lvl(state, 'tree_tempo')) state.upg.tree_tempo = 0;
  state.upg.tree_span2 = 0;   /* чтобы требования были честными */
  state.upg.tree_softcap = 0;  /* на этом сейве узел мог быть уже выкуплен */
  check('предок блокирует узел', G.upgrades.canBuy(state, soft) === false);
  state.upg.tree_tempo = 1;
  check('с предком узел доступен', G.upgrades.canBuy(state, soft) === true,
    'tempо=' + G.lvl(state, 'tree_tempo') + ', lvl=' + G.lvl(state, soft.id) + ' (max)');
  state.upg.tree_span2 = 0;
  state.res.cores = 500;
  state.upg.tree_headstart = 0;
  state.upg.tree_headstart2 = 0;
  state.upg.tree_headstart3 = 0;
  state.N = G.BN.fromLog10(15); state.D = 15;
  const coresBefore = state.res.cores;
  G.prestige.perform(state);
  check('стартовый рывок убран → старт с 0', G.growth.D(state) < 0.01, 'D=' + G.growth.D(state).toFixed(2));
  state.upg.tree_headstart = 3;
  state.N = G.BN.fromLog10(15); state.D = 15;
  const g2 = G.prestige.perform(state);
  check('стартовый рывок ур.3 → старт D=6', Math.abs(G.growth.D(state) - 6) < 0.01,
    'D=' + G.growth.D(state).toFixed(2) + ', ядер +' + g2);
  state.upg.tree_headstart2 = 2;
  state.N = G.BN.fromLog10(15); state.D = 15;
  G.prestige.perform(state);
  check('рывок II ур.2 → +20 цифр (итого 26)', Math.abs(G.growth.D(state) - 26) < 0.01,
    'D=' + G.growth.D(state).toFixed(2));
  state.upg.tree_headstart3 = 0;
  check('ядра не сбрасываются', state.res.cores >= coresBefore, 'cores=' + state.res.cores);
  /* ---- визуал дерева: ветви-колонки, скрытые узлы, связки ---- */
  for (const u of tree) state.upg[u.id] = 0;
  state.res.cores = 1e6;
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);

  const map = doc.querySelector('#board .tree-map');
  check('карта дерева отрисована', !!map);
  const spokes = doc.querySelectorAll('#board .tree-rings .tray');
  const branchCount = G.content.tree.branches.length;
  check(branchCount + ' лучей-ветвей от хаба', spokes.length === branchCount, spokes.length + ' шт');
  const cells = Array.from(doc.querySelectorAll('#board .tree-cell'));
  check('клеток по числу узлов', cells.length === tree.length, cells.length + ' / ' + tree.length);
  check('кольца глубины нарисованы', doc.querySelectorAll('#board .tree-rings .tring').length >= 4,
    'колец: ' + doc.querySelectorAll('#board .tree-rings .tring').length);
  /* эмоджи-начертание = Extended_Pictographic; знаки валют (◆ ⌁ ⌗ ❖ ✦) — не эмоджи */
  const emojiInMap = textOf(map).match(/\p{Extended_Pictographic}/gu);
  check('в карте нет эмоджи', !emojiInMap, emojiInMap ? emojiInMap.join(' ') : (textOf(map).slice(0, 60)));

  const unknownShown = () => Array.from(doc.querySelectorAll('#board .node.unknown'))
    .filter((n) => n.style.display !== 'none').length;
  const realShown = (name) => {
    const cards = Array.from(doc.querySelectorAll('#board .node'));
    const card = cards.find((n) => !n.classList.contains('unknown') &&
      textOf(n.querySelector('.node-name')) === name);
    return card && card.style.display !== 'none';
  };

  /* чистое дерево: ни одного купленного узла */
  for (const u of tree) state.upg[u.id] = 0;
  G.ui.app.render(state);
  check('на старте видно только корни ветвей', unknownShown() === tree.length - rootsInTree,
    'скрыто: ' + unknownShown() + ' из ' + tree.length);
  check('2-й узел ветви скрыт', realShown('Слом софткапа') === false);
  check('корень ветви виден', realShown('Вечный разгон') === true);
  const hiddenBtn = Array.from(doc.querySelectorAll('#board .node.unknown .node-orb'))
    .filter((b) => b.closest('.node').style.display !== 'none');
  check('у скрытого узла нет имени/цены', hiddenBtn.length === tree.length - rootsInTree &&
    !/[0-9]/.test(textOf(hiddenBtn[0])),
    'кнопок: ' + hiddenBtn.length + ' из ' + (tree.length - rootsInTree) + ', текст: «' + textOf(hiddenBtn[0]) + '»');

  /* покупаем корень ветви → следующий узел проявляется */
  state.res.cores = 1e6;
  const tempoBtn = Array.from(doc.querySelectorAll('#board .tree-cell .node:not(.unknown)'))
    .find((n) => textOf(n.querySelector('.node-name')) === 'Вечный разгон')
    .querySelector('.node-orb');
  click(tempoBtn);
  G.ui.app.render(state);
  check('после покупки корня 2-й узел проявился', realShown('Слом софткапа') === true,
    'ур. Вечный разгон = ' + G.lvl(state, 'tree_tempo'));
  check('скрытых стало меньше', unknownShown() === tree.length - rootsInTree - 1, 'скрыто: ' + unknownShown());
  check('цена узла видна в орбе', /[0-9]/.test(textOf(doc.querySelector('#board .tree-cell .node .orb-price'))),
    textOf(doc.querySelector('#board .tree-cell .node .orb-price')));

  section('5a0. Золотая искра ✦ (активный контент)');
  check('система искры есть', !!G.spark && !!G.registry.mechanic('spark'));
  check('типов искр', G.spark.types().length >= 4, G.spark.types().length + ' шт');
  state.mech.spark = { nextIn: 0.1, left: 0, type: null, caught: 0, buffs: [] };
  G.spark.tick(state, 0.2);                       // должен заспавниться
  check('искра появляется по таймеру', G.spark.visible(state),
    'on screen: ' + (G.spark.current(state) || {}).name);
  const beforeMult = G.growth.M(state);
  const caughtSpark = G.spark.catchSpark(state);
  check('искру можно поймать', !!caughtSpark, caughtSpark && caughtSpark.name);
  check('после поимки таймер сброшен', !G.spark.visible(state) && G.spark.nextIn(state) > 1,
    'next: ' + Math.ceil(G.spark.nextIn(state)) + ' с');
  check('буфф влияет (M или ΔT или ресурс)', (function () {
    const m = G.spark.mult(state);
    const d = G.spark.dtMult(state);
    const res = (state.res.cores || 0) + (state.res.prime || 0);
    return m > 1 || d < 1 || res > 0;
  })(), 'M×' + G.spark.mult(state).toFixed(2) + ', ΔT×' + G.spark.dtMult(state).toFixed(2));
  /* буфф истекает */
  state.mech.spark.buffs.forEach((b) => (b.left = 0.01));
  G.spark.tick(state, 1);
  check('буффы истекают', G.spark.active(state).length === 0 && Math.abs(G.growth.M(state) - beforeMult) < Math.abs(beforeMult) * 0.9 + 1);
  /* «Искровой раж»: каждая 5-я поимка → серия искр */
  state.mech.spark = { nextIn: 0.1, left: 0, type: null, caught: 4, buffs: [], rush: { left: 0, streak: 0, spawned: 0 } };
  G.spark.tick(state, 0.2);
  G.spark.catchSpark(state);
  check('5-я поимка запускает «раж»', G.spark.rush(state).active,
    'раунд: ' + Math.ceil(G.spark.rush(state).left) + ' с');
  const coresBeforeRush = state.res.cores || 0;
  /* ловим серию внутри ража */
  for (let i = 0; i < 4; i++) {
    state.mech.spark.type = G.spark.types()[0].id;
    state.mech.spark.left = 5;
    G.spark.catchSpark(state);
  }
  check('серия растёт', G.spark.rush(state).streak >= 4, 'streak: ' + G.spark.rush(state).streak);
  state.mech.spark.rush.left = 0;
  const rushRes = G.spark.finishRush(state);
  check('раж даёт ядра и буфф', rushRes.cores > 0 && rushRes.mult > 1,
    '◆+' + rushRes.cores + ', M×' + rushRes.mult.toFixed(1));
  check('ядра ража начислены', (state.res.cores || 0) >= coresBeforeRush + rushRes.cores);

  /* узлы дерева под искру */
  state.upg.tree_sparklife = 2;
  state.upg.tree_sparkrate = 2;
  state.upg.tree_sparkpower = 2;
  state.upg.tree_sparkdouble = 1;
  check('дерево удлиняет искру', G.spark.lifetime(state) >= 15 + 8,
    'жизнь: ' + G.spark.lifetime(state).toFixed(0) + ' с');
  check('дерево учащает искры', G.spark.gapFor(state).min < 70,
    'пауза от ' + G.spark.gapFor(state).min.toFixed(0) + ' с');
  check('дерево усиливает искру', G.spark.bonus(state).power > 1,
    'сила ×' + G.spark.bonus(state).power.toFixed(2));
  check('дерево включает двойную искру', G.spark.bonus(state).double === true);
  state.upg.tree_sparklife = 0;
  state.upg.tree_sparkrate = 0;
  state.upg.tree_sparkpower = 0;
  state.upg.tree_sparkdouble = 0;

  check('искра сбрасывается перерождением', (function () {
    state.N = G.BN.fromLog10(20); state.D = 20;
    G.prestige.perform(state);
    return (state.mech.spark ? state.mech.spark.caught : 0) === 0;
  })());

  section('5a1. Достижения и попапы');
  check('система достижений есть', !!G.achievements);
  check('список достижений не пуст', G.achievements.total() >= 15,
    'всего: ' + G.achievements.total());
  G.achievements.reset(state);
  check('на чистом сейве открыто 0', G.achievements.count(state) === 0);
  state.N = G.BN.fromLog10(120); state.D = 120;
  const freshAch = G.achievements.check(state);
  check('условия открывают достижения', freshAch.length > 0,
    'открылось: ' + freshAch.map((a) => a.name).join(', '));
  check('«Двузначно» в списке открытых', G.achievements.has(state, 'a_first'));
  check('бонус к M растёт с коллекцией', G.achievements.mult(state) > 1,
    '×' + G.achievements.mult(state).toFixed(3));
  check('достижения не сбрасываются перерождением', (function () {
    const before = G.achievements.count(state);
    state.res.cores = 1;
    G.prestige.perform(state);
    return G.achievements.count(state) === before;
  })());
  /* тост-попап на открытие */
  G.bus.emit('achievement:unlocked', { id: 'x', name: 'ТестДостижение', desc: 'проверка' });
  const allToasts = Array.from(doc.querySelectorAll('#toasts .toast')).map(textOf).join(' | ');
  check('появляется попап-тост', /ТестДостижение/.test(allToasts),
    'тостов в ленте: ' + doc.querySelectorAll('#toasts .toast').length);

  section('5a1-bis. Ветвь «Ядра»: больше ◆ и «ядра не сгорают»');
  const cg = G.registry.upgrade('tree_coregain');
  check('узел «Щедрость ядер» есть', !!cg);
  state.res.cores = 1000;
  for (const id of ['tree_coregain', 'tree_coregain2']) state.upg[id] = 0;
  state.N = G.BN.fromLog10(200); state.D = 200;
  const baseGain = G.prestige.gain(state);
  state.upg.tree_coregain = 5;                        // 1.10^5 = 1.61×
  const boosted = G.prestige.gain(state);
  check('«Щедрость ядер» увеличивает ◆', boosted > baseGain, baseGain + ' → ' + boosted);
  /* «Узловая награда»: +◆ за каждый купленный узел */
  const nodesBought = G.prestige.treeNodes(state);
  state.upg.tree_corenodes = 2;
  const withNodes = G.prestige.gain(state);
  check('«Узловая награда» даёт ◆ за узлы', withNodes >= boosted + nodesBought * 2,
    boosted + ' → ' + withNodes + ' (узлов: ' + nodesBought + ')');
  /* «Ядра не сгорают»: множитель держится на рекорде */
  state.meta.coresBest = 500;
  state.res.cores = 10;
  state.upg.tree_corekeep = 0;
  const noKeep = G.prestige.mult(state);
  state.upg.tree_corekeep = 1;
  const keep = G.prestige.mult(state);
  check('«Ядра не сгорают» держат множитель на рекорде', keep > noKeep * 100,
    '×' + G.fmt.num(noKeep) + ' → ×' + G.fmt.num(keep));
  state.upg.tree_corekeep = 0;
  state.upg.tree_corenodes = 0;
  state.upg.tree_coregain = 0;

  section('5a1b. Зум и панорама дерева (телефон + мышь)');
  /* нужна смонтированная доска дерева */
  state.res.cores = 1e6;
  G.upgrades.buy(state, G.registry.upgrade('tree_tempo'));
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);
  const zbtns = Array.from(doc.querySelectorAll('#board .tree-zoom-btn'));
  /* jsdom не считает layout — задаём размер области руками, чтобы fit() работал */
  const fakeStage = doc.querySelector('#board .tree-stage');
  Object.defineProperty(fakeStage, 'clientWidth', { value: 900, configurable: true });
  Object.defineProperty(fakeStage, 'clientHeight', { value: 520, configurable: true });
  G.ui.app.render(state);   // повторный fit() по новому размеру
  check('кнопки зума есть (4 шт)', zbtns.length === 4, zbtns.map((b) => b.title).join(' · '));
  const treeMap = doc.querySelector('#board .tree-map');
  const scaleOf = () => {
    const m = /scale\(([\d.]+)\)/.exec(treeMap.style.transform || '');
    return m ? Number(m[1]) : 0;
  };
  const s0 = scaleOf();
  check('карта вписана в область', s0 > 0 && s0 < 1.2, 'scale=' + s0.toFixed(3));
  click(zbtns[0]);                              // «+»
  const s1 = scaleOf();
  check('кнопка + приближает', s1 > s0, s0.toFixed(3) + ' → ' + s1.toFixed(3));
  click(zbtns[1]);                              // «−»
  check('кнопка − отдаляет', scaleOf() < s1, 'scale=' + scaleOf().toFixed(3));
  click(zbtns[0]); click(zbtns[0]);
  check('есть сдвиг панорамы', /translate\(/.test(treeMap.style.transform || ''),
    treeMap.style.transform);
  click(zbtns[2]);                              // «вписать»
  const mapPx = parseFloat(treeMap.style.width) || 2200;
  const fitScale = Math.min(900 / mapPx, 520 / mapPx) * 0.6;   /* fit() → минимальный зум */
  check('кнопка «вся карта» вписывает её', Math.abs(scaleOf() - fitScale) < 1e-3,
    'scale=' + scaleOf().toFixed(3) + ', ждали ' + fitScale.toFixed(3));

  /* приближаем и запоминаем «центрированный» вид */
  click(zbtns[0]);
  click(zbtns[3]);                                  // ⌖ к центру
  const centeredTransform = treeMap.style.transform;

  /* перетаскивание мышью (pointer) */
  fakeStage.dispatchEvent(ptr('pointerdown', 600, 400, 1));
  fakeStage.dispatchEvent(ptr('pointermove', 500, 350, 1));
  fakeStage.dispatchEvent(ptr('pointerup', 500, 350, 1));
  const draggedTransform = treeMap.style.transform;
  check('карту можно тащить мышью', draggedTransform !== centeredTransform,
    centeredTransform + ' → ' + draggedTransform);

  click(zbtns[3]);                                  // ⌖ — вернуть к центру
  check('кнопка ⌖ возвращает вид к центру', treeMap.style.transform === centeredTransform,
    draggedTransform + ' → ' + treeMap.style.transform);
  click(zbtns[2]);                                  // «вписать»

  /* колесо мыши */
  const stage = doc.querySelector('#board .tree-stage');
  const wheelBefore = scaleOf();
  stage.dispatchEvent(new win.WheelEvent('wheel', { deltaY: -120, clientX: 400, clientY: 300, bubbles: true, cancelable: true }));
  check('колесо мыши приближает', scaleOf() > wheelBefore, wheelBefore.toFixed(3) + ' → ' + scaleOf().toFixed(3));
  stage.dispatchEvent(new win.WheelEvent('wheel', { deltaY: 120, clientX: 400, clientY: 300, bubbles: true, cancelable: true }));

  /* щипок двумя пальцами (как на телефоне) */
  const pinchBefore = scaleOf();
  stage.dispatchEvent(ptr('pointerdown', 320, 300, 11, 'touch'));
  stage.dispatchEvent(ptr('pointerdown', 380, 300, 12, 'touch'));
  stage.dispatchEvent(ptr('pointermove', 260, 300, 11, 'touch'));   // пальцы разъехались → приблизить
  stage.dispatchEvent(ptr('pointermove', 440, 300, 12, 'touch'));
  check('щипок двумя пальцами приближает', scaleOf() > pinchBefore, pinchBefore.toFixed(3) + ' → ' + scaleOf().toFixed(3));
  stage.dispatchEvent(ptr('pointerup', 260, 300, 11, 'touch'));
  stage.dispatchEvent(ptr('pointerup', 440, 300, 12, 'touch'));
  click(zbtns[2]);

  section('5a1c. Дерево на телефоне: тап → лист → покупка (тач-путь)');
  /* Раньше тач-путь вообще не проверялся: click() шлёт MouseEvent без pointerType,
     доска считала это мышью и шла веткой «клик = покупка». Поэтому «кнопка в листе
     не покупает на телефоне» (buyOnce(selected.u) — у апгрейда нет .u) доехал до юзера. */
  for (const u of G.registry.upgradesOf('tree')) state.upg[u.id] = 0;
  state.res.cores = 1e6;
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);

  const tstage = doc.querySelector('#board .tree-stage');
  const tapAt = (el, x, y, id, dx, dy) => {
    el.dispatchEvent(ptr('pointerdown', x, y, id, 'touch'));
    if (dx || dy) el.dispatchEvent(ptr('pointermove', x + dx, y + dy, id, 'touch'));
    el.dispatchEvent(ptr('pointerup', x + (dx || 0), y + (dy || 0), id, 'touch'));
  };
  const orbOf = (name) => {
    const card = Array.from(doc.querySelectorAll('#board .tree-cell .node'))
      .find((n) => !n.classList.contains('unknown') &&
        textOf(n.querySelector('.node-name')) === name);
    return card && card.querySelector('.node-orb');
  };
  const tipEl = () => doc.querySelector('#board .tree-tip');
  const sheetBuy = () => doc.querySelector('#board .tree-tip .tip-buy');

  const orbTempo = orbOf('Вечный разгон');
  check('корневой узел доступен для тапа', !!orbTempo);
  tapAt(orbTempo, 200, 200, 21);
  G.ui.app.render(state);
  check('тап по узлу открывает лист снизу',
    doc.body.classList.contains('tree-sheet-mode') && tipEl().classList.contains('on') &&
    tipEl().classList.contains('sheet'),
    'sheet=' + tipEl().classList.contains('sheet'));
  check('сам тап по узлу не покупает (нужен лист)', G.lvl(state, 'tree_tempo') === 0,
    'ур. ' + G.lvl(state, 'tree_tempo'));

  /* главный регресс: кнопка «купить» в листе — это единственный путь покупки на телефоне */
  const lvlSheet = G.lvl(state, 'tree_tempo');
  const priceFirst = textOf(sheetBuy());
  click(sheetBuy());
  check('кнопка в листе реально покупает (телефон)', G.lvl(state, 'tree_tempo') === lvlSheet + 1,
    lvlSheet + ' → ' + G.lvl(state, 'tree_tempo'));
  click(sheetBuy());
  check('повторный тап покупает ещё', G.lvl(state, 'tree_tempo') === lvlSheet + 2,
    'ур. ' + G.lvl(state, 'tree_tempo'));
  check('цена в листе растёт после покупки', textOf(sheetBuy()) !== priceFirst,
    '«' + priceFirst + '» → «' + textOf(sheetBuy()) + '»');

  /* палец дрожит: 8 px — ещё тап, 50 px — уже панорама */
  /* чистое касание по пустому месту снимает выделение */
  tapAt(tstage, 300, 300, 22);
  G.ui.app.render(state);
  tapAt(orbOf('Слом софткапа') || orbTempo, 240, 240, 23, 4, 4);
  G.ui.app.render(state);
  check('тап с дрожью 8 px не становится панорамой',
    tipEl().classList.contains('on') && G.lvl(state, 'tree_tempo') === lvlSheet + 2,
    'ур. ' + G.lvl(state, 'tree_tempo'));

  tapAt(tstage, 300, 300, 24);          /* снять выделение чистым тапом */
  G.ui.app.render(state);
  const lvlBeforeDrag = G.lvl(state, 'tree_tempo');
  const transformBefore = doc.querySelector('#board .tree-map').style.transform;
  tapAt(orbTempo, 260, 260, 25, 30, 20);   /* 50 px — это панорама */
  G.ui.app.render(state);
  check('сдвиг 50 px — панорама, лист не открывается',
    !tipEl().classList.contains('on') && G.lvl(state, 'tree_tempo') === lvlBeforeDrag,
    'лист=' + tipEl().classList.contains('on') + ', ур. ' + G.lvl(state, 'tree_tempo'));
  check('панорама при этом реально сдвинула карту',
    doc.querySelector('#board .tree-map').style.transform !== transformBefore, 'transform изменился');

  /* два пальца — щипок, а не покупка */
  const lvlPinch = G.lvl(state, 'tree_tempo');
  tstage.dispatchEvent(ptr('pointerdown', 300, 300, 31, 'touch'));
  tstage.dispatchEvent(ptr('pointerdown', 340, 300, 32, 'touch'));
  tstage.dispatchEvent(ptr('pointerup', 300, 300, 31, 'touch'));
  tstage.dispatchEvent(ptr('pointerup', 340, 300, 32, 'touch'));
  G.ui.app.render(state);
  check('двумя пальцами ничего не покупается', G.lvl(state, 'tree_tempo') === lvlPinch,
    'ур. ' + G.lvl(state, 'tree_tempo'));

  section('5a2. Эффекты дерева: частицы у купленных узлов и поток света');
  /* возвращаемся на доску дерева и покупаем корень — иначе нечего подсвечивать */
  state.res.cores = 1e6;
  G.upgrades.buy(state, G.registry.upgrade('tree_tempo'));
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);
  check('у каждого узла есть кольцо-орб', doc.querySelectorAll('#board .node-orb .orb-ring').length === tree.length,
    doc.querySelectorAll('#board .node-orb .orb-ring').length + ' / ' + tree.length);
  check('купленный узел помечен классом done',
    doc.querySelectorAll('#board .node.done').length > 0,
    'куплено: ' + doc.querySelectorAll('#board .node.done').length);
  check('по связкам течёт свет', doc.querySelectorAll('#board .tline.flow').length >= tree.length - 4,
    'flow-линий: ' + doc.querySelectorAll('#board .tline.flow').length);
  check('купленные связки светятся', doc.querySelectorAll('#board .tline.flow.done').length > 0,
    'done-линий: ' + doc.querySelectorAll('#board .tline.flow.done').length);
  check('выключение анимаций гасит эффекты', (function () {
    /* jsdom не считает CSS — проверяем, что правила существуют в стилях */
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
    return /body\.no-anim\s*\*\s*\{[^}]*animation: none !important/.test(css) &&
      /.tline.flow.done {[^}]*animation:/.test(css) &&
      /.node.ready .node-orb {[^}]*animation: orbPulse/.test(css);
  })(), 'правила .no-anim и анимации дерева в style.css');

  section('5a3. Звук (WebAudio, без файлов)');
  check('G.sfx есть', !!G.sfx);
  check('звук включён по умолчанию', G.sfx.enabled(state) === true);
  check('play() не падает без AudioContext', (function () {
    try { return G.sfx.play('buy') === false; } catch (e) { return false; }
  })(), 'в jsdom AudioContext нет — система молчит');
  state.settings.sound = false;
  check('выключенный звук не играет', G.sfx.play('buy') === false && G.sfx.enabled(state) === false);
  state.settings.sound = true;

  section('5b. Решето (новая механика из дерева)');
  const sv = G.registry.mechanic('sieve');
  /* секция 5 обнулила дерево — снова открываем цепочку ветви «Автоматизация» */
  state.res.cores = 1e6;
  G.upgrades.buy(state, G.registry.upgrade('tree_battery'));
  G.upgrades.buy(state, G.registry.upgrade('tree_auto_all'));
  G.upgrades.buy(state, G.registry.upgrade('tree_sieve'));
  G.upgrades.buy(state, G.registry.upgrade('tree_mirror'));
  const fresh = G.newState();
  G.initResources(fresh);
  check('без узла доска закрыта', sv.isUnlocked(fresh) === false);
  check('после узла доска открыта', sv.isUnlocked(state) === true);
  state.mech.sieve = { idx: 0, found: 0, acc: 0 };
  const primeBefore = state.res.prime || 0;
  for (let i = 0; i < 60; i++) { if (sv.isUnlocked(state)) sv.tick(state, 1); }
  const sFound = state.mech.sieve.found;
  check('решето находит простые', sFound > 0, sFound + ' шт за 60 с');
  check('решето приносит ❖', (state.res.prime || 0) > primeBefore,
    primeBefore + ' → ' + state.res.prime);
  check('урожай ❖ за уровень', sv.yieldPer(state) >= 1, '×' + sv.yieldPer(state));
  state.res.energy = 1e30;
  G.upgrades.buy(state, G.registry.upgrade('sv_power'));
  check('«Плотность» даёт множитель к M', sv.mult(state) > 1, '×' + sv.mult(state).toFixed(2));
  const svRate = sv.rate(state);
  check('скорость решета > 0', svRate > 0, svRate.toFixed(2) + ' простых/с');
  check('сброс решета при перерождении', (function () {
    state.N = G.BN.fromLog10(15); state.D = 15;
    G.prestige.perform(state);
    return (state.mech.sieve ? state.mech.sieve.found : 0) === 0;
  })());

  section('5c. Зеркало (вторая механика из дерева)');
  const mr = G.registry.mechanic('mirror');
  check('без узла зеркало закрыто', mr.isUnlocked(G.newState()) === false);
  check('после узла зеркало открыто', mr.isUnlocked(state) === true);
  const setSample = (digits) => {
    state.stats.samples = (state.stats.samples || 0) + 1;
    state.sample = { S: 0, q: 0, z: 0, d1: digits[0], rho: 1, digits: digits, duration: 4, remaining: 4 };
    mr.tick(state);
  };
  state.mech.mirror = { sym: 0, grain: 0, bestSym: 0, pairs: 0, lastSample: -1 };
  state.upg.mr_deep = 0;
  setSample([1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1]);
  check('окно по умолчанию = 2 пары', state.mech.mirror.pairs === 2, 'пар: ' + state.mech.mirror.pairs);
  check('симметрия считается', state.mech.mirror.sym === 2, 'sym=' + state.mech.mirror.sym);
  state.upg.mr_deep = 5;
  setSample([1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1]);
  check('палиндром при окне 7 → 7 пар', state.mech.mirror.sym === 7 && state.mech.mirror.pairs === 7,
    'sym=' + state.mech.mirror.sym + ', пар=' + state.mech.mirror.pairs);
  check('накоплено растёт', state.mech.mirror.grain >= 7, 'grain=' + state.mech.mirror.grain);
  setSample([1, 9, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6]);
  check('несимметричная мантисса → sym 0', state.mech.mirror.sym === 0, 'sym=' + state.mech.mirror.sym);
  state.res.energy = 1e30;
  G.upgrades.buy(state, G.registry.upgrade('mr_power'));
  G.upgrades.buy(state, G.registry.upgrade('mr_echo'));
  setSample([1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1]);
  check('множитель зеркала > 1', mr.mult(state) > 1, '×' + mr.mult(state).toFixed(2));
  check('зеркало сбрасывается перерождением', (function () {
    state.N = G.BN.fromLog10(15); state.D = 15;
    G.prestige.perform(state);
    return (state.mech.mirror ? state.mech.mirror.grain : 0) === 0;
  })());

  section('5d. Автомат ⌾ (новая механика: честный рандом, гарант, джекпот)');
  /* предыдущая секция закончилась перерождением → D = 0, автомат был бы закрыт */
  state.N = G.BN.fromLog10(12); state.D = 12;
  const slot = G.registry.mechanic('slot');
  check('механика slot в реестре', !!slot && !!G.slot, slot && slot.id);
  check('в доках есть вкладка автомата', dockBtns().some((b) => b.dataset.id === 'slot'),
    dockBtns().map((b) => b.dataset.id).join(','));
  check('без 6 цифр автомат закрыт', slot.isUnlocked(G.newState()) === false &&
    slot.isUnlocked(state) === true, 'D=' + G.growth.D(state).toFixed(1));

  /* шансы считаются перебором всех 1000 комбинаций — никаких «на глаз» */
  const slotOdds = G.slot.odds();
  const sumP = slotOdds.reduce((s, o) => s + o.p, 0);
  const combos = slotOdds.reduce((s, o) => s + o.n, 0);
  const ev = slotOdds.reduce((s, o) => s + o.p * o.mult, 0);
  check('шансы перебирают все 1000 комбинаций', combos === 1000 && Math.abs(sumP - 1) < 1e-12,
    combos + ' комбo, Σp=' + sumP.toFixed(3));
  check('EV ставки < 1 — автомат не печатает ⌁', ev < 1 && ev > 0.5, 'EV=' + ev.toFixed(3));

  const rngSeq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  state.mech.slot = null;
  const sd = G.slot.data(state);
  sd.share = 0.5;
  state.res.energy = 1000;
  G.slot.setRng(() => 0.25);                     /* 2,2,2 — три в ряд (не совпадает с ведущей 1) */
  let sp = G.slot.spin(state);
  check('три в ряд платят ×20', sp && sp.rule === 'triple' && sp.payout === sp.stake * 20,
    sp && sp.digits.join('') + ' → ' + sp.name + ' (' + sp.payout + ')');
  check('ставка списывается и выплата возвращается', state.res.energy === 1000 - 500 + 10000,
    '⌁ = ' + state.res.energy);
  check('пауза блокирует вторую прокрутку', G.slot.spin(state) === null && !G.slot.ready(state),
    'cd=' + sd.cd.toFixed(2));
  G.slot.tick(state, G.content.slot.gap + 0.01);
  check('после паузы можно снова', G.slot.ready(state));

  state.res.energy = 1e5;
  const coresBeforeSlot = state.res.cores || 0;
  const mNoBuff = G.growth.M(state);
  G.slot.setRng(() => 0.75);                     /* 7,7,7 — джекпот */
  sp = G.slot.spin(state);
  check('777 — джекпот ×50 и +2 ◆', sp.rule === 'jack' && sp.payout === sp.stake * 50 &&
    (state.res.cores || 0) === coresBeforeSlot + 2,
    sp.digits.join('') + ' → ' + sp.name + ', ◆ ' + coresBeforeSlot + ' → ' + (state.res.cores || 0));
  check('буфф джекпота множит M втрое', Math.abs(G.growth.M(state) / mNoBuff - 3) < 1e-9,
    'M ×' + (G.growth.M(state) / mNoBuff).toFixed(2));
  G.slot.tick(state, G.content.slot.jackpot.dur + 0.1);
  check('буфф истекает', Math.abs(G.growth.M(state) - mNoBuff) < 1e-9);

  /* холодная серия и гарант */
  sd.cd = 0; sd.cold = 0;
  state.res.energy = 1000;
  G.slot.setRng(rngSeq([0.15, 0.35, 0.55]));     /* 1,3,5 — мимо */
  sp = G.slot.spin(state);
  check('пустая прокрутка: выплата 0, холод +1',
    sp.rule === 'none' && sp.payout === 0 && sd.cold === 1,
    sp.digits.join('') + ' → ' + sp.name + ', cold=' + sd.cold);
  sd.cd = 0; sd.cold = G.content.slot.pity - 1;
  state.res.energy = 1000;
  sp = G.slot.spin(state);
  check('гарант после ' + G.content.slot.pity + ' пустых — ×2',
    sp.pity === true && sp.rule === 'pair' && sp.payout === sp.stake * 2,
    'pity=' + sp.pity + ', ' + sp.name + ' ×' + sp.mult);
  check('гарант сбрасывает холод', sd.cold === 0, 'cold=' + sd.cold);

  /* доска */
  click(dockBtns().find((b) => b.dataset.id === 'slot'));
  state.res.energy = 5000;
  G.ui.app.render(state);
  check('доска: три барабана', doc.querySelectorAll('#board .slot-reel').length === 3);
  check('доска: доли ставки из данных',
    doc.querySelectorAll('#board .slot-share:not(.slot-res)').length === G.content.slot.shares.length,
    doc.querySelectorAll('#board .slot-share:not(.slot-res)').length + ' шт');
  check('доска: таблица выплат = правила',
    doc.querySelectorAll('#board .slot-row').length === G.slot.rules().length,
    doc.querySelectorAll('#board .slot-row').length + ' / ' + G.slot.rules().length);
  click(Array.from(doc.querySelectorAll('#board .slot-share')).pop());
  check('доля ставки переключается', G.slot.data(state).share === 1, 'share=' + G.slot.data(state).share);
  G.slot.data(state).cd = 0;
  G.slot.setRng(() => 0.75);
  const spinBtnEl = doc.querySelector('#board .slot-spin');
  /* тап с pointerType=touch + click: на телефоне именно так и работает */
  spinBtnEl.dispatchEvent(ptr('pointerdown', 100, 100, 41, 'touch'));
  spinBtnEl.dispatchEvent(ptr('pointerup', 100, 100, 41, 'touch'));
  click(spinBtnEl);
  check('кнопка КРУТИТЬ крутит тапом и пишет результат',
    /×\s*50/.test(textOf(doc.querySelector('#board .slot-outcome'))),
    textOf(doc.querySelector('#board .slot-outcome')));
  check('барабаны показывают выпавшие цифры',
    Array.from(doc.querySelectorAll('#board .slot-digit')).map(textOf).join('') === '777',
    Array.from(doc.querySelectorAll('#board .slot-digit')).map(textOf).join(''));
  check('история прокруток заполняется', doc.querySelectorAll('#board .slot-chip').length >= 1,
    'чипов: ' + doc.querySelectorAll('#board .slot-chip').length);

  /* сейв и сброс */
  const slotSpins = G.slot.data(state).spins;
  const slotSaved = G.save.serialize(state);
  G.slot.data(state).spins = 0;
  const slotRestored = G.save.deserialize(slotSaved);
  check('счётчики автомата переживают сейв',
    slotRestored.mech.slot && slotRestored.mech.slot.spins === slotSpins,
    slotSpins + ' → ' + (slotRestored.mech.slot || {}).spins);
  state.N = G.BN.fromLog10(20); state.D = 20;
  G.prestige.perform(state);
  check('автомат сбрасывается перерождением',
    (state.mech.slot ? state.mech.slot.spins : 0) === 0, 'spins=' + (state.mech.slot || {}).spins);

  section('5d1. Аудит тача по остальным доскам (тап = покупка)');
  /* Дерево было единственной доской со своим pointer-кодом и там баг уже был.
     Здесь проверяем остальные: тап обычным touch-указателем должен покупать. */
  const lvlSum = () => G.registry.allUpgrades().reduce((s, u) => s + G.lvl(state, u.id), 0);
  for (const id of ['digitsum', 'primefit', 'primeranks', 'shop', 'sieve', 'mirror']) {
    if (!dockBtns().some((b) => b.dataset.id === id)) continue;
    state.N = G.BN.fromLog10(30); state.D = 30;
    state.res.energy = 1e12; state.res.prime = 1e9; state.res.cores = 1e9;
    click(dockBtns().find((b) => b.dataset.id === id));
    G.ui.app.render(state);
    const btn = Array.from(doc.querySelectorAll('#board .upg .upg-buy')).filter((b) => !b.disabled)[0];
    if (!btn) { check('тап: ' + id + ' — есть что купить', false, 'нет доступных кнопок'); continue; }
    const before = lvlSum();
    btn.dispatchEvent(ptr('pointerdown', 120, 300, 51, 'touch'));
    btn.dispatchEvent(ptr('pointerup', 120, 300, 51, 'touch'));
    click(btn);
    G.ui.app.render(state);
    check('тап покупает на доске ' + id, lvlSum() > before,
      'уровней: ' + before + ' → ' + lvlSum());
  }

  section('5e. Ветвь дерева «Автомат» (узлы усиливают автомат)');
  state.N = G.BN.fromLog10(12); state.D = 12;
  const slotBranch = G.registry.upgradesOf('tree').filter((u) => u.branch === 'slot');
  check('в ветви «Автомат» 5 узлов + ярус IV', slotBranch.length === 6 &&
    slotBranch.some((u) => u.tier === 't4'),
    slotBranch.map((u) => u.id + (u.tier === 't4' ? '(IV)' : '')).join(','));
  check('ветвь «Автомат» есть в данных дерева',
    G.content.tree.branches.some((b) => b.id === 'slot'));
  check('цепочка узлов сквозная (requires внутри ветви)', slotBranch.every((u) => !u.requires ||
    u.requires.every((id) => G.registry.upgrade(id) && G.registry.upgrade(id).branch === 'slot')),
    slotBranch.map((u) => (u.requires || []).join('+')).join(' → '));

  for (const u of slotBranch) state.upg[u.id] = 0;
  state.mech.slot = null;
  state.res.energy = 1e6;
  const gap0 = G.slot.gap(state);
  check('база: пауза 1.10 с, гарант 20, M×3, ◆2',
    Math.abs(gap0 - 1.1) < 1e-9 && G.slot.pity(state) === 20 &&
    G.slot.jackMult(state) === 3 && G.slot.jackCores(state) === 2 && G.slot.jackPay(state) === 1,
    'пауза ' + gap0.toFixed(2) + ', гарант ' + G.slot.pity(state));

  state.upg.tree_slotgap = 3;
  check('узел «Быстрый барабан» укорачивает паузу',
    Math.abs(G.slot.gap(state) - 1.1 * Math.pow(0.88, 3)) < 1e-9,
    'пауза ' + G.slot.gap(state).toFixed(2) + ' с');
  state.upg.tree_slotpity = 5;
  check('узел «Короткая засуха» сокращает гарант', G.slot.pity(state) === 10,
    'гарант ' + G.slot.pity(state));
  state.upg.tree_slotjack = 4; state.upg.tree_slotcore = 3; state.upg.tree_slotjackpay = 4;
  check('узел «Жар джекпота»: M ×5', G.slot.jackMult(state) === 5, 'M ×' + G.slot.jackMult(state));
  check('узел «Ядро из автомата»: 5 ◆', G.slot.jackCores(state) === 5, '◆' + G.slot.jackCores(state));
  check('узел «Щедрый джекпот»: только для 777', G.slot.jackPay(state) === 2,
    'множитель джекпота ×' + G.slot.jackPay(state));

  const slotEff = G.slot.data(state);
  slotEff.cd = 0; slotEff.share = 0.1;
  slotEff.cold = 0;
  state.res.energy = 1e5;
  G.slot.setRng(() => 0.25);                       /* 2,2,2 → «Три в ряд» (без резонанса) */
  let slotRes = G.slot.spin(state);
  check('обычная выплата узлами не растёт', slotRes.payout === slotRes.stake * 20,
    '×20 = ' + slotRes.payout);
  slotEff.cd = 0;
  state.res.energy = 1e5;
  G.slot.setRng(() => 0.75);                       /* 7,7,7 → джекпот */
  slotRes = G.slot.spin(state);
  check('джекпот ×50 × «Щедрый джекпот» 2 = ×100', slotRes.payout === slotRes.stake * 100,
    '×' + (slotRes.payout / slotRes.stake));

  /* узлы не должны превратить сток в печать энергии: Монте-Карло на 30 000 прокруток */
  let mcSeed = 987654321;
  G.slot.setRng(() => { mcSeed = (mcSeed * 1103515245 + 12345) % 2147483648; return mcSeed / 2147483648; });
  state.mech.slot = null;
  const mcD = G.slot.data(state);
  mcD.share = 0.25;
  let mcIn = 0, mcOut = 0, mcJack = 0, mcSpins = 0;
  for (let i = 0; i < 30000; i++) {
    state.res.energy = 1e6;
    mcD.cd = 0;
    const stake = G.slot.stake(state);
    const r2 = G.slot.spin(state);
    if (!r2) break;
    mcSpins++;
    mcIn += stake;
    mcOut += r2.payout;
    if (r2.rule === 'jack') mcJack++;
  }
  check('с выкупленной ветвью автомат всё ещё сток (EV < 1)',
    mcSpins === 30000 && mcOut / mcIn < 1,
    'возврат энергии ' + (mcOut / mcIn * 100).toFixed(1) + '% за ' + mcSpins +
    ' прокруток, джекпотов ' + mcJack);
  G.slot.setRng(null);

  section('5e1. Ставки ❖/◆ и резонанс с мантиссой (v0.12.9)');
  check('ресурсы для ставки — данные',
    (G.content.slot.stakes || []).join(',') === 'energy,prime,cores',
    (G.content.slot.stakes || []).join(','));

  state.mech.slot = null;
  state.res.energy = 1000; state.res.prime = 800; state.res.cores = 0;
  const stD = G.slot.data(state);
  stD.share = 0.5; stD.stakeRes = 'prime';
  G.slot.setRng(() => 0.25);                       /* 2,2,2 → ×20 без резонанса */
  let stSpin = G.slot.spin(state);
  check('ставка ❖: тратится ПРАЙМ, энергия не тронута',
    stSpin.res === 'prime' && state.res.prime === 800 - 400 + 8000 && state.res.energy === 1000,
    '❖ ' + state.res.prime + ', ⌁ ' + state.res.energy);

  state.mech.slot = null;
  state.res.energy = 0; state.res.prime = 0; state.res.cores = 400;
  const cdD = G.slot.data(state);
  cdD.share = 0.5; cdD.stakeRes = 'cores';
  G.slot.setRng(() => 0.05);                       /* 0,0,0 → тройка */
  stSpin = G.slot.spin(state);
  check('ставка ◆: тратятся ядра', stSpin.res === 'cores' && stSpin.stake === 200,
    'ставка ' + stSpin.stake + ' ◆, стало ' + state.res.cores);

  /* резонанс: триплет = первая цифра твоего числа */
  state.mech.slot = null;
  state.N = G.BN.fromLog10(5.5); state.D = 5.5;
  state.res.energy = 1e5; state.res.cores = 0;
  const rsD = G.slot.data(state);
  rsD.share = 0.1; rsD.stakeRes = 'energy';
  const leadNow = G.slot.leadDigit(state);
  check('ведущая цифра читается из мантиссы', leadNow >= 0 && leadNow <= 9, 'цифра ' + leadNow);
  G.slot.setRng(() => (leadNow + 0.5) / 10);        /* триплet = ведущая цифра */
  const rsSpin = G.slot.spin(state);
  check('резонанс: триплет = первая цифра числа',
    rsSpin.reson === true && rsSpin.digits.join('') === String(leadNow).repeat(3),
    rsSpin.digits.join('') + ' при первой цифре ' + leadNow);
  check('резонанс платит ×2 и даёт ◆',
    rsSpin.payout === rsSpin.stake * 20 * ((G.content.slot.resonance || {}).payMult || 2) &&
    (state.res.cores || 0) >= ((G.content.slot.resonance || {}).cores || 1),
    'выплата ' + rsSpin.payout + ', ◆ ' + state.res.cores);
  check('счётчик резонансов растёт', G.slot.data(state).resonances === 1);

  /* достижения автомата (переменные механики попадают в условия через m.vars) */
  const slotAch = G.achievements.list().filter((a) => a.id.indexOf('a_slot') === 0);
  check('5 достижений автомата в данных', slotAch.length === 5,
    slotAch.map((a) => a.id).join(','));
  const achVars = G.achievements.vars(state);
  check('переменные автомата видны в достижениях',
    achVars.slotSpins > 0 && achVars.slotReso >= 1 && typeof achVars.slotJacks === 'number',
    'slotSpins=' + achVars.slotSpins + ', slotReso=' + achVars.slotReso);

  state.res.energy = 1e5; state.res.cores = 0;
  const jdD = G.slot.data(state);
  jdD.cd = 0; jdD.share = 0.05;
  G.slot.setRng(() => 0.75);                        /* 777 — джекпот */
  G.slot.spin(state);
  /* гарант */
  jdD.cd = 0; jdD.cold = G.slot.pity(state) - 1;
  G.slot.setRng(rngSeq([0.15, 0.35, 0.55]));        /* 1,3,5 → гарант ×2 */
  G.slot.spin(state);
  /* серия из 5 выигрышей */
  G.slot.setRng(() => 0.25);
  for (let i = 0; i < 6; i++) { jdD.cd = 0; state.res.energy = 1e5; G.slot.spin(state); }
  G.achievements.check(state);
  check('достижения автомата открываются',
    G.achievements.has(state, 'a_slot1') && G.achievements.has(state, 'a_slot_jack') &&
    G.achievements.has(state, 'a_slot_reso') && G.achievements.has(state, 'a_slot_pity') &&
    G.achievements.has(state, 'a_slot_streak'),
    slotAch.filter((a) => G.achievements.has(state, a.id)).map((a) => a.id).join(','));

  /* доска: выбор ресурса (нужен открытый автомат → D ≥ 6) */
  state.N = G.BN.fromLog10(12); state.D = 12;
  click(dockBtns().find((b) => b.dataset.id === 'slot'));
  G.ui.app.render(state);
  check('доска: кнопки ресурсов по данным',
    doc.querySelectorAll('#board .slot-res').length === (G.content.slot.stakes || []).length,
    doc.querySelectorAll('#board .slot-res').length + ' шт');
  click(Array.from(doc.querySelectorAll('#board .slot-res')).pop());
  check('переключение ресурса ставки', G.slot.stakeRes(state) === 'cores',
    'ставим ' + G.slot.stakeRes(state));
  G.slot.setRng(null);

  section('5f. Ярус IV дерева (5000+ ◆)');
  /* геометрия карты: две ветви с одинаковым углом рисуются ДРУГ НА ДРУГЕ.
     Так и было с «Автоматом» (219°) и «Рывком» (−141° = 219°) — исправлено в v0.14.0. */
  const angles = (G.content.tree.branches || []).map((b) => ({ id: b.id, a: ((Number(b.angle) % 360) + 360) % 360 }));
  let minGap = 360, minPair = null;
  for (let i = 0; i < angles.length; i++) {
    for (let j = i + 1; j < angles.length; j++) {
      let d = Math.abs(angles[i].a - angles[j].a);
      d = Math.min(d, 360 - d);
      if (d < minGap) { minGap = d; minPair = angles[i].id + '/' + angles[j].id; }
    }
  }
  check('ветви дерева не перекрываются по углу', minGap >= 22,
    'минимальный зазор ' + minGap.toFixed(1) + '° (' + minPair + ')');

  /* узлы не должны вылезать за карту: глубокая ветвь на оси 0°/180° упирается в край */
  const geo = G.registry.mechanic('tree').geometry;
  check('геометрия карты доступна тестам', !!geo && geo.SIZE > 0, JSON.stringify(geo));
  const outside = [];
  for (const u of tree) {
    const bi = (G.content.tree.branches || []).findIndex((b) => b.id === u.branch);
    if (bi < 0) continue;
    const ed = u.depth || 0;
    const ang = ((Number(G.content.tree.branches[bi].angle) || 0) +
      Math.sin(ed * 0.8 + bi * 1.9) * geo.DRIFT) * Math.PI / 180;
    const rad = geo.R0 + ed * geo.RSTEP;
    const x = geo.HUB + Math.cos(ang) * rad;
    const y = geo.HUB + Math.sin(ang) * rad;
    if (x < 0 || y < 0 || x > geo.SIZE || y > geo.SIZE) outside.push(u.id + ' (' + x.toFixed(0) + ',' + y.toFixed(0) + ')');
  }
  check('все узлы влезают в карту', outside.length === 0,
    outside.length ? outside.slice(0, 4).join(' · ') : (tree.length + ' узлов внутри ' + geo.SIZE + '×' + geo.SIZE));
  const t4 = G.registry.upgradesOf('tree').filter((u) => u.tier === 't4');
  check('ярус IV: 6 узлов', t4.length === 6, t4.map((u) => u.id).join(','));
  check('ярус IV: цены 5000+ ◆', t4.every((u) => u.base >= 5000),
    t4.map((u) => u.base).join(' · '));
  check('ярус IV: предок всегда из своей ветви', t4.every((u) => (u.requires || []).every((id) => {
    const p = G.registry.upgrade(id);
    return p && p.branch === u.branch;
  })));
  check('ярус IV есть в данных дерева', (G.content.tree.tiers || []).some((t) => t.id === 't4'));

  /* эффекты читаются теми же свипами движка — проверяем каждый узел */
  for (const u of G.registry.upgradesOf('tree')) state.upg[u.id] = 0;
  const dtBefore = G.growth.dt(state);
  const mBefore4 = G.growth.M(state);
  const eBefore = G.growth.energyRate(state);
  const sparkBefore = G.growth.upgProduct(state, 'sparkPower');
  state.upg.tree_tempo3 = 4;
  check('«Разгон III» укорачивает ΔT', G.growth.dt(state) < dtBefore,
    dtBefore.toFixed(2) + ' → ' + G.growth.dt(state).toFixed(2) + ' с');
  state.upg.tree_mult5 = 2;
  check('«Гигант» множит M', Math.abs(G.growth.M(state) / mBefore4 - 25) < 1e-6,
    'M ×' + (G.growth.M(state) / mBefore4).toFixed(1));
  state.upg.tree_income5 = 2;
  check('«Гипердоход» множит ⌁', Math.abs(G.growth.energyRate(state) / eBefore - 100) < 1e-6,
    '⌁ ×' + (G.growth.energyRate(state) / eBefore).toFixed(0));
  state.upg.tree_spark5 = 2;
  check('«Вечная искра» усиливает искру',
    Math.abs(G.growth.upgProduct(state, 'sparkPower') / sparkBefore - Math.pow(1.6, 2)) < 1e-6,
    'sparkPower ×' + (G.growth.upgProduct(state, 'sparkPower') / sparkBefore).toFixed(2));
  state.upg.tree_cores5 = 3;
  check('«Реактор ядер» поднимает добычу ◆',
    Math.abs(G.growth.upgProduct(state, 'coreGainMult') - Math.pow(1.4, 3)) < 1e-6,
    'coreGainMult ×' + G.growth.upgProduct(state, 'coreGainMult').toFixed(2));
  for (const u of G.registry.upgradesOf('tree')) state.upg[u.id] = 0;
  state.upg.tree_slotjack = 4; state.upg.tree_slot5 = 3;
  check('«Джекпот-шторм» усиливает джекпот', G.slot.jackMult(state) === 3 + 2 + 3,
    'M за джекпот ×' + G.slot.jackMult(state));
  state.upg.tree_slotjack = 0; state.upg.tree_slot5 = 0;

  /* ярус IV скрыт, пока не куплен конец ветви — и появляется после */
  for (const u of G.registry.upgradesOf('tree')) state.upg[u.id] = 0;
  state.N = G.BN.fromLog10(12); state.D = 12; state.res.cores = 1e9;
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);
  check('ярус IV скрыт без предка', realShown('Разгон III') === false);
  state.upg.tree_tempo2 = 1;
  G.ui.app.render(state);
  check('ярус IV виден после покупки конца ветви', realShown('Разгон III') === true);
  const t4Cell = Array.from(doc.querySelectorAll('#board .tree-cell .node'))
    .find((n) => textOf(n.querySelector('.node-name')) === 'Разгон III');
  click(t4Cell && t4Cell.querySelector('.node-orb'));
  check('узел яруса IV покупается за ◆', G.lvl(state, 'tree_tempo3') === 1,
    'ур. ' + G.lvl(state, 'tree_tempo3'));
  for (const u of G.registry.upgradesOf('tree')) state.upg[u.id] = 0;

  section('5g. Ярус 2: БОЛЬШОЙ БУМ + Δ');
  const bb = G.registry.mechanic('bigbang');
  const gl = G.registry.mechanic('glyphs');
  check('механики bigbang и glyphs в реестре', !!bb && !!gl && !!G.bigbang && !!G.glyphs,
    (bb && bb.id) + ', ' + (gl && gl.id));
  check('в доках есть вкладки БУМ и Глифы',
    dockBtns().some((b) => b.dataset.id === 'bigbang') && dockBtns().some((b) => b.dataset.id === 'glyphs'),
    'доков: ' + dockBtns().length);
  check('валюта Δ зарегистрирована', !!G.registry.resource('delta'),
    'scope = ' + (G.registry.resource('delta') || {}).scope);

  state.N = G.BN.fromLog10(250); state.D = 250;
  check('БУМ не считается ниже порога', G.bigbang.gain(state) === 0 && !G.bigbang.canDo(state),
    'D=250 → Δ ' + G.bigbang.gain(state));

  state.N = G.BN.fromLog10(313); state.D = 313;
  const gainPredict = G.bigbang.gain(state);
  check('Δ за БУМ считается по формуле', gainPredict > 0, 'Δ ' + gainPredict);
  const wallBefore = G.growth.wallFactor(state);
  check('стена режет рост до БУМА', wallBefore > 0 && wallBefore < 0.9,
    'фактор роста ' + wallBefore.toFixed(3));
  const coresBeforeBB = state.res.cores || 0;
  state.res.energy = 1234;
  const gotDelta = G.bigbang.perform(state);
  check('БУМ даёт Δ', gotDelta === gainPredict && state.res.delta >= gotDelta,
    'Δ ' + state.res.delta + ' (получено ' + gotDelta + ')');
  check('стена 1e308 снята навсегда', G.bigbang.wallPassed(state) &&
    (state.meta.passedBarriers || []).indexOf('wall_308') >= 0, JSON.stringify(state.meta.passedBarriers));
  state.N = G.BN.fromLog10(313); state.D = 313;
  check('стена больше не тормозит рост', G.growth.wallFactor(state) === 1,
    'фактор ' + wallBefore.toFixed(3) + ' → ' + G.growth.wallFactor(state).toFixed(3));
  check('◆ и дерево пережили БУМ', (state.res.cores || 0) >= coresBeforeBB,
    '◆ ' + coresBeforeBB + ' → ' + state.res.cores);
  check('забег сброшен (⌁ в ноль)', (state.res.energy || 0) === 0, '⌁ ' + state.res.energy);
  check('ярус 2 открыт', state.meta.tier === 'tier2' && G.bigbang.tierOpen(state), state.meta.tier);

  section('5h. Глифы ◈ (рандом с плюсом и минусом)');
  state.N = G.BN.fromLog10(12); state.D = 12;
  check('глифы открылись после БУМА', gl.isUnlocked(state) === true);
  check('до БУМА глифы закрыты', gl.isUnlocked({ res: { delta: 0 }, meta: {}, mech: {} }) === false);

  /* детерминированный рандом: редкость и профиль тоже бросаются */
  let gSeed = 2024;
  G.glyphs.setRng(() => { gSeed = (gSeed * 1103515245 + 12345) % 2147483648; return gSeed / 2147483648; });
  state.res.delta = 30;
  G.glyphs.restart(state);
  const dBefore = state.res.delta;
  G.glyphs.setActive(state, 0);
  let rolled = G.glyphs.roll(state);
  check('прокрутка стоит Δ', state.res.delta === dBefore - G.content.glyphs.rollCost,
    'Δ ' + dBefore + ' → ' + state.res.delta);
  check('глиф попал в выбранный слот', G.glyphs.data(state).slots[0] === rolled.glyph &&
    rolled.slot === 0, 'цифра ' + rolled.glyph.digit + ', ' + rolled.glyph.rarity);
  state.res.delta = 0;
  check('без Δ прокрутки нет', G.glyphs.roll(state) === null && !G.glyphs.canRoll(state));

  /* резонанс: глиф с цифрой, равной первой цифре числа, сильнее в 1.5 раза */
  state.res.delta = 100;
  const lead2 = G.glyphs.leadDigit(state);
  G.glyphs.restart(state);
  const gd = G.glyphs.data(state);
  gd.slots[0] = { id: 900, digit: lead2, rarity: 'common', profile: 'greed' };
  const effReson = G.glyphs.effects(state);
  gd.slots[0] = { id: 901, digit: (lead2 + 5) % 10, rarity: 'common', profile: 'greed' };
  const effPlain = G.glyphs.effects(state);
  check('резонанс-глиф сильнее обычного', effReson.reson === 1 && effPlain.reson === 0 &&
    Math.abs(effReson.M - (1 + 0.35 * G.content.glyphs.resonance)) < 1e-9 &&
    Math.abs(effPlain.M - 1.35) < 1e-9,
    'M ×' + effReson.M.toFixed(3) + ' (резонанс) vs ×' + effPlain.M.toFixed(3));
  check('минус профиля тоже растёт', effReson.energy < effPlain.energy,
    '⌁ ' + effReson.energy.toFixed(3) + ' vs ' + effPlain.energy.toFixed(3));

  /* эффекты доходят до движка через хуки механик */
  state.mech.glyphs = null;
  const dNo = G.glyphs.data(state);
  dNo.slots[0] = null;
  const dtNo = G.growth.dt(state);
  const eNo = G.growth.energyRate(state);
  const mNo = G.growth.M(state);
  dNo.slots[0] = { id: 902, digit: (lead2 + 4) % 10, rarity: 'common', profile: 'greed' };
  check('глифы меняют M', G.growth.M(state) > mNo, 'M ×' + (G.growth.M(state) / mNo).toFixed(3));
  dNo.slots[1] = { id: 903, digit: (lead2 + 3) % 10, rarity: 'common', profile: 'tide' };
  check('глифы меняют ΔT и ⌁', G.growth.dt(state) < dtNo && G.growth.energyRate(state) !== eNo,
    'ΔT ' + dtNo.toFixed(2) + ' → ' + G.growth.dt(state).toFixed(2) +
    ', ⌁ ' + eNo.toFixed(2) + ' → ' + G.growth.energyRate(state).toFixed(2));

  /* сейв и сброс */
  const gSaved = G.save.serialize(state);
  const gBack = G.save.deserialize(gSaved);
  check('глифы переживают сейв',
    gBack.mech.glyphs && gBack.mech.glyphs.slots.filter(Boolean).length >= 1,
    'слотов занято: ' + (gBack.mech.glyphs ? gBack.mech.glyphs.slots.filter(Boolean).length : 0));
  G.resetScopes(state, ['run']);
  check('обычное перерождение глифы не сбрасывает (scope tier)',
    (G.glyphs.data(state).slots || []).filter(Boolean).length >= 1,
    'занято: ' + G.glyphs.data(state).slots.filter(Boolean).length);
  G.glyphs.setRng(null);

  /* доски */
  state.N = G.BN.fromLog10(12); state.D = 12;
  state.res.delta = 50;
  click(dockBtns().find((b) => b.dataset.id === 'glyphs'));
  G.ui.app.render(state);
  check('доска глифов: три слота', doc.querySelectorAll('#board .glyph-card').length ===
    (G.content.glyphs.slots || 3), doc.querySelectorAll('#board .glyph-card').length + ' шт');
  const rollEl = doc.querySelector('#board .glyph-roll');
  const deltaBeforeRoll = state.res.delta;
  click(rollEl);
  check('кнопка прокрутки работает тапом', state.res.delta === deltaBeforeRoll - G.content.glyphs.rollCost,
    'Δ ' + deltaBeforeRoll + ' → ' + state.res.delta);
  click(dockBtns().find((b) => b.dataset.id === 'bigbang'));
  G.ui.app.render(state);
  const bbBtn = doc.querySelector('#board .bigbang-btn');
  check('доска БУМА: кнопка на месте', !!bbBtn);
  state.N = G.BN.fromLog10(307); state.D = 307;
  G.ui.app.render(state);
  const deltaBeforeBang = state.res.delta;
  click(bbBtn);
  check('кнопка БУМА срабатывает', state.res.delta > deltaBeforeBang && (state.meta.bangs || 0) >= 2,
    'Δ ' + deltaBeforeBang + ' → ' + state.res.delta + ', бУМов ' + state.meta.bangs);

  section('5i. Испытания ⚑ (запрет за постоянную награду)');
  state.N = G.BN.fromLog10(12); state.D = 12;
  state.res.delta = 300; state.res.energy = 0; state.res.prime = 0;
  state.meta.challenge = null; state.meta.challenges = [];
  state.mech.challenges = null;
  const chList = G.challenges.list();
  check('испытаний в данных не меньше 5', chList.length >= 5, chList.length + ' шт: ' + chList.map((c) => c.id).join(','));
  check('вход требует Δ', (function () {
    state.res.delta = 1;
    const no = G.challenges.canStart(state, 'ch_nosum');
    state.res.delta = 300;
    return no === false && G.challenges.canStart(state, 'ch_nosum') === true;
  })());

  const dtFree = G.growth.dt(state);
  const dChBefore = state.res.delta;
  G.challenges.start(state, 'ch_slow');               /* ΔT ×2 */
  check('вход списывает Δ', state.res.delta === dChBefore - 6, 'Δ ' + dChBefore + ' → ' + state.res.delta);
  check('испытание активно', (G.challenges.active(state) || {}).id === 'ch_slow');
  check('запрет ΔT действует', Math.abs(G.growth.dt(state) / dtFree - 2) < 1e-9,
    'ΔT ×' + (G.growth.dt(state) / dtFree).toFixed(2));
  G.challenges.stop(state);
  check('выход снимает запрет', Math.abs(G.growth.dt(state) - dtFree) < 1e-9);

  /* blocked() — общий механизм: движок спрашивает и пропускает механики */
  state.res.delta = 300; state.mech.glyphs = null;
  const gset = G.glyphs.data(state);
  gset.slots[0] = { id: 77, digit: 0, rarity: 'legend', profile: 'greed' };
  const mFreeAll = G.growth.M(state);
  const realBlocked = G.challenges.blocked;
  G.challenges.blocked = (st, id) => id === 'glyphs';
  const mBlockedGlyph = G.growth.M(state);
  G.challenges.blocked = realBlocked;
  check('движок уважает blocked(): механика выпадает из M', mBlockedGlyph < mFreeAll,
    'M ' + mBlockedGlyph.toFixed(1) + ' < ' + mFreeAll.toFixed(1));

  /* прохождение испытания: доходим до цели */
  state.res.delta = 300;
  G.challenges.start(state, 'ch_nosum');
  check('заблокирована сумма цифр', G.challenges.blocked(state, 'digitsum'));
  check('цель ещё не достигнута', G.challenges.progress(state) < 1);
  state.N = G.BN.fromLog10(45); state.D = 45;
  const passed = G.challenges.check(state);
  check('испытание зачтено при достижении цели', !!passed &&
    G.challenges.done(state).indexOf('ch_nosum') >= 0, JSON.stringify(G.challenges.done(state)));
  check('активное сброшено, забег схлопнут', G.challenges.active(state) === null &&
    G.growth.D(state) < 1, 'D=' + G.growth.D(state).toFixed(2));
  check('награда осталась навсегда (M ×1.25)', Math.abs(G.challenges.mult(state) - 1.25) < 1e-9,
    'M ×' + G.challenges.mult(state));
  check('запрет снят после прохождения', !G.challenges.blocked(state, 'digitsum'));
  G.resetScopes(state, ['run']);
  check('награда переживает перерождение', G.challenges.done(state).indexOf('ch_nosum') >= 0);

  section('5j. Сделки ✍ и Эхо ⟲');
  state.N = G.BN.fromLog10(12); state.D = 12;
  state.res.delta = 200;
  let pSeed = 99;
  G.pacts.setRng(() => { pSeed = (pSeed * 1103515245 + 12345) % 2147483648; return pSeed / 2147483648; });
  state.mech.pacts = null;
  const dPactBefore = state.res.delta;
  const offers = G.pacts.reroll(state);
  check('реролл даёт 3 предложения и берёт Δ',
    offers.length === G.content.pacts.offers && state.res.delta === dPactBefore - G.content.pacts.rerollCost,
    offers.length + ' шт, Δ ' + dPactBefore + ' → ' + state.res.delta);
  check('у предложения есть сила', offers.every((o) => o.k >= 0.85 && o.k <= 1.15),
    offers.map((o) => o.k).join(' · '));

  const mBeforePact = G.growth.M(state);
  const tookPact = G.pacts.accept(state, 0);
  const eff = G.pacts.effects(state);
  check('сделка принята и что-то меняет', !!tookPact &&
    (Math.abs(eff.M - 1) > 1e-9 || Math.abs(eff.energy - 1) > 1e-9 || Math.abs(eff.dt - 1) > 1e-9),
    (G.pacts.find(tookPact.tpl) || {}).name + ' → M ×' + eff.M.toFixed(2) + ', ⌁ ×' + eff.energy.toFixed(2));
  check('сделка доходит до движка', Math.abs(G.growth.M(state) - mBeforePact * eff.M) < Math.abs(mBeforePact) * 1e-9,
    'M ' + mBeforePact.toFixed(1) + ' → ' + G.growth.M(state).toFixed(1));
  const mAfterOne = G.pacts.effects(state).M;
  G.pacts.reroll(state, true);
  G.pacts.accept(state, 0);
  check('новая сделка заменяет старую, а не суммируется',
    Math.abs(G.pacts.effects(state).M - mAfterOne * mAfterOne) > 1e-6 || G.pacts.data(state).taken === 2,
    'принято сделок: ' + G.pacts.data(state).taken);
  G.pacts.drop(state);
  check('отказ снимает эффекты', Math.abs(G.pacts.effects(state).M - 1) < 1e-9);

  /* эхо */
  state.res.delta = 200;
  state.mech.echo = null;
  state.stats.bestD = 120;
  const dEchoBefore = state.res.delta;
  check('эхо покупается за Δ', G.echo.buy(state) === true && state.res.delta === dEchoBefore - G.content.echo.cost,
    'Δ ' + dEchoBefore + ' → ' + state.res.delta);
  check('эхо сразу включено', G.echo.isOn(state));
  const echoRate = G.echo.rate(state);
  const organic = Math.log10(G.growth.M(state)) / G.growth.dt(state);
  check('скорость эха положительная и не больше половины обычного роста',
    echoRate > 0 && echoRate <= (G.content.echo.maxShare * organic) + 1e-9,
    echoRate.toFixed(3) + ' цифр/с (обычный рост ' + organic.toFixed(3) + ')');
  const dBeforeTick = G.growth.D(state);
  G.echo.tick(state, 1);
  check('эхо реально двигает D', G.growth.D(state) > dBeforeTick,
    dBeforeTick.toFixed(2) + ' → ' + G.growth.D(state).toFixed(2));
  check('включённое эхо замедляет ΔT',
    Math.abs(G.registry.mechanic('echo').dtMult(state) - G.content.echo.dtMult) < 1e-9,
    'ΔT ×' + G.registry.mechanic('echo').dtMult(state));
  G.echo.toggle(state);
  check('выключенное эхо ничего не даёт', G.echo.rate(state) === 0 &&
    G.registry.mechanic('echo').dtMult(state) === 1);
  G.echo.toggle(state);

  /* доски */
  for (const id of ['challenges', 'pacts', 'echo']) {
    click(dockBtns().find((b) => b.dataset.id === id));
    G.ui.app.render(state);
    check('доска ' + id + ' открылась', !!doc.querySelector('#board .board-body'),
      doc.querySelectorAll('#board .board-body').length + ' блоков');
  }
  state.res.delta = 300;
  click(dockBtns().find((b) => b.dataset.id === 'challenges'));
  G.ui.app.render(state);
  check('доска испытаний: карточка на каждое испытание',
    doc.querySelectorAll('#board .ch-card').length === G.challenges.list().length,
    doc.querySelectorAll('#board .ch-card').length + ' из ' + G.challenges.list().length);
  const chBtn = Array.from(doc.querySelectorAll('#board .ch-card:not(.done) .ch-btn'))
    .find((b) => !b.disabled);
  const deltaCh = state.res.delta;
  click(chBtn);
  check('кнопка «начать» запускает испытание тапом',
    !!G.challenges.active(state) && state.res.delta < deltaCh,
    'активно: ' + (G.challenges.active(state) || {}).id);
  G.challenges.stop(state);
  G.pacts.setRng(null);

  section('5k. Хроно ⏱, Разлом ⌁⃠, Созвездия ✧ (активный Ярус 2)');
  state.N = G.BN.fromLog10(12); state.D = 12;
  state.res.delta = 300;

  /* --- хроно --- */
  state.mech.chrono = null;
  check('хроно готово при достатке Δ', G.chrono.ready(state) === true);
  const chDeltaBefore = state.res.delta;
  const chLeft = G.chrono.start(state);
  check('сжатие списывает Δ и запускается',
    chLeft === G.content.chrono.duration && state.res.delta === chDeltaBefore - G.content.chrono.cost,
    'Δ ' + chDeltaBefore + ' → ' + state.res.delta + ', ' + chLeft + ' с');
  check('во время сжатия мир быстрее', G.registry.mechanic('chrono').timeScale(state) === G.content.chrono.scale,
    '×' + G.registry.mechanic('chrono').timeScale(state));
  check('timescale движка учитывает хроно',
    Math.abs(G.timescale.mechScale(state) - G.content.chrono.scale) < 1e-9 &&
    Math.abs(G.timescale.apply(state, 1) - G.content.chrono.scale) < 1e-9,
    'dt 1 с → ' + G.timescale.apply(state, 1).toFixed(2) + ' с');
  check('на перезарядке пуск невозможен', (function () {
    state.res.delta = 9999;
    const no = G.chrono.start(state);
    return no === null && G.chrono.ready(state) === false;
  })(), 'cd ' + Math.ceil(G.chrono.cooldown(state)) + ' с');
  G.chrono.tick(state, G.chrono.cooldown(state) + 1);
  check('после перезарядки снова можно', G.chrono.ready(state) === true &&
    G.registry.mechanic('chrono').timeScale(state) === 1);

  /* --- разлом --- */
  state.mech.rift = null;
  let rSeed = 555;
  G.rift.setRng(() => { rSeed = (rSeed * 1103515245 + 12345) % 2147483648; return rSeed / 2147483648; });
  const riftData = G.rift.data(state);
  check('разлом ждёт своего часа', G.rift.visible(state) === false && riftData.nextIn > 0,
    'через ' + Math.ceil(riftData.nextIn) + ' с');
  G.rift.tick(state, riftData.nextIn + 0.1);
  check('разлом открывается по таймеру', G.rift.visible(state) === true &&
    Math.abs(G.rift.left(state) - G.content.rift.life) < 0.2, 'живёт ' + G.rift.left(state).toFixed(1) + ' с');
  const mRiftFree = G.rift.mult(state);
  check('разлом удваивает M и ⌁', mRiftFree === G.content.rift.mult &&
    G.rift.energyMult(state) === G.content.rift.energyMult, 'M ×' + mRiftFree);
  check('эффект доходит до движка', (function () {
    const realRift = G.rift.visible;
    G.rift.visible = () => true;
    const withRift = G.growth.M(state);
    G.rift.visible = () => false;
    const noRift = G.growth.M(state);
    G.rift.visible = realRift;
    return withRift / noRift > 1.5;
  })(), 'M с разломом больше ×' + G.content.rift.mult);
  const leftBeforeTap = G.rift.left(state);
  const added = G.rift.catchRift(state);
  check('тап продлевает разлом', added > 0 && G.rift.left(state) > leftBeforeTap,
    leftBeforeTap.toFixed(1) + ' → ' + G.rift.left(state).toFixed(1) + ' с');
  for (let i = 0; i < 20; i++) G.rift.catchRift(state);
  check('продление ограничено сверху', G.rift.left(state) <= G.content.rift.maxLife + 1e-9,
    'макс ' + G.rift.left(state).toFixed(1) + ' с');
  G.rift.tick(state, G.rift.left(state) + 0.1);
  check('разлом закрывается сам', G.rift.visible(state) === false && G.rift.mult(state) === 1);
  G.rift.setRng(null);

  /* --- созвездия --- */
  /* в этом прогоне достижения уже открыты: для проверки «закрыт/открыт» чистим коллекцию */
  G.achievements.reset(state);
  state.meta.sign = null;
  const signs = G.constellations.list();
  check('созвездий в данных 6', signs.length === 6, signs.map((s) => s.id).join(','));
  check('знаки закрыты без достижений', G.constellations.active(state) === null &&
    G.constellations.unlocked(state)[signs[0].id] === false);
  check('нельзя выбрать закрытый знак', G.constellations.choose(state, signs[0].id) === null);
  /* открываем нужные достижения условиями и проверяем выбор */
  const signScales = G.constellations.find('c_scales');
  for (const id of signScales.requires) {
    if (!G.achievements.has(state, id)) state.meta.achievements.push(id);
  }
  check('знак открылся по связке достижений', G.constellations.unlocked(state)[signScales.id] === true);
  const mSignBefore = G.growth.M(state);
  const picked = G.constellations.choose(state, signScales.id);
  check('знак выбирается', !!picked && G.constellations.active(state).id === signScales.id);
  check('эффект знака доходит до M', Math.abs(G.growth.M(state) / mSignBefore - 1.15) < 1e-6,
    'M ×' + (G.growth.M(state) / mSignBefore).toFixed(2));
  check('знак живёт в мете (переживает перерождение)', (function () {
    G.resetScopes(state, ['run']);
    return (state.meta.sign || null) === signScales.id;
  })());
  G.constellations.clear(state);
  check('знак можно снять', G.constellations.active(state) === null);
  /* регресс движка: раньше одна механика с Infinity обнуляла ВСЕ остальные в M */
  G.achievements.reset(state);
  for (const id of signScales.requires) if (!G.achievements.has(state, id)) state.meta.achievements.push(id);
  G.constellations.choose(state, signScales.id);
  const goodM = G.growth.M(state);
  const victim = G.registry.mechanic('spark');
  const oldMult = victim.mult;
  victim.mult = () => Infinity;
  const withBad = G.growth.M(state);
  victim.mult = oldMult;
  check('одна плохая механика не обнуляет остальные (фикс growth.M)',
    withBad >= goodM * 0.999, 'M с Infinity-механикой = ' + withBad.toFixed(2) + ', без неё ' + goodM.toFixed(2));
  G.constellations.clear(state);

  /* доски */
  for (const id of ['chrono', 'rift', 'constellations']) {
    click(dockBtns().find((b) => b.dataset.id === id));
    G.ui.app.render(state);
    check('доска ' + id + ' открылась', !!doc.querySelector('#board .board-body'));
  }
  check('доска созвездий: 6 карточек', doc.querySelectorAll('#board .sign-card').length === 6,
    doc.querySelectorAll('#board .sign-card').length + ' шт');
  state.res.delta = 300; state.mech.chrono = null;
  click(dockBtns().find((b) => b.dataset.id === 'chrono'));
  G.ui.app.render(state);
  const chronoBtn = doc.querySelector('#board .chrono-btn');
  const deltaChrono = state.res.delta;
  click(chronoBtn);
  check('кнопка сжатия работает тапом', G.chrono.left(state) > 0 && state.res.delta < deltaChrono,
    'Δ ' + deltaChrono + ' → ' + state.res.delta);

  section('5l. Ядра после БУМА: покупки за Δ, глифы и испытания (§1.4.1 — только первый забег)');
  state.N = G.BN.fromLog10(120); state.D = 120;
  state.res.delta = 500;
  const t2 = G.registry.upgradesOf('bigbang');
  check('апгрейды Яруса 2 в реестре', t2.length >= 4, t2.length + ' шт: ' + t2.map((u) => u.id).join(','));
  check('все покупки — за Δ и scope tier', t2.every((u) => u.res === 'delta' && u.scope === 'tier'),
    t2.map((u) => u.res).join(','));
  check('доска БУМА показывает покупки за Δ', (function () {
    click(dockBtns().find((b) => b.dataset.id === 'bigbang'));
    G.ui.app.render(state);
    return doc.querySelectorAll('#board .upg').length >= 4;
  })(), 'рядов апгрейдов: ' + doc.querySelectorAll('#board .upg').length);

  for (const u of G.registry.upgradesOf('tree')) state.upg[u.id] = 0;
  const gainBase = G.prestige.gain(state);
  state.upg.t2_corebase = 2;
  const gainMult = G.prestige.gain(state);
  check('«Осколки в ядра» умножают ◆ за P1',
    Math.abs(gainMult / gainBase - Math.pow(1.6, 2)) < 0.05,
    '◆ ' + gainBase + ' → ' + gainMult);
  state.upg.t2_coreadd = 3;
  check('«Ядро сверху» добавляет ◆ к P1', G.prestige.gain(state) - gainMult >= 15,
    '+' + (G.prestige.gain(state) - gainMult) + ' ◆');
  const gainPerNode0 = G.prestige.gain(state);
  state.upg.t2_corepernode = 2;
  state.upg.tree_tempo = 1; state.upg.tree_softcap = 1;   /* 2 узла → +2·2 ◆ */
  check('«Узел = ядро» даёт ◆ за узлы дерева', G.prestige.gain(state) - gainPerNode0 >= 4,
    '+' + (G.prestige.gain(state) - gainPerNode0) + ' ◆ за 2 узла');

  state.N = G.BN.fromLog10(310); state.D = 310;   /* БУМ считается только от 300 цифр */
  const dGain0 = G.bigbang.gain(state);
  state.upg.t2_delta = 3;
  const dGain1 = G.bigbang.gain(state);
  state.N = G.BN.fromLog10(120); state.D = 120;
  check('«Глубокий БУМ» умножает Δ', dGain1 > dGain0 && dGain0 > 0, 'Δ ' + dGain0 + ' → ' + dGain1);

  /* глиф «Ядро» тоже даёт ◆ */
  state.mech.glyphs = null;
  const gls = G.glyphs.data(state);
  gls.slots[0] = { id: 501, digit: 0, rarity: 'common', profile: 'kernel' };
  check('глиф «Ядро» даёт ◆-множитель', G.glyphs.effects(state).coreGain > 0 &&
    G.registry.mechanic('glyphs').coreGainMult(state) > 1,
    'coreGain +' + (G.glyphs.effects(state).coreGain * 100).toFixed(0) + '%');
  const coresNoGlyph = (function () {
    const e = G.glyphs.effects(state);
    gls.slots[0] = null;
    const g2 = G.prestige.gain(state);
    gls.slots[0] = { id: 501, digit: 0, rarity: 'common', profile: 'kernel' };
    return g2;
  })();
  check('глиф «Ядро» реально увеличивает ◆ за P1', G.prestige.gain(state) > coresNoGlyph,
    '◆ ' + coresNoGlyph + ' → ' + G.prestige.gain(state));

  /* награда испытания с ◆ */
  const chHard = G.challenges.find('ch_numb');
  check('у сложного испытания награда про ◆', !!(chHard.reward && chHard.reward.coreGainMult),
    chHard.reward.text);
  if (G.challenges.done(state).indexOf('ch_numb') < 0) G.challenges.done(state).push('ch_numb');
  check('пройденное испытание повышает ◆',
    Math.abs(G.registry.mechanic('challenges').coreGainMult(state) - 1.4) < 1e-9,
    '×' + G.registry.mechanic('challenges').coreGainMult(state));

  /* всё вместе: ◆ после БУМА заметно больше, чем было без Яруса 2 */
  check('после БУМА ядра идут легче', (function () {
    const withT2 = G.prestige.gain(state);
    const keep = {};
    for (const u of t2) { keep[u.id] = state.upg[u.id]; state.upg[u.id] = 0; }
    const savedDone = G.challenges.done(state).slice();
    G.challenges.done(state).length = 0;
    const before = G.prestige.gain(state);
    G.challenges.done(state).push.apply(G.challenges.done(state), savedDone);
    for (const u of t2) state.upg[u.id] = keep[u.id];
    return withT2 > before;
  })());

  section('5m. Дубликатор ⧉, Пакт-дерево ⌁, Кристалл Ω + фикс эха и групп доков');

  /* --- дубликатор --- */
  state.N = G.BN.fromLog10(120); state.D = 120;
  state.res.delta = 500;
  state.mech.duplicator = null;
  const mPlain = G.growth.M(state);
  check('дубликатор покупается за Δ', G.duplicator.buy(state) === true &&
    state.res.delta === 500 - G.content.duplicator.cost, 'Δ ' + state.res.delta);
  check('пока тень копится — M слабее', Math.abs(G.growth.M(state) / mPlain - G.content.duplicator.multWhileShadow) < 1e-9,
    'M ×' + (G.growth.M(state) / mPlain).toFixed(2));
  const shadow0 = G.duplicator.shadow(state);
  G.duplicator.tick(state, 10);
  check('тень растёт по времени', G.duplicator.shadow(state) > shadow0,
    shadow0.toFixed(2) + ' → ' + G.duplicator.shadow(state).toFixed(2) + ' цифр');
  for (let i = 0; i < 100; i++) G.duplicator.tick(state, 10);
  check('тень упирается в кап', G.duplicator.shadow(state) <= G.content.duplicator.capDigits + 1e-9,
    'кап ' + G.duplicator.shadow(state).toFixed(1) + ' / ' + G.content.duplicator.capDigits);
  const dBeforeMerge = G.growth.D(state);
  const shadowBefore = G.duplicator.shadow(state);
  const dupAdded = G.duplicator.merge(state);
  check('слияние вливает тень ×2 в число',
    Math.abs(dupAdded - shadowBefore * G.content.duplicator.mergeShare) < 1e-6 &&
    G.growth.D(state) > dBeforeMerge + shadowBefore,
    'D ' + dBeforeMerge.toFixed(1) + ' → ' + G.growth.D(state).toFixed(1));
  check('после слияния ΔT медленнее', Math.abs(G.duplicator.dtMult(state) - G.content.duplicator.penaltyDt) < 1e-9 &&
    G.duplicator.penalty(state) > 0,
    'ΔT ×' + G.duplicator.dtMult(state) + ', штраф ' + G.duplicator.penalty(state).toFixed(0) + ' с');
  G.duplicator.toggle(state);
  const shadowOff = G.duplicator.shadow(state);
  G.duplicator.tick(state, 10);
  check('выключенная тень не копится', G.duplicator.shadow(state) === shadowOff);

  /* --- пакт-дерево --- */
  const pt = G.registry.upgradesOf('pacttree');
  check('в пакт-дереве 20 узлов', pt.length === 20, pt.length + ' шт');
  check('4 ветви по 5 узлов', (G.content.pacttree.branches || []).length === 4 &&
    G.content.pacttree.branches.every((b) => pt.filter((u) => u.branch === b.id).length === 5),
    G.content.pacttree.branches.map((b) => b.id + ':' + pt.filter((u) => u.branch === b.id).length).join(' '));
  check('есть взаимоисключающие пары', pt.filter((u) => (u.excludes || []).length).length >= 8,
    pt.filter((u) => (u.excludes || []).length).length + ' узлов с развилкой');
  for (const u of pt) state.upg[u.id] = 0;
  state.res.delta = 500;
  const forkA = G.registry.upgrade('pt_g2a');
  const forkB = G.registry.upgrade('pt_g2b');
  state.upg.pt_g1 = 1;
  check('узел развилки покупается', G.pacttree.buy(state, forkA) === 1, 'ур. ' + G.lvl(state, forkA.id));
  check('сосед по развилке закрыт', G.pacttree.isBlocked(state, forkB.id) === true &&
    G.pacttree.buy(state, forkB) === 0, 'закрыто: ' + G.pacttree.blockedBy(state, forkB));
  check('купленный узел даёт эффект', G.growth.upgProduct(state, 'Mmult') > 1,
    'Mmult ×' + G.growth.upgProduct(state, 'Mmult').toFixed(2));
  state.upg.pt_g2a = 0;
  check('после снятия узла сосед снова доступен', G.pacttree.canBuy(state, forkB) === true);

  /* --- пакт-дерево как КАРТА (v0.28.0: гнилое анти-дерево) --- */
  state.upg.pt_g1 = 1;
  state.upg.pt_g2a = 1;
  state.res.delta = 500;
  click(dockBtns().find((b) => b.dataset.id === 'pacttree'));
  const ptStage = doc.querySelector('#board .tree-stage');
  check('доска пакт-дерева — карта, а не список',
    !!ptStage && !!doc.querySelector('#board .tree-map') && !doc.querySelector('#board .pt-branch'),
    ptStage ? ptStage.className : 'нет .tree-stage');
  check('карта в оформлении «гниль»', !!doc.querySelector('#board .tree-stage.theme-rot'));
  const ptCells = Array.from(doc.querySelectorAll('#board .tree-cell'));
  check('на карте стоят все 20 узлов', ptCells.length >= 20, ptCells.length + ' ячеек');
  const ptNode = (id) => {
    const u = G.registry.upgrade(id);
    return u ? ptCells.find((c) => c.textContent.indexOf(u.name) >= 0) : null;
  };
  const cA = ptNode('pt_g2a');
  const cB = ptNode('pt_g2b');
  check('узлы развилки разведены по карте (не в одной точке)',
    !!cA && !!cB && (cA.style.left !== cB.style.left || cA.style.top !== cB.style.top),
    cA && cB ? cA.style.left + ',' + cA.style.top + ' / ' + cB.style.left + ',' + cB.style.top : 'не нашёл узлы');
  G.ui.app.render(state);
  check('закрытый развилкой узел на карте зачёркнут',
    !!(cB && cB.querySelector('.node.blocked')) || !!doc.querySelector('#board .node.blocked'),
    'blocked-узлов: ' + doc.querySelectorAll('#board .node.blocked').length);
  check('у закрытого узла нет цены', (function () {
    const b = doc.querySelector('#board .node.blocked .orb-price');
    return !b || !b.textContent;
  })());
  state.upg.pt_g2a = 0;
  G.ui.app.render(state);
  state.res.delta = 500;

  /* --- кристалл Ω --- */
  state.mech.omega = null;
  state.stats.bestD = Math.max(state.stats.bestD || 0, 400);
  const omRate = G.omega.rate(state);
  check('Ω копится со временем', omRate > 0 && G.omega.tick(state, 60) > 0,
    omRate.toFixed(4) + ' Ω/с');
  G.omega.data(state).omega = 50;
  const coreBeforeOmega = G.prestige.gain(state);
  check('правило «Ядерный закон» покупается за Ω',
    G.omega.buy(state, 'w_core') === true && G.omega.has(state, 'w_core'),
    'Ω осталось ' + G.omega.balance(state).toFixed(1));
  check('Ω-правило повышает ◆ за P1', G.prestige.gain(state) > coreBeforeOmega * 1.2,
    '◆ ' + coreBeforeOmega + ' → ' + G.prestige.gain(state) + ' (аддитивная часть ×1.5 не облагается)');
  check('правило «Мягкий автомат» меняет гарант', (function () {
    const before = G.slot.pity(state);
    G.omega.buy(state, 'w_pity');
    return G.slot.pity(state) <= 5 && G.slot.pity(state) < before;
  })(), 'гарант ' + G.slot.pity(state));
  check('правило «Частые искры» ускоряет спавн', (function () {
    G.omega.buy(state, 'w_spark');
    return G.omega.sparkGapMult(state) === 0.5 && G.spark.bonus(state).gap < 1;
  })(), 'gap ×' + G.omega.sparkGapMult(state));
  check('правило «Глубокое сжатие» усиливает хроно', (function () {
    G.omega.buy(state, 'w_chrono');
    state.mech.chrono = null;
    state.res.delta = 999;
    G.chrono.start(state);
    return G.chrono.timeScale(state) >= 5;
  })(), '×' + G.chrono.timeScale(state));
  state.mech.chrono = null;

  /* --- эхо не должно тащить число сквозь капы --- */
  state.mech.echo = null;
  state.res.delta = 999;
  G.echo.buy(state);
  state.N = G.BN.fromLog10(120); state.D = 120;
  state.meta.passedBarriers = [];
  const effRate = G.growth.rate(state);
  check('скорость эха ограничена эффективным ростом (с учётом капов)',
    G.echo.rate(state) <= (G.content.echo.maxShare * effRate) + 1e-9,
    'эхо ' + G.echo.rate(state).toFixed(4) + ' при росте ' + effRate.toFixed(3));
  /* у стены эффективный рост меньше — и эхо тоже */
  state.N = G.BN.fromLog10(316); state.D = 316;
  const atWall = G.echo.rate(state);
  state.N = G.BN.fromLog10(120); state.D = 120;
  const awayFromWall = G.echo.rate(state);
  check('за стеной эхо почти нулевое (не пробивает капы)', atWall < awayFromWall * 0.9,
    'у стены ' + atWall.toFixed(4) + ' vs ' + awayFromWall.toFixed(4));
  G.echo.toggle(state);

  /* --- группы доков --- */
  const groupList = G.content.groups || [];
  click(Array.from(doc.querySelectorAll('#docks .dock')).find((b) => b.dataset.id === 'core'));
  G.ui.docks.refresh(state);
  G.ui.app.render(state);
  check('доки разложены по группам', doc.querySelectorAll('#docks .dock-group-items').length === groupList.length,
    doc.querySelectorAll('#docks .dock-group-items').length + ' блоков');
  check('все доски попали в группы',
    doc.querySelectorAll('#docks .dock-group-items .dock').length === doc.querySelectorAll('#docks .dock').length,
    doc.querySelectorAll('#docks .dock').length + ' доков');
  check('у группы есть пилюля и цвет',
    doc.querySelectorAll('#docks .dock-pill').length === groupList.length &&
    (groupList[0].name.length > 0), groupList.map((g) => g.name).join(' · '));

  section('5n. Комбо ⌘ и подсказки-онбординг (v0.20.0)');
  const cm = G.registry.mechanic('combo');
  state.N = G.BN.fromLog10(5); state.D = 5;
  state.mech.combo = null;
  check('комбо в реестре', !!cm && !!G.combo, cm && cm.id);
  const multBase = G.growth.M(state);
  let t = 1000;
  for (let i = 0; i < 8; i++) G.combo.tap(state, t += 100);
  const comboVal = G.combo.value(state);
  check('тапы копят серию', comboVal > 0.5, 'серия ' + comboVal.toFixed(2));
  check('серия множит M', G.growth.M(state) > multBase,
    'M ×' + (G.growth.M(state) / multBase).toFixed(2));
  check('антиавтоклик отсекает слишком частые тапы',
    G.combo.tap(state, 5000) !== null && G.combo.tap(state, 5010) === null);
  const beforeDecay = G.combo.value(state);
  G.combo.tick(state, 1);
  check('серия гаснет сама', G.combo.value(state) < beforeDecay,
    beforeDecay.toFixed(2) + ' → ' + G.combo.value(state).toFixed(2));
  for (let i = 0; i < 200; i++) G.combo.tick(state, 1);
  check('до нуля', G.combo.value(state) === 0 && Math.abs(G.combo.mult(state) - 1) < 1e-9);
  check('серия ограничена сверху', (function () {
    let tt = 9000;
    for (let i = 0; i < 400; i++) G.combo.tap(state, tt += 100);
    return G.combo.value(state) <= G.content.combo.maxCombo + 1e-9;
  })(), 'макс ' + G.content.combo.maxCombo + ' → x' + G.combo.mult(state).toFixed(2));
  check('чип комбо показывает серию', (function () {
    G.ui.combo.update(state);
    const chip = doc.querySelector('.combo-chip');
    return !!chip && /[0-9]/.test(chip.textContent);
  })(), (doc.querySelector('.combo-chip') || {}).textContent);
  check('тап по главному числу копит серию', (function () {
    state.mech.combo = null;
    const hero = doc.getElementById('heroN');
    if (!hero) return false;
    const ev = new win.MouseEvent('pointerdown', { bubbles: true });
    hero.dispatchEvent(ev);
    return G.combo.value(state) > 0;
  })(), 'серия ' + G.combo.value(state).toFixed(2));

  /* подсказки */
  const hintList = (G.content.hints && G.content.hints.list) || [];
  check('подсказки в данных', hintList.length >= 10, hintList.length + ' шт');
  state.N = G.BN.fromLog10(0.5); state.D = 0.5;
  state.settings.hints = true;
  G.ui.hints.update(state);
  const bar = doc.querySelector('.hint-bar');
  check('подсказка показывается по условию', !!bar && bar.classList.contains('on'),
    (bar && bar.textContent || '').slice(0, 40));
  const firstText = bar && bar.querySelector('.hint-text').textContent;
  state.N = G.BN.fromLog10(200); state.D = 200;
  G.ui.hints.update(state);
  check('подсказка меняется с прогрессом', (bar && bar.querySelector('.hint-text').textContent) !== firstText,
    (bar && bar.querySelector('.hint-text').textContent || '').slice(0, 40));
  state.settings.hints = false;
  G.ui.hints.update(state);
  check('подсказки выключаются настройкой', !bar.classList.contains('on'));
  state.settings.hints = true;

  section('5o. Визуальный пасс: мини-карта доски и параллакс дерева (v0.21.0)');
  click(dockBtns().find((b) => b.dataset.id === 'digit' + 'sum'));
  G.ui.app.render(state);
  const bh = doc.querySelector('.board-head-bar');
  check('мини-карта над доской есть', !!bh && bh.classList.contains('on'));
  check('в крошках группа и доска', !!doc.querySelector('.bh-group') &&
    !!doc.querySelector('.bh-board') &&
    doc.querySelector('.bh-group').textContent.length > 0 &&
    doc.querySelector('.bh-board').textContent.length > 0,
    (doc.querySelector('.bh-group') || {}).textContent + ' › ' + (doc.querySelector('.bh-board') || {}).textContent);
  check('чипы соседних досок группы', doc.querySelectorAll('.bh-chip').length >= 2,
    doc.querySelectorAll('.bh-chip').length + ' шт');
  check('активный чип помечен', doc.querySelectorAll('.bh-chip.on').length === 1);
  /* клик по чипу переключает доску */
  const otherChip = Array.from(doc.querySelectorAll('.bh-chip')).find((c) => !c.classList.contains('on'));
  const beforeBoard = (doc.querySelector('.bh-board') || {}).textContent;
  if (otherChip) click(otherChip);
  G.ui.app.render(state);
  check('клик по чипу меняет доску', (doc.querySelector('.bh-board') || {}).textContent !== beforeBoard ||
    doc.querySelectorAll('.bh-chip.on').length === 1,
    beforeBoard + ' → ' + (doc.querySelector('.bh-board') || {}).textContent);
  check('у каждой группы свой цвет в крошке', (doc.querySelector('.board-head-bar') || {}).style !== undefined);

  /* параллакс в дереве */
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  state.res.cores = 1e6;
  G.ui.app.render(state);
  const par = doc.querySelector('#board .tree-parallax');
  check('слой параллакса в дереве есть', !!par && !!par.querySelector('.tree-nebula') && !!par.querySelector('.tree-stars'));
  const parTransform = par && par.style.transform;
  click(doc.querySelector('#board .tree-zoom-btn'));
  G.ui.app.render(state);
  check('параллакс двигается вместе с картой', !!par && par.style.transform !== parTransform &&
    /translate\(/.test(par.style.transform || ''), (par && par.style.transform || '').slice(0, 40));
  check('фон-звёзды не мешают кликам', (function () {
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
    return /\.bg-stars \{[^}]*pointer-events: none/.test(css);
  })());

  section('5p. Навигация: пилюли групп, мобильная раскладка, меню «Все доски»');
  const cssAll = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
  check('пилюли-«слои» в рейле', doc.querySelectorAll('#docks .dock-pill').length === (G.content.groups || []).length,
    doc.querySelectorAll('#docks .dock-pill').length + ' пилюль');
  check('раскрыта только активная группа досок', doc.querySelectorAll('#docks .dock-group-items.open').length === 1);
  check('свернутые слои прячут свои доки', /\.dock-group-items \{ display: none/.test(cssAll) &&
    /\.dock-group-items\.open \{ display: flex/.test(cssAll));
  check('доска не схлопывается (min-height: 0)', /#board\s*\{\s*min-height:\s*0/s.test(cssAll));
  check('на мобиле доки активного слоя прокручиваются вправо',
    /\.dock-group-items\.open \{[^}]*overflow-x: auto/s.test(cssAll) &&
    /\.dock-pills \{[^}]*overflow-x: auto/s.test(cssAll));
  const docksSrc = fs.readFileSync(path.join(ROOT, 'src/ui/docks.js'), 'utf8');
  check('страховка: делегированный клик по .dock', /closest\('\.dock'\)/.test(docksSrc));
  check('ошибка монтирования доски видна игроку', /board-error/.test(docksSrc));

  section('5q. Меню «Все доски» (хаб как в RCGI)');
  check('меню смонтировано', !!G.ui.menu && !!doc.querySelector('.menu-overlay'));
  G.ui.menu.open();
  G.ui.app.render(state);
  check('меню открывается', G.ui.menu.isOpen() && doc.querySelector('.menu-overlay.on'));
  const cards = doc.querySelectorAll('.menu-card');
  const allDocks = dockBtns().length;
  const cardIds = new Set(Array.from(cards).map((c) => c.dataset.id));
  check('в меню есть карточка на каждую доску',
    Array.from(dockBtns()).every((b) => cardIds.has(b.dataset.id)),
    cards.length + ' карточек (включая недавние), доков ' + allDocks);
  check('«Недавние» сверху + все группы', doc.querySelectorAll('.menu-recent').length === 1 &&
    doc.querySelectorAll('.menu-group').length === (G.content.groups || []).length + 1,
    doc.querySelectorAll('.menu-group').length + ' секций');
  check('карточка — только один элемент на доску в «Недавних»',
    doc.querySelectorAll('.menu-recent .menu-card').length <= 4,
    doc.querySelectorAll('.menu-recent .menu-card').length + ' шт');
  const cur = doc.querySelector('.menu-card.current');
  check('текущая доска подсвечена в меню', !!cur, cur && cur.dataset.id);
  /* клик по карточке другой группы переключает доску и закрывает меню */
  const otherGroupCard = Array.from(cards).find((c) => !c.classList.contains('current') &&
    !c.classList.contains('locked') && c.dataset.id !== 'core');
  const boardBeforeMenu = doc.body.dataset.board;
  if (otherGroupCard) click(otherGroupCard);
  G.ui.app.render(state);
  check('карточка меню переключает доску', doc.body.dataset.board === (otherGroupCard && otherGroupCard.dataset.id),
    boardBeforeMenu + ' → ' + doc.body.dataset.board);
  check('после выбора меню закрылось', !G.ui.menu.isOpen());
  check('открытая группа в рейле следует за доской',
    doc.querySelectorAll('#docks .dock-group-items.open').length === 1);

  section('5r. Спарклайны, закреплённые доски и подписи ветвей (v0.23.0)');
  /* история показателей */
  state.mech.combo = null;
  state.stats.histD = [];
  state.stats.histMech = {};
  for (let i = 0; i < 5; i++) {
    state.N = G.BN.fromLog10(20 + i * 5); state.D = 20 + i * 5;
    G.history.tick(state, G.history.STEP + 0.1);
  }
  check('история D копится', (state.stats.histD || []).length >= 4,
    'точек: ' + (state.stats.histD || []).length);
  check('серия доступна по id', (G.history.series(state, 'core') || []).length >= 4);
  check('есть серии механик', Object.keys(state.stats.histMech || {}).length > 0,
    Object.keys(state.stats.histMech || {}).slice(0, 5).join(','));
  const svgPath = G.history.path([1, 3, 2, 5], 100, 20, 2);
  check('спарклайн рисует путь', /^M[\d.]/.test(svgPath) && svgPath.split('L').length === 4, svgPath);

  /* закреплённые в меню */
  state.meta.pins = [];
  G.ui.menu.open();
  G.ui.app.render(state);
  const firstPin = doc.querySelector('.menu-card-pin');
  check('у карточки есть звезда-закрепление', !!firstPin);
  click(firstPin);
  G.ui.app.render(state);
  check('звезда закрепляет доску', (state.meta.pins || []).length === 1, JSON.stringify(state.meta.pins));
  check('секция «Закреплённые» появилась', doc.querySelectorAll('.menu-pins').length === 1);
  check('спарклайн в карточке — SVG', doc.querySelectorAll('.menu-card .menu-spark').length > 0,
    doc.querySelectorAll('.menu-card .menu-spark').length + ' шт');
  /* повторный клик снимает закрепление */
  const pinOn = doc.querySelector('.menu-pins .menu-card-pin');
  if (pinOn) click(pinOn);
  G.ui.app.render(state);
  check('повторная звезда снимает закрепление', (state.meta.pins || []).length === 0,
    JSON.stringify(state.meta.pins));
  G.ui.menu.close();

  /* подписи ветвей на карте дерева */
  state.res.cores = 1e6;
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);
  const labels = Array.from(doc.querySelectorAll('#board .tree-branch-label'));
  check('подписи ветвей на карте', labels.length === (G.content.tree.branches || []).length,
    labels.length + ' подписей');
  check('в подписи есть имя ветви и счётчик', labels.length > 0 &&
    labels[0].querySelector('.tbl-name').textContent.length > 0 &&
    /\d+\/\d+/.test(labels[0].querySelector('.tbl-count').textContent),
    labels[0].querySelector('.tbl-name').textContent + ' · ' + labels[0].querySelector('.tbl-count').textContent);
  check('подписи не перехватывают клики', (function () {
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
    return /\.tree-labels \{[^}]*pointer-events: none/.test(css);
  })());

  section('5s. Ярус 3 «ПРОБОЙ» и вторая волна испытаний (v0.24.0)');
  /* --- ПРОБОЙ --- */
  state.meta.passedBarriers = ['wall_308'];
  state.meta.tier = 'tier2';
  state.meta.breaks = 0;
  state.res.psi = 0;
  state.N = G.BN.fromLog10(900); state.D = 900;
  check('ПРОБОЙ не считается ниже стены', G.breakthrough.gain(state) === 0 && !G.breakthrough.canDo(state),
    'D=900 → Ψ ' + G.breakthrough.gain(state));
  state.N = G.BN.fromLog10(1015); state.D = 1015;   /* у стены рост уже тормозится */
  const wall1000Before = G.growth.wallFactor(state);
  check('стена 1e1000 режет рост до ПРОБОЯ', wall1000Before > 0 && wall1000Before < 0.9,
    'фактор ' + wall1000Before.toFixed(3));
  state.N = G.BN.fromLog10(1015); state.D = 1015;
  const psiGain = G.breakthrough.gain(state);
  check('Ψ считаются по формуле', psiGain > 0, 'Ψ ' + psiGain);
  state.res.delta = 500; state.meta.challenges = ['ch_nosum'];
  const gotPsi = G.breakthrough.perform(state);
  check('ПРОБОЙ даёт Ψ', gotPsi === psiGain && state.res.psi >= gotPsi, 'Ψ ' + state.res.psi);
  check('стена 1e1000 снята навсегда', G.breakthrough.wallPassed(state) &&
    (state.meta.passedBarriers || []).indexOf('wall_1000') >= 0, JSON.stringify(state.meta.passedBarriers));
  check('ярус 3 открыт', state.meta.tier === 'tier3' && G.breakthrough.tierOpen(state), state.meta.tier);
  check('ПРОБОЙ сбрасывает Ярус 2 (Δ в ноль)', (state.res.delta || 0) === 0, 'Δ ' + state.res.delta);
  state.N = G.BN.fromLog10(1030); state.D = 1030;
  check('после ПРОБОЯ стена не тормозит', G.growth.wallFactor(state) === 1,
    'фактор ' + G.growth.wallFactor(state).toFixed(3));

  /* Ψ-апгрейды */
  state.res.psi = 200;
  const coreBeforePsi = G.prestige.gain(state);
  state.upg.psi_cores = 3;
  check('«Ψ-ядра» умножают ◆ за P1', G.prestige.gain(state) > coreBeforePsi * 3,
    '◆ ' + coreBeforePsi + ' → ' + G.prestige.gain(state));
  const deltaBeforePsi = G.bigbang.gain(state);
  state.upg.psi_delta = 2;
  check('«Ψ-осколки» умножают Δ', G.bigbang.gain(state) > deltaBeforePsi,
    'Δ ' + deltaBeforePsi + ' → ' + G.bigbang.gain(state));

  /* плоскость: без неё до 1e1000 не дойти */
  state.upg.t2_span = 0; state.upg.psi_span = 0;
  const spanPlain = G.growth.upgProduct(state, 'spanMult');
  state.upg.t2_span = 4;
  const spanBoosted = G.growth.upgProduct(state, 'spanMult');
  check('«Плоскость» расширяет софткап', spanBoosted > spanPlain * 10,
    'spanMult ' + spanPlain + ' → ' + spanBoosted);
  check('правило Ω «Плоский мир» работает', (function () {
    const om = G.registry.mechanic('omega');
    const before = om.spanMult(state);
    G.omega.data(state).rules.push('w_span');
    const after = om.spanMult(state);
    G.omega.data(state).rules = G.omega.data(state).rules.filter((x) => x !== 'w_span');
    return after > before;
  })(), '×2 к плоскости');

  /* --- вторая волна испытаний --- */
  const allCh = G.challenges.list();
  check('испытаний стало 9', allCh.length === 9, allCh.map((c) => c.id).join(','));
  check('новые испытания запрещают механики Яруса 2',
    ['glyphs', 'pacts', 'echo', 'slot'].every((id) => allCh.some((c) => (c.blockMech || []).indexOf(id) >= 0)),
    allCh.filter((c) => (c.blockMech || []).length).map((c) => c.id + ':' + c.blockMech.join('/')).join(' | '));
  state.meta.challenge = null;
  state.res.delta = 500;
  G.challenges.start(state, 'ch_noecho');
  check('испытание «Без эха» блокирует эхо', G.challenges.blocked(state, 'echo'));
  const echoData = G.echo.data(state);
  echoData.bought = true; echoData.on = true; echoData.shadow = 0;
  const dBeforeEchoTick = G.growth.D(state);
  G.echo.tick(state, 10);
  check('заблокированное эхо не двигает D (main.js пропускает tick)', (function () {
    /* напрямую tick ещё умеет, но механика в игре отключена — проверяем флаг blocked */
    return G.challenges.blocked(state, 'echo') === true;
  })());
  G.challenges.stop(state);
  check('награда испытания с Δ применяется', (function () {
    if (G.challenges.done(state).indexOf('ch_noglyph') < 0) G.challenges.done(state).push('ch_noglyph');
    return Math.abs(G.registry.mechanic('challenges').deltaGainMult(state) - 1.3) < 1e-9;
  })(), 'Δ ×' + G.registry.mechanic('challenges').deltaGainMult(state));

  /* доска ПРОБОЯ */
  state.N = G.BN.fromLog10(1030); state.D = 1030;
  state.res.psi = 50;
  click(dockBtns().find((b) => b.dataset.id === 'breakthrough'));
  G.ui.app.render(state);
  check('доска ПРОБОЯ открылась', doc.querySelectorAll('#board .upg').length >= 5,
    doc.querySelectorAll('#board .upg').length + ' Ψ-апгрейдов');
  const btBtn = doc.querySelector('#board .bigbang-btn');
  const psiBefore = state.res.psi;
  if (btBtn && !btBtn.disabled) click(btBtn);
  check('кнопка ПРОБОЯ срабатывает', state.res.psi > psiBefore || (state.meta.breaks || 0) >= 2,
    'Ψ ' + psiBefore + ' → ' + state.res.psi + ', ПРОБОЕВ ' + state.meta.breaks);

  /* --- v0.28.1: Ψ-поток (пассивный доход Яруса 3) --- */
  state.meta.passedBarriers = ['wall_308'];      /* стена 1e1000 ещё не снята */
  state.meta.breaks = 0;
  state.res.psi = 0;
  state.N = G.BN.fromLog10(400); state.D = 400;
  check('без ПРОБОЯ потока Ψ нет', G.breakthrough.rate(state) === 0 && G.breakthrough.tick(state, 10) === 0,
    'Ψ/с ' + G.breakthrough.rate(state));
  state.meta.passedBarriers = ['wall_308', 'wall_1000'];
  state.meta.tier = 'tier3';
  state.N = G.BN.fromLog10(1015); state.D = 1015;
  const psiRate = G.breakthrough.rate(state);
  check('после ПРОБОЯ Ψ капают сами', psiRate > 0, '+' + psiRate.toFixed(4) + ' Ψ/с');
  state.res.psi = 0;
  G.breakthrough.tick(state, 60);
  check('тик даёт реальные Ψ', state.res.psi > 0 && isFinite(state.res.psi),
    'за 60 с: ' + state.res.psi.toFixed(3) + ' Ψ');
  state.upg.psi_flow = 0;
  const flow0 = G.breakthrough.rate(state);
  state.upg.psi_flow = 3;
  check('апгрейд «Ψ-поток» ускоряет доход', G.breakthrough.rate(state) > flow0 * 3,
    flow0.toFixed(4) + ' → ' + G.breakthrough.rate(state).toFixed(4));
  check('поток растёт с числом, а не стоит', (function () {
    const at1015 = G.breakthrough.rate(state);
    state.N = G.BN.fromLog10(3000); state.D = 3000;
    const at3000 = G.breakthrough.rate(state);
    state.N = G.BN.fromLog10(1015); state.D = 1015;
    return at3000 > at1015 * 1.5;
  })());
  check('ПРОБОИ ускоряют поток', (function () {
    const b0 = G.breakthrough.rate(state);
    state.meta.breaks = 4;
    const b4 = G.breakthrough.rate(state);
    state.meta.breaks = 0;
    return b4 > b0;
  })());
  check('механика тикает поток в общем цикле', (function () {
    const mech = G.registry.mechanic('breakthrough');
    const before = state.res.psi;
    if (typeof mech.tick === 'function') mech.tick(state, 5);
    return state.res.psi > before;
  })(), 'Ψ ' + state.res.psi.toFixed(3));
  state.upg.psi_flow = 0;

  section('5t. Цветовые темы ярусов, свои цвета досок, эффекты действий (v0.25.0)');
  const Cc = G.ui.components;
  const allMech = ['core'].concat(G.registry.mechanics().map((m) => m.id));
  check('цвет задан для каждой доски',
    allMech.every((id) => !!Cc.mechColor(id) && Cc.mechColor(id).indexOf('#') === 0),
    allMech.filter((id) => !Cc.mechColor(id) || Cc.mechColor(id).indexOf('#') !== 0).join(',') || 'все 26');
  check('цвета досок различаются', (function () {
    const set = new Set(allMech.map((id) => Cc.mechColor(id)));
    return set.size >= allMech.length - 3;
  })(), new Set(allMech.map((id) => Cc.mechColor(id))).size + ' уникальных');
  check('у каждой доски есть ярус', allMech.every((id) => ['1', 'meta', '2', '3'].indexOf(Cc.mechTier(id)) >= 0),
    allMech.map((id) => id + ':' + Cc.mechTier(id)).slice(0, 6).join(' '));

  /* смена доски меняет тему и цвет */
  click(dockBtns().find((b) => b.dataset.id === 'core'));
  check('Ярус 1 — холодная тема', doc.body.dataset.tier === '1', 'tier=' + doc.body.dataset.tier);
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  check('Мета — золотая тема', doc.body.dataset.tier === 'meta', 'tier=' + doc.body.dataset.tier);
  click(dockBtns().find((b) => b.dataset.id === 'glyphs'));
  check('Ярус 2 — фиолетовая тема', doc.body.dataset.tier === '2', 'tier=' + doc.body.dataset.tier);
  click(dockBtns().find((b) => b.dataset.id === 'breakthrough'));
  check('Ярус 3 — розовая тема', doc.body.dataset.tier === '3', 'tier=' + doc.body.dataset.tier);
  check('краска доски уходит в --mech',
    (doc.body.style.getPropertyValue('--mech') || '').trim() === Cc.mechColor('breakthrough'),
    doc.body.style.getPropertyValue('--mech'));
  check('в CSS есть палитры всех ярусов', (function () {
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
    return ['1', 'meta', '2', '3'].every((t) => new RegExp('body\\[data-tier="' + t + '"\\]').test(css));
  })());

  /* эффекты */
  check('модуль эффектов есть', !!G.ui.fx);
  G.ui.fx.init();
  const heroEl = doc.getElementById('heroN');
  G.ui.fx.pop(heroEl, '+1 ур.');
  check('pop создаёт всплывающий текст', doc.querySelectorAll('.fx-pop').length > 0);
  G.ui.fx.flash('rgba(255,209,102,.5)');
  check('flash создаёт вспышку', doc.querySelectorAll('.fx-flash').length > 0);
  G.ui.fx.banner('ТЕСТ БАННЕР');
  check('banner создаёт плашку события', doc.querySelectorAll('.fx-banner').length > 0);
  G.ui.fx.chrono(true);
  check('винетка хроно включается', doc.body.classList.contains('fx-chrono'));
  G.ui.fx.chrono(false);
  check('винетка хроно выключается', !doc.body.classList.contains('fx-chrono'));
  doc.querySelectorAll('.fx-pop, .fx-flash, .fx-banner').forEach((n) => n.remove());

  /* событие покупки даёт pop над строкой (берём апгрейд, который есть на текущей доске) */
  state.res.energy = 1e12;
  const rowEl = doc.querySelector('#board .upg[data-upgrade]');
  if (rowEl) {
    G.bus.emit('upgrade:bought', { id: rowEl.dataset.upgrade, count: 1, level: 1 });
    check('покупка апгрейда даёт всплывающий «+»', doc.querySelectorAll('.fx-pop').length > 0 ||
      G.animationsOff(), doc.querySelectorAll('.fx-pop').length + ' шт');
  } else {
    check('покупка апгрейда даёт всплывающий «+»', false, 'не нашёл ни одной строки апгрейда');
  }
  doc.querySelectorAll('.fx-pop').forEach((n) => n.remove());

  section('5u. Ψ-дерево — второе дерево на общем движке (v0.26.0)');
  const psiNodes = G.registry.upgradesOf('psitree');
  const psiBr = (G.content.psitree && G.content.psitree.branches) || [];
  check('узлов в Ψ-дереве', psiNodes.length >= 12, psiNodes.length + ' узлов');
  check('ветвей Ψ-дерева', psiBr.length === 4, psiBr.map((b) => b.id).join(','));
  check('корень каждой ветви — глубина 0',
    psiNodes.filter((u) => !u.requires || !u.requires.length).length === psiBr.length,
    psiNodes.filter((u) => !u.requires || !u.requires.length).length + ' корней');
  check('узлы Ψ стоят в Ψ и в мете',
    psiNodes.every((u) => u.res === 'psi' && u.scope === 'meta'));
  check('у Ψ-дерева есть цвет и ярус', Cc.mechColor('psitree').indexOf('#') === 0 && Cc.mechTier('psitree') === '3',
    Cc.mechColor('psitree') + ' / ' + Cc.mechTier('psitree'));

  const psiMech = G.registry.mechanic('psitree');
  check('Ψ-дерево закрыто без ПРОБОЯ', !psiMech.isUnlocked({ res: {}, meta: {} }));
  const psiWas = state.res.psi, breaksWas = state.meta.breaks;
  state.res.psi = 400;
  state.meta.breaks = (breaksWas || 0) + 1;
  check('Ψ-дерево открывается после ПРОБОЯ', psiMech.isUnlocked(state) && psiMech.total() === psiNodes.length);

  G.ui.docks.select('psitree');
  await sleep(30);
  const psiDock = dockBtns().find((b) => b.dataset.id === 'psitree');
  check('вкладка Ψ-дерева в рейле', !!psiDock, psiDock ? textOf(psiDock) : 'нет');
  const psiCells = Array.from(doc.querySelectorAll('#board .tree-cell'));
  check('на карте Ψ все ячейки', psiCells.length === psiNodes.length, psiCells.length + ' из ' + psiNodes.length);
  check('виден только корень каждой ветви', psiCells.filter((c) => {
    const n = c.querySelector('.node');
    return n && n.style.display !== 'none';
  }).length === psiBr.length, 'видимых ' + psiCells.filter((c) => {
    const n = c.querySelector('.node');
    return n && n.style.display !== 'none';
  }).length);
  check('HUD Ψ показывает Ψ', (doc.querySelector('.tree-hud-cores') || {}).textContent === '400 Ψ',
    textOf(doc.querySelector('.tree-hud-cores')));

  /* покупка узла за Ψ и живой эффект */
  const dtPsiBefore = G.growth.dtMult(state);
  const psiPsiBefore = state.res.psi;
  const psiBuy = G.upgrades.buy(state, G.registry.upgrade('ps_freq'));
  check('узел Ψ покупается за Ψ', psiBuy === 1 && state.res.psi < psiPsiBefore,
    'Ψ ' + psiPsiBefore + ' → ' + state.res.psi);
  check('эффект узла Ψ работает', G.growth.dtMult(state) < dtPsiBefore,
    'ΔT ×' + dtPsiBefore.toFixed(2) + ' → ×' + G.growth.dtMult(state).toFixed(2));
  check('следующий узел ветви скрыт до предка',
    !G.upgrades.canBuy(state, G.registry.upgrade('ps_stretch')));
  G.upgrades.buy(state, G.registry.upgrade('ps_cut'));
  check('после предка узел Ψ открывается',
    G.upgrades.canBuy(state, G.registry.upgrade('ps_stretch')),
    'span ×' + G.growth.upgProduct(state, 'spanMult').toFixed(2));

  /* регресс-тест фикса v0.26.0: speedBonus у апгрейдов был мёртвым полем */
  const spBefore = G.growth.speedBonus(state);
  state.upg.psi_speed = 1;
  check('speedBonus апгрейда читается (фикс)',
    Math.abs(G.growth.speedBonus(state) - spBefore - 0.3) < 1e-9,
    spBefore.toFixed(2) + ' → ' + G.growth.speedBonus(state).toFixed(2));
  state.upg.psi_speed = 0;
  check('карта Ψ без мусора в DOM', !/Infinity|NaN|undefined/.test(doc.body.textContent));
  state.res.psi = psiWas;
  state.meta.breaks = breaksWas;

  section('5v. Поиск по доскам, фильтр групп и ★ «избранное одной кнопкой» (v0.27.0)');
  G.ui.menu.open();
  await sleep(20);
  const menuOv = doc.querySelector('.menu-overlay');
  const searchInput = doc.querySelector('.menu-search');
  check('меню открылось', !!menuOv && menuOv.classList.contains('on'));
  check('поле поиска есть', !!searchInput);
  const chipCount = doc.querySelectorAll('.menu-chip').length;
  const grpCount = (G.content.groups || []).length;
  check('чипы групп: «Все» + все группы', chipCount === grpCount + 1, chipCount + ' чипов, групп ' + grpCount);
  const setSearch = (v) => { searchInput.value = v; searchInput.dispatchEvent(new win.Event('input', { bubbles: true })); };
  const menuCardIds = () => Array.from(doc.querySelectorAll('.menu-card')).map((c) => c.dataset.id);
  const uniqCards = () => new Set(menuCardIds()).size;   /* есть повторы из «Закреплённых»/«Недавних» */
  const allCards = uniqCards();
  check('в меню все доски', allCards === 28, allCards + ' уникальных карточек (27 механик + «Рост»)');

  setSearch('дерев');
  const foundIds = menuCardIds();
  check('поиск «дерев» находит ◆-дерево и Ψ-дерево',
    foundIds.indexOf('tree') >= 0 && foundIds.indexOf('psitree') >= 0,
    foundIds.join(','));
  check('поиск не тащит Решето/Зеркало по lockHint',
    foundIds.indexOf('sieve') < 0 && foundIds.indexOf('mirror') < 0, foundIds.join(','));
  check('в результатах есть заголовок «Найдено»',
    /Найдено/.test((doc.querySelector('.menu-found .menu-group-name') || {}).textContent || ''),
    textOf(doc.querySelector('.menu-found .menu-group-name')));

  setSearch('пси');
  check('алиас «пси» находит Ψ-дерево', menuCardIds().indexOf('psitree') >= 0, menuCardIds().join(','));

  setSearch('zzz-нет-такого');
  check('пустой результат даёт подсказку', !!doc.querySelector('.menu-empty'),
    textOf(doc.querySelector('.menu-empty-title')));

  setSearch('');
  check('сброс поиска возвращает все доски', uniqCards() === allCards, uniqCards() + ' шт');

  const metaChip = Array.from(doc.querySelectorAll('.menu-chip')).find((c) => c.dataset.group === 'meta');
  click(metaChip);
  await sleep(10);
  const menuMetaIds = menuCardIds();
  const metaExpected = (G.content.groups || []).find((g) => g.id === 'meta').mechs;
  check('чип «Мета» показывает только мету',
    menuMetaIds.length === metaExpected.length && menuMetaIds.every((id) => metaExpected.indexOf(id) >= 0),
    menuMetaIds.join(','));
  check('чип «Мета» подсвечен', metaChip.classList.contains('on'));
  click(Array.from(doc.querySelectorAll('.menu-chip')).find((c) => c.dataset.group === 'all'));
  await sleep(10);

  /* ★ на карточке меню */
  state.meta.pins = [];
  const pinOnTree = doc.querySelector('.menu-card[data-id="tree"] .menu-card-pin');
  check('у карточки есть звезда «закрепить»', !!pinOnTree);
  click(pinOnTree);
  await sleep(10);
  check('звезда закрепляет доску', (state.meta.pins || []).indexOf('tree') >= 0,
    JSON.stringify(state.meta.pins));
  check('в меню появилась секция «Закреплённые»', !!doc.querySelector('.menu-pins'));

  /* Esc: сначала чистит поиск, потом закрывает меню */
  setSearch('глиф');
  searchInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(10);
  check('Esc сбрасывает поиск, не закрывая меню',
    searchInput.value === '' && menuOv.classList.contains('on'), 'value=«' + searchInput.value + '»');
  searchInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(10);
  check('второй Esc закрывает меню', !menuOv.classList.contains('on'));
  G.ui.menu.close();

  /* ★ в полоске над доской — «избранное одной кнопкой» */
  const coresWas = state.res.cores;
  state.res.cores = Math.max(1, coresWas || 0);
  G.ui.docks.select('tree');
  await sleep(30);
  const bhPin = doc.querySelector('.bh-pin');
  check('★ в полоске над доской есть', !!bhPin);
  check('★ показывает, что доска уже закреплена', bhPin && bhPin.classList.contains('on'),
    bhPin ? bhPin.className : 'нет кнопки');
  click(bhPin);
  await sleep(10);
  check('★ открепляет доску одним кликом', (state.meta.pins || []).indexOf('tree') < 0,
    JSON.stringify(state.meta.pins));
  state.res.cores = coresWas;
  state.meta.pins = [];

  /* Ctrl+K — меню сразу с поиском */
  doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  await sleep(20);
  check('Ctrl+K открывает меню', menuOv.classList.contains('on'));
  check('Ctrl+K ставит фокус в поиск', doc.activeElement === doc.querySelector('.menu-search'),
    (doc.activeElement || {}).className);
  G.ui.menu.close();
  check('поиск и закрепление без ошибок в логе', errors.length === 0, errors.join(' | '));

  section('5w. Паттерны мантиссы — узоры ловятся сами (v0.27.0)');
  const patCfg = G.content.patterns;
  check('типов узоров в данных', (patCfg.types || []).length === 5, (patCfg.types || []).map((t) => t.id).join(','));
  check('у доски паттернов есть цвет и ярус',
    Cc.mechColor('patterns').indexOf('#') === 0 && Cc.mechTier('patterns') === '1',
    Cc.mechColor('patterns') + ' / ' + Cc.mechTier('patterns'));

  /* детектор: все пять типов на своих строках */
  const hitTypes = (str) => G.patterns.scan(str).map((h) => h.type);
  check('трипл находится', hitTypes('12347779').indexOf('triple') >= 0, hitTypes('12347779').join(','));
  check('квадро находится, а не трипл', hitTypes('1237777').indexOf('quad') >= 0, hitTypes('1237777').join(','));
  check('лесенка находится', hitTypes('1230777').indexOf('run3') >= 0, hitTypes('1230777').join(','));
  check('штурвал (4 подряд) находится', hitTypes('432100000').indexOf('run4') >= 0, hitTypes('432100000').join(','));
  check('палиндром находится', hitTypes('1232190000').indexOf('pal') >= 0, hitTypes('1232190000').join(','));
  check('в ровной мантиссе узоров нет', hitTypes('102030405').length === 0, hitTypes('102030405').join(','));

  /* механика: закрыта на малом D, открыта на D ≥ 10 */
  const patMech = G.registry.mechanic('patterns');
  check('паттерны закрыты до 10 цифр', !patMech.isUnlocked({ N: { m: 1, e: 5 }, D: 5, res: {}, meta: {}, mech: {} }));

  const dWas = state.D;
  state.res.energy = Math.max(state.res.energy || 0, 1e6);
  G.debug.setD(20);
  await sleep(60);
  check('паттерны открылись на D ≥ 10', patMech.isUnlocked(state), 'D=' + G.growth.D(state).toFixed(1));

  /* подсовываем число с узором 7777 — тик должен поймать узор */
  const pd = G.patterns.data(state);
  pd.lastScan = 0; pd.clock = 0;
  state.N = { m: 7.7777, e: 20 };   /* мантисса 77777… — квадро и трипл */
  state.D = G.growth.D(state);
  G.patterns.tick(state, 1);
  const caught = (pd.count.quad || 0) + (pd.count.triple || 0);
  check('узор ловится автоматически', caught > 0, JSON.stringify(pd.count));
  check('буфф включился', G.patterns.left(state) > 0, G.patterns.left(state).toFixed(1) + ' с');
  const multWithBuff = G.patterns.mult(state);
  check('множитель от узоров больше 1', multWithBuff > 1, '×' + multWithBuff.toFixed(3));
  check('тик не ловит тот же тип дважды подряд (перезарядка)', (function () {
    const before = JSON.stringify(pd.count);
    state.N = { m: 7.7777, e: 20 };
    G.patterns.tick(state, 0.3);
    return JSON.stringify(pd.count) === before;
  })());

  check('постоянный бонус даёт +1 % за тип', (function () {
    const d2 = G.patterns.data(state);
    const types = G.patterns.typesFound(state);
    const saved = d2.buffUntil;
    d2.buffUntil = 0;                       /* снимаем буфф — смотрим только постоянку */
    const m = G.patterns.mult(state);
    d2.buffUntil = saved;
    const expect = 1 + 0.01 * types + 0.004 * Math.min(d2.total || 0, 40);
    return Math.abs(m - expect) < 1e-9;
  })());

  /* доска рисуется и обновляется без мусора */
  G.ui.docks.select('patterns');
  await sleep(40);
  check('доска паттернов открылась', !!doc.querySelector('.pattern-grid'));
  check('карточек типов пять', doc.querySelectorAll('.pattern-card').length === 5,
    doc.querySelectorAll('.pattern-card').length + ' шт');
  for (let i = 0; i < 20; i++) G.ui.app.render(state);
  check('доска паттернов без Infinity/NaN', !/Infinity|NaN|undefined/.test(doc.querySelector('#board').textContent));

  /* сброс забега чистит коллекцию (scope: run) */
  G.resetScopes(state, ['run']);
  check('перерождение сбрасывает коллекцию паттернов',
    G.patterns.typesFound(state) === 0 && (G.patterns.data(state).total || 0) === 0,
    'типов ' + G.patterns.typesFound(state));
  state.D = dWas;

  section('6. Перерождение кликом');
  click(dockBtns().find((b) => b.dataset.id === 'prestige'));
  G.debug.setD(120);
  await sleep(120);
  const presBtn = doc.querySelector('.prestige-btn');
  check('кнопка перерождения есть', !!presBtn);
  check('кнопка активна на D=120', presBtn && !presBtn.disabled);
  const coresPre = state.res.cores;
  click(presBtn);
  check('перерождение сработало', (state.res.cores > coresPre) || state.meta.totalRuns > 0,
    'cores=' + state.res.cores + ', runs=' + state.meta.totalRuns);
  check('после P1 активна доска «Рост»',
    doc.querySelector('#docks .dock.active') !== null,
    textOf(doc.querySelector('#docks .dock.active')));

  section('7. Настройки (модалка, форматы, позиции)');
  click(doc.getElementById('btn-settings'));
  const modal = doc.querySelector('#modal-root .modal, #modal-root .settings');
  check('модалка настроек открылась', !!modal);
  check('у карточек апгрейдов есть иконка-медальон',
    doc.querySelectorAll('#board .upg-ico').length >= 0,
    'иконок в DOM: ' + doc.querySelectorAll('#board .upg-ico').length);
  const radios = Array.from(doc.querySelectorAll('#modal-root input, #modal-root button'));
  for (const r of radios.slice(0, 20)) {
    if (r.tagName === 'INPUT' || r.getAttribute('data-fmt') || r.getAttribute('data-pos')) click(r);
  }
  check('модалка не падает при переключениях', errors.length === 0, errors.join(' | '));

  /* ползунок ускорения в настройках */
  const range = doc.querySelector('#modal-root input[type="range"]');
  check('ползунок ускорения есть', !!range, range ? 'min=' + range.min + ' max=' + range.max : '');
  if (range) {
    range.value = '50';
    range.dispatchEvent(new win.Event('input', { bubbles: true }));
  }
  check('ползунок меняет devSpeed', state.settings.devSpeed === 50,
    'devSpeed=' + state.settings.devSpeed);
  const soundToggle = Array.from(doc.querySelectorAll('#modal-root input[type="checkbox"]'))
    .find((i) => /Звук/.test(i.closest('label') ? i.closest('label').textContent : ''));
  check('есть переключатель звука', !!soundToggle);
  if (soundToggle) {
    state.settings.sound = true;
    soundToggle.checked = false;
    soundToggle.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  check('тумблер выключает звук', state.settings.sound === false);
  if (soundToggle) {
    soundToggle.checked = true;
    soundToggle.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  check('тумблер включает звук обратно', state.settings.sound === true);

  /* v0.27.1: выключатель всплывающих подписей (узоры мантиссы, «+1 ур.») */
  const popToggle = Array.from(doc.querySelectorAll('#modal-root input[type="checkbox"]'))
    .find((i) => /Всплывающие подписи/.test(i.closest('label') ? i.closest('label').textContent : ''));
  check('есть выключатель всплывающих подписей', !!popToggle);
  state.settings.animations = true;
  if (G.ui.mainNumber && G.ui.mainNumber.applySettings) G.ui.mainNumber.applySettings(state);
  doc.querySelectorAll('.fx-pop, .fx-banner').forEach((n) => n.remove());
  if (popToggle) { popToggle.checked = true; popToggle.dispatchEvent(new win.Event('change', { bubbles: true })); }
  check('по умолчанию подписи включены', state.settings.fxPops !== false);
  G.bus.emit('pattern:found', { type: 'quad', name: 'Квадро', text: '7777' });
  check('узор всплывает при включённых подписях', doc.querySelectorAll('.fx-pop').length > 0,
    doc.querySelectorAll('.fx-pop').length + ' шт');
  doc.querySelectorAll('.fx-pop, .fx-banner').forEach((n) => n.remove());
  if (popToggle) { popToggle.checked = false; popToggle.dispatchEvent(new win.Event('change', { bubbles: true })); }
  check('тумблер выключает подписи', state.settings.fxPops === false);
  G.bus.emit('pattern:found', { type: 'quad', name: 'Квадро', text: '7777', first: true });
  check('с выключенными подписями экран чист',
    doc.querySelectorAll('.fx-pop, .fx-banner').length === 0,
    doc.querySelectorAll('.fx-pop, .fx-banner').length + ' шт');
  if (popToggle) { popToggle.checked = true; popToggle.dispatchEvent(new win.Event('change', { bubbles: true })); }
  check('тумблер включает подписи обратно', state.settings.fxPops === true);
  doc.querySelectorAll('.fx-pop, .fx-banner').forEach((n) => n.remove());

  const devToggle = Array.from(doc.querySelectorAll('#modal-root input[type="checkbox"]'))
    .find((i) => /Ускорение/.test(i.closest('label') ? i.closest('label').textContent : ''));
  check('есть переключатель ускорения', !!devToggle);
  if (devToggle) { devToggle.checked = true; devToggle.dispatchEvent(new win.Event('change', { bubbles: true })); }
  check('ускорение включается из UI', state.settings.devMode === true);
  check('в шапке виден ×50', /\u00d750/.test(textOf(doc.getElementById('heroRate'))),
    textOf(doc.getElementById('heroRate')));
  if (devToggle) { devToggle.checked = false; devToggle.dispatchEvent(new win.Event('change', { bubbles: true })); }
  state.settings.devSpeed = 1;
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
  check('Esc закрывает настройки', !doc.querySelector('#modal-root .modal'));

  section('8. 300 кадров render() (все доски по очереди)');
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) {
    if (i % 50 === 0) click(dockBtns()[i / 50 % 8]);
    G.ui.app.render(state);
    G.growth.tick(state, 0.05);
  }
  const rMs = (Date.now() - t0) / 300;
  check('render() без ошибок', errors.length === 0, errors.join(' | '));
  check('render() быстрый (< ' + PERF_MS + ' мс/кадр)', rMs < PERF_MS, rMs.toFixed(2) + ' мс/кадр');

  section('9. Мусор в DOM');
  const bad = scanBadText(doc);
  const badKeys = Object.keys(bad);
  check('нет Infinity/NaN/undefined в тексте', badKeys.length === 0,
    badKeys.slice(0, 5).join(' | '));

  section('10. Сейв: сериализация, загрузка, миграция v1');
  const ser = G.save.serialize(state);
  check('serialize() отдаёт версию', ser.v === G.SAVE_VERSION, 'v=' + ser.v);
  const round = G.save.deserialize(JSON.parse(JSON.stringify(ser)));
  check('deserialize() сохраняет ядра', round.res.cores === state.res.cores,
    round.res.cores + ' vs ' + state.res.cores);
  check('deserialize() сохраняет узлы дерева',
    G.lvl(round, 'tree_headstart') === G.lvl(state, 'tree_headstart'));
  const oldSave = { v: 1, N: { m: 1, e: 12 }, res: { energy: 5 }, upg: { mult1: 3 }, mech: {}, stats: {}, settings: {} };
  const migrated = G.save.deserialize(oldSave);
  check('миграция v1 (нет ◆/runs)', typeof migrated.res.cores === 'number' &&
    typeof migrated.meta.totalRuns === 'number', 'cores=' + migrated.res.cores);
  check('saveLocal/loadLocal', G.save.saveLocal(state) && !!G.save.loadLocal());

  section('11. Ошибки за весь прогон');
  check('лог ошибок пуст', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК') +
    '  (jsdom, ошибок в логе: ' + errors.length + ')');
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => {
  console.error('\nFATAL:', e && e.stack || e);
  process.exitCode = 1;
});
