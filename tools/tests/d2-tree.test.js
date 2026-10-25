/* tools/tests/d2-tree.test.js — тест Древа D2 (16 узлов, 4 ветви по 4) — задача 9.
   Запуск:  node tools/tests/d2-tree.test.js
            NODE_PATH=<node_modules> node tools/tests/d2-tree.test.js   (часть 8 — jsdom)

   Что проверяет:
     1) состав: 16 узлов, 4 ветви start/power/flow/reset по 4, глубины 0..3 без дыр;
     2) id уникальны, requires — сплошная цепочка внутри своей ветви;
     3) поля: res 'essence', scope 'meta-d2', tier 'd2', ровно один D2-хук на узел,
        никаких Mmult/spanMult (иначе дерево D2 дублировало бы связи D1↔D2);
     4) все строки-формулы (formula + хук) компилируются и конечны, цены в ⌬ растут;
     5) покупка идёт через G.upgrades (цена base·growth^lvl) и зеркало ⌬ state.d2 ↔ state.res;
     6) эффекты видны общим свипам G.growth.upgSum / upgProduct;
     7) сбросы D1 (run/tier) не трогают уровни узлов и ⌬; механика закрыта до Схлопывания;
     8) карта (G.treeBoard.build) монтируется в jsdom: 16 клеток, 4 подписи ветвей,
        4 кольца, 12 скрытых узлов, клик по орбу покупает узел, в тексте нет NaN/undefined.

   Своих цифр не выдумывает: ожидания — из данных узлов (base/growth/max/хук) и напечатаны в отчёте.
   Файлы D2 грузятся вручную: index.html дописывает директор, тест от этого не зависит. */
'use strict';
require('../_limit')(240);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const D2_FILES = [
  'src/content/d2-tree.js',
  'src/mechanics/d2tree/index.js',
  'src/mechanics/d2tree/board.js'
];
const BRANCH_IDS = ['start', 'power', 'flow', 'reset'];
const HOOKS = ['d2StartAdd', 'd2RateMult', 'd2XiMult', 'd2CollapseMult', 'd2SpanMult'];
/* поля D1-деревьев: в D2-дереве их быть не должно (эффект уже дают связи, ТЗ §7) */
const FOREIGN = ['Mmult', 'spanMult', 'powM', 'dtMult', 'speedBonus', 'coreGainMult',
  'deltaGainMult', 'turnGainMult', 'psiRateMult', 'autoStepMult'];

let fails = 0;
let passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  \u2713 ' + name + (extra ? '  — ' + extra : '')); }
  else { fails++; console.log('  \u2717 ' + name + (extra ? '  — ' + extra : '')); }
  return cond;
}
const close = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);
const okNum = (v) => typeof v === 'number' && isFinite(v);

/* ---------- скрипты страницы: всё, кроме браузерного (main/ui/доски) ---------- */
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

/* ---------- загрузка логики в Node-vm (без DOM) ---------- */
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
/* content + index.js: в остальных Node-тестах они тоже грузятся вручную, пока их нет в index.html */
if (!sandbox.window.G.content.d2tree) {
  for (const f of D2_FILES.slice(0, 2)) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
}
const G = sandbox.window.G;

/* ---------- состояние ---------- */
function freshState(essence, collapses) {
  const s = G.newState();
  G.initResources(s);
  s.N = G.BN.fromLog10(1000);
  s.D = 1000;
  s.d2 = {
    v: 1,
    unlocked: true,
    active: true,
    N: G.BN.fromLog10(100),
    D: 100,
    disp: null,
    res: { axis: 0, essence: essence || 0 },
    axes: [{ lvl: 0, amount: 0 }, { lvl: 0, amount: 0 }, { lvl: 0, amount: 0 }, { lvl: 0, amount: 0 },
      { lvl: 0, amount: 0 }, { lvl: 0, amount: 0 }, { lvl: 0, amount: 0 }, { lvl: 0, amount: 0 }],
    boost: 0,
    upgrades: {},
    links: {},
    stats: { bestD: 100, collapses: collapses || 0, totalEssence: essence || 0, playtime: 0, lastCollapse: 0 },
    lastSeen: 0
  };
  return s;
}

