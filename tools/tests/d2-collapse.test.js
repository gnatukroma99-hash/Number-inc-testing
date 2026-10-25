/* tools/tests/d2-collapse.test.js — Схлопывание D2 (systems/d2-collapse.js).
   Запуск: node tools/tests/d2-collapse.test.js

   Грузим НАСТОЯЩИЕ ядровые файлы (core/bignum.js, core/formula.js), а остальное —
   заглушки: G.content.d2, G.growth, G.d2, G.d2Links, G.bus принадлежат другим D2-модулям,
   которых в этой ветке ещё нет. Проверяем только контракт G.d2Collapse из ТЗ §6/§10.2:
   gain/can/perform/startD2/upgradeCost/buyUpgrade и неприкосновенность ⌬, апгрейдов,
   связей, статистики и всего D1. */
'use strict';
require('../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

const sandbox = { console: console, window: {} };
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of ['src/core/bignum.js', 'src/core/formula.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const G = sandbox.window.G;

/* ---------- заглушки D2-модулей ---------- */
G.content = {
  d2: {
    collapse: {
      minD: 100,
      gainFormula: 'max(1, floor(pow(max(0, D - 100) / 10, 0.8) * (1 + 0.1 * collapses)))',
      startFormula: '10 + 5 * essence + 20 * lvlLinkStart + 10 * lvlStart'
    },
    upgrades: [
      { id: 'd2_start', name: 'Стартовая ось', base: 1, growth: 2.0, max: 10, res: 'essence' },
      { id: 'd2_rate', name: 'Ускорение осей', base: 1, growth: 2.2, max: 8, res: 'essence' },
      { id: 'd2_collapse', name: 'Глубокий сброс', base: 3, growth: 2.6, max: 6, res: 'essence' }
    ],
    links: [
      { id: 'link_start', name: 'Мост старта', base: 2, growth: 2.0, max: 5, res: 'essence' },
      { id: 'link_collapse', name: 'Глубина связи', base: 4, growth: 2.5, max: 4, res: 'essence' }
    ]
  }
};

/* свипы дерева/апгрейдов: значения задаются сценарием */
let sweep = { collapseMult: 1, startAdd: 0 };
G.growth = {
  upgProduct(state, field) { return field === 'd2CollapseMult' ? sweep.collapseMult : 1; },
  upgSum(state, field) { return field === 'd2StartAdd' ? sweep.startAdd : 0; }
};

/* G.d2.resetD2 — по ТЗ §10.3: только D2-поля, ⌬/upgrades/links/stats остаются */
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

/* D1 → D2 стартовый бонус */
let d2StartBonus = 0;
G.d2Links = { d2StartBonus() { return d2StartBonus; } };

const events = [];
G.bus = { emit(name, data) { events.push({ name: name, data: data }); } };

/* ---------- сам модуль ---------- */
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/systems/d2-collapse.js'), 'utf8'), sandbox,
  { filename: 'src/systems/d2-collapse.js' });
const COL = G.d2Collapse;

if (!COL) { console.log('  \u2717 G.d2Collapse не создан'); process.exit(1); }

/* ---------- обвязка ---------- */
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
function finiteAll(state) {
  return G.BN.isValid(state.d2.N) && isFinite(G.BN.log10(state.d2.N)) &&
    isFinite(state.d2.D) && !isNaN(COL.gain(state)) &&
    isFinite(state.d2.res.axis) && isFinite(state.d2.res.essence) && isFinite(state.d2.boost);
}

/* «грязное» состояние H2: оси прокачаны, Ξ накоплен, Boost куплен */
function mkState(o) {
  o = o || {};
  sweep = { collapseMult: o.collapseMult || 1, startAdd: o.startAdd || 0 };
  d2StartBonus = o.d2StartBonus || 0;
  const axes = [];
  for (let i = 0; i < 8; i++) axes.push({ lvl: o.axisLvl || 0, amount: o.axisAmount || 0 });
  return {
    N: G.BN.fromLog10(432),
    D: 432,
    upg: { mult1: 3 },
    res: { cores: 5 },
    d2: {
      v: 1, unlocked: true, active: true,
      N: G.BN.fromLog10(o.d2D !== undefined ? o.d2D : 200),
      D: o.d2D !== undefined ? o.d2D : 200,
      disp: { from: 0, to: 1, t0: 0, dur: 1 },
      res: { axis: o.xi || 0, essence: o.essence || 0 },
      axes: axes,
      boost: o.boost || 0,
      upgrades: Object.assign({}, o.upgrades || {}),
      links: Object.assign({}, o.links || {}),
      stats: {
        bestD: o.bestD || 0,
        collapses: o.collapses || 0,
        totalEssence: o.totalEssence || 0,
        playtime: o.playtime || 0,
        lastCollapse: 0
      },
      lastSeen: 0
    }
  };
}

/* ---------- 1. gain / can ---------- */
console.log('\n1. gain / can');
const D10 = Math.pow(10, 0.8);          /* pow(max(0,200-100)/10, 0.8) = pow(10,0.8) */

let s = mkState({ d2D: 200 });
ok('D₂=200, collapses=0 → 6 ⌬', COL.gain(s) === Math.floor(D10), 'gain=' + COL.gain(s));
ok('can при D₂=200', COL.can(s) === true);

s = mkState({ d2D: 200, collapses: 5 });
ok('collapses=5 множит 1+0.1·5', COL.gain(s) === Math.floor(D10 * 1.5), 'gain=' + COL.gain(s));

s = mkState({ d2D: 99.5 });
ok('D₂<100 → can=false', COL.can(s) === false);
ok('D₂<100 → gain=0', COL.gain(s) === 0, 'gain=' + COL.gain(s));

s = mkState({ d2D: 100 });
ok('D₂=100 → can=true', COL.can(s) === true);
ok('D₂=100 → гарантированный gain=1', COL.gain(s) === 1, 'gain=' + COL.gain(s));

s = mkState({ d2D: 200, collapseMult: 2 });
ok('d2CollapseMult ×2', COL.gain(s) === Math.floor(D10 * 2), 'gain=' + COL.gain(s));

s = mkState({ d2D: 200, links: { link_collapse: 2 } });
/* в данных gainFormula уже стоит floor → множитель применяется поверх целого base */
ok('link_collapse ур.2 → ×1.2²', COL.gain(s) === Math.floor(Math.floor(D10) * Math.pow(1.2, 2)),
  'gain=' + COL.gain(s));

s = mkState({ d2D: 200, collapseMult: 2, links: { link_collapse: 1 } });
ok('множители перемножаются', COL.gain(s) === Math.floor(Math.floor(D10) * 2 * 1.2),
  'gain=' + COL.gain(s));

s = mkState({ d2D: 200 });
s.d2.D = NaN;                            /* кэш сломан — берём log10(N₂) */
ok('D₂ из N₂, если кэш D не число', Math.abs(COL.gain(s) - Math.floor(D10)) <= 0, 'gain=' + COL.gain(s));

s = mkState({ d2D: 200 });
s.d2.links = { link_collapse: NaN };     /* мусор в сейве не даёт NaN */
ok('мусорный уровень связи → ×1', COL.gain(s) === Math.floor(D10), 'gain=' + COL.gain(s));

/* ---------- 2. perform ---------- */
console.log('\n2. perform: сброс D2, сохранение ⌬/апгрейдов/связей и D1');
const before = mkState({
  d2D: 200, collapses: 3, essence: 10, totalEssence: 10, bestD: 150,
  xi: 42, axisLvl: 5, axisAmount: 3, boost: 7,
  upgrades: { d2_start: 2, d2_rate: 1 },
  links: { link_start: 1, link_collapse: 1 },
  playtime: 1234, startAdd: 3, d2StartBonus: 1
});
const d1D = before.D;
const d1N = G.BN.log10(before.N);
const gain = COL.perform(before);

okNear('gain = floor(base·1.3·collapseMult)', gain, Math.floor(Math.floor(D10) * 1.3 * 1.2), 0,
  'gain=' + gain);
ok('⌬ = 10 + gain', before.d2.res.essence === 10 + gain, '⌬=' + before.d2.res.essence);
ok('totalEssence учтён', before.d2.stats.totalEssence === 10 + gain,
  'total=' + before.d2.stats.totalEssence);
ok('collapses 3 → 4', before.d2.stats.collapses === 4, 'collapses=' + before.d2.stats.collapses);
ok('bestD = max(150, 200)', before.d2.stats.bestD === 200, 'bestD=' + before.d2.stats.bestD);
ok('lastCollapse = playtime', before.d2.stats.lastCollapse === 1234,
  'lastCollapse=' + before.d2.stats.lastCollapse);

ok('оси сброшены (lvl/amount)', before.d2.axes.every((a) => a.lvl === 0 && a.amount === 0));
ok('Ξ сброшен', before.d2.res.axis === 0, 'Ξ=' + before.d2.res.axis);
ok('Boost сброшен', before.d2.boost === 0, 'boost=' + before.d2.boost);
ok('disp сброшен', before.d2.disp === null);
ok('апгрейды сохранены', before.d2.upgrades.d2_start === 2 && before.d2.upgrades.d2_rate === 1);
ok('связи сохранены', before.d2.links.link_start === 1 && before.d2.links.link_collapse === 1);

const expectStart = 10 + 5 * (10 + gain) + 20 * 1 + 10 * 2 + 3 + 1;
okNear('старт D₂ по формуле', before.d2.D, expectStart, 1e-9, 'D₂=' + before.d2.D);
okNear('N₂ = 10^D₂', G.BN.log10(before.d2.N), expectStart, 1e-9);

ok('D1 D не тронут', before.D === d1D, 'D1=' + before.D);
ok('D1 N не тронут', G.BN.log10(before.N) === d1N);
ok('D1 апгрейды не тронуты', before.upg.mult1 === 3);
ok('D1 ресурсы не тронуты', before.res.cores === 5);
ok('все числа конечны после perform', finiteAll(before));
ok('событие d2:collapse отправлено',
  events.some((e) => e.name === 'd2:collapse' && e.data.gain === gain));

const early = mkState({ d2D: 50 });
ok('perform при D₂<100 → 0 и без начисления', COL.perform(early) === 0 && early.d2.res.essence === 0);

/* ---------- 3. startD2 ---------- */
console.log('\n3. startD2');
s = mkState({ d2D: 200, essence: 4, upgrades: { d2_start: 3 }, links: { link_start: 2 } });
okNear('10 + 5·4 + 20·2 + 10·3', COL.startD2(s), 10 + 20 + 40 + 30, 1e-9, 'D₂=' + s.d2.D);
okNear('N₂ согласован с D₂', G.BN.log10(s.d2.N), 100, 1e-9);

s = mkState({ d2D: 200, essence: 1e9 });
ok('старт не выше 300 цифр', COL.startD2(s) === 300 && G.BN.log10(s.d2.N) === 300,
  'D₂=' + s.d2.D + ', log10N₂=' + G.BN.log10(s.d2.N));

s = mkState({ d2D: 200, essence: 2, startAdd: 7, d2StartBonus: 4 });
okNear('узлы дерева + бонус D1→D2', COL.startD2(s), 10 + 10 + 7 + 4, 1e-9, 'D₂=' + s.d2.D);

const savedLinks = G.d2Links;
delete G.d2Links;
s = mkState({ d2D: 200, essence: 2 });
okNear('нет G.d2Links — старт без бонуса', COL.startD2(s), 20, 1e-9, 'D₂=' + s.d2.D);
G.d2Links = savedLinks;

/* ---------- 4. upgradeCost / buyUpgrade ---------- */
console.log('\n4. upgradeCost / buyUpgrade');
s = mkState({ essence: 100 });
okNear('d2_start ур.0 → 1 ⌬', COL.upgradeCost(s, 'd2_start'), 1, 0);
s.d2.upgrades.d2_start = 2;
okNear('d2_start ур.2 → 4 ⌬', COL.upgradeCost(s, 'd2_start'), 4, 0);
s.d2.upgrades.d2_collapse = 1;
okNear('d2_collapse ур.1 → 3·2.6', COL.upgradeCost(s, 'd2_collapse'), 3 * 2.6, 1e-9);
s.d2.upgrades.d2_start = 10;
ok('куплен максимум → Number.MAX_VALUE', COL.upgradeCost(s, 'd2_start') === Number.MAX_VALUE);
ok('неизвестный id → Number.MAX_VALUE', COL.upgradeCost(s, 'nope') === Number.MAX_VALUE);

events.length = 0;
s = mkState({ essence: 10 });
ok('покупка d2_start', COL.buyUpgrade(s, 'd2_start') === 1 && s.d2.upgrades.d2_start === 1);
okNear('⌬ списана', s.d2.res.essence, 9, 1e-9);
ok('покупка второго уровня', COL.buyUpgrade(s, 'd2_start') === 1 && s.d2.upgrades.d2_start === 2);
okNear('⌬ после второй покупки', s.d2.res.essence, 7, 1e-9);
ok('событие d2:upgrade', events.length === 2 && events[0].name === 'd2:upgrade');

s = mkState({ essence: 0 });
ok('не хватает ⌬ → 0', COL.buyUpgrade(s, 'd2_start') === 0);
ok('уровень не вырос', s.d2.upgrades.d2_start === undefined && s.d2.res.essence === 0);

s = mkState({ essence: 1000, upgrades: { d2_start: 10 } });
ok('максимум → 0 без списания', COL.buyUpgrade(s, 'd2_start') === 0 && s.d2.res.essence === 1000);
ok('неизвестный id → 0', COL.buyUpgrade(s, 'nope') === 0);

/* ---------- 5. NaN/Infinity ---------- */
console.log('\n5. никаких NaN/Infinity');
s = mkState({ d2D: 1e6, essence: 1e12, collapses: 1e9, collapseMult: 1e12 });
const hugeGain = COL.gain(s);
ok('огромные числа → конечный gain', isFinite(hugeGain) && hugeGain > 0, 'gain=' + hugeGain);
COL.perform(s);
ok('perform на огромном состоянии конечен', finiteAll(s));
ok('⌬ конечна', isFinite(s.d2.res.essence), '⌬=' + s.d2.res.essence);

s = mkState({ d2D: 200, essence: NaN });
ok('⌬ = NaN в сейве → 0', COL.gain(s) === Math.floor(D10), 'gain=' + COL.gain(s));
ok('старт от NaN-⌬ конечен', isFinite(COL.startD2(s)), 'D₂=' + s.d2.D);

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks : 'ВСЁ ОК — ' + checks + ' проверок'));
process.exitCode = fails ? 1 : 0;
