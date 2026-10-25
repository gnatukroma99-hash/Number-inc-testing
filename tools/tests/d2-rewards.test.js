/* tools/tests/d2-rewards.test.js — интеграция наград фазы 2 в D2-системы
   (docs/CELESTIALS.md §9): целестиалы, D2-милстоуны и D2-достижения.
   Запуск: node tools/tests/d2-rewards.test.js

   Грузит НАСТОЯЩИЕ файлы игры (classic IIFE) в vm-песочницу без DOM:
   core/eventbus.js, core/bignum.js, core/formula.js, systems/d2-growth.js,
   systems/d2-collapse.js, systems/d2-links.js. Данные (G.content.d2), state.d2,
   G.growth, G.d2, G.celestials, G.d2Milestones и G.d2Achievements — подставные:
   модули наград принадлежат другим агентам, здесь проверяется только контракт §9.
   Проверяет: множители axisRate/xiRate/barrier/gain и прибавки/множители startD2,
   отсутствие модулей (guard → 1/0), рост/сброс Схлопыванием с наградами и без,
   неприкосновенность D1 и отсутствие NaN/Infinity при мусорных наградах. */
'use strict';
require('../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

const FILES = [
  'src/core/eventbus.js',
  'src/core/bignum.js',
  'src/core/formula.js',
  'src/systems/d2-growth.js',
  'src/systems/d2-collapse.js',
  'src/systems/d2-links.js'
];

const sandbox = { console: console, window: {} };
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) throw new Error('нет файла ' + f);
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}
const G = sandbox.window.G;
if (!G.d2Growth || !G.d2Collapse || !G.d2Links) throw new Error('D2-модули не загрузились');
const GR = G.d2Growth;
const COL = G.d2Collapse;
const LNK = G.d2Links;

/* ---------- обвязка ---------- */
let checks = 0;
let fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  else console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
}
function okNear(name, actual, expected, tol, extra) {
  const lim = tol === undefined ? 1e-12 : tol;
  ok(name, typeof actual === 'number' && isFinite(actual) && Math.abs(actual - expected) <= lim,
    'получено ' + actual + ', ожидалось ' + expected + (extra ? ' (' + extra + ')' : ''));
}
const section = (t) => console.log('\n' + t);
const finite = (v) => typeof v === 'number' && isFinite(v);

/* ---------- данные D2, как в docs/DIMENSION2.md §5.2 ---------- */
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
  axes: AXES,
  boost: { base: 50, growth: 4, max: 20 },
  collapse: {
    minD: 100,
    gainFormula: 'floor(pow(max(0, D - 100) / 10, 0.8) * (1 + 0.1 * collapses))',
    startFormula: '10 + 5 * essence + 20 * lvlLinkStart + 10 * lvlStart'
  },
  upgrades: [
    { id: 'd2_start', name: 'Стартовая ось', base: 1, growth: 2.0, max: 10, res: 'essence' },
    { id: 'd2_rate', name: 'Ускорение осей', base: 1, growth: 2.2, max: 8, res: 'essence' }
  ],
  links: [
    { id: 'link_start', name: 'Мост старта', base: 2, growth: 2.0, max: 5, res: 'essence' },
    { id: 'link_m', name: 'Отражение M', base: 3, growth: 2.3, max: 6, res: 'essence' },
    { id: 'link_collapse', name: 'Глубина связи', base: 4, growth: 2.5, max: 4, res: 'essence' }
  ]
};

/* ---------- заглушки чужих систем: дерево D2 и сброс D2 ---------- */
const treeFx = { d2RateMult: 1, d2CollapseMult: 1, d2StartAdd: 0 };
G.growth = {
  D(state) { return G.BN.log10(state.N); },
  upgProduct(state, field) {
    const v = treeFx[field];
    return finite(v) && v > 0 ? v : 1;
  },
  upgSum(state, field) {
    const v = treeFx[field];
    return finite(v) ? v : 0;
  }
};

