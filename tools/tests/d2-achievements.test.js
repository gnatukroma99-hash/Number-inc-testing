/* tools/tests/d2-achievements.test.js — D2-достижения (docs/CELESTIALS.md §5).
   Запуск: node tools/tests/d2-achievements.test.js

   Часть 1 — логика (vm, без DOM): настоящие src/core/formula.js,
   src/content/d2-achievements.js и src/systems/d2-achievements.js. state.d2 — фейковый
   по контракту §5, чтобы тест не зависел от D2-модулей других агентов;
   G.bus — заглушка, которая считает события.
   Часть 2 — доска (jsdom): настоящие ядро/registry/dom/components/icons + фейковый G.d2.

   Проверяем: 12 условий §5 (ниже порога — закрыто, на пороге — открыто), набор vars,
   check/update (период, идемпотентность, событие), mult = 1 + 0.01·count,
   status/has, мусорный state без NaN, регистрацию механики (без mult — D1 не трогаем),
   разметку доски, плитки, обновление без пересборки DOM. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- мини-раннер ---------- */
let checks = 0;
let fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return !!cond;
}
function near(name, actual, expected, tol, extra) {
  const lim = tol === undefined ? 1e-12 : tol;
  return ok(name, isFinite(actual) && Math.abs(actual - expected) <= lim,
    'получено ' + actual + ', ожидалось ' + expected + (extra ? ' (' + extra + ')' : ''));
}
function section(t) { console.log('\n' + t); }
const BAD = /NaN|Infinity|undefined/;

/* имена переменных условий (§5) и id достижений в порядке ТЗ */
const VARS = ['D2', 'collapses', 'bestD', 'essence', 'xi', 'axesMin', 'axesMax',
  'boost', 'links', 'upgrades', 'sigils'];
const EXPECT_IDS = ['d2a_first', 'd2a_axes4', 'd2a_axes8', 'd2a_xi1k', 'd2a_ess10', 'd2a_coll3',
  'd2a_best150', 'd2a_best300', 'd2a_boost5', 'd2a_links2', 'd2a_upg3', 'd2a_sigil4'];

/* ======================= Часть 1: логика (vm) ======================= */
const LOGIC_FILES = [
  'src/core/formula.js',
  'src/content/d2-achievements.js',
  'src/systems/d2-achievements.js'
];

function loadLogic() {
  const sandbox = { console: console, Math: Math, Object: Object, Number: Number, isFinite: isFinite, Map: Map };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of LOGIC_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('нет файла ' + f);
    new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }).runInContext(sandbox);
  }
  const g = sandbox.G;
  g.bus = {
    emitted: [],
    emit(ev, payload) { g.bus.emitted.push({ ev: ev, payload: payload }); },
    on() { return function () {}; }
  };
  return g;
}

const G = loadLogic();
const A = G.d2Achievements;
if (!A) throw new Error('G.d2Achievements не загрузился');

/* фейковый state.d2 по контракту docs/DIMENSION2.md §5.1 + state.cel (§2) */
function newState(opts) {
  const o = opts || {};
  const axes = (o.axes || [0, 0, 0, 0, 0, 0, 0, 0]).map((lvl) => ({ lvl: lvl, amount: 0 }));
  const st = {
    settings: { numberFormat: 'short' },
    d2: {
      v: 1,
      unlocked: o.unlocked === undefined ? true : o.unlocked,
      active: true,
      N: { m: 1, e: 0 },
      D: o.D === undefined ? 0 : o.D,
      res: { axis: o.xi === undefined ? 0 : o.xi, essence: o.essence === undefined ? 0 : o.essence },
      axes: axes,
      boost: o.boost === undefined ? 0 : o.boost,
      upgrades: o.upgrades || {},
      links: o.links || {},
      stats: { bestD: o.bestD === undefined ? 0 : o.bestD, collapses: o.collapses || 0,
        totalEssence: 0, playtime: 0, lastCollapse: 0 },
      lastSeen: 0
    }
  };
  if (o.cel !== undefined) st.cel = o.cel;
  if (Array.isArray(o.done)) st.d2.achievements = o.done.slice();
  return st;
}
function withDone(ids) { return newState({ done: ids }); }

/* «всё пройдено»: каждое из 12 условий §5 выполнено */
function fullState() {
  return newState({
    D: 300, xi: 5000, essence: 100,
    axes: [5, 5, 5, 5, 5, 5, 5, 5], boost: 5,
    upgrades: { d2_start: 1, d2_rate: 1, d2_xi: 1 },
    links: { link_start: 1, link_m: 1 },
    bestD: 320, collapses: 4,
    cel: { sigils: 5 }
  });
}

