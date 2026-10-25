/* tools/checkcontent.js — линтер ГРАФА КОНТЕНТА (синтаксис проверяет checkall).
   Запуск:  node tools/checkcontent.js [корень_проекта]
   Грузит скрипты из index.html так же, как другие Node-тесты (без main.js, ui/* и досок),
   и проверяет, что данные контента ссылаются друг на друга корректно.

   Что проверяется:
     1) загрузка: все скрипты из index.html читаются и выполняются без ошибок;
     2) дубли id (апгрейд / ресурс / механика / ярус) — реестр хранит записи в Map
        и молча затирает повтор, поэтому линтер считает КАЖДОЕ добавление
        и падает, если один id встретился больше одного раза;
     3) upgrade.mech и upgrade.res ссылаются на существующие механики и ресурсы
        ('core' — встроенная доска ui/docks.js, её в реестре нет);
     4) upgrade.requires ссылаются на существующие апгрейды и не дают циклов;
     5) строки-формулы (formula / costFormula / costD и поля-хуки движка)
        компилируются и дают конечное число на lvl 0 и lvl 1;
     6) content.groups ссылается на механики и покрывает каждую ровно один раз;
     7) content.*.startVars (карта «переменная формулы → узел дерева») существует;
     8) уникальность omega.rules[].id и patterns.types[].id;
     9) узлы деревьев (tree / psitree / turntree / pacttree): ветвь объявлена,
        глубина целая и ≥ 0, requires ведёт на предка той же ветви с меньшей
        глубиной, excludes взаимны.

   Вывод: «ВСЁ ОК — N проверок» и код 0 либо список ошибок и код 1. */
'use strict';
require('./_limit')(120);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.join(__dirname, '..');
const ROOT = path.resolve(process.argv[2] || ENGINE);

/* Деревья на общем движке mechanics/tree/engine.js — список проверок по ним. */
const TREES = ['tree', 'psitree', 'turntree', 'pacttree'];

/* Нейтральные значения переменных формул (как G.growth.vars + lvl):
   линтеру нужен факт конечного числа, а не баланс. */
const VARS = {
  D: 10, S: 45, q: 3, z: 2, d1: 2, rho: 1, prime: 0, turns: 0,
  breaks: 0, t: 0, runs: 1, cores: 0, bestD: 10, bangs: 0, lvl2: 0, lvl3: 0, lvl4: 0
};

const errors = [];
const sections = [];
let checks = 0;
let cur = null;

function begin(name) {
  cur = { name: name, checks: 0, errors: 0 };
  sections.push(cur);
}

function ok(cond, msg) {
  checks++;
  cur.checks++;
  if (!cond) {
    cur.errors++;
    errors.push(cur.name + ': ' + msg);
  }
  return !!cond;
}

