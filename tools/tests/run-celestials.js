/* tools/tests/run-celestials.js — прогон тестов фазы 2 (Hall/карта).
   D2-тесты (включая d2-achievements/milestones/offline/rewards) гоняет run-d2.js.
   Запуск: node tools/tests/run-celestials.js */
'use strict';
require('../_limit')(600);

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;
const names = [
  'celestials-state.test.js',
  'celestials-content.test.js',
  'celestial-trials.test.js',
  'celestial-hall.test.js',
  'world-map.test.js'
];
const files = names.filter((f) => fs.existsSync(path.join(DIR, f)));
if (!files.length) {
  console.error('нет тестов фазы 2');
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
console.log('\nТестов фазы 2: ' + files.length + ', провалено: ' + failed);
console.log(failed ? 'ПРОВАЛЕНО: ' + failed : 'ВСЁ ОК — CELESTIALS');
process.exitCode = failed ? 1 : 0;
