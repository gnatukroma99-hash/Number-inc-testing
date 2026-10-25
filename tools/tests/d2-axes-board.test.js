/* tools/tests/d2-axes-board.test.js — доска «Оси Ξ» (Измерение 2, задача 7).
   Запуск: NODE_PATH=<node_modules репозитория> node tools/tests/d2-axes-board.test.js
   Грузит НАСТОЯЩИЕ core/dom.js, core/format.js, core/registry.js, ui/components.js и
   mechanics/d2axes/{index,board}.js в jsdom. Системы D2 (G.d2, G.d2Growth) и content/d2
   подменяются фейками по контракту docs/DIMENSION2.md §10.2 — их пишут другие задачи
   и в этом worktree их может не быть.
   Что проверяется:
     1) механика зарегистрирована (id/order/scope/isUnlocked/status/vars), апгрейдов нет;
     2) плитки Ξ, Ξ/с, D₂, M₂, софткап-полоса, Boost и ровно 8 карточек осей;
     3) режимы покупки ×1/×10/MAX уходят в G.d2Growth.buyAxis ('1'|'10'|'max');
     4) клик Boost зовёт G.d2Growth.buyBoost; покупка обновляет Ξ и уровень;
     5) в тексте доски нет NaN/Infinity/undefined, в том числе на пустом и огромном state;
     6) update() идемпотентен (второй вызов не меняет DOM) и не пишет innerHTML. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- jsdom-окно и загрузка настоящих файлов игры ---------- */
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>', {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const win = dom.window;
win.addEventListener('error', (e) => errors.push('window.error: ' + (e && (e.message || e.error))));

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  win.eval(code + '\n//# sourceURL=' + rel);
}

let checks = 0;
let fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  else console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
}
const section = (t) => console.log('\n' + t);

/* ---------- фейковый контент D2 (числа — из ТЗ §5.2) ---------- */
const AXES = [
  { id: 'axis1', idx: 1, name: 'Длина', short: 'I', baseCost: 10, costGrowth: 1.80, max: 100, baseRate: 0.10, unlockD: 0 },
  { id: 'axis2', idx: 2, name: 'Ширина', short: 'II', baseCost: 40, costGrowth: 1.85, max: 100, baseRate: 0.08, unlockD: 5 },
  { id: 'axis3', idx: 3, name: 'Высота', short: 'III', baseCost: 160, costGrowth: 1.90, max: 100, baseRate: 0.06, unlockD: 10 },
  { id: 'axis4', idx: 4, name: 'Глубина', short: 'IV', baseCost: 640, costGrowth: 1.95, max: 100, baseRate: 0.05, unlockD: 15 },
  { id: 'axis5', idx: 5, name: 'Время', short: 'V', baseCost: 2.5e3, costGrowth: 2.00, max: 100, baseRate: 0.04, unlockD: 20 },
  { id: 'axis6', idx: 6, name: 'Порядок', short: 'VI', baseCost: 1e4, costGrowth: 2.05, max: 100, baseRate: 0.03, unlockD: 25 },
  { id: 'axis7', idx: 7, name: 'Хаос', short: 'VII', baseCost: 4e4, costGrowth: 2.10, max: 100, baseRate: 0.02, unlockD: 30 },
  { id: 'axis8', idx: 8, name: 'Предел', short: 'VIII', baseCost: 1.6e5, costGrowth: 2.15, max: 100, baseRate: 0.015, unlockD: 35 }
];
const BOOST = { base: 50, growth: 4, max: 20 };

/* ---------- фейковые системы D2 (контракт §10.2; формулы — ТЗ §5.3/§5.4) ---------- */
const calls = { axis: [], boost: 0 };
const toasts = [];

function lvlSum(s) {
  let n = 0;
  for (const a of s.d2.axes) n += a.lvl;
  return n;
}