/* ---------- 1. контент ---------- */
section('1. Контент: 12 достижений из §5');
const LIST = A.list();
ok('достижений ровно 12', LIST.length === 12, String(LIST.length));
ok('total() = 12', A.total() === 12, String(A.total()));
ok('id и порядок совпадают с ТЗ §5', LIST.map((a) => a.id).join(',') === EXPECT_IDS.join(','),
  LIST.map((a) => a.id).join(','));
ok('id уникальны', new Set(LIST.map((a) => a.id)).size === LIST.length);
for (const a of LIST) {
  ok('«' + a.id + '»: name/desc/icon/cond на месте',
    typeof a.name === 'string' && a.name.length > 0 &&
    typeof a.desc === 'string' && a.desc.length > 0 &&
    typeof a.icon === 'string' && a.icon.length > 0 &&
    typeof a.cond === 'string' && a.cond.length > 0);
  ok('«' + a.id + '»: в cond нет ^ (это XOR, а не степень)', a.cond.indexOf('^') < 0, a.cond);
}
ok('multFormula из данных = 1 + 0.01 * count',
  G.content.d2Achievements.multFormula === '1 + 0.01 * count',
  G.content.d2Achievements.multFormula);

/* ---------- 2. условия по порогам ---------- */
section('2. Условия: ниже порога закрыто, на пороге открыто');
const CASES = [
  { id: 'd2a_first', below(s) { s.d2.stats.collapses = 0; }, at(s) { s.d2.stats.collapses = 1; } },
  { id: 'd2a_axes4', below(s) { s.d2.axes[2].lvl = 3; }, at(s) { s.d2.axes[2].lvl = 4; } },
  { id: 'd2a_axes8', below(s) { s.d2.axes[0].lvl = 1; }, at(s) { s.d2.axes.forEach((a) => { a.lvl = 1; }); } },
  { id: 'd2a_xi1k', below(s) { s.d2.res.axis = 999; }, at(s) { s.d2.res.axis = 1000; } },
  { id: 'd2a_ess10', below(s) { s.d2.res.essence = 9.99; }, at(s) { s.d2.res.essence = 10; } },
  { id: 'd2a_coll3', below(s) { s.d2.stats.collapses = 2; }, at(s) { s.d2.stats.collapses = 3; } },
  { id: 'd2a_best150', below(s) { s.d2.stats.bestD = 149.9; }, at(s) { s.d2.stats.bestD = 150; } },
  { id: 'd2a_best300', below(s) { s.d2.stats.bestD = 299.9; }, at(s) { s.d2.stats.bestD = 300; } },
  { id: 'd2a_boost5', below(s) { s.d2.boost = 4; }, at(s) { s.d2.boost = 5; } },
  { id: 'd2a_links2', below(s) { s.d2.links = { link_start: 1 }; }, at(s) { s.d2.links = { link_start: 1, link_m: 1 }; } },
  { id: 'd2a_upg3', below(s) { s.d2.upgrades = { d2_start: 9 }; }, at(s) { s.d2.upgrades = { d2_start: 1, d2_rate: 1, d2_xi: 1 }; } },
  { id: 'd2a_sigil4', below(s) { s.cel = { sigils: 3 }; }, at(s) { s.cel = { sigils: 4 }; } }
];
ok('кейсов столько же, сколько достижений', CASES.length === LIST.length,
  CASES.length + ' / ' + LIST.length);
for (const c of CASES) {
  const low = newState();
  c.below(low);
  A.check(low);
  const hi = newState();
  c.at(hi);
  A.check(hi);
  ok('«' + c.id + '»: ниже порога — закрыто', A.has(low, c.id) === false, low.d2.achievements.join(','));
  ok('«' + c.id + '»: на пороге — открыто', A.has(hi, c.id) === true, hi.d2.achievements.join(','));
}
const zero = newState();
ok('на пустом state.d2 не открывается ничего', A.check(zero).length === 0, zero.d2.achievements.join(','));
const full = fullState();
const fresh = A.check(full);
ok('на полном прогрессе открываются все 12', fresh.length === 12, String(fresh.length));
ok('state.d2.achievements — массив из 12 id',
  Array.isArray(full.d2.achievements) && full.d2.achievements.length === 12,
  String(full.d2.achievements.length));

