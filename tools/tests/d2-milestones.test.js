/* tools/tests/d2-milestones.test.js — D2-милстоуны (docs/CELESTIALS.md §6).
   Запуск: node tools/tests/d2-milestones.test.js
           (часть B требует jsdom: NODE_PATH=<node_modules репозитория>)

   Грузит НАСТОЯЩИЕ src/content/d2-milestones.js и src/systems/d2-milestones.js:
     A) в vm-песочнице без DOM — контракт G.d2Milestones: list / reached / mult / sum / next / status,
        границы всех 8 порогов (25/50/75/100/150/200/300/500), данные-а не числа в коде,
        битые состояния (null, {}, bestD: NaN/'250') без NaN/Infinity;
     B) в jsdom — доска src/mechanics/d2milestones/{index,board}.js: регистрация механики,
        3 плитки, полоса до следующего порога, 8 строк наград, классы done/next, «все пройдены»,
        отсутствие NaN/Infinity/undefined и того, что update() пересобирает DOM.

   Системы D2 (G.d2, G.state) подставные: их пишут другие задачи, в этом worktree их может не быть. */
'use strict';
require('../_limit')(180);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

let passes = 0;
let fails = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  \u2713 ' + name + (extra ? '  — ' + extra : '')); }
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
}
function section(t) { console.log('\n' + t); }
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-12 : eps);
const BAD = /NaN|Infinity|undefined/;

/* ======================= ЧАСТЬ A: система без DOM ======================= */
section('A. Система G.d2Milestones (vm, без DOM)');

const SYS_FILES = [
  'src/core/format.js',
  'src/content/d2-milestones.js',
  'src/systems/d2-milestones.js'
];

function loadSystem() {
  const sandbox = { console: console, Math: Math, Object: Object, isFinite: isFinite };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of SYS_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('нет файла ' + f);
    new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }).runInContext(sandbox);
  }
  return sandbox.G;
}

const G = loadSystem();
if (!G.d2Milestones) throw new Error('G.d2Milestones не загрузился');
const M = G.d2Milestones;

/* состояние-заглушка: критерий порога — только state.d2.stats.bestD */
function st(bestD) {
  return { d2: { stats: { bestD: bestD } } };
}

const list = M.list();
const reqs = list.map((m) => m.reqD);
const EXPECTED_REQS = [25, 50, 75, 100, 150, 200, 300, 500];
const FIELDS = ['d2StartAdd', 'd2RateMult', 'd2XiMult', 'd2CollapseMult', 'd2SpanMult'];

console.log('\nA1. Данные (content/d2-milestones.js)');
check('8 порогов', list.length === 8, String(list.length));
check('пороги = 25/50/75/100/150/200/300/500', reqs.join(',') === EXPECTED_REQS.join(','), reqs.join(','));
check('id уникальны', new Set(list.map((m) => m.id)).size === list.length);
check('id — строки', list.every((m) => typeof m.id === 'string' && m.id.length > 0));
check('имена заполнены', list.every((m) => typeof m.name === 'string' && m.name.length > 0));
check('у награды ровно одно из mult/add',
  list.every((m) => {
    const r = m.reward || {};
    const hasMult = typeof r.mult === 'number';
    const hasAdd = typeof r.add === 'number';
    return hasMult !== hasAdd;
  }));
check('field — один из D2-хуков §9', list.every((m) => FIELDS.indexOf(m.reward.field) >= 0),
  list.map((m) => m.reward.field).join(','));
check('у каждой награды есть текст для доски',
  list.every((m) => typeof m.reward.text === 'string' && m.reward.text.length > 0));
check('множители > 1, прибавки > 0',
  list.every((m) => (m.reward.mult !== undefined ? m.reward.mult > 1 : m.reward.add > 0)));
check('набор полей покрывает все 5 хуков §9',
  FIELDS.every((f) => list.some((m) => m.reward.field === f)));

