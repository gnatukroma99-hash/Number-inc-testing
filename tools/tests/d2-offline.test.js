/* tools/tests/d2-offline.test.js — оффлайн D2 (docs/CELESTIALS.md §7, src/systems/d2-offline.js).
   Запуск:  node tools/tests/d2-offline.test.js

   Без DOM: в vm-песочницу грузятся настоящие src/core/bignum.js, src/core/formula.js,
   src/systems/d2-growth.js и src/systems/d2-offline.js. Данные осей и state.d2 —
   подставные (модуль обязан работать от контракта ТЗ, а не от чужих файлов).

   Что проверяем:
     • гейт: null без открытого D2, при < 30 с, без state.d2, без G.d2Growth;
     • политику §7 точной заглушкой tick: шаги по 60 с, dt = 30 (50 %), потолок 8 ч;
     • реальный d2-growth: прирост D₂/Ξ, совпадение с эталонным циклом §7;
     • D1 (state.N / state.D / state.res / state.upg) не меняется;
     • state.d2.stats.playtime не прыгает дважды;
     • покупок нет (оси/Boost/⌬ стоят), нет NaN/Infinity. */
'use strict';
require('../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const HOUR = 3600;

let checks = 0;
let fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return cond;
}
function near(name, actual, expected, tol) {
  const lim = tol === undefined ? 1e-9 : tol;
  return ok(name, isFinite(actual) && Math.abs(actual - expected) <= lim,
    'получено ' + actual + ', ожидалось ' + expected);
}
function section(t) { console.log('\n' + t); }

/* ---------- загрузка модулей ---------- */
const FILES = [
  'src/core/bignum.js',
  'src/core/formula.js',
  'src/systems/d2-growth.js',
  'src/systems/d2-offline.js'
];

function load() {
  const sandbox = { console: console, Math: Math, Object: Object, isFinite: isFinite, isNaN: isNaN };
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
if (!G.d2Offline) throw new Error('G.d2Offline не загрузился');
if (!G.d2Growth) throw new Error('G.d2Growth не загрузился');
const OFF = G.d2Offline;
const GR = G.d2Growth;

/* ---------- данные осей (§5.2) и заглушка гейта G.d2 ---------- */
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
  upgrades: [],
  links: []
};

/* Гейт — чужой модуль (systems/d2.js); здесь важна только связка «открыт / закрыт». */
G.d2 = {
  unlocked(state) { return !!(state && state.d2 && state.d2.unlocked); }
};

/* ---------- состояние: D1 + D2 (§5.1) ---------- */
function mkState(opts) {
  const o = opts || {};
  const axes = [];
  for (let i = 0; i < AXES.length; i++) axes.push({ lvl: 0, amount: 0 });
  return {
    N: G.BN.fromLog10(123.5),        /* D1 — не должен меняться */
    D: 123.5,
    res: { energy: 7, turns: 42 },   /* D1 — не должен меняться */
    upg: { mult1: 3 },               /* дерево D1 — не должно меняться */
    d2: {
      v: 1,
      unlocked: o.locked ? false : true,
      active: true,
      N: G.BN.fromLog10(o.D === undefined ? 0 : o.D),
      D: o.D === undefined ? 0 : o.D,
      disp: null,
      res: { axis: o.xi === undefined ? 0 : o.xi, essence: 0 },
      axes: axes,
      boost: 0,
      upgrades: {},
      links: {},
      stats: { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 },
      lastSeen: 0
    }
  };
}

function badNumbers(obj, prefix) {
  const out = [];
  for (const k in obj) {
    if (k === 'N') continue;                       /* BigNum {m,e} — проверяется отдельно */
    const v = obj[k];
    const p = prefix ? prefix + '.' + k : k;
    if (typeof v === 'number' && !isFinite(v)) out.push(p + '=' + v);
    else if (v && typeof v === 'object') out.push(...badNumbers(v, p));
  }
  return out;
}

/* Эталон политики §7 на настоящем d2-growth: шаги по 60 с, dt = step · 0.5. */
function refSim(state, seconds) {
  let left = seconds;
  while (left > 0) {
    const step = left < 60 ? left : 60;
    GR.tick(state, step * 0.5);
    left -= step;
  }
}