/* ---------- загрузка контента ---------- */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* Список скриптов — из index.html, иначе линтер проверяет устаревший набор. */
function scriptsFromIndex(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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

/* Реестр хранит записи в Map, поэтому повторный id просто затирает первый.
   Оборачиваем add* сразу после core/registry.js и записываем КАЖДУЮ запись:
   так дубли видно по числу добавлений одного и того же id. */
function watchAdds(G, adds) {
  if (!G || !G.registry) return;
  const reg = G.registry;
  const kinds = [
    { add: 'addMechanic', name: 'механика' },
    { add: 'addUpgrade', name: 'апгрейд' },
    { add: 'addResource', name: 'ресурс' },
    { add: 'addTier', name: 'ярус' }
  ];
  for (const k of kinds) {
    const orig = reg[k.add];
    if (typeof orig !== 'function') continue;
    reg[k.add] = function (item) {
      if (item && item.id) adds.push(k.name + ' "' + item.id + '"');
      return orig.call(this, item);
    };
  }
}

function loadContent(root) {
  const adds = [];
  const loadErrors = [];
  const files = scriptsFromIndex(root);
  const sandbox = {
    window: {}, console, performance: { now: () => Date.now() },
    Math, Date, isFinite, Number, JSON
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const f of files) {
    const abs = path.resolve(root, f);
    let code;
    try {
      code = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      loadErrors.push(f + ': файл не читается');
      continue;
    }
    try {
      vm.runInContext(code, sandbox, { filename: f });
    } catch (e) {
      loadErrors.push(f + ': ' + e.message);
    }
    if (/(^|\/)core\/registry\.js$/.test(f)) watchAdds(sandbox.window.G, adds);
  }
  return { files: files, sandbox: sandbox, G: sandbox.window.G, adds: adds, loadErrors: loadErrors };
}

/* ---------- поля-хуки движка ----------
   Список берём из самого кода, чтобы он не разъезжался с движком:
     • core/registry.js — поля, которые реестр компилирует заранее;
     • systems/* и mechanics/* — вызовы upgProduct/upgSum/prod(state, '<поле>'). */
function hookFields() {
  const found = new Set();
  try {
    const regSrc = fs.readFileSync(path.join(ENGINE, 'src/core/registry.js'), 'utf8');
    const block = regSrc.match(/for \(const f of \[([\s\S]*?)\]\)/);
    if (block) for (const m of block[1].matchAll(/'([A-Za-z0-9_]+)'/g)) found.add(m[1]);
  } catch (e) { /* нет движка — ниже сработает проверка на пустой список */ }
  const re = /(?:upgProduct|upgSum|prod)\(\s*state\s*,\s*'([A-Za-z0-9_]+)'/g;
  for (const f of walk(path.join(ENGINE, 'src'), [])) {
    const code = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(code))) found.add(m[1]);
  }
  return Array.from(found).sort();
}

/* Та же семантика, что у core/formula.js (Math в области видимости, переменные из v),
   но БЕЗ проглатывания ошибок: линтер обязан их увидеть. */
function strictFormula(sandbox) {
  return vm.runInContext(
    '(function (src, v) { return new Function("v", "with (Math) { with (v) { return (" + src + "); } }")(v); })',
    sandbox
  );
}

function evalAt(evalFn, src, lvl) {
  try {
    return { value: evalFn(src, Object.assign({}, VARS, { lvl: lvl })) };
  } catch (e) {
    return { error: e.message };
  }
}

/* ---------- проверки ---------- */
function checkLoad(loaded) {
  begin('Загрузка контента');
  ok(loaded.files.length > 0, 'index.html не подключает ни одного скрипта');
  for (const e of loaded.loadErrors) ok(false, e);
  const G = loaded.G;
  if (!ok(G && G.registry, 'нет G.registry — core/registry.js не загрузился')) return false;
  if (!ok(typeof G.registry.allUpgrades === 'function', 'реестр без allUpgrades()')) return false;
  ok(G.registry.mechanics().length > 0, 'ни одной механики');
  ok(G.registry.allUpgrades().length > 0, 'ни одного апгрейда');
  return true;
}

function checkDuplicates(loaded) {
  begin('Дубли id');
  const counts = new Map();
  for (const a of loaded.adds) counts.set(a, (counts.get(a) || 0) + 1);
  for (const entry of counts) ok(entry[1] === 1, 'дубль id: ' + entry[0] + ' (' + entry[1] + ' раза)');
}

function checkRefs(G) {
  begin('Ссылки: механики и ресурсы');
  const mechs = new Set(G.registry.mechanics().map((m) => m.id));
  mechs.add('core');                       // встроенная доска ui/docks.js — не в реестре
  for (const u of G.registry.allUpgrades()) {
    ok(mechs.has(u.mech), 'апгрейд "' + u.id + '": неизвестная механика "' + u.mech + '"');
    /* цена в цифрах (costD) ресурс не тратит — проверять нечего */
    if (u.costD) continue;
    ok(!!G.registry.resource(u.res), 'апгрейд "' + u.id + '": неизвестный ресурс "' + u.res + '"');
  }
}

