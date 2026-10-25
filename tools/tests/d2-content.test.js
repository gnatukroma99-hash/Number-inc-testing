/* tools/tests/d2-content.test.js — данные «Измерения 2» (ТЗ docs/DIMENSION2.md §5.2).
   Запуск:  node tools/tests/d2-content.test.js
   Что проверяет:
     1) G.content.d2 есть и объявляет гейт (turns);
     2) 8 осей: уникальные id, idx 1..8 подряд, цены/росты/max/baseRate конечные,
        цена растёт с уровнем (baseCost * costGrowth ** lvl) на всём диапазоне 0..max,
        unlockD не убывает и строго возрастает (первая ось — с 0);
     3) boost и collapse: числа конечные, gainFormula/startFormula дают конечный
        положительный результат и не содержат запрещённого знака ^ (в JS это XOR);
     4) upgrades (6) и links (4): уникальные id (и между собой), base/growth/max конечные,
        валюта essence, цена на максимальном уровне конечна;
     5) группа 'd2' в content/groups.js существует, world === 'd2', 4 уникальные доски,
        группы D1 не тронуты (нет world:'d2' и их состав прежний).

   DOM не нужен: src/content/d2.js и src/content/groups.js — чистые данные,
   считаются в vm-песочнице, формула проверяется настоящим src/core/formula.js. */