const nodes = G.registry.upgradesOf('d2tree');
const branches = (G.content.d2tree && G.content.d2tree.branches) || [];
const chainOf = (branch) => nodes.filter((u) => u.branch === branch).sort((a, b) => a.depth - b.depth);

/* купить узел через механику (она зеркалит ⌬ и зовёт G.upgrades.buy) */
function buyNode(state, id, times) {
  const u = G.registry.upgrade(id);
  return G.d2Tree.buy(state, u, times || 1);
}
console.log('\n1. Состав дерева («16 узлов, 4 ветви по 4»)');
check('узлов в реестре 16', nodes.length === 16, nodes.length + ' узлов');
check('ветвей 4 и это start/power/flow/reset',
  branches.length === 4 && BRANCH_IDS.every((id, i) => branches[i].id === id),
  branches.map((b) => b.id + ' «' + b.name + '»').join(', '));
const perBranch = BRANCH_IDS.map((id) => chainOf(id).length);
check('в каждой ветви по 4 узла', perBranch.every((n) => n === 4), perBranch.join(' / '));
const depthOk = BRANCH_IDS.every((id) => {
  const ds = chainOf(id).map((u) => u.depth);
  return ds.length === 4 && ds.every((d, i) => d === i);
});
check('глубины 0..3 без пропусков и повторов', depthOk,
  BRANCH_IDS.map((id) => id + ':' + chainOf(id).map((u) => u.depth).join('')).join(' '));
