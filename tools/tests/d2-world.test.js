/* tools/tests/d2-world.test.js — переключатель миров D1|D2 в реальном index.html (jsdom).
   Проверяет: закрытый D2 не показывается; после гейта 10 ⧜ появляется переключатель,
   D2-hero и доки D2; доски D2 монтируются; возврат в D1; сейв v3 сохраняет state.d2.active.
   Запуск: NODE_PATH=<repo>/node_modules node tools/tests/d2-world.test.js */
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

function loadPage(save) {
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
  if (save) win.localStorage.setItem('number_incremental_save_v1', JSON.stringify(save));
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
  section('1. Загрузка index.html');
  const page = loadPage();
  const dom = page.dom, win = page.win, G = page.G, doc = win.document;
  try {
    check('скриптов найдено', page.srcs.length > 5, page.srcs.length + ' шт');
    check('ошибок при загрузке нет', page.errors.length === 0, page.errors.join(' | '));
    const booted = await waitBoot(win, 5000);
    check('boot() отработал', booted);
    if (!booted) return;
    const state = G.state;

    section('2. D2 закрыт: переключателя нет');
    G.d2.ensure(state);
    state.d2.unlocked = false;
    state.d2.active = false;
    state.res.turns = 0;
    state.meta.tier = 'tier1';
    state.N = G.BN.fromLog10(100); state.D = 100;
    check('G.d2.unlocked = false', G.d2.unlocked(state) === false);
    check('set(d2) не открывает закрытый мир', G.ui.d2World.set(state, 'd2') === 'd1');
    G.ui.d2World.update(state);
    check('body без world-d2', !doc.body.classList.contains('world-d2'));
    check('переключатель скрыт', doc.getElementById('d2WorldSwitch').hidden === true);
    check('D2 hero есть в DOM', !!doc.getElementById('heroD2'));
    const d1ResTitles = Array.from(doc.querySelectorAll('#heroRes .res')).map((el) => el.title || '');
    check('⌬ не торчит в шапке D1', !d1ResTitles.some((t) => /Эссенция/.test(t)), d1ResTitles.join(' | '));
    check('D2 hero скрыт классом мира', !doc.body.classList.contains('world-d2'));

    section('3. Гейт 10 ⧜ + Ярус 4');
    state.res.turns = 10;
    state.N = G.BN.fromLog10(10000); state.D = 10000;
    check('G.d2.unlocked = true', G.d2.unlocked(state) === true);
    check('G.d2.active по умолчанию false', G.d2.active(state) === false);
    G.ui.d2World.update(state);
    check('переключатель показан', doc.getElementById('d2WorldSwitch').hidden === false);
    check('обе пилюли есть', doc.querySelectorAll('.d2-world-pill').length === 2);
    check('пилюля D2 не активна до переключения',
      !doc.querySelector('.d2-world-pill[data-world="d2"]').classList.contains('on'));

    section('4. Переключение в D2');
    const world = G.ui.d2World.set(state, 'd2');
    check('set вернул d2', world === 'd2', String(world));
    check('state.d2.active = true', G.d2.active(state) === true);
    check('body.world-d2', doc.body.classList.contains('world-d2'));
    check('пилюля D2 активна', doc.querySelector('.d2-world-pill[data-world="d2"]').classList.contains('on'));
    check('пилюля D1 не активна', !doc.querySelector('.d2-world-pill[data-world="d1"]').classList.contains('on'));
    check('D2 hero показывает N₂', doc.getElementById('d2HeroN').textContent.length > 0,
      doc.getElementById('d2HeroN').textContent);
    check('D2 hero показывает D₂', /D₂/.test(doc.getElementById('d2HeroD').textContent),
      doc.getElementById('d2HeroD').textContent);
    const d2Docks = Array.from(doc.querySelectorAll('#docks .dock')).map((b) => b.dataset.id);
    check('в доке только доски D2', d2Docks.length === 4 &&
      ['d2axes', 'd2collapse', 'd2links', 'd2tree'].every((id) => d2Docks.indexOf(id) >= 0),
      d2Docks.join(','));
    check('групп D2 одна', doc.querySelectorAll('#docks .dock-pill').length === 1,
      doc.querySelectorAll('#docks .dock-pill').length + ' пилюль');

    section('5. Доска «Оси Ξ» монтируется');
    G.ui.docks.select('d2axes');
    await sleep(30);
    check('доска Оси Ξ открыта', doc.body.dataset.board === 'd2axes', doc.body.dataset.board);
    check('8 карточек осей', doc.querySelectorAll('#board .d2-axis-card').length === 8,
      doc.querySelectorAll('#board .d2-axis-card').length + ' шт');
    check('кнопка Boost есть', !!doc.querySelector('#board .d2-boost-card'));
    check('в тексте доски нет NaN/Infinity/undefined',
      !/NaN|Infinity|undefined/.test(doc.querySelector('#board').textContent));

    section('6. Возврат в D1 и повторный вход');
    G.ui.d2World.set(state, 'd1');
    check('state.d2.active = false', G.d2.active(state) === false);
    check('body без world-d2', !doc.body.classList.contains('world-d2'));
    const d1Docks = Array.from(doc.querySelectorAll('#docks .dock')).map((b) => b.dataset.id);
    check('вернулись доски D1', d1Docks.indexOf('core') >= 0 && d1Docks.indexOf('d2axes') < 0,
      d1Docks.length + ' доков');
    G.ui.d2World.set(state, 'd2');
    check('повторный вход в D2 работает', G.d2.active(state) === true &&
      doc.body.classList.contains('world-d2'));

    section('7. Сейв v3');
    const raw = G.save.serialize(state);
    check('serialize v = SAVE_VERSION', raw.v === G.SAVE_VERSION, 'v = ' + raw.v);
    check('serialize содержит d2', !!raw.d2 && raw.d2.unlocked === true, 'unlocked=' + (raw.d2 && raw.d2.unlocked));
    check('serialize запомнил active', raw.d2.active === true);
    const loaded = G.save.deserialize(raw);
    check('deserialize вернул d2', !!loaded.d2 && loaded.d2.unlocked === true);
    check('deserialize вернул active', loaded.d2.active === true);

    section('8. Перезагрузка с активным D2');
    const saved = G.save.serialize(state);
    const page2 = loadPage(saved);
    const booted2 = await waitBoot(page2.win, 5000);
    check('boot2 отработал', booted2);
    if (booted2) {
      const G2 = page2.G;
      check('D2 остался активным', G2.d2.active(G2.state) === true);
      check('body.world-d2 после загрузки', page2.win.document.body.classList.contains('world-d2'));
      const ids2 = Array.from(page2.win.document.querySelectorAll('#docks .dock')).map((b) => b.dataset.id);
      check('доки D2 после загрузки', ids2.indexOf('d2axes') >= 0 && ids2.indexOf('core') < 0, ids2.join(','));
      try { page2.dom.window.close(); } catch (e) { /* уже закрыт */ }
    }

    section('9. render() без ошибок');
    let renderError = null;
    try { for (let i = 0; i < 30; i++) G.ui.app.render(state); }
    catch (e) { renderError = e; }
    check('30 кадров render() без исключений', !renderError, renderError && renderError.message);
    check('ошибок в логе нет', page.errors.length === 0, page.errors.join(' | '));
  } finally {
    try { dom.window.close(); } catch (e) { /* уже закрыт */ }
  }

  console.log('');
  console.log(fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК');
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