/* ==================== 1. Гейт: когда отчёта нет ==================== */
section('1. Гейт §7: null без D2 / при < 30 с / без модулей');
{
  const s = mkState({ locked: true });
  ok('D2 закрыт → null', OFF.apply(s, HOUR) === null);
  ok('D2 закрыт → D₂ не менялся', s.d2.D === 0, 'D₂ = ' + s.d2.D);
  ok('D2 закрыт → playtime 0', s.d2.stats.playtime === 0);
}
{
  const s = mkState();
  ok('29 с → null', OFF.apply(s, 29) === null);
  ok('29 с → D₂ не менялся', s.d2.D === 0);
  ok('seconds = NaN → null', OFF.apply(s, NaN) === null);
  ok('seconds = -100 → null', OFF.apply(s, -100) === null);
  ok('без state → null', OFF.apply(null, HOUR) === null);
  ok('без state.d2 → null', OFF.apply({ N: 1, D: 0 }, HOUR) === null);
}
{
  const s = mkState();
  const growth = G.d2Growth;
  G.d2Growth = undefined;
  ok('без G.d2Growth → null', OFF.apply(s, HOUR) === null);
  G.d2Growth = growth;
  ok('модуль роста вернулся → отчёт есть', OFF.apply(mkState(), HOUR) !== null);
}

/* ==================== 2. Точная политика: 60 с и 50 % ==================== */
section('2. Шаги 60 с · эффективность 50 % · потолок 8 ч (заглушка tick)');
{
  const calls = [];
  const growth = G.d2Growth;
  G.d2Growth = {
    tick(state, dt) {
      calls.push(dt);
      state.d2.D += dt * 0.001;               /* линейный «рост», чтобы проверить арифметику */
      state.d2.res.axis += dt;
      state.d2.stats.playtime += dt;
      return dt * 0.001;
    }
  };

  const s = mkState();
  const r = OFF.apply(s, HOUR);
  ok('1 ч → 60 вызовов tick', calls.length === 60, 'вызовов: ' + calls.length);
  ok('каждый шаг = 30 с (60 с · 50 %)', calls.every((dt) => dt === 30),
    'dt: ' + calls[0] + '…' + calls[calls.length - 1]);
  ok('report.seconds = 3600', r && r.seconds === HOUR, 'seconds = ' + (r && r.seconds));
  near('gainedD2 = 3600 · 0.001 · 0.5', r.gainedD2, 1.8);
  near('xi = 3600 · 0.5', r.xi, 1800);
  near('playtime растёт как dt (не дважды)', s.d2.stats.playtime, 1800);

  calls.length = 0;
  const s48 = mkState();
  const r48 = OFF.apply(s48, 48 * HOUR);
  ok('48 ч → потолок 8 ч в отчёте', r48.seconds === 8 * HOUR, 'seconds = ' + r48.seconds);
  ok('48 ч → 480 шагов по 60 с', calls.length === 480, 'вызовов: ' + calls.length);
  const sumDt = calls.reduce((a, b) => a + b, 0);
  near('сумма dt = 8 ч · 50 %', sumDt, 8 * HOUR * 0.5);
  near('48 ч → xi = 8 ч · 50 %', r48.xi, 8 * HOUR * 0.5);

  calls.length = 0;
  const s31 = mkState();
  const r31 = OFF.apply(s31, 31);
  ok('31 с → один шаг (остаток 31 с)', calls.length === 1 && calls[0] === 15.5,
    'dt = ' + calls[0]);
  ok('31 с → gainedD2 > 0', r31.gainedD2 > 0, 'gainedD2 = ' + r31.gainedD2);

  G.d2Growth = growth;
}

