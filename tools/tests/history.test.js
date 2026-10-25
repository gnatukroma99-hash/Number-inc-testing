/* tools/tests/history.test.js — микро-графики M и ΔT в шапке (сессия №47).
   Запуск:  NODE_PATH=<repo>/node_modules node tools/tests/history.test.js
   Что проверяет (jsdom поднимает настоящий index.html со всеми скриптами):
     1) systems/history.js собирает histM/histDt кольцом LEN точек и не пишет NaN/Infinity;
     2) series(state, 'M' / 'dT') отдаёт эти серии, path() строит по ним непустой путь;
     3) в шапке (#heroSparks) два SVG-спарклайна, update() только правит `d`, DOM не пересоздаётся;
     4) restart() чистит кольца, и пути исчезают;
     5) сейв совместим: histM/histDt переживают serialize()/deserialize(), старый сейв без них не падает. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- отчёт ---------- */
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return !!cond;
}
function section(t) { console.log('\n' + t); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BAD = /NaN|Infinity|undefined/;

/* ---------- загрузка index.html и всех <script src> ---------- */
function loadPage() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1].split('?')[0]);

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  for (const src of srcs) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { errors.push('нет файла: ' + src); continue; }
    try { win.eval(fs.readFileSync(file, 'utf8')); }
    catch (e) { errors.push('скрипт ' + src + ': ' + e.message); }
  }
  return { dom, win, G: win.G, srcs, errors };
}

async function waitBoot(win, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (win.G && win.G.state && win.G.debug) return true;
    await sleep(25);
  }
  return false;
}

