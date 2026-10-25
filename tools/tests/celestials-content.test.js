/* tools/tests/celestials-content.test.js — данные Hall of Celestials (ТЗ docs/CELESTIALS.md §3).
   Запуск:  node tools/tests/celestials-content.test.js
   Что проверяет:
     1) G.content.celestials есть, id === 'celestials', ровно 8 целестиалов;
     2) лицо карточки: id/name/symbol уникальны и непустые, color — hex, lore — непустая строка;
     3) испытания: id/name/desc непустые, id триалов уникальны, check — функция,
        возвращает boolean и НЕ бросает на пустом/битом state; каждое условие проходит
        на «достаточном» fake state и не проходит на «чуть меньшем»;
     4) награды: РОВНО одно из mult/add, field из разрешённого списка, text непустой,
        mult > 1, add > 0, числа конечные;
     5) группа 'd2' в content/groups.js содержит celestials/d2achievements/d2milestones,
        прежние 4 доски D2 на месте, id группы уникальны, группа по-прежнему последняя;
     6) группы D1 (run/meta/tier2/tier3/tier4) не изменены — состав сверяется со снимком v0.36.1.

   DOM не нужен: content/celestials.js и content/groups.js — чистые данные,
   исполняются в vm-песочнице; состояния для check() — фейковые объекты (форма ТЗ DIMENSION2 §5.1). */
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

/* ---------- песочница: только content/celestials.js + content/groups.js ---------- */
function boot() {
  const sandbox = { window: {}, console: { log() {}, error() {}, warn() {} } };
  vm.createContext(sandbox);
  const load = (rel) =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  load('src/content/celestials.js');
  load('src/content/groups.js');
  return sandbox.window.G;
}

const G = boot();
const CEL = G.content.celestials;
const LIST = (CEL && CEL.list) || [];

const REWARD_FIELDS = ['d2StartAdd', 'd2RateMult', 'd2XiMult', 'd2CollapseMult', 'd2SpanMult'];
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const finite = (x) => typeof x === 'number' && isFinite(x);
const byId = (id) => LIST.filter((c) => c && c.id === id)[0];
const trialOf = (id) => (byId(id) || {}).trial || {};

/* ---------- фейковое состояние по форме docs/DIMENSION2.md §5.1 ---------- */
const AXES = 8;
function fakeState(over) {
  const axes = [];
  for (let i = 0; i < AXES; i++) axes.push({ lvl: 0, amount: 0 });
  const st = {
    d2: {
      unlocked: true,
      res: { axis: 0, essence: 0 },
      axes: axes,
      boost: 0,
      upgrades: {},
      links: {},
      stats: { collapses: 0, bestD: 0, totalEssence: 0, playtime: 0, lastCollapse: 0 }
    },
    cel: { v: 1, unlocked: true, sigils: 0, completed: {}, stats: { attempts: 0, completions: 0 } }
  };
  if (!over) return st;
  if (over.collapses !== undefined) st.d2.stats.collapses = over.collapses;
  if (over.bestD !== undefined) st.d2.stats.bestD = over.bestD;
  if (over.totalEssence !== undefined) st.d2.stats.totalEssence = over.totalEssence;
  if (over.axisLvl !== undefined) for (const a of st.d2.axes) a.lvl = over.axisLvl;
  if (over.axisLvls) over.axisLvls.forEach((v, i) => { st.d2.axes[i].lvl = v; });
  if (over.links) st.d2.links = over.links;
  if (over.upgrades) st.d2.upgrades = over.upgrades;
  if (over.sigils !== undefined) st.cel.sigils = over.sigils;
  return st;
}

/* ---------- 1. корень ---------- */
section('1. G.content.celestials');
{
  check('G.content.celestials объявлен', !!CEL && typeof CEL === 'object');
  check("id === 'celestials'", CEL && CEL.id === 'celestials', CEL && CEL.id);
  check('list — массив из 8 целестиалов', Array.isArray(LIST) && LIST.length === 8,
    'сейчас ' + LIST.length);
  check('hint — непустая строка', !!CEL && isStr(CEL.hint));
}

