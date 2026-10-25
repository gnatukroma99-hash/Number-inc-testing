/* tools/tests/celestial-trials.test.js — движок испытаний целестиалов (docs/CELESTIALS.md §4).
   Запуск:  node tools/tests/celestial-trials.test.js

   Грузит РЕАЛЬНЫЙ скрипт src/systems/celestial-trials.js в песочницу vm без DOM.
   Контент целестиалов, G.celestials и G.d2 подставлены заглушками: движок обязан
   работать по контракту §4 и не падать, если какого-то модуля нет.

   Проверяем:
     1) API: list/get/check/complete/progress;
     2) check по всем 8 испытаниям: условия, гейт D2, гейт Hall, уже завершённый;
     3) complete: не начисляет при невыполненном условии, начисляет ровно один сигил,
        повторный вызов — false без второго сигила, счётчик попыток;
     4) progress: {done,total,sigils} до и после завершения;
     5) без G.celestials / контента — безопасные 0/false, без исключений;
     6) нет DOM-обращений и нет NaN/Infinity в результатах. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- отчёт ---------- */
let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  \u2713 ' + name + (extra ? '  — ' + extra : ''));
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return !!cond;
}
function section(t) { console.log('\n' + t); }
const BAD = /NaN|Infinity/;

/* ---------- песочница с реальным модулем ---------- */
function load() {
  const sandbox = {
    window: {},
    console: console,
    Math: Math,
    JSON: JSON,
    Object: Object,
    Array: Array,
    Number: Number,
    String: String,
    isFinite: isFinite
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  const p = path.join(ROOT, 'src/systems/celestial-trials.js');
  if (!fs.existsSync(p)) throw new Error('нет файла src/systems/celestial-trials.js');
  new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }).runInContext(sandbox);
  const G = sandbox.window.G;
  if (!G || !G.celestialTrials) throw new Error('G.celestialTrials не загрузился');
  return { sandbox: sandbox, G: G };
}

const { sandbox, G } = load();
const T = G.celestialTrials;

/* ---------- заглушка данных: 8 целестиалов из §3 ---------- */
function axesMin(state, n) {
  const axes = state.d2.axes || [];
  for (let i = 0; i < axes.length; i++) if ((axes[i].lvl || 0) < n) return false;
  return axes.length === 8;
}
function sumLevels(map) {
  let s = 0;
  for (const k in map) if (Object.prototype.hasOwnProperty.call(map, k)) s += map[k] || 0;
  return s;
}

