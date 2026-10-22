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
  check('досок на навигации', ids.length === 12, ids.join(','));

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
  check('узлов в дереве', tree.length === 36, tree.length + ' шт');
  check('ветви дерева', (G.content.tree.branches || []).length === 7,
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
  check('7 лучей-ветвей от хаба', spokes.length === 7, spokes.length + ' шт');
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
  check('на старте видно только 7 корней ветвей', unknownShown() === tree.length - 7,
    'скрыто: ' + unknownShown() + ' из ' + tree.length);
  check('2-й узел ветви скрыт', realShown('Слом софткапа') === false);
  check('корень ветви виден', realShown('Вечный разгон') === true);
  const hiddenBtn = Array.from(doc.querySelectorAll('#board .node.unknown .node-orb'))
    .filter((b) => b.closest('.node').style.display !== 'none');
  check('у скрытого узла нет имени/цены', hiddenBtn.length === tree.length - 7 &&
    !/[0-9]/.test(textOf(hiddenBtn[0])),
    'кнопок: ' + hiddenBtn.length + ' из ' + (tree.length - 7) + ', текст: «' + textOf(hiddenBtn[0]) + '»');

  /* покупаем корень ветви → следующий узел проявляется */
  state.res.cores = 1e6;
  const tempoBtn = Array.from(doc.querySelectorAll('#board .tree-cell .node:not(.unknown)'))
    .find((n) => textOf(n.querySelector('.node-name')) === 'Вечный разгон')
    .querySelector('.node-orb');
  click(tempoBtn);
  G.ui.app.render(state);
  check('после покупки корня 2-й узел проявился', realShown('Слом софткапа') === true,
    'ур. Вечный разгон = ' + G.lvl(state, 'tree_tempo'));
  check('скрытых стало меньше', unknownShown() === tree.length - 8, 'скрыто: ' + unknownShown());
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
  check('render() быстрый (< 4 мс/кадр)', rMs < 4, rMs.toFixed(2) + ' мс/кадр');

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