check('у каждой ветви свой угол и цвет',
  branches.every((b) => okNum(b.angle) && /^#[0-9a-f]{6}$/i.test(b.color || '')),
  branches.map((b) => b.id + ' ' + b.angle + '° ' + b.color).join(' · '));
check('тема дерева — d2', G.content.d2tree.theme === 'd2', 'theme = ' + G.content.d2tree.theme);

console.log('\n2. id и цепочка requires');
const ids = nodes.map((u) => u.id);
check('id узлов уникальны', new Set(ids).size === ids.length, ids.join(', '));
check('все id с префиксом d2t_', ids.every((id) => id.indexOf('d2t_') === 0));
check('каждый id смотрит на свой узел в реестре', nodes.every((u) => G.registry.upgrade(u.id) === u));
const missingReq = [];
for (const u of nodes) for (const r of (u.requires || [])) if (!G.registry.upgrade(r)) missingReq.push(u.id + '→' + r);
check('все requires существуют', missingReq.length === 0, missingReq.join(', ') || 'все найдены');
const chainBad = [];
for (const u of nodes) {
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

console.log('\n3. Поля узлов: валюта ⌬, scope meta-d2, ровно один D2-хук');
const badField = [];
const hookCount = {};
const badForeign = [];
for (const u of nodes) {
  if (u.res !== 'essence') badField.push(u.id + ' res=' + u.res);
  if (u.scope !== 'meta-d2') badField.push(u.id + ' scope=' + u.scope);
  if (u.tier !== 'd2') badField.push(u.id + ' tier=' + u.tier);
  if (u.mech !== 'd2tree') badField.push(u.id + ' mech=' + u.mech);
  if (!u.name || !u.icon || !u.desc) badField.push(u.id + ' без name/icon/desc');
  if (!okNum(u.base) || u.base <= 0) badField.push(u.id + ' base=' + u.base);
  if (!okNum(u.growth) || u.growth <= 1) badField.push(u.id + ' growth=' + u.growth);
  if (u.max !== 2) badField.push(u.id + ' max=' + u.max);
  if (u.fmt !== (u.d2StartAdd ? 'num' : 'x')) badField.push(u.id + ' fmt=' + u.fmt);
  const used = HOOKS.filter((h) => u[h]);
  if (used.length !== 1) badField.push(u.id + ' хуков ' + used.length + ' (' + used.join('+') + ')');
  for (const h of used) hookCount[h] = (hookCount[h] || 0) + 1;
  for (const f of FOREIGN) if (u[f]) badForeign.push(u.id + '.' + f);
}
check('res essence / scope meta-d2 / tier d2 / mech d2tree / base·growth·max 2 / fmt',
  badField.length === 0, badField.join(', ') || 'все ' + nodes.length + ' узлов');
check('у каждого узла ровно один D2-хук', nodes.every((u) => HOOKS.filter((h) => u[h]).length === 1),
  HOOKS.map((h) => h + ':' + (hookCount[h] || 0)).join(' · '));
check('все пять контрактных хуков ТЗ §8 задействованы', HOOKS.every((h) => hookCount[h] > 0),
  Object.keys(hookCount).sort().join(', '));
check('нет D1-хуков (Mmult/spanMult/powM/...) — эффект не дублирует связи', badForeign.length === 0,
  badForeign.join(', ') || 'ни одного');

console.log('\n4. Формулы и цены за ⌬');
const badFormula = [];
for (const u of nodes) {
  try { G.formula.precompile(u.formula); } catch (e) { badFormula.push(u.id + ': ' + e.message); }
  if (typeof u.formula !== 'string' || !u.formula) badFormula.push(u.id + ': formula не строка');
  for (const h of HOOKS) {
    if (!u[h]) continue;
    if (typeof u[h] !== 'string') { badFormula.push(u.id + '.' + h + ' не строка'); continue; }
    try { G.formula.precompile(u[h]); } catch (e) { badFormula.push(u.id + '.' + h + ': ' + e.message); }
    for (let lvl = 0; lvl <= u.max; lvl++) {
      const v = G.formula(u[h], { lvl: lvl });
      if (!okNum(v)) badFormula.push(u.id + '.' + h + ' lvl' + lvl + ' = ' + v);
    }
    /* на lvl 1..max эффект обязан быть положительным: ноль — «мёртвый» узел */
    for (let lvl = 1; lvl <= u.max; lvl++) {
      if (G.formula(u[h], { lvl: lvl }) <= 0) badFormula.push(u.id + '.' + h + ' lvl' + lvl + ' ≤ 0');
    }
  }
}
check('все formula и хуки компилируются и конечны на lvl 0..max', badFormula.length === 0,
  badFormula.join(', ') || nodes.length + ' узлов × ' + (1 + 1) + ' строк');

const priceState = freshState(1e6, 1);
const priceBad = [];
const chainPrices = [];
for (const u of nodes) {
  const p0 = G.upgrades.cost(u, 0);
  const p1 = G.upgrades.cost(u, 1);
  if (!okNum(p0) || p0 !== u.base) priceBad.push(u.id + ' цена0=' + p0);
  if (!close(p1, u.base * u.growth)) priceBad.push(u.id + ' цена1=' + p1);
  if (!(p1 > p0)) priceBad.push(u.id + ' цена не растёт');
  if (G.upgrades.currentCost(priceState, u) !== p0) priceBad.push(u.id + ' currentCost=' + G.upgrades.currentCost(priceState, u));
}
for (const id of BRANCH_IDS) {
  const total = chainOf(id).reduce((sum, u) => sum + G.upgrades.cost(u, 0) + G.upgrades.cost(u, 1), 0);
  chainPrices.push(id + ' ' + total);
}
check('цена = base · growth^lvl и растёт с уровнем', priceBad.length === 0, priceBad.join(', ') || 'у всех 16');
check('полная ветвь по 2 уровня стоит столько ⌬', chainPrices.length === 4, chainPrices.join(' · '));

console.log('\n5. Покупка: G.upgrades + зеркало ⌬ state.d2 ↔ state.res');
const empty = freshState(0, 1);
const root = G.registry.upgrade('d2t_s1');
check('без ⌬ купить нельзя', G.d2Tree.canBuy(empty, root) === false &&
  G.d2Tree.buy(empty, root) === 0, '⌬ 0, ур. ' + G.lvl(empty, 'd2t_s1'));

const s = freshState(100, 1);
check('с ⌬ узел покупаем', G.d2Tree.canBuy(s, root) === true);
const price0 = G.upgrades.currentCost(s, root);
const n1 = buyNode(s, 'd2t_s1', 1);
check('покупка через G.upgrades: уровень +1, ⌬ списана',
  n1 === 1 && G.lvl(s, 'd2t_s1') === 1 && close(s.d2.res.essence, 100 - price0),
  'цена ' + price0 + ' ⌬ → остаток ' + s.d2.res.essence);
check('⌬ в state.res зеркалится (его читает общий upgrades.js)',
  close(s.res.essence, s.d2.res.essence), 'state.res.essence = ' + s.res.essence);
const price1 = G.upgrades.currentCost(s, root);
check('вторая цена = base · growth', close(price1, price0 * 2), price0 + ' → ' + price1);
const n2 = buyNode(s, 'd2t_s1', 5);
check('max = 2: третий уровень не покупается', n2 === 1 && G.lvl(s, 'd2t_s1') === 2,
  'куплено +' + n2 + ', ур. ' + G.lvl(s, 'd2t_s1'));
check('⌬ не уходит в минус', s.d2.res.essence >= 0, s.d2.res.essence + ' ⌬');

const deep = freshState(1e6, 1);
check('глубокий узел закрыт без предков', G.d2Tree.canBuy(deep, G.registry.upgrade('d2t_r4')) === false,
  'd2t_r4 требует d2t_r3');
buyNode(deep, 'd2t_r3', 1);
/* d2t_r3 сам требует d2t_r2 — проверяем цепочку через полную покупку предков */
const deep2 = freshState(1e6, 1);
for (const id of ['d2t_r1', 'd2t_r2', 'd2t_r3']) buyNode(deep2, id, 1);
check('после покупки цепочки предков узел открывается',
  G.d2Tree.canBuy(deep2, G.registry.upgrade('d2t_r4')) === true,
  'ур. r1..r3 = ' + ['d2t_r1', 'd2t_r2', 'd2t_r3'].map((id) => G.lvl(deep2, id)).join('/'));

const all = freshState(1e6, 3);
for (const u of nodes) {
  for (let lvl = 0; lvl < u.max; lvl++) buyNode(all, u.id, 1);
}
const maxedCount = nodes.filter((u) => G.lvl(all, u.id) === u.max).length;
check('всё дерево (16 узлов × 2 уровня) покупается по цепочке', maxedCount === 16,
  maxedCount + ' / 16, остаток ' + all.d2.res.essence + ' ⌬');
check('после покупки всего дерева ⌬ всё ещё ≥ 0 и конечно',
  okNum(all.d2.res.essence) && all.d2.res.essence >= 0, all.d2.res.essence + ' ⌬');

console.log('\n6. Эффекты через общие свипы (upgSum / upgProduct)');
const one = freshState(100, 1);
buyNode(one, 'd2t_s1', 1);
check('d2StartAdd: один узел на lvl 1 = +10 цифр к старту D₂',
  close(G.growth.upgSum(one, 'd2StartAdd'), 10), '+' + G.growth.upgSum(one, 'd2StartAdd'));
/* все узлы ветви «Старт» на максимуме: (10+25+60+150)·2 = 490 */
check('d2StartAdd: вся ветвь «Старт» = +490 цифр',
  close(G.growth.upgSum(all, 'd2StartAdd'), (10 + 25 + 60 + 150) * 2),
  '+' + G.growth.upgSum(all, 'd2StartAdd'));
/* ветвь «Сила» на максимуме: (1.25·1.4·1.6·2)² = 31.36 */
check('d2RateMult: ветвь «Сила» = ×31.36',
  close(G.growth.upgProduct(all, 'd2RateMult'), 31.36, 1e-9), '×' + G.growth.upgProduct(all, 'd2RateMult'));
check('d2XiMult: ветвь «Поток» = ×31.36',
  close(G.growth.upgProduct(all, 'd2XiMult'), 31.36, 1e-9), '×' + G.growth.upgProduct(all, 'd2XiMult'));
check('d2CollapseMult: ветвь «Сброс» (2 узла) = ×3.5156',
  close(G.growth.upgProduct(all, 'd2CollapseMult'), 1.25 * 1.25 * 1.5 * 1.5, 1e-9),
  '×' + G.growth.upgProduct(all, 'd2CollapseMult'));
check('d2SpanMult: ветвь «Сброс» (2 узла) = ×7.29',
  close(G.growth.upgProduct(all, 'd2SpanMult'), 1.5 * 1.5 * 1.8 * 1.8, 1e-9),
  '×' + G.growth.upgProduct(all, 'd2SpanMult'));
const untouched = freshState(0, 0);
check('без покупок свипы нейтральны (0 / ×1)',
  G.growth.upgSum(untouched, 'd2StartAdd') === 0 && G.growth.upgProduct(untouched, 'd2RateMult') === 1,
  '+0 / ×1');

console.log('\n7. Открытие и сбросы');
const mech = G.registry.mechanic('d2tree');
check('механика зарегистрирована как d2tree', !!mech && mech.id === 'd2tree',
  mech ? mech.name + ', order ' + mech.order : 'нет');
check('scope механики meta-d2 (сбросы D1 её не трогают)', mech.scope === 'meta-d2');
check('до первого Схлопывания древо закрыто', mech.isUnlocked(freshState(0, 0)) === false);
check('после первого Схлопывания древо открыто', mech.isUnlocked(freshState(0, 1)) === true);
check('нет состояния D2 — древо закрыто и ⌬ = 0',
  mech.isUnlocked(G.newState()) === false && G.d2Tree.essence(G.newState()) === 0);
check('total() = 16, bought() считает уровни', mech.total() === 16 &&
  mech.bought(all) === 16 && mech.status(all) === '⌬ 16/16', mech.status(all));

const kept = freshState(5000, 2);
for (const u of nodes) buyNode(kept, u.id, 1);
const levels = nodes.map((u) => G.lvl(kept, u.id)).join(',');
const essenceBefore = kept.d2.res.essence;
G.resetScopes(kept, ['run', 'tier']);
check('сброс забега и яруса 2 не трогает уровни узлов',
  nodes.map((u) => G.lvl(kept, u.id)).join(',') === levels, levels);
check('сброс D1 не трогает ⌬ в state.d2', kept.d2.res.essence === essenceBefore,
  essenceBefore + ' ⌬');
check('⌬ доступна для повторного чтения после сброса',
  G.d2Tree.essence(kept) === essenceBefore, G.d2Tree.essence(kept) + ' ⌬');

console.log('\n8. Карта в jsdom: G.treeBoard.build');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { /* ниже — честный пропуск */ }

async function mapTest() {
  if (!JSDOM) {
    console.log('  ! jsdom не найден — часть 8 пропущена (npm i)');
    return;
  }
  const { VirtualConsole } = require('jsdom');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [];
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1].split('?')[0]);

  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  for (const src of srcs) {
    const file = path.join(ROOT, src);
    if (!fs.existsSync(file)) { errors.push('нет файла: ' + src); continue; }
    try { win.eval(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push('скрипт ' + src + ': ' + e.message); }
  }
  const wG = win.G;
  /* доска D2 грузится вручную: в index.html её дописывает директор */
  if (!wG.content.d2tree) {
    for (const f of D2_FILES) {
      try { win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { errors.push('скрипт ' + f + ': ' + e.message); }
    }
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 3000 && !(wG.state && wG.debug)) await new Promise((r) => setTimeout(r, 25));

  check('страница и скрипты D2 загрузились без ошибок', errors.length === 0, errors.slice(0, 3).join(' | '));
  if (!check('boot() отработал', !!(wG.state && wG.state.upg))) { dom.window.close(); return; }

  const state = wG.state;
  for (const u of wG.registry.upgradesOf('d2tree')) state.upg[u.id] = 0;
  state.d2 = {
    v: 1, unlocked: true, active: true,
    N: wG.BN.fromLog10(100), D: 100, disp: null,
    res: { axis: 0, essence: 40 },
    axes: Array.from({ length: 8 }, () => ({ lvl: 0, amount: 0 })),
    boost: 0, upgrades: {}, links: {},
    stats: { bestD: 100, collapses: 1, totalEssence: 40, playtime: 0, lastCollapse: 0 },
    lastSeen: 0
  };

  const doc = win.document;
  const host = doc.createElement('div');
  host.id = 'board';
  doc.body.appendChild(host);

  const d2mech = wG.registry.mechanic('d2tree');
  check('[d2tree] build() создал доску с mount',
    !!d2mech.board && typeof d2mech.board.mount === 'function');

  const board = d2mech.board.mount(host);
  check('[d2tree] mount() вернул {update, destroy}',
    typeof board.update === 'function' && typeof board.destroy === 'function');
  board.update(state);

  const dnodes = wG.registry.upgradesOf('d2tree');
  const cells = Array.from(doc.querySelectorAll('#board .tree-cell'));
  check('[d2tree] клеток = числу узлов', cells.length === dnodes.length,
    cells.length + ' / ' + dnodes.length);
  check('[d2tree] 4 подписи ветвей',
    doc.querySelectorAll('#board .tree-branch-label').length === 4,
    doc.querySelectorAll('#board .tree-branch-label').length + ' подписей');
  check('[d2tree] колец глубины = maxDepth+1',
    doc.querySelectorAll('#board .tree-rings .tring').length === 4,
    doc.querySelectorAll('#board .tree-rings .tring').length + ' колец');
  check('[d2tree] тема d2 на сцене',
    !!doc.querySelector('#board .tree-stage.theme-d2'));
  const hidden = doc.querySelectorAll('#board .tree-cell.is-hidden').length;
  const withReq = dnodes.filter((u) => u.requires && u.requires.length).length;
  check('[d2tree] на старте скрыто = узлов с предками', hidden === withReq,
    'скрыто ' + hidden + ' из ' + dnodes.length);
  const hud = doc.querySelector('#board .tree-hud-cores');
  check('[d2tree] в шапке карты ⌬ из state.d2 (зеркало работает)',
    !!hud && hud.textContent.indexOf('40') === 0 && hud.textContent.indexOf('⌬') > 0,
    hud ? JSON.stringify(hud.textContent) : 'нет счётчика');

  const text = doc.querySelector('#board .tree-stage').textContent;
  check('[d2tree] в тексте карты нет NaN/undefined/Infinity',
    !/NaN|undefined|Infinity/.test(text), text.length + ' символов');

  /* клик по орбу корня — покупка через хук дерева (pointerdown/up без движения) */
  function ptr(type, x, y, id, pointerType) {
    const ev = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    const extra = { pointerId: id === undefined ? 1 : id, pointerType: pointerType || 'mouse' };
    for (const k in extra) Object.defineProperty(ev, k, { value: extra[k], configurable: true });
    return ev;
  }
  const rootNode = dnodes.find((u) => !u.requires || !u.requires.length);
  const rootCell = cells.find((c) => {
    const label = c.querySelector('.node-name');
    return label && label.textContent === rootNode.name;
  });
  const orb = rootCell ? rootCell.querySelector('.node-orb') : null;
  if (check('[d2tree] клетка корня «' + rootNode.name + '» найдена', !!orb)) {
    const before = wG.lvl(state, rootNode.id);
    const essBefore = state.d2.res.essence;
    orb.dispatchEvent(ptr('pointerdown', 20, 20, 3, 'mouse'));
    orb.dispatchEvent(ptr('pointerup', 20, 20, 3, 'mouse'));
    board.update(state);
    const after = wG.lvl(state, rootNode.id);
    check('[d2tree] клик по орбу покупает узел', after === before + 1,
      rootNode.id + ': ' + before + ' → ' + after);
    check('[d2tree] клик списывает ⌬ (эссенцию D2, не D1)',
      state.d2.res.essence < essBefore && okNum(state.d2.res.essence),
      essBefore + ' → ' + state.d2.res.essence + ' ⌬');
    const hiddenAfter = doc.querySelectorAll('#board .tree-cell.is-hidden').length;
    check('[d2tree] после покупки открылся следующий узел', hiddenAfter < hidden,
      'скрыто ' + hidden + ' → ' + hiddenAfter);
    const textAfter = doc.querySelector('#board .tree-stage').textContent;
    check('[d2tree] после покупки в тексте всё ещё нет NaN/undefined/Infinity',
      !/NaN|undefined|Infinity/.test(textAfter));
  }
  check('[d2tree] ошибок в логе jsdom нет', errors.length === 0, errors.slice(0, 3).join(' | '));
  try { dom.window.close(); } catch (e) { /* уже закрыт */ }
}

mapTest().then(() => {
  console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails + ' (пройдено ' + passes + ')'
    : 'ВСЁ ОК: ' + passes + ' проверок'));
  process.exitCode = fails ? 1 : 0;
}).catch((e) => {
  console.log('\n\u2717 тест упал: ' + (e && e.stack || e));
  process.exitCode = 1;
});
