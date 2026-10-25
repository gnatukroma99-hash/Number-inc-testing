/* tools/tests/celestials-state.test.js — состояние Зала Целестиалов и сейв v4
   (docs/CELESTIALS.md §2, §10 «celestials-state»).
   Запуск:  node tools/tests/celestials-state.test.js

   Грузит РЕАЛЬНЫЕ скрипты src/ в песочницу vm без DOM: ядро (BN/реестр/формат/шина),
   systems/state.js, systems/d2.js, systems/celestials.js, systems/save.js.
   Контент и механик тут нет — G.content.celestials подставляется фейком по форме §3
   (list с reward.field/mult|add). G.turn (гейт D2) не нужен: D2-гейт здесь не проверяется.

   Проверяем:
     1) форму state.cel и SAVE_VERSION = 4;
     2) гейт Зала (1 Схлопывание), защёлку unlocked, active/setActive;
     3) markDone идемпотентен: sigils/stats.completions растут один раз;
     4) bonusMult/bonusSum читают только завершённые награды своего поля;
     5) ни D1-сброс (resetScopes), ни D2-сброс (resetD2) не трогают state.cel;
     6) roundtrip сейва v4 (снимок, а не ссылка), миграцию v3 → v4 без cel;
     7) ensure() чинит битый cel и идемпотентен. */
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

const BAD = /NaN|Infinity|undefined/;
const finiteAll = (obj) => !BAD.test(JSON.stringify(obj));

/* ---------- загрузка реальных скриптов ---------- */
const FILES = [
  'src/core/eventbus.js',
  'src/core/bignum.js',
  'src/core/format.js',
  'src/core/registry.js',
  'src/systems/state.js',
  'src/systems/d2.js',
  'src/systems/celestials.js',
  'src/systems/save.js'
];

function load() {
  const sandbox = {
    window: {},
    console: console,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Map: Map,
    Object: Object,
    Array: Array,
    Number: Number,
    String: String,
    isFinite: isFinite,
    isNaN: isNaN
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error('нет файла ' + f);
    new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }).runInContext(sandbox);
  }
  return sandbox;
}

const sandbox = load();
const G = sandbox.window.G;
if (!G || !G.BN || !G.d2 || !G.celestials || !G.save || typeof G.newState !== 'function') {
  throw new Error('G.BN / G.d2 / G.celestials / G.save / G.newState не загрузились');
}

/* Фейковый контент по форме §3: ровно один вид награды на целестиала. */
G.content = G.content || {};
G.content.celestials = {
  id: 'celestials',
  list: [
    { id: 'c_sun', name: 'Солнце', symbol: '☉',
      trial: { id: 't_first', check: (s) => (s.d2.stats.collapses || 0) >= 1 },
      reward: { field: 'd2StartAdd', add: 10, text: 'старт D₂ +10' } },
    { id: 'c_mercury', name: 'Меркурий', symbol: '☿',
      trial: { id: 't_ess', check: (s) => (s.d2.stats.totalEssence || 0) >= 10 },
      reward: { field: 'd2XiMult', mult: 1.10, text: 'Ξ ×1.10' } },
    { id: 'c_mars', name: 'Марс', symbol: '♂',
      trial: { id: 't_coll3', check: (s) => (s.d2.stats.collapses || 0) >= 3 },
      reward: { field: 'd2CollapseMult', mult: 1.15, text: '⌬ ×1.15' } },
    { id: 'c_jupiter', name: 'Юпитер', symbol: '♃',
      trial: { id: 't_best', check: (s) => (s.d2.stats.bestD || 0) >= 250 },
      reward: { field: 'd2StartAdd', add: 25, text: 'старт D₂ +25' } },
    { id: 'c_neptune', name: 'Нептун', symbol: '♆',
      trial: { id: 't_sig', check: (s) => (s.cel.sigils || 0) >= 4 },
      reward: { field: 'd2XiMult', mult: 1.25, text: 'Ξ ×1.25' } },
    { id: 'c_venus', name: 'Венера', symbol: '♀',
      trial: { id: 't_axes', check: () => false },
      reward: { field: 'd2RateMult', mult: 1.10, text: 'скорость осей ×1.10' } },
    { id: 'c_saturn', name: 'Сатурн', symbol: '♄',
      trial: { id: 't_links', check: () => false },
      reward: { field: 'd2SpanMult', mult: 1.20, text: 'span ×1.20' } },
    { id: 'c_uranus', name: 'Уран', symbol: '♅',
      trial: { id: 't_upg', check: () => false },
      reward: { field: 'd2RateMult', mult: 1.15, text: 'скорость осей ×1.15' } }
  ]
};

