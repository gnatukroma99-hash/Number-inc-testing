/* tools/tests/d2-state.test.js — состояние D2 и сейв v3 (docs/DIMENSION2.md §5.1/§10.2/§10.4).
   Запуск:  node tools/tests/d2-state.test.js

   Грузит РЕАЛЬНЫЕ скрипты src/ в песочницу vm без DOM: ядро (BN/реестр/формат/шина),
   systems/state.js, systems/d2.js, systems/save.js. Механик и контента тут нет —
   G.turn (гейт) и G.d2Growth (скорость) подставляются заглушками, как и положено
   системам, которые читают только state и G.* по контракту §10.2.

   Проверяем:
     1) форму state.d2 и SAVE_VERSION = 4;
     2) гейт открытия (Ярус 4 + 10 ⧜), защёлку, active/setActive;
     3) rate по M₂/ΔT₂ из d2-growth, status-строку;
     4) resetD2 сбрасывает только D2 и не трогает ⌬/апгрейды/связи/статистику/D1;
     5) roundtrip сейва v3 (снимок, а не ссылка) и миграцию старого v2 без d2;
     6) ensure() не оставляет NaN/Infinity. */
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
  const G = sandbox.window.G;
  if (!G || !G.BN || !G.d2 || !G.save || typeof G.newState !== 'function') {
    throw new Error('G.BN / G.d2 / G.save / G.newState не загрузились');
  }
  return sandbox;
}

const sandbox = load();
const G = sandbox.window.G;

/* Заглушки: гейт (Ярус 4) и рост осей (задача 3). Системы читают их в момент вызова. */
let tierOpen = false;
G.turn = { tierOpen: () => tierOpen };

function fresh() {
  const state = G.newState();
  G.initResources(state);
  return state;
}

/* ---------- 1. форма state.d2 ---------- */
section('1. Форма state.d2 (ТЗ §5.1) и SAVE_VERSION');
check('G.SAVE_VERSION = 4', G.SAVE_VERSION === 4, 'v=' + G.SAVE_VERSION);
const API = ['newState', 'ensure', 'unlocked', 'active', 'setActive', 'D', 'N', 'rate', 'resetD2', 'status'];
for (const k of API) check('G.d2.' + k + ' есть', typeof G.d2[k] === 'function');

const st0 = fresh();
const d20 = st0.d2;
check('G.newState() сразу содержит d2', !!d20 && typeof d20 === 'object');
check('state.d2.v = 1', d20.v === 1);
check('unlocked/active по умолчанию false', d20.unlocked === false && d20.active === false);
check('N₂ = 1 (BigNum)', G.BN.isValid(d20.N) && G.BN.log10(d20.N) === 0);
check('D₂ = 0', d20.D === 0);
check('disp = null', d20.disp === null);
check('Ξ и ⌬ по нулям', d20.res.axis === 0 && d20.res.essence === 0);
check('8 осей с lvl/amount = 0',
  d20.axes.length === 8 && d20.axes.every((a) => a.lvl === 0 && a.amount === 0),
  d20.axes.length + ' шт');
check('boost = 0, upgrades/links пустые',
  d20.boost === 0 && Object.keys(d20.upgrades).length === 0 && Object.keys(d20.links).length === 0);
check('stats: bestD/collapses/totalEssence/playtime/lastCollapse',
  d20.stats.bestD === 0 && d20.stats.collapses === 0 && d20.stats.totalEssence === 0 &&
  d20.stats.playtime === 0 && d20.stats.lastCollapse === 0);
check('lastSeen = 0', d20.lastSeen === 0);
check('D2 отдельно от D1: state.N не тронут', G.BN.log10(st0.N) === 0 && st0.D === 0);

/* ---------- 2. гейт открытия ---------- */
section('2. Гейт §4: Ярус 4 + 10 ⧜');
let s = fresh();
tierOpen = false;
s.res.turns = 50;
check('без Яруса 4 закрыто', G.d2.unlocked(s) === false && s.d2.unlocked === false);