function mkGrowth() {
  const G2 = {
    axisRate(s, i) {
      const a = AXES[i];
      if (!a) return 0;
      const next = (i + 1 < AXES.length) ? s.d2.axes[i + 1].amount : 0;
      return a.baseRate * (1 + 0.25 * s.d2.axes[i].lvl) * (1 + 0.05 * next) *
        Math.pow(2, s.d2.boost) * (1 + 0.02 * lvlSum(s));
    },
    xiRate(s) {
      return G2.axisRate(s, 0) * (1 + 0.02 * lvlSum(s));
    },
    M2(s) {
      let p = 1;
      for (const a of s.d2.axes) p *= Math.pow(1 + a.amount, 0.2);
      return p;
    },
    dt(s) {
      return Math.max(0.1, 60 / (1 + 0.02 * lvlSum(s)));
    },
    barrier(s, d) {
      return 1 / (1 + Math.pow(Math.max(0, d - 50) / 25, 1.5));
    },
    axisCost(s, i, lvl) {
      return AXES[i].baseCost * Math.pow(AXES[i].costGrowth, lvl);
    },
    buyAxis(s, i, mode) {
      calls.axis.push({ i: i, mode: mode });
      const a = AXES[i];
      const limit = mode === 'max' ? a.max : Number(mode);
      let bought = 0;
      while (bought < limit && s.d2.axes[i].lvl < a.max) {
        const cost = G2.axisCost(s, i, s.d2.axes[i].lvl);
        if (!(s.d2.res.axis >= cost)) break;
        s.d2.res.axis -= cost;
        s.d2.axes[i].lvl++;
        bought++;
      }
      return bought;
    },
    boostCost(s) {
      return BOOST.base * Math.pow(BOOST.growth, s.d2.boost);
    },
    buyBoost(s) {
      calls.boost++;
      if (s.d2.boost >= BOOST.max) return false;
      const cost = G2.boostCost(s);
      if (!(s.d2.res.axis >= cost)) return false;
      s.d2.res.axis -= cost;
      s.d2.boost++;
      return true;
    }
  };
  return G2;
}

function mkState(opts) {
  opts = opts || {};
  const axes = AXES.map(() => ({ lvl: 0, amount: 0 }));
  if (opts.lvl !== undefined) axes[0].lvl = opts.lvl;
  if (opts.amount !== undefined) axes[0].amount = opts.amount;
  return {
    settings: { numberFormat: 'short', buyMode: opts.mode || '1' },
    d2: {
      v: 1,
      unlocked: opts.unlocked === undefined ? true : opts.unlocked,
      active: true,
      N: 1,
      D: opts.D === undefined ? 0 : opts.D,
      disp: null,
      res: { axis: opts.xi === undefined ? 1000 : opts.xi, essence: 0 },
      axes: axes,
      boost: opts.boost === undefined ? 0 : opts.boost,
      upgrades: {},
      links: {},
      stats: { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 },
      lastSeen: 0
    }
  };
}

/* ---------- сборка окружения ---------- */
load('src/core/dom.js');
load('src/core/format.js');
load('src/core/registry.js');
load('src/ui/components.js');

const G = win.G;
G.animationsOff = () => true;

G.content = G.content || {};
G.content.d2 = { id: 'd2', gate: { turns: 10 }, axes: AXES, boost: BOOST };
G.d2Growth = mkGrowth();
G.d2 = {
  unlocked(s) { return !!(s && s.d2 && s.d2.unlocked); },
  D(s) { return s.d2.D; },
  N(s) { return s.d2.N; }
};
G.ui.toast = (msg, kind) => { toasts.push({ msg: msg, kind: kind }); };

load('src/mechanics/d2axes/index.js');
load('src/mechanics/d2axes/board.js');

const mech = G.registry.mechanic('d2axes');
const boardSrc = fs.readFileSync(path.join(ROOT, 'src/mechanics/d2axes/board.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, 'src/mechanics/d2axes/index.js'), 'utf8');

function mountBoard() {
  const host = win.document.getElementById('board');
  G.dom.clear(host);
  const b = mech.board.mount(host);
  return { host: host, board: b, root: host.firstChild };
}

function textOf(el) {
  return el.textContent || '';
}

function allText(root) {
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) out.push(n.nodeValue);
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  };
  walk(root);
  return out.join(' | ');
}

/* ---------- 1. паспорт механики ---------- */
section('1. Механика d2axes зарегистрирована');
ok('механика в реестре', !!mech);
ok('id = d2axes', mech && mech.id === 'd2axes', mech && mech.id);
ok('name = «Оси Ξ»', mech && mech.name === 'Оси Ξ', mech && mech.name);
ok('scope = meta-d2', mech && mech.scope === 'meta-d2', mech && mech.scope);
ok('order задан числом', mech && typeof mech.order === 'number' && isFinite(mech.order), mech && mech.order);
ok('есть hint для игрока', !!(mech && mech.hint));
ok('нет апгрейдов у механики (они в content/d2.js)', G.registry.upgradesOf('d2axes').length === 0,
  'найдено ' + G.registry.upgradesOf('d2axes').length);
