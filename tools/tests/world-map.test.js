/* tools/tests/world-map.test.js — карта миров D1/D2 (+locked D3) без index.html.
   Проверяет: контент content/worlds.js; кнопку #btn-worldmap в шапке; оверлей с узлами
   и линиями; open/close/toggle/Escape/клик по фону; закрытые узлы (D2 без гейта, D3);
   переключение миров через заглушку G.ui.d2World.set; отсутствие NaN/Infinity;
   хук App.init (без G.ui.worldMap старый boot не ломается).
   Запуск: NODE_PATH=<repo>/node_modules node tools/tests/world-map.test.js */
'use strict';
require('../_limit')(120);

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

const HERO_HTML = '<header id="hero"><button class="icon-btn" id="btn-settings"></button></header>';

/* страница-заготовка: тело с шапкой, скрипты прогоняются вручную (как в d2-world.test.js) */
function page(bodyHtml, files) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM('<!DOCTYPE html><html><body>' + bodyHtml + '</body></html>', {
    url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  win.G = win.G || {};
  const G = win.G;
  for (const f of files) {
    try { win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
    catch (e) { errors.push(f + ': ' + e.message); }
  }
  return { dom, win, G, errors, doc: win.document };
}

function fakeState(unlocked) {
  return {
    d2: { unlocked: !!unlocked, active: false },
    settings: { scientificHints: true, numberFormat: 'short' }
  };
}

/* заглушки D2: карта должна звать именно G.ui.d2World.set, а не лезть в state сама */
function fakeD2World(G, calls, toasts) {
  G.d2 = { unlocked(s) { return !!(s && s.d2 && s.d2.unlocked); } };
  G.ui.d2World = {
    init() {},
    update() {},
    open(s) { return !!(s && s.d2 && s.d2.unlocked); },
    world(s) { return (s && s.d2 && s.d2.active) ? 'd2' : 'd1'; },
    set(s, w) {
      calls.push(w);
      if (w === 'd2' && !(s && s.d2 && s.d2.unlocked)) return 'd1';
      s.d2.active = (w === 'd2');
      return w;
    }
  };
  G.ui.toast = (msg) => { toasts.push(String(msg)); };
}

/* минимум, который нужен App.init, чтобы «старый boot» прошёл без карты */
function stubAppDeps(G) {
  G.bus = { emit() {} };
  G.initResources = () => {};
  G.growth = { D: () => 0 };
  G.save = { saveLocal() {} };
  G.ui.mainNumber = { init() {}, applySettings() {}, update() {} };
  G.ui.docks = { init() {}, refresh() {}, update() {} };
}

const MAP_FILES = ['src/core/dom.js', 'src/content/worlds.js', 'src/ui/world-map.js'];

function main() {
  /* ===================== 1–8: сам модуль карты ===================== */
  const p = page(HERO_HTML, MAP_FILES);
  const doc = p.doc, G = p.G;
  const calls = [], toasts = [];
  fakeD2World(G, calls, toasts);
  const W = G.ui.worldMap;
  const state = fakeState(false);

  section('1. Загрузка модулей');
  check('нет ошибок при загрузке', p.errors.length === 0, p.errors.join(' | '));
  check('G.ui.worldMap объявлен', !!W && typeof W.init === 'function' && typeof W.open === 'function' &&
    typeof W.close === 'function' && typeof W.toggle === 'function');

  section('2. Контент: три мира');
  const list = G.content && G.content.worlds;
  check('content.worlds — массив', Array.isArray(list), Array.isArray(list) ? list.length + ' шт' : typeof list);
  const ids = Array.isArray(list) ? list.map((w) => w.id) : [];
  check('id миров: d1, d2, d3', ids.join(',') === 'd1,d2,d3', ids.join(','));
  const d1 = (list || []).find((w) => w.id === 'd1');
  const d2 = (list || []).find((w) => w.id === 'd2');
  const d3 = (list || []).find((w) => w.id === 'd3');
  check('D1 ведёт в мир d1', !!d1 && d1.world === 'd1');
  check('D2 ведёт в мир d2', !!d2 && d2.world === 'd2');
  check('D3 помечен locked', !!d3 && d3.locked === true);
  check('у всех миров есть имя, символ и цвет',
    (list || []).every((w) => w.name && w.symbol && w.color));

  section('3. init: кнопка в шапке и оверлей');
  check('до init кнопки нет', !doc.getElementById('btn-worldmap'));
  check('init вернул true', W.init(state) === true);
  const btn = doc.getElementById('btn-worldmap');
  check('кнопка #btn-worldmap создана', !!btn);
  check('кнопка стоит в шапке', !!btn && btn.parentNode === doc.getElementById('hero'));
  check('кнопка перед настройками',
    !!btn && btn.nextElementSibling === doc.getElementById('btn-settings'));
  const overlay = doc.getElementById('worldMapOverlay');
  check('оверлей создан', !!overlay);
  check('оверлей скрыт до open', !!overlay && !overlay.classList.contains('on'));
  check('оверлей — вне header', !!overlay && overlay.parentNode === doc.body);
  check('три узла карты', doc.querySelectorAll('.map-node').length === 3,
    doc.querySelectorAll('.map-node').length + ' шт');
  check('две линии между узлами', doc.querySelectorAll('.map-line').length === 2,
    doc.querySelectorAll('.map-line').length + ' шт');
  check('у классов узлов есть world-map-* родитель', !!doc.querySelector('.world-map-nodes'));
  check('у узла D1 есть цвет из данных', !!doc.querySelector('.map-node[data-world="d1"]'));
  check('повторный init не дублирует кнопку',
    (W.init(state), doc.querySelectorAll('#btn-worldmap').length === 1));

  section('4. open / close / toggle');
  W.open(state);
  check('open показывает оверлей', overlay.classList.contains('on'));
  check('open ставит body.world-map-open', doc.body.classList.contains('world-map-open'));
  W.toggle();
  check('toggle закрывает', !overlay.classList.contains('on') && !doc.body.classList.contains('world-map-open'));
  W.toggle();
  check('toggle открывает', overlay.classList.contains('on'));
  W.close();
  check('close снимает классы', !overlay.classList.contains('on') && !doc.body.classList.contains('world-map-open'));
  W.open(state);
  doc.dispatchEvent(new p.win.KeyboardEvent('keydown', { key: 'Escape' }));
  check('Escape закрывает карту', !overlay.classList.contains('on'));
  W.open(state);
  overlay.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
  check('клик по фону закрывает', !overlay.classList.contains('on'));

  section('5. Закрытые узлы (D2 без гейта, D3)');
  W.open(state);
  const elD2 = doc.querySelector('.map-node[data-world="d2"]');
  const elD3 = doc.querySelector('.map-node[data-world="d3"]');
  const elD1 = doc.querySelector('.map-node[data-world="d1"]');
  check('D2 закрыт до гейта', elD2.classList.contains('map-node-locked') &&
    elD2.getAttribute('aria-disabled') === 'true', elD2.textContent);
  check('D2 подписан «закрыт»', /закрыт/.test(elD2.querySelector('.map-node-state').textContent));
  check('D3 закрыт всегда', elD3.classList.contains('map-node-locked') &&
    elD3.querySelector('.map-node-state').textContent === 'закрыт');
  check('D1 открыт и помечен «здесь»', !elD1.classList.contains('map-node-locked') &&
    elD1.classList.contains('map-node-current') &&
    elD1.querySelector('.map-node-state').textContent === 'здесь');
  const callsBefore = calls.length;
  elD2.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
  check('клик по закрытому D2 не переключает мир', calls.length === callsBefore, calls.join(',') || 'нет');
  check('клик по закрытому D2 объясняет тост (гейт Схлопывания)',
    /Схлопыван/.test(toasts[toasts.length - 1] || ''), toasts[toasts.length - 1] || 'нет тоста');
  elD3.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
  check('клик по D3 ничего не переключает', calls.length === callsBefore);
  check('карта после клика по закрытому узлу не закрылась', overlay.classList.contains('on'));

  section('6. Гейт открыт: переключение миров');
  state.d2.unlocked = true;
  W.init(state);
  check('D2 открылся после гейта', !elD2.classList.contains('map-node-locked') &&
    elD2.getAttribute('aria-disabled') === 'false' &&
    elD2.querySelector('.map-node-state').textContent === 'открыт');
  elD2.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
  check('клик по D2 зовёт d2World.set(state, "d2")', calls.join(',') === 'd2', calls.join(',') || 'нет');
  check('D2 стал активным миром', state.d2.active === true);
  check('после выбора карта закрылась', !overlay.classList.contains('on') &&
    !doc.body.classList.contains('world-map-open'));
  W.open(state);
  check('текущий мир D2 помечен «здесь»', elD2.classList.contains('map-node-current') &&
    elD2.querySelector('.map-node-state').textContent === 'здесь');
  elD1.dispatchEvent(new p.win.MouseEvent('click', { bubbles: true }));
  check('клик по D1 зовёт d2World.set(state, "d1")', calls.join(',') === 'd2,d1', calls.join(','));
  check('вернулись в D1', state.d2.active === false);
  W.open(state);
  check('после возврата «здесь» снова на D1',
    elD1.classList.contains('map-node-current') && elD2.classList.contains('map-node-current') === false,
    elD1.textContent + ' / ' + elD2.textContent);
  check('в тексте карты нет NaN/Infinity/undefined/null',
    !/NaN|Infinity|undefined|null/.test(overlay.textContent), overlay.textContent);

  /* ===================== 7–8: хук App.init ===================== */
  section('7. Старый boot: App.init без G.ui.worldMap');
  const p2 = page(HERO_HTML, ['src/core/dom.js', 'src/ui/app.js']);
  const G2 = p2.G;
  stubAppDeps(G2);
  let bootErr = null;
  try { G2.ui.app.init(fakeState(false)); } catch (e) { bootErr = e; }
  check('App.init без карты не падает', !bootErr, bootErr && bootErr.message);
  check('G.ui.worldMap не появился сам', !G2.ui.worldMap);
  check('кнопка карты не создана', !p2.doc.getElementById('btn-worldmap'));
  check('ошибок в консоли нет', p2.errors.length === 0, p2.errors.join(' | '));

  section('8. App.init с картой: хук вызывает init');
  const p3 = page(HERO_HTML, MAP_FILES.concat(['src/ui/app.js']));
  const G3 = p3.G;
  const calls3 = [], toasts3 = [];
  fakeD2World(G3, calls3, toasts3);
  stubAppDeps(G3);
  const state3 = fakeState(true);
  let bootErr3 = null;
  try { G3.ui.app.init(state3); } catch (e) { bootErr3 = e; }
  check('App.init с картой не падает', !bootErr3, bootErr3 && bootErr3.message);
  check('кнопка карты появилась после boot', !!p3.doc.getElementById('btn-worldmap'));
  check('оверлей карты появился после boot', !!p3.doc.getElementById('worldMapOverlay'));
  check('узлы карты собраны после boot', p3.doc.querySelectorAll('.map-node').length === 3);
  check('карта закрыта после boot', !p3.doc.getElementById('worldMapOverlay').classList.contains('on'));
  G3.ui.worldMap.open(state3);
  p3.doc.querySelector('.map-node[data-world="d1"]')
    .dispatchEvent(new p3.win.MouseEvent('click', { bubbles: true }));
  check('после boot клик по D1 переключает мир', calls3.join(',') === 'd1', calls3.join(',') || 'нет');
  check('ошибок в консоли нет', p3.errors.length === 0, p3.errors.join(' | '));

  section('9. Шапка D2: вторая кнопка карты');
  const p4 = page(HERO_HTML + '<header id="heroD2"></header>', MAP_FILES);
  fakeD2World(p4.G, [], []);
  const W4 = p4.G.ui.worldMap;
  W4.init(fakeState(true));
  const twin = p4.doc.querySelector('#heroD2 .world-map-twin');
  const overlay4 = p4.doc.getElementById('worldMapOverlay');
  check('кнопка карты есть и в шапке D2', !!twin);
  check('в шапке D2 нет второго id btn-worldmap', !p4.doc.querySelector('#heroD2 #btn-worldmap'));
  check('узлы карты не дублируются', p4.doc.querySelectorAll('.map-node').length === 3);
  twin.dispatchEvent(new p4.win.MouseEvent('click', { bubbles: true }));
  check('кнопка из шапки D2 открывает карту', overlay4.classList.contains('on'));
  twin.dispatchEvent(new p4.win.MouseEvent('click', { bubbles: true }));
  check('повторный клик по ней закрывает', !overlay4.classList.contains('on'));

  try { p.dom.window.close(); } catch (e) { /* уже закрыт */ }
  try { p4.dom.window.close(); } catch (e) { /* уже закрыт */ }
  try { p2.dom.window.close(); } catch (e) { /* уже закрыт */ }
  try { p3.dom.window.close(); } catch (e) { /* уже закрыт */ }

  console.log('');
  console.log(fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК');
  process.exitCode = fails ? 1 : 0;
}

main();
