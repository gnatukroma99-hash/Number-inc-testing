/* tools/tests/d2-growth.test.js — производство D2 (docs/DIMENSION2.md §5.3/§5.4).
   Запуск: node tools/tests/d2-growth.test.js
   Грузит настоящие src/core/bignum.js, src/core/formula.js и src/systems/d2-growth.js
   в vm-песочницу без DOM. Данные (G.content.d2) и state.d2 — подставные: модуль обязан
   работать от контракта ТЗ, а не от файлов других агентов. G.growth подменён заглушкой
   (свипы upgProduct/upgSum), чтобы проверить связку «дерево × апгрейды/связи D2».
   Проверяет: axisRate/xiRate/M2/dt/barrier, 100 тиков, покупки осей ×1/×10/MAX и Boost,
   мягкие клампы 1e300, отсутствие NaN/Infinity и неприкосновенность D1 (state.N/state.D). */
'use strict';
require('../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

let checks = 0;
let fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return cond;
}
function near(name, actual, expected, tol, extra) {
  const d = Math.abs(actual - expected);
  const lim = tol === undefined ? 1e-12 : tol;
  return ok(name, isFinite(actual) && d <= lim,
    'получено ' + actual + ', ожидалось ' + expected + (extra ? ' (' + extra + ')' : ''));
}
function section(t) { console.log('\n' + t); }

/* ---------- загрузка модуля ---------- */
const FILES = ['src/core/bignum.js', 'src/core/formula.js', 'src/systems/d2-growth.js'];

function load() {
  const sandbox = { console: console, Math: Math, Object: Object, isFinite: isFinite };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('нет файла ' + f);
    new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }).runInContext(sandbox);
  }
  return sandbox.G;
}

const G = load();
if (!G.d2Growth) throw new Error('G.d2Growth не загрузился');
const GR = G.d2Growth;

/* ---------- данные, как в §5.2 (владелец — src/content/d2.js) ---------- */
const AXES = [
  { id: 'axis1', idx: 1, name: 'Длина', baseCost: 10, costGrowth: 1.80, max: 100, baseRate: 0.10 },
  { id: 'axis2', idx: 2, name: 'Ширина', baseCost: 40, costGrowth: 1.85, max: 100, baseRate: 0.08 },
  { id: 'axis3', idx: 3, name: 'Высота', baseCost: 160, costGrowth: 1.90, max: 100, baseRate: 0.06 },
  { id: 'axis4', idx: 4, name: 'Глубина', baseCost: 640, costGrowth: 1.95, max: 100, baseRate: 0.05 },
  { id: 'axis5', idx: 5, name: 'Время', baseCost: 2.5e3, costGrowth: 2.00, max: 100, baseRate: 0.04 },
  { id: 'axis6', idx: 6, name: 'Порядок', baseCost: 1e4, costGrowth: 2.05, max: 100, baseRate: 0.03 },
  { id: 'axis7', idx: 7, name: 'Хаос', baseCost: 4e4, costGrowth: 2.10, max: 100, baseRate: 0.02 },
  { id: 'axis8', idx: 8, name: 'Предел', baseCost: 1.6e5, costGrowth: 2.15, max: 100, baseRate: 0.015 }
];

