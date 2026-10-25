/* tools/tests/run-d2.js — последовательный прогон всех D2-тестов.
   Нужен verify.js/CI: сами тесты — standalone-скрипты, у каждого свой процесс.
   Запуск: node tools/tests/run-d2.js */
'use strict';
require('../_limit')(600);

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;
const files = fs.readdirSync(DIR).filter((f) => /^d2-.*\.test\.js$/.test(f)).sort();
if (!files.length) {
  console.error('нет D2-тестов');
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  console.log('\n=== ' + f + ' ===');
  const r = spawnSync(process.execPath, [path.join(DIR, f)], {
    stdio: 'inherit',
    env: process.env
  });
  if (r.status !== 0) failed++;
  console.log((r.status === 0 ? '  OK' : '  FAIL') + ': ' + f);
}
console.log('\nD2-тестов: ' + files.length + ', провалено: ' + failed);
console.log(failed ? 'ПРОВАЛЕНО: ' + failed : 'ВСЁ ОК — D2');
process.exitCode = failed ? 1 : 0;