async function main() {
  section('1. Загрузка index.html и всех скриптов');
  const page = loadPage();
  const dom = page.dom, win = page.win, G = page.G, doc = win.document;
  try {
    check('скриптов найдено', page.srcs.length > 5, page.srcs.length + ' шт');
    check('ошибок при загрузке нет', page.errors.length === 0, page.errors.join(' | '));
    const booted = await waitBoot(win, 3000);
    check('boot() отработал', booted);
    if (!booted) return;
    const state = G.state;

    section('2. Кольца histM / histDt в systems/history.js');
    check('G.history есть', !!G.history && typeof G.history.tick === 'function');
    G.history.restart(state);
    check('restart обнулил histM/histDt',
      state.stats.histM.length === 0 && state.stats.histDt.length === 0,
      'histM ' + state.stats.histM.length + ', histDt ' + state.stats.histDt.length);

    /* синхронный прокрут: реальный таймер игры (50 мс) не успевает вклиниться */
    const points = G.history.LEN + 6;
    for (let i = 0; i < points; i++) {
      state.N = G.BN.fromLog10(20 + i * 5);
      state.D = 20 + i * 5;
      G.history.tick(state, G.history.STEP + 0.1);
    }
    check('histM набрал ровно LEN точек', state.stats.histM.length === G.history.LEN,
      'точек: ' + state.stats.histM.length + ' из ' + points + ' тиков');
    check('histDt набрал ровно LEN точек', state.stats.histDt.length === G.history.LEN,
      'точек: ' + state.stats.histDt.length);
    const allFinite = state.stats.histM.concat(state.stats.histDt).every((v) => typeof v === 'number' && isFinite(v));
    check('в кольцах только конечные числа', allFinite);
    check('M в истории > 0', state.stats.histM[state.stats.histM.length - 1] > 0,
      'M = ' + state.stats.histM[state.stats.histM.length - 1]);
    check('ΔT в истории > 0', state.stats.histDt[state.stats.histDt.length - 1] > 0,
      'ΔT = ' + state.stats.histDt[state.stats.histDt.length - 1]);

    section('3. series() и path()');
    check("series('M') — это histM", G.history.series(state, 'M') === state.stats.histM);
    check("series('dT') — это histDt", G.history.series(state, 'dT') === state.stats.histDt);
    check("series('core') по-прежнему D", G.history.series(state, 'core') === state.stats.histD);
    const pathM = G.history.path(G.history.series(state, 'M'), 64, 22, 3);
    const pathDt = G.history.path(G.history.series(state, 'dT'), 64, 22, 3);
    check('путь M непустой', /^M[\d.]/.test(pathM) && pathM.indexOf('L') > 0, pathM.slice(0, 48) + '…');
    check('путь ΔT непустой', /^M[\d.]/.test(pathDt) && pathDt.indexOf('L') > 0, pathDt.slice(0, 48) + '…');
    check('в путях нет NaN/Infinity', !BAD.test(pathM) && !BAD.test(pathDt));

    section('4. Шапка: контейнер и два спарклайна');
    const box = doc.getElementById('heroSparks');
    check('контейнер #heroSparks в шапке', !!box && box.parentNode === doc.getElementById('hero'));
    check('контейнер aria-hidden', box && box.getAttribute('aria-hidden') === 'true');
    const svgs = box ? box.querySelectorAll('svg.hero-spark') : [];
    check('два спарклайна', svgs.length === 2, svgs.length + ' шт');
    const svgM = box && box.querySelector('.micro-m svg');
    const svgDt = box && box.querySelector('.micro-dt svg');
    check('есть график M и график ΔT', !!svgM && !!svgDt);
    check('у графиков fill=none / round', !!svgM &&
      svgM.querySelector('path').getAttribute('fill') === 'none' &&
      svgM.querySelector('path').getAttribute('stroke-linecap') === 'round');

    G.ui.app.render(state);
    const dM = svgM && svgM.querySelector('path').getAttribute('d');
    const dDt = svgDt && svgDt.querySelector('path').getAttribute('d');
    check('update() нарисовал путь M', !!dM && /^M[\d.]/.test(dM), (dM || '').slice(0, 40) + '…');
    check('update() нарисовал путь ΔT', !!dDt && /^M[\d.]/.test(dDt), (dDt || '').slice(0, 40) + '…');
    check('в атрибутах d нет NaN/Infinity', !BAD.test(dM || '') && !BAD.test(dDt || ''));
    check('в тексте шапки нет NaN/Infinity/undefined',
      !BAD.test(doc.getElementById('hero').textContent));

    section('5. DOM не пересоздаётся на каждом кадре');
    const containerBefore = box;
    for (let i = 0; i < 5; i++) G.ui.app.render(state);
    check('контейнер тот же самый', doc.getElementById('heroSparks') === containerBefore);
    check('тот же SVG M', doc.querySelector('.micro-m svg') === svgM);
    check('тот же SVG ΔT', doc.querySelector('.micro-dt svg') === svgDt);
    check('по-прежнему ровно два спарклайна', doc.querySelectorAll('#heroSparks svg.hero-spark').length === 2);

    section('6. restart() чистит кольца и убирает пути');
    G.history.restart(state);
    G.ui.app.render(state);
    check('histM пуст', state.stats.histM.length === 0);
    check('histDt пуст', state.stats.histDt.length === 0);
    check('после restart пути нет у M', !svgM.querySelector('path').getAttribute('d'));
    check('после restart пути нет у ΔT', !svgDt.querySelector('path').getAttribute('d'));
    /* и снова наполняется теми же тиками, что и раньше */
    for (let i = 0; i < 4; i++) G.history.tick(state, G.history.STEP + 0.1);
    G.ui.app.render(state);
    check('после restart графики рисуются заново',
      /^M[\d.]/.test(svgM.querySelector('path').getAttribute('d') || ''));

    section('7. Сейв совместим');
    check('histM/histDt — поля stats, сейвятся через serialize()',
      'histM' in state.stats && 'histDt' in state.stats);
    const snapshot = G.save.serialize(state);
    check('serialize() сохранил histM', Array.isArray(snapshot.stats.histM) &&
      snapshot.stats.histM.length === state.stats.histM.length, JSON.stringify(snapshot.stats.histM));
    const restored = G.save.deserialize(snapshot);
    check('deserialize() вернул histM/histDt',
      Array.isArray(restored.stats.histM) && Array.isArray(restored.stats.histDt) &&
      restored.stats.histM.length === state.stats.histM.length,
      'histM ' + restored.stats.histM.length + ', histDt ' + restored.stats.histDt.length);
    const oldSave = { stats: { histD: [1, 2, 3], histMech: {} } };   /* старый сейв без histM/histDt */
    const oldState = G.save.deserialize(Object.assign({ v: G.SAVE_VERSION }, oldSave));
    check('старый сейв без histM/histDt не падает', !!oldState && !!oldState.stats);
    G.history.ensure(oldState);   /* первый же tick() делает это сам */
    check('ensure() дописал пустые кольца',
      Array.isArray(oldState.stats.histM) && oldState.stats.histM.length === 0 &&
      Array.isArray(oldState.stats.histDt) && oldState.stats.histDt.length === 0);
    check('ensure() не тронул histD старого сейва', oldState.stats.histD.length === 3);
    check('после загрузки старого сейва ошибок нет', page.errors.length === 0, page.errors.join(' | '));
  } finally {
    try { dom.window.close(); } catch (e) { /* уже закрыт */ }
  }
}

console.log('tools/tests/history.test.js — микро-графики M и ΔT (сессия №47)');
main().then(() => {
  console.log(fails ? '\n\u2717 ПРОВАЛЕНО: ' + fails : '\n\u2713 ВСЁ ОК');
  process.exit(fails ? 1 : 0);
}).catch((e) => {
  console.error('\u2717 ИСКЛЮЧЕНИЕ:', e && e.stack || e);
  process.exit(1);
});