function content() {
  return {
    id: 'celestials',
    list: [
      {
        id: 'c_sun', name: 'Солнце', symbol: '\u2609',
        trial: { id: 't_first', name: 'Первый Схлоп', desc: 'Сделать первое Схлопывание',
          check: (s) => (s.d2.stats.collapses || 0) >= 1 },
        reward: { field: 'd2StartAdd', add: 10, text: 'старт D\u2082 +10' }
      },
      {
        id: 'c_mercury', name: 'Меркурий', symbol: '\u263f',
        trial: { id: 't_ess10', name: 'Десять капель', desc: 'Всего \u2310 \u2265 10',
          check: (s) => (s.d2.stats.totalEssence || 0) >= 10 },
        reward: { field: 'd2XiMult', mult: 1.1, text: '\u039e \u00d71.10' }
      },
      {
        id: 'c_venus', name: 'Венера', symbol: '\u2640',
        trial: { id: 't_axes5', name: 'Восемь по пять', desc: 'Все 8 осей ур. \u2265 5',
          check: (s) => axesMin(s, 5) },
        reward: { field: 'd2RateMult', mult: 1.1, text: 'скорость осей \u00d71.10' }
      },
      {
        id: 'c_mars', name: 'Марс', symbol: '\u2642',
        trial: { id: 't_coll3', name: 'Три Схлопа', desc: '3 Схлопывания',
          check: (s) => (s.d2.stats.collapses || 0) >= 3 },
        reward: { field: 'd2CollapseMult', mult: 1.15, text: '\u2310 \u00d71.15' }
      },
      {
        id: 'c_jupiter', name: 'Юпитер', symbol: '\u2643',
        trial: { id: 't_best250', name: 'Двести пятьдесят', desc: 'Рекорд bestD \u2265 250',
          check: (s) => (s.d2.stats.bestD || 0) >= 250 },
        reward: { field: 'd2StartAdd', add: 25, text: 'старт D\u2082 +25' }
      },
      {
        id: 'c_saturn', name: 'Сатурн', symbol: '\u2644',
        trial: { id: 't_links2', name: 'Две связи', desc: '2 купленные связи',
          check: (s) => sumLevels(s.d2.links) >= 2 },
        reward: { field: 'd2SpanMult', mult: 1.2, text: 'барьер \u00d71.20' }
      },
      {
        id: 'c_uranus', name: 'Уран', symbol: '\u2645',
        trial: { id: 't_upg3', name: 'Три апгрейда', desc: '3 апгрейда Схлопывания',
          check: (s) => sumLevels(s.d2.upgrades) >= 3 },
        reward: { field: 'd2RateMult', mult: 1.15, text: 'скорость осей \u00d71.15' }
      },
      {
        id: 'c_neptune', name: 'Нептун', symbol: '\u2646',
        trial: { id: 't_sigil4', name: 'Четыре сигила', desc: '4 сигила',
          check: (s) => (s.cel.sigils || 0) >= 4 },
        reward: { field: 'd2XiMult', mult: 1.25, text: '\u039e \u00d71.25' }
      }
    ]
  };
}

/* ---------- заглушки систем: celestials (state.cel) и d2 (гейт мира) ---------- */
function celestialsStub() {
  return {
    unlocked(state) { return !!(state && state.cel && state.cel.unlocked); },
    isDone(state, id) { return !!(state && state.cel && state.cel.completed && state.cel.completed[id]); },
    markDone(state, id) {
      const cel = state.cel;
      if (!cel || !cel.completed || cel.completed[id]) return false;
      cel.completed[id] = true;
      cel.sigils = (cel.sigils || 0) + 1;
      cel.stats.completions = (cel.stats.completions || 0) + 1;
      return true;
    },
    markCalls: 0
  };
}

/* Свежее состояние: D2 и Hall открыты, испытания не выполнены. */
function fresh(opts) {
  const o = opts || {};
  const axes = [];
  for (let i = 0; i < 8; i++) axes.push({ lvl: o.axisLvl || 0, amount: 0 });
  return {
    d2: {
      unlocked: o.d2 !== false,
      res: { axis: 0, essence: 0 },
      axes: axes,
      upgrades: {},
      links: {},
      stats: { bestD: 0, collapses: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 }
    },
    cel: {
      v: 1,
      unlocked: o.hall !== false,
      active: true,
      sigils: 0,
      completed: {},
      stats: { attempts: 0, completions: 0 },
      seen: []
    }
  };
}

const celStub = celestialsStub();
let d2Open = true;
G.content = { celestials: content() };
G.celestials = celStub;
G.d2 = { unlocked: () => d2Open };

/* ---------- 1. API и список ---------- */
section('1. API: list/get/check/complete/progress');
for (const k of ['list', 'get', 'check', 'complete', 'progress']) {
  check('G.celestialTrials.' + k + ' есть', typeof T[k] === 'function');
}
const list = T.list();
check('list() отдаёт 8 целестиалов (\u00a73)', list.length === 8, 'len=' + list.length);
check('get(\'c_sun\') находит Солнце', T.get('c_sun') && T.get('c_sun').name === 'Солнце');
check('get(\'нет такого\') = null', T.get('нет такого') === null);
check('get(undefined) = null', T.get(undefined) === null);