console.log('\nA2. reached(): границы порогов по state.d2.stats.bestD');
const boundary = [
  [0, 0], [24, 0], [25, 1], [49, 1], [50, 2], [74, 2], [75, 3], [99, 3], [100, 4],
  [149, 4], [150, 5], [199, 5], [200, 6], [299, 6], [300, 7], [499, 7], [500, 8], [1e6, 8]
];
for (const [best, want] of boundary) {
  const got = M.reached(st(best)).length;
  check('bestD ' + best + ' → ' + want + ' порогов', got === want, 'получено ' + got);
}
check('reached() отдаёт объекты данных',
  M.reached(st(100)).every((m) => typeof m.id === 'string' && typeof m.reqD === 'number'));

console.log('\nA3. mult(): произведение пройденных множителей поля');
const rates = list.filter((m) => m.reward.field === 'd2RateMult').map((m) => m.reward.mult);
const xis = list.filter((m) => m.reward.field === 'd2XiMult').map((m) => m.reward.mult);
const collapses = list.filter((m) => m.reward.field === 'd2CollapseMult').map((m) => m.reward.mult);
const spans = list.filter((m) => m.reward.field === 'd2SpanMult').map((m) => m.reward.mult);
check('до первого порога множитель ровно 1', M.mult(st(0), 'd2RateMult') === 1);
check('25 → скорость осей ×' + rates[0], near(M.mult(st(25), 'd2RateMult'), rates[0]),
  String(M.mult(st(25), 'd2RateMult')));
check('199 → скорость осей ещё ×' + rates[0], near(M.mult(st(199), 'd2RateMult'), rates[0]));
check('200 → скорость осей ×' + (rates[0] * rates[1]),
  near(M.mult(st(200), 'd2RateMult'), rates[0] * rates[1]), String(M.mult(st(200), 'd2RateMult')));
check('1e6 → скорость осей ×' + (rates[0] * rates[1]),
  near(M.mult(st(1e6), 'd2RateMult'), rates[0] * rates[1]));
check('50 → Ξ ×' + xis[0], near(M.mult(st(50), 'd2XiMult'), xis[0]), String(M.mult(st(50), 'd2XiMult')));
check('300 → Ξ ×' + (xis[0] * xis[1]), near(M.mult(st(300), 'd2XiMult'), xis[0] * xis[1]),
  String(M.mult(st(300), 'd2XiMult')));
check('49 → Ξ = 1 (порог 50 ещё не пройден)', M.mult(st(49), 'd2XiMult') === 1);
check('149 → Ξ ×' + xis[0] + ' (порог 300 не пройден)', near(M.mult(st(149), 'd2XiMult'), xis[0]),
  String(M.mult(st(149), 'd2XiMult')));
check('100 → ⌬ ×' + collapses[0], near(M.mult(st(100), 'd2CollapseMult'), collapses[0]));
check('500 → ⌬ ×' + (collapses[0] * collapses[1]),
  near(M.mult(st(500), 'd2CollapseMult'), collapses[0] * collapses[1]),
  String(M.mult(st(500), 'd2CollapseMult')));
check('149 → плоскость софткапа = 1', M.mult(st(149), 'd2SpanMult') === 1);
check('150 → плоскость софткапа ×' + spans[0], near(M.mult(st(150), 'd2SpanMult'), spans[0]));
check('неизвестное поле → 1', M.mult(st(1e6), 'd2Nothing') === 1);
check('mult не зависит от других полей', near(M.mult(st(500), 'd2SpanMult'), spans[0]),
  String(M.mult(st(500), 'd2SpanMult')));

console.log('\nA4. sum(): сумма пройденных прибавок поля');
const starts = list.filter((m) => m.reward.field === 'd2StartAdd').map((m) => m.reward.add);
check('74 → 0', M.sum(st(74), 'd2StartAdd') === 0);
check('75 → +' + starts[0], M.sum(st(75), 'd2StartAdd') === starts[0], String(M.sum(st(75), 'd2StartAdd')));
check('1e6 → +' + starts[0] + ' (прибавка одна)', M.sum(st(1e6), 'd2StartAdd') === starts[0]);
check('неизвестное поле → 0', M.sum(st(1e6), 'd2Nothing') === 0);
check('sum по множительному полю → 0', M.sum(st(1e6), 'd2RateMult') === 0);

