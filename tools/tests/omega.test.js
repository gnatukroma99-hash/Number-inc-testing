/* tools/tests/omega.test.js — Ω-правила Ярусов 3/4: Ψ за ПРОБОЙ, Ψ/с, ⧜ за ОБОРОТ, ⧜/с.
   Запуск: node tools/tests/omega.test.js
   Грузит НАСТОЯЩИЕ файлы игры (classic IIFE) в vm-песочницу без DOM и проверяет:
   данные правил, G.omega.*Mult, покупку (cost/canBuy/событие), рост gain/rate у
   systems/breakthrough.js и systems/turn.js — и отсутствие двойного применения. */
'use strict';
require('../_limit')(60);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* порядок как в index.html (только нужное подмножество: без UI и досок) */
const FILES = [
  'src/core/eventbus.js',
  'src/core/bignum.js',
  'src/core/formula.js',
  'src/core/registry.js',
  'src/systems/state.js',
  'src/systems/bigbang.js',
  'src/systems/breakthrough.js',
  'src/systems/turn.js',
  'src/systems/growth.js',
  'src/content/tier2.js',
  'src/content/tier3.js',
  'src/content/turn.js',
  'src/content/omega.js',
  'src/mechanics/omega/index.js'
];

const sandbox = { console: console, window: {} };
vm.createContext(sandbox);
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}
const G = sandbox.window.G;

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

/* ---------- состояния ---------- */
const NEW_RULES = ['w_psi', 'w_psi_rate', 'w_turn', 'w_turn_rate'];
const WALLS = ['wall_308', 'wall_1000'];

/* D — цифры; стены 1e308 и 1e1000 уже пройдены => Ω, ПРОБОЙ и ОБОРОТ открыты */
function mkState(D) {
  const s = G.newState();
  s.N = G.BN.fromLog10(D);
  s.D = D;
  s.res.delta = 5;
  s.res.psi = 0;
  s.res.turns = 0;
  s.res.cores = 0;
  s.meta.bangs = 1;
  s.meta.breaks = 0;
  s.meta.passedBarriers = WALLS.slice();
  s.stats.bestD = D;
  return s;
}

function giveOmega(state, n) {
  G.omega.data(state).omega = n;
  return state;
}

function stateWith(D, id) {
  const s = mkState(D);
  giveOmega(s, 100);
  G.omega.buy(s, id);
  return s;
}

console.log('\n1. Данные правил (content/omega.js)');
const allRules = G.omega.rules();
const ids = allRules.map((r) => r.id);
for (const id of NEW_RULES) {
  const r = G.omega.rule(id);
  ok('правило ' + id + ' есть в данных', !!r);
  if (!r) continue;
  ok('  цена ' + r.cost + ' Ω в диапазоне 6–8', r.cost >= 6 && r.cost <= 8);
  ok('  тексты и имя заполнены', !!(r.name && r.text && r.icon), r.name);
}
ok('id правил уникальны', new Set(ids).size === ids.length, ids.length + ' правил');

const boardSrc = fs.readFileSync(path.join(ROOT, 'src/mechanics/omega/board.js'), 'utf8');
ok('доска не знает id правил (рисует из данных)', !/w_[a-z_]+/.test(boardSrc));

console.log('\n2. G.omega.*Mult по умолчанию = 1');
const plain = mkState(3000);
ok('psiGainMult', G.omega.psiGainMult(plain) === 1);
ok('psiRateMult', G.omega.psiRateMult(plain) === 1);
ok('turnGainMult', G.omega.turnGainMult(plain) === 1);
ok('turnRateMult', G.omega.turnRateMult(plain) === 1);

console.log('\n3. Покупка: cost / canBuy / событие');
const cost = G.omega.rule('w_psi').cost;
const buyState = giveOmega(mkState(3000), cost - 0.01);
ok('без Ω купить нельзя', G.omega.canBuy(buyState, 'w_psi') === false, 'Ω ' + G.omega.balance(buyState));
G.omega.data(buyState).omega = cost;
ok('ровно за цену — можно', G.omega.canBuy(buyState, 'w_psi') === true);
let events = 0;
const off = G.bus.on('omega:rule', (p) => { if (p && p.id === 'w_psi') events++; });
ok('buy() вернул true', G.omega.buy(buyState, 'w_psi') === true);
off();
ok('Ω списались ровно на цену', G.omega.balance(buyState) === 0, 'Ω ' + G.omega.balance(buyState));
ok('правило записано в state.mech.omega.rules',
  G.omega.has(buyState, 'w_psi') && G.omega.data(buyState).rules.indexOf('w_psi') >= 0);
ok('событие omega:rule испущено один раз', events === 1, 'events = ' + events);
ok('повторно купить нельзя', G.omega.buy(buyState, 'w_psi') === false && G.omega.canBuy(buyState, 'w_psi') === false);
ok('неизвестное правило не покупается', G.omega.buy(buyState, 'w_nope') === false);

console.log('\n4. Ψ: ПРОБОЙ (gain) и Ψ-поток (rate)');
const psiState = stateWith(3000, 'w_psi');
ok('psiGainMult = 1.5 после покупки', G.omega.psiGainMult(psiState) === 1.5);
const psiRateOnly = stateWith(3000, 'w_psi_rate');
ok('psiRateMult = 1.5 после покупки', G.omega.psiRateMult(psiRateOnly) === 1.5);