'use strict';
require('../_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/* ---------- микро-отчёт ---------- */
let fails = 0;
const ok = (n, e) => console.log('  \u2713 ' + n + (e ? '  — ' + e : ''));
const bad = (n, e) => { fails++; console.log('  \u2717 ' + n + (e ? '  — ' + e : '')); };
const check = (n, cond, e) => { (cond ? ok : bad)(n, e); return cond; };
const section = (t) => console.log('\n' + t);

/* ---------- песочница: только core/formula.js + content/d2.js + content/groups.js ---------- */
const formulaErrors = [];
function boot() {
  const sandbox = {
    window: {},
    console: { log() {}, error(...a) { formulaErrors.push(a.join(' ')); }, warn() {} }
  };
  vm.createContext(sandbox);
  const load = (rel) =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  load('src/core/formula.js');
  load('src/content/d2.js');
  load('src/content/groups.js');
  return sandbox.window.G;
}

const G = boot();
const D2 = G.content.d2;
const GROUP_IDS = ['run', 'meta', 'tier2', 'tier3', 'tier4'];

const finite = (x) => typeof x === 'number' && isFinite(x);
const FORMULA_KEYS = ['formula', 'costFormula', 'gainFormula', 'startFormula'];

/* собираем ВСЕ строки-формулы из данных D2 — чтобы проверка не зависела от перечня полей */
function formulaStrings(root) {
  const out = [];
  const walk = (node, at) => {
    if (!node || typeof node !== 'object') return;
    for (const k in node) {
      const v = node[k];
      const where = at ? at + '.' + k : k;
      if (typeof v === 'string' && FORMULA_KEYS.indexOf(k) >= 0) out.push({ key: where, src: v });
      else walk(v, where);
    }
  };
  walk(root, '');
  return out;
}

/* ---------- 1. корень ---------- */
section('1. G.content.d2');
{
  check('G.content.d2 объявлен', !!D2 && typeof D2 === 'object');
  check("id === 'd2'", D2 && D2.id === 'd2', D2 && D2.id);
  check('gate.turns — конечное число > 0',
    !!D2 && !!D2.gate && finite(D2.gate.turns) && D2.gate.turns > 0,
    D2 && D2.gate && String(D2.gate.turns));
}

/* ---------- 2. 8 осей ---------- */
section('2. Оси (8)');
{
  const axes = (D2 && D2.axes) || [];
  check('осей ровно 8', axes.length === 8, 'сейчас ' + axes.length);

  const ids = axes.map((a) => a.id);
  check('id осей уникальны', new Set(ids).size === ids.length, ids.join(','));
  check('id непустые строки', ids.every((id) => typeof id === 'string' && id.length > 0));

  const idxOk = axes.every((a, i) => a.idx === i + 1);
  check('idx идёт подряд 1..8', idxOk, axes.map((a) => a.idx).join(','));

  check('у каждой оси есть name/short/icon', axes.every((a) =>
    typeof a.name === 'string' && a.name && typeof a.short === 'string' && a.short &&
    typeof a.icon === 'string' && a.icon));

  const badMeta = axes.filter((a) =>
    !finite(a.baseCost) || !(a.baseCost > 0) ||
    !finite(a.costGrowth) || !(a.costGrowth > 1) ||
    !finite(a.max) || !(a.max > 0) || Math.floor(a.max) !== a.max ||
    !finite(a.baseRate) || !(a.baseRate > 0) ||
    !finite(a.unlockD) || a.unlockD < 0);
  check('цены/росты/max/baseRate/unlockD конечные и положительные',
    badMeta.length === 0, badMeta.map((a) => a.id).join(','));

  /* цена на всём диапазоне уровней: конечна и строго растёт */
  let priceBad = [];
  for (const a of axes) {
    let prev = 0;
    for (let lvl = 0; lvl <= a.max; lvl++) {
      const cost = a.baseCost * Math.pow(a.costGrowth, lvl);
      if (!finite(cost) || !(cost > 0) || !(cost > prev)) { priceBad.push(a.id + '@' + lvl); break; }
      prev = cost;
    }
  }
  check('цена оси растёт и конечна на 0..max', priceBad.length === 0, priceBad.join(','));

  /* unlockD: не убывает и строго возрастает (первая ось — с нуля) */
  const unlock = axes.map((a) => a.unlockD);
  check('unlockD[0] === 0', unlock[0] === 0, String(unlock[0]));
  let unlockBad = [];
  for (let i = 1; i < unlock.length; i++) if (!(unlock[i] > unlock[i - 1])) unlockBad.push(i);
  check('unlockD строго возрастает', unlockBad.length === 0, unlock.join(','));

  /* базовая скорость: суммарный «вес» осей падает — поздние оси не дублируют первые */
  const rates = axes.map((a) => a.baseRate);
  check('baseRate падает с номером оси (ось 1 — самая быстрая)',
    rates.every((r, i) => i === 0 || r < rates[i - 1]), rates.join(','));
}

/* ---------- 3. Boost и Схлопывание ---------- */
section('3. Boost и Схлопывание');
{
  const b = (D2 && D2.boost) || {};
  check('boost.base/growth/max конечные',
    finite(b.base) && b.base > 0 && finite(b.growth) && b.growth > 1 &&
    finite(b.max) && b.max > 0 && Math.floor(b.max) === b.max,
    JSON.stringify(b));
  check('цена Boost на максимуме конечна',
    finite(b.base * Math.pow(b.growth, b.max)), String(b.base * Math.pow(b.growth, b.max)));

  const c = (D2 && D2.collapse) || {};
  check('collapse.minD конечный и > 0', finite(c.minD) && c.minD > 0, String(c.minD));

  const fStrings = formulaStrings(D2);
  check('формулы найдены (' + FORMULA_KEYS.join('/') + ')', fStrings.length >= 2,
    fStrings.map((f) => f.key).join(','));
  check('в формулах нет знака ^ (в JS это XOR)',
    fStrings.every((f) => f.src.indexOf('^') < 0),
    fStrings.filter((f) => f.src.indexOf('^') >= 0).map((f) => f.key).join(','));

  /* gainFormula: считается через настоящий G.formula, не подменяется нулём */
  const gainAt = (D, collapses) => G.formula(c.gainFormula, { D: D, collapses: collapses });
  const g0 = gainAt(c.minD, 0);
  const g1 = gainAt(c.minD + 10, 0);
  const g2 = gainAt(c.minD + 100, 0);
  check('гарантированный ⌬ при D₂ = minD — 1', g0 === 1, String(g0));
  check('⌬ выше minD положителен', finite(g1) && g1 > 0, String(g1));
  check('⌬ растёт с D₂', finite(g2) && g2 > g1, g1 + ' → ' + g2);
  check('⌬ не NaN при большом D₂', finite(gainAt(1e6, 100)),
    String(gainAt(1e6, 100)));

  /* startFormula: переменные essence / lvlLinkStart / lvlStart из ТЗ §6 */
  const startAt = (essence, lvlLinkStart, lvlStart) =>
    G.formula(c.startFormula, { essence: essence, lvlLinkStart: lvlLinkStart, lvlStart: lvlStart });
  const s0 = startAt(0, 0, 0);
  const s1 = startAt(3, 1, 2);
  check('старт D₂ без ⌬ — положительный и конечный', finite(s0) && s0 > 0, String(s0));
  check('старт D₂ растёт от ⌬ и уровней', finite(s1) && s1 > s0, s0 + ' → ' + s1);
  check('старт D₂ не выше 1e300 даже на максимумах',
    startAt(1e6, 5, 10) <= 1e300, String(startAt(1e6, 5, 10)));

  check('G.formula не ругался в console.error', formulaErrors.length === 0,
    formulaErrors.slice(0, 3).join(' | '));
}

/* ---------- 4. Апгрейды и связи ---------- */
section('4. Апгрейды (6) и связи (4)');
{
  const upgrades = (D2 && D2.upgrades) || [];
  const links = (D2 && D2.links) || [];
  check('апгрейдов ровно 6', upgrades.length === 6, 'сейчас ' + upgrades.length);
  check('связей ровно 4', links.length === 4, 'сейчас ' + links.length);

  const all = upgrades.concat(links);
  const ids = all.map((u) => u.id);
  check('id апгрейдов+связей уникальны', new Set(ids).size === ids.length,
    ids.filter((id, i) => ids.indexOf(id) !== i).join(','));
  check('id непустые строки', ids.every((id) => typeof id === 'string' && id.length > 0));
  check('у всех есть name и desc', all.every((u) =>
    typeof u.name === 'string' && u.name && typeof u.desc === 'string' && u.desc));
  check("все покупки за essence (⌬)", all.every((u) => u.res === 'essence'));

  const badNum = all.filter((u) =>
    !finite(u.base) || !(u.base > 0) ||
    !finite(u.growth) || !(u.growth > 1) ||
    !finite(u.max) || !(u.max > 0) || Math.floor(u.max) !== u.max);
  check('base/growth/max конечные и положительные', badNum.length === 0,
    badNum.map((u) => u.id).join(','));

  const badCost = all.filter((u) => !finite(u.base * Math.pow(u.growth, u.max)));
  check('цена на максимальном уровне конечна', badCost.length === 0,
    badCost.map((u) => u.id).join(','));
}

/* ---------- 5. Группа d2 ---------- */
section("5. Группа 'd2' в content/groups.js");
{
  const groups = G.content.groups || [];
  const d2 = groups.filter((g) => g.id === 'd2');
  check("группа 'd2' ровно одна", d2.length === 1, 'сейчас ' + d2.length);
  const g = d2[0] || {};
  check("name === 'Измерение 2'", g.name === 'Измерение 2', String(g.name));
  check("world === 'd2'", g.world === 'd2', String(g.world));
  check('цвет задан', typeof g.color === 'string' && /^#[0-9a-f]{6}$/i.test(g.color), String(g.color));

  const mechs = g.mechs || [];
  check('в группе 4 доски', mechs.length === 4, mechs.join(','));
  check('доски группы уникальны', new Set(mechs).size === mechs.length, mechs.join(','));
  check('доски группы — d2axes/d2collapse/d2links/d2tree',
    ['d2axes', 'd2collapse', 'd2links', 'd2tree'].every((id) => mechs.indexOf(id) >= 0), mechs.join(','));
  check("группа 'd2' стоит последней (D1-группы не переставлены)",
    groups[groups.length - 1].id === 'd2', groups.map((x) => x.id).join(','));

  const d1 = groups.filter((x) => GROUP_IDS.indexOf(x.id) >= 0);
  check('все 5 групп D1 на месте', d1.length === 5, d1.map((x) => x.id).join(','));
  check("у групп D1 нет world: 'd2'", d1.every((x) => x.world !== 'd2'),
    d1.filter((x) => x.world === 'd2').map((x) => x.id).join(','));
  const d2mechs = new Set(mechs);
  check('доски D2 не попали в группы D1',
    d1.every((x) => (x.mechs || []).every((id) => !d2mechs.has(id))),
    d1.map((x) => x.mechs.filter((id) => d2mechs.has(id)).join('/')).filter(Boolean).join(','));
}

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
process.exitCode = fails ? 1 : 0;