/* ---------- 3. vars() ---------- */
section('3. vars(): все переменные §5');
const vZero = A.vars(newState());
for (const k of VARS) {
  ok('vars.' + k + ' на пустом state.d2 = 0', vZero[k] === 0, String(vZero[k]));
}
const vFull = A.vars(fullState());
ok('vars.D2 = state.d2.D', vFull.D2 === 300, String(vFull.D2));
ok('vars.collapses', vFull.collapses === 4, String(vFull.collapses));
ok('vars.bestD', vFull.bestD === 320, String(vFull.bestD));
ok('vars.essence', vFull.essence === 100, String(vFull.essence));
ok('vars.xi', vFull.xi === 5000, String(vFull.xi));
ok('vars.axesMin = минимум по осям', A.vars(newState({ axes: [1, 5, 9, 2, 3, 7, 4, 6] })).axesMin === 1,
  String(A.vars(newState({ axes: [1, 5, 9, 2, 3, 7, 4, 6] })).axesMin));
ok('vars.axesMax = максимум по осям', vFull.axesMax === 5, String(vFull.axesMax));
ok('vars.boost', vFull.boost === 5, String(vFull.boost));
ok('vars.links = число купленных связей', vFull.links === 2, String(vFull.links));
ok('vars.upgrades = число купленных апгрейдов', vFull.upgrades === 3, String(vFull.upgrades));
ok('vars.sigils берутся из state.cel', vFull.sigils === 5, String(vFull.sigils));
ok('без state.cel sigils = 0', A.vars(newState()).sigils === 0, String(A.vars(newState()).sigils));
ok('связь с уровнем 0 не считается купленной',
  A.vars(newState({ links: { link_start: 0, link_m: 1 } })).links === 1,
  String(A.vars(newState({ links: { link_start: 0, link_m: 1 } })).links));

/* ---------- 4. check / update ---------- */
section('4. check и update: открытие, период, идемпотентность, событие');
G.bus.emitted.length = 0;
const s4 = newState({ collapses: 1 });
const u1 = A.update(s4, 0.4);
ok('update(0.4) первый — ещё не время, null', u1 === null, String(u1));
const u2 = A.update(s4, 0.4);
ok('update(0.4) второй — null', u2 === null, String(u2));
const u3 = A.update(s4, 0.4);
ok('update(0.4) третий — период 1 с набран, массив', Array.isArray(u3) && u3.length === 1,
  Array.isArray(u3) ? 'новых: ' + u3.length : String(u3));
ok('update открыл именно d2a_first', A.has(s4, 'd2a_first') === true, s4.d2.achievements.join(','));
ok('update(0.1) после проверки — null', A.update(s4, 0.1) === null);
ok('событие d2achievement:unlocked отправлено один раз',
  G.bus.emitted.filter((e) => e.ev === 'd2achievement:unlocked').length === 1,
  String(G.bus.emitted.length));

const s4b = newState({ essence: 10 });
const uNoDt = A.update(s4b);
ok('update без dt проверяет сразу', Array.isArray(uNoDt) && uNoDt.length === 1,
  Array.isArray(uNoDt) ? 'новых: ' + uNoDt.length : String(uNoDt));
ok('...и открыл d2a_ess10', A.has(s4b, 'd2a_ess10') === true, s4b.d2.achievements.join(','));

const sIdem = fullState();
A.check(sIdem);
const first20 = sIdem.d2.achievements.slice();
const again = A.check(sIdem);
ok('повторный check → [] (идемпотентно)', Array.isArray(again) && again.length === 0, String(again.length));
ok('повторный check не дублирует id',
  sIdem.d2.achievements.length === first20.length && sIdem.d2.achievements.join(',') === first20.join(','),
  sIdem.d2.achievements.join(','));
ok('check(state без d2) → пустой массив, d2 не создаётся',
  (function () {
    const bare = {};
    const r = A.check(bare);
    return Array.isArray(r) && r.length === 0 && bare.d2 === undefined;
  })());

/* ---------- 5. mult ---------- */
section('5. mult(): 1 + 0.01 · count');
near('0 открытых → ×1', A.mult(withDone([])), 1);
near('5 открытых → ×1.05', A.mult(withDone(EXPECT_IDS.slice(0, 5))), 1.05);
near('12 открытых → ×1.12', A.mult(withDone(EXPECT_IDS)), 1.12);
G.content.d2Achievements.multFormula = '1 + 0.02 * count';
near('формула множителя берётся из данных (0.02)', A.mult(withDone(EXPECT_IDS.slice(0, 5))), 1.1);
G.content.d2Achievements.multFormula = '0 * count';
near('неположительный множитель из данных → ×1', A.mult(withDone(EXPECT_IDS)), 1);
G.content.d2Achievements.multFormula = '1 + 0.01 * count';

