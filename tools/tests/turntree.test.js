/* tools/tests/turntree.test.js — тест данных дерева ⧜ (24 узла, 4 ветви по 6).
   Запуск:  node tools/tests/turntree.test.js
   Грузит настоящий src/ (как другие Node-тесты: без DOM, без main.js/ui/board.js)
   и проверяет только данные + общий systems/upgrades.js. Своих цифр не выдумывает:
   все ожидания берутся из самих узлов (base/growth/max/hook) и печатаются в отчёте. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* тот же отбор скриптов, что в других Node-тестах: всё, кроме браузерного (main/ui/доски) */
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
  window: {},
  console: console,
  performance: { now: () => Date.now() },
  Math, Date, isFinite, isNaN, Number, JSON, Object, Array, String, Set, Map
};
sandbox.globalThis = sandbox.window;
vm.createContext(sandbox);
for (const f of filesFromIndex()) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const G = sandbox.window.G;

/* ---------- мини-раннер ---------- */
let fails = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  \u2713 ' + name + (extra ? '  — ' + extra : '')); }
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
}
function close(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps); }

/* ---------- данные дерева ---------- */
const tt = G.registry.upgradesOf('turntree');
const branches = (G.content.turntree && G.content.turntree.branches) || [];
const BRANCH_IDS = ['start', 'power', 'tempo', 'deep'];
const HOOKS = ['Mmult', 'powM', 'dtMult', 'speedBonus', 'spanMult', 'coreGainMult',
  'deltaGainMult', 'psiRateMult', 'turnGainMult', 'turnGainAdd', 'autoStepMult'];

/* свежее состояние + ветка куплена целиком (для проверок эффектов) */
function freshState() {
  const s = G.newState();
  G.initResources(s);
  s.N = G.BN.fromLog10(12500);
  s.D = 12500;
  return s;
}
function buy(state, id, times) {
  const u = G.registry.upgrade(id);
  if (!u) return 0;
  state.res[u.res] = 1e9;
  return G.upgrades.buy(state, u, times || 1);
}
function chainOf(branch) {
  return tt.filter((u) => u.branch === branch).sort((a, b) => a.depth - b.depth);
}
/* купить всех предков узла (только они открывают сам узел) */
function buyAncestors(state, id) {
  const u = G.registry.upgrade(id);
  let bought = 0;
  for (const x of chainOf(u.branch)) {
    if (x.id === id) break;
    bought += buy(state, x.id, 1);
  }
  return bought;
}
/* предки + сам узел */
function buyChain(state, id) {
  return buyAncestors(state, id) + buy(state, id, 1);
}

console.log('\n1. Состав дерева («24 узла, 4 ветви по 6»)');
check('узлов в реестре 24', tt.length === 24, tt.length + ' узлов');
check('ветвей 4 и это start/power/tempo/deep',
  branches.length === 4 && BRANCH_IDS.every((id, i) => branches[i].id === id),
  branches.map((b) => b.id).join(', '));
const perBranch = BRANCH_IDS.map((id) => chainOf(id).length);
check('в каждой ветви по 6 узлов', perBranch.every((n) => n === 6), perBranch.join(' / '));
const depthOk = BRANCH_IDS.every((id) => {
  const ds = chainOf(id).map((u) => u.depth);
  return ds.length === 6 && ds.every((d, i) => d === i);
});
check('глубины 0..5 без пропусков и повторов', depthOk,
  BRANCH_IDS.map((id) => id + ':' + chainOf(id).map((u) => u.depth).join('')).join(' '));

console.log('\n2. id и цепочка requires');
const ids = tt.map((u) => u.id);
check('id узлов уникальны', new Set(ids).size === ids.length, ids.join(', '));
const allIds = G.registry.allUpgrades().map((u) => u.id);
check('в реестре нет дублей id', new Set(allIds).size === allIds.length,
  allIds.length + ' апгрейдов');
check('каждый id смотрит на свой узел в реестре',
  tt.every((u) => G.registry.upgrade(u.id) === u));
const missingReq = [];
for (const u of tt) {
  for (const r of (u.requires || [])) if (!G.registry.upgrade(r)) missingReq.push(u.id + '→' + r);
}
check('все requires существуют', missingReq.length === 0, missingReq.join(', ') || 'все найдены');
const chainBad = [];
for (const u of tt) {
  const req = u.requires || [];
  if (u.depth === 0) {
    if (req.length) chainBad.push(u.id + ' (глубина 0 с предком)');
    continue;
  }
  const prev = chainOf(u.branch).find((x) => x.depth === u.depth - 1);
  if (req.length !== 1 || !prev || req[0] !== prev.id) chainBad.push(u.id + '→' + req.join('+'));
}
check('requires — цепочка: глубина d требует узел d-1 той же ветви', chainBad.length === 0,
  chainBad.join(', ') || 'цепочка сплошная');