const gainBase = G.breakthrough.gain(mkState(3000));
const gainPsi = G.breakthrough.gain(psiState);
ok('Ψ за ПРОБОЙ вырос ×1.5', Math.abs(gainPsi - 1.5 * gainBase) <= 1,
  gainBase + ' → ' + gainPsi + ' (разница ' + Math.abs(gainPsi - 1.5 * gainBase) + ')');
ok('Ψ за ПРОБОЙ не ×2.25 (нет двойного применения)', gainPsi < 1.75 * gainBase,
  'отношение ' + (gainPsi / gainBase).toFixed(4));

const rateBase = G.breakthrough.rate(mkState(3000));
const ratePsi = G.breakthrough.rate(psiRateOnly);
ok('Ψ/с вырос ×1.5', Math.abs(ratePsi / rateBase - 1.5) < 1e-12,
  rateBase.toFixed(6) + ' → ' + ratePsi.toFixed(6));
ok('Ψ/с не ×2.25', ratePsi / rateBase < 1.75, 'отношение ' + (ratePsi / rateBase).toFixed(4));

ok('правило на gain не трогает rate',
  G.breakthrough.rate(psiState) === rateBase, rateBase + ' = ' + G.breakthrough.rate(psiState));
ok('правило на rate не трогает gain',
  G.breakthrough.gain(psiRateOnly) === gainBase, gainBase + ' = ' + G.breakthrough.gain(psiRateOnly));

const both = stateWith(3000, 'w_psi');
giveOmega(both, 100);
G.omega.buy(both, 'w_psi_rate');
ok('оба Ψ-правила: gain всё ещё ×1.5',
  Math.abs(G.breakthrough.gain(both) - 1.5 * gainBase) <= 1, gainBase + ' → ' + G.breakthrough.gain(both));
ok('оба Ψ-правила: rate всё ещё ×1.5',
  Math.abs(G.breakthrough.rate(both) / rateBase - 1.5) < 1e-12,
  rateBase.toFixed(6) + ' → ' + G.breakthrough.rate(both).toFixed(6));

console.log('\n5. ⧜: ОБОРОТ (gain) и ⧜-накат (rate)');
const turnState = stateWith(50000, 'w_turn');
ok('turnGainMult = 1.5 после покупки', G.omega.turnGainMult(turnState) === 1.5);
const turnRateState = stateWith(50000, 'w_turn_rate');
ok('turnRateMult = 1.5 после покупки', G.omega.turnRateMult(turnRateState) === 1.5);

const turnGainBase = G.turn.gain(mkState(50000));
const turnGainWith = G.turn.gain(turnState);
ok('⧜ за ОБОРОТ вырос ×1.5', Math.abs(turnGainWith - 1.5 * turnGainBase) <= 1,
  turnGainBase + ' → ' + turnGainWith);
ok('⧜ за ОБОРОТ не ×2.25', turnGainWith < 1.75 * turnGainBase,
  'отношение ' + (turnGainWith / turnGainBase).toFixed(4));

const turnRateBase = G.turn.rate(mkState(50000));
const turnRateWith = G.turn.rate(turnRateState);
ok('⧜/с вырос ×1.5', Math.abs(turnRateWith / turnRateBase - 1.5) < 1e-12,
  turnRateBase.toFixed(6) + ' → ' + turnRateWith.toFixed(6));
ok('⧜/с не ×2.25', turnRateWith / turnRateBase < 1.75,
  'отношение ' + (turnRateWith / turnRateBase).toFixed(4));

ok('правило на ⧜-gain не трогает ⧜/с',
  G.turn.rate(turnState) === turnRateBase, turnRateBase + ' = ' + G.turn.rate(turnState));
ok('правило на ⧜/с не трогает ⧜-gain',
  G.turn.gain(turnRateState) === turnGainBase, turnGainBase + ' = ' + G.turn.gain(turnRateState));

console.log('\n6. Множители идут через хук механики (и только через него)');
const mech = G.registry.mechanic('omega');
ok('механика omega зарегистрирована', !!mech);
ok('механика отдаёт все четыре хука',
  NEW_RULES.length === 4 &&
  ['psiGainMult', 'psiRateMult', 'turnGainMult', 'turnRateMult']
    .every((h) => typeof mech[h] === 'function'));
const lockedState = mkState(3000);
lockedState.meta.passedBarriers = [];
lockedState.res.delta = 0;                   /* Ярус 2 закрыт => механика Ω не разблокирована */
giveOmega(lockedState, 100);
G.omega.buy(lockedState, 'w_psi');
ok('закрытая механика Ω: хук не применяется',
  G.breakthrough.gain(lockedState) === gainBase, gainBase + ' = ' + G.breakthrough.gain(lockedState));
ok('но сам метод Ω по-прежнему 1.5', G.omega.psiGainMult(lockedState) === 1.5);

console.log('\n7. Правила сохраняются (scope meta)');
const persist = stateWith(3000, 'w_psi');
giveOmega(persist, 100);
G.omega.buy(persist, 'w_turn_rate');
const beforeJson = JSON.stringify(G.omega.data(persist).rules);
G.resetScopes(persist, ['run', 'tier']);
ok('после сброса забега и яруса правила на месте',
  JSON.stringify(G.omega.data(persist).rules) === beforeJson, beforeJson);
ok('купленное правило действует после сброса', G.omega.psiGainMult(persist) === 1.5);
ok('купленное правило не покупается второй раз', G.omega.canBuy(persist, 'w_psi') === false);
ok('счётчик купленных правил', G.omega.data(persist).bought === 2,
  'bought = ' + G.omega.data(persist).bought);

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' из ' + checks
  : 'ВСЁ ОК — ' + checks + ' проверок'));
process.exitCode = fails ? 1 : 0;