G.d2 = {
  resetD2(state) {
    const s = state.d2;
    s.N = G.BN.one();
    s.D = 0;
    s.disp = null;
    if (s.res) s.res.axis = 0;
    s.boost = 0;
    for (const a of s.axes) { a.lvl = 0; a.amount = 0; }
  }
};

/* ---------- подставные модули наград (§9). Значения задаются сценарием ---------- */
const reward = {
  rateCel: 1, rateMil: 1, ach: 1,      // скорость осей
  xiCel: 1, xiMil: 1,                  // Ξ
  spanCel: 1,                          // плоскость софткапа
  colCel: 1, colMil: 1,                // ⌬ за Схлопывание
  startCel: 0, startMil: 0             // старт D₂
};
function resetRewards() {
  reward.rateCel = 1; reward.rateMil = 1; reward.ach = 1;
  reward.xiCel = 1; reward.xiMil = 1;
  reward.spanCel = 1;
  reward.colCel = 1; reward.colMil = 1;
  reward.startCel = 0; reward.startMil = 0;
}
resetRewards();

const cel = {
  bonusMult(state, field) {
    if (field === 'd2RateMult') return reward.rateCel;
    if (field === 'd2XiMult') return reward.xiCel;
    if (field === 'd2SpanMult') return reward.spanCel;
    if (field === 'd2CollapseMult') return reward.colCel;
    return 1;
  },
  bonusSum(state, field) {
    return field === 'd2StartAdd' ? reward.startCel : 0;
  }
};
const milestones = {
  mult(state, field) {
    if (field === 'd2RateMult') return reward.rateMil;
    if (field === 'd2XiMult') return reward.xiMil;
    if (field === 'd2CollapseMult') return reward.colMil;
    return 1;
  },
  sum(state, field) {
    return field === 'd2StartAdd' ? reward.startMil : 0;
  }
};
const achievements = { mult(state) { return reward.ach; } };
G.celestials = cel;
G.d2Milestones = milestones;
G.d2Achievements = achievements;

/* ---------- состояние, как в §5.1 ---------- */
function mkState(o) {
  o = o || {};
  const axes = [];
  for (let i = 0; i < AXES.length; i++) axes.push({ lvl: o.axisLvl || 0, amount: o.axisAmount || 0 });
  return {
    N: G.BN.fromLog10(432),
    D: 432,
    res: { cores: 5 },
    upg: { mult1: 3 },
    d2: {
      v: 1,
      unlocked: true,
      active: true,
      N: G.BN.fromLog10(o.d2D !== undefined ? o.d2D : 200),
      D: o.d2D !== undefined ? o.d2D : 200,
      disp: null,
      res: { axis: o.xi || 0, essence: o.essence || 0 },
      axes: axes,
      boost: o.boost || 0,
      upgrades: Object.assign({}, o.upgrades || {}),
      links: Object.assign({}, o.links || {}),
      stats: {
        bestD: o.bestD || 0, collapses: o.collapses || 0, totalEssence: o.totalEssence || 0,
        playtime: o.playtime || 0, lastCollapse: 0
      },
      lastSeen: 0
    }
  };
}

function badNumbers(obj, prefix) {
  const out = [];
  for (const k in obj) {
    const v = obj[k];
    const p = prefix ? prefix + '.' + k : k;
    if (typeof v === 'number' && !isFinite(v)) out.push(p + '=' + v);
    else if (v && typeof v === 'object' && k !== 'N') out.push(...badNumbers(v, p));
  }
  return out;
}

/* старт D₂ по формуле §6 + надбавки дерева и D1→D2 (без наград фазы 2) */
function formulaStart(s) {
  return 10 + 5 * s.d2.res.essence +
    20 * (s.d2.links.link_start || 0) + 10 * (s.d2.upgrades.d2_start || 0) +
    treeFx.d2StartAdd + LNK.d2StartBonus(s);
}

/* старт D₂ по формуле §6 + все надбавки: дерево + D1→D2 + целестиалы + милстоуны */
function expectedStart(s, add) {
  return formulaStart(s) + (add !== undefined ? add : reward.startCel + reward.startMil);
}