G.content = G.content || {};
G.content.d2 = {
  id: 'd2',
  gate: { turns: 10 },
  axes: AXES,
  boost: { base: 50, growth: 4, max: 20 },
  /* эффекты апгрейдов/связей — те же поля, что у узлов дерева D2 (§8) */
  upgrades: [
    { id: 'd2_start', name: 'Стартовая ось', base: 1, growth: 2.0, max: 10, res: 'essence' },
    { id: 'd2_rate', name: 'Ускорение осей', base: 1, growth: 2.2, max: 8, res: 'essence', d2RateMult: '1.5 ** lvl' },
    { id: 'd2_xi', name: 'Плотность Ξ', base: 1, growth: 2.4, max: 8, res: 'essence', d2XiMult: '1.5 ** lvl' },
    { id: 'd2_boost', name: 'Дешёвый Boost', base: 2, growth: 2.5, max: 6, res: 'essence', d2BoostCostMult: '0.8 ** lvl' },
    { id: 'd2_collapse', name: 'Глубокий сброс', base: 3, growth: 2.6, max: 6, res: 'essence' },
    { id: 'd2_soft', name: 'Плоскость D2', base: 2, growth: 2.3, max: 5, res: 'essence', d2SpanMult: '1.5 ** lvl' }
  ],
  links: [
    { id: 'link_start', name: 'Мост старта', base: 2, growth: 2.0, max: 5, res: 'essence' },
    { id: 'link_m', name: 'Отражение M', base: 3, growth: 2.3, max: 6, res: 'essence' },
    { id: 'link_xi', name: 'Течение Ξ', base: 2, growth: 2.2, max: 6, res: 'essence', d2XiMult: '1.25 ** lvl' },
    { id: 'link_collapse', name: 'Глубина связи', base: 4, growth: 2.5, max: 4, res: 'essence' }
  ]
};

/* ---------- состояние, как в §5.1 ---------- */
function mkState() {
  const axes = [];
  for (let i = 0; i < AXES.length; i++) axes.push({ lvl: 0, amount: 0 });
  return {
    N: G.BN.fromLog10(5),
    D: 5,
    upg: {},
    d2: {
      v: 1,
      unlocked: true,
      active: true,
      N: G.BN.one(),
      D: 0,
      disp: null,
      res: { axis: 0, essence: 0 },
      axes: axes,
      boost: 0,
      upgrades: {},
      links: {},
      stats: { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 },
      lastSeen: 0
    }
  };
}

/* ---------- заглушки G.growth: узлы дерева D2 дают множители свипами ---------- */
const treeFx = { d2RateMult: 1, d2XiMult: 1, d2SpanMult: 1, d2BoostCostMult: 1, d2StartAdd: 0 };
G.growth = {
  upgProduct(state, field) {
    const v = treeFx[field];
    return isFinite(v) && v > 0 ? v : 1;
  },
  upgSum(state, field) {
    const v = treeFx[field];
    return isFinite(v) ? v : 0;
  }
};
function resetTree() {
  treeFx.d2RateMult = 1;
  treeFx.d2XiMult = 1;
  treeFx.d2SpanMult = 1;
  treeFx.d2BoostCostMult = 1;
  treeFx.d2StartAdd = 0;
}

/* ---------- поиск NaN/Infinity в поддереве D2 ---------- */
function badNumbers(obj, prefix) {
  const out = [];
  for (const k in obj) {
    const v = obj[k];
    const p = prefix ? prefix + '.' + k : k;
    if (typeof v === 'number' && !isFinite(v)) out.push(p + '=' + v);
    else if (v && typeof v === 'object' && (Array.isArray(v) || k !== 'N')) out.push(...badNumbers(v, p));
  }
  return out;
}

/* ============================ 1. Скорость осей §5.3 ============================ */
section('1. axisRate — формула §5.3');
let s = mkState();
near('нулевое состояние: ось 1 = baseRate', GR.axisRate(s, 0), 0.1);
near('нулевое состояние: ось 8 = 0.015', GR.axisRate(s, 7), 0.015);
ok('оси вне диапазона → 0', GR.axisRate(s, 8) === 0 && GR.axisRate(s, -1) === 0);

s = mkState();
s.d2.axes[0].lvl = 2;
near('уровни оси: 0.10 · (1+0.25·2) · (1+0.02·2)', GR.axisRate(s, 0), 0.1 * 1.5 * 1.04,
  1e-12, 'lvlSum=2');