console.log('\nA5. next(): ближайший непройденный порог');
check('0 → 25', M.next(st(0)).reqD === 25, String(M.next(st(0)).reqD));
check('25 → 50 (пройденный не возвращается)', M.next(st(25)).reqD === 50, String(M.next(st(25)).reqD));
check('499 → 500', M.next(st(499)).reqD === 500, String(M.next(st(499)).reqD));
check('500 → null', M.next(st(500)) === null);
check('1e6 → null', M.next(st(1e6)) === null);

console.log('\nA6. status(): строка бейджа без NaN/Infinity');
const st0 = M.status(st(0));
const st100 = M.status(st(100));
const stAll = M.status(st(500));
check('0 → «0 / 8 · до 25»', st0 === '0 / 8 · до 25', st0);
check('100 → «4 / 8 · до 150»', st100 === '4 / 8 · до 150', st100);
check('500 → «8 / 8 · все»', stAll === '8 / 8 · все', stAll);
check('status без NaN/Infinity', !BAD.test(st0 + st100 + stAll));

console.log('\nA7. Битые состояния: система молчит, а не падает');
const BROKEN = [null, undefined, {}, { d2: null }, { d2: {} }, { d2: { stats: {} } },
  { d2: { stats: { bestD: NaN } } }, { d2: { stats: { bestD: '250' } } }];
let brokenOk = true;
for (const s of BROKEN) {
  try {
    const reached = M.reached(s);
    const nextM = M.next(s);
    const mult = M.mult(s, 'd2RateMult');
    const sum = M.sum(s, 'd2StartAdd');
    const status = M.status(s);
    const good = Array.isArray(reached) && reached.length === 0 &&
      nextM && nextM.reqD === 25 && mult === 1 && sum === 0 &&
      status === '0 / 8 · до 25' && !BAD.test(status);
    if (!good) {
      brokenOk = false;
      console.log('    плохое состояние ' + JSON.stringify(s) + ': ' +
        JSON.stringify({ reached: reached.length, next: nextM && nextM.reqD, mult: mult, sum: sum, status: status }));
    }
  } catch (e) {
    brokenOk = false;
    console.log('    исключение на ' + JSON.stringify(s) + ': ' + e.message);
  }
}
check('7 битых состояний → 0 порогов, mult 1, sum 0, next 25, без исключений', brokenOk);

console.log('\nA8. Пороги берутся из данных, а не из кода системы');
const origList = G.content.d2milestones.list;
G.content.d2milestones.list = [
  { id: 'x7', reqD: 7, name: 'X7', reward: { field: 'd2RateMult', mult: 2, text: '×2' } },
  { id: 'x9', reqD: 9, name: 'X9', reward: { field: 'd2StartAdd', add: 3, text: '+3' } }
];
const fakeBest8 = st(8);
check('reached при bestD 8 = 1 (порог 7 из данных)', M.reached(fakeBest8).length === 1,
  String(M.reached(fakeBest8).length));
check('mult ×2 из данных', M.mult(fakeBest8, 'd2RateMult') === 2, String(M.mult(fakeBest8, 'd2RateMult')));
check('next = 9 из данных', M.next(fakeBest8).reqD === 9);
check('sum по неприкрытому полю = 0', M.sum(fakeBest8, 'd2StartAdd') === 0);
check('status пересчитан по данным', M.status(fakeBest8) === '1 / 2 · до 9', M.status(fakeBest8));
G.content.d2milestones.list = origList;
check('исходные данные восстановлены (8 порогов)', M.list().length === 8);

console.log('\nA9. Система не мутирует state');
const probe = { d2: { stats: { bestD: 123.5 } } };
const before = JSON.stringify(probe);
M.reached(probe); M.mult(probe, 'd2RateMult'); M.sum(probe, 'd2StartAdd'); M.next(probe); M.status(probe);
check('state.d2.stats.bestD не изменился', JSON.stringify(probe) === before, String(probe.d2.stats.bestD));

/* ======================= ЧАСТЬ B: доска в jsdom ======================= */
section('B. Доска «Пороги D₂» (jsdom)');