function fresh() {
  const state = G.newState();
  G.initResources(state);
  return state;
}

/* ---------- 1. форма state.cel ---------- */
section('1. Форма state.cel (ТЗ §2) и SAVE_VERSION');
check('G.SAVE_VERSION = 4', G.SAVE_VERSION === 4, 'v=' + G.SAVE_VERSION);
const API = ['newState', 'ensure', 'unlocked', 'active', 'setActive', 'isDone', 'markDone',
  'bonusMult', 'bonusSum', 'status'];
for (const k of API) check('G.celestials.' + k + ' есть', typeof G.celestials[k] === 'function');

const st0 = fresh();
const cel0 = st0.cel;
check('G.newState() сразу содержит cel', !!cel0 && typeof cel0 === 'object');
check('state.cel.v = 1', cel0.v === 1);
check('unlocked/active по умолчанию false', cel0.unlocked === false && cel0.active === false);
check('sigils = 0', cel0.sigils === 0);
check('completed пустой', Object.keys(cel0.completed).length === 0);
check('stats: attempts/completions = 0',
  cel0.stats.attempts === 0 && cel0.stats.completions === 0);
check('seen — пустой массив', Array.isArray(cel0.seen) && cel0.seen.length === 0);
check('D2 рядом и не тронут', !!st0.d2 && st0.d2.stats.collapses === 0 && st0.d2.D === 0);
check('D1 не тронут', G.BN.log10(st0.N) === 0 && st0.D === 0);
check('нет NaN/Infinity/undefined', finiteAll(cel0));

/* ---------- 2. гейт Зала ---------- */
section('2. Гейт §2: после первого Схлопывания');
let s = fresh();
check('без Схлопывания Зал закрыт', G.celestials.unlocked(s) === false && s.cel.unlocked === false);
check('до гейта setActive не пускает',
  G.celestials.setActive(s, true) === false && s.cel.active === false);
check('до гейта status — «закрыто»', G.celestials.status(s) === 'закрыто', G.celestials.status(s));

s.d2.stats.collapses = 1;
check('collapses = 1 — Зал открыт', G.celestials.unlocked(s) === true);
check('флаг state.cel.unlocked выставлен', s.cel.unlocked === true);

s.d2.stats.collapses = 0;                    // имитируем «счётчик обнулили» — защёлка держит
check('открытый Зал не закрывается (защёлка)', G.celestials.unlocked(s) === true);

check('active() по умолчанию false', G.celestials.active(s) === false);
check('setActive(state,true) открывает Зал',
  G.celestials.setActive(s, true) === true && s.cel.active === true);
check('setActive(state,false) закрывает',
  G.celestials.setActive(s, false) === false && s.cel.active === false);
s.d2.stats.collapses = 1;

/* ---------- 3. markDone ---------- */
section('3. markDone: идемпотентность, sigils, stats.completions');
const d = fresh();
d.d2.stats.collapses = 1;
G.celestials.unlocked(d);

check('isDone до завершения — false', G.celestials.isDone(d, 'c_sun') === false);
check('markDone(c_sun) вернул true', G.celestials.markDone(d, 'c_sun') === true);
check('completed[c_sun] = true', d.cel.completed.c_sun === true);
check('isDone после завершения — true', G.celestials.isDone(d, 'c_sun') === true);
check('sigils = 1', d.cel.sigils === 1, String(d.cel.sigils));
check('stats.completions = 1', d.cel.stats.completions === 1, String(d.cel.stats.completions));

check('повторный markDone вернул false', G.celestials.markDone(d, 'c_sun') === false);
check('повторный markDone не начислил сигил', d.cel.sigils === 1, String(d.cel.sigils));
check('повторный markDone не начислил completion', d.cel.stats.completions === 1);

check('markDone(c_mercury) — второй сигил',
  G.celestials.markDone(d, 'c_mercury') === true && d.cel.sigils === 2 &&
  d.cel.stats.completions === 2);
check('markDone(пустой id) — false, счётчики не растут',
  G.celestials.markDone(d, '') === false && d.cel.sigils === 2);
check('markDone(null) — false', G.celestials.markDone(d, null) === false && d.cel.sigils === 2);