s = mkState();
s.d2.axes[1].amount = 4;
near('цепочка: +5% за amount следующей оси', GR.axisRate(s, 0), 0.1 * 1.2);
near('последняя ось без цепочки', GR.axisRate(s, 7), 0.015);

s = mkState();
s.d2.axes[7].amount = 1000;
near('amount своей оси не влияет на её rate', GR.axisRate(s, 7), 0.015, 1e-15);

s = mkState();
s.d2.boost = 2;
near('boost 2 → ×2^2', GR.axisRate(s, 0), 0.4);
near('boost 2 → Ξ тоже через axisRate(0)', GR.xiRate(s), 0.4);

s = mkState();
s.d2.upgrades.d2_rate = 2;
near('апгрейд d2_rate ур.2 → ×1.5^2', GR.axisRate(s, 0), 0.1 * 2.25);
s.d2.boost = 1;
near('апгрейд и boost перемножаются', GR.axisRate(s, 0), 0.1 * 2.25 * 2);

s = mkState();
treeFx.d2RateMult = 10;
near('узел дерева D2 (upgProduct d2RateMult) → ×10', GR.axisRate(s, 0), 1, 1e-12, 'G.growth.upgProduct');
resetTree();

s = mkState();
const savedGrowth = G.growth;
delete G.growth;
near('без G.growth множитель = 1 (а не 0)', GR.axisRate(s, 0), 0.1);
near('без G.growth xiRate = baseRate(0)', GR.xiRate(s), 0.1);
ok('без G.growth barrier(0) = 1', GR.barrier(s, 0) === 1);
G.growth = savedGrowth;

/* ============================ 2. Ξ/с, M₂, ΔT₂, barrier ============================ */
section('2. xiRate / M2 / dt / barrier');
s = mkState();
s.d2.axes.forEach((a) => { a.lvl = 1; });
near('xiRate = axisRate(0) · (1+0.02·lvlSum)', GR.xiRate(s), GR.axisRate(s, 0) * (1 + 0.02 * 8), 1e-15);
s.d2.links.link_xi = 2;
near('связь link_xi ур.2 → Ξ ×1.25^2', GR.xiRate(s),
  GR.axisRate(s, 0) * (1 + 0.02 * 8) * Math.pow(1.25, 2), 1e-15);

s = mkState();
near('M₂ на нулях = 1', GR.M2(s), 1);
s.d2.axes[0].amount = 3;
near('M₂ = (1+amount)^0.2', GR.M2(s), Math.pow(4, 0.2), 1e-15);
s = mkState();
s.d2.axes.forEach((a) => { a.amount = 1; });
near('M₂ = Π(1+1)^0.2 = 2^1.6', GR.M2(s), Math.pow(2, 1.6), 1e-14);

s = mkState();
near('ΔT₂ на нулях = 60', GR.dt(s), 60);
s.d2.axes.forEach((a) => { a.lvl = 50; });
near('ΔT₂ = 60/(1+0.02·400)', GR.dt(s), 60 / 9, 1e-14, 'lvlSum=400');
s.d2.axes.forEach((a) => { a.lvl = 4000; });
near('ΔT₂ не ниже 0.1', GR.dt(s), 0.1, 1e-15, 'lvlSum=32000 → 0.0936');

s = mkState();
ok('barrier(0) = 1', GR.barrier(s, 0) === 1);
ok('barrier(50) = 1 (knee)', GR.barrier(s, 50) === 1);
near('barrier(75) = 0.5', GR.barrier(s, 75), 0.5);
near('barrier(100) = 1/(1+2^1.5)', GR.barrier(s, 100), 1 / (1 + Math.pow(2, 1.5)), 1e-15);
s.d2.upgrades.d2_soft = 1;
near('span-апгрейд: плоскость ×1.5', GR.barrier(s, 100), 1 / (1 + Math.pow(50 / 37.5, 1.5)), 1e-15);
s.d2.upgrades.d2_soft = 0;
const deep = GR.barrier(s, 1e12);
ok('очень глубокий D₂ → 1e-9, но не 0', deep === 1e-9, String(deep));
ok('barrier всегда конечен и > 0', [0, 1, 60, 1e6, 1e300, 1e308].every((d) => {
  const v = GR.barrier(s, d);
  return isFinite(v) && v > 0;
}));