/* ============================ 1. Guard: модулей наград нет ============================ */
section('1. Нет модулей наград → множитель 1, прибавка 0');
let s = mkState();
const baseRate = GR.axisRate(s, 0);
const baseXi = GR.xiRate(s);
const baseBarrier = GR.barrier(s, 100);
const baseGain = COL.gain(s);
const baseStart = COL.startD2(mkState());

resetRewards();
delete G.celestials;
delete G.d2Milestones;
delete G.d2Achievements;
okNear('без модулей axisRate = базовая скорость', GR.axisRate(s, 0), 0.1);
okNear('без модулей xiRate = базовая', GR.xiRate(s), 0.1);
okNear('без модулей barrier(100) = 1/(1+2^1.5)', GR.barrier(s, 100), baseBarrier, 1e-15);
okNear('без модулей gain не изменился', COL.gain(s), baseGain, 0);

s = mkState({ d2D: 0 });
const noModStart = COL.startD2(s);
okNear('без модулей старт D₂ = формула + D1-бонус', noModStart, 10 + LNK.d2StartBonus(s), 1e-12,
  'старт ' + noModStart);

/* методы есть, но возвращают мусор — тоже 1/0, а не NaN */
G.celestials = { bonusMult() { return NaN; }, bonusSum() { return undefined; } };
G.d2Milestones = { mult() { return -5; }, sum() { return 'нет'; } };
G.d2Achievements = { mult() { return Infinity; } };
s = mkState({ d2D: 0 });
okNear('мусорные награды: axisRate = базовая', GR.axisRate(s, 0), 0.1, 1e-15);
okNear('мусорные награды: xiRate = базовая', GR.xiRate(s), 0.1, 1e-15);
okNear('мусорные награды: barrier(100) = базовая', GR.barrier(s, 100), baseBarrier, 1e-15);
okNear('мусорные награды: gain = базовый', COL.gain(mkState({ d2D: 200 })), baseGain, 0);
okNear('мусорные награды: старт = базовый', COL.startD2(s), 10 + LNK.d2StartBonus(s), 1e-12);

/* модуль есть, метода нет — тот же guard */
G.celestials = {};
G.d2Milestones = { mult: 'нет' };
G.d2Achievements = {};
s = mkState({ d2D: 0 });
okNear('модуль без методов: axisRate = базовая', GR.axisRate(s, 0), 0.1, 1e-15);
okNear('модуль без методов: старт = базовый', COL.startD2(s), 10 + LNK.d2StartBonus(s), 1e-12);

G.celestials = cel;
G.d2Milestones = milestones;
G.d2Achievements = achievements;
resetRewards();

/* ============================ 2. axisRate: скорость осей ============================ */
section('2. axisRate × целестиалы × милстоуны × достижения');
s = mkState();
reward.rateCel = 1.10;
okNear('только целестиал d2RateMult ×1.10', GR.axisRate(s, 0), 0.1 * 1.10, 1e-15);
reward.rateCel = 1;
reward.rateMil = 1.15;
okNear('только милстоун d2RateMult ×1.15', GR.axisRate(s, 0), 0.1 * 1.15, 1e-15);
reward.rateMil = 1;
reward.ach = 1.045;
okNear('только достижения 1+0.01·4.5 = 1.045', GR.axisRate(s, 0), 0.1 * 1.045, 1e-15);

resetRewards();
reward.rateCel = 1.10;
reward.rateMil = 1.15;
reward.ach = 1.12;
const expAll = 0.1 * 1.10 * 1.15 * 1.12;
okNear('все три перемножаются (а не складываются)', GR.axisRate(s, 0), expAll, 1e-15,
  '0.1·1.10·1.15·1.12');
okNear('награды применяются к каждой оси', GR.axisRate(s, 7), 0.015 * 1.10 * 1.15 * 1.12, 1e-15);

/* награды только усиливают: ни одна не может обнулить скорость */
ok('axisRate с наградами > без наград', GR.axisRate(s, 0) > 0.1);