function checkRequires(G) {
  begin('requires: существование и циклы');
  const all = G.registry.allUpgrades();
  const known = new Set(all.map((u) => u.id));
  const edges = (id) => {
    const u = G.registry.upgrade(id);
    const out = [];
    for (const r of (u && u.requires) || []) if (known.has(r)) out.push(r);
    return out;
  };
  const reaches = (from, target) => {
    const stack = [from];
    const seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const n of edges(id)) stack.push(n);
    }
    return false;
  };
  let withRequires = 0;
  for (const u of all) {
    for (const r of u.requires || []) {
      ok(known.has(r), 'апгрейд "' + u.id + '": requires → нет апгрейда "' + r + '"');
    }
    const req = u.requires || [];
    if (!req.length) continue;
    withRequires++;
    const loop = req.filter((r) => known.has(r) && reaches(r, u.id));
    ok(loop.length === 0, 'цикл requires через "' + u.id + '": ' + u.id + ' → ' + loop.join(', '));
  }
  ok(withRequires > 0, 'ни один апгрейд не объявляет requires — проверять нечего');
}

function checkFormulas(G, sandbox) {
  begin('Строки-формулы');
  const hooks = hookFields();
  ok(hooks.length >= 10, 'поля-хуки движка не найдены (найдено ' + hooks.length + ')');
  const fields = [];
  for (const f of ['formula', 'costFormula', 'costD'].concat(hooks)) {
    if (fields.indexOf(f) < 0) fields.push(f);
  }
  const evalFn = strictFormula(sandbox);
  let srcs = 0;
  for (const u of G.registry.allUpgrades()) {
    for (const field of fields) {
      const src = u[field];
      if (typeof src !== 'string' || !src) continue;
      srcs++;
      for (const lvl of [0, 1]) {
        const r = evalAt(evalFn, src, lvl);
        const where = 'апгрейд "' + u.id + '", поле ' + field + ' ("' + src + '") на lvl ' + lvl;
        if (r.error) ok(false, where + ': ' + r.error);
        else ok(typeof r.value === 'number' && isFinite(r.value), where + ': не конечное число (' + r.value + ')');
      }
    }
  }
  ok(srcs > 0, 'в апгрейдах нет ни одной строки-формулы');
}

function checkGroups(G) {
  begin('Группы досок');
  const groups = (G.content && G.content.groups) || [];
  if (!ok(Array.isArray(groups) && groups.length > 0, 'content.groups пуст или не массив')) return;
  const boards = new Set(G.registry.mechanics().map((m) => m.id));
  boards.add('core');
  const inGroup = new Map();
  const groupIds = new Set();
  for (const g of groups) {
    ok(!!g.id && !groupIds.has(g.id), 'группа с пустым или повторным id: "' + g.id + '"');
    if (g.id) groupIds.add(g.id);
    if (!ok(Array.isArray(g.mechs) && g.mechs.length > 0, 'группа "' + g.id + '": пустой список mechs')) continue;
    for (const id of g.mechs) {
      ok(boards.has(id), 'группа "' + g.id + '": нет доски "' + id + '"');
      inGroup.set(id, (inGroup.get(id) || 0) + 1);
    }
  }
  /* каждая механика-доска должна быть ровно в одной группе навигации */
  for (const m of G.registry.mechanics()) {
    const n = inGroup.get(m.id) || 0;
    ok(n === 1, 'механика "' + m.id + '" должна быть ровно в одной группе (сейчас ' + n + ')');
  }
}

function checkStartVars(G) {
  begin('startVars');
  let found = 0;
  for (const key in (G.content || {})) {
    const c = G.content[key];
    if (!c || typeof c !== 'object' || !c.startVars) continue;
    found++;
    for (const v in c.startVars) {
      const target = c.startVars[v];
      ok(!!G.registry.upgrade(target),
        'startVars.' + v + ' (content.' + key + ') → нет узла "' + target + '"');
    }
  }
  ok(found > 0, 'контент не объявляет ни одного startVars');
}

function checkUniqueLists(G) {
  begin('Уникальность правил и типов');
  const lists = [
    { name: 'правило Ω', items: (G.content.omega && G.content.omega.rules) || [] },
    { name: 'тип паттерна', items: (G.content.patterns && G.content.patterns.types) || [] }
  ];
  for (const l of lists) {
    if (!ok(l.items.length > 0, 'пустой список: ' + l.name)) continue;
    const seen = new Set();
    for (const it of l.items) {
      ok(!!it.id && !seen.has(it.id), 'дубль или пустой id: ' + l.name + ' "' + it.id + '"');
      if (it.id) seen.add(it.id);
    }
  }
}