/* ============================ 3. tick ============================ */
section('3. tick — один шаг и 100 тиков');
s = mkState();
const step = GR.tick(s, 1);
near('amount оси 1 за 1 с = 0.1', s.d2.axes[0].amount, 0.1, 1e-15);
near('Ξ за 1 с = 0.1', s.d2.res.axis, 0.1, 1e-15);
/* за 1 с каждая ось прибавила свой baseRate (цепочка смотрит на amount следующей) */
let expLgM2 = 0;
for (const a of AXES) expLgM2 += Math.log10(1 + a.baseRate);
const expD2 = 0.2 * expLgM2 / 60;
near('D₂ += log10(M₂)/60·barrier·dt', s.d2.D, expD2, 1e-15, 'M₂ по всем 8 осям');
near('tick вернул прирост D₂', step, expD2, 1e-15);
near('N₂ = 10^D₂', G.BN.log10(s.d2.N), s.d2.D, 1e-12);
ok('disp заполнен для плавного показа', !!s.d2.disp && s.d2.disp.to === s.d2.D &&
  s.d2.disp.from === 0);
ok('stats.playtime = 1', Math.abs(s.d2.stats.playtime - 1) < 1e-15);

s = mkState();
const n1 = G.BN.log10(s.N);
let mono = true;
for (let i = 0; i < 100; i++) {
  const inc = GR.tick(s, 0.5);
  if (!(inc >= 0) || !isFinite(inc)) mono = false;
}
ok('100 тиков: прирост D₂ неотрицателен и конечен', mono);
ok('100 тиков: D₂ вырос', s.d2.D > 0, 'D₂ = ' + s.d2.D.toFixed(6));
ok('100 тиков: все amount > 0', s.d2.axes.every((a) => a.amount > 0),
  s.d2.axes.map((a) => a.amount.toExponential(2)).join(' '));
ok('100 тиков: Ξ накопился', s.d2.res.axis > 0, 'Ξ = ' + s.d2.res.axis.toFixed(4));
ok('100 тиков: stats.playtime = 50', Math.abs(s.d2.stats.playtime - 50) < 1e-12);
ok('100 тиков: bestD = текущий D₂', s.d2.stats.bestD === s.d2.D);
ok('100 тиков: D1 не тронут (state.N)', Math.abs(G.BN.log10(s.N) - n1) < 1e-15, 'log10(N) = ' + n1);
ok('100 тиков: D1 не тронут (state.D)', s.D === 5);
ok('100 тиков: нет NaN/Infinity в D2', badNumbers(s.d2, 'd2').length === 0,
  badNumbers(s.d2, 'd2').slice(0, 4).join(', '));

s = mkState();
ok('tick с dt = 0 ничего не делает', GR.tick(s, 0) === 0 && s.d2.axes[0].amount === 0);
ok('tick с dt = NaN ничего не делает', GR.tick(s, NaN) === 0);
ok('tick без state.d2 безопасен', GR.tick({}, 1) === 0 && GR.tick(null, 1) === 0);

/* ============================ 4. Покупка осей §5.4 ============================ */
section('4. buyAxis — ×1 / ×10 / MAX');
s = mkState();
near('цена 1-го уровня оси 1 = 10', GR.axisCost(s, 0, 0), 10);
near('цена 3-го уровня = 10·1.8^2', GR.axisCost(s, 0, 2), 10 * Math.pow(1.8, 2), 1e-12);
near('цена оси 8 = 1.6e5·2.15^lvl', GR.axisCost(s, 7, 4), 1.6e5 * Math.pow(2.15, 4), 1e-6);