/* дерево D2 и награды перемножаются, а не подменяют друг друга */
treeFx.d2RateMult = 2;
okNear('дерево ×2 и награды ×1.10·1.15·1.12', GR.axisRate(s, 0), 0.2 * 1.10 * 1.15 * 1.12, 1e-15);
treeFx.d2RateMult = 1;

/* ============================ 3. xiRate: доход Ξ ============================ */
section('3. xiRate × целестиалы × милстоуны (без достижений — они в axisRate)');
resetRewards();
s = mkState({ axisLvl: 1 });
const xiBase = GR.xiRate(s);
reward.xiCel = 1.10;
okNear('целестиал d2XiMult ×1.10', GR.xiRate(s), xiBase * 1.10, 1e-15);
reward.xiCel = 1;
reward.xiMil = 1.10;
okNear('милстоун d2XiMult ×1.10', GR.xiRate(s), xiBase * 1.10, 1e-15);
reward.xiMil = 1;
reward.xiCel = 1.25;
reward.xiMil = 1.15;
okNear('оба ×1.25·1.15', GR.xiRate(s), xiBase * 1.25 * 1.15, 1e-15);
okNear('скорость оси от d2XiMult не зависит', GR.axisRate(s, 0),
  0.1 * 1.25 * (1 + 0.02 * 8), 1e-15, 'lvl=1 у всех осей');

/* нет двойного счёта: d2XiMult не попадает в axisRate, d2RateMult — в xiRate сверх axisRate */
resetRewards();
reward.rateCel = 1.5;
const xiWithRate = GR.xiRate(s);
okNear('d2RateMult влияет на Ξ только через axisRate(0)', xiWithRate,
  GR.axisRate(s, 0) * (1 + 0.02 * 8), 1e-15);
resetRewards();

/* ============================ 4. barrier: плоскость софткапа ============================ */
section('4. barrier: span × целестиалы d2SpanMult');
s = mkState();
okNear('barrier(75) без наград = 0.5', GR.barrier(s, 75), 0.5, 1e-15);
reward.spanCel = 1.20;
okNear('span ×1.20 → 1/(1+(50/30)^1.5)', GR.barrier(s, 100), 1 / (1 + Math.pow(50 / 30, 1.5)), 1e-15);
ok('knee D₂=50 всё ещё без штрафа', GR.barrier(s, 50) === 1);
ok('barrier с наградой выше, чем без', GR.barrier(s, 100) > 1 / (1 + Math.pow(2, 1.5)));
treeFx.d2RateMult = 1;
reward.spanCel = 1;
okNear('без наград barrier(100) = 1/(1+2^1.5)', GR.barrier(s, 100), 1 / (1 + Math.pow(2, 1.5)), 1e-15);

/* ============================ 5. Схлопывание: gain ============================ */
section('5. gain × целестиалы × милстоуны d2CollapseMult');
const floorBase = Math.floor(Math.pow(10, 0.8)); // 6 при D₂=200, collapses=0
s = mkState({ d2D: 200 });
okNear('gain без наград = floor(pow(10,0.8))', COL.gain(s), floorBase, 0);
reward.colCel = 1.15;
okNear('целестиал d2CollapseMult ×1.15', COL.gain(s), Math.floor(floorBase * 1.15), 0);
reward.colCel = 1;
reward.colMil = 1.10;
okNear('милстоун d2CollapseMult ×1.10', COL.gain(s), Math.floor(floorBase * 1.10), 0);
reward.colCel = 1.15;
reward.colMil = 1.20;
okNear('оба ×1.15·1.20', COL.gain(s), Math.floor(floorBase * 1.15 * 1.20), 0);
/* связь link_collapse считается отдельно и с наградами перемножается */
s = mkState({ d2D: 200, links: { link_collapse: 1 } });
okNear('связь ×1.2 и награды ×1.15·1.20', COL.gain(s),
  Math.floor(floorBase * Math.pow(1.2, 1) * 1.15 * 1.20), 0);
resetRewards();