/* ---------- 4. bonusMult / bonusSum ---------- */
section('4. bonusMult / bonusSum по завершённым наградам');
const b = fresh();
b.d2.stats.collapses = 1;
G.celestials.unlocked(b);
check('без завершённых: bonusMult = 1', G.celestials.bonusMult(b, 'd2XiMult') === 1);
check('без завершённых: bonusSum = 0', G.celestials.bonusSum(b, 'd2StartAdd') === 0);
check('неизвестное поле: 1 и 0',
  G.celestials.bonusMult(b, 'нет_такого') === 1 && G.celestials.bonusSum(b, 'нет_такого') === 0);

G.celestials.markDone(b, 'c_mercury');          // d2XiMult ×1.10
G.celestials.markDone(b, 'c_sun');              // d2StartAdd +10
check('один завершённый: d2XiMult = 1.10',
  Math.abs(G.celestials.bonusMult(b, 'd2XiMult') - 1.10) < 1e-12,
  String(G.celestials.bonusMult(b, 'd2XiMult')));
check('одна прибавка: d2StartAdd = 10',
  Math.abs(G.celestials.bonusSum(b, 'd2StartAdd') - 10) < 1e-12,
  String(G.celestials.bonusSum(b, 'd2StartAdd')));
check('чужое поле не подмешивается (d2RateMult = 1)',
  G.celestials.bonusMult(b, 'd2RateMult') === 1);

G.celestials.markDone(b, 'c_neptune');          // d2XiMult ×1.25
check('два завершённых перемножаются: 1.10 × 1.25',
  Math.abs(G.celestials.bonusMult(b, 'd2XiMult') - 1.10 * 1.25) < 1e-12,
  String(G.celestials.bonusMult(b, 'd2XiMult')));

G.celestials.markDone(b, 'c_jupiter');          // d2StartAdd +25
check('прибавки складываются: 10 + 25 = 35',
  Math.abs(G.celestials.bonusSum(b, 'd2StartAdd') - 35) < 1e-12,
  String(G.celestials.bonusSum(b, 'd2StartAdd')));
check('bonusMult не берёт add-награды (d2StartAdd = 1)',
  G.celestials.bonusMult(b, 'd2StartAdd') === 1);
check('bonusSum не берёт mult-награды (d2XiMult = 0)',
  G.celestials.bonusSum(b, 'd2XiMult') === 0);
check('награды конечны', isFinite(G.celestials.bonusMult(b, 'd2XiMult')) &&
  isFinite(G.celestials.bonusSum(b, 'd2StartAdd')));

/* контента нет — модуль не падает и не применяет наград */
const noContent = G.content.celestials;
delete G.content.celestials;
check('без G.content.celestials: 1 и 0, без падений',
  G.celestials.bonusMult(b, 'd2XiMult') === 1 && G.celestials.bonusSum(b, 'd2StartAdd') === 0);
G.content.celestials = noContent;

/* ---------- 5. status ---------- */
section('5. status');
const st = fresh();
st.d2.stats.collapses = 1;
const stText = G.celestials.status(st);
check('status открытого Зала содержит ☉ и 0/8', /☉/.test(stText) && stText.indexOf('0/8') >= 0, stText);
G.celestials.markDone(st, 'c_sun');
const stText2 = G.celestials.status(st);
check('status после одного завершения — 1/8', stText2.indexOf('1/8') >= 0, stText2);
check('status без NaN/Infinity/undefined', !BAD.test(stText) && !BAD.test(stText2));

/* ---------- 6. сбросы не трогают state.cel ---------- */
section('6. D1-сброс и D2-сброс не трогают state.cel');
const r = fresh();
r.d2.stats.collapses = 2;
G.celestials.unlocked(r);
G.celestials.setActive(r, true);
G.celestials.markDone(r, 'c_sun');
G.celestials.markDone(r, 'c_mercury');
r.cel.seen = ['c_sun'];
r.cel.stats.attempts = 3;

r.N = G.BN.fromLog10(400);
r.D = 400;
r.res.cores = 7;
r.res.turns = 15;
r.upg.tr_start = 3;
r.mech.tree = { nodes: [1, 2] };

const celBefore = JSON.stringify(r.cel);
G.resetScopes(r, ['run']);
check('resetScopes([run]) не тронул state.cel', JSON.stringify(r.cel) === celBefore);
/* Реестр контента в этом тесте не загружен (нет content/*.js), поэтому сбрасывается только
   то, что resetScopes делает без реестра: N/D/накопители. Этого достаточно: cel не в списке. */
