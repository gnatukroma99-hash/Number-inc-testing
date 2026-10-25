/* tools/tests/prestige-balance.test.js — ребалланс множителя ◆.
   Запуск:  node tools/tests/prestige-balance.test.js
   Грузит РЕАЛЬНЫЕ скрипты игры (core/formula.js, content/prestige.js, systems/prestige.js)
   в песочницу vm с window и проверяет G.prestige.mult на большом диапазоне ядер:
   0, 1, 10, 100, 1700, 10000, 1e6 — конечность, знак, монотонность, отсутствие клампа 1e300. */
'use strict';
require('./../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- отчёт ---------- */
let fails = 0;
function ok(name, extra) { console.log('  \u2713 ' + name + (extra ? '  — ' + extra : '')); }
function bad(name, extra) { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
function check(name, cond, extra) { (cond ? ok : bad)(name, extra); return cond; }
function section(t) { console.log('\n' + t); }

/* ---------- загрузка реальных скриптов ---------- */
const FILES = [
  'src/core/formula.js',
  'src/content/prestige.js',
  'src/systems/prestige.js'
];

function load() {
  const sandbox = { console: console, Math: Math, Map: Map, Object: Object, isFinite: isFinite };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('нет файла ' + f);
    new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }).runInContext(sandbox);
  }
  const G = sandbox.G;
  if (!G || !G.formula || !G.prestige || !G.content || !G.content.prestige) {
    throw new Error('G.formula / G.prestige / G.content.prestige не загрузились');
  }
  /* уровни апгрейдов в этих трёх файлах не участвуют (G.lvl живёт в state.js),
     поэтому подменяем его простым чтением state.upg — этого хватает для keepCores */
  G.lvl = function (st, id) { return (st.upg && st.upg[id]) || 0; };
  return G;
}

function mkState(cores, coresBest, upg) {
  return { res: { cores: cores }, meta: { coresBest: coresBest || 0 }, upg: upg || {} };
}

const CORES = [0, 1, 10, 100, 1700, 10000, 1e6];

function main(G) {
  /* ---------- 1. формула из данных ---------- */
  section('1. Формула в данных');
  const src = G.content.prestige.coreMultFormula;
  check('coreMultFormula есть', typeof src === 'string' && src.length > 0, String(src));
  check('в формуле нет ^ (это XOR в JS)', String(src).indexOf('^') < 0, String(src));
  const ref = Math.pow(1.5, Math.pow(1700, 0.4));
  const compiled = G.formula(src, { cores: 1700 });
  check('формула компилируется через G.formula', isFinite(compiled) && compiled > 0,
    'G.formula("' + src + '", {cores:1700}) = ' + compiled.toExponential(4));
  check('формула = pow(1.5, pow(cores, 0.4))',
    Math.abs(compiled - ref) / ref < 1e-12, 'эталон ' + ref.toExponential(4));

  /* ---------- 2. mult() по диапазону ядер ---------- */
  section('2. G.prestige.mult(◆)');
  const vals = CORES.map((c) => G.prestige.mult(mkState(c)));
  for (let i = 0; i < CORES.length; i++) {
    const v = vals[i];
    check('◆ ' + CORES[i] + ': конечен, > 0, не NaN', isFinite(v) && v > 0 && !Number.isNaN(v),
      '×' + v.toExponential(4));
  }
  check('◆ 0 → ровно 1', vals[0] === 1, '×' + vals[0]);
  check('монотонно не убывает', vals.every((v, i) => i === 0 || v >= vals[i - 1]),
    vals.map((v) => v.toExponential(3)).join(' ≤ '));
  check('строго растёт после 0', vals.slice(1).every((v, i) => v > vals[i]),
    'каждый следующий больше предыдущего');

  /* ---------- 3. предохранитель 1e300 ---------- */
  section('3. Предохранитель 1e300');
  const at1700 = vals[CORES.indexOf(1700)];
  const at1e6 = vals[CORES.indexOf(1e6)];
  check('◆ 1700: не клампится в 1e300', at1700 < 1e300, '×' + at1700.toExponential(4));
  check('◆ 1700: заметно больше единицы', at1700 > 1e3, '×' + at1700.toFixed(1));
  check('◆ 1e6: не клампится, конечен, не NaN',
    at1e6 < 1e300 && isFinite(at1e6), '×' + at1e6.toExponential(4));
  check('◆ 1e6 ≫ ◆ 1700', at1e6 > at1700 * 1e3, '×' + (at1e6 / at1700).toExponential(3) + ' раз');
  /* там, где формула переполняет double, остаётся предохранитель 1e300, а не 0/NaN */
  const guard = G.prestige.mult(mkState(1e9));
  check('переполнение double → предохранитель 1e300 (не 0 и не NaN)',
    guard === 1e300, '×' + guard);

  /* ---------- 4. fallback без данных ---------- */
  section('4. Fallback в systems/prestige.js');
  const saved = G.content.prestige.coreMultFormula;
  try {
    delete G.content.prestige.coreMultFormula;
    const probe = [1, 10, 1700, 1e6];
    const fb = probe.map((c) => G.prestige.mult(mkState(c)));
    check('fallback конечен и > 0', fb.every((v) => isFinite(v) && v > 0),
      fb.map((v) => v.toExponential(3)).join(', '));
    check('fallback = новая формула (а не 1.5^◆)',
      fb.every((v, i) => Math.abs(v - Math.pow(1.5, Math.pow(probe[i], 0.4))) / v < 1e-12),
      '◆ 1700 fallback ×' + fb[2].toExponential(4));
  } finally {
    G.content.prestige.coreMultFormula = saved;
  }

  /* ---------- 5. «Ядра не сгорают» считает по рекорду ---------- */
  section('5. keepCores учитывает рекорд');
  const keep = G.prestige.mult(mkState(5, 1700, { tree_corekeep: 1 }));
  const drop = G.prestige.mult(mkState(5, 1700, {}));
  check('с узлом ядра считаются по рекорду', keep > drop,
    '×' + keep.toFixed(1) + ' vs ×' + drop.toFixed(1));
  check('с узлом результат = множителю от 1700 ◆',
    Math.abs(keep - at1700) / keep < 1e-12, '×' + keep.toExponential(4));

  /* ---------- итог ---------- */
  console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
  process.exitCode = fails ? 1 : 0;
}

let G = null;
try {
  G = load();
} catch (e) {
  bad('загрузка реальных скриптов', e.message);
  console.log('\nПРОВАЛЕНО: ' + fails);
  process.exitCode = 1;
}
if (G) main(G);