/* ---------- 6. status / has ---------- */
section('6. status / has');
ok('status без открытых = 0/12', A.status(withDone([])) === '0/12', A.status(withDone([])));
ok('status со всеми = 12/12', A.status(withDone(EXPECT_IDS)) === '12/12', A.status(withDone(EXPECT_IDS)));
ok('has: открытое — true', A.has(withDone(['d2a_first']), 'd2a_first') === true);
ok('has: закрытое — false', A.has(withDone(['d2a_first']), 'd2a_coll3') === false);
ok('count не падает без state', A.count() === 0 && A.mult() === 1, String(A.count()));

/* ---------- 7. мусорный state ---------- */
section('7. Мусорный state: числа конечные, без исключений');
const junk = {
  d2: {
    D: NaN,
    res: { axis: 'много', essence: Infinity },
    axes: [{ lvl: 'x' }, null, { lvl: -3 }],
    boost: undefined,
    upgrades: 'нет',
    links: null,
    stats: { bestD: 'много', collapses: null }
  },
  cel: { sigils: NaN },
  settings: { numberFormat: 'short' }
};
const vJunk = A.vars(junk);
for (const k of VARS) {
  ok('vars.' + k + ' при мусоре — конечное число',
    typeof vJunk[k] === 'number' && isFinite(vJunk[k]), String(vJunk[k]));
}
let junkThrew = false;
let junkResult = null;
try { junkResult = A.check(junk); } catch (e) { junkThrew = true; }
ok('check(мусор) не бросает', junkThrew === false);
ok('check(мусор) вернул массив', Array.isArray(junkResult), junkResult === null ? 'null' : typeof junkResult);
ok('mult(мусор) конечен', isFinite(A.mult(junk)), String(A.mult(junk)));

/* ======================= Часть 2: доска (jsdom) ======================= */
section('8. Регистрация механики d2achievements');
const CORE = [
  'src/core/bignum.js', 'src/core/format.js', 'src/core/digits.js',
  'src/core/formula.js', 'src/core/registry.js', 'src/core/dom.js',
  'src/ui/icons.js', 'src/ui/components.js'
];
const FILES = [
  'src/content/d2-achievements.js',
  'src/systems/d2-achievements.js',
  'src/mechanics/d2achievements/index.js',
  'src/mechanics/d2achievements/board.js'
];

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const win = dom.window;
for (const f of CORE) win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const W = win.G;

/* фейковый D2 (контракт systems/d2.js) и заглушки UI */
W.content = W.content || {};
W.d2 = { unlocked(s) { return !!(s && s.d2 && s.d2.unlocked); } };
W.ui.toast = function () {};
let animationsOff = true;                 // как настройка игры: анимации выключены
W.animationsOff = function () { return animationsOff; };

for (const f of FILES) win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const mech = W.registry.mechanic('d2achievements');
ok('механика зарегистрирована', !!mech);
ok('id = d2achievements, scope meta-d2', mech.id === 'd2achievements' && mech.scope === 'meta-d2',
  mech.id + ' / ' + mech.scope);
ok('order = 10.5 (после d2tree 10.4)', mech.order === 10.5, String(mech.order));
ok('noBulk: покупать нечего', mech.noBulk === true);
ok('у механики НЕТ mult() — достижения D2 не качают M D1', typeof mech.mult === 'undefined',
  typeof mech.mult);
ok('isUnlocked следует за G.d2.unlocked',
  mech.isUnlocked(newState({ unlocked: true })) === true &&
  mech.isUnlocked(newState({ unlocked: false })) === false);
ok('status = «N/12»', mech.status(withDone([])) === '0/12' &&
  mech.status(withDone(EXPECT_IDS)) === '12/12', mech.status(withDone(EXPECT_IDS)));
ok('vars() отдаёт d2Achievements = count',
  mech.vars(withDone(EXPECT_IDS.slice(0, 7))).d2Achievements === 7,
  JSON.stringify(mech.vars(withDone(EXPECT_IDS.slice(0, 7)))));
ok('board смонтирован', !!mech.board && typeof mech.board.mount === 'function');

/* ---------- 9. разметка доски ---------- */
section('9. Доска: разметка');
function mountBoard() {
  const root = win.document.createElement('div');
  win.document.getElementById('root').appendChild(root);
  return { root: root, board: mech.board.mount(root) };
}
const cardsOf = (root) => Array.prototype.slice.call(root.querySelectorAll('.ach'));
const tileValsOf = (root) =>
  Array.prototype.slice.call(root.querySelectorAll('.tile-val')).map((el) => el.textContent);