const { JSDOM } = require('jsdom');
const CORE = [
  'src/core/dom.js', 'src/core/format.js', 'src/core/registry.js',
  'src/ui/icons.js', 'src/ui/components.js'
];
const MODULE_FILES = [
  'src/content/d2-milestones.js',
  'src/systems/d2-milestones.js',
  'src/mechanics/d2milestones/index.js',
  'src/mechanics/d2milestones/board.js'
];

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
for (const f of CORE.concat(MODULE_FILES)) {
  win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n//# sourceURL=' + f);
}
const GB = win.G;

/* фейковые системы по контракту §10.2 и state игры */
GB.d2 = { unlocked(s) { return !!(s && s.d2 && s.d2.unlocked); } };
GB.ui.toast = () => {};
GB.animationsOff = () => true;

function uiState(bestD, unlocked) {
  return {
    settings: { numberFormat: 'short' },
    d2: {
      unlocked: unlocked === undefined ? true : unlocked,
      stats: { bestD: bestD, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 }
    }
  };
}

console.log('\nB1. Регистрация механики');
const mech = GB.registry.mechanic('d2milestones');
check('механика d2milestones зарегистрирована', !!mech);
check('scope = meta-d2', mech.scope === 'meta-d2', mech.scope);
check('noBulk (покупать нечего)', mech.noBulk === true);
check('isUnlocked следует за G.d2.unlocked',
  mech.isUnlocked(uiState(0, true)) === true && mech.isUnlocked(uiState(0, false)) === false);
check('status = G.d2Milestones.status',
  mech.status(uiState(100)) === GB.d2Milestones.status(uiState(100)), mech.status(uiState(100)));
check('hint заполнен', typeof mech.hint === 'string' && mech.hint.length > 10);
check('апгрейдов у механики нет', GB.registry.upgradesOf('d2milestones').length === 0);

console.log('\nB2. Разметка доски');
let state = uiState(0);
GB.state = state;
const root = win.document.createElement('div');
win.document.getElementById('root').appendChild(root);
const board = GB.registry.mechanic('d2milestones').board.mount(root);
board.update(state);

const rowsOf = (r) => Array.prototype.slice.call(r.querySelectorAll('.d2-milestone'));
const tilesOf = (r) => Array.prototype.slice.call(r.querySelectorAll('.tile'));
const tileVals = (r) => tilesOf(r).map((t) => t.querySelector('.tile-val').textContent);
const fillOf = (r) => r.querySelector('.bar-fill');

check('плиток 3', tilesOf(root).length === 3, String(tilesOf(root).length));
check('полоса одна', root.querySelectorAll('.bar-wrap').length === 1);
check('строк наград 8', rowsOf(root).length === 8, String(rowsOf(root).length));
check('id строк = порядок данных',
  rowsOf(root).map((r) => r.dataset.milestone).join(',') === GB.d2Milestones.list().map((m) => m.id).join(','));
check('подпись порога у строки 0 = «D₂ ≥ 25»',
  rowsOf(root)[0].querySelector('.d2-milestone-req').textContent === 'D₂ ≥ 25',
  rowsOf(root)[0].querySelector('.d2-milestone-req').textContent);
check('текст награды совпадает с данными',
  rowsOf(root)[3].querySelector('.d2-milestone-reward').textContent ===
  GB.d2Milestones.list()[3].reward.text,
  rowsOf(root)[3].querySelector('.d2-milestone-reward').textContent);
check('в разметке нет NaN/Infinity/undefined', !BAD.test(root.textContent));
check('update() не пишет innerHTML в корень', root.querySelector('.board-body').innerHTML.indexOf('undefined') < 0);

console.log('\nB3. bestD = 0: ни одного порога');
check('плитка рекорда = 0', tileVals(root)[0] === '0', tileVals(root)[0]);
check('пройдено «0 / 8»', tileVals(root)[1] === '0 / 8', tileVals(root)[1]);
check('следующий порог «D₂ ≥ 25»', tileVals(root)[2] === 'D₂ ≥ 25', tileVals(root)[2]);
check('ни одной строки с классом done', rowsOf(root).every((r) => !r.classList.contains('done')));
check('первая строка помечена next', rowsOf(root)[0].classList.contains('next') &&
  !rowsOf(root)[1].classList.contains('next'));