/* ---------- 2. check по всем 8 испытаниям ---------- */
section('2. check(): 8 испытаний, условия \u00a73');
const cases = [
  { id: 'c_sun', ok: (s) => { s.d2.stats.collapses = 1; } },
  { id: 'c_mercury', ok: (s) => { s.d2.stats.totalEssence = 10; } },
  { id: 'c_venus', ok: (s) => { for (const a of s.d2.axes) a.lvl = 5; } },
  { id: 'c_mars', ok: (s) => { s.d2.stats.collapses = 3; } },
  { id: 'c_jupiter', ok: (s) => { s.d2.stats.bestD = 250; } },
  { id: 'c_saturn', ok: (s) => { s.d2.links = { l_kx: 1, l_dt: 1 }; } },
  { id: 'c_uranus', ok: (s) => { s.d2.upgrades = { cu_a: 2, cu_b: 1 }; } },
  { id: 'c_neptune', ok: (s) => { s.cel.sigils = 4; } }
];
for (const c of cases) {
  const st = fresh();
  check(c.id + ': условие не выполнено → false', T.check(st, c.id) === false);
  c.ok(st);
  check(c.id + ': условие выполнено → true', T.check(st, c.id) === true);
}
check('условие возвращает именно boolean', typeof T.check(fresh(), 'c_sun') === 'boolean');

/* границы одной из проверок: чуть ниже порога — false */
const near = fresh();
near.d2.stats.bestD = 249.9;
check('c_jupiter на 249.9 → false', T.check(near, 'c_jupiter') === false);

/* ---------- 3. гейты: D2, Hall, уже завершённый ---------- */
section('3. Гейты: D2 открыт, Hall открыт, не завершён');
const gSat = fresh();
gSat.d2.stats.collapses = 1;
d2Open = false;
check('D2 закрыт → false даже при выполненном условии', T.check(gSat, 'c_sun') === false);
d2Open = true;
check('D2 открыт → true', T.check(gSat, 'c_sun') === true);

const gHall = fresh({ hall: false });
gHall.d2.stats.collapses = 1;
check('Hall закрыт → false', T.check(gHall, 'c_sun') === false);

const gDone = fresh();
gDone.d2.stats.collapses = 1;
gDone.cel.completed.c_sun = true;
check('уже завершён → false', T.check(gDone, 'c_sun') === false);

check('неизвестный id → false', T.check(fresh(), 'c_unknown') === false);
check('check(null, id) → false', T.check(null, 'c_sun') === false);

/* ---------- 4. complete: начисление один раз ---------- */
section('4. complete(): только по check, сигил один раз');
const c1 = fresh();
check('complete без условия → false', T.complete(c1, 'c_sun') === false);
check('после неудачной попытки не завершён', c1.cel.completed.c_sun === undefined && c1.cel.sigils === 0);
check('попытка учтена в stats.attempts', c1.cel.stats.attempts === 1, 'attempts=' + c1.cel.stats.attempts);

c1.d2.stats.collapses = 1;
check('complete по условию → true', T.complete(c1, 'c_sun') === true);
check('сигил начислен', c1.cel.sigils === 1, 'sigils=' + c1.cel.sigils);
check('целестиал в state.cel.completed', c1.cel.completed.c_sun === true);
check('stats.completions = 1', c1.cel.stats.completions === 1);

check('повторный complete → false', T.complete(c1, 'c_sun') === false);
check('повтор не начисляет второй сигил', c1.cel.sigils === 1, 'sigils=' + c1.cel.sigils);
check('повтор не пишет attempts (уже завершён)', c1.cel.stats.attempts === 2, 'attempts=' + c1.cel.stats.attempts);

check('complete(null, id) → false', T.complete(null, 'c_sun') === false);
check('complete с неизвестным id → false', T.complete(fresh(), 'c_unknown') === false);