ok('index.js не регистрирует D2-апгрейды', !/addUpgrade/.test(indexSrc));

const openState = mkState({ D: 3, xi: 250 });
ok('isUnlocked → true, когда G.d2.unlocked(state) = true', mech.isUnlocked(openState) === true);
const closedState = mkState({ unlocked: false });
ok('isUnlocked → false до разблокировки D2', mech.isUnlocked(closedState) === false);
ok('status показывает Ξ', mech.status(openState) === 'Ξ 250', mech.status(openState));
const vars = mech.vars(openState);
ok('vars отдаёт d2Xi/d2D/d2Axes/d2Boost',
  vars && vars.d2Xi === 250 && vars.d2D === 3 && vars.d2Axes === 0 && vars.d2Boost === 0,
  JSON.stringify(vars));
ok('vars не падает без state.d2', (() => {
  try { mech.vars({}); return true; } catch (e) { return false; }
})());

/* ---------- 2. разметка доски ---------- */
section('2. Разметка: плитки, софткап, Boost, 8 карточек');
let state = mkState({ D: 62, xi: 5000, amount: 1.5 });
G.state = state;
const m1 = mountBoard();
m1.board.update(state);

const tiles = Array.prototype.slice.call(m1.root.querySelectorAll('.tile-label')).map(textOf);
for (const label of ['Ξ · оси', 'Ξ/с', 'D₂ · цифры', 'M₂ · объём']) {
  ok('плитка «' + label + '» есть', tiles.indexOf(label) >= 0, tiles.join(', '));
}
ok('софткап-полоса есть', !!m1.root.querySelector('.bar-wrap .bar-fill'));
ok('полоса подписана как софткап D₂',
  /софткап/i.test(textOf(m1.root.querySelector('.bar-label')) || '') ||
  /софткап/i.test(textOf(m1.root.querySelector('.d2-softcap')) || ''),
  textOf(m1.root.querySelector('.d2-softcap')).slice(0, 90));
ok('карточка Boost есть', !!m1.root.querySelector('.d2-boost-card .d2-boost-buy'));

const cards = Array.prototype.slice.call(m1.root.querySelectorAll('.d2-axis-card'));
ok('карточек осей ровно 8', cards.length === 8, 'найдено ' + cards.length);
ok('карточки в порядке данных',
  cards.map((c) => c.dataset.axis).join(',') === AXES.map((a) => a.id).join(','),
  cards.map((c) => c.dataset.axis).join(','));
ok('в карточке имя оси из данных', textOf(cards[0]).indexOf('Длина') >= 0, textOf(cards[0]));
ok('в карточке короткое имя (I..VIII)', textOf(cards[7]).indexOf('VIII') >= 0, textOf(cards[7]));
ok('в карточке уровень', /ур\.\s*0\s*\/\s*100/.test(textOf(cards[0].querySelector('.d2-axis-lvl'))),
  textOf(cards[0].querySelector('.d2-axis-lvl')));
ok('в карточке amount', textOf(cards[0].querySelector('.d2-axis-amount')) === '1.5',
  textOf(cards[0].querySelector('.d2-axis-amount')));
ok('в карточке rate с /с', /\/с$/.test(textOf(cards[0].querySelector('.d2-axis-rate'))),
  textOf(cards[0].querySelector('.d2-axis-rate')));
ok('в карточке цена в Ξ', /^Ξ /.test(textOf(cards[0].querySelector('.d2-axis-buy'))),
  textOf(cards[0].querySelector('.d2-axis-buy')));
ok('цена растёт по данным (ось I дешевле оси VIII)',
  parseFloat(textOf(cards[0].querySelector('.d2-axis-buy')).replace(/[^\d.]/g, '')) <
  parseFloat(textOf(cards[7].querySelector('.d2-axis-buy')).replace(/[^\d.]/g, '')),
  textOf(cards[0].querySelector('.d2-axis-buy')) + ' < ' + textOf(cards[7].querySelector('.d2-axis-buy')));