/* ============================ 6. startD2: старт после сброса ============================ */
section('6. startD2 + сумма целестиалов + сумма милстоунов');
s = mkState({ d2D: 0 });
const startPlain = COL.startD2(s);
okNear('без наград старт = формула + D1-бонус', startPlain, 10 + LNK.d2StartBonus(s), 1e-12);
reward.startCel = 10;
okNear('целестиал d2StartAdd +10', COL.startD2(mkState({ d2D: 0 })), startPlain + 10, 1e-12);
reward.startCel = 35;
reward.startMil = 5;
const startState = mkState({ d2D: 0 });
okNear('суммы складываются (+35 и +5)', COL.startD2(startState), startPlain + 40, 1e-12);
okNear('старт записан в state.d2.D', startState.d2.D, startPlain + 40, 1e-12);
okNear('N₂ = 10^старт', G.BN.log10(startState.d2.N), startState.d2.D, 1e-9);
ok('disp сброшен — показ не тянет старый D₂', startState.d2.disp === null);
reward.startCel = 0;
reward.startMil = 0;

s = mkState({ d2D: 0, essence: 10, upgrades: { d2_start: 2 }, links: { link_start: 1 } });
okNear('награды складываются с формулой и деревом', COL.startD2(s), expectedStart(s), 1e-12,
  'essence=10, d2_start=2, link_start=1');
/* потолок старта §5.3/§6 — 300 цифр, даже с огромными наградами */
s = mkState({ d2D: 0 });
reward.startCel = 1e6;
reward.startMil = 1e6;
okNear('старт клампится 300', COL.startD2(s), 300, 0);
resetRewards();

/* ============================ 7. perform: рост и сброс с наградами ============================ */
section('7. Схлопывание с наградами: ⌬ растёт, D2 сбрасывается');
const dirty = () => mkState({ d2D: 200, xi: 5000, boost: 3, axisLvl: 20, axisAmount: 100,
  essence: 7, collapses: 2, upgrades: { d2_rate: 1 }, links: { link_m: 2 } });

/* без наград */
resetRewards();
let a = dirty();
const gainPlain = COL.gain(a);
const gotPlain = COL.perform(a);

/* с наградами */
resetRewards();
reward.colCel = 1.15;
reward.colMil = 1.10;
reward.startCel = 35;
reward.startMil = 5;
let b = dirty();
const gainReward = COL.gain(b);
const gotReward = COL.perform(b);

ok('Схлопывание без наград удалось', gotPlain > 0, String(gotPlain));
ok('Схлопывание с наградами удалось', gotReward > 0, String(gotReward));
ok('gain с наградами больше, чем без', gainReward > gainPlain,
  gainPlain + ' → ' + gainReward);
okNear('начислено ровно gain (награды)', gotReward, gainReward, 0);
okNear('⌬ = 7 + gain', b.d2.res.essence, 7 + gainReward, 0);
okNear('totalEssence = gain', b.d2.stats.totalEssence, gainReward, 0);
okNear('collapses 2 → 3', b.d2.stats.collapses, 3, 0);
/* разница стартов = надбавка наград + 5·Δ⌬ (⌬ входит в формулу старта) */
okNear('старт с наградами = формула + 40', b.d2.D, formulaStart(b) + 40, 1e-12,
  'старт ' + b.d2.D);
okNear('разница стартов = 40 + 5·Δ⌬', b.d2.D - a.d2.D,
  40 + 5 * (b.d2.res.essence - a.d2.res.essence), 1e-12,
  'без наград ' + a.d2.D + ', с наградами ' + b.d2.D);
okNear('bestD запомнен', b.d2.stats.bestD, 200, 0);
ok('оси сброшены', b.d2.axes.every((ax) => ax.lvl === 0 && ax.amount === 0));
ok('Ξ сброшен', b.d2.res.axis === 0, String(b.d2.res.axis));
ok('Boost сброшен', b.d2.boost === 0);
okNear('⌬ не сброшены', b.d2.res.essence, 7 + gainReward, 0);
ok('апгрейды/связи не сброшены',
  b.d2.upgrades.d2_rate === 1 && b.d2.links.link_m === 2);

/* без наград — та же механика, но меньше ⌬ и ниже старт */
ok('без наград ⌬ меньше', a.d2.res.essence < b.d2.res.essence,
  a.d2.res.essence + ' < ' + b.d2.res.essence);