const b1 = mountBoard();
const root1 = b1.root;
/* full — тот же state, который в §2 прошёл check(): 12 открытых id в state.d2.achievements */
let state = full;
b1.board.update(state);
ok('карточек 12', cardsOf(root1).length === 12, String(cardsOf(root1).length));
ok('id карточек = id данных (§5)',
  cardsOf(root1).map((c) => c.dataset.ach).join(',') === EXPECT_IDS.join(','),
  cardsOf(root1).map((c) => c.dataset.ach).join(','));
ok('плиток 3', root1.querySelectorAll('.tile').length === 3, String(root1.querySelectorAll('.tile').length));
ok('подсказка доски на месте', (root1.querySelector('.board-hint') || {}).textContent === mech.hint);
ok('заголовок коллекции на месте',
  (root1.querySelector('.section-title') || {}).textContent === 'Коллекция D2',
  String((root1.querySelector('.section-title') || {}).textContent));

/* ---------- 10. значения плиток и карточки ---------- */
section('10. Доска: значения, карточки, обновление без пересборки');
const tileVals = () => tileValsOf(root1);
const fmt = (v) => W.fmt.num(v, 'short');

ok('плитка «Открыто» = 12 / 12', tileVals().indexOf('12 / 12') >= 0, tileVals().join(' | '));
ok('плитка «Скорость осей» = ×1.12',
  tileVals().indexOf('×' + fmt(W.d2Achievements.mult(state))) >= 0, tileVals().join(' | '));
ok('плитка «Осталось» = 0', tileVals().indexOf('0') >= 0, tileVals().join(' | '));
ok('все 12 карточек помечены unlocked',
  cardsOf(root1).every((c) => c.classList.contains('unlocked')));
ok('текст без NaN/Infinity/undefined', !BAD.test(root1.textContent), 'ok');

const partial = withDone(EXPECT_IDS.slice(0, 5));
b1.board.update(partial);
ok('обновление: «Открыто» = 5 / 12', tileVals().indexOf('5 / 12') >= 0, tileVals().join(' | '));
ok('обновление: «Скорость осей» = ×1.05', tileVals().indexOf('×' + fmt(1.05)) >= 0, tileVals().join(' | '));
ok('обновление: «Осталось» = 7', tileVals().indexOf('7') >= 0, tileVals().join(' | '));
ok('открытых карточек ровно 5',
  cardsOf(root1).filter((c) => c.classList.contains('unlocked')).length === 5,
  String(cardsOf(root1).filter((c) => c.classList.contains('unlocked')).length));

const nodesBefore = cardsOf(root1);
const firstBefore = root1.firstChild;
for (let i = 0; i < 5; i++) b1.board.update(withDone(EXPECT_IDS.slice(0, i)));
const nodesAfter = cardsOf(root1);
ok('update() не пересобирает DOM: те же узлы',
  nodesAfter.length === 12 && nodesAfter.every((c, i) => c === nodesBefore[i]));
ok('корень доски не пересобирался', root1.firstChild === firstBefore);

/* анимация «только что открылось» — только при включённых анимациях */
section('11. Анимация открытия и пустой state');
const b2 = mountBoard();
const root2 = b2.root;
b2.board.update(withDone([]));
const opened = fullState();
W.d2Achievements.check(opened);
animationsOff = false;
b2.board.update(opened);
ok('при включённых анимациях новые карточки получают justUnlocked',
  cardsOf(root2).every((c) => c.classList.contains('justUnlocked')));
animationsOff = true;

const b3 = mountBoard();
const root3 = b3.root;
b3.board.update({ settings: { numberFormat: 'short' } });
ok('state без state.d2: доска жива, 0 / 12', tileValsOf(root3).indexOf('0 / 12') >= 0, tileValsOf(root3).join(' | '));
ok('state без state.d2: множитель ×1', tileValsOf(root3).indexOf('×1') >= 0, tileValsOf(root3).join(' | '));
ok('state без state.d2: нет NaN/Infinity/undefined', !BAD.test(root3.textContent), 'ok');

const b4 = mountBoard();
const root4 = b4.root;
b4.board.update(junk);
ok('мусорный state: плитки без NaN/Infinity',
  !BAD.test(tileValsOf(root4).join(' | ')), tileValsOf(root4).join(' | '));
ok('мусорный state: текст доски без NaN/Infinity/undefined', !BAD.test(root4.textContent), 'ok');
ok('мусорный state не сломал разметку', cardsOf(root4).length === 12, String(cardsOf(root4).length));

/* ---------- итог ---------- */
console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК') + ' — ' + checks + ' проверок');
process.exitCode = fails ? 1 : 0;
