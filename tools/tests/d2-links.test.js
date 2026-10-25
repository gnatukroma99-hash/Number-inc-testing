/* tools/tests/d2-links.test.js — связи D1 ↔ D2 (ТЗ docs/DIMENSION2.md §7, §10.2).
   Запуск: node tools/tests/d2-links.test.js
   Грузит НАСТОЯЩИЕ файлы игры (classic IIFE) в vm-песочницу без DOM:
   G.d2Links.d1Mult / d2StartBonus / linkCost / buyLink на фейковом state.d2
   и фейковых данных G.content.d2.links. Проверяет: закрытый D2 → 1, открытый,
   потолок ×11, стартовый бонус и его потолок 50, цену base·growth^lvl, покупку
   за ⌬, потолок уровня, отказ без ⌬, отсутствие NaN/Infinity в результатах. */
'use strict';
require('../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* порядок как в index.html (только нужное подмножество: без UI и досок) */
const FILES = [
  'src/core/eventbus.js',
  'src/core/bignum.js',
  'src/core/formula.js',
  'src/core/registry.js',
  'src/systems/state.js',
  'src/systems/growth.js',
  'src/systems/d2-links.js'
];

const sandbox = { console: console, window: {} };
vm.createContext(sandbox);
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}
const G = sandbox.window.G;

/* фейковые данные связей — ровно те, что в ТЗ §5.2 */
G.content = G.content || {};
G.content.d2 = {
  links: [
    { id: 'link_start', name: 'Мост старта', base: 2, growth: 2.0, max: 5, res: 'essence' },
    { id: 'link_m', name: 'Отражение M', base: 3, growth: 2.3, max: 6, res: 'essence' },
    { id: 'link_xi', name: 'Течение Ξ', base: 2, growth: 2.2, max: 6, res: 'essence' },
    { id: 'link_collapse', name: 'Глубина связи', base: 4, growth: 2.5, max: 4, res: 'essence' }
  ]
};

let checks = 0;
let fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  else console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
}
function okNear(name, actual, expected, tol, extra) {
  ok(name, Math.abs(actual - expected) <= tol,
    'получено ' + actual + ', ожидалось ' + expected + (extra ? ' (' + extra + ')' : ''));
}
const section = (t) => console.log('\n' + t);
const finite = (v) => typeof v === 'number' && isFinite(v);

/* state с D1 = 10^d1 и (по желанию) куском state.d2 */
function mkState(d1, d2part) {
  const s = {
    N: G.BN.fromLog10(d1 || 0),
    res: {},
    meta: {},
    upg: {},
    mech: {},
    stats: {}
  };
  if (d2part) s.d2 = d2part;
  return s;
}
function mkD2(over) {
  return Object.assign({
    v: 1,
    unlocked: true,
    active: false,
    D: 0,
    res: { axis: 0, essence: 0 },
    axes: [],
    links: {},
    stats: {}
  }, over || {});
}

const L = G.d2Links;

/* ------------------------------------------------------------------ */
section('1. API на месте');
ok('G.d2Links существует', !!L);
for (const fn of ['d1Mult', 'd2StartBonus', 'linkCost', 'buyLink']) {
  ok('G.d2Links.' + fn + ' — функция', typeof L[fn] === 'function');
}

/* ------------------------------------------------------------------ */
section('2. d1Mult: закрытый D2 не влияет на D1');
okNear('нет state.d2 вовсе → 1', L.d1Mult(mkState(10)), 1, 0);
okNear('unlocked=false → 1', L.d1Mult(mkState(10, { unlocked: false, D: 500, links: { link_m: 6 } })), 1, 0);
okNear('пустой state → 1', L.d1Mult({}), 1, 0);

/* ------------------------------------------------------------------ */
section('3. d1Mult: открытый D2');
okNear('открыт, 0 связей, D₂=0 → 1', L.d1Mult(mkState(10, mkD2())), 1, 0);
okNear('link_m=2, D₂=100 → 1+0.10+1.00', L.d1Mult(mkState(10, mkD2({ D: 100, links: { link_m: 2 } }))), 2.1, 1e-12);
okNear('только D₂=37.5 → 1+0.375', L.d1Mult(mkState(10, mkD2({ D: 37.5 }))), 1.375, 1e-12);
okNear('кривой сейв D₂=NaN → 1', L.d1Mult(mkState(10, mkD2({ D: NaN, links: {} }))), 1, 0);
okNear('строковый уровень «3» читается как 3', L.d1Mult(mkState(10, mkD2({ D: 0, links: { link_m: '3' } }))), 1.15, 1e-12);

/* ------------------------------------------------------------------ */
section('4. d1Mult: потолок ×11 и предел D₂=1000');
okNear('link_m=6 (max), D₂=0 → 1.30', L.d1Mult(mkState(10, mkD2({ D: 0, links: { link_m: 6 } }))), 1.3, 1e-12);
okNear('D₂=1000 → 1+0.15+10 = 11.15, но ×11', L.d1Mult(mkState(10, mkD2({ D: 1000, links: { link_m: 3 } }))), 11, 0);
okNear('D₂=1e6 (сверх 1000) → тоже ×11', L.d1Mult(mkState(10, mkD2({ D: 1e6, links: { link_m: 6 } }))), 11, 0);
ok('все значения — конечные числа',
  [mkD2(), mkD2({ D: 1000, links: { link_m: 6 } }), mkD2({ D: -5 }), mkD2({ D: Infinity })]
    .every((d) => finite(L.d1Mult(mkState(10, d)))));