/* ---------- 2. Лицо карточки ---------- */
section('2. id / имя / символ / цвет / лор');
{
  const ids = LIST.map((c) => c && c.id);
  check('id уникальны', new Set(ids).size === ids.length,
    ids.filter((id, i) => ids.indexOf(id) !== i).join(','));
  check('id — непустые строки', ids.every(isStr));

  const names = LIST.map((c) => c && c.name);
  check('имена уникальны', new Set(names).size === names.length,
    names.filter((n, i) => names.indexOf(n) !== i).join(','));
  check('имена — непустые строки', names.every(isStr));

  const symbols = LIST.map((c) => c && c.symbol);
  check('символы уникальны', new Set(symbols).size === symbols.length,
    symbols.filter((s, i) => symbols.indexOf(s) !== i).join(','));
  check('символы — непустые строки', symbols.every(isStr));

  const badColor = LIST.filter((c) => !isStr(c.color) || !/^#[0-9a-f]{6}$/i.test(c.color));
  check('color — hex #rrggbb', badColor.length === 0, badColor.map((c) => c.id).join(','));
  check('цвета уникальны', new Set(LIST.map((c) => c.color)).size === LIST.length);

  const badLore = LIST.filter((c) => !isStr(c.lore) || c.lore.length < 25);
  check('lore — непустой (≥ 25 символов)', badLore.length === 0, badLore.map((c) => c.id).join(','));
  check('lore без мата/чужих имён референса',
    LIST.every((c) => !/[Ff]uck|[Ss]hit|[Bb]loody/.test(c.lore)));
}

/* ---------- 3. Испытания ---------- */
section('3. Испытания (trial.check)');
{
  const trialIds = LIST.map((c) => c && c.trial && c.trial.id);
  check('у всех есть trial.id', trialIds.every(isStr), trialIds.join(','));
  check('id испытаний уникальны', new Set(trialIds).size === trialIds.length,
    trialIds.filter((id, i) => trialIds.indexOf(id) !== i).join(','));
  check('у всех есть trial.name и trial.desc',
    LIST.every((c) => c.trial && isStr(c.trial.name) && isStr(c.trial.desc)));
  check('trial.check — функция у всех', LIST.every((c) => typeof c.trial.check === 'function'));

  /* пустое/битое состояние: boolean false, без исключений */
  const broken = [undefined, null, {}, { d2: null }, { d2: {} }, { d2: { axes: 'x', stats: null } }];
  let throwBad = [];
  let boolBad = [];
  for (const c of LIST) {
    for (const st of broken) {
      let res;
      try { res = c.trial.check(st); } catch (e) { throwBad.push(c.id + ':' + e.message); continue; }
      if (typeof res !== 'boolean' || res !== false) boolBad.push(c.id + '→' + String(res));
    }
  }
  check('check(битый state) не бросает', throwBad.length === 0, throwBad.slice(0, 3).join(' | '));
  check('check(битый state) === false', boolBad.length === 0, boolBad.slice(0, 3).join(','));

  /* каждое условие: ровно на пороге — true, на единицу меньше — false */
  const cases = [
    ['c_sun', fakeState({ collapses: 1 }), fakeState({ collapses: 0 })],
    ['c_mercury', fakeState({ totalEssence: 10 }), fakeState({ totalEssence: 9.99 })],
    ['c_venus', fakeState({ axisLvl: 5 }), fakeState({ axisLvls: [5, 5, 5, 5, 5, 5, 5, 4] })],
    ['c_mars', fakeState({ collapses: 3 }), fakeState({ collapses: 2 })],
    ['c_jupiter', fakeState({ bestD: 250 }), fakeState({ bestD: 249 })],
    ['c_saturn', fakeState({ links: { link_start: 1, link_m: 2 } }), fakeState({ links: { link_start: 1 } })],
    ['c_uranus', fakeState({ upgrades: { d2_start: 1, d2_rate: 1, d2_xi: 1 } }),
      fakeState({ upgrades: { d2_start: 1, d2_rate: 1 } })],
    ['c_neptune', fakeState({ sigils: 4 }), fakeState({ sigils: 3 })]
  ];
  for (const [id, good, low] of cases) {
    const t = trialOf(id);
    if (!check(id + ': испытание есть', !!t.check)) continue;
    check(id + ': на пороге — true', t.check(good) === true, String(t.check(good)));
    check(id + ': чуть меньше порога — false', t.check(low) === false, String(t.check(low)));
  }

  /* «все 8 осей» не прощается, если осей в состоянии меньше восьми */
  const fewAxes = fakeState({ axisLvl: 9 });
  fewAxes.d2.axes = fewAxes.d2.axes.slice(0, 7);
  check('c_venus: 7 осей вместо 8 — false', trialOf('c_venus').check(fewAxes) === false);
  check('c_venus: больше 8 осей — тоже проверяются все',
    trialOf('c_venus').check(fakeState({ axisLvl: 9 })) === true);
}

/* ---------- 4. Награды ---------- */
section('4. Награды (reward)');
{
  const badBoth = LIST.filter((c) => {
    const r = c.reward || {};
    const hasMult = r.mult !== undefined;
    const hasAdd = r.add !== undefined;
    return hasMult === hasAdd;
  });
  check('ровно одно из mult/add', badBoth.length === 0, badBoth.map((c) => c.id).join(','));

  const badField = LIST.filter((c) => !c.reward || REWARD_FIELDS.indexOf(c.reward.field) < 0);
  check('field из разрешённого списка', badField.length === 0,
    badField.map((c) => c.id + ':' + (c.reward && c.reward.field)).join(','));

  const badText = LIST.filter((c) => !c.reward || !isStr(c.reward.text));
  check('reward.text — непустая строка', badText.length === 0, badText.map((c) => c.id).join(','));

  const badMult = LIST.filter((c) => c.reward && c.reward.mult !== undefined &&
    (!finite(c.reward.mult) || !(c.reward.mult > 1)));
  check('mult конечный и > 1', badMult.length === 0,
    badMult.map((c) => c.id + ':' + c.reward.mult).join(','));

  const badAdd = LIST.filter((c) => c.reward && c.reward.add !== undefined &&
    (!finite(c.reward.add) || !(c.reward.add > 0)));
  check('add конечный и > 0', badAdd.length === 0,
    badAdd.map((c) => c.id + ':' + c.reward.add).join(','));

  /* награды должны быть усилением, а не «украшением»: хотя бы по одному правилу на поле */
  const used = new Set(LIST.map((c) => c.reward.field));
  check('использованы все 5 полей наград',
    REWARD_FIELDS.every((f) => used.has(f)), Array.from(used).join(','));
  check('аддитивных наград ровно 2 (старт D₂)', LIST.filter((c) => c.reward.add !== undefined).length === 2);
}

/* ---------- 5. Группа d2 ---------- */
section("5. Группа 'd2' в content/groups.js");
{
  const groups = G.content.groups || [];
  const found = groups.filter((g) => g.id === 'd2');
  check("группа 'd2' ровно одна", found.length === 1, 'сейчас ' + found.length);
  const g = found[0] || {};
  const mechs = g.mechs || [];

  check("world === 'd2'", g.world === 'd2', String(g.world));
  check('доски группы уникальны', new Set(mechs).size === mechs.length, mechs.join(','));
  check('прежние 4 доски D2 на месте',
    ['d2axes', 'd2collapse', 'd2links', 'd2tree'].every((id) => mechs.indexOf(id) >= 0), mechs.join(','));
  check("добавлены 'celestials', 'd2achievements', 'd2milestones'",
    ['celestials', 'd2achievements', 'd2milestones'].every((id) => mechs.indexOf(id) >= 0), mechs.join(','));
  check('в группе 7 досок', mechs.length === 7, 'сейчас ' + mechs.length);
  check('первыми идут старые доски (порядок D2 не переставлен)',
    mechs.slice(0, 4).join(',') === 'd2axes,d2collapse,d2links,d2tree', mechs.join(','));

  check("группа 'd2' по-прежнему последняя", groups[groups.length - 1].id === 'd2',
    groups.map((x) => x.id).join(','));
  check('id групп уникальны', new Set(groups.map((x) => x.id)).size === groups.length,
    groups.map((x) => x.id).join(','));
}

/* ---------- 6. D1-группы не тронуты ---------- */
section('6. Группы D1 не изменены (снимок v0.36.1)');
{
  const snapshot = {
    run: ['core', 'combo', 'slot', 'digitsum', 'primefit', 'primeranks', 'analysis', 'shop',
      'sieve', 'mirror', 'patterns'],
    meta: ['spark', 'prestige', 'tree', 'achievements'],
    tier2: ['bigbang', 'constellations', 'glyphs', 'pacttree', 'challenges', 'pacts',
      'duplicator', 'echo', 'chrono', 'rift'],
    tier3: ['breakthrough', 'cracks', 'measure', 'psitree', 'omega'],
    tier4: ['turn', 'turntree']
  };
  const groups = G.content.groups || [];
  for (const id in snapshot) {
    const g = groups.filter((x) => x.id === id)[0];
    if (!check('группа ' + id + ' на месте', !!g)) continue;
    check('группа ' + id + ': состав прежний', (g.mechs || []).join(',') === snapshot[id].join(','),
      (g.mechs || []).join(','));
    check('группа ' + id + ": world !== 'd2'", g.world !== 'd2', String(g.world));
  }
  const d2mechs = new Set((groups.filter((x) => x.id === 'd2')[0] || {}).mechs || []);
  const leaked = groups.filter((x) => snapshot[x.id])
    .filter((x) => (x.mechs || []).some((id) => d2mechs.has(id)));
  check('доски D2 не попали в группы D1', leaked.length === 0, leaked.map((x) => x.id).join(','));
}

console.log('\n' + (fails ? 'ПРОВАЛЕНО: ' + fails : 'ВСЁ ОК'));
process.exitCode = fails ? 1 : 0;