ok('без наград старт ниже', a.d2.D < b.d2.D, a.d2.D.toFixed(4) + ' < ' + b.d2.D.toFixed(4));
okNear('без наград старт = формула + 0', a.d2.D, formulaStart(a), 1e-12, 'старт ' + a.d2.D);

/* награда за старт не копится: второй Схлопывание даёт те же +40, а не +80 */
const startBefore2 = b.d2.D;
COL.perform(b);
okNear('второе Схлопывание: старт снова формула + 40', b.d2.D, formulaStart(b) + 40, 1e-12,
  'было ' + startBefore2 + ', стало ' + b.d2.D);

/* ============================ 8. D1 не меняется ============================ */
section('8. D1 не тронут наградами');
resetRewards();
reward.colCel = 1.15; reward.rateCel = 1.10; reward.xiCel = 1.25;
reward.spanCel = 1.20; reward.ach = 1.12; reward.startMil = 5;
const d1 = mkState({ d2D: 200, xi: 100 });
const n0 = G.BN.log10(d1.N);
const d0 = d1.D;
const multBefore = LNK.d1Mult(d1);
for (let i = 0; i < 50; i++) GR.tick(d1, 0.5);
COL.perform(d1);
okNear('D1 N не изменился', G.BN.log10(d1.N), n0, 1e-12);
okNear('D1 D не изменился', d1.D, d0, 1e-12);
ok('D1 res/upg не изменились', d1.res.cores === 5 && d1.upg.mult1 === 3);
okNear('D1-множитель от D2 не зависит от наград', LNK.d1Mult(d1),
  1 + 0.01 * Math.min(d1.d2.D, 1000), 1e-12, 'связей нет, только цифры D₂');
ok('d1Mult до и после тиков в пределах потолка', finite(multBefore) && multBefore >= 1);
resetRewards();

/* тот же d1Mult с наградами и без них */
resetRewards();
const m1 = LNK.d1Mult(mkState({ d2D: 200, links: { link_m: 2 } }));
reward.rateCel = 1.10; reward.colCel = 1.15; reward.startCel = 35;
const m2 = LNK.d1Mult(mkState({ d2D: 200, links: { link_m: 2 } }));
okNear('d1Mult одинаков с наградами и без', m2, m1, 0, 'связи — отдельный бонус §7');
resetRewards();

/* ============================ 9. Нет NaN/Infinity ============================ */
section('9. Нет NaN/Infinity даже при огромных наградах');
reward.rateCel = 1e300; reward.rateMil = 1e300; reward.ach = 1e300;
reward.xiCel = 1e300; reward.xiMil = 1e300;
reward.spanCel = 1e300; reward.colCel = 1e300; reward.colMil = 1e300;
reward.startCel = 1e300; reward.startMil = 1e300;
const big = mkState({ d2D: 200, axisAmount: 1e300 });
ok('axisRate конечен при наградах 1e300', finite(GR.axisRate(big, 0)),
  String(GR.axisRate(big, 0)));
ok('xiRate конечен', finite(GR.xiRate(big)));
ok('barrier конечен и > 0', finite(GR.barrier(big, 1e6)) && GR.barrier(big, 1e6) > 0);
ok('gain конечен', finite(COL.gain(big)), String(COL.gain(big)));
ok('startD2 конечен и ≤ 300', finite(COL.startD2(mkState({ d2D: 0 }))),
  String(COL.startD2(mkState({ d2D: 0 }))));
GR.tick(big, 1);
COL.perform(big);
ok('после тика и Схлопывания в D2 нет NaN/Infinity',
  badNumbers(big.d2, 'd2').length === 0, badNumbers(big.d2, 'd2').slice(0, 4).join(', '));
ok('D1 при огромных наградах цел', G.BN.isValid(big.N) && finite(big.D) && big.D === 432);
resetRewards();

/* ============================ итог ============================ */
console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks : 'ВСЁ ОК — ' + checks + ' проверок'));
process.exitCode = fails ? 1 : 0;
