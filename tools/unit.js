/* tools/unit.js — юнит-тесты ядра без DOM. Запуск: node tools/unit.js (npm run unit)
   Скрипты src/core/*.js грузятся в vm-контекст, у которого window ссылается на сам
   контекст: тесты видят тот же G, что и браузер, но без jsdom и игрового цикла.
   Тесты лежат в tools/tests/*.test.js; каждый — именованное утверждение.
   Провал печатается строкой ✗ и даёт код выхода 1 (чтобы CI/агент видел красное). */
'use strict';
require('./_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CORE_DIR = path.join(ROOT, 'src/core');
const TESTS_DIR = path.join(__dirname, 'tests');

/* ---------- загрузка ядра в песочницу ---------- */
function loadCore() {
  const sandbox = { console: console };
  sandbox.window = sandbox;                      // скрипты пишут window.G = window.G || {}
  const ctx = vm.createContext(sandbox);
  const loaded = [];
  const names = fs.readdirSync(CORE_DIR).filter((f) => f.endsWith('.js')).sort();
  for (const name of names) {
    const file = path.join(CORE_DIR, name);
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }).runInContext(ctx);
    loaded.push(name.replace(/\.js$/, ''));
  }
  return { G: sandbox.G, loaded: loaded };
}

/* ---------- крошечный раннер утверждений ---------- */
const stats = { total: 0, failed: 0 };
const sections = [];
let current = { name: '(без группы)', tests: 0, failed: 0 };

/* строковое представление значения, включая Infinity/NaN (JSON их теряет) */
function repr(v) {
  if (typeof v === 'number' && !isFinite(v)) return String(v);
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v, (k, x) => (typeof x === 'number' && !isFinite(x) ? String(x) : x));
  } catch (e) {
    return String(v);
  }
}

function same(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return (Number.isNaN(a) && Number.isNaN(b)) || a === b;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') return repr(a) === repr(b);
  return a === b;
}

function record(ok, label, detail) {
  stats.total++;
  current.tests++;
  if (ok) {
    console.log('  \u2713 ' + label);
    return;
  }
  stats.failed++;
  current.failed++;
  console.log('  \u2717 ' + label + (detail ? '  — ' + detail : ''));
}

const t = {
  section(name, fn) {
    current = { name: name, tests: 0, failed: 0 };
    sections.push(current);
    console.log('\n' + name);
    try {
      fn();
    } catch (e) {
      record(false, 'группа упала с исключением', (e && e.message) || String(e));
    }
  },

  /* a и b равны (объекты сравниваются по repr, числа — как числа) */
  eq(label, actual, expected) {
    record(same(actual, expected), label, 'получено ' + repr(actual) + ', ожидалось ' + repr(expected));
  },

  /* числа близки: |actual - expected| <= eps (по умолчанию 1e-9) */
  near(label, actual, expected, eps) {
    const tol = eps === undefined ? 1e-9 : eps;
    const ok = typeof actual === 'number' && Math.abs(actual - expected) <= tol;
    record(ok, label, 'получено ' + repr(actual) + ', ожидалось ' + repr(expected) + ' ± ' + tol);
  },

  ok(label, cond, detail) { record(!!cond, label, detail); },

  throws(label, fn) {
    let thrown = null;
    try { fn(); } catch (e) { thrown = e; }
    record(!!thrown, label, thrown ? '' : 'исключения не было');
  },

  /* выполнить без шума: formula пишет console.error на кривых строках */
  quiet(fn) {
    const orig = console.error;
    console.error = () => {};
    try {
      return fn();
    } finally {
      console.error = orig;
    }
  }
};

/* ---------- прогон ---------- */
const core = loadCore();
console.log('tools/unit.js — юнит-тесты ядра без DOM');
console.log('Ядро загружено (' + core.loaded.length + ' файлов): ' + core.loaded.join(', '));

/* В tools/tests/ лежат и standalone-сценарии других проверок (они сами грузят
   index.html и вызывают process.exit). Юнит-раннер подхватывает только те файлы,
   которые экспортируют функцию (t, G) — иначе require() чужого сценария запускает
   его целиком и ломает общий прогон. */
const testFiles = fs.readdirSync(TESTS_DIR).filter((f) => {
  if (!f.endsWith('.test.js')) return false;
  const src = fs.readFileSync(path.join(TESTS_DIR, f), 'utf8');
  return /module\.exports\s*=\s*function/.test(src);
}).sort();
if (!testFiles.length) {
  console.error('нет юнит-тестов: tools/tests/*.test.js с module.exports = function');
  process.exit(1);
}
for (const file of testFiles) {
  require(path.join(TESTS_DIR, file))(t, core.G);
}

console.log('');
for (const s of sections) {
  console.log('  ' + s.name + ': ' + (s.tests - s.failed) + '/' + s.tests);
}
console.log('ИТОГО: ' + stats.total + ' проверок в ' + sections.length + ' группах, провалов ' + stats.failed);
console.log(stats.failed ? 'ПРОВАЛЕНО: ' + stats.failed : 'ВСЁ ОК');
process.exitCode = stats.failed ? 1 : 0;