/* ==================== 3. Настоящий d2-growth: D₂ и Ξ ==================== */
section('3. Реальный G.d2Growth: D₂/Ξ растут, как эталонный цикл §7');
{
  const s = mkState({ D: 0 });
  const d1N = G.BN.log10(s.N);
  const d1D = s.D;
  const d1Energy = s.res.energy;
  const d1Turns = s.res.turns;
  const d1Upg = s.upg.mult1;
  const r = OFF.apply(s, HOUR);

  ok('отчёт не null', !!r);
  ok('D₂ вырос', s.d2.D > 0 && r.gainedD2 > 0, 'D₂ = ' + s.d2.D.toFixed(6));
  ok('Ξ вырос', s.d2.res.axis > 0 && r.xi > 0, 'Ξ = ' + s.d2.res.axis.toFixed(3));
  near('gainedD2 = D₂(после) − D₂(до)', r.gainedD2, s.d2.D - 0);
  near('xi = Ξ(после) − Ξ(до)', r.xi, s.d2.res.axis - 0);
  ok('state.d2.N — валидный BigNum', G.BN.isValid(s.d2.N));

  const ref = mkState({ D: 0 });
  refSim(ref, HOUR);
  near('D₂ совпадает с эталонным циклом', s.d2.D, ref.d2.D);
  near('Ξ совпадает с эталонным циклом', s.d2.res.axis, ref.d2.res.axis);
  near('playtime = 50 % перерыва (не дважды)', s.d2.stats.playtime, HOUR * 0.5);

  ok('D1: state.N не тронут', G.BN.log10(s.N) === d1N);
  ok('D1: state.D не тронут', s.D === d1D);
  ok('D1: state.res.energy не тронут', s.res.energy === d1Energy);
  ok('D1: state.res.turns не тронут', s.res.turns === d1Turns);
  ok('D1: дерево state.upg не тронуто', s.upg.mult1 === d1Upg);
  ok('в state.d2 нет NaN/Infinity', badNumbers(s.d2, 'd2').length === 0,
    badNumbers(s.d2, 'd2').join(', '));
  ok('отчёт конечный', isFinite(r.seconds) && isFinite(r.gainedD2) && isFinite(r.xi),
    'seconds = ' + r.seconds + ', gainedD2 = ' + r.gainedD2 + ', xi = ' + r.xi);
}
{
  /* оффлайн медленнее «полного» темпа: 50 % видно и на настоящем росте */
  const half = mkState({ D: 10 });
  OFF.apply(half, HOUR);
  const full = mkState({ D: 10 });
  for (let i = 0; i < 60; i++) GR.tick(full, 60);
  ok('полный темп даёт больше, чем оффлайн', full.d2.D > half.d2.D,
    'оффлайн ' + half.d2.D.toFixed(4) + ' < полный ' + full.d2.D.toFixed(4));
  ok('оффлайн не «отстаёт вдвое сильнее»', half.d2.D > 0.4 * full.d2.D,
    'оффлайн ' + half.d2.D.toFixed(4) + ' при полном ' + full.d2.D.toFixed(4));
}

/* ==================== 4. Покупок нет ==================== */
section('4. Покупок нет: Ξ богат, но оси/Boost/⌬ стоят');
{
  const s = mkState({ D: 20, xi: 1e6 });
  const essence = s.d2.res.essence;
  const r = OFF.apply(s, HOUR);
  ok('уровни осей не куплены', s.d2.axes.every((a) => a.lvl === 0),
    'lvls: ' + s.d2.axes.map((a) => a.lvl).join(','));
  ok('Boost не куплен', s.d2.boost === 0, 'boost = ' + s.d2.boost);
  ok('апгрейды/связи не куплены', Object.keys(s.d2.upgrades).length === 0 &&
    Object.keys(s.d2.links).length === 0);
  ok('⌬ не тронута', s.d2.res.essence === essence, '⌬ = ' + s.d2.res.essence);
  ok('Ξ только вырос (трат не было)', s.d2.res.axis > 1e6, 'Ξ = ' + s.d2.res.axis.toFixed(1));
  near('xi = прирост Ξ', r.xi, s.d2.res.axis - 1e6, 1e-6);
}

/* ==================== 5. Битые числа не рождаются ==================== */
section('5. Экстремумы: 1e300 по осям и D₂ = 1e5 → без NaN/Infinity');
{
  const s = mkState({ D: 1e5 });
  for (let i = 0; i < s.d2.axes.length; i++) s.d2.axes[i].amount = 1e300;
  const r = OFF.apply(s, 48 * HOUR);
  ok('отчёт конечный', !!r && isFinite(r.gainedD2) && isFinite(r.xi) && isFinite(r.seconds),
    r ? 'gainedD2 = ' + r.gainedD2 + ', xi = ' + r.xi : 'null');
  ok('D₂ конечный', isFinite(s.d2.D), 'D₂ = ' + s.d2.D.toExponential(3));
  ok('Ξ конечный и ограничен', isFinite(s.d2.res.axis) && s.d2.res.axis <= 1e300,
    'Ξ = ' + s.d2.res.axis.toExponential(3));
  ok('amount осей не переполнены', s.d2.axes.every((a) => isFinite(a.amount) && a.amount <= 1e300));
  ok('playtime конечен', isFinite(s.d2.stats.playtime));
  ok('в state.d2 нет NaN/Infinity', badNumbers(s.d2, 'd2').length === 0,
    badNumbers(s.d2, 'd2').join(', '));
}

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks : 'ВСЁ ОК — ' + checks + ' проверок'));
process.exitCode = fails ? 1 : 0;
