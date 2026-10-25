/* tools/tests/checkcontent.test.js — тест линтера контента (tools/checkcontent.js).
   Запуск:  node tools/tests/checkcontent.test.js

   Что проверяет:
     1) на самом проекте линтер зелёный и печатает «ВСЁ ОК — N проверок»;
     2) на каждом фикстуре из tools/tests/fixtures/checkcontent/* линтер падает
        (код 1) с ожидаемым сообщением — то есть проверка реально ловит нарушение.

   Фикстуры — папки с index.html: настоящие src/core/formula.js и src/core/registry.js
   + _base.js (минимальный корректный граф) + content.js с одним нарушением. */
'use strict';
require('../_limit')(120);

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LINTER = path.join(ROOT, 'tools/checkcontent.js');
const FIXTURES = path.join(__dirname, 'fixtures/checkcontent');

let checks = 0;
let fails = 0;

function check(name, cond, detail) {
  checks++;
  if (cond) {
    console.log('  \u2713 ' + name);
    return;
  }
  fails++;
  console.log('  \u2717 ' + name + (detail ? '\n    ' + detail.split('\n').join('\n    ') : ''));
}

function run(args) {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [LINTER].concat(args), { encoding: 'utf8', timeout: 60000 })
    };
  } catch (e) {
    return {
      code: e.status === undefined ? -1 : e.status,
      out: (e.stdout || '') + (e.stderr || '')
    };
  }
}

console.log('\n1. Проект (текущий HEAD)');
const real = run([]);
const realOk = /ВСЁ ОК — \d+ проверок/.test(real.out);
check('линтер зелёный: ' + (real.out.match(/ВСЁ ОК — \d+ проверок/) || ['нет строки «ВСЁ ОК»'])[0],
  real.code === 0 && realOk, real.out);

console.log('\n2. Фикстуры');
const CASES = [
  { dir: 'ok', code: 0, must: ['ВСЁ ОК — '] },
  {
    dir: 'dup-ids', code: 1,
    must: ['дубль id: ресурс "energy"', 'дубль id: механика "runboard"', 'дубль id: ярус "tier1"',
      'дубль id: апгрейд "base_mult"', 'правило Ω "w_one"', 'тип паттерна "triple"']
  },
  {
    dir: 'links', code: 1,
    must: ['неизвестная механика "ghost_mech"', 'неизвестный ресурс "ghost_res"',
      'requires → нет апгрейда "ghost_upg"', 'группа "run": нет доски "ghost_board"',
      'механика "lonely" должна быть ровно в одной группе', 'startVars.lvl3 (content.turn) → нет узла "ghost_node"']
  },
  { dir: 'cycle', code: 1, must: ['цикл requires через "cyc_a"', 'requires "cyc_b" не предок'] },
  {
    dir: 'formulas', code: 1,
    must: ['bogus is not defined', 'не конечное число (NaN)', 'поле costD ("1e400 * lvl")']
  },
  {
    dir: 'trees', code: 1,
    must: ['неизвестная ветвь "ghost_branch"', 'глубина должна быть целой и ≥ 0', 'не предок',
      'из другой ветви (boom)', 'excludes "bb_same" не взаимны', 'ветвь "empty" без единого узла']
  }
];

for (const c of CASES) {
  const r = run([path.join(FIXTURES, c.dir)]);
  const missing = c.must.filter((s) => r.out.indexOf(s) < 0);
  check(c.dir + ' → код ' + c.code, r.code === c.code && missing.length === 0,
    (r.code !== c.code ? 'код ' + r.code + ' вместо ' + c.code + '\n' : '')
    + (missing.length ? 'нет в выводе: ' + missing.join(' | ') + '\n' : '')
    + r.out);
}

console.log('');
if (fails) {
  console.log('ПРОВАЛЕНО: ' + fails + ' из ' + checks + ' проверок');
  process.exitCode = 1;
} else {
  console.log('ВСЁ ОК, ' + checks + ' проверок');
}