/* ------------------------------------------------------------------ */
section('5. d2StartBonus: D1 → старт D₂, потолок 50');
okNear('D1=0 → 0', L.d2StartBonus(mkState(0)), 0, 0);
okNear('D1=3 → 2·log10(4)', L.d2StartBonus(mkState(3)), 2 * Math.log10(4), 1e-12);
okNear('D1=9 → 2', L.d2StartBonus(mkState(9)), 2, 1e-12);
okNear('D1=99 → 4', L.d2StartBonus(mkState(99)), 4, 1e-12);
/* D1 проходит через BN (SIG=15), поэтому допуск 1e-6, а не 1e-12 */
okNear('D1=1e10 → 20', L.d2StartBonus(mkState(1e10)), 20, 1e-6);
okNear('D1=1e30 → потолок 50', L.d2StartBonus(mkState(1e30)), 50, 0);
ok('бонус никогда не NaN/Infinity',
  [0, 1, 5, 1e3, 1e9, 1e300].every((d) => finite(L.d2StartBonus(mkState(d)))));

/* ------------------------------------------------------------------ */
section('6. linkCost: base·growth^lvl в ⌬');
const s6 = mkState(10, mkD2({ links: { link_m: 3 } }));
okNear('link_m lvl 3 → 3·2.3^3', L.linkCost(s6, 'link_m'), 3 * Math.pow(2.3, 3), 1e-9);
okNear('link_start lvl 0 → 2', L.linkCost(s6, 'link_start'), 2, 0);
okNear('link_collapse lvl 0 → 4', L.linkCost(s6, 'link_collapse'), 4, 0);
ok('неизвестный id → Number.MAX_VALUE (не 0)', L.linkCost(s6, 'нет-такой') === Number.MAX_VALUE);
ok('цена — конечное число', finite(L.linkCost(s6, 'link_m')));

/* ------------------------------------------------------------------ */
section('7. buyLink: списание ⌬, уровень +1, цена растёт');
const busLog = [];
G.bus.on('d2link:bought', (e) => busLog.push(e));

const s7 = mkState(10, mkD2({ links: {}, res: { axis: 0, essence: 100 } }));
const c0 = L.linkCost(s7, 'link_m');
ok('покупка с 100 ⌬ удалась', L.buyLink(s7, 'link_m') === true);
okNear('уровень link_m = 1', s7.d2.links.link_m, 1, 0);
okNear('⌬ списаны на цену', s7.d2.res.essence, 100 - c0, 1e-9);
ok('событие d2link:bought отправлено', busLog.length === 1 && busLog[0].id === 'link_m' && busLog[0].level === 1,
  JSON.stringify(busLog[0] || null));
okNear('цена уровня 1 выше цены уровня 0', L.linkCost(s7, 'link_m'), c0 * 2.3, 1e-9);

section('8. buyLink: отказы не меняют состояние');
const s8 = mkState(10, mkD2({ links: {}, res: { axis: 0, essence: 1 } }));
ok('без ⌬ → false', L.buyLink(s8, 'link_start') === false);
okNear('уровень не вырос', s8.d2.links.link_start || 0, 0, 0);
okNear('⌬ не тронуты', s8.d2.res.essence, 1, 0);
ok('неизвестный id → false', L.buyLink(s8, 'нет-такой') === false);
ok('нет state.d2 → false', L.buyLink(mkState(10), 'link_start') === false);
ok('⌬ = NaN → false, без NaN в сейве',
  L.buyLink(mkState(10, mkD2({ links: {}, res: { essence: NaN } })), 'link_start') === false);

section('9. buyLink: потолок уровня связи');
const s9 = mkState(10, mkD2({ links: { link_collapse: 4 }, res: { axis: 0, essence: 1e6 } }));
ok('link_collapse на max=4 → false', L.buyLink(s9, 'link_collapse') === false);
okNear('уровень остался 4', s9.d2.links.link_collapse, 4, 0);
okNear('⌬ на месте', s9.d2.res.essence, 1e6, 0);

section('10. buyLink: покупка до потолка и рост d1Mult');
const s10 = mkState(10, mkD2({ links: {}, res: { axis: 0, essence: 1e9 } }));
let bought = 0;
while (L.buyLink(s10, 'link_m')) bought++;
okNear('куплено ровно 6 уровней (max=6)', bought, 6, 0);
okNear('уровень на потолке', s10.d2.links.link_m, 6, 0);
okNear('d1Mult при D₂=0 и 6 уровнях = 1.30', L.d1Mult(s10), 1.3, 1e-12);
ok('⌬ остались конечными и неотрицательными',
  finite(s10.d2.res.essence) && s10.d2.res.essence >= 0, String(s10.d2.res.essence));

section('11. Никаких NaN в публичных результатах');
const probes = [mkState(0), mkState(10), mkState(1e300)];
let nanBad = 0;
for (const s of probes) {
  if (!finite(L.d1Mult(s))) nanBad++;
  if (!finite(L.d2StartBonus(s))) nanBad++;
  if (!finite(L.linkCost(s, 'link_m'))) nanBad++;
}
ok('все пробы — конечные числа', nanBad === 0, String(nanBad));

/* ------------------------------------------------------------------ */
console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks : 'ВСЁ ОК — ' + checks + ' проверок'));
process.exitCode = fails ? 1 : 0;