tierOpen = true;
s.res.turns = 9.5;
check('9.5 ⧜ — ещё закрыто', G.d2.unlocked(s) === false, 'turns=' + s.res.turns);

s.res.turns = 10;
check('10 ⧜ и Ярус 4 — открыто', G.d2.unlocked(s) === true);
check('флаг state.d2.unlocked выставлен', s.d2.unlocked === true);

s.res.turns = 0;
tierOpen = false;
check('открытый D2 не закрывается (защёлка)', G.d2.unlocked(s) === true);

check('active() по умолчанию false', G.d2.active(s) === false);
check('setActive(state,true) входит в мир D2', G.d2.setActive(s, true) === true && s.d2.active === true);
check('setActive(state,false) выходит', G.d2.setActive(s, false) === false && s.d2.active === false);

const sLocked = fresh();
sLocked.res.turns = 0;
tierOpen = false;
check('до открытия setActive не пускает',
  G.d2.setActive(sLocked, true) === false && sLocked.d2.active === false);

/* состояние после гейта — с открытым D2 для остальных секций */
tierOpen = true;
s.res.turns = 10;
G.d2.unlocked(s);

/* ---------- 3. rate и status ---------- */
section('3. G.d2.rate по M₂/ΔT₂ и status');
check('без d2-growth rate = 0 (конечное)', G.d2.rate(s) === 0);

G.d2Growth = {
  M2: () => 100,        // log10 = 2
  dt: () => 4           // ΔT₂
};
check('rate = log10(M₂)/ΔT₂ = 0.5', Math.abs(G.d2.rate(s) - 0.5) < 1e-12, String(G.d2.rate(s)));

G.d2Growth = { M2: () => 0, dt: () => 0 };
check('M₂ = 0 и dt = 0 — не NaN/Infinity', G.d2.rate(s) === 0, String(G.d2.rate(s)));

G.d2Growth = { M2: () => Infinity, dt: () => 1 };
check('M₂ = Infinity — 0, а не Infinity', G.d2.rate(s) === 0, String(G.d2.rate(s)));

G.d2Growth = { M2: () => 1e300, dt: () => 1e-6 };
const bigRate = G.d2.rate(s);
check('большая скорость конечна', isFinite(bigRate) && bigRate > 0, String(bigRate));
delete G.d2Growth;

const sLocked2 = fresh();
check('status закрытого D2 — «закрыто»', G.d2.status(sLocked2) === 'закрыто');

s.d2.D = 12.345;
s.d2.res.axis = 1234;
const stText = G.d2.status(s);
check('status открытого D2 содержит D₂ и Ξ', /D₂/.test(stText) && /Ξ/.test(stText), stText);
check('status без NaN/Infinity/undefined', !BAD.test(stText), stText);

/* ---------- 4. resetD2 ---------- */
section('4. resetD2 сбрасывает только D2');
const r = fresh();
G.d2.unlocked(r);                             // открыт (гейт уже пройден выше)
r.d2.unlocked = true;
r.d2.active = true;
r.d2.N = G.BN.fromLog10(150);
r.d2.D = 150;
r.d2.disp = { from: 1, to: 2, t0: 0, dur: 1 };
r.d2.res.axis = 777;
r.d2.res.essence = 42;
r.d2.axes[0].lvl = 5; r.d2.axes[0].amount = 3.5;
r.d2.axes[7].lvl = 2; r.d2.axes[7].amount = 0.25;
r.d2.boost = 4;
r.d2.upgrades = { d2_rate: 2, d2_start: 1 };
r.d2.links = { link_m: 3 };
r.d2.stats = { bestD: 150, collapses: 2, totalEssence: 42, playtime: 99, lastCollapse: 12345 };
r.d2.lastSeen = 999;

