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

  section('3. Все доски: клик по вкладке + render');
  /* даём ресурсов и цифр, чтобы открылись все доски */
  G.debug.give(1e30);
  state.res.prime = 1e6;
  state.res.cores = 500;
  G.debug.setD(90);
  await sleep(120);

  const dockBtns = () => Array.from(doc.querySelectorAll('#docks .dock'));
  const ids = dockBtns().map((b) => b.dataset.id);
  check('открыты все 8 досок', ids.length === 8, ids.join(','));

  for (const id of ids) {
    const btn = dockBtns().find((b) => b.dataset.id === id);
    click(btn);
    const board = doc.getElementById('board');
    const kids = board.children.length;
    check('доска «' + id + '» рендерится', kids > 0, kids + ' блок(ов)');
  }

  section('4. Покупки кликами (все кнопки всех досок)');
  const groups = ['core', 'digitsum', 'primefit', 'primeranks', 'analysis', 'shop', 'tree'];
  const before = {};
  for (const g of groups) {
    before[g] = 0;
    for (const u of G.registry.upgradesOf(g)) before[g] += G.lvl(state, u.id);
  }
  for (const id of ids) {
    click(dockBtns().find((b) => b.dataset.id === id));
    const btns = Array.from(doc.querySelectorAll('#board .upg-buy, #board .node-buy'));
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

  section('5. Дерево ◆ (узлы, предки, цена в ядрах)');
  const tree = G.registry.upgradesOf('tree');
  check('узлов в дереве', tree.length === 8, tree.length + ' шт');
  const soft = G.registry.upgrade('tree_softcap');
  const tempo = G.registry.upgrade('tree_tempo');
  if (G.lvl(state, 'tree_tempo')) state.upg.tree_tempo = 0;
  check('предок блокирует узел', G.upgrades.canBuy(state, soft) === false);
  state.upg.tree_tempo = 1;
  check('с предком узел доступен', G.upgrades.canBuy(state, soft) === true);
  state.res.cores = 500;
  const paid = G.lvl(state, 'tree_headstart');
  state.upg.tree_headstart = 0;
  state.N = G.BN.fromLog10(15); state.D = 15;
  const coresBefore = state.res.cores;
  G.prestige.perform(state);
  check('стартовый рывок убран → старт с 0', G.growth.D(state) < 0.01, 'D=' + G.growth.D(state).toFixed(2));
  state.upg.tree_headstart = 3;
  state.N = G.BN.fromLog10(15); state.D = 15;
  const g2 = G.prestige.perform(state);
  check('стартовый рывок ур.3 → старт D=6', Math.abs(G.growth.D(state) - 6) < 0.01,
    'D=' + G.growth.D(state).toFixed(2) + ', ядер +' + g2);
  check('ядра не сбрасываются', state.res.cores >= coresBefore, 'cores=' + state.res.cores);
  /* заблокированный узел нельзя купить кликом */
  state.upg.tree_softcap = 0;
  state.upg.tree_tempo = 0;
  state.res.cores = 500;
  click(dockBtns().find((b) => b.dataset.id === 'tree'));
  G.ui.app.render(state);
  const lockedBtn = Array.from(doc.querySelectorAll('#board .node-buy'))
    .find((b) => /нужно:/.test(b.textContent));
  check('кнопка предка показывает «нужно:»', !!lockedBtn, textOf(lockedBtn));
  if (lockedBtn) click(lockedBtn);
  check('клик по закрытому узлу ничего не купил', G.lvl(state, 'tree_softcap') === 0);
  check('цена узла — в ядрах', /\u25c6/.test(textOf(doc.querySelector('#board .tree-grid .node-buy'))),
    textOf(doc.querySelector('#board .tree-grid .node-buy')));

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
  const radios = Array.from(doc.querySelectorAll('#modal-root input, #modal-root button'));
  for (const r of radios.slice(0, 20)) {
    if (r.tagName === 'INPUT' || r.getAttribute('data-fmt') || r.getAttribute('data-pos')) click(r);
  }
  check('модалка не падает при переключениях', errors.length === 0, errors.join(' | '));
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