function checkTrees(G) {
  begin('Деревья');
  for (const id of TREES) {
    const conf = G.content && G.content[id];
    const nodes = G.registry.upgradesOf(id);
    if (!conf && !nodes.length) continue;
    if (!ok(!!conf, 'content.' + id + ' нет, хотя узлы дерева объявлены')) continue;
    const branches = conf.branches || [];
    if (!ok(branches.length > 0, 'дерево ' + id + ': не объявлено ни одной ветви')) continue;
    const branchIds = new Set();
    for (const b of branches) {
      ok(!!b.id && !branchIds.has(b.id), 'дерево ' + id + ': ветвь с пустым или повторным id "' + b.id + '"');
      if (b.id) branchIds.add(b.id);
    }
    if (!ok(nodes.length > 0, 'дерево ' + id + ': ветви объявлены, а узлов нет')) continue;

    const used = new Set();
    for (const n of nodes) {
      used.add(n.branch);
      ok(branchIds.has(n.branch), 'дерево ' + id + ', узел "' + n.id + '": неизвестная ветвь "' + n.branch + '"');
      ok(typeof n.depth === 'number' && isFinite(n.depth) && n.depth >= 0 && n.depth % 1 === 0,
        'дерево ' + id + ', узел "' + n.id + '": глубина должна быть целой и ≥ 0 (сейчас ' + n.depth + ')');

      for (const r of n.requires || []) {
        const parent = G.registry.upgrade(r);
        if (!ok(!!parent, 'дерево ' + id + ', узел "' + n.id + '": requires → нет узла "' + r + '"')) continue;
        ok(parent.mech === id, 'дерево ' + id + ', узел "' + n.id + '": requires "'
          + r + '" из другого дерева (' + parent.mech + ')');
        ok(parent.branch === n.branch, 'дерево ' + id + ', узел "' + n.id + '": requires "'
          + r + '" из другой ветви (' + parent.branch + ')');
        ok(parent.depth < n.depth, 'дерево ' + id + ', узел "' + n.id + '" (глубина ' + n.depth
          + '): requires "' + r + '" не предок (глубина ' + parent.depth + ')');
      }

      for (const ex of n.excludes || []) {
        const other = G.registry.upgrade(ex);
        if (!ok(!!other, 'дерево ' + id + ', узел "' + n.id + '": excludes → нет узла "' + ex + '"')) continue;
        ok((other.excludes || []).indexOf(n.id) >= 0, 'дерево ' + id + ', узел "' + n.id
          + '": excludes "' + ex + '" не взаимны');
      }
    }
    for (const b of branchIds) {
      ok(used.has(b), 'дерево ' + id + ': ветвь "' + b + '" без единого узла');
    }
  }
}

/* ---------- вывод ---------- */
function report() {
  for (const s of sections) {
    console.log('  ' + (s.errors ? '\u2717' : '\u2713') + ' ' + s.name + ' — ' + s.checks + ' проверок'
      + (s.errors ? ', ошибок ' + s.errors : ''));
  }
  if (errors.length) {
    console.log('\nОшибки:');
    for (const e of errors) console.log('  • ' + e);
    console.log('\nПРОВАЛЕНО: ' + errors.length + ' из ' + checks + ' проверок');
    process.exitCode = 1;
  } else {
    console.log('\nВСЁ ОК — ' + checks + ' проверок');
  }
}

let loaded = null;
try {
  loaded = loadContent(ROOT);
} catch (e) {
  begin('Загрузка контента');
  ok(false, 'не удалось прочитать index.html в ' + ROOT + ': ' + e.message);
}

if (loaded && checkLoad(loaded)) {
  const G = loaded.G;
  checkDuplicates(loaded);
  checkRefs(G);
  checkRequires(G);
  checkFormulas(G, loaded.sandbox);
  checkGroups(G);
  checkStartVars(G);
  checkUniqueLists(G);
  checkTrees(G);
}
report();