/* D1-сторона */
r.N = G.BN.fromLog10(400);
r.D = 400;
r.res.cores = 7;
r.res.energy = 12;
r.upg.tr_start = 3;
r.upg.tr_gain = 2;
r.mech.tree = { nodes: [1, 2] };
r.stats.bestD = 400;
r.meta.totalRuns = 5;

G.d2.resetD2(r);

check('N₂ = 1 и D₂ = 0', G.BN.log10(r.d2.N) === 0 && r.d2.D === 0);
check('disp очищен', r.d2.disp === null);
check('Ξ = 0, boost = 0', r.d2.res.axis === 0 && r.d2.boost === 0);
check('оси обнулены', r.d2.axes.every((a) => a.lvl === 0 && a.amount === 0));
check('⌬ сохранён', r.d2.res.essence === 42);
check('апгрейды D2 сохранены', r.d2.upgrades.d2_rate === 2 && r.d2.upgrades.d2_start === 1);
check('связи сохранены', r.d2.links.link_m === 3);
check('статистика D2 сохранена',
  r.d2.stats.collapses === 2 && r.d2.stats.bestD === 150 && r.d2.stats.totalEssence === 42 &&
  r.d2.stats.playtime === 99 && r.d2.stats.lastCollapse === 12345);
check('флаги unlocked/active сохранены', r.d2.unlocked === true && r.d2.active === true);

check('D1: N не тронут', Math.abs(G.BN.log10(r.N) - 400) < 1e-9, String(G.BN.log10(r.N)));
check('D1: D не тронут', r.D === 400);
check('D1: ресурсы не тронуты', r.res.cores === 7 && r.res.energy === 12);
check('D1: апгрейды не тронуты', r.upg.tr_start === 3 && r.upg.tr_gain === 2);
check('D1: механики и статистика не тронуты',
  !!r.mech.tree && r.stats.bestD === 400 && r.meta.totalRuns === 5);

/* ---------- 5. сейв v3 ---------- */
section('5. Сейв v3: roundtrip и снимок');
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
d2s.N = G.BN.fromLog10(87);
d2s.D = 87;
d2s.res.axis = 500;
d2s.res.essence = 13;
d2s.axes[2].lvl = 5; d2s.axes[2].amount = 1.25;
d2s.boost = 3;
d2s.upgrades = { d2_rate: 2 };
d2s.links = { link_m: 1 };
d2s.stats = { bestD: 120, collapses: 2, totalEssence: 20, playtime: 5, lastCollapse: 7 };
d2s.lastSeen = 4242;

const ser = G.save.serialize(sv);
check('serialize(): v = SAVE_VERSION', ser.v === G.SAVE_VERSION, 'v=' + ser.v);
check('serialize(): есть d2', !!ser.d2);
check('serialize(): D1-поля на месте',
  !!ser.N && !!ser.res && !!ser.upg && !!ser.mech && !!ser.stats && !!ser.settings && !!ser.meta);

sv.d2.res.essence = 999;                      // правка живого state после serialize()
check('serialize(): d2 — снимок, а не ссылка', ser.d2.res.essence === 13, String(ser.d2.res.essence));

const back = G.save.deserialize(JSON.parse(JSON.stringify(ser)));
check('deserialize(): version = SAVE_VERSION', back.version === G.SAVE_VERSION, String(back.version));
check('deserialize(): D1 N сохранён', Math.abs(G.BN.log10(back.N) - 321) < 1e-9);
check('deserialize(): D1 ресурсы/апгрейды/механики',
  back.res.cores === 11 && back.res.turns === 12 && back.upg.tr_start === 4 &&
  !!back.mech.tree && back.meta.totalRuns === 6);
check('deserialize(): D2 флаги и валюта',
  back.d2.unlocked === true && back.d2.active === true &&
  back.d2.res.axis === 500 && back.d2.res.essence === 13);
check('deserialize(): D2 ось/boost/апгрейды/связи',
  back.d2.axes[2].lvl === 5 && Math.abs(back.d2.axes[2].amount - 1.25) < 1e-12 &&
  back.d2.boost === 3 && back.d2.upgrades.d2_rate === 2 && back.d2.links.link_m === 1);