check('resetScopes([run]) действительно сбросил D1',
  G.BN.log10(r.N) === 0 && r.D === 0 && r.tickAcc === 0);
G.resetScopes(r, ['run', 'tier']);
check('resetScopes([run,tier]) не тронул state.cel', JSON.stringify(r.cel) === celBefore);

G.d2.resetD2(r);
check('resetD2 (Схлопывание) не тронул state.cel', JSON.stringify(r.cel) === celBefore);
check('после сбросов награды на месте',
  Math.abs(G.celestials.bonusSum(r, 'd2StartAdd') - 10) < 1e-12 &&
  Math.abs(G.celestials.bonusMult(r, 'd2XiMult') - 1.10) < 1e-12 &&
  r.cel.sigils === 2 && r.cel.active === true && r.cel.unlocked === true);

/* ---------- 7. сейв v4 ---------- */
section('7. Сейв v4: roundtrip и снимок');
const sv = fresh();
sv.N = G.BN.fromLog10(321);
sv.D = 321;
sv.res.cores = 11;
sv.res.turns = 12;
sv.upg.tr_start = 4;
sv.mech.tree = { nodes: [3] };
sv.stats.bestD = 321;
sv.meta.totalRuns = 6;
const d2s = G.d2.ensure(sv);
d2s.unlocked = true;
d2s.active = true;
d2s.stats = { bestD: 120, collapses: 2, totalEssence: 20, playtime: 5, lastCollapse: 7 };
d2s.res.essence = 13;
const cels = G.celestials.ensure(sv);
cels.unlocked = true;
cels.active = true;
cels.sigils = 2;
cels.completed = { c_sun: true, c_mercury: true };
cels.stats = { attempts: 4, completions: 2 };
cels.seen = ['c_sun', 'c_mercury'];

const ser = G.save.serialize(sv);
check('serialize(): v = 4', ser.v === 4, 'v=' + ser.v);
check('serialize(): есть cel', !!ser.cel);
check('serialize(): D1-поля на месте',
  !!ser.N && !!ser.res && !!ser.upg && !!ser.mech && !!ser.stats && !!ser.settings && !!ser.meta);
check('serialize(): D2-поле на месте', !!ser.d2);

sv.cel.sigils = 999;                          // правка живого state после serialize()
sv.cel.completed.c_mars = true;
check('serialize(): cel — снимок, а не ссылка',
  ser.cel.sigils === 2 && ser.cel.completed.c_mars === undefined, String(ser.cel.sigils));

const back = G.save.deserialize(JSON.parse(JSON.stringify(ser)));
check('deserialize(): version = 4', back.version === 4, String(back.version));
check('deserialize(): D1 N и поля сохранены',
  Math.abs(G.BN.log10(back.N) - 321) < 1e-9 && back.res.cores === 11 && back.upg.tr_start === 4 &&
  !!back.mech.tree && back.stats.bestD === 321 && back.meta.totalRuns === 6);
check('deserialize(): D2 сохранён',
  back.d2.unlocked === true && back.d2.active === true &&
  back.d2.stats.collapses === 2 && back.d2.res.essence === 13);
check('deserialize(): cel сохранён',
  back.cel.v === 1 && back.cel.unlocked === true && back.cel.active === true &&
  back.cel.sigils === 2 && back.cel.completed.c_sun === true &&
  back.cel.completed.c_mercury === true && back.cel.stats.completions === 2 &&
  back.cel.stats.attempts === 4 && back.cel.seen.length === 2);
check('deserialize(): награды после загрузки работают',
  Math.abs(G.celestials.bonusSum(back, 'd2StartAdd') - 10) < 1e-12 &&
  Math.abs(G.celestials.bonusMult(back, 'd2XiMult') - 1.10) < 1e-12);
check('сейв без NaN/Infinity/undefined', finiteAll(ser) && finiteAll(back.cel));