console.log('\n3. Открытие и покупка через systems/upgrades.js');
const s = freshState();
const lockedOk = tt.every((u) => G.upgrades.requirementsMet(s, u) === (u.depth === 0));
check('без покупок открыты только узлы глубины 0', lockedOk,
  'открыто ' + tt.filter((u) => G.upgrades.requirementsMet(s, u)).length + ' из ' + tt.length);
const wall = G.registry.upgrade('tt_s6');
s.res.turns = 1e9;
check('глубокий узел скрыт без предков',
  G.upgrades.requirementsMet(s, wall) === false && G.upgrades.canBuy(s, wall) === false,
  'tt_s6 требует tt_s5');
buyChain(s, 'tt_s5');
check('после покупки предка узел открывается',
  G.upgrades.requirementsMet(s, wall) === true && G.upgrades.canBuy(s, wall) === true);

const s2 = freshState();
s2.res.turns = 0;
check('без ⧜ купить нельзя', G.upgrades.canBuy(s2, G.registry.upgrade('tt_s1')) === false);
const price0 = G.upgrades.cost(G.registry.upgrade('tt_s1'), 0);
s2.res.turns = price0;
const n1 = G.upgrades.buy(s2, G.registry.upgrade('tt_s1'), 1);
check('покупка за ⧜: уровень +1, валюта списана',
  n1 === 1 && G.lvl(s2, 'tt_s1') === 1 && close(s2.res.turns, 0),
  'цена ' + price0 + ' ⧜, остаток ' + s2.res.turns);
const price1 = G.upgrades.cost(G.registry.upgrade('tt_s1'), 1);
check('вторая цена = base · growth', close(price1, price0 * 2),
  price0 + ' → ' + price1);
check('max = 2: третий уровень не покупается',
  (function () { s2.res.turns = 1e9; G.upgrades.buy(s2, G.registry.upgrade('tt_s1'), 5); return G.lvl(s2, 'tt_s1') === 2; })(),
  'ур. ' + G.lvl(s2, 'tt_s1'));

console.log('\n4. Формулы и поля узлов');
const badFormula = [];
const badHook = [];
const badField = [];
for (const u of tt) {
  try { G.formula.precompile(u.formula); } catch (e) { badFormula.push(u.id + ': ' + e.message); }
  if (u.costFormula) {
    try { G.formula.precompile(u.costFormula); } catch (e) { badFormula.push(u.id + ' cost: ' + e.message); }
  }
  if (typeof u.formula !== 'string' || !u.formula) badFormula.push(u.id + ': formula не строка');
  for (const h of HOOKS) {
    if (!u[h]) continue;
    if (typeof u[h] !== 'string') { badHook.push(u.id + '.' + h + ' не строка'); continue; }
    try { G.formula.precompile(u[h]); } catch (e) { badHook.push(u.id + '.' + h + ': ' + e.message); }
    for (let lvl = 1; lvl <= u.max; lvl++) {
      const v = G.formula(u[h], { lvl: lvl });
      if (!isFinite(v) || v <= 0) badHook.push(u.id + '.' + h + ' lvl' + lvl + ' = ' + v);
    }
  }
  /* узлы «Разбега» на глубинах 0..2 вообще без хука: их читает formula старта
     через startVars, поэтому «ровно один хук» требуется только вне startVars */
  const used = HOOKS.filter((h) => u[h]);
  const inStartVars = Object.keys(G.content.turn.startVars || {})
    .some((k) => G.content.turn.startVars[k] === u.id);
  const want = inStartVars ? 0 : 1;
  if (used.length !== want) badHook.push(u.id + ': хуков ' + used.length + ' (' + used.join('+') + ')');
  if (u.res !== 'turns' || u.scope !== 'meta') badField.push(u.id + ' res/scope');
  if (u.growth !== 2.0 || u.max !== 2) badField.push(u.id + ' growth/max');
  if (u.tier !== 't4') badField.push(u.id + ' tier');
  if (BRANCH_IDS.indexOf(u.branch) < 0) badField.push(u.id + ' branch');
}
check('все formula/costFormula компилируются', badFormula.length === 0,
  badFormula.join(', ') || tt.length + ' узлов');
