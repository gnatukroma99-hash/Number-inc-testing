/* tools/sim-d2.js — быстрый офлайн-симулятор «Измерения 2» без DOM.
   Запуск: node tools/sim-d2.js [минут] [dt]
   Что делает: грузит реальные системы D2 из index.html, открывает D2, крутит оси,
   покупает уровни/Boost простой жадной стратегией и печатает время до D₂=100,
   первое Схлопывание и динамику. Баланс D1 не трогает. */
'use strict';
require('./_limit')(300);

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MINUTES = Number(process.argv[2] || 60);
const DT = Number(process.argv[3] || 0.25);

function filesFromIndex() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].split('?')[0];
    if (src === 'src/main.js') continue;
    if (src.indexOf('src/ui/') === 0) continue;
    if (/^src\/mechanics\/[^/]+\/board\.js$/.test(src)) continue;
    out.push(src);
  }
  return out;
}

const sandbox = {
  window: {}, console, Math, Date, isFinite, Number, JSON,
  performance: { now: () => Date.now() }
};
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of filesFromIndex()) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const G = sandbox.window.G;

const state = G.newState();
G.initResources(state);
state.res.turns = 10;
state.N = G.BN.fromLog10(10000);
state.D = 10000;
G.d2.ensure(state);
if (!G.d2.unlocked(state)) {
  console.error('D2 не открылся — проверь гейт');
  process.exit(1);
}

let t = 0;
let first = null;
let collapses = 0;
let lastReport = -1;
const rows = [];

function buyGreedy() {
  for (let i = 0; i < state.d2.axes.length; i++) G.d2Growth.buyAxis(state, i, 'max');
  const bc = G.d2Growth.boostCost(state);
  if (isFinite(bc) && state.d2.res.axis > bc * 2) G.d2Growth.buyBoost(state);
}

console.log('D2: 8 осей, старт D₂=' + G.d2.D(state).toFixed(2));
console.log('мин   D₂      Ξ          M₂        оси(ур)  boost  ⌬');
console.log('---------------------------------------------------------------');

while (t < MINUTES * 60) {
  G.d2Growth.tick(state, DT);
  buyGreedy();
  t += DT;

  if (!first && G.d2.D(state) >= 100) {
    first = t / 60;
    const gain = G.d2Collapse.gain(state);
    rows.push({ kind: 'ready', t: t / 60, d: G.d2.D(state), xi: state.d2.res.axis, gain: gain });
    G.d2Collapse.perform(state);
    collapses++;
    rows.push({ kind: 'collapse', t: t / 60, d: state.d2.D, essence: state.d2.res.essence, collapses: collapses });
  }

  const min = Math.floor(t / 60);
  if (min !== lastReport && min % 5 === 0) {
    lastReport = min;
    const lv = state.d2.axes.map((a) => a.lvl).join('/');
    console.log(
      String(min).padStart(3) + '  ' +
      G.d2.D(state).toFixed(2).padStart(8) + '  ' +
      G.fmt.num(state.d2.res.axis).padStart(9) + '  ' +
      G.fmt.num(G.d2Growth.M2(state)).padStart(9) + '  ' +
      lv.padEnd(15) + '  ' +
      String(state.d2.boost).padStart(3) + '  ' +
      G.fmt.num(state.d2.res.essence).padStart(5)
    );
  }
  if (collapses >= 3) break;
}

console.log('---------------------------------------------------------------');
if (first === null) {
  console.log('D₂=100 НЕ достигнуто за ' + MINUTES + ' мин; D₂=' + G.d2.D(state).toFixed(2));
  process.exitCode = 1;
} else {
  console.log('D₂=100 впервые на ' + first.toFixed(1) + ' мин');
  console.log('Схлопываний: ' + collapses + ', ⌬=' + G.fmt.num(state.d2.res.essence));
  for (const r of rows) {
    if (r.kind === 'ready') console.log('  ready:    t=' + r.t.toFixed(1) + ' мин, D₂=' + r.d.toFixed(1) + ', ⌬=' + r.gain);
    else console.log('  collapse: t=' + r.t.toFixed(1) + ' мин, старт D₂=' + r.d.toFixed(1) + ', ⌬=' + r.essence);
  }
  const target = first >= 10 && first <= 20;
  console.log(target ? 'ОК: первое Схлопывание в целевом окне 10–20 мин' :
    'ВНИМАНИЕ: первое Схлопывание вне окна 10–20 мин (крутить данные)');
}