/* ---------- 8. миграция v3 → v4 ---------- */
section('8. Миграция v3 → v4 (без cel) и битый cel');
const v3 = {
  v: 3,
  created: 1000,
  lastSeen: 2000,
  N: { m: 1.5, e: 300 },
  res: { cores: 12, turns: 11 },
  upg: { tr_start: 2 },
  mech: { tree: { nodes: [1] } },
  stats: { bestD: 300, playtime: 60 },
  settings: { buyMode: '10' },
  meta: { totalRuns: 3, bestD: 300, coresBest: 12 },
  d2: {
    v: 1, unlocked: true, active: true, N: { m: 2, e: 90 }, D: 90.3,
    res: { axis: 500, essence: 13 },
    axes: [{ lvl: 5, amount: 1 }, { lvl: 0, amount: 0 }],
    boost: 3, upgrades: { d2_rate: 2 }, links: { link_m: 1 },
    stats: { bestD: 120, collapses: 2, totalEssence: 20, playtime: 5, lastCollapse: 7 },
    lastSeen: 4242
  }
};
const mig = G.save.deserialize(JSON.parse(JSON.stringify(v3)));
check('v3 → version = 4', mig.version === 4, String(mig.version));
check('v3 → state.cel создан', !!mig.cel && typeof mig.cel === 'object');
check('v3 → cel по умолчанию пустой',
  mig.cel.v === 1 && mig.cel.unlocked === false && mig.cel.active === false &&
  mig.cel.sigils === 0 && Object.keys(mig.cel.completed).length === 0 &&
  mig.cel.stats.attempts === 0 && mig.cel.stats.completions === 0 &&
  Array.isArray(mig.cel.seen) && mig.cel.seen.length === 0);
check('v3 → D1 N сохранён', Math.abs(G.BN.log10(mig.N) - (Math.log10(1.5) + 300)) < 1e-9);
check('v3 → D1 ресурсы/апгрейды/механики/статистика сохранены',
  mig.res.cores === 12 && mig.res.turns === 11 && mig.upg.tr_start === 2 &&
  !!mig.mech.tree && mig.stats.bestD === 300 && mig.stats.playtime === 60 &&
  mig.settings.buyMode === '10' && mig.meta.totalRuns === 3);
check('v3 → D2 не потерян',
  mig.d2.unlocked === true && mig.d2.active === true && mig.d2.D === 90.3 &&
  mig.d2.res.axis === 500 && mig.d2.res.essence === 13 && mig.d2.boost === 3 &&
  mig.d2.upgrades.d2_rate === 2 && mig.d2.links.link_m === 1 &&
  mig.d2.stats.collapses === 2 && mig.d2.lastSeen === 4242);
check('v3 → Зал открывается по уже накопленным Схлопываниям (collapses = 2)',
  G.celestials.unlocked(mig) === true && mig.cel.unlocked === true);
check('v3 → нет NaN/Infinity', finiteAll(mig.cel) && G.BN.isValid(mig.N));

/* v4-сейв, у которого cel есть, но битый (обрезанный импорт) */
const broken = Object.assign({}, JSON.parse(JSON.stringify(v3)), {
  v: 4,
  cel: { v: 'x', unlocked: 'да', active: 1, sigils: NaN, completed: null, stats: { completions: Infinity }, seen: 'c_sun' }
});
const fixed = G.save.deserialize(broken);
check('битый cel починен (ensure)',
  fixed.cel.v === 1 && fixed.cel.unlocked === false && fixed.cel.active === false &&
  fixed.cel.sigils === 0 && typeof fixed.cel.completed === 'object' &&
  Object.keys(fixed.cel.completed).length === 0 &&
  fixed.cel.stats.completions === 0 && fixed.cel.stats.attempts === 0 &&
  Array.isArray(fixed.cel.seen) && fixed.cel.seen.length === 0);
check('битый cel: нет NaN/Infinity/undefined', finiteAll(fixed.cel));
check('битый cel не сломал D1/D2',
  Math.abs(G.BN.log10(fixed.N) - (Math.log10(1.5) + 300)) < 1e-9 && fixed.d2.stats.collapses === 2);

/* ---------- 9. ensure() идемпотентен ---------- */
section('9. ensure() идемпотентен');
const e1 = fresh();
G.celestials.ensure(e1);
const snapshot = JSON.stringify(e1.cel);
G.celestials.ensure(e1);
check('повторный ensure не меняет состояние', JSON.stringify(e1.cel) === snapshot);
const e2 = fresh();
delete e2.cel;
const made = G.celestials.ensure(e2);
check('ensure без cel создаёт его',
  !!made && made.sigils === 0 && made.unlocked === false && Array.isArray(made.seen) &&
  Object.keys(made.completed).length === 0);
check('ensure(null) не падает', G.celestials.ensure(null) === null);

/* ---------- итог ---------- */
console.log('\n' + (fails ? '\u2717 ПРОВАЛОВ: ' + fails : '\u2713 ВСЁ ОК'));
process.exit(fails ? 1 : 0);