/* ---------- 3. режимы покупки и клики ---------- */
section('3. Покупка оси: ×1 / ×10 / MAX → G.d2Growth.buyAxis');
const modeBtns = Array.prototype.slice.call(m1.root.querySelectorAll('.buy-mode'));
ok('три кнопки режима', modeBtns.length === 3, modeBtns.map(textOf).join(' '));
ok('подписи ×1/×10/MAX', modeBtns.map(textOf).join(',') === '×1,×10,MAX', modeBtns.map(textOf).join(','));
ok('активен ×1 (settings.buyMode = 1)',
  modeBtns[0].classList.contains('active') && !modeBtns[1].classList.contains('active'));

calls.axis.length = 0;
const xiBefore = state.d2.res.axis;
cards[0].querySelector('.d2-axis-buy').click();
ok('клик по оси I вызвал buyAxis(state, 0, \'1\')',
  calls.axis.length === 1 && calls.axis[0].i === 0 && calls.axis[0].mode === '1',
  JSON.stringify(calls.axis));
ok('уровень оси вырос 0 → 1', state.d2.axes[0].lvl === 1, 'lvl = ' + state.d2.axes[0].lvl);
ok('Ξ списались (10 за первый уровень)', Math.abs((xiBefore - state.d2.res.axis) - 10) < 1e-9,
  xiBefore + ' → ' + state.d2.res.axis);
ok('после клика текст обновился без ручного update',
  /ур\.\s*1\s*\/\s*100/.test(textOf(cards[0].querySelector('.d2-axis-lvl'))),
  textOf(cards[0].querySelector('.d2-axis-lvl')));

modeBtns[1].click();
ok('кнопка ×10 ставит settings.buyMode = 10', state.settings.buyMode === '10', state.settings.buyMode);
ok('после ×10 активна именно она',
  modeBtns[1].classList.contains('active') && !modeBtns[0].classList.contains('active'));
ok('цена на кнопке подписана режимом ×10',
  textOf(cards[0].querySelector('.d2-axis-buy')).indexOf('×10') > 0,
  textOf(cards[0].querySelector('.d2-axis-buy')));
calls.axis.length = 0;
cards[0].querySelector('.d2-axis-buy').click();
ok('клик в режиме ×10 → buyAxis(..., \'10\')',
  calls.axis.length === 1 && calls.axis[0].mode === '10', JSON.stringify(calls.axis));

modeBtns[2].click();
ok('кнопка MAX ставит settings.buyMode = max', state.settings.buyMode === 'max', state.settings.buyMode);
calls.axis.length = 0;
cards[0].querySelector('.d2-axis-buy').click();
ok('клик в режиме MAX → buyAxis(..., \'max\')',
  calls.axis.length === 1 && calls.axis[0].mode === 'max', JSON.stringify(calls.axis));

const buy10 = state.settings.buyMode;
state.settings.buyMode = '100';                       /* ×100 из D1-панели → у D2 это ×10 */
m1.board.update(state);
calls.axis.length = 0;
cards[1].querySelector('.d2-axis-buy').click();
ok('settings.buyMode = \'100\' доска покупает как ×10 (контракт: 1|10|max)',
  calls.axis.length === 1 && calls.axis[0].mode === '10', JSON.stringify(calls.axis));
state.settings.buyMode = buy10;

/* ---------- 4. Boost ---------- */
section('4. Boost: G.d2Growth.buyBoost');
/* предыдущие покупки осей потратили Ξ — на Boost кладём заведомо достаточно */
state.d2.res.axis = 5000;
m1.board.update(state);
const xiBoost = state.d2.res.axis;
calls.boost = 0;
toasts.length = 0;
m1.root.querySelector('.d2-boost-buy').click();
ok('клик Boost вызвал buyBoost', calls.boost === 1, 'вызовов: ' + calls.boost);
ok('уровень Boost вырос до 1', state.d2.boost === 1, 'boost = ' + state.d2.boost);
ok('Ξ списались на цену Boost (50)', Math.abs((xiBoost - state.d2.res.axis) - 50) < 1e-9,
  xiBoost + ' → ' + state.d2.res.axis);
ok('после клика уровень Boost на карточке обновился',
  /ур\.\s*1\s*\/\s*20/.test(textOf(m1.root.querySelector('.d2-boost-lvl'))),
  textOf(m1.root.querySelector('.d2-boost-lvl')));
ok('тост о покупке показан', toasts.length === 1, JSON.stringify(toasts));