check('у каждого узла ровно один известный хук и он положителен на lvl 1..max',
  badHook.length === 0, badHook.join(', ') || HOOKS.join(' / '));
check('цены строкой base/growth 2.0/max 2, валюта ⧜, scope meta, tier t4',
  badField.length === 0, badField.join(', ') || 'все 24 узла');

console.log('\n5. Эффекты новых узлов (через общие хуки движка)');
const effect = (field, id, expect) => {
  const st = freshState();
  buyAncestors(st, id);
  const before = G.growth.upgProduct(st, field);
  buy(st, id, 1);
  const after = G.growth.upgProduct(st, field);
  check('«' + G.registry.upgrade(id).name + '» (' + field + ')', close(after / before, expect, 1e-9),
    (after / before).toFixed(4) + ' (ждали ' + expect + ')');
};
const addEffect = (field, id, expect) => {
  const st = freshState();
  buyAncestors(st, id);
  const before = G.growth.upgSum(st, field);
  buy(st, id, 1);
  const after = G.growth.upgSum(st, field);
  check('«' + G.registry.upgrade(id).name + '» (' + field + ')', close(after - before, expect),
    '+' + (after - before).toFixed(3) + ' (ждали +' + expect + ')');
};
addEffect('turnGainAdd', 'tt_s5', 2);
effect('Mmult', 'tt_s6', 2);
effect('Mmult', 'tt_p5', 6);
effect('powM', 'tt_p6', 1.03);
addEffect('speedBonus', 'tt_t5', 0.5);
effect('dtMult', 'tt_t6', 0.94);
effect('spanMult', 'tt_d5', 1.8);
effect('turnGainMult', 'tt_d6', 1.5);
const gainState = freshState();
buyAncestors(gainState, 'tt_s5');
const g0 = G.turn.gain(gainState);
buy(gainState, 'tt_s5', 1);
check('⧜ за ОБОРОТ растёт от tt_s5', G.turn.gain(gainState) === g0 + 2,
  g0 + ' → ' + G.turn.gain(gainState));

console.log('\n6. startVars: новые узлы «Разбега» не трогают формулу старта');
const sv = G.content.turn.startVars || {};
const svBad = Object.keys(sv).filter((k) => {
  const u = G.registry.upgrade(sv[k]);
  return !u || u.mech !== 'turntree';
});
check('все startVars — узлы дерева ⧜', svBad.length === 0, JSON.stringify(sv));
/* turnsAfter = 0 — чтобы на старт влияли только уровни узлов, а не купленные ⧜ */
const startState = freshState();
buyAncestors(startState, 'tt_s5');
const start0 = G.turn.startDigits(startState, 0);
buy(startState, 'tt_s5', 1);
check('tt_s5 (turnGainAdd) не меняет стартовые цифры',
  close(G.turn.startDigits(startState, 0), start0),
  start0 + ' → ' + G.turn.startDigits(startState, 0));
buy(startState, 'tt_s1', 1);
check('tt_s1 по-прежнему поднимает старт на 100',
  close(G.turn.startDigits(startState, 0), start0 + 100),
  start0 + ' → ' + G.turn.startDigits(startState, 0));

console.log('\n7. Мета: дерево не сбрасывается');
const keepState = freshState();
buyChain(keepState, 'tt_d6');
const kept = G.lvl(keepState, 'tt_d6');
G.resetScopes(keepState, ['run', 'tier']);
check('после сброса забега и яруса 2 уровень узла на месте', G.lvl(keepState, 'tt_d6') === kept,
  'tt_d6 = ' + G.lvl(keepState, 'tt_d6'));
check('механика «Дерево ⧜» считает 24 узла',
  G.registry.mechanic('turntree').total() === 24,
  'total() = ' + G.registry.mechanic('turntree').total());
check('все 24 узла покупаемы по цепочке за ⧜',
  (function () {
    const st = freshState();
    for (const id of BRANCH_IDS) buyChain(st, chainOf(id)[5].id);
    const bought = tt.filter((u) => G.lvl(st, u.id) === 1).length;
    return bought === 24;
  })(),
  '24 из 24 по цепочке до глубины 5');

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' (пройдено ' + passes + ')' : 'ВСЁ ОК: ' + passes + ' проверок'));
process.exitCode = fails ? 1 : 0;