function sumCosts(st, i, from, n) {
  let c = 0;
  for (let k = 0; k < n; k++) c += GR.axisCost(st, i, from + k);
  return c;
}

s = mkState();
s.d2.res.axis = 5;
ok('не хватает Ξ → 0 покупок', GR.buyAxis(s, 0, '1') === 0 && s.d2.axes[0].lvl === 0);
ok('не хватает Ξ → Ξ не ушёл в минус', s.d2.res.axis === 5);

s = mkState();
s.d2.res.axis = 10;
ok('ровно хватает на 1 уровень', GR.buyAxis(s, 0, '1') === 1 && s.d2.axes[0].lvl === 1);
ok('Ξ списан в 0, а не в минус', s.d2.res.axis === 0, 'Ξ = ' + s.d2.res.axis);

s = mkState();
s.d2.res.axis = 1e6;
const cost10 = sumCosts(s, 0, 0, 10);
ok('×10 покупает 10 уровней', GR.buyAxis(s, 0, '10') === 10, 'lvl = ' + s.d2.axes[0].lvl);
near('×10 списал сумму 10 уровней', s.d2.res.axis, 1e6 - cost10, 1e-6);
s = mkState();
s.d2.res.axis = 1e6;
const plan10 = GR.axisPlan(s, 0, '10');
ok('axisPlan: count = 10', plan10.count === 10, JSON.stringify(plan10));
near('axisPlan: cost = сумма 10 уровней', plan10.cost, sumCosts(s, 0, 0, 10), 1e-9);

s = mkState();
s.d2.res.axis = 1e6;
const p10 = GR.axisPlan(s, 0, 10);
ok('числовой режим 10 = строка "10"', p10.count === 10, JSON.stringify(p10));

s = mkState();
s.d2.res.axis = 1e30;
const costMax = sumCosts(s, 0, 0, 100);
ok('MAX покупает до max = 100', GR.buyAxis(s, 0, 'max') === 100, 'lvl = ' + s.d2.axes[0].lvl);
ok('MAX списал сумму 100 уровней', Math.abs((s.d2.res.axis - (1e30 - costMax)) / costMax) < 1e-10,
  'осталось Ξ ' + s.d2.res.axis.toExponential(6) + ', ожидалось ' +
  (1e30 - costMax).toExponential(6));
ok('после max дальнейшая покупка невозможна',
  GR.buyAxis(s, 0, '1') === 0 && GR.axisPlan(s, 0, 'max').count === 0);

s = mkState();
s.d2.res.axis = 1e3;
const pMax = GR.axisPlan(s, 0, 'max');
ok('MAX упирается в Ξ, а не в max-уровень', pMax.count > 0 && pMax.count < 100,
  'уровней ' + pMax.count + ' за Ξ ' + pMax.cost);
ok('MAX-план не дороже Ξ', pMax.cost <= 1e3);

s = mkState();
s.d2.res.axis = 1e40;
GR.buyAxis(s, 0, 'max');
GR.buyAxis(s, 1, 'max');
ok('уровни осей независимы', s.d2.axes[0].lvl === 100 && s.d2.axes[1].lvl === 100);
ok('покупка увеличивает скорость оси', GR.axisRate(s, 0) > GR.axisRate(mkState(), 0) * 20,
  GR.axisRate(s, 0).toFixed(4));

/* ============================ 5. Boost ============================ */
section('5. buyBoost');
s = mkState();
near('цена Boost = 50', GR.boostCost(s), 50);
s.d2.res.axis = 1000;
ok('покупка Boost', GR.buyBoost(s) === 1 && s.d2.boost === 1);
near('Ξ списан на цену Boost', s.d2.res.axis, 950);
near('следующая цена = 50·4', GR.boostCost(s), 200);

s.d2.res.axis = 199;
ok('не хватает Ξ → Boost не куплен', GR.buyBoost(s) === 0 && s.d2.boost === 1);
ok('Ξ не изменился', s.d2.res.axis === 199);