check('deserialize(): D2 stats и N₂',
  back.d2.stats.collapses === 2 && back.d2.stats.bestD === 120 && back.d2.lastSeen === 4242 &&
  Math.abs(G.BN.log10(back.d2.N) - 87) < 1e-9);
check('сейв без NaN/Infinity/undefined', finiteAll(ser) && finiteAll(back.d2));

/* ---------- 6. старый сейв v2 без d2 ---------- */
section('6. Миграция v2 → v3 (без d2)');
const oldSave = {
  v: 2,
  created: 1000,
  lastSeen: 2000,
  N: { m: 1.5, e: 300 },
  res: { cores: 12, turns: 0 },
  upg: { tr_start: 2 },
  mech: { tree: { nodes: [1] } },
  stats: { bestD: 300, playtime: 60 },
  settings: { buyMode: '10' },
  meta: { totalRuns: 3, bestD: 300 }
};
const mig = G.save.deserialize(JSON.parse(JSON.stringify(oldSave)));
check('v2 → version = SAVE_VERSION', mig.version === G.SAVE_VERSION, String(mig.version));
check('v2 → state.d2 создан', !!mig.d2 && typeof mig.d2 === 'object');
check('v2 → D2 по умолчанию пустой',
  mig.d2.v === 1 && mig.d2.unlocked === false && mig.d2.active === false &&
  mig.d2.axes.length === 8 && mig.d2.res.axis === 0 && mig.d2.res.essence === 0 &&
  mig.d2.boost === 0 && G.BN.log10(mig.d2.N) === 0 && mig.d2.D === 0);
check('v2 → D1 N сохранён', Math.abs(G.BN.log10(mig.N) - (Math.log10(1.5) + 300)) < 1e-9);
check('v2 → D1 ресурсы/апгрейды/механики сохранены',
  mig.res.cores === 12 && mig.upg.tr_start === 2 && !!mig.mech.tree);
check('v2 → D1 статистика/настройки/мета сохранены',
  mig.stats.bestD === 300 && mig.stats.playtime === 60 &&
  mig.settings.buyMode === '10' && mig.meta.totalRuns === 3);
check('v2 → нет NaN/Infinity', finiteAll(mig.d2) && G.BN.isValid(mig.N));

/* старый сейв, у которого d2 есть, но битый (например, обрезанный импорт) */
const broken = Object.assign({}, JSON.parse(JSON.stringify(oldSave)), {
  v: 3,
  d2: { N: { m: NaN, e: 5 }, D: 'x', axes: [{ lvl: NaN }], res: null, stats: { collapses: Infinity } }
});
const fixed = G.save.deserialize(broken);
check('битый d2 починен (ensure)',
  G.BN.isValid(fixed.d2.N) && fixed.d2.D === 0 && fixed.d2.axes.length === 8 &&
  fixed.d2.axes[0].lvl === 0 && fixed.d2.stats.collapses === 0 &&
  fixed.d2.res.axis === 0 && fixed.d2.res.essence === 0);
check('битый d2: нет NaN/Infinity', finiteAll(fixed.d2));

/* ---------- 7. ensure() идемпотентен ---------- */
section('7. ensure() идемпотентен');
const e1 = fresh();
G.d2.ensure(e1);
const snapshotD2 = JSON.stringify(e1.d2);
G.d2.ensure(e1);
check('повторный ensure не меняет состояние', JSON.stringify(e1.d2) === snapshotD2);
const e2 = fresh();
delete e2.d2;
check('ensure без d2 создаёт его', G.d2.ensure(e2).axes.length === 8 && e2.d2.unlocked === false);
check('ensure(null) не падает', G.d2.ensure(null) === null);

/* ---------- итог ---------- */
console.log('\n' + (fails ? '\u2717 ПРОВАЛОВ: ' + fails : '\u2713 ВСЁ ОК'));
process.exit(fails ? 1 : 0);
