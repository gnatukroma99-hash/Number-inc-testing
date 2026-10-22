/* tools/bench.js — прогон РЕАЛЬНОГО кода src/ без DOM (Node).
   Запуск:  node tools/bench.js [сколько_прогонов] [макс_минут]
   Считает время до 1e308 на каждом прогоне, делает перерождения (P1)
   и показывает, как ядра ◆ ускоряют следующие забеги.
   Это «идеальный игрок»: покупает всё доступное каждые 50 мс. */
'use strict';
require('./_limit')(900);

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RUNS = Math.max(1, Number(process.argv[2] || 1));
const MAX_MIN = Number(process.argv[3] || 400);
const DT = 0.05;

/* Список скриптов берём из index.html — иначе bench грузит устаревший набор и,
   например, не видит новых механик (и условия достижений падают в ReferenceError).
   Не грузим только то, что требует реального DOM/браузера: main.js, ui/*, доски механик. */
function filesFromIndex() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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

const FILES = filesFromIndex();

const sandbox = {
  window: {},
  console,
  performance: { now: () => Date.now() },
  Math, Date, isFinite, Number, JSON
};
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
const G = sandbox.window.G;

const GROUPS = ['core', 'digitsum', 'primefit', 'primeranks', 'analysis', 'shop', 'tree', 'sieve', 'mirror'];

function buyAll(state) {
  for (const g of GROUPS) {
    for (const u of G.registry.upgradesOf(g)) {
      while (G.upgrades.buy(state, u)) { /* покупаем до упора */ }
    }
  }
}

function step(state, dt) {
  G.sampling.update(state, dt);
  G.growth.tick(state, dt);
  for (const m of G.registry.mechanics()) {
    if (m.isUnlocked && !m.isUnlocked(state)) continue;
    if (m.tick) m.tick(state, dt);
  }
  G.automation.update(state, dt);
  if (G.achievements) G.achievements.update(state, dt);
  buyAll(state);
}

const state = G.newState();
G.initResources(state);

let t = 0;
let run = 1;
let lastRunT = 0;
const rows = [];

console.log('прогон  время_до_1e308  ◆_после  ❖  M  D_макс');
console.log('----------------------------------------------------');

while (run <= RUNS && t < MAX_MIN * 60) {
  step(state, DT);
  t += DT;

  if (state.D >= 308) {
    const minutes = (t - lastRunT) / 60;
    const gained = G.prestige.gain(state);
    rows.push({ run, minutes, cores: state.res.cores || 0, prime: state.res.prime || 0 });
    console.log(
      String(run).padStart(5) + '  ' +
      minutes.toFixed(1).padStart(13) + '  ' +
      String(state.res.cores || 0).padStart(6) + '  ' +
      (state.res.prime || 0).toFixed(2).padStart(6) + '  ' +
      ('x' + G.growth.M(state).toExponential(1)).padEnd(10) + '  ' +
      state.D.toFixed(1)
    );
    if (run >= RUNS) break;
    G.prestige.perform(state);
    lastRunT = t;
    run++;
  }
}

if (!rows.length) {
  console.log('1e308 НЕ достигнут за ' + MAX_MIN + ' мин: D = ' + state.D.toFixed(2));
  process.exitCode = 1;
} else {
  const first = rows[0].minutes;
  console.log('----------------------------------------------------');
  console.log('Первый прогон: ' + first.toFixed(1) + ' мин ' +
    (first >= 60 ? 'OK (>= 60)' : 'ПРОБЛЕМА (< 60!)'));
  /* AGENTS §1.4.1: первый забег — не быстрее 60 минут. Раньше это видел
     только человек в выводе; теперь это ещё и код возврата — для CI. */
  if (first < 60) process.exitCode = 1;
  if (rows.length > 1) {
    console.log('Ускорение: ' + rows.slice(1).map((r) => '#' + r.run + ' ' + r.minutes.toFixed(1) + ' мин').join(' · '));
  }
}