s = mkState();
s.d2.res.axis = 1e20;
let bought = 0;
for (let i = 0; i < 100; i++) bought += GR.buyBoost(s);
ok('Boost упирается в max = 20', s.d2.boost === 20 && bought === 20, 'boost = ' + s.d2.boost);
const xiLeft = s.d2.res.axis;
ok('после max покупка не проходит', GR.buyBoost(s) === 0 && s.d2.res.axis === xiLeft);

s = mkState();
s.d2.upgrades.d2_boost = 2;
near('апгрейд d2_boost ур.2 → цена ×0.8^2', GR.boostCost(s), 50 * Math.pow(0.8, 2), 1e-12);

s = mkState();
s.d2.res.axis = 100;
s.d2.boost = 2;
near('цена Boost растёт как growth^boost', GR.boostCost(s), 50 * 16);
s = mkState();
s.d2.res.axis = 10;
ok('Boost не покупается в минус', GR.buyBoost(s) === 0 && s.d2.res.axis === 10 &&
  s.d2.boost === 0);

/* ============================ 6. Клампы 1e300 ============================ */
section('6. Мягкие клампы и отсутствие Infinity');
s = mkState();
s.d2.axes[1].amount = 1e300;
const hugeRate = GR.axisRate(s, 0);
ok('скорость при amount = 1e300 конечна', isFinite(hugeRate) && hugeRate > 0,
  hugeRate.toExponential(3));
GR.tick(s, 1e10);
ok('amount не превысил 1e300', s.d2.axes[0].amount === 1e300, String(s.d2.axes[0].amount));
ok('amount остался числом', isFinite(s.d2.axes[0].amount));

s = mkState();
s.d2.res.axis = 1e300;
s.d2.axes[1].amount = 1e300;
GR.tick(s, 1e10);
ok('Ξ клампится 1e300', s.d2.res.axis === 1e300, String(s.d2.res.axis));

s = mkState();
s.d2.axes.forEach((a) => { a.amount = 1e300; });
ok('M₂ при 8 осях по 1e300 конечен', isFinite(GR.M2(s)) && GR.M2(s) === 1e300,
  String(GR.M2(s)));
const incDeep = GR.tick(s, 1);
ok('тик при 1e300 по всем осям: D₂ конечен', isFinite(s.d2.D) && s.d2.D > 0,
  'D₂ = ' + s.d2.D.toFixed(3));
ok('тик при 1e300: прирост конечен', isFinite(incDeep));
ok('тик при 1e300: нет NaN/Infinity', badNumbers(s.d2, 'd2').length === 0,
  badNumbers(s.d2, 'd2').slice(0, 4).join(', '));

/* мусор в сейве не должен превращаться в NaN в расчётах
   (сам сейв чистит G.d2.ensure — этот модуль чужие поля не переписывает) */
s = mkState();
s.d2.axes[0].lvl = NaN;
s.d2.axes[0].amount = Infinity;
s.d2.res.axis = NaN;
s.d2.boost = undefined;
s.d2.D = undefined;
ok('битый lvl: скорость оси не NaN', isFinite(GR.axisRate(s, 0)), String(GR.axisRate(s, 0)));
GR.tick(s, 0.5);
ok('битые числа в сейве: тик не рождает NaN',
  isFinite(s.d2.D) && isFinite(s.d2.res.axis) && G.BN.isValid(s.d2.N) &&
  s.d2.axes.every((a) => isFinite(a.amount)),
  'D₂ ' + s.d2.D + ', Ξ ' + s.d2.res.axis);
ok('битое число в сейве: D1 не тронут', s.D === 5 && Math.abs(G.BN.log10(s.N) - 5) < 1e-15);

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks : 'ВСЁ ОК — ' + checks + ' проверок'));
process.exitCode = fails ? 1 : 0;
