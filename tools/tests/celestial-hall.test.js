/* tools/tests/celestial-hall.test.js — доска Hall of Celestials на реальном index.html.
   Догружает content/celestials + systems/celestials + systems/celestial-trials + mechanics/celestials
   после boot (до интеграции в index.html) и проверяет 8 карточек, предъявление, сигилы.
   Запуск: NODE_PATH=<repo>/node_modules node tools/tests/celestial-hall.test.js */
'use strict';
require('../_limit')(180);

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return !!cond;
}
function section(t) { console.log('\n' + t); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    url: 'http://localhost/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole: vc
  });
  const win = dom.window;
  for (const src of srcs) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { errors.push('нет файла: ' + src); continue; }
    try { win.eval(fs.readFileSync(file, 'utf8')); }
    catch (e) { errors.push('скрипт ' + src + ': ' + e.message); }
  }
  return { dom, win, G: win.G, errors };
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
  section('1. Загрузка index.html');
  const page = loadPage();
  const dom = page.dom, win = page.win, G = page.G, doc = win.document;
  try {
    const booted = await waitBoot(win, 5000);
    check('boot() отработал', booted);
    if (!booted) return;
    check('ошибок при загрузке нет', page.errors.length === 0, page.errors.join(' | '));

    /* догружаем модули Hall до их подключения в index.html */
    for (const f of [
      'src/content/celestials.js',
      'src/systems/celestials.js',
      'src/systems/celestial-trials.js',
      'src/mechanics/celestials/index.js',
      'src/mechanics/celestials/board.js'
    ]) {
      try { win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
      catch (e) { check('догрузка ' + f, false, e.message); }
    }
    check('G.celestials есть', !!G.celestials && typeof G.celestials.unlocked === 'function');
    check('G.celestialTrials есть', !!G.celestialTrials && typeof G.celestialTrials.complete === 'function');
    check('8 целестиалов', G.celestialTrials.list().length === 8, G.celestialTrials.list().length + ' шт');

    section('2. Гейт и состояние');
    const state = G.state;
    state.res.turns = 10;
    state.N = G.BN.fromLog10(10000); state.D = 10000;
    G.d2.ensure(state);
    G.celestials.ensure(state);
    state.d2.stats.collapses = 0;
    check('Hall закрыт без Схлопывания', G.celestials.unlocked(state) === false);
    state.d2.stats.collapses = 1;
    check('Hall открыт после первого Схлопывания', G.celestials.unlocked(state) === true);
    check('G.d2 открыт', G.d2.unlocked(state) === true);

    section('3. Доска');
    const mech = G.registry.mechanic('celestials');
    check('механика celestials зарегистрирована', !!mech && !!mech.board);
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    const board = mech.board.mount(root);
    check('8 карточек', root.querySelectorAll('.cel-card').length === 8,
      root.querySelectorAll('.cel-card').length + ' шт');
    check('8 кнопок', root.querySelectorAll('.cel-claim').length === 8);
    check('плитки есть', root.querySelectorAll('.tile').length >= 3);

    state.d2.stats.collapses = 1;
    state.d2.stats.totalEssence = 0;
    board.update(state);
    const sun = root.querySelector('.cel-card[data-cel="c_sun"]');
    check('Солнце готово', !!sun && sun.classList.contains('ready'), sun && sun.className);
    check('кнопка Солнца активна', !!sun && sun.querySelector('.cel-claim').disabled === false);
    const mercury = root.querySelector('.cel-card[data-cel="c_mercury"]');
    check('Меркурий не готов', !!mercury && !mercury.classList.contains('ready') &&
      mercury.querySelector('.cel-claim').disabled === true);

    section('4. Предъявление');
    sun.querySelector('.cel-claim').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    check('сигил начислен', state.cel.sigils === 1, String(state.cel.sigils));
    check('Солнце done', G.celestials.isDone(state, 'c_sun') === true);
    check('карточка done', sun.classList.contains('done'));
    check('кнопка Солнца disabled', sun.querySelector('.cel-claim').disabled === true);
    check('повтор не даёт второй сигил',
      G.celestialTrials.complete(state, 'c_sun') === false && state.cel.sigils === 1);
    const p = G.celestialTrials.progress(state);
    check('progress done=1 total=8', p.done === 1 && p.total === 8, JSON.stringify(p));

    section('5. Мусор');
    board.update(state);
    check('в доске нет NaN/Infinity/undefined',
      !/NaN|Infinity|undefined/.test(root.textContent || ''));
    check('ошибок в логе нет', page.errors.length === 0, page.errors.join(' | '));
  } finally {
    try { dom.window.close(); } catch (e) { /* уже закрыт */ }
  }
  console.log('');
  console.log(fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК');
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