check('метка next — стрелка', rowsOf(root)[0].querySelector('.d2-milestone-mark').textContent === '→',
  rowsOf(root)[0].querySelector('.d2-milestone-mark').textContent);
check('полоса на нуле', fillOf(root).style.width === '0%', fillOf(root).style.width);

console.log('\nB4. bestD = 110: четыре порога пройдены, полоса к 150');
state = uiState(110);
GB.state = state;
board.update(state);
check('плитка рекорда = 110', tileVals(root)[0] === '110', tileVals(root)[0]);
check('пройдено «4 / 8»', tileVals(root)[1] === '4 / 8', tileVals(root)[1]);
check('следующий «D₂ ≥ 150»', tileVals(root)[2] === 'D₂ ≥ 150', tileVals(root)[2]);
check('done у порогов 25/50/75/100',
  rowsOf(root).map((r) => r.classList.contains('done')).join(',') === 'true,true,true,true,false,false,false,false',
  rowsOf(root).map((r) => r.classList.contains('done')).join(','));
check('next у порога 150', rowsOf(root)[4].classList.contains('next') &&
  rowsOf(root).filter((r) => r.classList.contains('next')).length === 1);
check('метки пройденных — галочки',
  rowsOf(root).slice(0, 4).every((r) => r.querySelector('.d2-milestone-mark').textContent === '✓'));
check('полоса 20% (100 → 110 → 150)', fillOf(root).style.width === '20%', fillOf(root).style.width);
check('подпись полосы про остаток',
  /осталось 40/.test(root.querySelector('.bar-label').textContent),
  root.querySelector('.bar-label').textContent);
check('в тексте нет NaN/Infinity/undefined', !BAD.test(root.textContent));

console.log('\nB5. bestD = 1e6: все пороги пройдены');
state = uiState(1e6);
GB.state = state;
board.update(state);
check('пройдено «8 / 8»', tileVals(root)[1] === '8 / 8', tileVals(root)[1]);
check('следующий порог «все пройдены»', tileVals(root)[2] === 'все пройдены', tileVals(root)[2]);
check('все строки done', rowsOf(root).every((r) => r.classList.contains('done')));
check('ни одной строки next', rowsOf(root).every((r) => !r.classList.contains('next')));
check('полоса 100%', fillOf(root).style.width === '100%', fillOf(root).style.width);
check('подпись «все 8 порогов пройдены»',
  /все 8 порогов пройдены/.test(root.querySelector('.bar-label').textContent),
  root.querySelector('.bar-label').textContent);
check('в тексте нет NaN/Infinity/undefined', !BAD.test(root.textContent));

console.log('\nB6. Битое состояние доски');
for (const s of [{}, { d2: {} }, { d2: { stats: {} } }, { d2: { stats: { bestD: NaN } } }]) {
  board.update(s);
  check('update(' + JSON.stringify(s) + ') без исключения и без NaN',
    !BAD.test(root.textContent), tileVals(root).join(' | '));
}
board.update(null);
check('update(null) не роняет доску', !BAD.test(root.textContent));

console.log('\nB7. update() не пересобирает DOM');
const rowsBefore = rowsOf(root);
const firstChildBefore = root.firstChild;
const bodyBefore = root.querySelector('.board-body');
for (let i = 0; i < 5; i++) board.update(uiState(i * 60));
const rowsAfter = rowsOf(root);
check('строки — те же узлы', rowsAfter.length === 8 && rowsAfter.every((r, i) => r === rowsBefore[i]));
check('корень не пересобирался', root.firstChild === firstChildBefore);
check('board-body тот же узел', root.querySelector('.board-body') === bodyBefore);
check('в доске нет NaN/Infinity/undefined', !BAD.test(root.textContent));

/* ---------- итог ---------- */
console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК') + ' — ' + passes + ' проверок');
process.exitCode = fails ? 1 : 0;