/* каждый из 8 завершается своим условием ровно один раз */
const all = fresh();
for (const c of cases) c.ok(all);
/* у Нептуна условие «4 сигила» — его подготовка уже дала 4, дальше каждый завершённый +1 */
const sigBefore = all.cel.sigils;
let trues = 0;
for (const c of cases) if (T.complete(all, c.id) === true) trues += 1;
check('все 8 завершаются по своим условиям', trues === 8, 'ok=' + trues);
check('8 завершений дают ровно 8 сигилов', all.cel.sigils === sigBefore + 8,
  sigBefore + ' → ' + all.cel.sigils);
check('повторный проход по 8 → 0 завершений',
  cases.every((c) => T.complete(all, c.id) === false));

/* ---------- 5. progress ---------- */
section('5. progress(): {done,total,sigils}');
const p0 = fresh();
const pr0 = T.progress(p0);
check('пусто: done=0, total=8, sigils=0',
  pr0.done === 0 && pr0.total === 8 && pr0.sigils === 0, JSON.stringify(pr0));
const p1 = fresh();
p1.d2.stats.collapses = 1;
T.complete(p1, 'c_sun');
p1.d2.stats.totalEssence = 10;
T.complete(p1, 'c_mercury');
const pr1 = T.progress(p1);
check('два завершённых: done=2, total=8, sigils=2',
  pr1.done === 2 && pr1.total === 8 && pr1.sigils === 2, JSON.stringify(pr1));
check('progress(null) без исключения', JSON.stringify(T.progress(null)) === '{"done":0,"total":8,"sigils":0}',
  JSON.stringify(T.progress(null)));
check('в progress нет NaN/Infinity', !BAD.test(JSON.stringify(pr0) + JSON.stringify(pr1)));

/* ---------- 6. нет модулей/контента — безопасные значения ---------- */
section('6. Нет G.celestials / контента / G.d2 — 0 и false, не исключение');
const savedCel = G.celestials;
const savedContent = G.content;
const savedD2 = G.d2;
delete G.celestials;
check('без G.celestials: list() работает', T.list().length === 8);
check('без G.celestials: check → false', T.check(fresh(), 'c_sun') === false);
check('без G.celestials: complete → false', T.complete(fresh(), 'c_sun') === false);
check('без G.celestials: progress zeros',
  JSON.stringify(T.progress(fresh())) === '{"done":0,"total":8,"sigils":0}');
G.celestials = savedCel;

delete G.content;
check('без контента: list() = []', T.list().length === 0);
check('без контента: get → null', T.get('c_sun') === null);
check('без контента: check → false', T.check(fresh(), 'c_sun') === false);
check('без контента: complete → false', T.complete(fresh(), 'c_sun') === false);
check('без контента: progress {0,0,0}',
  JSON.stringify(T.progress(fresh())) === '{"done":0,"total":0,"sigils":0}');
G.content = { celestials: content() };

delete G.d2;
check('без G.d2: check → false', T.check(fresh(), 'c_sun') === false);
check('без G.d2: complete → false', T.complete(fresh(), 'c_sun') === false);
G.d2 = savedD2;

G.content = { celestials: { id: 'celestials' } }; /* контент без list */
check('контент без list: list() = []', T.list().length === 0);
check('контент без list: progress {0,0,0}', T.progress(fresh()).total === 0);
G.content = savedContent;

/* ---------- 7. без DOM ---------- */
section('7. Без DOM и без глобалов документа');
check('document в песочнице не определён', typeof sandbox.document === 'undefined');
check('после всех вызовов G.celestialTrials на месте', typeof G.celestialTrials.check === 'function');
const st = fresh();
st.d2.stats.collapses = 1;
T.complete(st, 'c_sun');
check('состояние после работы — конечные числа', !BAD.test(JSON.stringify(st)));

/* ---------- итог ---------- */
console.log('\n' + (fails ? '\u2717 ПРОВАЛОВ: ' + fails : '\u2713 ВСЁ ОК'));
process.exit(fails ? 1 : 0);