const maxBoost = mkState({ xi: 1e9, boost: BOOST.max });
G.state = maxBoost;
const m2 = mountBoard();
m2.board.update(maxBoost);
const boostBtn = m2.root.querySelector('.d2-boost-buy');
ok('Boost на максимуме: кнопка выключена', boostBtn.disabled === true);
ok('Boost на максимуме: подпись «максимум»', textOf(boostBtn) === 'максимум', textOf(boostBtn));
ok('Boost на максимуме: класс maxed', /maxed/.test(boostBtn.className), boostBtn.className);

const maxAxis = mkState({ xi: 1e12, lvl: 100 });
G.state = maxAxis;
const m3 = mountBoard();
m3.board.update(maxAxis);
const maxCardBtn = m3.root.querySelectorAll('.d2-axis-card .d2-axis-buy')[0];
ok('ось на максимуме: кнопка выключена', maxCardBtn.disabled === true);
ok('ось на максимуме: подпись «максимум»', textOf(maxCardBtn) === 'максимум', textOf(maxCardBtn));
ok('ось на максимуме: карточка помечена maxed',
  m3.root.querySelectorAll('.d2-axis-card')[0].classList.contains('maxed'));

/* ---------- 5. числа: нет NaN/∞/undefined ---------- */
section('5. Числа доски конечны');
const cleanState = mkState({ D: 0, xi: 0, amount: 0 });
G.state = cleanState;
const m4 = mountBoard();
m4.board.update(cleanState);
const cleanText = allText(m4.root);
ok('пустой state: нет NaN/Infinity/undefined',
  !/NaN|Infinity|undefined|null/.test(cleanText), cleanText.slice(0, 160));
ok('пустой state: Ξ = 0 на плитке',
  textOf(m4.root.querySelectorAll('.tile-val')[0]) === '0',
  textOf(m4.root.querySelectorAll('.tile-val')[0]));
ok('пустой state: цена доступна (Ξ 10)', textOf(m4.root.querySelector('.d2-axis-buy')) === 'Ξ 10',
  textOf(m4.root.querySelector('.d2-axis-buy')));

const hugeState = mkState({ D: 1500, xi: 1e300, amount: 1e30, boost: 20 });
for (const a of hugeState.d2.axes) { a.lvl = 100; a.amount = 1e30; }
G.state = hugeState;
const m5 = mountBoard();
m5.board.update(hugeState);
const hugeText = allText(m5.root);
ok('огромный state: нет NaN/Infinity/undefined/null',
  !/NaN|Infinity|undefined|null/.test(hugeText), hugeText.slice(0, 200));
ok('огромный state: Ξ показан (не пусто)',
  textOf(m5.root.querySelectorAll('.tile-val')[0]).length > 0,
  textOf(m5.root.querySelectorAll('.tile-val')[0]));
ok('D₂ выше порога: полоса софткапа сдвинута от нуля',
  parseFloat(m5.root.querySelector('.bar-fill').style.width) > 0,
  'width = ' + m5.root.querySelector('.bar-fill').style.width);

const brokenState = mkState({ D: NaN, xi: NaN });
brokenState.d2.axes[0].amount = NaN;
G.state = brokenState;
const m6 = mountBoard();
m6.board.update(brokenState);
ok('сломанные числа не протекают в текст',
  !/NaN|Infinity|undefined/.test(allText(m6.root)), allText(m6.root).slice(0, 160));

/* ---------- 6. update идемпотентен, DOM один раз ---------- */
section('6. update() идемпотентен, DOM не перерисовывается');
G.state = state;
const m7 = mountBoard();
m7.board.update(state);
const before = m7.root.innerHTML;
m7.board.update(state);
const after = m7.root.innerHTML;
ok('два update подряд дают одинаковый DOM', before === after,
  before.length + ' vs ' + after.length + ' символов');
const cardNodesBefore = m7.root.querySelectorAll('.d2-axis-card');
m7.board.update(state);
ok('карточки не пересоздаются (те же узлы)',
  m7.root.querySelectorAll('.d2-axis-card').length === 8 &&
  m7.root.querySelectorAll('.d2-axis-card')[0] === cardNodesBefore[0]);
ok('доска не пишет innerHTML', !/innerHTML/.test(boardSrc));
ok('mount() возвращает объект с update(state)', typeof m7.board.update === 'function');

/* ---------- 7. консоль чистая ---------- */
section('7. Консоль');
ok('нет ошибок jsdom/console', errors.length === 0, errors.join(' | '));

section('');
console.log(fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks : 'ВСЁ ОК — ' + checks + ' проверок');
process.exitCode = fails ? 1 : 0;
